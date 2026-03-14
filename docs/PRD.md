# CA SAAS PLATFORM
## Product Requirements Document & Technical Architecture
**Version 1.0** | **MVP Build**

---

React + Node.js | PostgreSQL | AWS S3 | 4 MVP Modules

---

## PART 1 — PRODUCT REQUIREMENTS DOCUMENT (PRD)

### 1. Executive Summary
CA firms across India are losing hours every day to document chaos. Clients send invoices, bank statements, and bills through WhatsApp, Gmail, and physical handovers — with no central system to track, manage, or process them. This platform solves that by giving CA firms a unified workspace where clients upload documents, AI processes them, and accountants push clean data directly into Tally.

| Feature | Details |
| :--- | :--- |
| **Product Name** | CA SaaS Platform (Internal codename: TallyFlow) |
| **Target Users** | Chartered Accountant firms, Tax consultants, Bookkeeping agencies |
| **Tech Stack** | React (Frontend) + Node.js (Backend) + PostgreSQL + AWS S3 |
| **MVP Modules** | Client Management, Document Upload Portal, OCR + AI Extraction, Tally Export |
| **Market** | 350,000+ CAs in India, millions of SMB clients |

### 2. Problem Statement
The core problem is not accounting — it is document chaos before accounting begins.

*   **Channel Fragmentation:** Clients send documents via WhatsApp, Gmail, and physical copies — scattered across multiple channels.
*   **No Visibility:** CA firms have no central system to track which client sent what, and what is pending.
*   **Manual Entry:** Accountants manually re-enter data into Tally, which is slow, error-prone, and expensive.
*   **Compliance Risk:** Compliance deadlines are tracked in spreadsheets or memory, leading to missed filings.

### 3. Target Users

#### 3.1 Primary User — The CA Firm (Admin)
*   Manages 20–500 clients simultaneously.
*   Needs to know: what documents have arrived, what is missing, what is processed.
*   Currently uses WhatsApp groups and Gmail labels to manage this — manually.
*   Wants to push finalized entries directly into Tally without re-typing.

#### 3.2 Secondary User — The Client
*   Small business owner or finance manager at the client company.
*   Currently forwards bills and statements to CA via WhatsApp or email.
*   Wants a simple, low-friction way to submit documents from their phone.
*   Wants to see their compliance status without calling their CA.

### 4. MVP Feature Modules

#### Module 1 — Client Management (CA Side)
The central command center for the CA firm. Every client, their documents, and their status is visible in one place.

| Feature | Description | Priority |
| :--- | :--- | :--- |
| Client Directory | Add, edit, and manage all CA clients with contact details and firm info | P0 — Must Have |
| Document Inbox per Client | Every client has a dedicated document feed showing received, pending, and processed files | P0 — Must Have |
| Status Dashboard | Bird's eye view of all clients: who has submitted, who has not, what deadlines are near | P0 — Must Have |
| Document Request Triggers | CA can request specific documents from clients with a single click | P1 — Should Have |
| Compliance Calendar | GST, TDS, ITR deadlines tracked per client with automated reminders | P1 — Should Have |
| Firm-level Analytics | Total documents processed, pending reviews, productivity metrics | P2 — Nice to Have |

#### Module 2 — Document Upload Portal (Client Side)
A frictionless interface for clients to submit documents — designed to be simpler than sending a WhatsApp message.

| Feature | Description | Priority |
| :--- | :--- | :--- |
| Magic Link Upload | CA sends a unique link to the client. Client taps it, uploads files. No account creation required for basic uploads. | P0 — Must Have |
| Secure Client Login | Full client portal with login for clients who want to track their own status | P0 — Must Have |
| Multi-file Upload | Support for PDFs, JPGs, PNGs, and Excel files in a single submission | P0 — Must Have |
| Document Type Tagging | Client labels what they are uploading: Invoice, Bank Statement, Bill, Other | P1 — Should Have |
| Upload History | Clients can see what they have previously submitted and its current status | P1 — Should Have |
| WhatsApp-style Messaging | In-platform messaging between CA and client to replace WhatsApp for document requests | P2 — Nice to Have |

#### Module 3 — OCR + AI Extraction
The intelligence layer. Once a document arrives, the system automatically reads it and extracts structured financial data for the accountant to review.

