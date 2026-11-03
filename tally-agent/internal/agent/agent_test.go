package agent

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"time"
	"unicode/utf16"
)

// ── parser parity with the backend ───────────────────────────────────────────

func TestParseTallyResponseMatchesBackendFixtures(t *testing.T) {
	raw, err := os.ReadFile("../../testdata/tally_responses.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixtures []struct {
		Name   string `json:"name"`
		XML    string `json:"xml"`
		Expect struct {
			OK         bool     `json:"ok"`
			Created    int      `json:"created"`
			Altered    int      `json:"altered"`
			Errors     int      `json:"errors"`
			LineErrors []string `json:"lineErrors"`
			Error      *string  `json:"error"`
		} `json:"expect"`
	}
	if err := json.Unmarshal(raw, &fixtures); err != nil {
		t.Fatal(err)
	}
	for _, f := range fixtures {
		t.Run(f.Name, func(t *testing.T) {
			got := ParseTallyResponse(f.XML)
			e := f.Expect
			if got.OK != e.OK || got.Created != e.Created || got.Altered != e.Altered || got.Errors != e.Errors || got.Retryable {
				t.Fatalf("got %+v, want %+v", got, e)
			}
			if strings.Join(got.LineErrors, "|") != strings.Join(e.LineErrors, "|") {
				t.Fatalf("lineErrors %q, want %q", got.LineErrors, e.LineErrors)
			}
			if (got.Error == nil) != (e.Error == nil) || (got.Error != nil && *got.Error != *e.Error) {
				t.Fatalf("error %v, want %v", deref(got.Error), deref(e.Error))
			}
			// Backend's Joi schema rejects null lineErrors.
			b, _ := json.Marshal(got)
			if strings.Contains(string(b), `"lineErrors":null`) {
				t.Fatal("lineErrors must serialise as [], not null")
			}
		})
	}
}

func deref(s *string) string {
	if s == nil {
		return "<nil>"
	}
	return *s
}

func TestDecodeUTF16Response(t *testing.T) {
	s := "<RESPONSE><CREATED>1</CREATED><ERRORS>0</ERRORS></RESPONSE>"
	u := utf16.Encode([]rune(s))
	b := []byte{0xFF, 0xFE}
	for _, c := range u {
		b = binary.LittleEndian.AppendUint16(b, c)
	}
	if got := ParseTallyResponse(DecodeTallyBody(b)); !got.OK || got.Created != 1 {
		t.Fatalf("UTF-16LE response misparsed: %+v", got)
	}
}

// ── company safety ───────────────────────────────────────────────────────────

func TestParseCompanies(t *testing.T) {
	body := `<ENVELOPE><BODY><DATA><COLLECTION>
	  <COMPANY NAME="Mehta &amp; Co (2026-27)" RESERVEDNAME=""><NAME TYPE="String">Mehta &amp; Co (2026-27)</NAME></COMPANY>
	  <COMPANY><NAME>Acme Traders</NAME></COMPANY>
	</COLLECTION></DATA></BODY></ENVELOPE>`
	got := parseCompanies(body)
	if strings.Join(got, "|") != "Acme Traders|Mehta & Co (2026-27)" {
		t.Fatalf("got %q", got)
	}
}

func TestCompanyDecision(t *testing.T) {
	cases := []struct {
		open    []string
		want    string
		okay    bool
		reasonH string
	}{
		{[]string{"Acme Traders"}, "acme traders", true, ""},
		{nil, "Acme", false, "No company is open"},
		{[]string{"Other Co"}, "Acme", false, "is not open"},
		{[]string{"Acme", "Other Co"}, "Acme", false, "Several companies are open"},
	}
	for _, c := range cases {
		err := companyDecision(c.open, c.want)
		if (err == nil) != c.okay || (err != nil && !strings.Contains(err.Error(), c.reasonH)) {
			t.Errorf("open=%v want=%q: got %v", c.open, c.want, err)
		}
	}
}

// ── config ───────────────────────────────────────────────────────────────────

