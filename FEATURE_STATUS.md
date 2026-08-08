# Verax TallyOCR — Feature Status
Last updated: 2026-08-08
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
Notes: **Fixed 2026-08-08** — `loginUser` now writes `login_success` on success and `login_failed` (`reason: "invalid_password"`) when a known user supplies the wrong password, both via the same transaction `client` (not a separate connection). The failure case returns an `{authFailed: true}` sentinel from the transaction handler instead of throwing inside it, since throwing there would have rolled back the audit insert along with everything else — the caller checks the sentinel and throws `ApiError.unauthorized` after the transaction commits. One deliberate gap remains: a login attempt against an **unknown email** cannot be audit-logged, because `audit_logs.firm_id` is `NOT NULL` with no RLS escape hatch for an unresolved firm — there is no firm to attribute the row to. This is a schema-level constraint, not an oversight.

### Logout
Status: ✅ Production Ready
Backend: `POST /api/auth/logout` — `auth.routes.js:133-142` → `logoutSession` (`auth.service.js:655-689`), tenant-scoped
Frontend: No dedicated page; implemented as header button in `components/layout/AppShell.jsx:115-119,296-303` with loading-state text swap, clears session, navigates to `/login`
Notes: Confirmed working.

### JWT refresh
Status: ✅ Production Ready
Backend: `POST /api/auth/refresh` — `auth.routes.js:114-131` → `refreshAccessToken` (`auth.service.js:518-653`). Full chain rotation: verifies token hash, detects reuse and revokes the entire token family on mismatch (`:566-571`), marks old token `revoked_at`/`replaced_by_token_id` (`:606-614`), inserts new row (`:616-645`)
Frontend: `lib/api-client.js:66-119` (`request()`) implements transparent 401→refresh→retry on every authenticated call except the two `ToolsPage.jsx` raw-`fetch` calls (see Standalone Tools)
Migration: `20260311171500_auth_infra.js` (refresh_tokens table + RLS)
Notes: Correctly implemented with reuse detection, a real security feature many SaaS apps skip.

### Password reset (forgot password + reset flow)
Status: ⚠️ Partial
Backend: `POST /api/auth/forgot-password` (`auth.routes.js:144-157`) → `requestPasswordReset` (`auth.service.js:122-256`, audit `password_reset_requested` + `password_reset_emailed`); `GET /api/auth/reset-password/:token` (`:159-167`) → `validatePasswordResetToken` (`:283-326`); `POST /api/auth/reset-password` (`:169-181`) → `resetPassword` (`:328-392`, audit `password_reset_completed`, revokes all refresh tokens on reset)
Frontend: `pages/ForgotPasswordPage.jsx`, `pages/ResetPasswordPage.jsx` — full loading/error/success states
Migration: `20260506000000_password_reset_tokens.js` (+ RLS escape hatch for the unauthenticated token-validation lookup)
Notes: Full flow is implemented and token TTL is a hardcoded 15 min (`PASSWORD_RESET_TOKEN_TTL_MINUTES`, `auth.service.js:20`, inconsistent with `ACCESS_TOKEN_TTL_MINUTES` which *is* env-driven). **Flag for verification**: `ForgotPasswordPage.jsx:37-39,86-93` renders a `result.devResetLink` directly in the UI if the API response includes it — confirm this is gated behind `NODE_ENV !== 'production'` server-side before shipping, since if not it would leak reset tokens to anyone who submits the form.

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
Status: 🔧 Needs Fix
Backend: `plan_enum` defined in initial schema migration (`20260311163000_initial_schema.js:116-136`), returned by `getFirmSettings`
Frontend: `SettingsPage.jsx:175,223` (`PlanBadge`)
Notes: **`PlanBadge` only renders inside the admin-gated panel (`SettingsPage.jsx:168`)** — staff users cannot see the firm's plan at all. Since the task's own permission spec says staff "can view", this is a frontend gating bug, not an admin-only-by-design feature.

---

## CLIENT MANAGEMENT

### Client list with search and status filter
Status: ⚠️ Partial
Backend: `GET /api/clients` — `clients.routes.js:48-63`, `listClientsQuerySchema` (`:19-24`) → `listClients` (`clients.service.js:63-121`)
Frontend: `pages/ClientsPage.jsx:308-323` (search + status filter), `TableRowsSkeleton` loading, empty state (`:206-218`), pagination
Notes: Search re-fetches on every keystroke via `useEffect` dependency array (`:68-70`) with no debounce — works, but generates one API call per character typed (the GSTIN lookup elsewhere in the same page *is* debounced 800ms, an inconsistency).

