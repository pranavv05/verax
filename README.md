# Verax TallyOCR

Multi-tenant SaaS platform for Chartered Accountant firms in India. Verax TallyOCR handles client document intake, OCR extraction, CA review, compliance checks, and TallyPrime XML export.

## Overview

This monorepo contains:

- `frontend/`: React 18 + Vite + Tailwind web app
- `backend/`: JavaScript Express API, PostgreSQL/Knex migrations, BullMQ worker, S3 upload flow, and Tally XML export
- `ai-service/`: Python 3.12 FastAPI service for preprocessing, OCR, LLM extraction, and standalone tools
- `docker-compose.yml`: local development stack with Postgres, Redis, backend, worker, frontend, and AI service
- `docker-compose.prod.yml` + `deploy/caddy/`: self-hosted production stack with HTTPS and daily database backups
- `render.yaml`: Render Blueprint for the managed production deployment

Core capabilities:

- Firm-level tenant isolation with PostgreSQL RLS
- JWT authentication with refresh-token cookie flow
- Client magic-link uploads and public upload status
- S3 pre-signed uploads/downloads
- Async document processing with Redis + BullMQ (3 attempts with backoff, admin alert on permanent failure)
- OCR pipeline with PaddleOCR primary and tuned Tesseract fallback
- LLM extraction for Indian invoices and bills with wrong-document detection
- Confidence gating: low-confidence or unknown documents become `review_required`
- Review workflow with edit history, confidence indicators, warnings, and approval
- TallyPrime XML exports
- Standalone tools:
  - Bank Statement to Tally XML
  - Excel Register Cleaner

## Tech Stack

- Frontend: React 18, Vite, TailwindCSS, Zod
- Backend: Node.js, Express, PostgreSQL 15, Knex, BullMQ, Redis
- AI Service: Python 3.12, FastAPI, OpenCV, PyMuPDF, pdfplumber, pdf2image, Tesseract, PaddleOCR, Groq (Llama)
- Storage: AWS S3 (or local disk via `LOCAL_STORAGE=true`)
- Email: SMTP or Resend

## Project Structure

```text
/
|-- ai-service/        # Python FastAPI OCR + extraction service (tests in ai-service/tests)
|-- backend/           # Express API, migrations, workers, services (tests in backend/tests)
|-- frontend/          # React/Vite client app (tests in frontend/tests)
|-- deploy/caddy/      # HTTPS reverse proxy image for docker-compose.prod.yml
|-- tests/             # Ad-hoc local scripts and fixtures
|-- .github/workflows/ # CI: backend unit + RLS integration, frontend, ai-service
|-- docker-compose.yml
|-- docker-compose.prod.yml
|-- render.yaml
|-- .env.example
|-- .env.production.example
|-- FEATURE_STATUS.md  # Source of truth for what is built / partial / broken
`-- README.md
```

## Quick Start With Docker

1. Create a local environment file:

```bash
cp .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

2. Fill required values in `.env`:

- `DATABASE_URL`
- `REDIS_URL`
- `AWS_REGION`
- `AWS_S3_BUCKET`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

  (AWS credentials and `AWS_S3_BUCKET` are only required when `LOCAL_STORAGE=false` — set `LOCAL_STORAGE=true` on the backend and ai-service to store files on local disk instead of S3 for dev.)
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `CLIENT_JWT_SECRET` (must differ from the two above — the backend will not start otherwise)
- `GROQ_API_KEY`
- `AI_SERVICE_API_KEY`
- `FRONTEND_URL`
- `VITE_API_BASE_URL`

3. Start the stack:

```bash
docker compose up --build
```

4. Run backend migrations:

```bash
docker compose exec backend npm run migrate:latest
```

5. Seed an admin user if needed:

```bash
docker compose exec backend npm run seed:admin
```

## Production Deployment

### Before either deployment path

These apply to both Render and self-hosting, and each one breaks the product if skipped:

- **One domain for frontend and API.** Serve them as subdomains of a domain you own, e.g. `app.yourdomain.in` and `api.yourdomain.in`. The refresh-token cookie is `SameSite=Strict` and the access token is kept only in memory, so every page load re-authenticates through that cookie. Browsers treat `*.vercel.app` and `*.onrender.com` as separate sites and never send the cookie between them — on the default platform domains, users are logged out on every reload. The backend logs a `[config warning]` at startup if `FRONTEND_URL` is on such a platform domain.
- **`TRUST_PROXY` must match the proxy in front of the backend** (`1` on Render and in `docker-compose.prod.yml`, where both files already set it). Rate limits are per client IP; with the wrong value every user shares one bucket and logins/refreshes fail with `429`.
- **S3 bucket CORS.** Browsers upload to and download from S3 directly, so the bucket needs a CORS rule for the frontend origin:

  ```json
  [{
    "AllowedOrigins": ["https://app.yourdomain.in"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }]
  ```

- **Email must be configured** (`EMAIL_PROVIDER` plus `RESEND_API_KEY`, or `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS`). Without it, magic-link, password-reset, invite and document-notification emails are silently not sent.
- `SENTRY_DSN` is optional but recommended (backend + worker error reporting).

Every variable is documented in `.env.production.example`.

### Render + Vercel (primary)

`render.yaml` is a Render Blueprint that deploys `backend`, `worker`, `ai-service`, Postgres, and Redis in one pass. The frontend is a static Vite build deployed separately on Vercel (root directory `frontend`, build command `npm run build`, output directory `dist`).

The Blueprint is sized for real client data, not the free tier: `verax-ai-service` on `1c-2g` (PaddleOCR needs ~2 GB, one uvicorn worker), `verax-backend` and `verax-worker` on `0.5c-512mb` (always on), Postgres on `basic-1gb` (daily backups + point-in-time recovery), and Redis on `256mb` with `maxmemoryPolicy: noeviction` — Render's default `allkeys-lru` can silently evict queued BullMQ jobs. These are paid plans; check Render's current pricing before applying the Blueprint.

1. In Render, create a new Blueprint from this repo — it reads `render.yaml` automatically.
2. Set the manual (`sync: false`) env vars listed in the comment block at the top of `render.yaml`: JWT/CLIENT_JWT secrets, AWS credentials, `GROQ_API_KEY`, `AI_SERVICE_API_KEY`, `FRONTEND_URL`, the `SMTP_*` vars, and optionally `SENTRY_DSN`.
3. Add a custom domain to `verax-backend` (e.g. `api.yourdomain.in`).
4. In Vercel, import the repo, set the root directory to `frontend`, add the matching custom domain (e.g. `app.yourdomain.in`), and set `VITE_API_BASE_URL` to the backend's custom domain.
5. Back in Render, set `verax-backend`'s and `verax-worker`'s `FRONTEND_URL` to the frontend's custom domain, and `AI_SERVICE_URL` to the deployed `verax-ai-service` URL.
6. Add the S3 CORS rule above for the frontend's custom domain.

Migrations run automatically on every backend deploy (`npm run migrate:latest && npm start`).

### Self-hosted: `docker-compose.prod.yml`

Runs the four application images (`backend`, `worker`, `frontend`, `ai-service`) plus Postgres, Redis, a `caddy` HTTPS proxy, and a `db-backup` service. Every service has `restart: unless-stopped` and a Docker healthcheck, and there are no bind mounts to the host filesystem (S3 is required; there is no `LOCAL_STORAGE` fallback).

- **HTTPS:** `caddy` (`deploy/caddy/`) is the only service that publishes ports (80/443). It serves `APP_DOMAIN` and `API_DOMAIN` with automatic Let's Encrypt certificates and is the single proxy hop that `TRUST_PROXY=1` refers to. Point both domains' DNS at the host before first start.
- **Backups:** `db-backup` runs `pg_dump` at start-up and every 24 hours into the `postgres_backups` volume, keeping `BACKUP_RETENTION_DAYS` (default 14) days, and reports unhealthy if no dump succeeded in the last 26 hours. That volume is on the same host as the database — copy it off-host (e.g. `aws s3 sync` or provider volume snapshots), or a host failure still loses everything.
- **Resources:** `ai-service` reserves 2 GB and is capped at `AI_SERVICE_MEMORY_LIMIT` (default `4g`); size the host for it plus Postgres.
- `frontend` builds the Vite app and serves it with nginx (`frontend/Dockerfile`, `frontend/nginx.conf`); `ai-service` builds from `ai-service/Dockerfile.prod`, which pre-fetches the PaddleOCR models at build time.

