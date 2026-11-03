package agent

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"
)

// Config is what setup writes and the agent reads. On Windows the token is
// stored DPAPI-encrypted (TokenProtected); it is never written in plain text.
type Config struct {
	APIURL         string `json:"apiUrl"`
	TokenProtected string `json:"tokenProtected,omitempty"`
	TallyURL       string `json:"tallyUrl"`
	TallyCompany   string `json:"tallyCompany"`
	PollIntervalMS int    `json:"pollIntervalMs,omitempty"`

	Token string `json:"-"`
}

const (
	DefaultTallyURL     = "http://localhost:9000"
	defaultPollInterval = 4 * time.Second
	tokenPrefix         = "vtally_"
)

// DataDir is where config and logs live: %ProgramData%\Verax\TallyAgent on
// Windows (shared with the service, which runs as LocalSystem).
func DataDir() string {
	if runtime.GOOS == "windows" {
		base := os.Getenv("ProgramData")
		if base == "" {
			base = `C:\ProgramData`
		}
		return filepath.Join(base, "Verax", "TallyAgent")
	}
	if dir, err := os.UserConfigDir(); err == nil {
		return filepath.Join(dir, "verax-tally-agent")
	}
	return "."
}

func DefaultConfigPath() string { return filepath.Join(DataDir(), "config.json") }

// LoadConfig reads the file (if any), applies environment overrides and
// resolves the token. Env vars (VERAX_API_URL, VERAX_AGENT_TOKEN, TALLY_URL,
// TALLY_COMPANY, POLL_INTERVAL_MS) are for testing and non-Windows runs.
func LoadConfig(path string) (*Config, error) {
	cfg := &Config{}
	if b, err := os.ReadFile(path); err == nil {
		if err := json.Unmarshal(b, cfg); err != nil {
			return nil, fmt.Errorf("config file %s is not valid JSON: %w", path, err)
		}
	} else if !errors.Is(err, os.ErrNotExist) {
		return nil, fmt.Errorf("reading config %s: %w", path, err)
	}

	if v := os.Getenv("VERAX_API_URL"); v != "" {
		cfg.APIURL = v
	}
	if v := os.Getenv("TALLY_URL"); v != "" {
		cfg.TallyURL = v
	}
	if v := os.Getenv("TALLY_COMPANY"); v != "" {
		cfg.TallyCompany = v
	}
	if v := os.Getenv("POLL_INTERVAL_MS"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			cfg.PollIntervalMS = n
		}
	}
	if v := os.Getenv("VERAX_AGENT_TOKEN"); v != "" {
		cfg.Token = strings.TrimSpace(v)
	} else if cfg.TokenProtected != "" {
		blob, err := base64.StdEncoding.DecodeString(cfg.TokenProtected)
		if err != nil {
			return nil, errors.New("stored agent token is corrupted — run setup again")
		}
		plain, err := unprotect(blob)
		if err != nil {
			return nil, fmt.Errorf("could not decrypt the stored agent token (was the config copied from another PC?): %w", err)
		}
		cfg.Token = string(plain)
	}
	if cfg.TallyURL == "" {
		cfg.TallyURL = DefaultTallyURL
	}
	return cfg, nil
}

// PollInterval clamps the configured cadence to something sane.
func (c *Config) PollInterval() time.Duration {
	d := time.Duration(c.PollIntervalMS) * time.Millisecond
	switch {
	case c.PollIntervalMS == 0:
		return defaultPollInterval
	case d < time.Second:
		return time.Second
	case d > time.Minute:
		return time.Minute
	}
	return d
}

// Validate returns every problem at once so setup/check can show them all.
func (c *Config) Validate() []string {
	var problems []string
	if err := validateAPIURL(c.APIURL); err != nil {
		problems = append(problems, err.Error())
	}
	if c.Token == "" {
		problems = append(problems, "no agent token is configured — run setup")
	} else if !strings.HasPrefix(c.Token, tokenPrefix) {
		problems = append(problems, "the agent token doesn't look right (it should start with "+tokenPrefix+")")
	}
	if u, err := url.Parse(c.TallyURL); err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		problems = append(problems, "Tally URL must look like http://localhost:9000")
	}
	if strings.TrimSpace(c.TallyCompany) == "" {
		problems = append(problems, "the Tally company name is required, so vouchers can never go into the wrong company")
	}
	return problems
}

func validateAPIURL(raw string) error {
	if raw == "" {
		return errors.New("Verax API URL is not set")
	}
	u, err := url.Parse(raw)
	if err != nil || u.Host == "" {
		return fmt.Errorf("Verax API URL %q is not a valid URL", raw)
	}
	if u.Scheme == "https" {
		return nil
	}
	// The bearer token must never cross a network in clear text; plain http is
	// only allowed to this machine (local development).
	host := u.Hostname()
	if u.Scheme == "http" && (host == "localhost" || net.ParseIP(host).IsLoopback()) {
		return nil
	}
	return fmt.Errorf("Verax API URL must use https:// (got %q)", raw)
}

// Save writes the config with the token encrypted. Plain-text tokens are
// refused: on platforms without DPAPI, use VERAX_AGENT_TOKEN instead.
func (c *Config) Save(path string) error {
	if c.Token != "" {
		blob, err := protect([]byte(c.Token))
		if err != nil {
			return err
		}
		c.TokenProtected = base64.StdEncoding.EncodeToString(blob)
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	b, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, b, 0o600); err != nil {
		return err
	}
	if err := os.Rename(tmp, path); err != nil {
		return err
	}
	return restrictToAdmins(path)
}