func TestConfigValidation(t *testing.T) {
	base := Config{APIURL: "https://api.verax.in", Token: "vtally_abc", TallyURL: DefaultTallyURL, TallyCompany: "Acme"}
	if p := base.Validate(); len(p) != 0 {
		t.Fatalf("valid config rejected: %v", p)
	}
	bad := base
	bad.APIURL = "http://api.verax.in"
	if p := bad.Validate(); len(p) == 0 || !strings.Contains(p[0], "https") {
		t.Fatalf("plain-http remote API must be refused (token would travel in clear): %v", p)
	}
	local := base
	local.APIURL = "http://localhost:3000"
	if p := local.Validate(); len(p) != 0 {
		t.Fatalf("http to localhost should be allowed: %v", p)
	}
	noCo := base
	noCo.TallyCompany = "  "
	if len(noCo.Validate()) == 0 {
		t.Fatal("missing company must be refused")
	}
	badTok := base
	badTok.Token = "eyJhbGciOi"
	if len(badTok.Validate()) == 0 {
		t.Fatal("a non-agent token (e.g. a user JWT) must be refused")
	}
	for in, want := range map[int]time.Duration{0: 4 * time.Second, 10: time.Second, 999999: time.Minute, 2500: 2500 * time.Millisecond} {
		if got := (&Config{PollIntervalMS: in}).PollInterval(); got != want {
			t.Errorf("PollInterval(%d) = %s, want %s", in, got, want)
		}
	}
}

// ── agent loop against fake Verax + fake Tally ──────────────────────────────

const companiesXML = `<ENVELOPE><BODY><DATA><COLLECTION><COMPANY NAME="Acme Traders"><NAME>Acme Traders</NAME></COMPANY></COLLECTION></DATA></BODY></ENVELOPE>`
const okXML = `<RESPONSE><CREATED>1</CREATED><ALTERED>0</ALTERED><ERRORS>0</ERRORS></RESPONSE>`
const voucher = `<?xml version="1.0" encoding="UTF-8"?><ENVELOPE><BODY><IMPORTDATA><REQUESTDATA><TALLYMESSAGE><VOUCHER REMOTEID="verax-doc-1" VCHTYPE="Purchase"/></TALLYMESSAGE></REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>`

type fakeTally struct {
	mu        sync.Mutex
	down      bool
	companies string
	importFn  func() (int, string)
	imported  []string
	delay     time.Duration
}

func (f *fakeTally) handler(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	down, delay := f.down, f.delay
	f.mu.Unlock()
	if down {
		hj, _ := w.(http.Hijacker)
		c, _, _ := hj.Hijack()
		c.Close()
		return
	}
	if r.Method == http.MethodGet {
		io.WriteString(w, "<RESPONSE>TallyPrime Server is Running</RESPONSE>")
		return
	}
	b, _ := io.ReadAll(r.Body)
	if strings.Contains(string(b), "List of Companies") {
		f.mu.Lock()
		io.WriteString(w, f.companies)
		f.mu.Unlock()
		return
	}
	time.Sleep(delay)
	f.mu.Lock()
	f.imported = append(f.imported, string(b))
	status, body := 200, okXML
	if f.importFn != nil {
		status, body = f.importFn()
	}
	f.mu.Unlock()
	w.WriteHeader(status)
	io.WriteString(w, body)
}

type fakeVerax struct {
	mu          sync.Mutex
	jobs        []*Job
	claims      int
	reports     []Result
	reportFails int
	heartbeats  []string
	authFail    bool
	rateLimit   int
	gotAuth     string
}

func (f *fakeVerax) handler(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.gotAuth = r.Header.Get("Authorization")
	if f.authFail {
		w.WriteHeader(401)
		return
	}
	switch {
	case strings.HasSuffix(r.URL.Path, "/heartbeat"):
		var hb struct {
			TallyStatus string `json:"tallyStatus"`
		}
		_ = json.NewDecoder(r.Body).Decode(&hb)
		f.heartbeats = append(f.heartbeats, hb.TallyStatus)
		w.Write([]byte(`{"ok":true}`))
	case strings.HasSuffix(r.URL.Path, "/claim"):
		if f.rateLimit > 0 {
			f.rateLimit--
			w.Header().Set("Retry-After", "7")
			w.WriteHeader(429)
			return
		}
		f.claims++
		if len(f.jobs) == 0 {
			w.WriteHeader(204)
			return
		}
		j := f.jobs[0]
		f.jobs = f.jobs[1:]
		json.NewEncoder(w).Encode(map[string]any{"job": j})
	case strings.HasSuffix(r.URL.Path, "/result"):
		if f.reportFails > 0 {
			f.reportFails--
			w.WriteHeader(503)
			return
		}
		var res Result
		_ = json.NewDecoder(r.Body).Decode(&res)
		f.reports = append(f.reports, res)
		w.Write([]byte(`{"status":"succeeded"}`))
	default:
		w.WriteHeader(404)
	}
}

