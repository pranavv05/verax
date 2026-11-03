// Command verax-tally-agent bridges Verax and a local TallyPrime: it polls
// Verax for approved vouchers and posts them into Tally's local XML server.
// See docs/tally-agent-spec.md.
package main

import (
	"bufio"
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"log/slog"
	"os"
	"os/signal"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"time"

	"golang.org/x/term"

	"github.com/pranavv05/verax/tally-agent/internal/agent"
)

// Set at build time: -ldflags "-X main.version=1.0.0 -X main.defaultAPIURL=https://api.example.in"
var (
	version       = "dev"
	defaultAPIURL = ""
)

func agentVersion() string { return fmt.Sprintf("%s (%s)", version, runtime.GOOS) }

func usage() {
	fmt.Fprintf(os.Stderr, `Verax Tally Agent %s

Usage:
  verax-tally-agent setup        guided first-time setup
  verax-tally-agent check        test the connection to Verax and Tally
  verax-tally-agent run          run in this window (Ctrl+C to stop)
  verax-tally-agent install      install as a Windows service that starts automatically
  verax-tally-agent uninstall    remove the Windows service
  verax-tally-agent version

Options:
  --config <path>   config file (default %s)
`, agentVersion(), agent.DefaultConfigPath())
}

func main() {
	if isService() {
		cfg := agent.DefaultConfigPath()
		for i, a := range os.Args {
			if a == "--config" && i+1 < len(os.Args) {
				cfg = os.Args[i+1]
			}
		}
		if err := runAsService(cfg); err != nil {
			os.Exit(1)
		}
		return
	}

	cmd := ""
	args := os.Args[1:]
	if len(args) > 0 && !strings.HasPrefix(args[0], "-") {
		cmd, args = args[0], args[1:]
	}
	fs := flag.NewFlagSet(cmd, flag.ExitOnError)
	cfgPath := fs.String("config", agent.DefaultConfigPath(), "config file")
	fs.Usage = usage
	_ = fs.Parse(args)

	var err error
	switch cmd {
	case "":
		// Double-clicked: set up if needed, otherwise show status. Keep the
		// window open so the user can read it.
		if _, statErr := os.Stat(*cfgPath); statErr != nil {
			err = setup(*cfgPath)
		} else {
			err = check(*cfgPath)
		}
		if err != nil {
			fmt.Println("\n" + err.Error())
		}
		pause()
		if err != nil {
			os.Exit(1)
		}
		return
	case "setup":
		err = setup(*cfgPath)
	case "check":
		err = check(*cfgPath)
	case "run":
		ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
		defer stop()
		err = runAgent(ctx, *cfgPath, true)
	case "install":
		err = install(*cfgPath)
	case "uninstall":
		if err = uninstallService(); err == nil {
			fmt.Println("The Verax Tally Agent service was removed.")
		}
	case "version":
		fmt.Println(agentVersion())
	case "help", "-h", "--help":
		usage()
	default:
		usage()
		os.Exit(2)
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "Error:", err)
		os.Exit(1)
	}
}

func newLogger(toStderr bool) (*slog.Logger, io.Closer, error) {
	lf, err := agent.OpenRotatingFile(filepath.Join(agent.DataDir(), "logs", "agent.log"), 5<<20, 5)
	if err != nil {
		return nil, nil, fmt.Errorf("opening log file: %w", err)
	}
	var w io.Writer = lf
	if toStderr {
		w = io.MultiWriter(lf, os.Stderr)
	}
	return slog.New(slog.NewTextHandler(w, &slog.HandlerOptions{Level: slog.LevelInfo})), lf, nil
}

func runAgent(ctx context.Context, cfgPath string, interactive bool) error {
	log, closer, err := newLogger(interactive)
	if err != nil {
		return err
	}
	defer closer.Close()

	cfg, err := agent.LoadConfig(cfgPath)
	if err != nil {
		log.Error("cannot load config", "error", err)
		return err
	}
	if problems := cfg.Validate(); len(problems) > 0 {
		err := errors.New("configuration problems:\n  - " + strings.Join(problems, "\n  - ") + "\nRun `verax-tally-agent setup` to fix them.")
		log.Error("invalid configuration", "problems", strings.Join(problems, "; "))
		return err
	}
	a := &agent.Agent{
		Verax:        agent.NewVerax(cfg.APIURL, cfg.Token, "verax-tally-agent/"+agentVersion()),
		Tally:        agent.NewTally(cfg.TallyURL),
		Company:      cfg.TallyCompany,
		Version:      agentVersion(),
		PollInterval: cfg.PollInterval(),
		Log:          log,
	}
	return a.Run(ctx)
}

// ── check ────────────────────────────────────────────────────────────────────