### Create client
Status: ✅ Production Ready
Backend: `POST /api/clients` — `clients.routes.js:65-79`, `requireAdmin`, `createClientBodySchema` (`:26-32`) → `createClient` (`clients.service.js:123-180`, audit `client_created`)
Frontend: `ClientsPage.jsx:372` admin-gated form panel, Zod schema (`:14-32`)

### View client details
Status: ✅ Production Ready
Backend: `GET /api/clients/:id` — `clients.routes.js:81-93` → `getClientById` (`clients.service.js:182-232`)
Frontend: `pages/ClientDetailPage.jsx`, loading skeleton, not-found empty state (`:656-658`)

### Update client details
Status: ✅ Production Ready
Backend: `PUT /api/clients/:id` — `clients.routes.js:95-111`, `requireAdmin`, `updateClientBodySchema` (`:34-40`) → `updateClient` (`clients.service.js:234-293`, audit `client_updated`)
Frontend: `ClientDetailPage.jsx:688-761`, admin-gated edit form

### Soft delete client
Status: ✅ Production Ready
Backend: `DELETE /api/clients/:id` — `clients.routes.js:113-127`, `requireAdmin` → `deleteClient` (`clients.service.js:295-320`, soft delete, audit `client_deleted`)
Frontend: `ClientDetailPage.jsx:325-346,852-859` confirm modal, admin-gated

### Client document summary
Status: ✅ Production Ready
Backend: `getClientById`/`listClients` returns `totalDocuments`/`processingDocuments`/`reviewedDocuments`/`exportedDocuments` (`clients.service.js:222-229`)
Frontend: `ClientDetailPage.jsx:662-667` StatCards — field names confirmed matching backend

### GSTIN live lookup on client form
Status: ✅ Production Ready
Backend: `POST /api/compliance/gstin/verify` — `compliance.routes.js:348-383`, `gspService.verifyGSTIN` (`gsp.service.js:263-278`, live GSP call with local-checksum fallback if GSP unconfigured)
Frontend: `ClientsPage.jsx:72-116` and `ClientDetailPage.jsx:113-154` — 800ms-debounced, three visually distinct states (valid/fallback/invalid/error, `:440-455`)
Notes: Lookup logic duplicated between the two pages rather than shared — works but is a maintainability note, not a functional gap.

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

### LLM structured extraction
Status: ✅ Production Ready
AI Service: `llm_service.py` — Groq `llama-3.1-70b-versatile` (still a hardcoded model string, not env-configurable — unchanged, not in scope), key from `settings.groq_api_key` (env-sourced)
Notes: **Fixed 2026-08-08.** `settings.llm_timeout_seconds` is now passed as `timeout=` on the `chat.completions.create(...)` call, so a hung Groq request no longer blocks a worker slot indefinitely. The call is now wrapped in its own `try/except`: on failure it logs `Groq extraction failed: {e}` and returns `{"document_type_detected": "unknown", "confidence": 0.0, "_llm_error": str(e)}` directly (same short-circuit shape as the existing `is_ocr_garbage` path) instead of propagating to `main.py`'s generic 500 handler — a Groq outage now degrades a single document to `review_required` rather than surfacing as a raw 500.

### Confidence score generation
Status: ✅ Production Ready
AI Service: `llm_service.py:375-383` (LLM self-reported, clamped 0-1) with heuristic fallback `_confidence()` (`:362-373`, field-completeness) and invoice-only ceiling adjustments `validate_and_adjust_confidence()` (`:236-277`, caps for missing total/date/vendor, invalid GSTIN, tax-math variance)
Notes: OCR-engine confidence (PaddleOCR per-line score) is used only to filter which OCR lines are kept — it is discarded before the final score, so the reported `confidence_score` is LLM-only, not a true OCR+LLM combined metric, despite the task description implying both feed in.

### Confidence gating (0.4 threshold → review_required)
Status: 🔧 Needs Fix
Backend: `document-processing.worker.js:27,69-73` — `CONFIDENCE_THRESHOLD = 0.4` **hardcoded literal**, not read from `env.js`/config, despite CLAUDE.md's "Environment" section implying config-driven thresholds
Migration: `20260512000000_review_required_status.js` adds `'review_required'` enum value
Notes: Logic itself is correct (`confidence < 0.4 || documentTypeDetected === "unknown"` → `review_required`), just not env-configurable per the codebase's stated conventions.

