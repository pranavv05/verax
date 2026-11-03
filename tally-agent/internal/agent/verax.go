package agent

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// Verax is the agent-facing Verax API client. The token goes only in the
// Authorization header and is never logged or put in an error message.
type Verax struct {
	BaseURL   string
	token     string
	UserAgent string
	HTTP      *http.Client
}

func NewVerax(baseURL, token, userAgent string) *Verax {
	return &Verax{
		BaseURL:   strings.TrimRight(baseURL, "/"),
		token:     token,
		UserAgent: userAgent,
		HTTP:      &http.Client{Timeout: 30 * time.Second},
	}
}

// Job is a claimed sync job.
type Job struct {
	ID         string `json:"id"`
	DocumentID string `json:"documentId"`
	RemoteID   string `json:"remoteId"`
	VoucherXML string `json:"voucherXml"`
	Attempts   int    `json:"attempts"`
}

var ErrUnauthorized = errors.New("Verax rejected the agent token (revoked or wrong) — create a new agent in Verax and run setup again")

// RateLimitedError means Verax asked us to slow down.
type RateLimitedError struct{ RetryAfter time.Duration }

func (e *RateLimitedError) Error() string {
	return fmt.Sprintf("Verax rate limit reached, retrying in %s", e.RetryAfter.Round(time.Second))
}

// APIError is any other non-success answer.
type APIError struct {
	Status  int
	Message string
}

func (e *APIError) Error() string {
	if e.Message != "" {
		return fmt.Sprintf("Verax answered HTTP %d: %s", e.Status, e.Message)
	}
	return fmt.Sprintf("Verax answered HTTP %d", e.Status)
}

func (v *Verax) do(ctx context.Context, path string, payload any) (*http.Response, []byte, error) {
	var body io.Reader
	if payload != nil {
		b, err := json.Marshal(payload)
		if err != nil {
			return nil, nil, err
		}
		body = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, v.BaseURL+path, body)
	if err != nil {
		return nil, nil, err
	}
	req.Header.Set("Authorization", "Bearer "+v.token)
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", v.UserAgent)
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := v.HTTP.Do(req)
	if err != nil {
		return nil, nil, fmt.Errorf("could not reach Verax at %s: %w", v.BaseURL, stripURL(err))
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(io.LimitReader(resp.Body, 32<<20))

	switch {
	case resp.StatusCode == http.StatusUnauthorized:
		return resp, b, ErrUnauthorized
	case resp.StatusCode == http.StatusTooManyRequests:
		return resp, b, &RateLimitedError{RetryAfter: retryAfter(resp.Header.Get("Retry-After"))}
	case resp.StatusCode >= 400:
		var e struct {
			Message string `json:"message"`
		}
		_ = json.Unmarshal(b, &e)
		return resp, b, &APIError{Status: resp.StatusCode, Message: e.Message}
	}
	return resp, b, nil
}

// Heartbeat reports liveness, version and Tally's state (shown in Verax).
func (v *Verax) Heartbeat(ctx context.Context, version, tallyStatus string) error {
	_, _, err := v.do(ctx, "/api/tally/agent/heartbeat", map[string]string{
		"agentVersion": truncateRunes(version, 50),
		"tallyStatus":  truncateRunes(tallyStatus, 200),
	})
	return err
}

// Claim returns the next job, or nil when the queue is empty.
func (v *Verax) Claim(ctx context.Context) (*Job, error) {
	resp, b, err := v.do(ctx, "/api/tally/agent/claim", nil)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode == http.StatusNoContent {
		return nil, nil
	}
	var out struct {
		Job *Job `json:"job"`
	}
	if err := json.Unmarshal(b, &out); err != nil || out.Job == nil || out.Job.ID == "" || out.Job.VoucherXML == "" {
		return nil, fmt.Errorf("Verax sent a job the agent could not read")
	}
	return out.Job, nil
}

// Report sends a job's outcome; returns Verax's resulting job status.
func (v *Verax) Report(ctx context.Context, jobID string, r Result) (string, error) {
	_, b, err := v.do(ctx, "/api/tally/agent/jobs/"+jobID+"/result", r)
	if err != nil {
		return "", err
	}
	var out struct {
		Status string `json:"status"`
	}
	_ = json.Unmarshal(b, &out)
	return out.Status, nil
}

func retryAfter(h string) time.Duration {
	if s, err := strconv.Atoi(strings.TrimSpace(h)); err == nil && s > 0 {
		return time.Duration(s) * time.Second
	}
	if t, err := http.ParseTime(h); err == nil {
		if d := time.Until(t); d > 0 {
			return d
		}
	}
	return 60 * time.Second
}

// stripURL keeps transport errors readable; Go's url.Error repeats the URL.
func stripURL(err error) error {
	var ue interface{ Unwrap() error }
	if errors.As(err, &ue) {
		if inner := ue.Unwrap(); inner != nil {
			return inner
		}
	}
	return err
}
