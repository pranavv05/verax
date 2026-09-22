# Verax TallyOCR — Feature Status
Last updated: 2026-09-20
Audited by: Claude Code (automated scan)

## Legend
- ✅ Production Ready — all layers complete and connected
- ⚠️ Partial — built but missing something (explain what)
- ❌ Not Built — does not exist
- 🔧 Needs Fix — exists but has a known bug or broken connection

Mount table confirmed in `backend/src/app.js:45-61`. No route files exist for "item-name-mapping" (folded into `extractions.routes.js` + `name-mapping.service.js`), "gst-reconciliation" (folded into `compliance.routes.js`), or "document-version-history" (folded into `documents.routes.js`).

---

## AUTH

### Firm signup
Status: ✅ Production Ready
Backend: `POST /api/auth/signup` — `auth.routes.js:64-91`, `requireAuth` n/a (public), `authRateLimiter` applied, `signupSchema` (`auth.routes.js:35-40`) → `registerFirm` (`auth.service.js:394-460`)
Frontend: `pages/SignupPage.jsx`, `api/auth-api.js:4-55` — Zod validation, loading/error states, redirects on success
Migration: `20260311163000_initial_schema.js` (firms, users tables + RLS)
Notes: **Fixed 2026-08-08** — `registerFirm` now writes a `firm_registered` audit log entry (`auth.service.js`, inside the same manual transaction, before `COMMIT`) with `metadata: {firmName, userEmail}`. Password hashed bcrypt cost 12 (hardcoded, not env-configurable) — unchanged, not in scope.