### Wrong document type detection
Status: ⚠️ Partial
AI Service: implemented as an LLM-prompted self-classification, not an independent check — `EXTRACTION_PROMPT` "STEP 1" (`llm_service.py:16-25`) instructs the model to return `document_type_detected: "unknown"` for non-matching documents; backed by a code-level OCR-garbage pre-check `is_ocr_garbage()` (`:209-222`) that short-circuits before even calling Groq — but only for non-bank-statement uploads (`:390`)
Backend: `documentTypeDetected === "unknown"` correctly wired into confidence gating (`document-processing.worker.js:71`)
Notes: Works end-to-end, but is self-reported by the LLM with no independent server-side re-validation against the caller-supplied `doc_type`.

### Processing retry/error tracking
Status: ✅ Production Ready
Backend: `document-processing.service.js:115-176` (`markDocumentProcessingFailed`) increments `documents.processing_attempts`, writes `audit_logs` row `document_processing_failed` on every failure

### Permanent failure notification to admin
Status: ✅ Production Ready
Backend: on `processing_attempts >= 3`, `document-processing.service.js:156-170` writes the `document_processing_alert` audit row as before, and — as of 2026-08-08 — `document-processing.worker.js` (after the existing `process.stderr.write`) fetches the firm's admins via the existing `getDocumentReadyEmailContext` helper and, per admin, calls `createNotification({type: "document_failed", title: "Document processing failed", message: "A document failed to process after 3 attempts and needs manual review.", entityType: "document", entityId})` and sends an email built from the new `backend/src/templates/documentFailed.template.js` (subject "Document processing failed — manual review needed", includes document name, client name, failure reason, and a link to `/audit-logs`). A new `recordDocumentFailedEmailAudit` (`document-processing.service.js`) logs the email send outcome as `document_failed_emailed`. Both the notification call and the email call are individually wrapped in try/catch (mirroring the existing `document_ready` pattern) so a failure in either cannot affect the worker or the job's success/failure outcome.
Notes: Closes the gap flagged in the original audit — an admin now receives both an in-app notification and an email when a document permanently fails, matching the other three notification triggers.

---

## REVIEW WORKFLOW

### Review extracted document data
Status: ✅ Production Ready
Backend: `GET /api/extractions/:documentId` — `extractions.routes.js:51-110` → `getExtraction` (`extractions.service.js:27-61`) + inline compliance/name-mapping enrichment
Frontend: `pages/ReviewPage.jsx` (1181 lines) — loads via `Promise.allSettled` over document/extraction/versions (`:246-333`), "not yet processed" banner (`:267-273,670-677`)

### View document preview/download
Status: ⚠️ Partial
Frontend: `ReviewPage.jsx:513-536` — iframe for PDF, `<img>` otherwise, sourced from `document.download_url` (confirmed matches `documents.service.js:604`)
Notes: There is no separate explicit "Download" button — the inline preview is the only access point. Acceptable if preview doubles as download for supported types, but there's no fallback affordance for file types the browser can't render inline.

### Edit extracted fields (staff allowed)
Status: 🔧 Needs Fix
Backend: `PUT /api/extractions/:documentId` — `extractions.routes.js:113-131`, `requireAuth` only (correctly staff-editable), `updateSchema` (`:31-48`) → `updateExtraction` (`extractions.service.js:93-120`), snapshots `pre_edit` version first
Frontend: `ReviewPage.jsx:868-875` Save button correctly NOT admin-gated
Notes: **No `audit_logs` entry is written for the edit itself** — only the `pre_edit` version snapshot is recorded, so there's no explicit audit trail of "who edited what, when" outside of diffing version snapshots.

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
Backend: `deleteDocument` blocks on `status='exported'` (`documents.service.js:626-628`)
Frontend: `ReviewPage.jsx` — every editable field and Save/Reprocess/Approve button checks `isExported` (multiple line refs: `786,871,880,890,960-1135`)

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