| Feature | Description | Priority |
| :--- | :--- | :--- |
| Invoice OCR | Extract vendor name, invoice number, date, GST number, line items, total, and tax breakdown from scanned or digital invoices | P0 — Must Have |
| Bank Statement Parsing | Parse bank statement PDFs to extract transaction rows: date, description, debit, credit, balance | P0 — Must Have |
| AI Transaction Classification | Automatically categorize transactions into accounting heads (Rent, Salary, Purchase, etc.) | P0 — Must Have |
| Confidence Scoring | Flag low-confidence extractions for manual review by the accountant | P0 — Must Have |
| Review Interface | Accountant reviews AI output side-by-side with the original document before approval | P0 — Must Have |
| Multi-language Support | Handle invoices in Hindi, Tamil, Gujarati, and other regional languages | P2 — Nice to Have |

#### Module 4 — Tally Export
The final mile. Once the accountant approves the extracted data, it is formatted and pushed into Tally as ready-to-import XML vouchers.

| Feature | Description | Priority |
| :--- | :--- | :--- |
| Tally XML Generation | Convert approved accounting entries into Tally-compatible XML format (TallyPrime and Tally ERP 9) | P0 — Must Have |
| Voucher Type Mapping | Map transaction types to correct Tally voucher types: Purchase, Sales, Payment, Receipt, Journal | P0 — Must Have |
| Ledger Auto-Mapping | Map extracted vendor/client names to Tally ledger names with manual override option | P0 — Must Have |
| Batch Export | Export multiple vouchers at once for a time period or client | P1 — Should Have |
| Export Log | Track every export: what was sent to Tally, when, and by whom | P1 — Should Have |
| Zoho Books Export | Secondary export format for firms not using Tally | P2 — Nice to Have |

### 5. User Stories

**CA Firm (Admin) Stories**
*   As a CA, I want to add clients and see all their documents in one place, so I stop searching WhatsApp and Gmail for files.
*   As a CA, I want to send my client a link and have them upload documents directly, so I no longer receive files on personal WhatsApp.
*   As a CA, I want AI to read invoices and extract the key data, so my team spends time reviewing — not typing.
*   As a CA, I want to export approved entries to Tally in one click, so there is no manual re-entry.
*   As a CA, I want to see which clients have not submitted their documents this month, so I can chase them proactively.

**Client Stories**
*   As a client, I want to upload my invoices from my phone without creating an account, so it is as easy as WhatsApp.
*   As a client, I want to see which documents I have submitted and which are still pending, so I do not have to call my CA.
*   As a client, I want to know my GST filing status without asking my CA, so I have peace of mind.

### 6. Out of Scope for MVP
The following features are explicitly excluded from the first release to keep the team focused:
*   Mobile apps (iOS / Android) — web-first, mobile-responsive only.
*   Direct Tally API sync (real-time) — MVP uses XML file export/import.
*   Multi-language UI — English only for MVP.
*   AI-generated financial reports or analysis.
*   Payment gateway or billing integration.
*   Third-party accounting software integration beyond Tally.

### 7. Success Metrics

| Metric | MVP Target | 6-Month Target |
| :--- | :--- | :--- |
| CA Firms Onboarded | 10 pilot firms | 100+ firms |
| Documents Processed / Month | 500+ | 10,000+ |
| OCR Accuracy | >85% on clean scans | >92% across all docs |
| Client Upload Adoption | 50% of clients using portal | 80%+ of clients |
| Time Saved per Document | 3 min vs manual entry | 5 min per document |
| Tally Export Success Rate | >95% valid XML | >99% valid XML |

---

## PART 2 — TECHNICAL ARCHITECTURE

### 8. System Architecture Overview
The platform follows a layered, service-oriented architecture with a React frontend, Node.js REST API backend, PostgreSQL database, AWS S3 for document storage, and a dedicated AI processing service for OCR and extraction.

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| Frontend | React 18 + Vite + TailwindCSS | CA Dashboard, Client Upload Portal, Review Interface |
| Backend API | Node.js + Express.js | REST API, Auth, Business Logic, Queue Management |
| Database | PostgreSQL 15 | Users, Clients, Documents, Transactions, Audit Logs |
| File Storage | AWS S3 | Secure document storage with signed URLs |
| AI Service | Python FastAPI + Tesseract / AWS Textract | OCR extraction, AI classification |
| Queue | Redis + BullMQ | Async document processing jobs |
| Auth | JWT + Refresh Tokens | CA admin auth + client magic link auth |
| Export Layer | Node.js XML builder | Generate Tally-compatible XML vouchers |

### 9. Database Schema

#### Core Tables

**firms**
Stores CA firm details. Each firm is an isolated tenant.
*   `id`: UUID (PK) — Unique firm identifier
*   `name`: VARCHAR(255) — CA firm name
*   `owner_email`: VARCHAR(255) — Primary admin email
*   `plan`: ENUM (starter | professional | enterprise)
*   `created_at`: TIMESTAMP — Account creation timestamp