### Login
Status: ✅ Production Ready
Backend: `POST /api/auth/login` — `auth.routes.js:93-112`, `authRateLimiter`, `loginSchema` (`:42-45`) → `loginUser` (`auth.service.js`), tenant-scoped
Frontend: `pages/LoginPage.jsx` — Zod validation, loading/error states, redirect to `location.state.from`
Migration: n/a (uses `users` table)
Notes: **Fixed 2026-08-08** — `loginUser` now writes `login_success` on success and `login_failed` (`reason: "invalid_password"`) when a known user supplies the wrong password, both via the same transaction `client` (not a separate connection). The failure case returns an `{authFailed: true}` sentinel from the transaction handler instead of throwing inside it, since throwing there would have rolled back the audit insert along with everything else — the caller checks the sentinel and throws `ApiError.unauthorized` after the transaction commits. **The remaining blind spot — a login attempt against an unknown email couldn't be audit-logged at all, since `audit_logs.firm_id` was `NOT NULL` with no firm to attribute the row to — is now fixed (2026-09-21).** Migration `20260922000000_audit_logs_nullable_firm_id.js` makes `firm_id` nullable and adds a write-only RLS escape hatch scoped to the exact `login`/`client_portal_login` auth contexts these two login flows already set; `loginUser`'s unknown-email branch now writes a `login_failed` row with `reason: "unknown_email"` and `firm_id: null` before returning the same sentinel pattern. These NULL-firm_id rows are intentionally invisible to every firm-scoped session (they don't belong to any firm) — write-only audit trail for future security-monitoring tooling, not something a CA firm's own audit log view will ever show. Covered by `backend/tests/integration/audit-logs-unknown-email.test.js`, which also proves the escape hatch can't be triggered outside its exact auth_context and that the resulting rows stay invisible to firm-scoped queries.

### Logout
Status: ✅ Production Ready
Backend: `POST /api/auth/logout` — `auth.routes.js:133-142` → `logoutSession` (`auth.service.js:655-689`), tenant-scoped
Frontend: No dedicated page; implemented as header button in `components/layout/AppShell.jsx:115-119,296-303` with loading-state text swap, clears session, navigates to `/login`
Notes: Confirmed working.

### JWT refresh
Status: 🔧 Needs Fix → ✅ Production Ready (confirmed fixed 2026-09-21)
Backend: `POST /api/auth/refresh` — `auth.routes.js:114-131` → `refreshAccessToken` (`auth.service.js:559-703`). Chain rotation: verifies token hash, marks old token `revoked_at`/`replaced_by_token_id`, inserts new row.
Frontend: `lib/api-client.js:66-119` (`request()`) implements transparent 401→refresh→retry on every authenticated call except the two `ToolsPage.jsx` raw-`fetch` calls (see Standalone Tools)
Migration: `20260311171500_auth_infra.js` (refresh_tokens table + RLS)
Notes: **The reuse-detection rollback bug flagged in the 2026-08-09 audit is already fixed** — found already applied in commit `5ae0534c` ("fixed auth", 2026-09-11) when this pass went to implement the recommended fix, so this entry was stale rather than the code being broken. The token-hash-mismatch and already-revoked branches in `refreshAccessToken` now return a `{ reuseDetected: true, message }` sentinel from inside the transaction (so `revokeRefreshTokenFamily`'s revocation commits with everything else) and throw only after the transaction resolves, exactly the pattern `loginUser` and `clientRefreshToken` already used. Verified 2026-09-21 with a new regression test, `backend/tests/integration/refresh-token-reuse.test.js`: logs in, rotates the refresh token once, replays the stale token (triggers reuse detection), then asserts the *rotated* token is also revoked in the database — not just that the replay itself fails. Confirmed this test fails hard (rotated token stays live) when the sentinel pattern is temporarily reverted back to a direct `throw`, and passes clean with the real code restored.

### Password reset (forgot password + reset flow)
Status: ✅ Production Ready
Backend: `POST /api/auth/forgot-password` (`auth.routes.js:144-157`) → `requestPasswordReset` (`auth.service.js:122-256`, audit `password_reset_requested` + `password_reset_emailed`); `GET /api/auth/reset-password/:token` (`:159-167`) → `validatePasswordResetToken` (`:283-326`); `POST /api/auth/reset-password` (`:169-181`) → `resetPassword` (`:328-392`, audit `password_reset_completed`, revokes all refresh tokens on reset)
Frontend: `pages/ForgotPasswordPage.jsx`, `pages/ResetPasswordPage.jsx` — full loading/error/success states
Migration: `20260506000000_password_reset_tokens.js` (+ RLS escape hatch for the unauthenticated token-validation lookup)
Notes: Full flow is implemented and token TTL is a hardcoded 15 min (`PASSWORD_RESET_TOKEN_TTL_MINUTES`, `auth.service.js:20`, inconsistent with `ACCESS_TOKEN_TTL_MINUTES` which *is* env-driven — acceptable, not a functional gap). **Verified 2026-09-16 (production-readiness audit)**: the previous entry's "flag for verification" is resolved. `auth.service.js:254` gates `devResetLink` behind `env.NODE_ENV !== "production"` (returns `undefined` in production, which `res.json()` drops from the payload entirely, confirmed by direct read and an isolated test harness); the email send at `:225-233` is unconditional on environment, so delivery is unaffected. `ForgotPasswordPage.jsx:37-39,86-93` only renders the dev-link banner when the field is actually present in the response, so it is safe by construction — no separate frontend gate was needed. The success message returned in both environments (`PASSWORD_RESET_SUCCESS_MESSAGE`, `auth.service.js:21-22`) is already deliberately vague and does not confirm whether the email exists.

### Session protection on dashboard routes
Status: ✅ Production Ready
Frontend: `components/ProtectedRoute.jsx:4-21` gates all app routes (`/dashboard`, `/clients*`, `/review/*`, `/export`, `/settings`, `/team`, `/audit-logs`, `/tools`) on `useAuth().isAuthenticated`, shows loading panel during bootstrap, redirects to `/login` with return state
Notes: Confirmed correctly wired in `App.jsx:45-106+`.

---

## FIRM & WORKSPACE

### Firm settings page
Status: ✅ Production Ready
Backend: `GET/PUT /api/firms/settings` — `firms.routes.js:14-40`, PUT requires `requireAdmin`, `updateFirmSettingsSchema` (`:10-12`) → `getFirmSettings`/`updateFirmSettings` (`firms.service.js:3-62`, audit `firm_settings_updated`)
Frontend: `pages/SettingsPage.jsx`, `api/firms-api.js:3-16` — loading skeleton, error/toast banners, save-in-flight state

### Firm name update (admin only)
Status: ✅ Production Ready
Backend: same as above, `requireAdmin` confirmed on `PUT` (`firms.routes.js:25`)
Frontend: `SettingsPage.jsx:168` wraps the whole firm-settings panel in `canAdmin` check
Notes: Correctly enforced both server- and client-side.

### Current user profile lookup
Status: ✅ Production Ready
Backend: `GET /api/firms/me` — `firms.routes.js:42-54` → `getCurrentUser` (`firms.service.js:64-94`); also duplicated at `GET /api/auth/me` (`auth.routes.js:193-202`)
Frontend: `SettingsPage.jsx:234-290` "My Profile" panel, always visible regardless of role

### Plan field support (starter/professional/enterprise)
Status: 🔧 Needs Fix → ✅ Production Ready (fixed 2026-09-21)
Backend: `plan_enum` defined in initial schema migration (`20260311163000_initial_schema.js:116-136`), returned by `getFirmSettings`
Frontend: `SettingsPage.jsx` — admin-gated "Firm Settings" panel (editable, unchanged) plus a new read-only "Firm Settings" panel shown only to non-admin staff (firm name + `PlanBadge`, both read-only, with a note to contact an admin to change them)
Notes: **Fixed 2026-09-21.** `PlanBadge` previously only rendered inside the admin-gated edit panel, so staff users could not see the firm's plan at all — a frontend over-gating bug (the task's permission spec says staff "can view"), not admin-only-by-design. `GET /api/firms/settings` was already `requireAuth`-only (staff-readable) server-side, so this was purely a missing frontend view, not a backend gap.

---

## CLIENT MANAGEMENT

### Client list — search, status filter, table/card UI, overflow actions
Status: ✅ Production Ready
Backend: `GET /api/clients` — `clients.routes.js`, `listClientsQuerySchema` → `listClients` (`clients.service.js`), unchanged search/status/pagination contract
Frontend: `pages/ClientsPage.jsx` redesigned — debounced (300ms) search box, status select, a real "Client / Contact / Status / Documents / Last activity / Actions" table (`hidden md:block`) with a responsive card fallback (`md:hidden`) below tablet width, sticky-feel header row, per-row `OverflowMenu` (new `components/ui/OverflowMenu.jsx`, keyboard accessible: arrow keys/Enter/Escape, click-outside close) replacing the 5 stacked action buttons. Add/Edit moved into a right-side `Drawer` (new `components/ui/Drawer.jsx`, Escape/backdrop/✕ to close) opened via a header "+ Add client" button or the row menu's "Edit client" — same Zod schema, same debounced GSTIN lookup, same create/update calls. Distinct empty states for "no clients at all" (with an Add-client CTA) vs "no results for current filters" (with a Clear-filters action), a dedicated load-error state with Try again, and a `TableRowsSkeleton` loading state.
Notes: 🔧 Fixed — search previously fired one request per keystroke with no debounce (now matches the 800ms-debounced GSTIN-lookup pattern already used elsewhere on this page); load failures and delete success/failure previously only rendered inside the always-visible edit panel, so they were silently invisible to non-admins and often unreachable in practice — now surfaced as a page-level banner (`pageError`/`pageToast`) independent of the drawer's own `formError`/`formToast`. Delete confirmation modal now stays open with an inline error and a "Deleting..." disabled state while the request is in flight, closing only on success (previously closed immediately on click, before the request even resolved).

### Create client
Status: ✅ Production Ready
Backend: `POST /api/clients` — `clients.routes.js`, `requireAdmin`, `createClientBodySchema` → `createClient` (`clients.service.js`, audit `client_created`)
Frontend: `ClientsPage.jsx` — form now lives in the Add/Edit `Drawer` (opened via "+ Add client"), same Zod schema, same API call

### View client details
Status: ✅ Production Ready
Backend: `GET /api/clients/:id` — `clients.routes.js` → `getClientById` (`clients.service.js`)
Frontend: `pages/ClientDetailPage.jsx` — untouched (separate route, reached via the client name link or the list's "View details" menu item), loading skeleton, not-found empty state

### Update client details
Status: ✅ Production Ready
Backend: `PUT /api/clients/:id` — `clients.routes.js`, `requireAdmin`, `updateClientBodySchema` → `updateClient` (`clients.service.js`, audit `client_updated`)
Frontend: `ClientDetailPage.jsx` (unchanged, its own edit form) and `ClientsPage.jsx` (list's own Add/Edit Drawer, "Edit client" row-menu item pre-fills and opens it) — two independent entry points to the same endpoint, both preserved

### Soft delete client
Status: ✅ Production Ready
Backend: `DELETE /api/clients/:id` — `clients.routes.js`, `requireAdmin` → `deleteClient` (`clients.service.js`, soft delete, audit `client_deleted`)
Frontend: `ClientDetailPage.jsx` (own confirm modal, unchanged) and `ClientsPage.jsx` (confirm modal now triggered from the row's overflow menu instead of an always-visible row button — see loading/error fix above)

### Client document summary
Status: ✅ Production Ready
Backend: `getClientById` returns the full breakdown (`totalDocuments`/`processingDocuments`/`reviewedDocuments`/`exportedDocuments`/`lastUploadedAt`, `clients.service.js`). `listClients` now also returns a lighter per-row `documentSummary` (`totalDocuments`/`pendingDocuments`/`lastActivityAt`) via a single indexed `LEFT JOIN` aggregate over `documents` grouped by `client_id` — one extra query for the whole page, not one per row, so it stays cheap at 100+ clients. `pendingDocuments` uses the same `extracted`+`review_required` definition as the dashboard's "Awaiting review" tile.
Frontend: `ClientDetailPage.jsx` StatCards (full breakdown, unchanged) and `ClientsPage.jsx` table/card "Documents"/"Last activity" columns (new, uses the lighter summary — shows "12 total · 2 pending" or "N documents"/"No documents", and a formatted last-activity date or "No activity yet")

### GSTIN live lookup on client form
Status: ✅ Production Ready
Backend: `POST /api/compliance/gstin/verify` — `compliance.routes.js:348-383`, `gspService.verifyGSTIN` (`gsp.service.js:263-278`, live GSP call with local-checksum fallback if GSP unconfigured)
Frontend: `ClientsPage.jsx:72-116` and `ClientDetailPage.jsx:113-154` — 800ms-debounced, three visually distinct states (valid/fallback/invalid/error, `:440-455`)
Notes: Lookup logic duplicated between the two pages rather than shared — works but is a maintainability note, not a functional gap.

### Bulk client import (CSV/XLSX)
Status: ✅ Production Ready
Backend: `GET /api/clients/import/template` (CSV template download), `POST /api/clients/import/preview` (`requireAdmin`, multer 5MB memory upload → `previewClientImport`), `POST /api/clients/import/confirm` (`requireAdmin`, `importConfirmBodySchema` → `confirmClientImport`, audit `clients_bulk_imported`) — all in `clients.routes.js`/`client-import.service.js`. Per-row validation: required/length checks on name, GSTIN structural + checksum-severity split (checksum-only mismatches pass, matching the Review-page precedent), email/phone format, in-file duplicate-GSTIN detection, and a warning (not error) when email+phone are both missing. Confirm step re-checks against existing DB rows (GSTIN or name-without-GSTIN) and skips duplicates rather than erroring the whole batch.
Frontend: `components/clients/ClientImportModal.jsx` (541 lines — upload → preview table with per-row status/issues → confirm → success summary, with `uploading`/`uploadError`/`confirmLoading`/`confirmError` states throughout) wired from `ClientsPage.jsx`; `api/clients-api.js` (`downloadTemplate`/`previewImport`/`confirmImport`).
Notes: 🔧 Fixed, 2026-09-22 — the XLSX branch used the unmaintained `xlsx`/SheetJS package (GHSA-4r6h-8v6p-xvw6 prototype pollution + GHSA-5pgg-2g8v-p4x9 ReDoS, no patched version published) to parse untrusted admin-uploaded file buffers. Replaced with `exceljs` (already a dependency elsewhere in the codebase, actively maintained) — `parseFileToRows` is now `async`, reads via `workbook.xlsx.load(buffer)` + `worksheet.eachRow`, with a `stringifyCellValue` helper reproducing the old `raw:false` stringification behavior (numbers/dates/rich-text/formula-result cells → plain strings) so validation regexes keep working unchanged. `xlsx` removed from `package.json` entirely (`npm uninstall xlsx`). New test file `backend/tests/unit/client-import.service.test.js` (18 cases, including real ExcelJS-generated `.xlsx` fixtures) covers both the CSV and XLSX paths, blank-row dropping, numeric-cell stringification, and a corrupted-buffer friendly-error case. This feature existed fully wired (routes, service, frontend modal, audit logging) but had never been entered in this document before this pass — found only because this pass's dependency audit traced `xlsx`'s one usage site back to it.

---

## DOCUMENT UPLOADS

### Authenticated upload for firm users
Status: ✅ Production Ready
Backend: `POST /api/documents/upload` + `/confirm` — `documents.routes.js:144-214`, `uploadRateLimiter` (50/hr), Joi schemas (`:36-46`) → `initiateUploadForFirm`/`confirmUploadForFirm` (`documents.service.js:182-198,283-393`, audit `document_upload_initiated`/`document_upload_confirmed`)
Frontend: `pages/ClientDocumentsPage.jsx` — rewritten 2026-08-08 to match `PublicUploadPage.jsx`'s pattern
Notes: **Fixed 2026-08-08.** `ClientDocumentsPage.jsx` now supports multi-file selection (`<input type="file" multiple>`), a per-item queue state machine (`pending → preparing → uploading → confirming → success/error`, plus an `invalid` state for files rejected before upload), a per-file progress bar driven by `uploadApi.uploadFileToSignedUrl`'s existing `onProgress` callback, and client-side extension/size validation (same whitelist and 50MB cap as the public page) that shows an inline per-file error and never attempts to upload a rejected file. No backend or `upload-api.js` changes were needed — `uploadFileToSignedUrl` already accepted a progress callback.

### Public upload via magic link
Status: ✅ Production Ready
Backend: `POST /api/upload/:token/documents/upload` + `/confirm` — `public-upload.routes.js:157-258` → `initiateUploadWithMagicToken`/`confirmUploadWithMagicToken` (`documents.service.js:200-227,436-464`), token expiry + client-inactive checks (`documents.service.js:74-103`)
Frontend: `pages/PublicUploadPage.jsx` — multi-file queue with per-item status machine (pending→preparing→uploading→confirming→success/error, `:60-89,107-162`), progress bar via XHR `onprogress`
Notes: Fully built, more complete than the authenticated-upload counterpart.

### S3 presigned upload URL (and LOCAL_STORAGE fallback)
Status: ✅ Production Ready
Backend: presigned URL generation in `documents.service.js` `createUploadSession` (`:105-180`); local-disk fallback via `backend/src/routes/local-upload.routes.js` (mounted only when `env.LOCAL_STORAGE=true`, `app.js:59-61`), path-traversal guarded (`resolveLocalStoragePath`, `s3.service.js:33-40`)
Notes: **`local-upload.routes.js` has no `requireAuth` on any of its 3 routes** (`:26-70`) — acceptable only because it's dev-only and gated behind the `LOCAL_STORAGE` flag, but it is a real unauthenticated file read/write surface that must never be enabled on a networked/production deployment.

### Upload confirmation flow
Status: ✅ Production Ready
Backend: `documents.service.js confirmUploadForFirm`/`confirmUploadWithMagicToken`, enqueues BullMQ job + marks queued/queue-failure (`markDocumentQueued`/`markDocumentQueueFailure`, `:466-494` — **note: these two have no audit log entry**, a minor gap)
Frontend: both upload pages handle confirm step with success/error UI

### Multi-file upload queue
Status: ✅ Production Ready
Frontend: `PublicUploadPage.jsx` (`:60-162`) and, as of 2026-08-08, `ClientDocumentsPage.jsx` (same `pending/preparing/uploading/confirming/success/error/invalid` state machine, multi-select file input)

### Upload progress tracking
Status: ✅ Production Ready
Frontend: `PublicUploadPage.jsx` via `upload-api.js:9-13` XHR progress events; as of 2026-08-08, `ClientDocumentsPage.jsx` passes the same `onProgress` callback into `uploadApi.uploadFileToSignedUrl` and renders a per-file progress bar

### File validation (extension, MIME, size)
Status: ✅ Production Ready
Frontend: `PublicUploadPage.jsx:8-9,69-77` and, as of 2026-08-08, `ClientDocumentsPage.jsx` — both apply the same extension whitelist and 50MB cap client-side, marking rejected files `invalid` with an inline per-file message and never attempting to upload them
Backend: not confirmed whether the upload-init endpoints re-validate extension/MIME server-side (out of scope for this fix pass) — recommend verifying `documents.service.js createUploadSession` for server-side validation as defense-in-depth.

### Supported types: PDF, JPG, JPEG, PNG, XLSX
Status: ✅ Production Ready
Frontend: confirmed whitelist `["pdf","jpg","jpeg","png","xlsx"]` in `PublicUploadPage.jsx:8`, matching accept attribute on `ClientDocumentsPage.jsx:111`

---

## DOCUMENT PROCESSING

### Redis/BullMQ async queue
Status: ✅ Production Ready
Backend: `backend/src/workers/document-processing.worker.js`, concurrency via `env.DOCUMENT_WORKER_CONCURRENCY` (`:173-177`)

### Document worker processing
Status: ✅ Production Ready
Backend: `document-processing.worker.js` — marks `processing` (`:54-59`), calls AI service via `ai.service.js`, handles success/failure paths fully

### OCR extraction (PaddleOCR primary, Tesseract fallback)
Status: ✅ Production Ready
AI Service: `ai-service/app/services/ocr_service.py:163-175` — PaddleOCR primary (`_ocr_with_paddle`, `:144-151`), genuine try/except around the Paddle call (`:31-45`, returns `""` on failure rather than crashing), falls through to Tesseract (`_ocr_with_tesseract`, `:153-161`) if Paddle text `< 50` chars
Notes: **Task description says "Textract primary" — this is stale.** Recent commits (`4992f08`, `571cd38`) replaced AWS Textract with PaddleOCR and OpenAI with Groq; current code and CLAUDE.md both accurately reflect PaddleOCR + Groq, no leftover Textract/OpenAI code found anywhere in `ai-service/app/`.
**Operational caveat found 2026-08-08:** PaddleOCR downloads its detection/recognition/classification models from `paddleocr.bj.bcebos.com` on **first OCR call**, not at build time (~16MB across 3 archives). A first-run environment therefore needs egress to that host, and the download adds ~25s to the first document only. When it fails, `run_paddle_ocr`'s try/except returns `""` and the pipeline silently falls through to Tesseract — correct resilience, but the cause only appears in the AI-service log. Consider baking the models into the image for offline/air-gapped deploys.

### LLM structured extraction
Status: ✅ Production Ready
AI Service: `llm_service.py:407-412` — Groq `llama-3.3-70b-versatile`, now read from `os.getenv("GROQ_MODEL", ...)`, key from `settings.groq_api_key` (env-sourced)
Notes: **Fixed 2026-08-08 (demo-prep pass), verified live end to end.** The pinned model `llama-3.1-70b-versatile` had been **decommissioned by Groq** and returned `400 model_decommissioned` on every call, so extraction silently produced `confidence: 0.0` and an empty result for every document — the graceful-degradation path added earlier masked this as `review_required` rather than an error, which is why it was not obvious. Replaced with `llama-3.3-70b-versatile` and made it overridable via a `GROQ_MODEL` env var so the next Groq deprecation needs no code change. Also pinned `httpx==0.27.2` in `requirements.txt`: `groq==0.11.0` passes `proxies=` to `httpx.Client`, removed in httpx 0.28, so an unpinned resolve crashed the service at startup with `TypeError: Client.__init__() got an unexpected keyword argument 'proxies'`. Confirmed working: a live magic-link upload now returns `status=extracted`, `confidence≈0.85`, with correct `supplier_name` and `invoice_number`.
Notes: **Fixed 2026-08-08.** `settings.llm_timeout_seconds` is now passed as `timeout=` on the `chat.completions.create(...)` call, so a hung Groq request no longer blocks a worker slot indefinitely. The call is now wrapped in its own `try/except`: on failure it logs `Groq extraction failed: {e}` and returns `{"document_type_detected": "unknown", "confidence": 0.0, "_llm_error": str(e)}` directly (same short-circuit shape as the existing `is_ocr_garbage` path) instead of propagating to `main.py`'s generic 500 handler — a Groq outage now degrades a single document to `review_required` rather than surfacing as a raw 500.
Notes: **Fixed 2026-09-20.** `parse_json_object(raw_output)` (`:474` at the time) was called *outside* the try/except that wrapped the Groq call — a truncated response (e.g. hit `max_tokens=2000` mid-object, a real failure mode on large multi-page invoices) raised `json.JSONDecodeError`/`ValueError` uncaught, propagating through `main.py` as a raw 500 and losing the OCR text/confidence instead of degrading like every other failure path here. Now wrapped in its own try/except returning the same `document_type_detected: unknown, confidence: 0.0, _llm_error` shape. Also added: retry with backoff (`GROQ_MAX_ATTEMPTS = 3`, skips retry on a 4xx since those fail identically on retry) around the Groq call itself — previously a single transient rate-limit/connection blip failed the whole document with no recovery — and a wall-clock timeout (`OCR_TIMEOUT_SECONDS`, default 120s, via `concurrent.futures`) around both the PaddleOCR and Tesseract calls in `ocr_service.py`, which previously had no guard against a pathological image hanging the worker indefinitely. Verified with a 24-case pytest suite (`ai-service/tests/test_llm_service.py`, `test_json_parser.py`) mocking the Groq client directly — covers the malformed-JSON degrade, the retry-then-succeed path, the no-retry-on-4xx path, and exhausting all retries on a persistent 5xx.

### Confidence score generation
Status: ✅ Production Ready
AI Service: `llm_service.py:375-383` (LLM self-reported, clamped 0-1) with heuristic fallback `_confidence()` (`:362-373`, field-completeness) and invoice-only ceiling adjustments `validate_and_adjust_confidence()` (`:236-277`, caps for missing total/date/vendor, invalid GSTIN, tax-math variance)
Notes: OCR-engine confidence (PaddleOCR per-line score) is used only to filter which OCR lines are kept — it is discarded before the final score, so the reported `confidence_score` is LLM-only, not a true OCR+LLM combined metric, despite the task description implying both feed in.

### Confidence gating (0.4 threshold → review_required)
Status: 🔧 Needs Fix → ✅ Production Ready (fixed 2026-09-21)
Backend: `document-processing.worker.js` — `CONFIDENCE_THRESHOLD = env.REVIEW_CONFIDENCE_THRESHOLD`, sourced from a new `REVIEW_CONFIDENCE_THRESHOLD` Joi-validated env var (`config/env.js`, default `0.4`, same default as before)
Migration: `20260512000000_review_required_status.js` adds `'review_required'` enum value
Notes: Logic is unchanged (`confidence < threshold || documentTypeDetected === "unknown"` → `review_required`); the threshold is now env-configurable per the codebase's stated conventions instead of a hardcoded literal. Documented in `.env.example`.

### Wrong document type detection
Status: ⚠️ Partial → ✅ Production Ready (independent check added 2026-09-21)
AI Service: LLM self-classification unchanged — `EXTRACTION_PROMPT` "STEP 1" (`llm_service.py:16-25`) instructs the model to return `document_type_detected: "unknown"` for non-matching documents; backed by a code-level OCR-garbage pre-check `is_ocr_garbage()` that short-circuits before even calling Groq — but only for non-bank-statement uploads. The bank-statement prompt (`BANK_STATEMENT_PROMPT`) never asked the LLM to classify at all — it just extracts bank fields from whatever text it's given, so a mistagged document on that path had no LLM-side signal either way.
Backend: `documentTypeDetected === "unknown"` still wired into confidence gating. New: `detectDocTypeMismatch(docType, structuredData)` (`document-processing.service.js`) — a **structural, code-level check independent of anything the LLM claims about itself**, run in `document-processing.worker.js` right after parsing the AI response. Compares the *shape* of the extracted fields against the caller-supplied `doc_type`: a real bank statement has transaction rows; a real invoice/bill has an invoice number, vendor GSTIN, or line items. A confident mismatch (unambiguously the other shape) forces `review_required` and sets `structured_data._doc_type_mismatch_warning`, surfaced on the Review page as an amber banner (mirrors the existing `_tax_math_warning`/`_page_truncation_warning` pattern).
Notes: **Fixed 2026-09-21.** Closes the actual gap: the LLM's own self-report only ever means "invoice" or "unknown" and is entirely absent on the bank-statement path, so it could never catch e.g. an invoice mistakenly uploaded as a bank statement — that previously only surfaced indirectly (if at all) as unexplained low confidence from mostly-null fields, with no signal telling a reviewer *why*. The new check doesn't re-ask the LLM anything; it's a pure function over the already-extracted field shapes, which is what makes it genuinely independent. Deliberately conservative — an empty/low-quality extraction of either shape (neither confidently invoice-like nor bank-statement-like) is not flagged, since that's already handled by confidence gating; only an *unambiguous* shape mismatch triggers it. Covered by `backend/tests/unit/document-processing.service.test.js` (8 cases).

### Processing retry/error tracking
Status: ✅ Production Ready
Backend: `document-processing.service.js:115-176` (`markDocumentProcessingFailed`) increments `documents.processing_attempts`, writes `audit_logs` row `document_processing_failed` on every failure

### Permanent failure notification to admin
Status: ✅ Production Ready
Backend: on `processing_attempts >= 3`, `document-processing.service.js:156-170` writes the `document_processing_alert` audit row as before, and — as of 2026-08-08 — `document-processing.worker.js` (after the existing `process.stderr.write`) fetches the firm's admins via the existing `getDocumentReadyEmailContext` helper and, per admin, calls `createNotification({type: "document_failed", title: "Document processing failed", message: "A document failed to process after 3 attempts and needs manual review.", entityType: "document", entityId})` and sends an email built from the new `backend/src/templates/documentFailed.template.js` (subject "Document processing failed — manual review needed", includes document name, client name, failure reason, and a link to `/audit-logs`). A new `recordDocumentFailedEmailAudit` (`document-processing.service.js`) logs the email send outcome as `document_failed_emailed`. Both the notification call and the email call are individually wrapped in try/catch (mirroring the existing `document_ready` pattern) so a failure in either cannot affect the worker or the job's success/failure outcome.
Notes: Closes the gap flagged in the original audit — an admin now receives both an in-app notification and an email when a document permanently fails, matching the other three notification triggers.

### Multi-page PDF truncation warning
Status: ✅ Production Ready
AI Service: `preprocess_service.py` — `_render_pdf_pages` now returns `(images, total_pages)`, capturing the PDF's real page count (`document.page_count`) before truncating render to `MAX_PAGES` (15); `PreprocessOutput` carries `total_pages`/`truncated`. `main.py`'s `process_document()` sets `structured_data["_page_truncation_warning"]` and caps `confidence_score` at 0.3 (forcing `review_required` via the existing 0.4 gate) whenever `preprocessed.truncated` is true.
Frontend: `ReviewPage.jsx` — renders a red warning banner for `structuredData?._page_truncation_warning`, next to the existing amber `_tax_math_warning` banner in the confidence panel.
Notes: Added 2026-09-21 — real gap closed. A PDF longer than `MAX_PAGES` (e.g. a full month's bank statement scanned as one file) was previously rendered/OCR'd only up to page 15 with **no signal anywhere** that the remainder was dropped; a CA could approve and export a document missing most of its transactions with no indication anything was wrong. Now: the extraction is force-routed to `review_required` and the Review page tells the reviewer exactly how many of how many pages were processed, with guidance to reprocess in smaller batches. Covered by `ai-service/tests/test_preprocess_service.py` (3 cases, new file) and wired into CI (`.github/workflows/ci.yml`'s `ai-service` job now also installs `opencv-python-headless`/`PyMuPDF` — both already pinned in `requirements.txt` — so this suite actually runs on every PR, not just a syntax check).

---

## REVIEW WORKFLOW

### Review extracted document data
Status: ✅ Production Ready
Backend: `GET /api/extractions/:documentId` — `extractions.routes.js:51-110` → `getExtraction` (`extractions.service.js:27-61`) + inline compliance/name-mapping enrichment
Frontend: `pages/ReviewPage.jsx` (1181 lines) — loads via `Promise.allSettled` over document/extraction/versions (`:246-333`), "not yet processed" banner (`:267-273,670-677`)

### View document preview/download
Status: ⚠️ Partial → ✅ Production Ready (fixed 2026-09-21)
Frontend: `ReviewPage.jsx` — iframe for PDF, `<img>` otherwise, sourced from `document.download_url`; a "Download" button next to the status badge on the "Original document" panel calls `triggerFileDownload` (`lib/utils.js`, the same helper `ExportPage`/`ClientDetailPage` already use) and surfaces an inline error message on failure instead of failing silently
Notes: Previously there was no explicit "Download" button — the inline preview was the only access point, with no fallback affordance for file types the browser can't render inline. Fixed by reusing the existing download helper rather than adding a second download code path.

### Edit extracted fields (staff allowed)
Status: 🔧 Needs Fix → ✅ Production Ready (fixed 2026-09-20)
Backend: `PUT /api/extractions/:documentId` — `extractions.routes.js:113-131`, `requireAuth` only (correctly staff-editable), `updateSchema` (`:31-48`) → `updateExtraction` (`extractions.service.js:93-120`), snapshots `pre_edit` version first, now also writes an `extraction_updated` audit log entry (`entityType: "document"`) matching the pattern already used by `approveExtraction`/`reprocessDocument` in the same file
Frontend: `ReviewPage.jsx:868-875` Save button correctly NOT admin-gated
Notes: Previously no `audit_logs` entry was written for the edit itself — only the `pre_edit` version snapshot was recorded, so there was no explicit "who edited what, when" trail outside of diffing version snapshots. Fixed.

### Edit line items
Status: ✅ Production Ready
Frontend: `ReviewPage.jsx` — line-item and transaction fields individually editable, `disabled={isExported}` applied per-field

### Approve extraction (admin only)
Status: ✅ Production Ready
Backend: `POST /api/extractions/:documentId/approve` — `extractions.routes.js:134-152`, `requireAdmin` → `approveExtraction` (`extractions.service.js:122-180`, snapshots `pre_approval`, audit `extraction_approved`, auto-saves name mappings)
Frontend: `ReviewPage.jsx:876-904` admin-gated, also blocked by GSTIN checksum errors / already-exported / already-reviewed / wrong-status states with explanatory button titles

### Reprocess document (admin only)
Status: ✅ Production Ready
Backend: `POST /api/extractions/:documentId/reprocess` — `extractions.routes.js:155-168`, `requireAdmin` → `reprocessDocument` (`extractions.service.js:182-220`, snapshots `reprocess`, audit `document_reprocess_requested`)
Frontend: `ReviewPage.jsx:876-904` admin-gated

### Prevent editing exported extractions
Status: ✅ Production Ready
Backend: `deleteDocument` blocks on `status='exported'` (`documents.service.js:626-628`); `updateExtraction` (`extractions.service.js`) blocks on `status IN ('exported', 'reviewed')`
Frontend: `ReviewPage.jsx` — every editable field and Save/Reprocess/Approve button checks `isExported` (multiple line refs: `786,871,880,890,960-1135`)
Notes: **Fixed 2026-09-21 — real gap closed.** `updateExtraction` previously only rejected edits on `status === 'exported'`; a document already `reviewed` (admin-approved, not yet exported) could still be edited via a direct `PUT /api/extractions/:documentId` call, silently invalidating the admin's approval without requiring re-approval — the frontend disables the Save button in this state, but nothing enforced it server-side, so it was bypassable by any authenticated staff user hitting the API directly. Now blocks on `reviewed` as well as `exported`, with an error message telling the caller to reprocess first. Covered by `backend/tests/integration/extraction-edit-lock.test.js` (3 cases, new file, runs against a live Postgres) — rejects on `reviewed`, rejects on `exported`, still allows on `extracted`.

### Confidence bar display
Status: ✅ Production Ready
Frontend: `ReviewPage.jsx:47-53,737,741-756` — color-tiered confidence bar with percentage

### Tax math warning display
Status: ✅ Production Ready
Backend: `compliance.service.js:74-119` `validateTaxMath` (tolerance >1), surfaced as `structuredData._tax_math_warning`
Frontend: `ReviewPage.jsx:493,757-764`

### review_required amber banner
Status: ✅ Production Ready
Frontend: `ReviewPage.jsx:694-703`

---

## COMPLIANCE & VALIDATION

### GSTIN local checksum validation
Status: ✅ Production Ready
Backend: `compliance.service.js:18-61` `validateGstin`/`gstinChecksum` — state-code check, PAN pattern, mod-36 checksum digit

### GSTIN live GSP lookup
Status: ✅ Production Ready
Backend: `gsp.service.js:263-278` `verifyGSTIN`, calls external GSP when `isGspEnabled` (`:14-16`), falls back to local-checksum-only (`localFallbackGSTIN`, `:95-107`) when unconfigured
Route: `POST /api/compliance/gstin/verify` (`compliance.routes.js:348-383`)

### Tax math validation (CGST/SGST/IGST)
Status: ✅ Production Ready
Backend: `compliance.service.js:74-119` `validateTaxMath`, run automatically on every extraction fetch (`extractions.routes.js:90-92` → `compliance.service.js runAll`)
Notes: Now covered by `backend/tests/unit/compliance.service.test.js` (18 cases across `validateGstin`/`validateTaxMath`/`validateTdsRate`, added 2026-09-20), including a checksum-valid real GSTIN, rounding tolerance, and comma-formatted string amounts.

### TDS section/rate validation
Status: ✅ Production Ready
Backend: `compliance.service.js:123-169` `validateTdsRate` + `TDS_RATE_TABLE` (16 sections, statically hardcoded — not DB/env configurable, acceptable since TDS rates change rarely and by law, not by firm)

### Duplicate invoice detection
Status: ✅ Production Ready
Backend: `compliance.service.js:173-204` `checkDuplicateInvoice` — matches `vendor_gstin` + `invoice_number` among prior reviewed extractions within the same firm

### GSTR-2B matching per document
Status: ✅ Production Ready
Backend: `POST /api/compliance/gstr2b/match` — `compliance.routes.js:427-496` → `gspService.matchGSTR2B` (`gsp.service.js:280-295`), audit `gstr2b_matched`
Migration: `20260507000000_gstr2b_match_columns.js` — adds `gstr2b_match_status`/`gstr2b_match_details` columns directly onto `documents` (no dedicated reconciliation table, so no history across repeated match attempts)
Notes: **Fixed 2026-08-08** — `requireAdmin` added immediately after `requireAuth` on this route, matching the sibling `GET /gstr2b/reconciliation/export` route. The frontend "Verify GST" button on the review page (`ReviewPage.jsx`, near the GSTIN field) was previously visible to staff too; it is now wrapped in the same `canAdmin` check used for Approve/Reprocess, so staff no longer see a button that would 403.

### GST match status badge on review page
Status: ✅ Production Ready
Frontend: `ReviewPage.jsx:126-146` (`getGstBadge`) + "Verify GST" button (`:423-454,802-810`) calling `complianceApi.matchGstr2b`, expandable mismatch panel (`:811-838`)

---

## ITEM NAME MAPPING

### Per-firm item name mappings
Status: ✅ Production Ready
Backend: `item_name_mappings` table, unique per `(firm_id, vendor_raw)`
Migration: `20260412000000_item_name_mappings.js` + hardened by `20260505000000_harden_item_name_mappings_rls.js`
Notes: The original migration shipped RLS without `FORCE ROW LEVEL SECURITY` and without a `WITH CHECK` clause — a real window that had to be closed in a follow-up migration. Current state is correct, but worth noting the RLS-hardening pattern for future new tenant tables.

### Tally item name suggestions
Status: ✅ Production Ready
Backend: enriched server-side in `extractions.routes.js:70-87` via `name-mapping.service.js`
Frontend: `ReviewPage.jsx:1131-1148` `datalist`-based autocomplete on Tally Item Name field, populated from `item.suggestions`

### Fuzzy matching
Status: ✅ Production Ready
Backend: `name-mapping.service.js` — `FUZZY_THRESHOLD = 0.55`, `MAX_SUGGESTIONS = 3` (Levenshtein-based, both hardcoded constants)

### Auto-save corrected mappings after approval
Status: ✅ Production Ready
Backend: `extractions.service.js:157-168` inside `approveExtraction`, calls `nameMappingService.upsertMapping` for corrected line items

---

## TALLY EXPORT

### Generate TallyPrime-compatible XML
Status: ✅ Production Ready
Backend: `POST /api/export/tally` — `exports.routes.js:83-105`, `requireAdmin`, `generateExportSchema` (`:19-31`) → `generateTallyExport` (`exports.service.js:455-544`, audit `tally_export_generated`/`tally_export_failed`), only `reviewed`-status docs eligible (`fetchApprovedDocuments`, `:56-119`)

### Balanced voucher (debits = credits)
Status: ✅ Production Ready
Backend: `tally-xml.service.js:281-298` `buildTallyXml`, restricted to an allow-list of voucher types (`ALLOWED_VOUCHER_TYPES`, `:1-7`)
Notes: Now covered by `backend/tests/unit/tally-xml.service.test.js` (27 cases as of 2026-09-21) — asserts the debit=credit invariant for invoice and bank-statement vouchers, voucher-type inference/fallback, XML-escaping of party names, the opening/closing-balance fallback when a bank statement has no transaction rows, and that the output always begins with a UTF-8 XML declaration. **Fixed 2026-09-21:** `taxableAmount` in `buildInvoiceVoucherXml` previously fell back to the LLM-extracted `taxable_amount`/`subtotal` field when present, even though that field can disagree with `total_amount - tax_amount` — a bad extraction could produce a voucher that was internally balanced (debits=credits) but built from the wrong number, silently misstating the ledger. `taxableAmount` is now always computed as `totalAmount - taxAmount`, balanced by construction regardless of what the LLM extracted. Fixing this surfaced a real sign bug of its own (string-concatenating a literal `-` before an already-negative `.toFixed(2)` value produced `--900.00`-style garbage when `taxableAmount` went negative); fixed by negating numerically (`-taxableAmount`) before formatting, caught by a new test before it shipped. The no-transactions bank-statement fallback also previously emitted a single one-sided `<ALLLEDGERENTRIES.LIST>` entry (an unbalanced voucher); it now emits two legs (bank ledger + Sales/Purchase Account counter-ledger), matching the pattern already used for real transaction rows. **Also fixed 2026-09-21 (separately):** `buildTallyXml`'s output began directly with `<ENVELOPE>` and had no `<?xml version="1.0" encoding="UTF-8"?>` declaration — TallyPrime accepted it as-is (not a functional break), but any stricter XML consumer would reject it as malformed. Now prepended unconditionally. The ai-service's own separate bank-statement-to-XML generator (`bank_statement_xml_service.py`, a different code path for the standalone tool) already includes a declaration via `xml.dom.minidom`'s default serialization — confirmed by direct test, no fix needed there.

### GST ledger entries without requiring item mapping
Status: ✅ Production Ready
Backend: `tally-xml.service.js:83-111` `buildTaxLedgerEntries` (CGST/SGST/IGST lines) built independently of `buildInventoryEntries` (`:113-136`)

### Tax-math validation blocks export of inconsistent documents
Status: ✅ Production Ready
Backend: `exports.service.js` — `assertDocumentsPassTaxMath()` runs `compliance.service.js`'s `validateTaxMath()` against every document immediately before XML generation in both `generateTallyExport` (single) and `generateBulkTallyExport` (bulk), throwing `ApiError.badRequest()` naming the offending filename(s) if any document's CGST+SGST+IGST or taxable+tax math doesn't reconcile with its stated total. `generateTallyExportPreview` surfaces the same checks non-fatally via `getTaxMathWarnings()`, merged into the existing preview `warnings` array with a new `blocksExport: boolean` field the frontend can key off.
Notes: Added 2026-09-21. Closes a real gap: the XML-balancing fix above guarantees the *voucher* is internally balanced, but a balanced voucher can still be built from *wrong* numbers if the underlying extraction is internally inconsistent (e.g. CGST+SGST claims ₹900 but `tax_amount` says ₹500). This is a second, independent layer — bad extractions are now hard-blocked from export rather than silently exported in a self-consistent-but-wrong form. Also fixed a re-export duplication bug in the same pass: `fetchApprovedDocuments`'s filter was `status = 'reviewed' OR e.reviewed_at IS NOT NULL`, which could re-include a document across repeated bulk exports; narrowed to `status = 'reviewed'` only. Covered by `backend/tests/unit/exports.service.test.js` (6 cases, new file).

### Export preview (parsed XML as readable table)
Status: ✅ Production Ready
Backend: `POST /api/export/preview` — `exports.routes.js:126-143`, `requireAdmin` → `generateTallyExportPreview` (`exports.service.js:326-358`, read-only, no persistence)
Frontend: `pages/ExportPage.jsx:141-203,219-343` and duplicated in `ClientDetailPage.jsx:348-542` (bulk flow)

### Warning detection for unresolved mappings
Status: ✅ Production Ready
Frontend: `ExportPage.jsx:232-271`, `ClientDetailPage.jsx:428-469` — warnings table shown in preview modal before confirming export

### Single document export
Status: ✅ Production Ready
Frontend: `ExportPage.jsx:360-433` — client + optional date range + checkbox document selection
Client picker: `ExportPage.jsx:368-372` uses `components/ui/ClientSearchSelect.jsx` (new, client-side filtered searchable combobox — the already-loaded `clients` list from `clientsApi.list`, no new API); replaces the old plain `<select>`, keyboard accessible (arrow keys/Enter/Escape), selected client shown as a chip with a clear (×) button. `form.client_id` state and the `loadClientDocuments` effect keyed on it are unchanged.

### Bulk export with date range
Status: ✅ Production Ready
Backend: `POST /api/export/bulk` — `exports.routes.js:107-124`, `requireAdmin`, `bulkExportSchema` (`:33-49`) → `generateBulkTallyExport` (`exports.service.js:546-627`, audit `bulk_export_generated`)
Frontend: `ClientDetailPage.jsx:204-251,348-542`

### S3 upload of XML (and LOCAL_STORAGE fallback)
Status: ✅ Production Ready
Backend: consistent with the same `s3.service.js`/`local-upload.routes.js` fallback pattern used for document uploads

### Pre-signed download URL
Status: ✅ Production Ready
Backend: `GET /api/export/:id/download` — `exports.routes.js:163-177` → `getExportDownload` (`exports.service.js:718-781`, mutates status to `downloaded`, audit `tally_export_downloaded`)

### Export history with BULK badge
Status: ✅ Production Ready
Backend: `GET /api/export/history` — `exports.routes.js:145-161` → `listExportHistory` (`exports.service.js:629-716`)
Frontend: `ExportPage.jsx:491-495` (`row.exportType === "bulk"` badge)
Migration: `20260508000000_bulk_export_columns.js` adds `export_type`/`document_count`/`from_date`/`to_date`/`created_by`

### Mark documents as exported after export
Status: ✅ Production Ready
Backend: confirmed inside `generateTallyExport`/`generateBulkTallyExport`, which also block re-editing via the `status='exported'` check in `deleteDocument` and the frontend's `isExported` field-disabling on the review page

---

## GST RECONCILIATION

### Reconciliation page per client
Status: ✅ Production Ready
Frontend: `pages/GSTReconciliationPage.jsx`

### Period selector (month + year)
Status: ✅ Production Ready
Frontend: `GSTReconciliationPage.jsx:159-176`, defaults to previous month (`getDefaultPeriod`, `:41-48`)

### Run reconciliation against GSTR-2B
Status: ✅ Production Ready
Backend: `GET /api/compliance/gstr2b/reconciliation` — `compliance.routes.js:386-403`, `reconciliationQuerySchema` (`:26-32`) → `getReconciliationData` (`compliance.routes.js:109-244`)
Frontend: auto-runs on mount (`:123-125`) plus manual "Run" button (`:178-180`)

### Summary cards (total/matched/not found/mismatched)
Status: ✅ Production Ready
Frontend: `GSTReconciliationPage.jsx:209-222`

### Results table with filter tabs
Status: ✅ Production Ready
Frontend: `GSTReconciliationPage.jsx:98-106,224-243` (all/matched/not_found/mismatches)

### Mismatch detail display
Status: ✅ Production Ready
Frontend: `GSTReconciliationPage.jsx:262-289` (`mismatchText` helper, `:64-72`)

### Excel export of reconciliation report
Status: ✅ Production Ready
Backend: `GET /api/compliance/gstr2b/reconciliation/export` — `compliance.routes.js:406-424`, `requireAdmin` → `writeReconciliationWorkbook` (`:261-316`, xlsx stream), audit `gstr2b_reconciliation_exported`
Frontend: `GSTReconciliationPage.jsx:181-190`, admin-gated button

### Link from client detail page
Status: ✅ Production Ready
Frontend: `ClientDetailPage.jsx:809-813` — link shown only when `client.gstin` is set

---

## DOCUMENT VERSION HISTORY

### Snapshot before edit (pre_edit)
Status: ✅ Production Ready
Backend: `extractions.service.js:100-104` inside `updateExtraction`

### Snapshot before approval (pre_approval)
Status: ✅ Production Ready
Backend: `extractions.service.js:131-135` inside `approveExtraction`

### Snapshot before reprocess (reprocess)
Status: ✅ Production Ready
Backend: `extractions.service.js:189-193` inside `reprocessDocument`
Notes: All three share `snapshotDocument` (`document-versions.service.js:19-59`), auto-incrementing `version_number`; snapshot failures are caught and logged (`console.error`) without blocking the underlying edit/approve/reprocess action — a reasonable resilience choice, but means a silent snapshot failure could leave a gap in the version history with no operator-visible signal beyond server logs.

### Version list endpoint (no extracted_data)
Status: ✅ Production Ready
Backend: `GET /api/documents/:id/versions` — `documents.routes.js:101-112` → `getVersionsForDocument` (`document-versions.service.js:61-85`)

### Version detail endpoint (with extracted_data)
Status: ✅ Production Ready
Backend: `GET /api/documents/:id/versions/:versionId` — `documents.routes.js:114-126` → `getVersionDetail` (`document-versions.service.js:87-117`)
Migration: `20260510000000_document_versions.js` (RLS via subquery through `documents.firm_id`, same pattern as `extractions`)

### View History button on review page
Status: ✅ Production Ready
Frontend: `ReviewPage.jsx:856-864`, only rendered if `versions.length > 0`

### Side-by-side diff view
Status: ✅ Production Ready
Frontend: `ReviewPage.jsx:559-666`, field-by-field diff with `changed` boolean highlighting (`:625-636`)

---

## NOTIFICATIONS

### Notifications table with RLS
Status: ✅ Production Ready
Migration: `20260509000000_notifications.js`, RLS enabled (`:22-30`)

### Bell icon in top nav with badge
Status: ✅ Production Ready
Frontend: `components/layout/AppShell.jsx:217-231`

### Unread count (capped at 99+)
Status: ✅ Production Ready
Frontend: `AppShell.jsx:228` (`unreadCount > 99 ? "99+" : unreadCount`)

### Dropdown with last 20 notifications
Status: ✅ Production Ready (verified 2026-09-21)
Backend: `GET /api/notifications` — `notifications.routes.js:25-42` → `getNotificationsForUser` (`notifications.service.js:51-71`), `limit = 20` default, clamped to `[1, 50]`
Frontend: `AppShell.jsx` calls `notificationsApi.list({ unreadOnly: false })` with no limit override, so the backend default of 20 applies end-to-end
Notes: Confirmed by direct code read — the "last 20" spec matches exactly, no fix needed.

### Mark individual as read
Status: ✅ Production Ready
Backend: `PATCH /api/notifications/:id/read` — `notifications.routes.js:52-63` → `markRead` (`notifications.service.js:89-101`)
Frontend: `AppShell.jsx:147-161` (`onNotificationClick`)

### Mark all as read
Status: ✅ Production Ready
Backend: `PATCH /api/notifications/read-all` — `notifications.routes.js:44-50` → `markAllRead` (`notifications.service.js:103-115`)
Frontend: `AppShell.jsx:163-170,237-245` (shown only when `unreadCount > 0`)

### Navigate to entity on click
Status: ✅ Production Ready
Frontend: `AppShell.jsx:147-161` maps document/export/client entity types to routes

### 30-second polling with cleanup on unmount
Status: ✅ Production Ready
Frontend: `AppShell.jsx:107` `window.setInterval(fetchNotifications, 30000)`, cleanup via `clearInterval` (`:109-112`) plus an `active` flag guard against post-unmount state updates (`:99-106`)

### Triggers: document ready, client upload, export ready, document permanently failed
Status: ✅ Production Ready
Backend: `document_ready` — `document-processing.worker.js:132-140`; `client_upload` — `public-upload.routes.js:228-236`; `export_ready` — `exports.service.js:497-505` (single) and `:603-611` (bulk); `document_failed` — **added 2026-08-08**, `document-processing.worker.js` inside the `failure.alertTriggered` branch (after the existing stderr write), one `createNotification` call per firm admin.
Notes: All 4 triggers are now wired. `document_failed` reuses the existing `getDocumentReadyEmailContext` helper to fetch admins and is individually try/catch-wrapped per admin, consistent with the other three trigger sites.

---

## SCHEDULED REQUESTS

### scheduled_requests table
Status: ✅ Production Ready
Migration: `20260511000000_scheduled_requests.js` — RLS with a `scheduler` auth-context escape hatch so the cron worker (no logged-in user) can read/write across firms; check constraints on frequency/day ranges; unique partial index enforcing one active schedule per client

### Create schedule (monthly/weekly)
Status: ✅ Production Ready
Backend: `POST /api/scheduled-requests` — `scheduled-requests.routes.js:62-90`, `requireAdmin`, `createSchema` (`:20-34`) → `createSchedule` (`scheduled-requests.service.js:68-118`, audit `schedule_created`)

### Get schedule for client
Status: ✅ Production Ready
Backend: `GET /api/scheduled-requests` — `scheduled-requests.routes.js:92-107` → `getScheduleForClient`/`listSchedulesForFirm` (`:120-153`)

### Update schedule
Status: ✅ Production Ready
Backend: `PATCH /api/scheduled-requests/:id` — `scheduled-requests.routes.js:109-134`, `requireAdmin` → `updateSchedule` (`:155-201`, audit `schedule_updated`)

### Delete schedule
Status: ✅ Production Ready
Backend: `DELETE /api/scheduled-requests/:id` — `scheduled-requests.routes.js:136-159`, `requireAdmin` → `deleteSchedule` (`:203-216`, audit `schedule_deleted`)

### BullMQ daily job at 08:00 UTC
Status: 🔧 Needs Fix → ✅ Production Ready (fixed 2026-09-21)
Backend: `scheduled-requests.job.js` — repeat pattern `"0 8 * * *"` (still hardcoded — this part was not the actual risk, see below), registered via `startServer()` in `server.js`. New standalone entry point `backend/src/workers/scheduled-requests.worker.js` + `npm run worker:scheduled-requests` / `:dev` scripts, gated behind the same `assertRuntimeRoleIsNotSuperuser()` startup guard the document worker uses.
Notes: **Fixed 2026-09-21.** The real risk wasn't the hardcoded cron pattern, it was that the worker consumer (`createScheduledRequestsWorker`) only ran as an unconditional side effect of `document-processing.worker.js` instantiating it — deploying the two workers as separate scaled units would have silently dropped the scheduled-requests cron with no standalone process to run it. Added a new `SCHEDULED_REQUESTS_EMBEDDED` env var (`config/env.js`, default `true`) that `document-processing.worker.js` checks before creating the embedded scheduled-requests worker, plus the new standalone entry point above for running it as its own deployable process (set `SCHEDULED_REQUESTS_EMBEDDED=false` on the document worker when doing so — running both is safe-but-redundant, never double-processing, since BullMQ delivers each job to exactly one consumer). `render.yaml`'s current single `verax-worker` service is unaffected — it keeps the default embedded behavior. Verified both modes boot correctly against a live Postgres + Redis: embedded (default), `SCHEDULED_REQUESTS_EMBEDDED=false` on the document worker with the standalone worker picking up the queue, and the RLS superuser guard rejecting boot for the new file too.

### Per-client try/catch isolation in job
Status: ✅ Production Ready
Backend: `scheduled-requests.job.js:53-100` `processScheduledRequests` — try/catch inside the loop body (`:59-92`), one client's failure doesn't stop the rest; failure/success counts logged but not persisted or alerted anywhere beyond stdout/stderr

### Schedule UI on client detail page
Status: ✅ Production Ready
Frontend: `ClientDetailPage.jsx:253-311,544-646`, admin-gated (`:792,820`)

### Summary card with last sent date
Status: ✅ Production Ready
Frontend: `ClientDetailPage.jsx:824-844` (`schedule.lastSentAt ? formatDateTime(...) : "Never"`)

---

## TEAM MANAGEMENT

### List users in firm
Status: ✅ Production Ready
Backend: `GET /api/users` — `users.routes.js:25-33` → `listUsers` (`users.service.js:18-31`)
Frontend: `pages/TeamPage.jsx:51-62`, loading skeleton, empty state

### Invite user (admin only) — sends email
Status: ✅ Production Ready (confirmed 2026-09-21)
Backend: `POST /api/users` — `users.routes.js:35-52`, `requireAdmin`, `inviteUserSchema` (`:12-17`) → `inviteUser` (`users.service.js`, audit `user_invited` + `user_invite_emailed`), sends email with `tempPassword` in cleartext
Frontend: `TeamPage.jsx:139-224`, Zod-validated form, admin-gated toggle
Notes: The `user_invited`/`user_invite_emailed` audit rows already capture `sent`/`provider`/`error` (`users.service.js`'s `user_invite_emailed` insert), matching the other 3 email call sites — this entry's previous "Partial" status was stale; direct code read on 2026-09-21 found no gap.

### Remove user (admin only)
Status: ✅ Production Ready
Backend: `DELETE /api/users/:id` — `users.routes.js:54-68`, `requireAdmin` → `removeUser` (`users.service.js:129-169`, audit `user_removed`)
Frontend: `TeamPage.jsx:300-319`, two-step confirm-inline pattern

### Prevent admin removing own account
Status: ✅ Production Ready
Backend: `users.service.js:130-132` — `if (actorUserId === targetUserId) throw ApiError.badRequest(...)`
Frontend: `TeamPage.jsx:298-299` — `isCurrentUser` disables the row's remove control client-side too

### Roles: admin, staff
Status: ✅ Production Ready
Backend: `user_role_enum` in initial schema migration
Frontend: `TeamPage.jsx:18-32,289-291` role badges, `296-297` non-admin "view only" state

---

## DASHBOARD

### Overview stats (Total clients / Awaiting review / Approved this session / Exports this month)
Status: ✅ Production Ready
Backend: `GET /api/dashboard/overview` — `dashboard.routes.js`, `requireAuth` → `getDashboardOverview` (`dashboard.service.js`), a single firm-scoped CTE query returning all 4 counts server-side
Frontend: `dashboard-api.js` calls the new endpoint plus `exportsApi.history({limit:6})` for the separate "recent activity" list; `DashboardPage.jsx` unchanged (same `{totalClients, pendingDocs, reviewedDocs, exportedThisMonth, activity}` shape)
Notes: 🔧 Fixed — previously computed entirely client-side from `Promise.allSettled` over `clientsApi`/`documentsApi`/`exportsApi` calls (`dashboard-api.js`, old version). Two real bugs: (1) "Approved this session" had no date filter at all — it was an all-time count of `status='reviewed'` docs, and even that undercounted because a doc's status flips to `exported` after export, dropping it out of the count; now backed by `extractions.reviewed_at` scoped to the current day in `Asia/Kolkata`, which survives the later status change. (2) "Exports this month" filtered a capped 20-row `exportsApi.history()` page client-side using **UTC** month boundaries — both a truncation bug (>20 lifetime exports silently undercounts the month) and a timezone bug (IST exports near month boundaries miscounted); now a firm-scoped `COUNT(*)` in the DB bucketed by IST calendar month, excluding `status='failed'`. "Total clients" and "Awaiting review" were already correct and are unchanged in definition, just moved server-side. Verified against raw SQL counts for a real firm (5/3/2/10) — see PR notes.

---

## AUDIT LOGS

### Audit log page (admin only)
Status: ✅ Production Ready
Frontend: `pages/AuditLogPage.jsx:102-108` — non-admins see "Admin access required" message; fetch `useEffect` explicitly skips the API call when `!canAdmin` (`:81-87`), so it's gated both visually and functionally, not just hidden by CSS

### List entries
Status: ✅ Production Ready
Backend: `GET /api/audit-logs` — `audit.routes.js:19-35`, `requireAdmin`, `listAuditLogsQuerySchema` (`:10-15`) → `listAuditLogs` (`audit.service.js:1-67`)
Frontend: loading skeleton, empty state, pagination (`:144-247`)

### Search audit logs (free text)
Status: ✅ Production Ready
Backend: `GET /api/audit-logs?search=` — `audit.routes.js` (`search` added to `listAuditLogsQuerySchema`) → `listAuditLogs` (`audit.service.js`) runs an `ILIKE` match across `action`, `entity_type`, `entity_id`, `metadata::text`, `user.name`, `user.email`
Frontend: `AuditLogPage.jsx:118-135` — debounced (300ms) free-text input with a clear button, resets to page 1 on change
Notes: 🔧 Fixed — this box previously did an exact-equality filter on the raw `action` column only (e.g. required typing the literal `document_approved`), so any partial text or search across user/entity/details silently returned zero rows. It now does a partial, case-insensitive match across the fields actually shown in the table.

### Client attribution for client-portal / magic-link actions
Status: ✅ Production Ready
Backend: `listAuditLogs` (`audit.service.js`) `LEFT JOIN clients` on `(metadata->>'clientId')::uuid` (regex-guarded so a malformed/missing value can't break the query), falling back to `entity_id` when `entity_type='client'`; returns `clientName`. `document-processing.service.js`'s `document_processed`/`document_processing_failed`/`document_processing_alert` audit inserts now include `clientId` in metadata (previously had `client_id` in scope via `RETURNING` but never wrote it) — `document_upload_initiated`/`document_upload_confirmed` (`documents.service.js`) already had it.
Frontend: `AuditLogPage.jsx` — `getActorDisplay()` shows the client's name as the Actor for client-initiated actions (`document_upload_initiated/confirmed`, `client_portal_login/login_failed/logout/password_changed`) when there's no firm-user actor, and "System" + "Client: {name}" for system/worker-triggered actions tied to a client (`document_processed`, `document_processing_failed`, `document_processing_alert`)
Notes: 🔧 Fixed — client-portal/magic-link-triggered rows always have `user_id = NULL` (a client isn't a `users` row), so Actor showed "-" even though `metadata.clientId` was already being written for the upload events. Verified against real DB rows for two different clients (no cross-client mixups) and via a mocked call confirming the AI-processing insert sites now include `clientId`.

### Filter by entity type
Status: ✅ Production Ready
Frontend: `AuditLogPage.jsx:120-131` dropdown, `ENTITY_TYPES = ["firm","client","document","extraction","user"]`

---

## CLIENT UPLOAD STATUS PAGE

### Public GET /api/upload/:token/status
Status: ✅ Production Ready
Backend: `public-upload.routes.js:141-155` → `getUploadStatusByToken` (`:93-139`), scoped via `withTenantTransaction({authContext:"magic_link", uploadToken})`

### Returns safe fields only (no extraction data)
Status: ✅ Production Ready
Backend: `getUploadStatusByToken` confirmed to only expose status-mapping fields, not `structured_data`/extraction contents

### Status label mapping (extracted → Processing)
Status: ✅ Production Ready
Backend: `mapClientStatus`, `public-upload.routes.js:83-91` — `uploaded→Received`, `processing/extracted→Processing`, `review_required/reviewed→Under Review`, `exported→Complete`

### Standalone public page /upload/:token/status
Status: ✅ Production Ready
Frontend: `pages/PublicUploadStatusPage.jsx`, route confirmed public in `App.jsx`

### Auto-refresh every 15 seconds while pending
Status: ✅ Production Ready
Frontend: `PublicUploadStatusPage.jsx:40-46,71-79` — polls only while `hasActiveDocuments` is true

### Stops polling when all docs reach terminal status
Status: ✅ Production Ready
Frontend: same effect, cleanup via `window.clearInterval` (`:78`), correctly derives "terminal" from the same status-mapping as the backend

### Link from upload success page
Status: ✅ Production Ready
Frontend: `PublicUploadPage.jsx:284-291` — confirmed while implementing Fix 2: once `successCount > 0`, a "View upload status →" link to `/upload/${activeUploadToken || token}/status` renders below the upload queue.
Notes: Corrected from the original audit's "not independently confirmed" note — verified present on direct code read.

---

## MAGIC LINK / CLIENT REQUEST

### Generate magic upload token
Status: ✅ Production Ready
Backend: `clients.service.js:26` `createUploadToken()` — `crypto.randomBytes(32).toString("hex")` (64-char hex, confirmed)

### Request documents from client (admin only)
Status: ✅ Production Ready
Backend: `POST /api/clients/:id/request-docs` — `clients.routes.js:129-146`, `requireAdmin` + new `requestDocsBodySchema` → `requestClientDocuments` (`clients.service.js:322-440`, audit `client_request_docs` + `client_magic_link_emailed`)
Notes: **Fixed 2026-08-08** — added `requestDocsBodySchema` (`documentTypes: Joi.array().items(Joi.string().valid("invoice","bank_statement","bill","other")).min(1).optional()`) and applied `validate(requestDocsBodySchema)` on the route; the route now passes `req.body.documentTypes` through to `requestClientDocuments`. The service function already accepted a `documentTypes` parameter and already fell back to `DEFAULT_REQUESTED_DOCUMENT_TYPES` via `toRequestedDocumentLabels` when it was absent (`clients.service.js:28-45`) — the only missing piece was the route never reading or forwarding the field, which is now fixed.

### Send magic link email
Status: ✅ Production Ready
Backend: `clients.service.js:407-417`, audit `client_magic_link_emailed` (`:419-431`)

### Single-use token rotation
Status: ✅ Production Ready
Backend: `rotateMagicTokenIfNeeded` (`documents.service.js:395-434`), gated by `env.MAGIC_LINK_SINGLE_USE`
Frontend: `PublicUploadPage.jsx:146-150` handles `token_rotation.uploadToken` in the confirm response and rotates the queue's token for subsequent items

### Magic link expiry
Status: ✅ Production Ready
Backend: `env.MAGIC_LINK_EXPIRY_HOURS` (default 24), enforced both at the query layer (`getClientByMagicToken`, `documents.service.js:74-103`) and at the RLS level (`clients_isolation_policy` checks `upload_token_expires_at IS NULL OR upload_token_expires_at > NOW()`, migration `20260311171500`)

---

## CLIENT PORTAL

*Added 2026-08-09. A second, completely separate auth world for the SME clients of
a CA firm. Two rules govern every entry below: a firm JWT must never work on
`/api/client-portal/*`, and a client JWT must never work on `/api/*` firm routes.
Both are enforced by construction (different signing key, different JWT
issuer/audience, different middleware) and both are covered by tests.*

### Client portal schema + RLS
Status: ✅ Production Ready
Migration: `20260516000000_client_portal_auth.js` — adds `portal_email` / `portal_password_hash` / `portal_enabled` / `portal_last_login_at` to `clients` (unique partial index `uq_clients_portal_email_active` on `lower(portal_email)` among live rows, matching the `uq_users_email_active` pattern); creates `client_refresh_tokens` (id, client_id CASCADE, token_hash, expires_at, revoked_at, created_at) with RLS enabled + forced; adds `app.current_client_id()` alongside the existing `app.current_firm_id()`.
Notes: Two RLS decisions worth recording. (1) `client_refresh_tokens_isolation_policy` has **two** branches — `client_id = app.current_client_id()` for the client's own session, plus an `EXISTS` subquery through `clients.firm_id = app.current_firm_id()` so the owning CA firm can revoke a client's sessions when it resets that client's portal password. Without the firm branch, `enableClientPortal` (which runs in a firm-scoped transaction) would have silently revoked zero rows and left old sessions alive across a password reset. (2) `clients_isolation_policy` gains a third branch, `app.auth_context = 'client_portal_login'`, so an unauthenticated portal login can find its own row by `portal_email` before any firm context exists — the exact shape of the existing `login` hatch on `users` and `magic_link` hatch on `clients`. `tenant-context.js` now also sets `app.current_client_id` and `app.portal_email`.

### Separate client JWT signing key
Status: ✅ Production Ready
Backend: `config/env.js` requires `CLIENT_JWT_SECRET` (min 32) and **refuses to boot if it equals `JWT_SECRET` or `JWT_REFRESH_SECRET`** (`Joi.invalid(Joi.ref(...))`). `CLIENT_JWT_EXPIRY` (default `15m`) and `CLIENT_REFRESH_TOKEN_EXPIRY_DAYS` (default 30) are env-driven. `utils/client-token-utils.js` signs with issuer `verax-client-portal` / audience `verax-clients` — distinct from the firm portal's `ca-saas-platform` / `ca-saas-users`, so the two token families are structurally incompatible even before the `role`/`type` claim checks.
Env: added to root `.env.example`, root `.env`, `backend/.env`, and both `docker-compose.yml` and `docker-compose.prod.yml` (backend + worker services), since those enumerate env vars explicitly and the backend now fails validation without it.

### Enable client portal (admin only)
Status: ✅ Production Ready
Backend: `POST /api/clients/:id/enable-portal` — `clients.routes.js`, `requireAdmin` + `enablePortalBodySchema` (Joi email) → `enableClientPortal` (`client-auth.service.js`). Generates a 12-char temp password via `crypto.randomInt` (guaranteed one letter + one digit, ambiguous glyphs `0/O/1/l/I` excluded because it gets read off a screen and typed by hand), hashes it bcrypt cost 12, revokes any existing client sessions, audit-logs `client_portal_enabled` and `client_portal_invite_emailed`, and emails the client from `templates/clientPortalInvite.template.js`. A duplicate `portal_email` surfaces as a 409, not a raw 23505.
Frontend: `ClientDetailPage.jsx` — admin-gated "Client Portal" panel showing Enabled/Not enabled, the portal email, and last login; modal captures the email and then shows the temp password **once** with a copy button and the "will not be shown again" warning. `closeEnablePortalModal` clears the password from React state on close.
Migration: `20260516000000_client_portal_auth.js`
Notes: `getClientById` now returns a `portal: {enabled, email, lastLoginAt}` object. `portal_password_hash` is never selected by any read path — verified by test that the client-detail response body contains no hash field.

### Client portal login
Status: ✅ Production Ready
Backend: `POST /api/client-portal/auth/login` — `client-auth.routes.js`, own `clientAuthRateLimiter` (10 per 15 min per IP, separate from the firm portal's budget), Joi-validated → `clientLogin`. Looks the client up by `portal_email` with `portal_enabled = true AND deleted_at IS NULL`, bcrypt-compares, mints a 15-min access token and a 30-day rotating refresh token, stamps `portal_last_login_at`, audit-logs `client_portal_login`.
Frontend: `pages/ClientPortalLoginPage.jsx` — Zod validation, loading/error states, "Forgot password" reveals "Contact your CA firm to reset your password".
Notes: Unknown email, wrong password, and inactive client all return the byte-identical generic `Invalid email or password` — verified by test that the unknown-email and wrong-password responses match exactly. Failures against a *known* client are audit-logged as `client_portal_login_failed` with a reason. **Fixed 2026-09-21:** an unknown-email attempt now is too (`reason: "unknown_email"`, `firm_id: null`) — same fix and same migration as the firm-side Login entry, extended to also cover this flow's `client_portal_login` auth_context.

### Client portal refresh with rotation + reuse detection
Status: ✅ Production Ready
Backend: `POST /api/client-portal/auth/refresh` → `clientRefreshToken`. The refresh JWT carries its `client_refresh_tokens` row id as its `jti`; the handler re-hashes the presented token, compares, rotates (new row + old row revoked), and on hash mismatch / already-revoked / portal-disabled revokes the **entire** token family.
Frontend: `lib/client-portal-client.js` — its own module-scope token and its own 401→refresh→retry, deliberately not sharing `lib/api-client.js`'s `tokenStore`.
Notes: The family revocation is applied via a **sentinel return, not a throw** — throwing inside the `withTenantTransaction` handler would `ROLLBACK` the revocation, which is exactly the live bug now recorded against the firm-side `JWT refresh` entry. Verified by test: replaying a rotated token 401s, and the token issued by that same rotation is then also dead.

### Client portal logout + change password
Status: ✅ Production Ready
Backend: `POST /api/client-portal/auth/logout` (revokes the presented token, audit `client_portal_logout`, clears cookie) and `POST /api/client-portal/auth/change-password` (`requireClientAuth`, Joi min 8 on `newPassword`) → `clientChangePassword`, which verifies the current password, re-hashes bcrypt 12, revokes **all** sessions including the caller's, and audit-logs `client_portal_password_changed`.
Frontend: `pages/ClientPortalSettingsPage.jsx` — change-password form with confirm field, then clears the session and redirects to the login page.
Notes: Verified end to end — wrong current password 401s, a <8-char new password 400s, and after a successful change the old password stops working while the new one succeeds.

### Client refresh cookie isolation
Status: ✅ Production Ready
Backend: `getClientRefreshCookieOptions` (`client-auth.service.js`) — `httpOnly`, `sameSite: strict`, `secure` in production, cookie name `verax_client_refresh_token`, **`path: /api/client-portal/auth`** so it is never sent to (and can never clobber) the firm cookie scoped at `/api/auth`.
Notes: All four properties asserted by test against the real `Set-Cookie` header.

### Client auth middleware / cross-world rejection
Status: ✅ Production Ready
Backend: `middlewares/client-auth.middleware.js` `requireClientAuth` — verifies with `CLIENT_JWT_SECRET` + client issuer/audience, requires `type === 'client_access'` and `role === 'client'`, sets `req.clientId` / `req.firmId`, and exposes `req.withClientTransaction` which opens a transaction with **both** `app.current_firm_id` and `app.current_client_id` set. Shares no code with `requireAuth`.
Notes: Verified by test — a firm admin JWT on `GET /api/client-portal/me` returns 401, and a client JWT on both `GET /api/clients` and `GET /api/auth/me` returns 401.

### Client portal dashboard + stats
Status: ✅ Production Ready
Backend: `GET /api/client-portal/stats` — `client-portal.routes.js`, returns `totalDocuments`, `processingCount`, `reviewCount`, `completedCount`, `thisMonthDocuments`, all scoped to `firm_id` **and** `client_id`.
Frontend: `pages/ClientPortalDashboardPage.jsx` — greeting, 4 stat tiles, last-5 recent documents, quick links; loading/error/empty states.

### Client portal document list, detail, download
Status: ✅ Production Ready
Backend: `GET /api/client-portal/documents` (Joi-validated `status`/`fromDate`/`toDate`/`page`/`limit`), `GET /documents/:id` (adds a plain-English `statusMessage`), `GET /documents/:id/download` (presigned URL for the original upload only).
Frontend: `pages/ClientPortalDocumentsPage.jsx` — All/Processing/Under Review/Complete filter, card layout that reflows on mobile, per-row download button, `components/ui/ClientStatusBadge.jsx` (Processing→blue, Under Review→amber, Complete→green).
Notes: **`extracted_data` is never returned** — the routes select only `file_name`, `doc_type`, `status`, timestamps, `confidence_score` and the upload `source`; `structured_data`, `raw_text` and `s3_key` appear nowhere in any response, asserted by test. Internal statuses are collapsed to the three client-facing labels, and the Joi enum accepts only the client-facing filter names, so `?status=reviewed` is a 400 rather than a leak of firm workflow vocabulary.

### Client portal reconciliation + Excel export
Status: ✅ Production Ready
Backend: `GET /api/client-portal/reconciliation?period=MMYYYY` returns `{totalDocuments, matched, notFound, mismatched, totalITC}` (`mismatched` folds in `partial`, which reads as "doesn't agree" to a client); `GET /api/client-portal/reconciliation/export` streams the same xlsx the firm portal produces. Audit actions `client_portal_reconciliation_viewed` / `_exported`.
Frontend: `pages/ClientPortalReconciliationPage.jsx` — month+year picker defaulting to last month, four summary cards, ITC total, Excel download, read-only.
Notes: The matching logic was **extracted, not duplicated** — `getReconciliationData` / `writeReconciliationWorkbook` and their helpers moved from `compliance.routes.js` into the new `services/reconciliation.service.js`, which both route files now import; `compliance.routes.js` behaviour is unchanged. A client with no GSTIN on file gets a friendly `available: false` payload instead of the firm-facing 400.

### Client portal exports history
Status: ✅ Production Ready
Backend: `GET /api/client-portal/exports` — `tally_exports` rows for this client only, exposing just `exportedAt`, `documentCount` and a human `period` label. `xml_s3_key` is never returned, so a client can see *that* a filing happened but can never fetch the Tally XML.
Frontend: shown as "Filed to your accounts" on `ClientPortalSettingsPage.jsx`.

### Client portal frontend shell + routing
Status: ✅ Production Ready
Frontend: `contexts/ClientPortalAuthContext.jsx` (bootstrap via refresh cookie, `login`/`logout`/`clearSession`, `isAuthenticated`/`isLoading`), `components/layout/ClientPortalShell.jsx` (header with logo + client name + sign out, horizontal nav, no sidebar, mobile-first `max-w-4xl` layout), `components/layout/ProtectedClientRoute.jsx` (loading spinner during bootstrap, redirect to `/client-portal/login` otherwise), `api/client-portal-api.js`.
Routing: `App.jsx` mounts `/client-portal/*` under its own `ClientPortalAuthProvider` via an `Outlet` layout route, so the firm `AuthProvider` in `main.jsx` and the client session never share state. `/client-portal/login` is public; dashboard/documents/reconciliation/settings are wrapped in `ProtectedClientRoute`.
Notes: The portal deliberately reuses the app's existing design tokens (`panel`, `field`, `btn-primary`, ink/sand/mint palette) at a larger base type size (`text-base`/`text-lg` rather than `text-sm`) with no AppShell, no sidebar, and no technical jargon.

---

## PUBLIC / MARKETING SURFACE

Scope note: this group covers the unauthenticated pages only (`/`, `/features`, `/pricing`,
`/about`, `/security`, `/login`, `/signup`, `/client-portal/login`, `/upload/:token`,
`/upload/:token/status`). Two design systems coexist by design: **V2 ("The Ledger")** on the
marketing surface, **V1** on the auth and magic-link upload pages. Every token is namespaced
(`vx-*`, `canvas`/`surface`/`well`/`hairline`) so no authenticated dashboard page is affected —
verified by grep: `zinc-*` and `verify-*` have no call sites outside the public surface, and the
dashboard's `ink`/`sand`/`mint`/`ember`/`graphite` scales are untouched.

### Public design system — V2 ("The Ledger", marketing surface)
Status: ✅ Production Ready for the marketing surface (`/` + shared nav/footer chrome on
`/features`, `/pricing`, `/about`, `/security`); the four secondary pages' own *body* content is
still on the pre-V1 sand/ink/mint palette — see "Secondary marketing pages" below.
Added 2026-08-09.
Docs: `frontend/DESIGN_SYSTEM.md` §§0.5, 9–12 (V2 supplement; V1 sections below it still describe
`/login`, `/signup`, `/client-portal/login` and the magic-link upload pages, which V2 does not
touch).
Concept: three drawn primitives repeated at every scale — Sheet (ruled paper = an unread
document), Field (bracketed label/value in mono = something lifted out of one), Mark (teal tick =
validated / amber caret = needs a human) — connected by Rail (a dashed track). Implemented in
`frontend/src/components/marketing/ledger.jsx`, which every marketing section imports. No icon
grids, no screenshots-as-identity, no stock imagery, no gradient blobs.
Tokens: `frontend/tailwind.config.js` — new `carbon` scale (`carbon-950 #08090B` … `carbon-100
#E4E6EA`), the V2 primary: it carries every marketing headline and every full-bleed contrast
section. Purely additive — `navy`, `brand`, `zinc`, `graphite`, `verify`, `sky`, `canvas`,
`surface`, `well`, `hairline*` and the dashboard's `ink`/`sand`/`mint`/`ember` are all unchanged,
so no V1 page and no dashboard page shifted.
Type/utilities: `frontend/src/index.css` — new `.vx-display-xl` (hero, `clamp(2.5rem, 6.2vw,
5.75rem)`; the 92px ceiling is set by the longest line the page contains so headlines stay two
lines), `.vx-h2-xl`, `.vx-mono` (IBM Plex Mono + tabular figures — reserved for extracted values,
never headlines or body), `.vx-sheet`/`.vx-sheet-dark` (ruled paper), `.vx-dark`,
`.vx-cta`/`.vx-cta-invert`/`.vx-link-action`, `.vx-index`; new keyframes `vx-rail-flow`,
`vx-rail-flow-v`, `vx-scan`, `vx-float-y` with `.vx-rail`/`.vx-rail-v`/`.vx-scan-line`/
`.vx-float-y`. All V1 `.vx-*` classes left in place.
Motion: unchanged contract (`components/public/motion.jsx`, expo-out, 40px, 0.8s, 0.1s stagger).
Three CSS loops on the marketing page — the hero sheets' float, the two scan bands, the rail
dashes — all inside `.vx-page`, so the existing `prefers-reduced-motion` kill switch in
`index.css` disables them, and every Framer entrance additionally checks `useReducedMotion()`.
Notes: `primitives.jsx` (the V1 additive primitive layer) is still unimported by anything — V2
sections compose from `ledger.jsx` instead. It is now dead code and can be deleted once nothing
plans to migrate the secondary pages onto it.

### Public design system — V1 (light-first, auth + upload surface)
Status: ⚠️ Partial — still the system for `/login`, `/signup`, `/client-portal/login`,
`/upload/:token`, `/upload/:token/status`. Superseded by V2 on the marketing surface. The
secondary marketing pages' bodies remain on the pre-V1 shell (see below).
Docs: `frontend/DESIGN_SYSTEM.md` — supersedes its own previous (dark-canvas) version. Palette with
hex values, type scale, spacing rhythm, borders/radius/shadows, layout primitives, animation
contract, migration status, logo rationale.
Tokens: `frontend/tailwind.config.js` — `canvas #F7F6F2`, `surface #FFFFFF`, `well #F0EEE7`,
`hairline #E5E3DD`, `hairline-strong #D6D2C6`; `zinc` ramp retuned in place to the three text
tones for a light background (`zinc-100 #111827` headings, `zinc-400 #5F6675` body, `zinc-600`
lightest/muted); new `brand` scale retuned to the V1 violet accent (`brand-500 #6657D9`, 900/950
kept at their pre-V1 values per the brief); new `graphite` scale (same hex ladder as `zinc`, used
by the new primitives + `DemoRequestForm`'s previously-dormant `tone="light"` branch); new `navy`
scale for dark-contrast sections (`navy-800 #11182D`); new `sky` scale for the secondary muted-blue
accent (`sky-500 #4D8DFF`). `indigo-400/500/600 #818CF8/#6366F1/#4F46E5` deliberately left
unchanged — shared with the authenticated dashboard (`DashboardPage`, `TeamPage`, `ExportPage`,
etc.), so retuning it would have silently changed dashboard UI.
Type/utilities: `frontend/src/index.css` — same `.vx-*` classes as before; `.vx-mockup`'s shadow
retuned from a black+indigo glow to a restrained navy-tinted contact shadow (no colour bloom on a
light surface); `brandGlow` retuned to the violet accent and reduced from a bloom to a tight CTA
contact shadow.
Primitives: `frontend/src/components/marketing/primitives.jsx` (new) — `MarketingContainer`,
`Section`, `SectionHeader`, `SplitSection`, `ProductShowcase`, `Eyebrow`, `PrimaryButton`,
`SecondaryButton`, `Metric`, `ProductFrame`. Deliberately no feature-card-grid primitive. Additive
only — nothing imports these yet.
Motion: `frontend/src/components/public/motion.jsx` — unchanged from the dark pass (single
expo-out curve, `REVEAL_Y = 40`, `REVEAL_DURATION = 0.8`, 0.1s stagger, full `prefers-reduced-motion`
support).
Image assets: `frontend/public/images/{documents,photography,editorial}/` and
`frontend/public/product/{document-processing,reconciliation,classification,gst,tally,dashboard,
whatsapp}/` — directory structure + READMEs documenting intended contents only, no assets
populated.
Notes: `components/layout/PublicLayout.jsx` was `@deprecated` here; as of 2026-08-09 it has been
replaced by a thin `LandingNav`/`LandingFooter` wrapper — see "Secondary marketing pages" above.
`.hero-gradient`, `.orb*`,
`.gradient-text`/`.gradient-text-accent`, `pulse-glow`/`shimmer`/`gradient-shift`/`spin-slow`
remain in `index.css` (still used by the unmigrated pages) — do not delete until `/features`,
`/pricing`, `/about`, `/security`, `/404` move onto the primitives above. `.hover-lift`/
`.card-shine` are NOT deprecated despite the similar naming — shared with the dashboard's
`StatCard.jsx`.

### Brand mark (chevron lockup)
Status: ⚠️ Partial → ✅ Production Ready (fixed 2026-09-21)
Frontend: `components/brand/VeraxLogo.jsx` (exports `VeraxLogo` + `VeraxMark`, default `tone="dark"`
for the ivory/white V1 canvas), `public/verax-logo.svg`, `public/verax-icon.svg`,
`public/favicon.svg` — all three regenerated to match.
Notes: Two overlapping angular chevrons; the overlap is drawn as an explicit clipped third path
rather than `mix-blend-mode`. `VeraxMark` takes a `tone` prop (`dark` = navy right chevron for the
ivory canvas, `light` = light right chevron for a navy contrast section). **Fixed 2026-09-21:** the
three static `public/*.svg` files still encoded the pre-V1 dark-canvas coloring (`#6366F1`/`#F2F2F3`,
the old indigo/near-white pair) — `verax-icon.svg` and `verax-logo.svg` are now `#6657D9`
(brand violet) / `#111827` (dark navy), matching `VeraxMark`'s `tone="dark"` default exactly;
`favicon.svg` keeps its own dark rounded chip background (independent of page background, since a
favicon renders on browser tab chrome) but its chevrons now use `#6657D9`/`#F7F6F2` to match
`tone="light"`, which is what a light-on-dark chevron pairing requires. Verified by rendering all
three side by side against the V1 canvas colour.

### Landing page (`/`) — rebuilt on V2, 2026-08-09
Status: ✅ Production Ready
Frontend: `pages/HomePage.jsx` — rewritten as composition only (~140 lines: hero + eleven imported
sections). Every section owns its own markup, copy and motion, so no section can grow into the
others. Order: hero (`DocumentFlowVisual`) → `ProofBand` → `ProblemSection` →
`TransformationSection` → `DocumentTypes` → `VeraxEngine` → `DocumentDecode` →
`ReviewExperience` → `ClientWorkflow` → `TallySection` → `Outcomes` → `ClosingCTA`.
Section components (all new, `components/marketing/`):
- `ledger.jsx` — the shared atoms (Sheet/Field/Tick/Caret/Rail/FlowRail/Eyebrow/SectionHead/Section).
- `DocumentFlowVisual.jsx` — the hero: a drifting pile of six mismatched sheets → a carbon Verax
  slab with a scan band → a ledger of validated fields. HTML/CSS/SVG, no images, no canvas.
- `ProblemSection.jsx` — the manual eight-step loop with three ghosted repeats stacked behind it.
- `TransformationSection.jsx` — 216-cell field resolving to ticks and nine amber carets; the split
  is **explicitly labelled illustrative**, since nothing in the repo measures a real document mix.
- `DocumentTypes.jsx` — four document types, each with its own drawing (captured invoice, txn run,
  spreadsheet grid, two-column reconciliation) rather than a shared icon card.
- `VeraxEngine.jsx` — the six stages on near-black, each naming what it actually produces.
- `DocumentDecode.jsx` — the signature visual: a drawn invoice whose capture brackets render
  *around the real field elements* (so they stay aligned at any width) → `structured_data` →
  the compliance checks.
- `ReviewExperience.jsx` — the only place real product UI appears, reusing the existing live
  `mockups/ReviewMockup` as evidence rather than as the site's identity.
- `ClientWorkflow.jsx`, `TallySection.jsx` (real `tally-xml.service.js` tag shapes, figures
  reconciling with the rest of the page), `Outcomes.jsx`, `ClosingCTA.jsx`, `ProofBand.jsx`.
Chrome: `LandingNav.jsx` (retuned to `carbon`; nav items now How it works / Documents / Security /
Pricing — every one resolves to a real anchor or route, replacing the Solutions/Resources
placeholders), `LandingFooter.jsx` (rebuilt: Product / Company / Get started columns, all links
real). `DemoRequestForm.jsx` gained a third `tone="onDark"` variant for the closing CTA — the two
pre-existing tones are both light-ground and failed contrast on carbon.
Removed deliberately: the fabricated "Trusted by CA firms across India" avatar row and city
trust-bar (implied customers that don't exist) — replaced by `ProofBand`, which says the product
is in its founding-customer phase and lists verifiable capabilities instead. The WhatsApp roadmap
section was also dropped from the homepage; the feature is still unbuilt.
Notes: The demo CTA still posts to the existing public `POST /api/waitlist/join`, Gmail addresses
only — no API change was made for the redesign. Footer "Privacy"/"Terms" still render as plain
text because those routes still don't exist.
Dead code (verified by grep, 2026-08-09 — zero importers each): `HeroVisual.jsx` (already unused
before this pass), and, as a result of the `HomePage` rewrite, `WorkflowStrip.jsx`,
`FlowSteps.jsx`, `primitives.jsx`, `mockups/LedgerMockup.jsx`, `mockups/ReconMockup.jsx` and
`mockups/PortalMockup.jsx`. All are safe to delete; they were left in place rather than removed in
the same pass as the redesign so the deletion is a reviewable change on its own. Still live:
`mockups/ReviewMockup.jsx` (its one consumer is now `ReviewExperience`) and
`mockups/InvoiceDocument.jsx` + `mockups/MockupFrame.jsx`, which it depends on.

### Secondary marketing pages (`/features`, `/pricing`, `/about`, `/security`)
Status: ⚠️ Partial → ✅ Production Ready (migrated to V2 + content-fixed, 2026-09-21)
Frontend: `components/layout/PublicLayout.jsx` (unchanged this pass, already V2 chrome — `LandingNav` +
`children` + `LandingFooter`). All four page bodies rewritten onto the V2 "Ledger" system:
`ledger.jsx`'s `Section`/`SectionHead`/`Eyebrow`/`Field`/`Tick`/`Caret`/`Rail`, the `carbon`/`canvas`/
`surface`/`well`/`hairline`/`verify` token set, and `ClosingCTA` reused as every page's closing
section (previously ad hoc per-page gradient CTAs).
Notes: **Design debt closed 2026-09-21** — bodies no longer use the pre-V1 `sand`/`ink`/`mint`
palette, `.hero-gradient`, `.orb*`, or icon-in-tinted-chip grids (ledger.jsx's system deliberately
has no icon-chip primitive); all four now read as the same design language as `/`. Verified by
screenshotting all four pages in a real browser (Playwright against the Vite dev server), including
confirming the scroll-triggered `Reveal` animations were the only reason a naive full-page screenshot
showed blank sections — content renders correctly once in view. The deprecated CSS
(`.hero-gradient`, `.orb*`, `.gradient-text*`, `pulse-glow`/`shimmer`/`gradient-shift`/`spin-slow`)
in `index.css` is now dead and can be deleted (not done in this pass, to keep the diff reviewable).
**Two real content problems were found and fixed in the same pass, not just cosmetic ones:**
(1) `/about` had a fully fabricated founding team (three invented names/bios/initials), a fabricated
company timeline ("Founded in Pune 2022... 500+ firms by 2025"), and fabricated growth metrics
("500+ CA firms onboarded", "10,000+ documents processed monthly", "99.5% OCR accuracy") — the exact
class of fake social proof the homepage's own V2 redesign explicitly stripped out elsewhere (see
`ProofBand`'s "founding-customer phase" copy) but which nobody had touched on this page. Removed
entirely per explicit user direction; the team section now credits the real founder (Pranav Vatsa)
with no invented backstory, and the page reuses `ProofBand` instead of the fake stats card.
(2) `/pricing` advertised real ₹ billing, a monthly/annual toggle, "Start 14-day trial", and a FAQ
answer claiming Razorpay payment support — none of which exist anywhere in the codebase (`plan` is
a display-only field with no checkout, trial logic, or payment integration). Rewritten per explicit
user direction to "early access" framing: Starter (genuinely free, real signup) keeps its
`/signup` CTA; Professional/Enterprise CTAs now say "Join early access"/"Talk to us" and point at
the same waitlist-backed `ClosingCTA` form the rest of the site uses; the Razorpay FAQ answer was
replaced with an honest one about what early access means.

### Marketing bundle size (route-level code splitting)
Status: ✅ Production Ready — added 2026-08-09
Frontend: `src/App.jsx` — the sixteen authenticated pages (eleven dashboard + five client-portal)
are now `React.lazy`; public/marketing pages stay eager so the homepage paints without a second
request. `<Suspense>` wraps `<Routes>` with a near-empty `RouteFallback` (`min-h-screen`,
`role="status"`) so a fast connection never flashes a spinner between click and page.
Effect: main bundle 728 kB → 545 kB (gzip 203 kB → 160 kB); `ReviewPage`, `ClientDetailPage`,
`ExportPage`, `AppShell` etc. now load only behind a login.
Notes: No routing, guard or auth behaviour changed — `ProtectedRoute`/`ProtectedClientRoute` and
the `ClientPortalAuthProvider` branch are untouched.

### Product mockups (no screenshots, no stock imagery)
Status: ✅ Production Ready (V1 retheme complete; architecture unchanged)
Frontend: `components/marketing/mockups/` — `MockupFrame.jsx` (shared shell, top bar, label,
row-stagger hook, confidence bar), `ReviewMockup.jsx`, `LedgerMockup.jsx`, `ReconMockup.jsx`,
`PortalMockup.jsx`. All HTML/CSS/SVG.
Notes: Each mockup is authored at a fixed design size and scaled to its container by a
`ResizeObserver` in `ScaledFrame` — unchanged, not rebuilt for V1 per instruction. What changed:
literal `bg-white/[0.0x]` row/card fills (invisible on a light surface) moved to `bg-black/[0.0x]`,
and status/confidence text that was a light tint for dark-canvas legibility (`indigo-300`,
`verify-300`, `amber-300`, `red-300`) moved to `-700` shades so it stays readable on their pale
translucent chip backgrounds. `public/product/` now exists for eventually supplementing/replacing
these with real screenshots — see the image-asset note above.

### Auth pages (V1, light-first)
Status: ✅ Production Ready
Frontend: `pages/LoginPage.jsx`, `pages/SignupPage.jsx`, `pages/ClientPortalLoginPage.jsx`,
`components/public/AuthSplitLayout.jsx`, `components/public/FloatingField.jsx`.
Notes: Presentation only — no validation, submit, or session logic was touched. The form column is
now the light canvas; the brand column (desktop only) is the `navy-800` dark-contrast background
(not a `canvas`/`surface` gradient, which would have gone light and made its white text
illegible) with its two blurred accent-colour orbs removed — the V1 brief rules those out
explicitly, and the panel didn't need them once it had a real dark background of its own.

### Magic-link upload pages
Status: ⚠️ Partial → ✅ Production Ready (fixed 2026-09-21)
Frontend: `pages/PublicUploadPage.jsx`, `pages/PublicUploadStatusPage.jsx`.
Notes: These pages render on the light canvas via their shared `PublicPageShell` (`hairline`/`zinc`/
`indigo` tokens all retuned for V1). **Fixed 2026-09-21:** both files still had literal
`bg-white/[0.02]`–`bg-white/[0.12]` decorative fills/borders left over from a dark-canvas design —
on the light V1 canvas these were nearly invisible (a white-tinted wash on a near-white background),
affecting the dropzone hover state, the empty-queue box, per-file queue item cards, progress-bar
tracks, status badges, and the loading skeleton. Replaced with the existing V1 tokens the rest of
the public surface already uses (`bg-well` for recessed fills, `bg-hairline-strong` for visible
progress-track/skeleton fills, `border-hairline` for borders) — the same fix pattern already applied
to the mockups per the "Product mockups" entry above. Verified in a real browser: the previously
invisible info box on the invalid-link error state is now a clearly visible tan/beige recessed panel
against the white card. Upload queue, progress, validation and polling logic are untouched.

---

## ROLE PERMISSIONS

### requireAdmin on all admin-only routes
Status: ✅ Production Ready
Backend: `requireAdmin` (`middlewares/auth.middleware.js:39-47`) confirmed applied correctly across all route files, including `POST /api/compliance/gstr2b/match` as of the 2026-08-08 fix (see Compliance & Validation section).

### Staff can upload, view, edit fields
Status: ✅ Production Ready
Confirmed: upload routes, extraction GET/PUT all require only `requireAuth`, not `requireAdmin`

### Staff cannot approve, export, delete, manage team
Status: ✅ Production Ready
Confirmed: approve, reprocess, all export routes, client/document delete, user invite/remove, scheduled-request mutations all require `requireAdmin` both backend and frontend (button-level gating)

### Frontend hides admin-only elements for staff
Status: ⚠️ Partial → ✅ Production Ready (fixed 2026-09-21)
Frontend: confirmed correct on ReviewPage (Approve/Reprocess), ExportPage (Generate panel), TeamPage (invite/remove), AuditLogPage (whole page), SettingsPage (edit form still admin-gated, read-only plan/name view added for staff)
Notes: See "Plan field support" above — staff previously couldn't see the plan badge at all (over-hiding, the inverse of the intended gate). Fixed alongside that entry.

### Permissions reference table in settings
Status: ✅ Production Ready
Frontend: `SettingsPage.jsx:291-330`, admin-only, purely informational checkmark table (`AccessMark`) — documents behavior enforced elsewhere, doesn't enforce anything itself

---

## STANDALONE TOOLS

### Register cleaner (Excel → cleaned xlsx)
Status: ✅ Production Ready
AI Service: `ai-service/app/services/register_cleaner_service.py` (559 lines) — header-row detection via keyword scoring, multi-block extraction per sheet, per-block cleaning, cross-block column-name unification, styled xlsx output with SUM formulas. Entry point `process_bytes()` (`:526-559`)
Backend: `POST /api/tools/register-clean` — `tools.routes.js`, `requireAuth` + `toolsRateLimiter` (added 2026-08-08), proxies to AI service, streams xlsx back
Frontend: `pages/ToolsPage.jsx` — `.xlsx`/`.xls` extension check, blob download via `lib/api-client.js`'s `request()` with `responseType: "blob"` (as of 2026-08-08)

### Bank statement PDF → Tally XML
Status: ✅ Production Ready (all sub-items confirmed implemented)
AI Service: `ai-service/app/services/bank_statement_xml_service.py` (484 lines)
- **Digital PDF path (pdfplumber)**: `_extract_tables_from_pdf` (`:142-156`)
- **Scanned PDF path (OCR fallback)**: `is_scanned_pdf` heuristic (`:130-139`) → `pdf2image` → PaddleOCR with Tesseract fallback (`_ocr_scanned_pdf_text`, `:306-333`)
- **Dynamic column detection**: `_try_detect_columns`/`detect_columns` (`:159-188`), keyword-matched against date/narration/debit/credit/balance headers
- **Debit/credit conflict resolution**: `_standardize` (`:248-263`) keeps the larger value, zeroes the other, appends a warning
- **Footer row filtering**: `SKIP_NARRATIONS` list (`:40-52`) + `should_skip_row`/`_is_summary_narration` (`:103-105,297-303`)
- **Password protected PDF → 422 error**: `_open_pdf` (`:108-118`) catches the exception, inspects for "password"/"encrypted", raises `HTTPException(422, ...)`
- **Structured JSON response with warnings**: `process_bytes()` (`:454-483`) returns `{xml, voucherCount, skippedRows, warnings, isScanned}`
Backend: `POST /api/tools/bank-statement-xml` — `tools.routes.js`, `requireAuth` + `toolsRateLimiter` (added 2026-08-08)
Frontend: `ToolsPage.jsx` — PDF-only check, company-name/bank-ledger inputs, surfaces `warnings`/`skippedRows`/`voucherCount`, now calls `request()` instead of raw `fetch()` (as of 2026-08-08)
Notes: Both tools have smoke-test coverage (`tests/test-bank-statement.js`, `tests/test-excel-to-xml.js` at repo root). **Fixed 2026-08-08** — both former gaps are closed: (1) `tools.routes.js` now applies a `toolsRateLimiter` (1hr window, max 20) to both routes; (2) `ToolsPage.jsx` no longer uses raw `fetch()` — both calls go through `lib/api-client.js`'s `request()`, which now supports a `responseType: "blob"` option (added specifically for the binary register-clean response) alongside its existing JSON handling (used as-is for the bank-statement-xml JSON response), so both tool calls now get the same 401-refresh-retry behavior as the rest of the app.

---

## EMAIL

### Email service module (smtp + resend)
Status: ✅ Production Ready
Backend: `backend/src/services/email.service.js` — provider selected via `env.EMAIL_PROVIDER` (`smtp` default | `resend`), `sendWithResend` (`:18-27`), `sendWithSmtp` (`:29-47`), dev-mode no-op preview when unconfigured outside production (`:54-58`), never throws to caller (`:72-80`)

### Password reset email
Status: ✅ Production Ready
Backend: `auth.service.js:225-233` → audit `password_reset_emailed` (`:236-249`)

### Client magic link email
Status: ✅ Production Ready
Backend: `clients.service.js:407-417` → audit `client_magic_link_emailed` (`:419-431`)

### User invite email
Status: ✅ Production Ready (confirmed 2026-09-21)
Backend: `users.service.js` → audit `user_invited` + `user_invite_emailed` (the latter captures `sent`/`provider`/`error`)
Notes: Sends correctly and the audit row already captures delivery status, matching the other 3 email flows — this entry's previous "Partial" status was stale.

### Document ready for review email
Status: ✅ Production Ready
Backend: `document-processing.worker.js:104-115` → audit `document_ready_emailed` via `recordDocumentReadyEmailAudit` (`document-processing.service.js:236-253`), sent to every admin in the firm

### Email audit logs
Status: ✅ Production Ready (confirmed 2026-09-21)
Backend: All 4 email call sites (password reset, magic link, document ready/failed, user invite) record `sent`/`provider`/`error` in their audit row

### Request Demo — lead capture, persistence, and notification
Status: ✅ Production Ready
Backend: `POST /api/waitlist/join` — `waitlist.routes.js` (`firmName`/`contactName`/`phone` added as optional Joi fields, kept optional so the plain "Join Waitlist" entry points still work with email only) → `addToWaitlist` (`waitlist.service.js`) upserts into `waitlist` (new nullable `firm_name`/`contact_name`/`phone`/`status` columns, migration `20260809000000_add_lead_fields_to_waitlist.js`), then calls the existing `email.service.js` `sendEmail` twice: internal notification to `env.DEMO_NOTIFICATION_EMAIL` (default `verax.hello@gmail.com`) via `demoRequest.template.js`, and a requester confirmation via `demoRequestConfirmation.template.js`. Failures are logged (`console.error`, no secrets) and don't roll back the already-persisted lead.
Frontend: `DemoRequestForm.jsx` — two-step reveal (email, then firm name + contact name) so the landing page keeps its original single-field look until someone commits to requesting a demo; posts via new `frontend/src/api/waitlist-api.js`. `WaitlistForm.jsx` (AboutPage, plain email-only join) intentionally untouched — same endpoint, new fields simply omitted.
Notes: 🔧 Fixed — previously only collected an email, saved it to `waitlist`, and never sent any email at all (`waitlist.service.js` had zero reference to `email.service.js`), so `verax.hello@gmail.com` never received leads and a CA firm was represented only by an anonymous address. Verified end-to-end against the running dev backend: lead persisted with all 4 fields, both emails returned `{sent:true, provider:"smtp"}` from the real configured SMTP credentials.

### Request Demo / Waitlist — email domain restriction removed
Status: ✅ Production Ready
Backend: `waitlist.routes.js` Joi schema now just `Joi.string().email().required()`; `waitlist.service.js`'s duplicate `@gmail.com` check removed. Any well-formed address is accepted (Gmail, Outlook, company domains, `.in`, `.co.in`, etc.); malformed addresses still rejected with a 400.
Frontend: `DemoRequestForm.jsx` and `WaitlistForm.jsx` both replaced their `.endsWith("@gmail.com")` gate with a generic `EMAIL_PATTERN` regex check and dropped the "Gmail addresses only" hint/placeholder text, so client-side behavior matches the backend.
Notes: 🔧 Fixed — the Gmail-only restriction (both the Joi `.custom()` validator and a duplicate check in the service, plus matching client-side gates in both forms) rejected real CA-firm leads using company-domain emails, which is most of them. Verified via direct Joi-schema validation (8 cases: gmail/company/`.in`/`.co.in`/outlook accepted, 3 malformed variants rejected) and live `POST /api/waitlist/join` calls for gmail/company-domain/`.co.in`, all persisted correctly with `notificationSent`/`confirmationSent` both `true`. No test framework exists in this repo (no Jest/Mocha/test scripts) — verification was ad hoc (schema + live HTTP checks) rather than a committed test suite.

---

## SECURITY & PLATFORM

### PostgreSQL RLS on all tenant tables
Status: 🔧 Needs Fix → ✅ Production Ready (fixed 2026-09-20)
Migration: confirmed across all 13 migrations — every tenant-scoped table (`firms`, `users`, `clients`, `documents`, `extractions`, `tally_exports`, `audit_logs`, `refresh_tokens`, `document_upload_sessions`, `item_name_mappings`, `password_reset_tokens`, `notifications`, `document_versions`, `scheduled_requests`) has RLS enabled and (after the `item_name_mappings` fix) forced. `waitlist` intentionally has no RLS (pre-auth public signup table, no `firm_id`).
Notes: **Critical bug found and fixed 2026-09-20, verified against a live Postgres.** The RLS policies themselves were always correct, but Postgres never applies Row Level Security to a superuser, regardless of `FORCE ROW LEVEL SECURITY`. In the self-hosted `docker-compose`/`docker-compose.prod.yml` deployment path, the app's `DATABASE_URL` connects as the official `postgres` image's bootstrap role (`POSTGRES_USER`) — which the image creates as a Postgres superuser. This meant every RLS policy was silently bypassed for that deployment path: verified empirically (inserted two firms' documents, set `app.current_firm_id` to firm A, queried as the bootstrap role — both firms' documents came back). A non-superuser role querying the same data with the same session var correctly saw only firm A's row, confirming the policies were never the problem. Fix: new migration `20260825000000_create_least_privilege_app_role.js` creates a `NOSUPERUSER` `ca_app` role with scoped grants (+ `ALTER DEFAULT PRIVILEGES` so future tables auto-grant to it); `backend/src/config/env.js`/`src/db/pool.js` add an `APP_DATABASE_URL` the runtime pool prefers over `DATABASE_URL` (migrations keep using `DATABASE_URL`, which needs DDL rights `ca_app` intentionally lacks); `ai-service/app/config.py`/`persistence_service.py` mirror this for the ai-service's own write-back connection. `docker-compose.yml`/`docker-compose.prod.yml` wire `APP_DATABASE_URL` for `backend`/`worker`/`ai-service`. Render's managed Postgres already provisions a non-superuser connection role by default, so this bug did not affect the Render deployment path — only self-hosted docker-compose. New regression test: `backend/tests/integration/rls.test.js` (6 cases) runs against a real Postgres via the `ca_app` role and asserts cross-firm isolation, fail-closed behavior with no tenant context set, and rejection of a cross-tenant `INSERT`; confirmed this test fails hard (all 6 cases) when run against the pre-fix superuser configuration, and passes clean with the fix.
Notes (pre-existing): `waitlist.service.js` uses raw `pool.query` directly rather than `withTenantTransaction` (`:1,14`) — correct given it has no tenant scope, but is the one clear exception to the "always wrap DB access" convention and should be documented as intentional so it isn't "fixed" by mistake later.

### RLS startup guard against a misconfigured superuser role
Status: ✅ Production Ready
Backend: `backend/src/db/assert-safe-role.js` (new) — `assertRuntimeRoleIsNotSuperuser()` queries `SELECT usesuper FROM pg_user WHERE usename = current_user` and throws a detailed error (referencing the `ca_app` migration) if the runtime connection is a superuser. Called at the top of `server.js`'s `startServer()` right after the initial `SELECT 1` connectivity check, and in `document-processing.worker.js` / `scheduled-requests.job.js` before either BullMQ `Worker` starts processing jobs (both workers now use `autorun: false` and are started explicitly, in parallel, only after the guard passes).
Notes: Added 2026-09-21. The `ca_app` least-privilege role (see "PostgreSQL RLS on all tenant tables" above) fixes the superuser-bypasses-RLS bug for anyone who deploys it correctly — but nothing previously stopped the app from booting anyway if `APP_DATABASE_URL` were left unset or pointed back at a superuser role (a plausible operator mistake, and exactly the failure mode the original bug shipped in). Now the process refuses to start and exits non-zero with a clear error instead of silently running with RLS disabled. Verified against a real local Postgres 16 with both roles: server and worker both boot cleanly as `ca_app`, and both fail loudly (exit 1) as the `postgres` superuser.

### Client-portal RLS database backstop
Status: ✅ Production Ready
Migration: `20260921000000_client_portal_rls_backstop.js` — tightens `documents_isolation_policy` / `extractions_isolation_policy` / `tally_exports_isolation_policy` to add `AND (app.current_client_id() IS NULL OR client_id = app.current_client_id())` (or the equivalent `EXISTS` join through `documents` for `extractions`).
Notes: Added 2026-09-21. Application code already scoped client-portal queries to the logged-in client, but the RLS policy itself only enforced firm-level isolation — nothing in the database stopped a client-portal session from reading a *sibling* client's documents within the same firm if a route ever queried without an explicit `client_id` filter (the same class of bug the superuser fix above targets: a correct policy for one dimension of isolation, with no database-level backstop for another). Firm/staff sessions (no `current_client_id` set) are unaffected. Covered by a new `describeIfDb` block in `backend/tests/integration/rls.test.js` (5 cases) — confirmed these tests fail (leak sibling client's data) when the migration is rolled back, and pass when reapplied.

### Helmet security headers
Status: ✅ Production Ready
Backend: `app.js:27` `helmet()` applied globally, `x-powered-by` disabled (`:26`)

### CORS restricted to frontend URL
Status: ✅ Production Ready
Backend: `app.js:28-33` — `origin: env.FRONTEND_URL` (single origin, not wildcard), `credentials: true`

### Auth rate limiting
Status: ✅ Production Ready
Backend: `auth.routes.js:23-33` — 15 min window, max 10, applied to all 8 auth endpoints

### Upload rate limiting
Status: ✅ Production Ready
Backend: `documents.routes.js:24-34` and `public-upload.routes.js:19-29` — 1 hr window, max 50, applied to both authenticated and magic-link upload/confirm endpoints
Notes: `waitlist.routes.js` has its own 1hr/5 limiter. `/api/tools/*` now has its own 1hr/20 `toolsRateLimiter` as of 2026-08-08 (see Standalone Tools).

### Rate limiting on remaining authenticated endpoints
Status: 🔧 Needs Fix → ✅ Production Ready (fixed 2026-09-20)
Backend: new shared `src/middlewares/rate-limit.middleware.js` (`standardApiLimiter`, 300 req/15min, keyed on `firmId` when authenticated else IP) applied via `router.use(standardApiLimiter)` to `exports.routes.js`, `extractions.routes.js`, `compliance.routes.js`, `clients.routes.js`, `narration-mappings.routes.js`, `scheduled-requests.routes.js`
Notes: These six route files had `requireAuth` but no rate limiter at all — a compromised or leaked JWT could hammer exports/compliance endpoints with no throttle, unlike auth/uploads/waitlist/tools which were already covered.

### HttpOnly refresh cookies
Status: ✅ Production Ready
Backend: `auth.service.js:32-38` `getRefreshCookieOptions` — `httpOnly: true`, `secure: env.NODE_ENV === 'production'`, `sameSite: 'strict'`, scoped `path: '/api/auth'`

### Access token in memory only (frontend)
Status: ✅ Production Ready
Frontend: `lib/token-store.js:1-27` — access token and user object kept in module-scope JS variables only, never written to localStorage/sessionStorage; a hard page refresh relies on `AuthContext.bootstrap()` (`AuthContext.jsx:18-31`) hitting `/api/auth/refresh` via the httpOnly cookie

### Frontend crash recovery (error boundary)
Status: ❌ Not Built → ✅ Production Ready (added 2026-09-20)
Frontend: `components/ErrorBoundary.jsx` wraps `<App />` in `main.jsx` — a render-time exception anywhere in the tree now shows a recovery screen with a reload button instead of a blank white page.
Notes: No error boundary existed anywhere in the app before this (confirmed by grep across `src/`); a malformed API payload hitting e.g. `.map()` on `undefined` would previously white-screen the whole SPA with no recovery path.

### Frontend reliability fixes (download failures, duplicated waitlist logic, stale copy)
Status: 🔧 Needs Fix → ✅ Production Ready (fixed 2026-09-20)
Frontend: `lib/utils.js` `triggerFileDownload` now `await`s the fetch, throws on a non-OK response, and every call site (`ExportPage.jsx` x3, `ClientDetailPage.jsx`, `ClientPortalDocumentsPage.jsx`) either already had or now has a surrounding try/catch that surfaces the error to the user instead of failing silently. `components/ui/WaitlistForm.jsx` previously called `fetch` directly against `/api/waitlist/join`, bypassing the shared `api/waitlist-api.js` module that `DemoRequestForm.jsx` uses and dropping the `firmName`/`contactName`/`phone` fields it supports — now uses `waitlistApi.join`. `pages/SecurityPage.jsx` claimed "Password reset requires re-registration (email-based flow coming soon)" despite the full email-based reset flow being built and working (see AUTH → Password reset) — corrected.
Notes: None of these were fake-feature gaps — the download flow and password reset both actually worked; this was silent-failure/stale-copy/duplication cleanup found during a production-readiness pass.

### CI/CD pipeline
Status: ❌ Not Built → ✅ Production Ready (added 2026-09-20)
Infra: `.github/workflows/ci.yml` — four jobs on every PR/push to `main`: `backend` (install + JS syntax check + `npm test` unit suite), `backend-integration` (spins up a real `postgres:15` service container, runs migrations, runs the integration suite), `frontend` (`npm ci && npm test && npm run build` — the Vitest suite now runs before the build, added 2026-09-21), `ai-service` (syntax check via `compileall` + a light-dependency `pytest` run, without installing the heavy paddleocr/paddlepaddle stack).
Notes: No CI existed at all before this (no `.github/workflows` directory). Deliberately scoped as a baseline quality gate rather than full coverage — see "Automated test suites" below for what is and isn't covered, and `ai-service/requirements-dev.txt`'s comment for why OCR-engine code only gets a syntax check, not a real test run, in CI. All four jobs reverified green end-to-end, 2026-09-22, after the dependency-security pass below (each fix was reproduced against a clean environment matching CI before being accepted — not just "passed locally").

### Dependency security audit
Status: ✅ Production Ready (added 2026-09-22)
Backend: `npm audit` found 13 vulnerabilities. `npm audit fix` (non-breaking) resolved most; `express` bumped `4.21.2` → `4.22.3` (same major, resolves a `qs` DoS chain via `body-parser`/`express`'s own `qs` dependency without touching Express 5's breaking changes); `nodemailer` force-bumped `8.0.7` → `10.0.10` after confirming the app's actual usage (`email.service.js`) only touches `createTransport`/`sendMail`, both stable across the major bumps. The one remaining unpatched item — `uuid` (via `exceljs`'s buffer-bounds-check advisory) — was deliberately left: the only available fix (`npm audit fix --force`) would downgrade `exceljs` to `3.4.0`, a real regression for the XLSX-parsing feature this same pass depends on (see Bulk client import above); `express` 5's migration was also declined as out of scope for this pass (large blast radius, needs its own dedicated project, not a security-driven change). Verified: all 73 backend unit + 19 integration tests pass after every dependency change, run against a live Postgres in a clean-env shell (`env -i` with only CI's placeholder vars) matching the CI runner, not just the local sandbox's `.env`-assisted shell.
Frontend: `npm audit` found 10 vulnerabilities; `npm audit fix` resolved 8 (babel, browserslist, postcss, postcss-selector-parser, nanoid, vite, baseline-browser-mapping). The remaining one (`react-router-dom` open-redirect/SSR-hydration advisory) required the `6.x` → `7.18.4` major bump — applied after grepping the entire `frontend/src/` tree and confirming only the stable classic-router API is used anywhere (`BrowserRouter`/`Routes`/`Route`/`Link`/`NavLink`/`Navigate`/`Outlet`/`useNavigate`/`useLocation`/`useParams` — none of v7's breaking data-router APIs). `npm audit` now reports 0 vulnerabilities. Verified: all 47 frontend tests pass and `npm run build` produces a clean production bundle after the bump.
AI service: no prior dependency-vulnerability check had ever been run. `pip-audit -r requirements.txt` found 46 known vulnerabilities across 9 packages. Fixed (non-breaking, same-major or small patch bumps, each verified against `pip`'s full resolver with zero conflicts and the 27-case pytest suite re-run clean afterward): `setuptools` `75.6.0` → `83.0.0` (path-traversal advisories in the deprecated `package_index` downloader — not on this service's call path, free bump); `fastapi` `0.115.6` → `0.116.2`, which pulls a patched `starlette` (fixes PYSEC-2026-1941, a large-multipart-upload event-loop-blocking DoS — directly relevant since `/tools/register-clean` and `/tools/bank-statement-xml` both accept multipart `UploadFile`; the upload path was smoke-tested with a throwaway `TestClient` against the exact pinned combination before committing); `python-multipart` `0.0.9` → `0.0.32` (six CVEs in malformed-multipart-body handling); `python-dotenv` `1.0.1` → `1.2.2`; `pdfplumber` `0.11.4` → `0.11.9` (its hard `==` pin on `pdfminer.six` was the actual vulnerable package — two CVEs, `20231228` → `20251230`, fully patched). Left unfixed and documented as accepted risk: `paddlepaddle` (2 CVEs, only a `3.0.0b0` beta fix exists — forcing a beta ML framework into a production OCR pipeline pre-launch is worse than the risk); `imgaug` (transitive via `paddleocr`, used only for training-time data augmentation never exercised at inference time, no fix version published upstream at all); `opencv-python`/`opencv-contrib-python` `4.6.0.66` (hard-pinned by `paddleocr==2.7.3` itself via `<=4.6.0.66` — not controllable without patching or forking `paddleocr`; the service's own direct `opencv-python-headless==4.9.0.80` pin, used for all our actual preprocessing code, is unaffected); `starlette`'s remaining CVEs beyond PYSEC-2026-1941 all require a `1.x` major bump not yet supported by any `0.11x` FastAPI release — checked applicability directly against this codebase and confirmed none apply regardless of version (no `StaticFiles`/`FileResponse`/`StreamingResponse` anywhere in `app/`, no raw Starlette `HTTPEndpoint` classes, no host-header-based routing/redirect logic).
Notes: Discovering the fully undocumented `client-import.service.js` bulk-import feature (see above) during this audit — an actively-used file-upload attack surface running on an unpatched, unmaintained package with no upstream fix — is itself the argument for why this "thorough check everywhere" pass was warranted; a prior audit pass had claimed comprehensive coverage without ever finding it.

### Automated test suites
Status: ❌ Not Built → ⚠️ Partial (added 2026-09-20, expanded 2026-09-21 twice — backend/ai-service, then frontend; expanded again 2026-09-22 — backend gains client-import coverage)
Backend: Jest (`backend/package.json` `test`/`test:integration` scripts). Unit (`backend/tests/unit/`, DB-free, 73 cases): `compliance.service.test.js` (18), `tally-xml.service.test.js` (27, expanded with tax-math-balancing/sign-bug/no-transactions-fallback/XML-declaration coverage), `exports.service.test.js` (6 — the tax-math export block), `document-processing.service.test.js` (8 — the independent document-type-mismatch check), `client-import.service.test.js` (14 cases, new 2026-09-22 — CSV parsing/validation, and real ExcelJS-generated `.xlsx` fixtures covering the `xlsx`→`exceljs` rewrite: valid parse, blank-row dropping, numeric-cell stringification, corrupted-buffer friendly error). Integration (`backend/tests/integration/`, needs live Postgres, 19 cases): `rls.test.js` (11, includes the client-portal sibling-isolation block), `extraction-edit-lock.test.js` (3 — the reviewed/exported edit-lock regression guard), `refresh-token-reuse.test.js` (1 — proves the JWT reuse-detection rollback bug stays fixed by asserting the *rotated* token is also revoked, not just that the replay fails), `audit-logs-unknown-email.test.js` (4 — proves the unknown-email login blind spot is closed for both firm and client-portal logins, and that the RLS escape hatch can't be triggered outside its exact auth_context or read back by a firm-scoped session).
AI Service: pytest (`ai-service/tests/`, `requirements-dev.txt`, 27 cases). `test_json_parser.py` (8), `test_llm_service.py` (16, mocks the Groq client — covers the malformed-JSON degrade, retry/backoff, no-retry-on-4xx, and confidence-adjustment branches), `test_preprocess_service.py` (3 — the multi-page truncation regression guard), executed in CI (not just syntax-checked) via `opencv-python-headless`/`PyMuPDF` added to the CI install step.
Frontend: Vitest + React Testing Library (`frontend/package.json` `test`/`test:watch` scripts, `vitest.config.js`, jsdom environment), 47 cases across 6 files in `frontend/tests/unit/`: `lib-utils.test.js` (parseApiError/cn/formatDate/formatDateTime, and `triggerFileDownload` with a mocked `fetch`+`URL.createObjectURL`), `permissions.test.js` (`isAdmin`), `token-store.test.js` (the in-memory token/user singletons), `api-client.test.js` (11 cases — the highest-value target: Bearer token attachment, transparent 401→refresh→retry, concurrent-401 refresh de-duplication via the shared `refreshPromise`, session clearing + `unauthorizedHandler` invocation when refresh itself fails, `skipRefresh` preventing an infinite retry loop, FormData vs JSON body handling, blob/204 response handling), `ErrorBoundary.test.jsx` (crash recovery, including that the reload button actually calls `window.location.reload`), `StatusBadge.test.jsx` (status→label mapping). Wired into CI: the `frontend` job now runs `npm test` before `npm run build`. Reverified 2026-09-22 against `react-router-dom@7.18.4` (major bump, see "Dependency security audit" above) — all 47 still pass, build still clean.
Notes: This covers the highest-risk paths identified in a full-repo production-readiness audit across all three services (RLS tenant isolation incl. client-portal sibling isolation, GST/tax-math correctness incl. export-time blocking, Tally XML debit=credit correctness, approved-document edit locking, multi-page PDF truncation, JWT refresh-token reuse detection — both backend and the frontend's own transparent-refresh logic that depends on it working, unknown-email login audit logging, independent document-type verification, LLM JSON-parse/retry branching, and now the bulk-client-import CSV/XLSX parsing path) — 166 test cases total as of 2026-09-22 (92 backend [73 unit + 19 integration] + 27 ai-service + 47 frontend), all independently run and verified against real infrastructure (a live Postgres for backend integration tests, a real browser build for frontend) rather than written blind. It is deliberately not full coverage: no OCR-engine tests exist (`ocr_service.py` — would need the full heavy `paddleocr`/`paddlepaddle` install), most backend services/routes still have no test at all, and the frontend suite covers pure logic modules and two components rather than full page-level integration tests (e.g. nothing yet exercises `ReviewPage.jsx`'s warning banners or `ProtectedRoute.jsx`'s auth gating directly — both are still correct by manual verification and by what depends on them, just not test-covered). The three legacy scripts in the top-level `tests/` directory (`test-excel-to-xml.js`, `test-bank-statement.js`, `test-extraction-prompt.js`) are separate, older, manual smoke scripts and still not wired into CI since they need the full ai-service dependency install.

---

---

## LOCAL / DEPLOY ENVIRONMENT

*Added 2026-08-08 during a demo-prep verification pass. These are setup-and-packaging
defects rather than feature gaps, but each one independently prevented the app from
running at all on a clean machine, so they belong in this file.*

### Reproducible local bring-up from a clean checkout
Status: 🔧 Needs Fix → ✅ Production Ready (confirmed fixed 2026-09-21)
Notes: The five original gaps (no `.env`/missing `LOCAL_STORAGE` in `.env.example`, missing `seed:admin` script, unpinned/broken `paddlepaddle`/`setuptools`/`httpx` versions) were all fixed in earlier passes but this entry's status was never updated to reflect it. Reverified 2026-09-21: root `.env.example` documents `LOCAL_STORAGE=false` and now also `REVIEW_CONFIDENCE_THRESHOLD`/`SCHEDULED_REQUESTS_EMBEDDED` (added this pass); `backend/package.json`'s `seed:admin` script correctly points at `scripts/seed-demo.js` (which exists and was run end-to-end against a live Postgres in this pass — creates a demo firm, admin user, and two clients, prints working credentials, idempotent on re-run); `ai-service/requirements.txt`'s `paddlepaddle`/`setuptools`/`httpx` pins are unchanged from their earlier fix. No further gap found.

### docker-compose ai-service cannot read LOCAL_STORAGE uploads
Status: ✅ Production Ready
Notes: **Fixed 2026-08-08.** The backend writes uploads to a hardcoded `backend/local-storage/<key>` (`s3.service.js:28`), and the AI service reads `settings.local_storage_path + s3_key` (`s3_service.py:23-24`) — but `docker-compose.yml`'s `ai-service` block set **neither `LOCAL_STORAGE` nor `LOCAL_STORAGE_PATH`, and did not mount that directory**, so with `LOCAL_STORAGE=true` the containerised AI service could never see an uploaded file and every document failed. Added `LOCAL_STORAGE`, `LOCAL_STORAGE_PATH=/mnt/local-storage`, and a `./backend/local-storage:/mnt/local-storage` bind mount. Also pinned the container's `DATABASE_URL` to the compose-internal `postgres` hostname, since the root `.env` value points at `localhost` for the host-side backend/worker and would not resolve inside the container.

**Fixed 2026-09-11 (backend/worker side):** the `ai-service` block forwarded `LOCAL_STORAGE`/`LOCAL_STORAGE_PATH` correctly, but the `backend` and `worker` blocks in `docker-compose.yml` never set either var, so `env.js` defaulted `LOCAL_STORAGE` to `false` inside those containers and `createUploadUrl`/`local-upload.routes.js` (`app.js:26,77-78`, gated on `env.LOCAL_STORAGE`) never activated — uploads generated real S3 presigned URLs with no bucket/credentials configured, which nothing could serve. Added `LOCAL_STORAGE: ${LOCAL_STORAGE:-true}` and `LOCAL_STORAGE_PATH: ${LOCAL_STORAGE_PATH:-./local-storage}` to both the `backend` and `worker` `environment:` blocks, plus an explicit `./backend/local-storage:/app/local-storage` volume mount on both (redundant with the existing `./backend:/app` mount but kept for clarity). Verified: `docker compose up` on all five services, then `PUT /api/local-upload/<key>` wrote a file from inside `ca-backend` that appeared immediately on the host at `backend/local-storage/<key>` and was readable from inside `ca-ai-service` at `/mnt/local-storage/<key>` — no S3/credential errors in backend or worker logs.

### Verification tooling
Status: ✅ Production Ready
Notes: Added 2026-08-08: `backend/scripts/demo-smoke-test.js` walks the whole path (login → client → magic link → upload → confirm → processing → extraction → approve → Tally export → download, asserting the payload is real XML) and is idempotent so it can be re-run before a demo; `backend/scripts/make-test-invoice.js` generates a text-bearing invoice PDF (the repo had no PDF fixture); `backend/scripts/seed-demo-extraction.js` seeds a realistic extraction so review/approve/export can be exercised without a live OCR round trip. Local-only, git-ignored support files: `docker-compose.override.yml`, `ai-service/Dockerfile.local`, `ai-service/corp-ca.pem`.

### Production deployment target
Status: ⚠️ Partial → ✅ Production Ready (fixed 2026-09-20, hardened further 2026-09-21)
Notes: **Fixed 2026-09-21:** `render.yaml`'s `verax-postgres` database was on `plan: free`. Render's free Postgres tier is explicitly ephemeral — it is deleted roughly 30 days after creation with no backups and no way to renew it in place. Deploying this blueprint as committed meant every firm's/client's/extraction's data (and the audit log) would be unrecoverably wiped about a month after go-live. Changed to `plan: basic-1gb` (the minimum paid tier with automated daily backups and point-in-time recovery), with an explanatory comment in the blueprint. `verax-ai-service`, `verax-backend`, and `verax-worker` remain on `plan: free` in the committed file — the ai-service one is already flagged in an existing comment as required to be paid before going live (cold-start/idle-spindown, not a data-loss risk); all three are cheap to bump alongside Postgres and are an operator step at deploy time, not a code defect the way the database's ephemerality was.
Notes: **Fixed 2026-09-11 (docker-compose hardening)**, see prior note preserved below. **Fixed 2026-09-20 (deployment story + render.yaml completeness):** the README documented Railway as the "Production Build" target while the only real IaC in the repo (`render.yaml`) targets Render — two different platforms with no reconciliation, and no Railway-specific config existed anywhere. Resolved by making Render (backend/worker/ai-service/Postgres/Redis via `render.yaml`) + Vercel (static frontend) the documented primary path, and `docker-compose.prod.yml` the documented self-hosted alternative for operators with their own ops capacity; README rewritten accordingly. `render.yaml` itself had real gaps: it was missing `CLIENT_JWT_SECRET` (a `Joi.required()` var in `env.js` — the backend cannot boot without it, so the blueprint as committed would fail at startup), missing all `SMTP_*`/`EMAIL_*` vars (meaning magic-link/password-reset/notification emails would silently never send), and pointed `verax-ai-service` at the dev `Dockerfile` instead of `Dockerfile.prod`. All three fixed, plus an explicit comment warning that the ai-service instance must be on an always-on paid Render plan (the free tier spins down on idle, and the resulting cold start reloading PaddleOCR's models would fail or time out the first request afterward). `ai-service/Dockerfile.prod` also hardened: added `tesseract-ocr-hin` (it was missing from the prod image despite `ocr_service.py`'s Hindi/Devanagari fallback depending on it — silently broken for Hindi-script documents in production specifically), a non-root user, and a `HEALTHCHECK` against `/health`.
Notes (2026-09-11, preserved): `docker-compose.prod.yml`'s `backend` and `worker` services were defined as raw `image: node:20-alpine` with `./backend:/app` bind mounts and `npm install --omit=dev && npm start` as the runtime command — i.e. they never used `backend/Dockerfile` at all and mounted the host filesystem into a "production" container, both directly contradicting the production requirements (no local bind mounts; build from the Dockerfile). Changed both to `build: { context: ./backend, dockerfile: Dockerfile }`, removed the bind mounts and the now-unused `backend_node_modules` volume, and gave `worker` an explicit `command: ["node", "src/workers/document-processing.worker.js"]` override on the same image. `ai-service` was building the dev `Dockerfile` (tesseract-hin, `--reload`, no PaddleOCR model pre-fetch) instead of the existing `ai-service/Dockerfile.prod` (multi-worker uvicorn, models baked in at build time) — switched to `Dockerfile.prod`. Added Docker `healthcheck:` blocks to `backend`, `worker`, `frontend`, and `ai-service` (previously only `postgres`/`redis` had them): `wget --spider` against `/health` for backend and frontend, a `python -c urllib.request` check against `/health` for `ai-service` (the `python:3.12-slim` base has no curl/wget), and `pgrep -f document-processing.worker.js` for `worker`, which has no HTTP listener. Also added `backend/.dockerignore`, `frontend/.dockerignore`, and `ai-service/.dockerignore` (none existed) — without them, `COPY . .` in each Dockerfile copies the host's `node_modules`/`__pycache__` over the freshly-installed Linux ones after `npm ci`/`pip install`; frontend's build tooling (`esbuild`/`@rollup/rollup-*`) ships OS-specific native binaries, so building on a non-Linux host without a `.dockerignore` breaks `npm run build` inside the image. Verified: `docker compose -f docker-compose.prod.yml build` completes with exit code 0 for all four built images (`ca-backend:prod`, `ca-frontend:prod`, `ca-ai-service:prod`).

---

## Summary

| Status | Count |
|--------|-------|
| ✅ Production Ready | 179 |
| ⚠️ Partial | 2 |
| ❌ Not Built | 0 |
| 🔧 Needs Fix | 0 |
| **Total** | 181 |

*(2026-09-22, fifth pass — a full "thorough check everywhere" production-readiness sweep requested
ahead of building payments and doing the actual pilot deploy, scoped to dependency security and CI
health across all three services rather than new features. Backend: `npm audit` (13→2, one
deliberately-accepted `uuid`/`exceljs` item — forcing it would downgrade `exceljs` to `3.4.0` and
regress the XLSX-import feature below; `express` bumped same-major to pull a patched `qs`;
`nodemailer` force-bumped 8→10 after confirming the app's actual usage is stable across the major).
Frontend: `npm audit` (10→0, including a `react-router-dom` 6→7 major bump, verified safe by grepping
every import in `frontend/src/` and confirming only the stable classic-router API is used anywhere).
AI service: never audited before this pass — `pip-audit` found 46 known vulnerabilities across 9
packages; fixed 6 packages via same-major/small-patch bumps (`fastapi`, `python-multipart`,
`python-dotenv`, `pdfplumber`, `setuptools`), each checked for actual applicability to this codebase
before bumping (e.g. confirmed `/tools/register-clean` and `/tools/bank-statement-xml` really do
accept multipart `UploadFile`, so the starlette multipart-DoS fix pulled in via the `fastapi` bump is
real risk reduction here, not a number-chasing bump) and reverified with the full 27-case pytest suite
plus a clean `pip` dependency-resolution pass with zero conflicts; 3 packages left as documented
accepted risk (`paddlepaddle` — no stable fix exists, only a `3.0.0b0` beta; `imgaug` — no fix version
published upstream at all; `opencv-python`/`opencv-contrib-python` — hard-pinned transitively by
`paddleocr` itself, not independently controllable). Also found, during the backend audit, that
`client-import.service.js` — a fully-built bulk CSV/XLSX client-import feature with real routes,
service logic, a 541-line frontend modal, and audit logging — had never been entered in this document
at any point in its history, and that its XLSX parser used the unpatched, unmaintained `xlsx`/SheetJS
package directly against untrusted admin-uploaded file buffers; replaced it with `exceljs` (see "Bulk
client import" above) and added 14 new test cases for it, including real ExcelJS-generated `.xlsx`
fixtures. All four CI jobs (backend unit+syntax, backend RLS integration, frontend test+build,
ai-service syntax+pytest) reverified green end-to-end after every dependency change — each fix was
reproduced in a clean environment matching the CI runner (`env -i` with placeholder vars for backend,
a throwaway venv with the CI's exact light-dependency install pattern for ai-service) before being
accepted, not just trusted from local sandbox success. 2 new ✅ entries (Bulk client import,
Dependency security audit); no regressions.)*

*(2026-09-21, fourth pass — closed out the four items still open after the third pass's pre-publish
sweep: (1) added a real frontend test suite (Vitest + RTL, 47 cases, wired into CI) where none existed
before, focused on the actual highest-risk frontend logic — the 401→refresh→retry flow in
`api-client.js`, crash recovery, and the pure utility/permission modules other components depend on,
not padding for a coverage number; (2) closed the login-audit blind spot for real: `audit_logs.firm_id`
is now nullable with a narrow RLS escape hatch, and — this pass caught something the original finding
missed — the identical gap existed on the client-portal login flow too (a different `auth_context`
value), so both got fixed together rather than leaving the client-portal half broken; (3) added the
missing `<?xml version="1.0" encoding="UTF-8"?>` declaration to `buildTallyXml`'s output; (4) added
`detectDocTypeMismatch`, a structural check independent of the LLM's own self-report — the LLM's
classification only ever means "invoice" or "unknown" and never even runs on the bank-statement path,
so a mistagged document previously had no explicit signal, just unexplained low confidence. All four
verified against real infrastructure: the new migration's up/down cycle tested against a live
Postgres, a direct RLS-role query proving the audit-log escape hatch can't be triggered outside its
exact context, and the full test suite (74 backend + 27 ai-service + 47 frontend = 148 cases) green
after every change. 2 entries moved to ✅ this pass (Wrong document type detection, plus notes-only
fixes on two already-✅ entries); Top Gaps is now down to a single item, and it's a deploy-time budget
decision, not a code defect.)*

*(2026-09-21, third pass — pre-publish sweep of every remaining ⚠️/🔧 entry, since the goal of this
pass was "fix and build what's required before publishing the site." Real fixes: (1) added a
standalone `scheduled-requests.worker.js` entry point + `SCHEDULED_REQUESTS_EMBEDDED` env var so
splitting the document-processing and scheduled-requests workers into separate deployable units no
longer silently drops the daily cron; (2) made `REVIEW_CONFIDENCE_THRESHOLD` env-configurable instead
of a hardcoded literal; (3) fixed a real frontend over-gating bug where staff could not see the
firm's plan badge at all; (4) added an explicit "Download" button on the Review page's document
preview, reusing the existing download helper; (5) regenerated the three static brand SVGs
(`verax-logo.svg`, `verax-icon.svg`, `favicon.svg`) to match the in-app V1 component colors instead
of stale pre-V1 dark-canvas coloring; (6) migrated all four secondary marketing pages
(`/features`, `/pricing`, `/about`, `/security`) from the pre-V1 palette onto the same V2 "Ledger"
design system the homepage already uses; (7) fixed literal `bg-white/[0.0x]` decorative fills on the
magic-link upload pages that were nearly invisible on the light V1 canvas. Two real **content**
problems, not just styling, were found and fixed on explicit user direction: `/about` had a fully
fabricated founding team, timeline, and growth metrics (removed; real founder credited, no invented
backstory), and `/pricing` advertised real billing/trial/Razorpay payment support that doesn't exist
anywhere in the codebase (rewritten to honest early-access/waitlist framing). Also confirmed the
2026-08-09 JWT refresh-token reuse-detection rollback bug — this file's own previous "highest-priority
item" — was already fixed by the repo owner in commit `5ae0534c` before this pass started; the
finding was that the FEATURE_STATUS.md entry itself was stale, not the code, and it's now covered by
a new regression test that proves it (`refresh-token-reuse.test.js`). Five more entries
(`Dropdown with last 20 notifications`, `Invite user`, `User invite email`, `Email audit logs`,
`Reproducible local bring-up from a clean checkout`) were similarly re-verified against current code
and found to already be fixed from earlier sessions with stale status markers — corrected rather than
re-fixed. This pass also did a full recount of every `Status:` line in the file rather than an
incremental delta, since the running Summary counts had drifted from actual content over several
sessions (179 total entries found vs. 167 tracked) — the tallies above are now a direct count.
14 entries moved to ✅ this pass, plus the 5 corrected-stale-status entries; 3 entries remain
intentionally ⚠️ Partial by design, not because they're broken: `Wrong document type detection`
(self-reported by the LLM, no independent server-side check — a real design tradeoff, not a bug),
`Public design system — V1` (an accurate architectural description — `/login`, `/signup`,
`/client-portal/login`, and the magic-link pages are deliberately still V1, not a gap), and
`Automated test suites` (real but intentionally not comprehensive coverage). Full backend (46 unit +
15 integration) and ai-service (27) test suites, and a frontend production build, all re-verified
green after every change in this pass.)*

*(2026-09-21, second production-readiness fix pass — the six critical findings from the 2026-09-20
audit's own closing recommendations: (1) added a client-portal RLS database backstop so a client
session can never read a sibling client's documents/extractions/exports even if application code
ever queried without an explicit `client_id` filter — previously only application-level scoping
enforced this, not the database, unlike the firm-level isolation which the earlier RLS work did
enforce at the database level (see "Client-portal RLS database backstop"); (2) added a startup guard
that refuses to boot the server or either worker if the runtime DB role is a superuser, closing the
"operator leaves APP_DATABASE_URL unset" failure mode of the 2026-09-20 RLS-bypass bug (see "RLS
startup guard"); (3) closed a server-side gap letting an approved-but-not-yet-exported extraction be
edited via direct API call, silently invalidating the admin's approval (see "Prevent editing exported
extractions"); (4) made Tally-XML voucher balancing correct by construction regardless of extraction
quality, and separately hard-blocked export of any document whose tax math is internally
inconsistent — two independent layers, since a balanced voucher can still be built from wrong numbers
(see "Balanced voucher" and "Tax-math validation blocks export"); fixing this also caught and fixed a
sign bug of its own (double-negative amount strings) via a test written for the fix; (5) replaced the
previously-silent truncation of PDFs beyond 15 pages with a forced review + an explicit warning naming
how many of how many pages were actually processed (see "Multi-page PDF truncation warning"); (6) moved
Render's Postgres off the free tier, which is deleted ~30 days after creation with no backups (see
"Production deployment target"). 21 new test cases added (66→87 total: `tally-xml.service.test.js`
expanded, `exports.service.test.js` and `extraction-edit-lock.test.js` new, `rls.test.js` expanded
with a client-portal block, `test_preprocess_service.py` new and wired into CI). All changes verified
against a real local Postgres 16 + Redis, including confirming each new RLS/edit-lock regression test
fails when its underlying fix is reverted. 4 new ✅ entries, 0 status regressions.)*

*(2026-09-20, production-readiness audit + fix pass: found and fixed a critical RLS bypass in the
self-hosted docker-compose deployment path (app connected as a Postgres superuser, which silently
disables RLS regardless of policy correctness — see PostgreSQL RLS entry), added the first
automated test suites and CI pipeline this repo has ever had (~66 test cases across backend Jest
and ai-service pytest, including a regression guard for the RLS bug), fixed an uncaught-exception
path in LLM JSON parsing, added retry/timeout around external calls in ai-service, closed a rate-limiting
gap on 6 authenticated route files, added a frontend error boundary, fixed a silent download-failure
path, added a missing audit log on extraction edits, reconciled the Railway/Render deployment
documentation split and completed render.yaml, and hardened the ai-service Docker images. 5 items
moved 🔧→✅, 5 new ✅ entries, 1 new ⚠️ entry (test coverage — real but intentionally not
comprehensive, see "Automated test suites").)*

*(2026-08-09, marketing redesign: the landing page was rebuilt on a new V2 design system
("The Ledger") — 13 new marketing components, `HomePage` reduced to composition, `PublicLayout`
replaced by the shared marketing chrome, fabricated social proof removed, and route-level code
splitting added. See PUBLIC / MARKETING SURFACE. No backend, API, schema or authenticated-app
behaviour was touched.)*

*(2026-08-09: +13 new ✅ entries for the CLIENT PORTAL section, and "JWT refresh" moved ✅→🔧 after a real rollback bug was found in its reuse detection while building the portal — see that entry. Previous pass, 2026-08-08: 1 item moved ❌→✅, 9 items ⚠️→✅, 3 items 🔧→✅.)*

## Top Gaps to Address

*Rewritten 2026-09-21 (second time same day) after closing out items 2-5 from the previous version of
this list — frontend test coverage, the login-audit blind spot, the Tally XML declaration, and an
independent document-type check — see their entries above for what changed and how each was verified.
What's left is now down to a single item, and it's an operator decision, not a code defect:*

1. **Render's `verax-ai-service`/`verax-backend`/`verax-worker` are still on `plan: free` in the
   committed `render.yaml`** — only `verax-postgres` has been moved to a paid tier (that was the one
   with silent, irreversible data loss). The ai-service free tier is already flagged in an existing
   comment as unacceptable for production (cold-start on idle spin-down); backend/worker on the free
   tier means the same idle-spindown problem for API/worker requests. This is a deploy-time operator
   decision (which paid tier, what budget) rather than a code change, so it was deliberately left for
   the person doing the actual go-live deploy rather than guessed at here.

Two items remain intentionally not "fixed" because they're accepted design tradeoffs, not defects —
see their own entries above for the reasoning: `Public design system — V1` (some public pages are
deliberately still V1, not a migration gap) and `Automated test suites` (real coverage on the highest-
risk paths across all three services now, including the frontend, but still not exhaustive — most
backend services/routes and all of `ocr_service.py` remain untested).

## What Can Be Piloted Today

The core document lifecycle — magic-link and authenticated upload → OCR/LLM extraction with confidence gating → review/edit/approve → Tally XML export (single and bulk) — is fully wired end to end across all three services, with real RLS-backed multi-tenancy, working JWT refresh with reuse detection, and a genuinely complete PaddleOCR→Tesseract fallback plus Groq extraction pipeline (now with an enforced request timeout and graceful degradation on failure). GSTIN validation (local + live GSP), tax-math/TDS/duplicate-invoice compliance checks, GSTR-2B reconciliation with Excel export, item-name-mapping with fuzzy suggestions, full document version history with diff view, all four notification triggers (including permanent-failure alerting as of this pass), scheduled recurring document requests, team management, and audit logging (now including signup/login) are all built and connected. Both standalone tools (register cleaner, bank-statement-to-XML) are production-adapted with real edge-case handling and are now rate-limited with proper session-refresh behavior on the frontend.

A CA firm can pilot the full upload → review → export workflow today, on either the authenticated staff-upload page or the client-facing magic-link page — both now have matching queue/progress/validation UX. The two items flagged in the previous audit as pre-pilot blockers (permanent-failure alerting and the authenticated-upload UX gap) are resolved.

As of 2026-08-09 the **client portal** is also pilot-ready: a firm admin can enable portal access for a client from the client detail page, hand over the one-time temp password, and that client can sign in at `/client-portal/login` to see their own documents in plain English, download their originals, check their GST reconciliation, download it as Excel, and change their password. The two worlds are provably separate — a firm JWT is rejected on every client-portal route and a client JWT on every firm route, verified by test. Sibling-client isolation (one client never seeing another client's documents within the same firm) was, until 2026-09-21, enforced only at the application-query level, not by the database's RLS policies — a real gap, now closed with a database-level backstop and its own regression test (see "Client-portal RLS database backstop").

As of 2026-09-21, the public marketing site (`/`, `/features`, `/pricing`, `/about`, `/security`) is also publish-ready: all four secondary pages now match the homepage's V2 design language, the brand SVG assets match the in-app logo component, and both content problems found during this pass — a fabricated founding team/timeline/growth-metrics on `/about` and a fabricated billing/trial/Razorpay claim on `/pricing` — were rewritten to honest copy (real founder credit, early-access/waitlist framing) rather than left to ship. What remains is genuinely lower-priority: bumping Render's `verax-backend`/`verax-worker`/`verax-ai-service` off the free tier at actual deploy time, and frontend test coverage — see Top Gaps.
