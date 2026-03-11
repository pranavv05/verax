# CA SaaS Platform

Multi-tenant SaaS platform for Chartered Accountant firms in India.

## Overview

This monorepo contains:
- `frontend`: React 18 + Vite + Tailwind web app
- `backend`: Node.js + Express API (JWT auth, tenant isolation, S3 upload flow, queue producer, Tally export)
- `ai-service`: Python FastAPI microservice (OCR + LLM extraction pipeline)
- `docker-compose.yml`: local multi-service environment (Postgres, Redis, backend, worker, frontend, ai-service)

Core capabilities:
- Firm-level tenant isolation with PostgreSQL RLS
- JWT auth (short-lived access token + refresh cookie)
- Client magic-link document uploads
- S3 pre-signed uploads/downloads
- Async document processing with BullMQ + Redis
- OCR pipeline (AWS Textract primary, Tesseract fallback)
- TallyPrime XML generation and export history

## Project Structure

```text
/
|-- frontend/
|-- backend/
|-- ai-service/
|-- docker-compose.yml
`-- .env.example
```

## Tech Stack

- Frontend: React 18, Vite, TailwindCSS, Zod
- Backend: Node.js, Express.js, PostgreSQL 15, Joi
- AI Service: Python FastAPI, OpenCV, Textract, Tesseract, OpenAI
- Queue: Redis + BullMQ
- Storage: AWS S3

## Quick Start (Docker)

### 1) Configure environment

Create `.env` at repo root from `.env.example` and fill required values:

```bash
cp .env.example .env
# PowerShell:
# Copy-Item .env.example .env
```

Required minimum:
- `DATABASE_URL`
- `REDIS_URL`
- `AWS_REGION`
- `AWS_S3_BUCKET`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `OPENAI_API_KEY`
- `AI_SERVICE_URL`
- `FRONTEND_URL`

### 2) Start services

```bash
docker compose up --build
```

### 3) Run migrations (backend container)

```bash
docker compose exec backend npm run migrate:latest
```

## Local Development (Without Docker)

### Backend

```bash
cd backend
npm install
npm run migrate:latest
npm run dev
```

### Document Worker

```bash
cd backend
npm run worker:documents
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### AI Service

```bash
cd ai-service
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

## Service URLs (Default)

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3000`
- AI Service: `http://localhost:8001`
- Postgres: `localhost:5432`
- Redis: `localhost:6379`

## API Highlights

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
- Public upload: `POST /api/upload/:token/documents/upload`
- Public confirm: `POST /api/upload/:token/documents/confirm`

Exports:
- `POST /api/export/tally`
- `GET /api/export/history`
- `GET /api/export/:id/download`

## Frontend Routes

- `/login`
- `/dashboard`
- `/clients`
- `/clients/:id`
- `/clients/:id/documents`
- `/review/:doc_id`
- `/export`
- `/upload/:token` (public, no login)

## Upload + Processing Flow

1. Frontend requests pre-signed URL from backend
2. Browser uploads file directly to S3
3. Frontend confirms upload
4. Backend enqueues BullMQ job
5. Worker calls AI service `/process`
6. Extraction is persisted and document status updated

## Security Notes

- Tenant isolation enforced with PostgreSQL RLS and firm context
- JWT required for protected routes
- Refresh token stored as `httpOnly` cookie
- Upload URLs expire (default 15 minutes)
- Upload route rate limits applied
- Audit logs captured for critical actions

## Build Check

Frontend production build can be verified with:

```bash
cd frontend
npm run build
```

## Next Recommended Repo Hygiene

Before pushing to GitHub, ensure a `.gitignore` exists for:
- `node_modules/`
- `dist/`
- `.env`
- Python cache files