### GST ledger entries without requiring item mapping
Status: ✅ Production Ready
Backend: `tally-xml.service.js:83-111` `buildTaxLedgerEntries` (CGST/SGST/IGST lines) built independently of `buildInventoryEntries` (`:113-136`)

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
Status: ⚠️ Partial
Backend: `GET /api/notifications` — `notifications.routes.js:25-42` → `getNotificationsForUser` (`notifications.service.js:51-71`)
Frontend: `AppShell.jsx:233-281`
Notes: The specific "last 20" limit was not independently confirmed against the service's SQL `LIMIT` clause in this research pass — recommend a quick check of `notifications.service.js:51-71` to confirm the exact page size matches spec.

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
Status: 🔧 Needs Fix
Backend: `scheduled-requests.job.js:39-51` — repeat pattern `"0 8 * * *"` (**hardcoded**, not env-configurable), registered via `startServer()` in `server.js:10`
Notes: The worker consumer (`createScheduledRequestsWorker`, `:102-120`) only runs as a side effect of `document-processing.worker.js:26` instantiating it — there is **no standalone `npm run worker:scheduled-requests` script**, so if someone ever runs the document worker and scheduled-requests worker as separate deployable units (e.g. for independent scaling), the scheduled-requests cron simply won't fire. Flagging as Needs Fix since it works today only because both run in the same process by coincidence of `worker.js`'s current structure.

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
Status: ⚠️ Partial
Backend: `POST /api/users` — `users.routes.js:35-52`, `requireAdmin`, `inviteUserSchema` (`:12-17`) → `inviteUser` (`users.service.js:33-127`, audit `user_invited` + `user_invite_emailed`), sends email with `tempPassword` in cleartext (`:80-89`)
Frontend: `TeamPage.jsx:139-224`, Zod-validated form, admin-gated toggle
Notes: Works, but the `user_invited` audit row doesn't capture `sent`/`provider`/`error` the way the other 3 email call sites (password reset, magic link, document ready) do — an inconsistency in email-delivery observability, not a functional break.

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

## AUDIT LOGS

### Audit log page (admin only)
Status: ✅ Production Ready
Frontend: `pages/AuditLogPage.jsx:102-108` — non-admins see "Admin access required" message; fetch `useEffect` explicitly skips the API call when `!canAdmin` (`:81-87`), so it's gated both visually and functionally, not just hidden by CSS

### List entries
Status: ✅ Production Ready
Backend: `GET /api/audit-logs` — `audit.routes.js:19-35`, `requireAdmin`, `listAuditLogsQuerySchema` (`:10-15`) → `listAuditLogs` (`audit.service.js:1-67`)
Frontend: loading skeleton, empty state, pagination (`:144-247`)

### Filter by action
Status: ✅ Production Ready
Frontend: `AuditLogPage.jsx:114-119` free-text filter

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
Status: ⚠️ Partial
Frontend: confirmed correct on ReviewPage (Approve/Reprocess), ExportPage (Generate panel), TeamPage (invite/remove), AuditLogPage (whole page), SettingsPage (firm settings panel)
Notes: See "Plan field support" above — staff being unable to see the plan badge (not just unable to edit it) is arguably over-hiding, the inverse problem. Worth a product decision on whether plan visibility should be staff-visible.

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
Status: ⚠️ Partial
Backend: `users.service.js:80-89` → audit `user_invited` (`:91-104`)
Notes: sends correctly, but (as noted above) the audit row doesn't capture delivery status (`sent`/`provider`/`error`) the way the other 3 email flows do.

### Document ready for review email
Status: ✅ Production Ready
Backend: `document-processing.worker.js:104-115` → audit `document_ready_emailed` via `recordDocumentReadyEmailAudit` (`document-processing.service.js:236-253`), sent to every admin in the firm

### Email audit logs
Status: ⚠️ Partial
Backend: 3 of 4 email call sites record `sent`/`provider`/`error` in their audit row; user-invite does not (see above)

---

## SECURITY & PLATFORM

### PostgreSQL RLS on all tenant tables
Status: ✅ Production Ready
Migration: confirmed across all 13 migrations — every tenant-scoped table (`firms`, `users`, `clients`, `documents`, `extractions`, `tally_exports`, `audit_logs`, `refresh_tokens`, `document_upload_sessions`, `item_name_mappings`, `password_reset_tokens`, `notifications`, `document_versions`, `scheduled_requests`) has RLS enabled and (after the `item_name_mappings` fix) forced. `waitlist` intentionally has no RLS (pre-auth public signup table, no `firm_id`).
Notes: `waitlist.service.js` uses raw `pool.query` directly rather than `withTenantTransaction` (`:1,14`) — correct given it has no tenant scope, but is the one clear exception to the "always wrap DB access" convention and should be documented as intentional so it isn't "fixed" by mistake later.

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