**clients**
Each CA firm's clients. Linked to the firm via `firm_id`.
*   `id`: UUID (PK) — Unique client identifier
*   `firm_id`: UUID (FK) — Parent CA firm
*   `name`: VARCHAR(255) — Client business name
*   `gstin`: VARCHAR(15) — GST Identification Number
*   `email`: VARCHAR(255) — Client contact email
*   `phone`: VARCHAR(15) — Client WhatsApp/contact number
*   `upload_token`: VARCHAR(64) — Unique magic link token for passwordless upload
*   `status`: ENUM (active | inactive | pending)

**documents**
Every document uploaded by a client or added manually by the CA.
*   `id`: UUID (PK) — Document identifier
*   `client_id`: UUID (FK) — Linked client
*   `firm_id`: UUID (FK) — Linked CA firm
*   `file_name`: VARCHAR(255) — Original file name
*   `s3_key`: TEXT — AWS S3 object key for secure retrieval
*   `doc_type`: ENUM (invoice | bank_statement | bill | other)
*   `status`: ENUM (uploaded | processing | extracted | reviewed | exported)
*   `uploaded_at`: TIMESTAMP — Time of upload

**extractions**
AI-extracted data from each document. One row per document.
*   `id`: UUID (PK) — Extraction record identifier
*   `document_id`: UUID (FK) — Source document
*   `raw_text`: TEXT — Full OCR text output
*   `structured_data`: JSONB — Parsed JSON: vendor, date, amounts, line items
*   `confidence_score`: FLOAT — 0.0 to 1.0 — flags low-confidence for review
*   `reviewed_by`: UUID (FK) — CA staff who approved the extraction
*   `reviewed_at`: TIMESTAMP — Approval timestamp

**tally_exports**
Tracks every export operation sent to Tally.
*   `id`: UUID (PK) — Export record
*   `firm_id`: UUID (FK) — CA firm that triggered export
*   `client_id`: UUID (FK) — Client whose data was exported
*   `document_ids`: UUID[] — Array of documents in this export batch
*   `xml_s3_key`: TEXT — S3 path to generated Tally XML file
*   `exported_by`: UUID (FK) — CA staff who triggered the export
*   `exported_at`: TIMESTAMP — Export timestamp
*   `status`: ENUM (generated | downloaded | failed)

### 10. API Design (REST Endpoints)

#### Authentication
*   `POST /api/auth/login`: CA firm admin login — returns JWT access + refresh token
*   `POST /api/auth/refresh`: Refresh expired JWT access token
*   `POST /api/auth/logout`: Invalidate refresh token
*   `GET /api/auth/magic/:token`: Validate client magic link upload token

#### Clients
*   `GET /api/clients`: List all clients for the authenticated CA firm
*   `POST /api/clients`: Create a new client
*   `GET /api/clients/:id`: Get single client with document summary
*   `PUT /api/clients/:id`: Update client details
*   `DELETE /api/clients/:id`: Soft delete (deactivate) a client
*   `POST /api/clients/:id/request-docs`: Send document request notification to client

#### Documents
*   `GET /api/documents`: List documents (filter by client, status, date)
*   `POST /api/documents/upload`: Get pre-signed S3 URL for secure direct upload
*   `POST /api/documents/confirm`: Confirm upload complete, trigger AI processing queue
*   `GET /api/documents/:id`: Get document metadata and extraction status
*   `DELETE /api/documents/:id`: Delete a document and its S3 object

#### Extractions
*   `GET /api/extractions/:doc_id`: Get AI extraction result for a document
*   `PUT /api/extractions/:doc_id`: Accountant saves corrected extraction data
*   `POST /api/extractions/:doc_id/approve`: Mark extraction as reviewed and approved
*   `POST /api/extractions/:doc_id/reprocess`: Re-trigger OCR on a failed or poor extraction

#### Tally Export
*   `POST /api/export/tally`: Generate Tally XML for approved documents, return download URL
*   `GET /api/export/history`: List past export operations with download links
*   `GET /api/export/:id/download`: Download a previously generated Tally XML file

### 11. AI / OCR Processing Pipeline
Document processing runs asynchronously via a job queue so the user interface never blocks. The pipeline has five stages:

| Step | Stage | Details |
| :--- | :--- | :--- |
| 1 | Ingest | Document uploaded to S3. confirm API call creates a BullMQ job with s3_key and doc_id |
| 2 | Pre-process | Image enhancement (deskew, denoise, contrast boost) using OpenCV for better OCR accuracy on scanned docs |
| 3 | OCR | AWS Textract for structured docs (invoices, forms). Tesseract as fallback for simple scans. Output: raw text + bounding boxes |
| 4 | AI Extraction | LLM prompt (GPT-4o or Claude Sonnet) parses OCR text into structured JSON: vendor, date, gstin, line_items, total, tax |
| 5 | Classification | Rule-based + AI classifier assigns transaction to accounting head (Rent, Purchase, Salary, Utilities, etc.) |
| 6 | Confidence | Each field gets a confidence score. Fields below 0.75 threshold are flagged for mandatory human review |
| 7 | Store | Structured result saved to extractions table. Document status updated. CA notified via in-app alert |

