# Verax Tally Agent

A small Windows program a CA firm installs on the PC that runs TallyPrime. It
pulls approved vouchers from Verax and posts them into Tally's local XML server
(`localhost:9000`). It only makes **outbound** calls — no ports to open, no VPN.
Protocol: [`docs/tally-agent-spec.md`](../docs/tally-agent-spec.md).

## For the firm

1. In Verax: **Settings → Tally agent → Create agent**. Copy the token (shown once).
2. In TallyPrime: open only the client's company, and make sure Tally's HTTP
   server is on (F1 Help → Settings → Connectivity → "TallyPrime acts as: Both",
   port 9000).
3. Double-click `verax-tally-agent.exe`, paste the token, pick the company, and
   say **y** to install it as a Windows service. It then starts with Windows and
   restarts itself if it ever stops.

`verax-tally-agent check` re-tests everything; logs are in
`C:\ProgramData\Verax\TallyAgent\logs`.

## What it guarantees

- **Never the wrong books.** It won't take a job unless exactly the configured
  company is open in Tally. With Tally closed, the wrong company, or several
  companies open, it holds vouchers and Verax shows why on the Tally agent page.
- **No duplicates.** Voucher XML is posted unchanged; its stable `REMOTEID`
  makes a re-push update the existing voucher.
- **No lost results.** A voucher Tally accepted is always reported, even if the
  service is stopped mid-push; reports are retried, and if Verax is unreachable
  the job is safely re-pushed later (as an update, not a duplicate).
- **Secrets stay secret.** The token is encrypted with Windows DPAPI in a config
  file readable only by Administrators/SYSTEM, sent only over HTTPS (plain HTTP
  is refused except to `localhost`), and never written to the log. Voucher
  contents are never logged either.
- **Plays nicely.** Backs off when Verax is down, honours `Retry-After`, and
  pauses for 5 minutes if the token is revoked instead of hammering the API.

## Build

```bash
cd tally-agent
go test -race ./...
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -trimpath \
  -ldflags "-s -w -X main.version=1.0.0 -X main.defaultAPIURL=https://api.yourdomain.in" \
  -o dist/verax-tally-agent.exe .
```

`defaultAPIURL` pre-fills the Verax address in setup so firms only paste a token.

## Before shipping to customers

- **Code-sign the `.exe`** (an EV certificate avoids SmartScreen warnings). An
  unsigned download will be blocked or scary-looking on most firms' PCs.
- **Validate against a real TallyPrime.** Everything here is tested against a
  TallyPrime stand-in that mimics its import behaviour (ledger checks,
  `LINEERROR`, `REMOTEID` alters). The two things only real Tally can confirm:
  the exact shape of the `List of Companies` export response, and that the
  generated vouchers import cleanly (ledger names, sign conventions).
- **Test on real Windows.** The service wrapper and DPAPI code compile and are
  vetted for Windows in CI, but have not been run on a Windows machine yet.
- Host the `.exe` somewhere firms can download it and set
  `VITE_TALLY_AGENT_DOWNLOAD_URL` in the frontend so the Tally agent page links
  to it.

## Development

Run against a local backend without installing anything:

```bash
VERAX_API_URL=http://localhost:3000 VERAX_AGENT_TOKEN=vtally_… \
TALLY_URL=http://localhost:9000 TALLY_COMPANY="Acme Traders (2026-27)" \
go run . run
```

`testdata/tally_responses.json` is shared with the backend's tests: the agent's
Tally-response parser and the backend's reference parser must agree on every case.
