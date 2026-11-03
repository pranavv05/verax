package agent

import (
	"context"
	"errors"
	"fmt"
	"html"
	"io"
	"net/http"
	"regexp"
	"sort"
	"strings"
	"time"
)

// Tally talks to TallyPrime's local HTTP XML server (default localhost:9000).
type Tally struct {
	BaseURL string
	HTTP    *http.Client
}

func NewTally(baseURL string) *Tally {
	return &Tally{BaseURL: strings.TrimRight(baseURL, "/"), HTTP: &http.Client{Timeout: 60 * time.Second}}
}

// maxTallyResponse bounds how much of a response we read; a real import
// response is a few hundred bytes.
const maxTallyResponse = 4 << 20

func (t *Tally) post(ctx context.Context, body string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, t.BaseURL, strings.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "text/xml; charset=utf-8")
	resp, err := t.HTTP.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	b, err := io.ReadAll(io.LimitReader(resp.Body, maxTallyResponse))
	if err != nil {
		return "", fmt.Errorf("reading Tally response: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("Tally answered HTTP %d", resp.StatusCode)
	}
	return DecodeTallyBody(b), nil
}

// Ping confirms Tally's HTTP server is up.
func (t *Tally) Ping(ctx context.Context) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, t.BaseURL, nil)
	if err != nil {
		return err
	}
	resp, err := t.HTTP.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 64<<10))
	if resp.StatusCode >= 500 {
		return fmt.Errorf("Tally answered HTTP %d", resp.StatusCode)
	}
	return nil
}

const listCompaniesRequest = `<ENVELOPE>
<HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>List of Companies</ID></HEADER>
<BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES></DESC></BODY>
</ENVELOPE>`

var (
	companyAttrRe = regexp.MustCompile(`(?is)<COMPANY\b[^>]*?\bNAME="([^"]*)"`)
	companyElemRe = regexp.MustCompile(`(?is)<COMPANY\b[^>]*>(.*?)</COMPANY>`)
	nameElemRe    = regexp.MustCompile(`(?is)<NAME\b[^>]*>([^<]*)</NAME>`)
)

// LoadedCompanies returns the companies currently open in Tally.
func (t *Tally) LoadedCompanies(ctx context.Context) ([]string, error) {
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	body, err := t.post(ctx, listCompaniesRequest)
	if err != nil {
		return nil, err
	}
	return parseCompanies(body), nil
}

func parseCompanies(body string) []string {
	seen := map[string]bool{}
	var out []string
	add := func(raw string) {
		name := strings.TrimSpace(html.UnescapeString(raw))
		if name == "" || seen[strings.ToLower(name)] {
			return
		}
		seen[strings.ToLower(name)] = true
		out = append(out, name)
	}
	for _, m := range companyAttrRe.FindAllStringSubmatch(body, -1) {
		add(m[1])
	}
	for _, m := range companyElemRe.FindAllStringSubmatch(body, -1) {
		if n := nameElemRe.FindStringSubmatch(m[1]); n != nil {
			add(n[1])
		}
	}
	sort.Strings(out)
	return out
}

// Import POSTs a complete import envelope exactly as given (the agent never
// edits voucher XML — its REMOTEIDs are what keep re-pushes idempotent).
func (t *Tally) Import(ctx context.Context, envelope string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, 45*time.Second)
	defer cancel()
	return t.post(ctx, envelope)
}

// ErrTallyNotReady carries a short, human-readable reason the agent shows in
// Verax (via heartbeat) and in its log.
type ErrTallyNotReady struct{ Reason string }

func (e *ErrTallyNotReady) Error() string { return e.Reason }

// CheckReady verifies Tally is reachable and that exactly the expected company
// is open. Tally imports into the active company, so with the wrong company —
// or several — open, vouchers could land in someone else's books. Refusing is
// the only safe answer.
func (t *Tally) CheckReady(ctx context.Context, expectedCompany string) error {
	if err := t.Ping(ctx); err != nil {
		return &ErrTallyNotReady{Reason: fmt.Sprintf("Tally is not reachable at %s — is TallyPrime open?", t.BaseURL)}
	}
	companies, err := t.LoadedCompanies(ctx)
	if err != nil {
		return &ErrTallyNotReady{Reason: "Tally did not answer the company check: " + err.Error()}
	}
	return companyDecision(companies, expectedCompany)
}

func companyDecision(open []string, expected string) error {
	want := strings.TrimSpace(expected)
	if len(open) == 0 {
		return &ErrTallyNotReady{Reason: fmt.Sprintf("No company is open in Tally. Open %q.", want)}
	}
	found := false
	for _, c := range open {
		if strings.EqualFold(strings.TrimSpace(c), want) {
			found = true
		}
	}
	if !found {
		return &ErrTallyNotReady{Reason: fmt.Sprintf("%q is not open in Tally (open: %s).", want, strings.Join(open, ", "))}
	}
	if len(open) > 1 {
		return &ErrTallyNotReady{Reason: fmt.Sprintf("Several companies are open in Tally (%s). Close all except %q so vouchers can't go into the wrong books.", strings.Join(open, ", "), want)}
	}
	return nil
}

func IsNotReady(err error) (*ErrTallyNotReady, bool) {
	var nr *ErrTallyNotReady
	ok := errors.As(err, &nr)
	return nr, ok
}