Required env vars (see the comment block at the top of `docker-compose.prod.yml`): `POSTGRES_PASSWORD`, `DATABASE_URL`, `APP_DB_PASSWORD`, `APP_DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CLIENT_JWT_SECRET`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `GROQ_API_KEY`, `AI_SERVICE_API_KEY`, `APP_DOMAIN`, `API_DOMAIN`, `ACME_EMAIL`, `VITE_API_BASE_URL` (`https://<API_DOMAIN>`), `FRONTEND_URL` (`https://<APP_DOMAIN>`), and the email vars.

First deploy — migrations must run before the backend starts, because they create the least-privilege `ca_app` role that `APP_DATABASE_URL` connects as (the backend refuses to start as a Postgres superuser, since RLS does not apply to one):

```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d postgres redis
docker compose -f docker-compose.prod.yml run --rm backend npm run migrate:latest
docker compose -f docker-compose.prod.yml up -d
```

On later deploys, run the same `migrate:latest` command before `up -d`. Restore a backup with:

```bash
docker compose -f docker-compose.prod.yml exec db-backup \
  pg_restore --clean --if-exists -d "$POSTGRES_DB" /backups/<file>.dump
```

Use this path only if you have the operational capacity to run and monitor your own VPS/host — patching, failover, and uptime are on you, not a managed platform.

## Local Development Without Docker

Backend:

```bash
cd backend
npm install
npm run migrate:latest
npm run dev
```

Document worker:

```bash
cd backend
npm run worker:documents
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

AI service:

```bash
cd ai-service
cp .env.example .env   # fill in DATABASE_URL, GROQ_API_KEY, AI_SERVICE_API_KEY, AWS_S3_BUCKET (or set LOCAL_STORAGE=true)
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

On Linux/macOS, activate the venv with:

```bash
source .venv/bin/activate
```

## Service URLs

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3000`
- AI Service: `http://localhost:8001`
- Postgres: `localhost:5432`
- Redis: `localhost:6379`

## Document Processing Flow

1. Frontend requests a pre-signed upload URL from the backend.
2. Browser uploads the file directly to S3.
3. Frontend confirms the upload.
4. Backend enqueues a BullMQ document-processing job.
5. Worker marks the document `processing`.
6. Worker calls AI service `/process`.
7. AI service downloads from S3, preprocesses pages, runs OCR, extracts structured data, and returns confidence.
8. Worker stores raw text, structured data, and confidence.
9. Worker sets status:
   - `extracted` when confidence is at least `0.4` and document type is known
   - `review_required` when confidence is below `0.4` or document type is `unknown`
10. CA reviews, edits, and approves the extraction.
11. Approved documents can be exported to TallyPrime XML.

Upload verification: because the browser uploads straight to S3, confirm (step 3) checks the object that actually arrived — its real size against `MAX_UPLOAD_MB` and its leading bytes against the file type's signature. A file that fails is deleted and no document is created or queued.