### HttpOnly refresh cookies
Status: ✅ Production Ready
Backend: `auth.service.js:32-38` `getRefreshCookieOptions` — `httpOnly: true`, `secure: env.NODE_ENV === 'production'`, `sameSite: 'strict'`, scoped `path: '/api/auth'`

### Access token in memory only (frontend)
Status: ✅ Production Ready
Frontend: `lib/token-store.js:1-27` — access token and user object kept in module-scope JS variables only, never written to localStorage/sessionStorage; a hard page refresh relies on `AuthContext.bootstrap()` (`AuthContext.jsx:18-31`) hitting `/api/auth/refresh` via the httpOnly cookie

---

## Summary

| Status | Count |
|--------|-------|
| ✅ Production Ready | 127 |
| ⚠️ Partial | 9 |
| ❌ Not Built | 0 |
| 🔧 Needs Fix | 4 |
| **Total** | 140 |

*(Recounted directly from this file's `Status:` lines during the 2026-08-08 fix pass — the previous summary undercounted the true entry total. Net change from the 7 fixes applied 2026-08-08: 1 item moved ❌→✅, 9 items moved ⚠️→✅, 3 items moved 🔧→✅; one additional ⚠️→✅ correction was made to "Link from upload success page" after directly confirming it in code while implementing Fix 2.)*

## Top Gaps to Address

*Updated 2026-08-08 — 7 items from the previous list were fixed in this pass (see each entry's "Fixed 2026-08-08" note for detail): permanent-failure notification/email, `gstr2b/match` admin gate, authenticated-upload UX (queue/progress/validation), `request-docs` `documentTypes`, LLM request timeout + Groq failure handling, `/api/tools/*` rate limiting + frontend 401-refresh, and signup/login audit logs. Remaining gaps, in priority order:*

1. **Scheduled-requests cron worker has no standalone process** — it only runs because it happens to be instantiated inside the document-processing worker file; deploying the two workers separately (a natural scaling move) would silently break the 08:00 UTC daily job.
2. **Staff cannot see the firm's plan** on Settings — likely an over-broad admin gate rather than intentional design; worth a quick product call.
3. **No audit log on extraction edits** (only version snapshots exist) — reduces traceability for a compliance-positioned product; signup and login are now logged as of this pass, but field-level edits on `PUT /api/extractions/:documentId` still are not.
4. **Login audit logging has one intentional blind spot**: a failed login against an email that doesn't exist in the system cannot be logged, because `audit_logs.firm_id` is `NOT NULL` with no RLS escape hatch for an unresolved firm. Known-user wrong-password attempts and all successful logins are logged; unknown-email attempts are not. Closing this fully would require a schema change (e.g. a nullable `firm_id` or a sentinel "system" firm), which was out of scope for this fix pass.
5. **"Dropdown with last 20 notifications" limit was not independently re-verified** against `notifications.service.js`'s SQL `LIMIT` clause — carried over from the original audit, unaffected by this fix pass.

## What Can Be Piloted Today

The core document lifecycle — magic-link and authenticated upload → OCR/LLM extraction with confidence gating → review/edit/approve → Tally XML export (single and bulk) — is fully wired end to end across all three services, with real RLS-backed multi-tenancy, working JWT refresh with reuse detection, and a genuinely complete PaddleOCR→Tesseract fallback plus Groq extraction pipeline (now with an enforced request timeout and graceful degradation on failure). GSTIN validation (local + live GSP), tax-math/TDS/duplicate-invoice compliance checks, GSTR-2B reconciliation with Excel export, item-name-mapping with fuzzy suggestions, full document version history with diff view, all four notification triggers (including permanent-failure alerting as of this pass), scheduled recurring document requests, team management, and audit logging (now including signup/login) are all built and connected. Both standalone tools (register cleaner, bank-statement-to-XML) are production-adapted with real edge-case handling and are now rate-limited with proper session-refresh behavior on the frontend.

A CA firm can pilot the full upload → review → export workflow today, on either the authenticated staff-upload page or the client-facing magic-link page — both now have matching queue/progress/validation UX. The two items flagged in the previous audit as pre-pilot blockers (permanent-failure alerting and the authenticated-upload UX gap) are resolved. What remains is lower-priority operational hardening (the scheduled-requests worker's process-topology assumption, extraction-edit audit coverage) rather than anything blocking a pilot.
