# Verax TallyOCR

Multi-tenant SaaS platform for Chartered Accountant firms in India. Verax TallyOCR handles client document intake, OCR extraction, CA review, compliance checks, and TallyPrime XML export.

## Overview

This monorepo contains:

- `frontend/`: React 18 + Vite + Tailwind web app
- `backend/`: JavaScript Express API, PostgreSQL/Knex migrations, BullMQ worker, S3 upload flow, and Tally XML export
- `ai-service/`: Python 3.12 FastAPI service for preprocessing, OCR, LLM extraction, and standalone tools
- `docker-compose.yml`: local development stack with Postgres, Redis, backend, worker, frontend, and AI service

Core capabilities:

- Firm-level tenant isolation with PostgreSQL RLS
- JWT authentication with refresh-token cookie flow
- Client magic-link uploads and public upload status
- S3 pre-signed uploads/downloads
- Async document processing with Redis + BullMQ
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
|-- ai-service/        # Python FastAPI OCR + extraction service
|-- backend/           # Express API, migrations, workers, services
|-- frontend/          # React/Vite client app
|-- tests/             # Local test scripts and fixtures
|-- docker-compose.yml
|-- docker-compose.prod.yml
|-- .env.example
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

## Production Build (Railway Deployment Target)

`docker-compose.prod.yml` builds the same four application images (`backend`, `worker`, `frontend`, `ai-service`) from their Dockerfiles for production use — `restart: unless-stopped` on every service, no bind mounts to the local filesystem (S3 is required; there is no `LOCAL_STORAGE` fallback), Postgres/Redis with no ports exposed externally, and Docker healthchecks on all six services. `frontend` builds the Vite app and serves it with nginx (`frontend/Dockerfile`, `frontend/nginx.conf`); `ai-service` builds from `ai-service/Dockerfile.prod`, which pre-fetches the PaddleOCR models at build time instead of on first request.

Build and verify locally before deploying:

```bash
docker compose -f docker-compose.prod.yml build
```

Required env vars (see the comment block at the top of `docker-compose.prod.yml`): `POSTGRES_PASSWORD`, `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CLIENT_JWT_SECRET`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `GROQ_API_KEY`, `AI_SERVICE_API_KEY`, `VITE_API_BASE_URL`, `FRONTEND_URL`.

This repo's `backend/Dockerfile`, `frontend/Dockerfile`, and `ai-service/Dockerfile.prod` are each deployable as a standalone Railway service (Railway builds directly from a Dockerfile per service rather than from `docker-compose.yml`). Actual Railway project setup — creating the services, wiring env vars and a Postgres/Redis plugin or external instances, and assigning domains — is a dashboard/CLI step outside this repo.

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

## OCR And AI Notes

- PaddleOCR is the primary OCR engine (CPU-only, lazy-loaded on first use — no model download at service startup).
- Tesseract is the fallback when PaddleOCR fails or returns too little text.
- Docker installs English and Hindi Tesseract language packs, plus `libgomp1` for PaddlePaddle.
- PDF fallback rendering supports up to 15 pages and skips blank pages.
- LLM extraction uses Groq (`llama-3.1-70b-versatile`) with a prompt tuned for Indian invoices, bills, GST, TDS, HSN, OCR corrections, and wrong-document detection.
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
- Upload URLs expire.
- Tool upload sizes are capped by `MAX_TOOL_UPLOAD_MB`.
- Audit logs are written for critical document and extraction actions.

## Git Hygiene

The root `.gitignore` excludes local dependencies, virtual environments, build outputs, logs, caches, temp files, and environment files. Keep `.env.example` committed, but never commit real `.env` files or secrets.