func check(cfgPath string) error {
	fmt.Printf("Verax Tally Agent %s — checking setup (%s)\n\n", agentVersion(), cfgPath)
	cfg, err := agent.LoadConfig(cfgPath)
	if err != nil {
		return err
	}
	failed := false
	mark := func(ok bool, msg string) {
		if ok {
			fmt.Println("  [ok]  " + msg)
		} else {
			fmt.Println("  [!!]  " + msg)
			failed = true
		}
	}
	problems := cfg.Validate()
	mark(len(problems) == 0, "configuration is complete")
	for _, p := range problems {
		fmt.Println("        - " + p)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	tally := agent.NewTally(cfg.TallyURL)
	readyErr := tally.CheckReady(ctx, cfg.TallyCompany)
	if readyErr == nil {
		mark(true, fmt.Sprintf("Tally is open at %s with %q loaded", cfg.TallyURL, cfg.TallyCompany))
	} else {
		mark(false, readyErr.Error())
	}

	if cfg.APIURL != "" && cfg.Token != "" {
		status := agent.StatusReady
		if readyErr != nil {
			status = readyErr.Error()
		}
		err := agent.NewVerax(cfg.APIURL, cfg.Token, "verax-tally-agent/"+agentVersion()).Heartbeat(ctx, agentVersion(), status)
		mark(err == nil, map[bool]string{true: "Verax accepted the agent token", false: "Verax: " + errString(err)}[err == nil])
	}
	fmt.Println()
	if failed {
		return errors.New("some checks failed — fix the items marked [!!] above")
	}
	fmt.Println("Everything looks good. Approved vouchers you push from Verax will appear in Tally.")
	return nil
}

func errString(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}

// ── setup ────────────────────────────────────────────────────────────────────

func setup(cfgPath string) error {
	in := bufio.NewReader(os.Stdin)
	fmt.Printf("Verax Tally Agent %s — setup\n\n", agentVersion())
	fmt.Println("You'll need the agent token from Verax: Settings → Tally agent → Create agent.")
	fmt.Println()

	cfg, _ := agent.LoadConfig(cfgPath)
	if cfg == nil {
		cfg = &agent.Config{TallyURL: agent.DefaultTallyURL}
	}
	if cfg.APIURL == "" {
		cfg.APIURL = defaultAPIURL
	}

	cfg.APIURL = ask(in, "Verax address", cfg.APIURL)
	for {
		tok := askSecret(in, "Agent token (starts with vtally_)")
		if tok != "" {
			cfg.Token = tok
		}
		if cfg.Token != "" {
			break
		}
	}
	cfg.TallyURL = ask(in, "Tally address", cfg.TallyURL)

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	tally := agent.NewTally(cfg.TallyURL)
	if companies, err := tally.LoadedCompanies(ctx); err == nil && len(companies) > 0 {
		fmt.Println("\nCompanies open in Tally right now:")
		for i, c := range companies {
			fmt.Printf("  %d. %s\n", i+1, c)
		}
		pick := ask(in, "Which company should vouchers go into? (number or exact name)", cfg.TallyCompany)
		if n, err := strconv.Atoi(pick); err == nil && n >= 1 && n <= len(companies) {
			cfg.TallyCompany = companies[n-1]
		} else {
			cfg.TallyCompany = pick
		}
	} else {
		fmt.Println("\n(Tally isn't reachable right now, so type the company name exactly as Tally shows it.)")
		cfg.TallyCompany = ask(in, "Tally company name", cfg.TallyCompany)
	}

	if problems := cfg.Validate(); len(problems) > 0 {
		return errors.New("setup isn't complete:\n  - " + strings.Join(problems, "\n  - "))
	}
	fmt.Print("\nChecking the token with Verax… ")
	if err := agent.NewVerax(cfg.APIURL, cfg.Token, "verax-tally-agent/"+agentVersion()).Heartbeat(ctx, agentVersion(), "setting up"); err != nil {
		fmt.Println("failed")
		return err
	}
	fmt.Println("ok")

	if err := cfg.Save(cfgPath); err != nil {
		if runtime.GOOS != "windows" {
			fmt.Println("\nOn this system the token can't be stored securely. Run the agent with:")
			fmt.Printf("  VERAX_API_URL=%s TALLY_URL=%s TALLY_COMPANY=%q VERAX_AGENT_TOKEN=<token> verax-tally-agent run\n", cfg.APIURL, cfg.TallyURL, cfg.TallyCompany)
			return nil
		}
		return fmt.Errorf("saving settings: %w", err)
	}
	fmt.Println("Settings saved (the token is encrypted with Windows DPAPI).")

	if runtime.GOOS == "windows" && strings.ToLower(ask(in, "\nInstall as a Windows service so it runs automatically? (y/n)", "y")) == "y" {
		return install(cfgPath)
	}
	fmt.Println("\nRun `verax-tally-agent run` to start pushing vouchers.")
	return nil
}

func install(cfgPath string) error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	if err := installService(exe, cfgPath); err != nil {
		return err
	}
	fmt.Println("Installed and started the Verax Tally Agent service. It starts with Windows and restarts itself if it stops.")
	fmt.Printf("Logs: %s\n", filepath.Join(agent.DataDir(), "logs"))
	return nil
}

func ask(in *bufio.Reader, prompt, def string) string {
	if def != "" {
		fmt.Printf("%s [%s]: ", prompt, def)
	} else {
		fmt.Printf("%s: ", prompt)
	}
	line, _ := in.ReadString('\n')
	line = strings.TrimSpace(line)
	if line == "" {
		return def
	}
	return line
}

func askSecret(in *bufio.Reader, prompt string) string {
	fmt.Printf("%s: ", prompt)
	if term.IsTerminal(int(os.Stdin.Fd())) {
		b, err := term.ReadPassword(int(os.Stdin.Fd()))
		fmt.Println()
		if err == nil {
			return strings.TrimSpace(string(b))
		}
	}
	line, _ := in.ReadString('\n')
	return strings.TrimSpace(line)
}

func pause() {
	if term.IsTerminal(int(os.Stdin.Fd())) {
		fmt.Print("\nPress Enter to close.")
		_, _ = bufio.NewReader(os.Stdin).ReadString('\n')
	}
}
