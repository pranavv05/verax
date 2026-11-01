# Verax Tally Agent — Specification

Status: v1 (backend implemented; agent to be built)
Audience: whoever builds the Windows agent (`.exe`).

## Why an agent exists

TallyPrime runs on the firm's own Windows machine and exposes an HTTP XML server
on `localhost:9000`. The Verax backend runs in the cloud and cannot reach that
port (it is behind the firm's NAT/firewall, and we never want inbound access to a
customer machine). The agent is a small program the firm installs next to Tally
that bridges the two by making only **outbound** calls:

```
Verax cloud  <--- outbound HTTPS (poll + report) ---  Agent  --- HTTP XML --->  TallyPrime :9000
  (job queue)                                        (Windows)                  (same machine/LAN)
```

The backend never connects to the agent; the agent always initiates. No inbound
ports, no VPN, no port forwarding.

## What the backend already provides

Base URL: the firm's Verax API, e.g. `https://api.verax.in`.

### Agent authentication
Every agent call sends `Authorization: Bearer <AGENT_TOKEN>`. The token is issued
once from the Verax UI (Settings → Tally Agent → "Add agent") and shown a single
time. It is stored only as a SHA-256 hash server-side. If leaked, the firm
revokes it in the UI and issues a new one.

### Agent-facing endpoints
| Method & path | Purpose | Body | Response |
|---|---|---|---|
| `POST /api/tally/agent/heartbeat` | liveness + version | `{ "agentVersion": "1.0.0 (win)" }` | `{ "ok": true }` |
| `POST /api/tally/agent/claim` | claim the next queued job | _(none)_ | `200` `{ job }` or `204` (queue empty) |
| `POST /api/tally/agent/jobs/:jobId/result` | report a job's outcome | see **Result body** | `{ "status": "succeeded" \| "failed" \| "requeued" }` |

A claimed `job`:
```json
{
  "job": {
    "id": "<jobId uuid>",
    "documentId": "<uuid>",
    "remoteId": "verax-doc-<documentId>",
    "voucherXml": "<?xml ... a full Tally <ENVELOPE> import request ...>",
    "attempts": 1
  }
}
```
`voucherXml` is a complete, ready-to-POST Tally import envelope. Each `<VOUCHER>`
already carries a stable `REMOTEID`/`VCHKEY` (derived from the document), so
re-sending the same job updates the existing voucher in Tally instead of creating
a duplicate. **The agent must not modify the XML.**

### Result body
```json
{
  "ok": true,
  "created": 1,
  "altered": 0,
  "errors": 0,
  "lineErrors": [],
  "retryable": false,
  "error": null,
  "raw": "<RESPONSE>...</RESPONSE>"
}
```
- `ok`: true when Tally created or altered the voucher(s) with no errors.
- `retryable`: set **true only** when the agent could not get a response from
  Tally at all (Tally closed, company not loaded, connection refused). The
  backend will requeue a retryable failure (up to 5 attempts). A data error
  (a `LINEERROR`, e.g. a missing ledger) is **not** retryable — the same XML
  will fail identically — so report it with `ok:false, retryable:false`.

## The agent loop

```
on start:
  read config (API base URL, agent token, Tally host:port, target company)
  POST /heartbeat

loop forever:
  POST /claim
  if 204:            sleep(pollInterval, e.g. 3–5s) ; continue
  if 200 with job:
    try:
      response = POST http://<tallyHost>:9000  body=job.voucherXml  (timeout ~30s)
      parsed   = parseTallyResponse(response)     # see backend/src/services/tally-connector.service.js
      POST /jobs/{job.id}/result  body=parsed
    catch transport error (refused/timeout/non-200):
      POST /jobs/{job.id}/result  body={ ok:false, retryable:true, error:"<message>" }
  every ~30s between claims: POST /heartbeat
```

Keep the parsing identical to the backend's `parseTallyResponse` (it is the
reference implementation and is unit-tested); counts come from `<CREATED>`,
`<ALTERED>`, `<ERRORS>`/`<EXCEPTIONS>`, and each `<LINEERROR>…</LINEERROR>`.

## Talking to Tally

- Confirm Tally is reachable: `GET http://localhost:9000` returns Tally's server
  banner. Surface "Tally not reachable" in the agent UI when it is not.
- Confirm the **right company is loaded**. Tally imports into the active company;
  if the wrong one is open, vouchers land in the wrong books. Before pushing,
  the agent should export `Company Info` (a `List of Companies` export request)
  and compare to the configured company name; refuse and report
  `retryable:true, error:"Expected company X not loaded"` on mismatch.
- POST the `voucherXml` as `Content-Type: text/xml; charset=utf-16` or `utf-8`
  to match the envelope's declared encoding (the backend emits UTF-8). Read the
  whole response before parsing.

## Reading masters (phase 2, recommended)

To cut `LINEERROR`s from missing ledgers, the agent can export the company's
ledger/group/stock-item masters and let Verax validate voucher ledger names
before a push. Tally export request (`Collection of Ledgers`) returns the list;
POST it to a future `POST /api/tally/agent/masters` endpoint. Not required for v1
(the backend already validates tax math before export), but it is the highest-
value follow-up because ledger-name mismatches are the most common import error.

## Configuration (agent-side)
| Key | Example | Notes |
|---|---|---|
| `VERAX_API_URL` | `https://api.verax.in` | firm's Verax API base |
| `VERAX_AGENT_TOKEN` | `vtally_…` | issued once in the UI; store with Windows DPAPI |
| `TALLY_URL` | `http://localhost:9000` | local Tally HTTP server |
| `TALLY_COMPANY` | `Acme Traders (2026-27)` | exact active-company name to require |
| `POLL_INTERVAL_MS` | `4000` | claim poll cadence when idle |

## Security & packaging
- Store the agent token with Windows DPAPI (per-user), never in plaintext config.
- Run as a Windows Service (auto-start) or a tray app; a service survives logoff.
- Ship a code-signed installer so SmartScreen does not block it.
- The agent needs outbound HTTPS to the Verax API and localhost access to Tally —
  nothing else.
- Log locally (rotating file) but never log the token or full voucher bodies.

## Suggested stack
Go or .NET. Both make a single self-contained signed `.exe`, run as a Windows
Service, and have robust HTTP + XML. .NET is the most natural fit for a Windows-
only agent; Go gives the smallest dependency-free binary.

## Testing without the cloud
The backend endpoints can be exercised with a reviewed document:
1. Register an agent in the UI, copy the token.
2. `POST /api/tally/sync { documentId }` to queue a job.
3. `POST /api/tally/agent/claim` with the token → receive the job + XML.
4. POST that XML to a local TallyPrime; capture the `<RESPONSE>`.
5. `POST /api/tally/agent/jobs/{id}/result` with the parsed outcome.
6. `GET /api/tally/sync/{documentId}` → status reflects the result.