type harness struct {
	t      *testing.T
	tally  *fakeTally
	verax  *fakeVerax
	agent  *Agent
	sleeps []time.Duration
	mu     sync.Mutex
}

func newHarness(t *testing.T) *harness {
	h := &harness{t: t, tally: &fakeTally{companies: companiesXML}, verax: &fakeVerax{}}
	ts := httptest.NewServer(http.HandlerFunc(h.tally.handler))
	vs := httptest.NewServer(http.HandlerFunc(h.verax.handler))
	t.Cleanup(ts.Close)
	t.Cleanup(vs.Close)
	h.agent = &Agent{
		Verax:        NewVerax(vs.URL, "vtally_test", "test"),
		Tally:        NewTally(ts.URL),
		Company:      "Acme Traders",
		Version:      "test",
		PollInterval: time.Second,
		Log:          slog.New(slog.NewTextHandler(io.Discard, nil)),
	}
	return h
}

// run drives the loop until stop() is true (checked on every sleep) or a
// safety cap is hit; sleeps are recorded, not waited.
func (h *harness) run(stop func() bool) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	n := 0
	h.agent.Sleep = func(ctx context.Context, d time.Duration) bool {
		h.mu.Lock()
		h.sleeps = append(h.sleeps, d)
		h.mu.Unlock()
		n++
		if stop() || n > 50 {
			cancel()
			return false
		}
		return ctx.Err() == nil
	}
	done := make(chan struct{})
	go func() { _ = h.agent.Run(ctx); close(done) }()
	select {
	case <-done:
	case <-time.After(10 * time.Second):
		h.t.Fatal("agent loop did not stop")
	}
}

func (h *harness) reports() []Result {
	h.verax.mu.Lock()
	defer h.verax.mu.Unlock()
	return append([]Result(nil), h.verax.reports...)
}

func TestPushesVoucherUnchangedAndReportsSuccess(t *testing.T) {
	h := newHarness(t)
	h.verax.jobs = []*Job{{ID: "j1", DocumentID: "d1", RemoteID: "verax-doc-1", VoucherXML: voucher, Attempts: 1}}
	h.run(func() bool { return len(h.reports()) == 1 })

	r := h.reports()
	if len(r) != 1 || !r[0].OK || r[0].Created != 1 {
		t.Fatalf("reports = %+v", r)
	}
	if len(h.tally.imported) != 1 || h.tally.imported[0] != voucher {
		t.Fatal("the voucher XML must reach Tally byte-for-byte unchanged")
	}
	if h.verax.gotAuth != "Bearer vtally_test" {
		t.Fatalf("auth header = %q", h.verax.gotAuth)
	}
	if h.verax.heartbeats[0] != StatusReady {
		t.Fatalf("first heartbeat status = %q", h.verax.heartbeats[0])
	}
}

func TestLineErrorIsReportedAsTerminal(t *testing.T) {
	h := newHarness(t)
	h.tally.importFn = func() (int, string) {
		return 200, `<RESPONSE><ERRORS>1</ERRORS><LINEERROR>Ledger 'CGST' does not exist</LINEERROR></RESPONSE>`
	}
	h.verax.jobs = []*Job{{ID: "j1", VoucherXML: voucher}}
	h.run(func() bool { return len(h.reports()) == 1 })
	r := h.reports()[0]
	if r.OK || r.Retryable || !strings.Contains(deref(r.Error), "CGST") {
		t.Fatalf("got %+v", r)
	}
}

