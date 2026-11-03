//go:build !windows

package agent

import "errors"

// Without DPAPI there is no safe place to persist the token, so refuse rather
// than write it in plain text. Non-Windows runs (development, CI) pass the
// token in VERAX_AGENT_TOKEN instead.
var errNoSecureStore = errors.New("secure token storage needs Windows; set VERAX_AGENT_TOKEN instead")

func protect([]byte) ([]byte, error)   { return nil, errNoSecureStore }
func unprotect([]byte) ([]byte, error) { return nil, errNoSecureStore }
func restrictToAdmins(string) error    { return nil }
