package agent

import (
	"context"
	"errors"
	"log/slog"
	"time"
)

// Agent bridges the Verax job queue and a local TallyPrime.
//
// Loop: make sure Tally is ready (reachable, exactly the expected company
// open) → claim a job → POST its XML to Tally unchanged → report the parsed
// result. It checks Tally *before* claiming so a closed Tally overnight leaves
// jobs queued instead of burning their 5 attempts in a few seconds.
type Agent struct {
	Verax        *Verax
	Tally        *Tally
	Company      string
	Version      string
	PollInterval time.Duration
	Log          *slog.Logger

	// Overridable for tests.
	HeartbeatEvery time.Duration
	Sleep          func(ctx context.Context, d time.Duration) bool

	lastHeartbeat time.Time
	lastStatus    string
}

const (
	defaultHeartbeat  = 30 * time.Second
	unauthorizedPause = 5 * time.Minute
	notReadyPause     = 15 * time.Second
	maxBackoff        = 60 * time.Second
	reportAttempts    = 5
)

// StatusReady is the tallyStatus the agent reports when it can push.
const StatusReady = "ready"

func sleepCtx(ctx context.Context, d time.Duration) bool {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-t.C:
		return true
	}
}

func (a *Agent) sleep(ctx context.Context, d time.Duration) bool {
	if a.Sleep != nil {
		return a.Sleep(ctx, d)
	}
	return sleepCtx(ctx, d)
}

func (a *Agent) heartbeatEvery() time.Duration {
	if a.HeartbeatEvery > 0 {
		return a.HeartbeatEvery
	}
	return defaultHeartbeat
}

// heartbeat sends when due or when Tally's status changed, so Verax shows a
// problem within seconds rather than on the next 30s tick.
func (a *Agent) heartbeat(ctx context.Context, status string, force bool) error {
	if !force && status == a.lastStatus && time.Since(a.lastHeartbeat) < a.heartbeatEvery() {
		return nil
	}
	err := a.Verax.Heartbeat(ctx, a.Version, status)
	if err == nil {
		a.lastHeartbeat = time.Now()
		a.lastStatus = status
	}
	return err
}

type backoff struct{ cur, min, max time.Duration }

func (b *backoff) next() time.Duration {
	if b.cur == 0 {
		b.cur = b.min
	} else {
		b.cur *= 2
	}
	if b.cur > b.max {
		b.cur = b.max
	}
	return b.cur
}
func (b *backoff) reset() { b.cur = 0 }

// Run blocks until ctx is cancelled. A job already pushed to Tally is always
// reported before Run returns, even on shutdown.
func (a *Agent) Run(ctx context.Context) error {
	a.Log.Info("agent starting", "version", a.Version, "verax", a.Verax.BaseURL, "tally", a.Tally.BaseURL, "company", a.Company)
	bo := &backoff{min: 2 * time.Second, max: maxBackoff}
	loggedNotReady := ""

	for ctx.Err() == nil {
		// 1. Tally must be ready before we take a job off the queue.
		status := StatusReady
		if err := a.Tally.CheckReady(ctx, a.Company); err != nil {
			if ctx.Err() != nil {
				break
			}
			status = err.Error()
		}
		if hbErr := a.heartbeat(ctx, status, false); hbErr != nil {
			if !a.handleVeraxErr(ctx, hbErr, bo, "heartbeat") {
				break
			}
			continue
		}
		if status != StatusReady {
			if status != loggedNotReady {
				a.Log.Warn("waiting for Tally", "reason", status)
				loggedNotReady = status
			}
			if !a.sleep(ctx, notReadyPause) {
				break
			}
			continue
		}
		if loggedNotReady != "" {
			a.Log.Info("Tally is ready", "company", a.Company)
			loggedNotReady = ""
		}

		// 2. Claim.
		job, err := a.Verax.Claim(ctx)
		if err != nil {
			if !a.handleVeraxErr(ctx, err, bo, "claim") {
				break
			}
			continue
		}
		bo.reset()
		if job == nil {
			if !a.sleep(ctx, a.PollInterval) {
				break
			}
			continue
		}

		// 3. Push + report — detached from ctx so shutdown can't strand a
		// voucher that Tally already accepted without telling Verax.
		res := a.process(context.WithoutCancel(ctx), job)
		if res.Retryable && !a.sleep(ctx, bo.next()) {
			break
		}
	}
	a.Log.Info("agent stopped")
	return nil
}

// handleVeraxErr logs and waits appropriately; false means ctx was cancelled.
func (a *Agent) handleVeraxErr(ctx context.Context, err error, bo *backoff, op string) bool {
	if ctx.Err() != nil {
		return false
	}
	var rl *RateLimitedError
	switch {
	case errors.Is(err, ErrUnauthorized):
		a.Log.Error("agent token rejected; pausing", "op", op, "error", err, "retryIn", unauthorizedPause)
		return a.sleep(ctx, unauthorizedPause)
	case errors.As(err, &rl):
		a.Log.Warn("rate limited by Verax", "op", op, "retryIn", rl.RetryAfter)
		return a.sleep(ctx, rl.RetryAfter)
	default:
		d := bo.next()
		a.Log.Warn("Verax request failed; backing off", "op", op, "error", err, "retryIn", d)
		return a.sleep(ctx, d)
	}
}

func (a *Agent) process(ctx context.Context, job *Job) Result {
	log := a.Log.With("job", job.ID, "document", job.DocumentID, "attempt", job.Attempts)
	log.Info("pushing voucher to Tally", "remoteId", job.RemoteID)

	var res Result
	body, err := a.Tally.Import(ctx, job.VoucherXML)
	if err != nil {
		res = TransportFailure("Tally did not respond to the import: " + err.Error())
	} else {
		res = ParseTallyResponse(body)
	}

	status, err := a.reportWithRetry(ctx, job.ID, res)
	errText := ""
	if res.Error != nil {
		errText = *res.Error
	}
	switch {
	case err != nil:
		// Verax will requeue the job once its claim goes stale (5 min); the
		// voucher's REMOTEID makes the re-push an alter, not a duplicate.
		log.Error("could not report result to Verax; job will be retried", "error", err, "tallyOk", res.OK)
	case res.OK:
		log.Info("voucher accepted by Tally", "created", res.Created, "altered", res.Altered, "verax", status)
	default:
		log.Warn("voucher not imported", "error", errText, "retryable", res.Retryable, "verax", status)
	}
	return res
}

func (a *Agent) reportWithRetry(ctx context.Context, jobID string, res Result) (string, error) {
	delay := 2 * time.Second
	var lastErr error
	for attempt := 1; attempt <= reportAttempts; attempt++ {
		status, err := a.Verax.Report(ctx, jobID, res)
		if err == nil {
			return status, nil
		}
		lastErr = err
		var api *APIError
		if errors.As(err, &api) && api.Status >= 400 && api.Status < 500 {
			return "", err // e.g. 404: job not ours/requeued — retrying won't help
		}
		if errors.Is(err, ErrUnauthorized) || attempt == reportAttempts {
			break
		}
		a.sleep(ctx, delay)
		delay *= 2
	}
	return "", lastErr
}
