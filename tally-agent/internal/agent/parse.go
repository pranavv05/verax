package agent

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"unicode/utf16"
)

// Result is what the agent reports to POST /api/tally/agent/jobs/:id/result.
// Field names and semantics match parseTallyResponse in
// backend/src/services/tally-connector.service.js; testdata/tally_responses.json
// is shared by both test suites so the two can't drift apart.
type Result struct {
	OK         bool     `json:"ok"`
	Created    int      `json:"created"`
	Altered    int      `json:"altered"`
	Errors     int      `json:"errors"`
	LineErrors []string `json:"lineErrors"`
	Retryable  bool     `json:"retryable"`
	Error      *string  `json:"error"`
	Raw        string   `json:"raw"`
}

const maxRawChars = 4000

var lineErrorRe = regexp.MustCompile(`(?is)<LINEERROR>(.*?)</LINEERROR>`)

func countTag(text, tag string) int {
	re := regexp.MustCompile(`(?i)<` + tag + `>\s*(\d+)\s*</` + tag + `>`)
	m := re.FindStringSubmatch(text)
	if m == nil {
		return 0
	}
	n, err := strconv.Atoi(m[1])
	if err != nil {
		return 0
	}
	return n
}

// ParseTallyResponse turns TallyPrime's import response into a Result.
func ParseTallyResponse(text string) Result {
	created := countTag(text, "CREATED")
	altered := countTag(text, "ALTERED")
	errs := countTag(text, "ERRORS") + countTag(text, "EXCEPTIONS")

	lineErrors := []string{}
	for _, m := range lineErrorRe.FindAllStringSubmatch(text, -1) {
		lineErrors = append(lineErrors, strings.TrimSpace(m[1]))
	}

	ok := errs == 0 && len(lineErrors) == 0 && created+altered > 0

	var errMsg *string
	switch {
	case len(lineErrors) > 0:
		s := strings.Join(lineErrors, "; ")
		errMsg = &s
	case ok:
		errMsg = nil
	case errs > 0:
		s := fmt.Sprintf("Tally reported %d error(s) importing the voucher", errs)
		errMsg = &s
	default:
		s := "Tally reported no created or altered vouchers"
		errMsg = &s
	}

	return Result{
		OK:         ok,
		Created:    created,
		Altered:    altered,
		Errors:     errs,
		LineErrors: lineErrors,
		Retryable:  false,
		Error:      errMsg,
		Raw:        truncateRunes(text, maxRawChars),
	}
}

// TransportFailure is the result for a push that never got a response from
// Tally (closed, crashed, timed out). Retryable: the same XML may well succeed
// once Tally is back, unlike a LINEERROR.
func TransportFailure(reason string) Result {
	return Result{OK: false, LineErrors: []string{}, Retryable: true, Error: &reason}
}

func truncateRunes(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n])
}

// DecodeTallyBody returns the body as a Go string. Tally answers in UTF-16
// when the request was UTF-16; the backend sends UTF-8, but decode either way
// so a BOM never turns a valid response into "no created vouchers".
func DecodeTallyBody(b []byte) string {
	switch {
	case bytes.HasPrefix(b, []byte{0xFF, 0xFE}):
		return decodeUTF16(b[2:], binary.LittleEndian)
	case bytes.HasPrefix(b, []byte{0xFE, 0xFF}):
		return decodeUTF16(b[2:], binary.BigEndian)
	case bytes.HasPrefix(b, []byte{0xEF, 0xBB, 0xBF}):
		return string(b[3:])
	}
	return string(b)
}

func decodeUTF16(b []byte, order binary.ByteOrder) string {
	u := make([]uint16, len(b)/2)
	for i := range u {
		u[i] = order.Uint16(b[2*i:])
	}
	return string(utf16.Decode(u))
}
