# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Verax TallyOCR — AI-powered document processing SaaS for Indian CA firms. Extracts structured data from invoices/bank statements via OCR + LLM, lets users review/edit, then exports TallyPrime-compatible XML.

## Development Commands

### Backend (Node.js/Express)
```bash
cd backend
npm run dev                   # API server with nodemon (port 3000)
npm run worker:documents:dev  # BullMQ document processing worker with nodemon
npm run migrate:latest        # Run Knex migrations
npm run migrate:rollback      # Rollback last migration batch
npm run seed:admin            # Seed admin user
```

### Frontend (React/Vite)
```bash
cd frontend
npm run dev      # Vite dev server (port 5173)
npm run build    # Production build
```

### AI Service (Python/FastAPI)
```bash
cd ai-service
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

### Docker (full stack)
```bash
docker compose up              # All services: postgres, redis, backend, frontend, ai-service, worker
docker compose up postgres redis  # Just infra for local dev
```

## Architecture

**Three-service monorepo**: `backend/` (Express API + BullMQ worker), `frontend/` (React SPA), `ai-service/` (FastAPI + OCR + LLM).

### Multi-Tenancy
PostgreSQL Row Level Security (RLS) enforces firm-level data isolation. Every request sets `app.current_firm_id` via `withTenantTransaction()` in `backend/src/db/tenant-context.js`. All tables have RLS policies — **never bypass this** by running queries outside the tenant transaction wrapper.

### Auth
JWT access tokens (15 min) + httpOnly refresh token cookies (7 days) with chain rotation. Magic link tokens (64-char hex) on `clients.upload_token` enable public document uploads without login. Token utilities in `backend/src/utils/token-utils.js`.

### Document Processing Pipeline
1. Browser uploads directly to S3 via presigned URL (backend never touches file bytes)
2. Backend creates `documents` record + enqueues BullMQ job
3. Worker (`backend/src/workers/document-processing.worker.js`) calls AI service `/process`
4. AI service: S3 (or local disk, if `LOCAL_STORAGE=true`) download → image preprocessing → OCR (PaddleOCR primary, Tesseract fallback) → LLM extraction (Groq `llama-3.1-70b-versatile`) → structured JSON
5. Extraction stored in `extractions` table as JSONB `structured_data`
6. User reviews/edits on ReviewPage, approves → status becomes `reviewed`
7. Export: reviewed docs → Tally XML with inventory entries → S3 → presigned download

### Name Mapping Memory
When users correct item names (vendor's raw name → Tally stock item name) and approve, the mapping is saved to `item_name_mappings` table per firm. On subsequent extractions, exact matches auto-fill and fuzzy suggestions appear via Levenshtein distance scoring in `backend/src/services/name-mapping.service.js`.

### Compliance Validation
`backend/src/services/compliance.service.js` runs GSTIN checksum validation, tax math cross-checks (CGST+SGST+IGST vs total), TDS rate verification against section table, and duplicate invoice detection. Results returned inline with extraction data.

## Key Patterns

- **Route → Service → DB**: Routes in `backend/src/routes/` call service functions in `backend/src/services/`. Services receive `db` (tenant-scoped transaction client) as first arg.
- **Validation**: Joi schemas in route files, validated via `validate.middleware.js`. Frontend uses Zod.
- **Error handling**: Throw `ApiError` (from `backend/src/utils/api-error.js`) with factory methods: `.badRequest()`, `.notFound()`, `.unauthorized()`, `.forbidden()`, `.conflict()`. Caught by `error.middleware.js`.
- **Audit logging**: All critical operations insert into `audit_logs` table within the same tenant transaction.
- **Frontend API layer**: `frontend/src/api/*.js` modules call `request()` from `frontend/src/lib/api-client.js` which handles Bearer token injection, 401 retry with refresh, and httpOnly cookie credentials.

## Environment

Copy `.env.example` to `.env`. Required: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `GROQ_API_KEY` (ai-service). `AWS_S3_BUCKET`/`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` are required unless `LOCAL_STORAGE=true`. Full validation in `backend/src/config/env.js` (backend) and `ai-service/app/config.py` (ai-service).

## Database

PostgreSQL 15 with Knex migrations in `backend/migrations/`. Tables: `firms`, `users`, `clients`, `documents`, `extractions`, `tally_exports`, `audit_logs`, `refresh_tokens`, `document_upload_sessions`, `waitlist`, `item_name_mappings`. All have RLS enabled.