### 12. Tally XML Format
The Tally XML export follows TallyPrime's standard import format. Each approved document generates one or more voucher entries.

*   `ENVELOPE`: Root wrapper element for all Tally imports
*   `HEADER`: Request type: Import, Data, Version 1
*   `BODY > IMPORTDATA`: Container for all vouchers in the batch
*   `REQUESTDESC`: Report name: Vouchers, Static variables: SV_COMPANY
*   `TALLYMESSAGE`: One per voucher. Contains VOUCHER element
*   `VOUCHER`: Type: Purchase/Sales/Payment etc. Date, narration, party name, ledger entries
*   `ALLLEDGERENTRIES`: Debit and credit leg of each double-entry transaction

*Note on Tally Versions: TallyPrime 2.x and above uses a slightly different XML namespace. The export layer must detect and target the correct format. MVP will support TallyPrime. Tally ERP 9 support will be added in Phase 2.*

### 13. Security Architecture
CA firms handle highly sensitive financial data. Security is non-negotiable and must be built in from day one — not added later.

| Area | Implementation |
| :--- | :--- |
| **Data Isolation** | Each CA firm is a separate tenant. Row-level security in PostgreSQL using firm_id on every query. Firms can never access each other's data |
| **Document Storage** | Files stored in private S3 buckets. All access via time-limited pre-signed URLs (15 min expiry). Never exposed via public URLs |
| **Encryption** | AES-256 at rest for all database fields. TLS 1.3 in transit for all API communication |
| **Authentication** | JWT with 15-minute access token + 7-day refresh token. Refresh token stored as httpOnly cookie. Magic links expire after 24 hours and are single-use |
| **Audit Logs** | Every document access, extraction approval, and Tally export is logged with user ID, IP, and timestamp |
| **Input Validation** | All file uploads scanned for malware (ClamAV). Only PDF, JPG, PNG, XLSX accepted. Max 50MB per file |
| **Rate Limiting** | API rate limiting on all endpoints. Upload endpoints: 50 files/hour per client token |

### 14. Development Roadmap

| Phase | Timeline | Modules | Key Deliverables |
| :--- | :--- | :--- | :--- |
| **MVP** | Month 1–3 | All 4 modules | Client mgmt, upload portal, OCR pipeline, Tally XML export, basic dashboard |
| **Phase 2** | Month 4–6 | Compliance + Comms | GST/ITR/TDS reminders, in-app messaging, document request automation, email/WhatsApp notifications |
| **Phase 3** | Month 7–9 | Analytics + Mobile | Analytics dashboard, iOS/Android apps, Tally ERP 9 support, Zoho Books export, multi-language OCR |
| **Phase 4** | Month 10–12 | AI Intelligence | Predictive compliance alerts, AI financial summaries, custom accounting rules engine, workflow automation |

### 15. Pricing Model

| Plan | Price / Month | Clients | Documents / Month |
| :--- | :--- | :--- | :--- |
| **Starter** | ₹1,500 | Up to 20 | 500 documents |
| **Professional** | ₹4,000 | Up to 100 | 3,000 documents |
| **Enterprise** | ₹10,000+ | Unlimited | Unlimited |

*Unit Economics Note: At ₹1,500/month on the Starter plan with ~500 documents, per-document revenue is ₹3. AWS Textract costs approximately ₹1.20 per page for structured extraction. Ensure AI processing costs are modelled against document volume at each tier before finalizing pricing.*

### 16. Team & Resource Requirements

| Role | Count | Responsibility |
| :--- | :--- | :--- |
| Frontend Developer | 1 | React dashboard, client upload portal, review interface |
| Backend Developer | 1 | Node.js API, database, queue, auth, S3 integration |
| AI / Python Developer | 1 | OCR pipeline, extraction service, FastAPI, LLM integration |
| Product / QA | 1 | Requirements, testing, CA firm user research, onboarding |
| Tally Expert (Consultant) | Part-time | Validate XML format, test imports, ledger mapping logic |

**Key Recommendation:**
Before writing a single line of code, get 2–3 CA firms to pilot the platform manually. Let them use the upload portal and give feedback on the review interface. The biggest risk is building OCR that real Indian invoices break. Test with 200 real documents from pilot firms before you call the AI layer production-ready.