func TestTallyErrorDuringPushIsRetryable(t *testing.T) {
	h := newHarness(t)
	h.tally.importFn = func() (int, string) { return 500, "boom" }
	h.verax.jobs = []*Job{{ID: "j1", VoucherXML: voucher}}
	h.run(func() bool { return len(h.reports()) == 1 })
	r := h.reports()[0]
	if r.OK || !r.Retryable || !strings.Contains(deref(r.Error), "did not respond") {
		t.Fatalf("got %+v", r)
	}
}

func TestDoesNotClaimWhileTallyIsClosed(t *testing.T) {
	h := newHarness(t)
	h.tally.down = true
	h.verax.jobs = []*Job{{ID: "j1", VoucherXML: voucher}}
	h.run(func() bool { return len(h.sleeps) >= 3 })
	if h.verax.claims != 0 {
		t.Fatalf("claimed %d jobs with Tally closed — they would burn their retry attempts", h.verax.claims)
	}
	if len(h.verax.heartbeats) == 0 || !strings.Contains(h.verax.heartbeats[0], "not reachable") {
		t.Fatalf("Verax should be told Tally is down, heartbeats=%q", h.verax.heartbeats)
	}
}

func TestRefusesWhenWrongOrSeveralCompaniesOpen(t *testing.T) {
	for name, companies := range map[string]string{
		"wrong":   `<COMPANY NAME="Someone Else Ltd"/>`,
		"several": `<COMPANY NAME="Acme Traders"/><COMPANY NAME="Someone Else Ltd"/>`,
	} {
		t.Run(name, func(t *testing.T) {
			h := newHarness(t)
			h.tally.companies = companies
			h.verax.jobs = []*Job{{ID: "j1", VoucherXML: voucher}}
			h.run(func() bool { return len(h.sleeps) >= 2 })
			if h.verax.claims != 0 || len(h.tally.imported) != 0 {
				t.Fatal("must not claim or push with the wrong company set open")
			}
			if !strings.Contains(h.verax.heartbeats[0], "Someone Else Ltd") {
				t.Fatalf("heartbeat should explain the problem: %q", h.verax.heartbeats[0])
			}
		})
	}
}

func TestRevokedTokenPausesInsteadOfHammering(t *testing.T) {
	h := newHarness(t)
	h.verax.authFail = true
	h.run(func() bool { return len(h.sleeps) >= 1 })
	if h.sleeps[0] != unauthorizedPause {
		t.Fatalf("first sleep = %s, want %s", h.sleeps[0], unauthorizedPause)
	}
}

func TestHonoursRetryAfter(t *testing.T) {
	h := newHarness(t)
	h.verax.rateLimit = 1
	h.run(func() bool { return len(h.sleeps) >= 1 })
	if h.sleeps[0] != 7*time.Second {
		t.Fatalf("sleep = %s, want Retry-After 7s", h.sleeps[0])
	}
}

func TestReportIsRetriedWhenVeraxBlips(t *testing.T) {
	h := newHarness(t)
	h.verax.reportFails = 2
	h.verax.jobs = []*Job{{ID: "j1", VoucherXML: voucher}}
	h.run(func() bool { return len(h.reports()) == 1 })
	if r := h.reports(); len(r) != 1 || !r[0].OK {
		t.Fatalf("result should arrive after retries: %+v", r)
	}
}

func TestShutdownMidPushStillReports(t *testing.T) {
	h := newHarness(t)
	h.tally.delay = 300 * time.Millisecond
	h.verax.jobs = []*Job{{ID: "j1", VoucherXML: voucher}}
	ctx, cancel := context.WithCancel(context.Background())
	h.agent.Sleep = func(ctx context.Context, d time.Duration) bool { return sleepCtx(ctx, time.Millisecond) }
	done := make(chan struct{})
	go func() { _ = h.agent.Run(ctx); close(done) }()
	time.Sleep(150 * time.Millisecond) // agent is now inside the slow Tally import
	cancel()
	<-done
	if r := h.reports(); len(r) != 1 || !r[0].OK {
		t.Fatalf("a voucher Tally accepted must be reported even on shutdown: %+v", r)
	}
}