Failures: if OCR, the AI service, or the LLM call fails (including Groq rate limits after the AI service's own retries), the attempt fails and the document returns to `uploaded` with the reason in `processing_error`. BullMQ retries it up to 3 times with exponential backoff; the Review page shows the reason, and after the last attempt firm admins get an in-app notification and email. **Reprocess** (admin only) starts a fresh set of attempts.

## OCR And AI Notes

- PaddleOCR is the primary OCR engine (CPU-only, lazy-loaded on first use — no model download at service startup).
- Tesseract is the fallback when PaddleOCR fails or returns too little text.
- Docker installs English and Hindi Tesseract language packs, plus `libgomp1` for PaddlePaddle.
- Scanned PDFs are OCR'd up to 40 pages (`MAX_OCR_PAGES`), skipping blank pages. Digital bank statements are read from their own text layer up to 100 pages (`MAX_TEXT_LAYER_PAGES`) and extracted a few pages per LLM call. Longer documents are flagged on the Review page.
- LLM extraction uses Groq (`llama-3.3-70b-versatile` by default, overridable with `GROQ_MODEL`) with a prompt tuned for Indian invoices, bills, GST, TDS, HSN, OCR corrections, and wrong-document detection.
- Groq calls are retried in-service on timeouts, rate limits (`408`/`429`), and `5xx`; any other `4xx` (bad request, auth, decommissioned model) fails immediately. A failed or malformed LLM response makes `/process` return `503`, so the backend queue retries the document instead of storing an empty extraction.
- Server-side confidence adjustment caps confidence for missing critical fields, invalid GSTIN, and tax math mismatch.

## Standalone Tools

Bank Statement to Tally XML:

- Endpoint: `POST /api/tools/bank-statement-xml`
- Accepts bank statement PDFs.
- Uses digital table extraction when possible and OCR fallback for scanned statements.
- Returns structured JSON containing XML, voucher count, skipped row count, scanned/digital flag, and row warnings.

Excel Register Cleaner:

- Endpoint: `POST /api/tools/register-clean`
- Accepts `.xlsx` and `.xls`.
- Cleans and standardizes purchase register Excel files.
- Downloads a formatted `.xlsx`; it does not produce Tally XML.

## Testing

CI (`.github/workflows/ci.yml`) runs all of these on every pull request.

Backend unit tests (Jest, no external services needed):

```bash
cd backend
npm install
npm test
```

Backend integration tests (RLS isolation, refresh-token reuse, edit locks — need a live, migrated Postgres):

```bash
cd backend
npm run test:integration
```

Frontend tests (Vitest + Testing Library):

```bash
cd frontend
npm install
npm test
```

AI service tests (Python 3.12; installs only the light test dependencies, not PaddleOCR — same as CI):

```bash
cd ai-service
grep -E '^(groq|httpx|python-dotenv|opencv-python-headless|PyMuPDF|numpy)==' requirements.txt > requirements-light.txt
pip install -r requirements-dev.txt -r requirements-light.txt
python -m pytest tests/ -v
```

## Useful Commands

Backend syntax check:

```bash
cd backend
node --check src/workers/document-processing.worker.js
```

Frontend production build:

```bash
cd frontend
npm run build
```

AI service compile checks:

```bash
cd ai-service
python -m py_compile app/services/ocr_service.py
python -m py_compile app/services/llm_service.py
python -m py_compile app/services/preprocess_service.py
python -m py_compile app/main.py
```

Run migrations:

```bash
cd backend
npm run migrate:latest
```

Rollback latest migration:

```bash
cd backend
npm run migrate:rollback
```

## Important API Areas

Auth:

- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/magic/:token`

Clients:

- `GET /api/clients`
- `POST /api/clients`
- `GET /api/clients/:id`
- `PUT /api/clients/:id`
- `DELETE /api/clients/:id`
- `POST /api/clients/:id/request-docs`

Documents:

- `POST /api/documents/upload`
- `POST /api/documents/confirm`
- `GET /api/documents/:id`
- Public upload: `POST /api/upload/:token/documents/upload`
- Public confirm: `POST /api/upload/:token/documents/confirm`

Review and extraction:

- `GET /api/extractions/:documentId`
- `PUT /api/extractions/:documentId`
- `POST /api/extractions/:documentId/approve`
- `POST /api/extractions/:documentId/reprocess`
- `GET /api/documents/:documentId/versions`

Exports:

- `POST /api/export/tally`
- `POST /api/export/bulk`
- `POST /api/export/preview`
- `GET /api/export/history`
- `GET /api/export/:id/download`

Tools:

- `POST /api/tools/bank-statement-xml`
- `POST /api/tools/register-clean`

## Frontend Routes

- `/login`
- `/dashboard`
- `/clients`
- `/clients/:id`
- `/clients/:id/documents`
- `/review/:doc_id`
- `/export`
- `/tools`
- `/upload/:token`
- `/upload/status/:token`
- `/gst-reconciliation`
- `/settings`
- `/team`

## Security Notes

- Tenant isolation is enforced with PostgreSQL RLS and firm context.
- Protected backend routes require JWT authentication.
- Refresh tokens are stored as `httpOnly` cookies.
- AI service calls are protected with `X-AI-Service-Token`.
- Upload URLs expire, and every presigned upload is verified on confirm (real size + file signature); rejected objects are deleted.
- Auth endpoints are rate limited per client IP: login at 10 attempts per account and 100 per IP per 15 minutes; token refresh/logout on a separate, larger budget so active sessions never lock each other out. Firm and client-portal budgets are independent.
- Password-reset responses never reveal whether an account exists, and never include the reset link in production.
- The backend refuses to start as a Postgres superuser (RLS would be silently bypassed).
- Tool upload sizes are capped by `MAX_TOOL_UPLOAD_MB`.
- Audit logs are written for critical document and extraction actions.

## Git Hygiene

The root `.gitignore` excludes local dependencies, virtual environments, build outputs, logs, caches, temp files, and environment files. Keep `.env.example` committed, but never commit real `.env` files or secrets.
