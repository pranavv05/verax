import PublicLayout from "../components/layout/PublicLayout";
import ClosingCTA from "../components/marketing/ClosingCTA";
import { Section, SectionHead, Eyebrow, Field, Tick, Caret } from "../components/marketing/ledger";
import { Reveal } from "../components/public/motion";

const stats = [
  { value: "6+", label: "Core modules" },
  { value: "16", label: "TDS sections supported" },
  { value: "4", label: "Compliance checks" }
];

const ClientDirectoryVisual = () => (
  <div className="rounded-2xl border border-hairline bg-surface p-5">
    <div className="mb-3 text-sm font-bold text-carbon-900">Client directory</div>
    {[
      { name: "M/s ABC Industries", gstin: "27AAAAA0000A1Z5", docs: 14, status: "Active" },
      { name: "XYZ Traders Pvt Ltd", gstin: "06BBBBB1111B2Y4", docs: 7, status: "Pending" },
      { name: "PQR Enterprises", gstin: "29CCCCC2222C3Z6", docs: 22, status: "Active" }
    ].map((c) => (
      <div key={c.name} className="flex items-center justify-between border-t border-hairline py-2.5 first:border-t-0">
        <div>
          <div className="text-sm font-semibold text-carbon-900">{c.name}</div>
          <div className="vx-mono mt-0.5 text-xs text-carbon-400">{c.gstin}</div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-carbon-400">{c.docs} docs</span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              c.status === "Active" ? "bg-verify-50 text-verify-700" : "bg-amber-50 text-amber-700"
            }`}
          >
            {c.status}
          </span>
        </div>
      </div>
    ))}
  </div>
);

const ExtractionVisual = () => (
  <div className="rounded-2xl border border-hairline bg-surface p-5">
    <div className="mb-3 flex items-center justify-between">
      <span className="text-sm font-bold text-carbon-900">Extracted fields</span>
      <span className="rounded-full bg-verify-50 px-2.5 py-0.5 text-xs font-semibold text-verify-700">Confidence 94%</span>
    </div>
    <div className="space-y-0">
      {[
        { label: "Vendor", value: "ABC Enterprises" },
        { label: "GSTIN", value: "27AAAAA0000A1Z5" },
        { label: "Invoice No.", value: "INV-2024-1193" },
        { label: "Taxable Amt.", value: "₹50,000" },
        { label: "CGST 9%", value: "₹4,500" },
        { label: "Total", value: "₹59,000" }
      ].map((f) => (
        <Field key={f.label} label={f.label} value={f.value} state="valid" />
      ))}
    </div>
  </div>
);

const ComplianceVisual = () => (
  <div className="rounded-2xl border border-hairline bg-surface p-5">
    <div className="mb-3 text-sm font-bold text-carbon-900">Compliance report</div>
    <div className="space-y-2">
      <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3">
        <Caret className="mt-0.5 text-red-500" />
        <div>
          <div className="text-xs font-bold text-red-700">GSTIN checksum invalid</div>
          <div className="text-xs text-red-600">27AAAAA0000A1Z5 — last digit mismatch</div>
        </div>
      </div>
      <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3">
        <Caret className="mt-0.5 text-amber-500" />
        <div>
          <div className="text-xs font-bold text-amber-700">Tax math mismatch</div>
          <div className="text-xs text-amber-600">CGST + SGST = ₹8,900, expected ₹9,000</div>
        </div>
      </div>
      <div className="flex items-start gap-2.5 rounded-lg border border-verify-200 bg-verify-50 p-3">
        <Tick className="mt-0.5 text-verify-600" />
        <div>
          <div className="text-xs font-bold text-verify-700">TDS rate valid</div>
          <div className="text-xs text-verify-600">194C @ 1% — matches section definition</div>
        </div>
      </div>
    </div>
  </div>
);

const ExportVisual = () => (
  <div className="rounded-2xl border border-hairline bg-surface p-5">
    <div className="mb-3 text-sm font-bold text-carbon-900">Export workspace</div>
    <div className="mb-3 rounded-lg border border-hairline bg-well p-3">
      <div className="mb-2 text-xs font-semibold text-carbon-700">Selected documents (3)</div>
      {["Invoice_ABC_Nov.pdf", "BankStmt_Oct.pdf", "Bill_XYZ.pdf"].map((f) => (
        <div key={f} className="flex items-center gap-2 py-1 text-xs text-carbon-600">
          <Tick className="text-verify-600" />
          {f}
        </div>
      ))}
    </div>
    <div className="rounded-lg border border-verify-200 bg-verify-50 p-3 text-center">
      <div className="text-xs font-semibold text-verify-700">Export ready</div>
      <div className="vx-mono mt-0.5 text-xs text-verify-600">tally_export_nov2024.xml · 14.2 KB</div>
    </div>
  </div>
);

const DataToolsVisual = () => (
  <div className="rounded-2xl border border-hairline bg-surface p-5">
    <div className="mb-3 text-sm font-bold text-carbon-900">Data tools</div>
    <div className="space-y-3">
      <div className="rounded-xl border border-hairline bg-well p-4">
        <div className="text-sm font-bold text-carbon-900">Register Cleaner</div>
        <div className="text-xs text-carbon-500">Clean messy GST Excel registers</div>
      </div>
      <div className="rounded-xl border border-hairline bg-well p-4">
        <div className="text-sm font-bold text-carbon-900">Bank Statement → Tally XML</div>
        <div className="text-xs text-carbon-500">PDF to vouchers, rule-based, no LLM</div>
      </div>
    </div>
  </div>
);

const AuditVisual = () => (
  <div className="rounded-2xl border border-hairline bg-surface p-5">
    <div className="mb-3 text-sm font-bold text-carbon-900">Audit log</div>
    <div className="space-y-2">
      {[
        { action: "extraction_approved", user: "CA Rajesh", time: "2 min ago" },
        { action: "tally_export_generated", user: "CA Priya", time: "18 min ago" },
        { action: "document_upload_initiated", user: "Client (magic)", time: "1 hr ago" },
        { action: "user_invited", user: "CA Rajesh", time: "3 hrs ago" }
      ].map((entry) => (
        <div key={entry.action + entry.time} className="flex items-center justify-between rounded-lg border border-hairline bg-well px-3 py-2">
          <div>
            <span className="vx-mono rounded bg-surface px-2 py-0.5 text-xs font-semibold text-carbon-700">
              {entry.action.replace(/_/g, " ")}
            </span>
            <div className="mt-0.5 text-xs text-carbon-400">{entry.user}</div>
          </div>
          <span className="text-xs text-carbon-400">{entry.time}</span>
        </div>
      ))}
    </div>
  </div>
);

const features = [
  {
    tag: "Client management",
    headline: "Every client. Every document. Fully organized.",
    body: "Build a complete client roster with GSTIN, contact info, and status. Generate secure magic links for document uploads. Track processing and export status per client in real time.",
    points: [
      "GSTIN stored and validated per client profile",
      "One-click upload link generation (24-hour expiry, auto-rotate)",
      "Document summary: total, pending, reviewed, exported counts",
      "Search and filter across name, email, phone, and GSTIN",
      "Status tracking: Active, Pending, or Inactive"
    ],
    visual: <ClientDirectoryVisual />
  },
  {
    tag: "AI extraction",
    headline: "OCR that actually understands accounting documents.",
    body: "PaddleOCR (with Tesseract fallback) reads invoices, bills, and bank statements; a Groq LLM turns the text into structured JSON. Not just text — line items, tax breakdowns, account metadata, and transaction tables.",
    points: [
      "Invoices: vendor, GSTIN, invoice no., date, line items, HSN codes, CGST/SGST/IGST, TDS",
      "Bank statements: account details, all transactions with narration, debit/credit/balance",
      "Bills: same structure as invoices with payable handling",
      "Handles scanned PDFs, phone photos, and multi-page documents",
      "Confidence score per document; low-confidence flagged for review"
    ],
    visual: <ExtractionVisual />
  },
  {
    tag: "Compliance engine",
    headline: "Catch errors before they reach your client's filing.",
    body: "Every extraction runs through automatic compliance checks. Errors and warnings appear inline next to the affected field so you know exactly what to fix.",
    points: [
      "GSTIN: 15-char format, state code, PAN pattern, checksum (base-36 weighted algorithm)",
      "Tax math: CGST + SGST + IGST must equal tax_amount; taxable + tax must equal total",
      "TDS: rate validated against 16 defined sections (194C, 194J, 194I, 194H and 12 more)",
      "Duplicate: same vendor GSTIN + invoice number already approved? Warning shown instantly"
    ],
    visual: <ComplianceVisual />
  },
  {
    tag: "Tally XML export",
    headline: "One click from reviewed document to TallyPrime.",
    body: "Select a client, pick documents, generate. The XML is built to balance by construction — debits always equal credits — and uploaded to S3 for immediate download. Re-download from history any time.",
    points: [
      "Purchase vouchers for invoices and bills",
      "Payment and Receipt vouchers for bank statement transactions",
      "Inventory entries with Tally stock item names, HSN, UOM, and rates",
      "CGST, SGST, IGST ledger entries auto-computed",
      "Export blocked automatically if a document's tax math doesn't reconcile"
    ],
    visual: <ExportVisual />
  },
  {
    tag: "Data tools",
    headline: "Standalone utilities for your most common tasks.",
    body: "Two tools that work independently of the document pipeline — for batch processing and bank-statement bulk conversion.",
    points: [
      "Register Cleaner: normalize messy GST purchase/sales Excel registers",
      "Bank Statement XML: convert PDF bank statements directly to Tally XML using pdfplumber (no LLM, rule-based)",
      "Both tools are instant — upload and download, no queues",
      "Handles merged cells, repeat headers, multi-sheet workbooks",
      "Bank converter creates Receipt/Payment vouchers per transaction"
    ],
    visual: <DataToolsVisual />
  },
  {
    tag: "Security & audit",
    headline: "Every action logged. Every firm isolated.",
    body: "Multi-tenant architecture with PostgreSQL Row-Level Security enforces strict data boundaries — no firm can ever see another firm's data. Every critical action is logged with user, timestamp, and metadata.",
    points: [
      "PostgreSQL RLS — every query scoped to your firm_id by the database itself",
      "JWT access tokens (15 min) + httpOnly refresh cookies (7 days) with chain rotation",
      "Magic link tokens expire after 24 hours and rotate after each use",
      "Audit log: document uploads, approvals, exports, team changes, settings updates",
      "Soft deletes only — no data is ever permanently destroyed"
    ],
    visual: <AuditVisual />
  }
];

const FeaturesPage = () => (
  <PublicLayout>
    {/* Hero */}
    <Section className="pt-20 sm:pt-28">
      <Reveal className="mx-auto max-w-[46rem] text-center">
        <Eyebrow className="justify-center">Platform features</Eyebrow>
        <h1 className="vx-display-xl mt-6">
          Built for the way
          <br />
          CAs actually work.
        </h1>
        <p className="vx-body mx-auto mt-7 max-w-[36rem]">
          Every feature designed with Indian CA practice in mind — from GSTIN
          checksum validation to TallyPrime voucher formats.
        </p>
      </Reveal>

      <Reveal delay={0.1} className="mx-auto mt-14 grid max-w-2xl grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-hairline bg-surface p-4 text-center">
            <div className="vx-nums text-2xl font-extrabold text-carbon-900">{s.value}</div>
            <div className="mt-1 text-xs font-medium text-carbon-500">{s.label}</div>
          </div>
        ))}
      </Reveal>
    </Section>

    {/* Feature sections */}
    <Section>
      <div className="space-y-24">
        {features.map((f, i) => (
          <div key={f.tag} className="grid items-center gap-12 lg:grid-cols-2">
            <Reveal className={i % 2 === 1 ? "lg:order-2" : ""}>
              <Eyebrow>{f.tag}</Eyebrow>
              <h2 className="vx-h2-xl mt-5 text-[1.85rem]">{f.headline}</h2>
              <p className="vx-body mt-5 max-w-[32rem]">{f.body}</p>
              <ul className="mt-6 space-y-3">
                {f.points.map((p) => (
                  <li key={p} className="flex items-start gap-3 text-sm text-carbon-600">
                    <Tick className="mt-1 text-verify-600" />
                    {p}
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={0.1} className={i % 2 === 1 ? "lg:order-1" : ""}>
              {f.visual}
            </Reveal>
          </div>
        ))}
      </div>
    </Section>

    <ClosingCTA />
  </PublicLayout>
);

export default FeaturesPage;
