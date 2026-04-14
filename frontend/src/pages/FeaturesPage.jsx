import { Link } from "react-router-dom";
import PublicLayout from "../components/layout/PublicLayout";

const Check = () => (
  <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-mint-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const features = [
  {
    tag: "Client Management",
    headline: "Every client. Every document. Fully organized.",
    body: "Build a complete client roster with GSTIN, contact info, and status. Generate secure magic links for document uploads. Track processing and export status per client in real time.",
    points: [
      "GSTIN stored and validated per client profile",
      "One-click upload link generation (72-hour expiry, auto-rotate)",
      "Document summary: total, pending, reviewed, exported counts",
      "Search and filter across name, email, phone, and GSTIN",
      "Status tracking: Active, Pending, or Inactive",
    ],
    visual: (
      <div className="rounded-xl border border-[#e7dcc8] bg-white p-5 shadow-soft">
        <div className="mb-3 text-sm font-bold text-ink-900">Client directory</div>
        {[
          { name: "M/s ABC Industries", gstin: "27AAAAA0000A1Z5", docs: 14, status: "Active", statusColor: "bg-mint-500/10 text-mint-600" },
          { name: "XYZ Traders Pvt Ltd", gstin: "06BBBBB1111B2Y4", docs: 7, status: "Pending", statusColor: "bg-amber-100 text-amber-700" },
          { name: "PQR Enterprises", gstin: "29CCCCC2222C3Z6", docs: 22, status: "Active", statusColor: "bg-mint-500/10 text-mint-600" },
        ].map((c) => (
          <div key={c.name} className="flex items-center justify-between border-t border-[#f0e8d8] py-2.5">
            <div>
              <div className="text-sm font-semibold text-ink-900">{c.name}</div>
              <div className="mt-0.5 font-mono text-xs text-ink-400">{c.gstin}</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-ink-400">{c.docs} docs</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.statusColor}`}>{c.status}</span>
            </div>
          </div>
        ))}
        <button className="btn-primary mt-3 w-full text-xs py-2">Request documents →</button>
      </div>
    ),
    accent: "from-indigo-500/5 to-indigo-500/10",
  },
  {
    tag: "AI Extraction",
    headline: "OCR that actually understands accounting documents.",
    body: "GPT-4o reads invoices, bills, and bank statements and returns structured JSON. Not just text — it understands line items, tax breakdowns, account metadata, and transaction tables.",
    points: [
      "Invoices: vendor, GSTIN, invoice no., date, line items, HSN codes, CGST/SGST/IGST, TDS",
      "Bank statements: account details, all transactions with narration, debit/credit/balance",
      "Bills: same structure as invoices with payable handling",
      "Handles scanned PDFs, phone photos, and multi-page documents",
      "Confidence score per document; low-confidence flagged for review",
    ],
    visual: (
      <div className="rounded-xl border border-[#e7dcc8] bg-white p-5 shadow-soft">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-bold text-ink-900">Extracted fields</span>
          <span className="rounded-full bg-mint-500/10 px-2.5 py-0.5 text-xs font-semibold text-mint-600">Confidence 94%</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Vendor", value: "ABC Enterprises" },
            { label: "GSTIN", value: "27AAAAA0000A1Z5" },
            { label: "Invoice No.", value: "INV-2024-1193" },
            { label: "Date", value: "12 Nov 2024" },
            { label: "Taxable Amt.", value: "₹50,000" },
            { label: "CGST 9%", value: "₹4,500" },
            { label: "SGST 9%", value: "₹4,500" },
            { label: "Total", value: "₹59,000" },
          ].map((f) => (
            <div key={f.label} className="rounded-lg bg-sand-50/80 px-2.5 py-2 text-xs">
              <div className="text-ink-400">{f.label}</div>
              <div className="mt-0.5 font-semibold text-ink-900">{f.value}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-lg border border-[#e7dcc8] p-2.5">
          <div className="mb-1.5 text-xs font-bold text-ink-700">Line items (2)</div>
          <div className="text-xs text-ink-500">HDPE Pipe DN25 · Qty 100 · ₹250 · ₹25,000</div>
          <div className="mt-1 text-xs text-ink-500">Gate Valve 25mm · Qty 50 · ₹500 · ₹25,000</div>
        </div>
      </div>
    ),
    accent: "from-mint-500/5 to-mint-500/10",
  },
  {
    tag: "Compliance Engine",
    headline: "Catch errors before they reach your client's filing.",
    body: "Every extraction runs through four automatic compliance checks. Errors and warnings appear inline next to the affected field so you know exactly what to fix.",
    points: [
      "GSTIN: 15-char format, state code, PAN pattern, checksum (base-36 weighted algorithm)",
      "Tax math: CGST + SGST + IGST must equal tax_amount; taxable + tax must equal total",
      "TDS: rate validated against 16 defined sections (194C, 194J, 194I, 194H and 12 more)",
      "Duplicate: same vendor GSTIN + invoice number already approved? Warning shown instantly",
    ],
    visual: (
      <div className="rounded-xl border border-[#e7dcc8] bg-white p-5 shadow-soft">
        <div className="mb-3 text-sm font-bold text-ink-900">Compliance report</div>
        <div className="space-y-2">
          <div className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3">
            <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
            <div>
              <div className="text-xs font-bold text-rose-700">GSTIN checksum invalid</div>
              <div className="text-xs text-rose-600">27AAAAA0000A1Z5 — last digit mismatch</div>
            </div>
          </div>
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
            <div>
              <div className="text-xs font-bold text-amber-700">Tax math mismatch</div>
              <div className="text-xs text-amber-600">CGST + SGST = ₹8,900, expected ₹9,000</div>
            </div>
          </div>
          <div className="flex items-start gap-2.5 rounded-lg border border-mint-500/30 bg-mint-500/8 p-3">
            <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-mint-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <div>
              <div className="text-xs font-bold text-mint-600">TDS rate valid</div>
              <div className="text-xs text-mint-500">194C @ 1% — matches section definition</div>
            </div>
          </div>
        </div>
      </div>
    ),
    accent: "from-rose-500/5 to-amber-500/5",
  },
  {
    tag: "Tally XML Export",
    headline: "One click from reviewed document to TallyPrime.",
    body: "Select a client, pick documents, generate. The XML is built per the TallyPrime voucher import spec and uploaded to S3 for immediate download. Re-download from history any time.",
    points: [
      "Purchase vouchers for invoices and bills",
      "Payment and Receipt vouchers for bank statement transactions",
      "Inventory entries with Tally stock item names, HSN, UOM, and rates",
      "CGST, SGST, IGST ledger entries auto-computed",
      "Date-range filtering for targeted export periods",
    ],
    visual: (
      <div className="rounded-xl border border-[#e7dcc8] bg-white p-5 shadow-soft">
        <div className="mb-3 text-sm font-bold text-ink-900">Export workspace</div>
        <div className="mb-3 rounded-lg border border-[#e7dcc8] bg-sand-50/60 p-3">
          <div className="mb-2 text-xs font-semibold text-ink-700">Selected documents (3)</div>
          {["Invoice_ABC_Nov.pdf","BankStmt_Oct.pdf","Bill_XYZ.pdf"].map((f) => (
            <div key={f} className="flex items-center gap-2 py-1 text-xs text-ink-600">
              <svg className="h-3.5 w-3.5 text-mint-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
              {f}
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-mint-500/20 bg-mint-500/8 p-3 text-center">
          <div className="text-xs font-semibold text-mint-600">Export ready</div>
          <div className="mt-0.5 font-mono text-xs text-mint-500">tally_export_nov2024.xml · 14.2 KB</div>
        </div>
        <button className="btn-accent mt-3 w-full text-xs py-2">Download Tally XML</button>
      </div>
    ),
    accent: "from-ember-500/5 to-ember-500/10",
  },
  {
    tag: "Data Tools",
    headline: "Standalone utilities for your most common tasks.",
    body: "Two powerful tools that work independently of the document pipeline — perfect for batch processing and bank statement bulk conversion.",
    points: [
      "Register Cleaner: normalize messy GST purchase/sales Excel registers",
      "Bank Statement XML: convert PDF bank statements directly to Tally XML using pdfplumber (no LLM, 100% rule-based)",
      "Both tools are instant — upload and download, no queues",
      "Handles merged cells, repeat headers, multi-sheet workbooks",
      "Bank converter creates Receipt/Payment vouchers per transaction",
    ],
    visual: (
      <div className="rounded-xl border border-[#e7dcc8] bg-white p-5 shadow-soft">
        <div className="mb-3 text-sm font-bold text-ink-900">Data tools</div>
        <div className="space-y-3">
          <div className="rounded-xl border border-[#e7dcc8] bg-sand-50/60 p-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-mint-500/10">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="text-mint-600"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" /></svg>
              </div>
              <div>
                <div className="text-sm font-bold text-ink-900">Register Cleaner</div>
                <div className="text-xs text-ink-500">Clean messy GST Excel registers</div>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="text-indigo-500"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
              </div>
              <div>
                <div className="text-sm font-bold text-ink-900">Bank Statement → Tally XML</div>
                <div className="text-xs text-ink-500">PDF to vouchers, rule-based, no LLM</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    accent: "from-ember-500/5 to-indigo-500/5",
  },
  {
    tag: "Security & Audit",
    headline: "Every action logged. Every firm isolated.",
    body: "Multi-tenant architecture with PostgreSQL Row-Level Security enforces strict data boundaries. No firm can ever see another firm's data. Every critical action is logged with user, timestamp, and metadata.",
    points: [
      "PostgreSQL RLS — every query scoped to your firm_id by the database itself",
      "JWT access tokens (15 min) + httpOnly refresh cookies (7 days) with chain rotation",
      "Magic link tokens expire after 72 hours and rotate after each use",
      "Audit log: document uploads, approvals, exports, team changes, settings updates",
      "Soft deletes only — no data is ever permanently destroyed",
    ],
    visual: (
      <div className="rounded-xl border border-[#e7dcc8] bg-white p-5 shadow-soft">
        <div className="mb-3 text-sm font-bold text-ink-900">Audit log</div>
        <div className="space-y-2">
          {[
            { action: "extraction_approved", user: "CA Rajesh", time: "2 min ago", color: "text-mint-600 bg-mint-500/10" },
            { action: "tally_export_generated", user: "CA Priya", time: "18 min ago", color: "text-indigo-600 bg-indigo-500/10" },
            { action: "document_upload_initiated", user: "Client (magic)", time: "1 hr ago", color: "text-ember-600 bg-ember-500/10" },
            { action: "user_invited", user: "CA Rajesh", time: "3 hrs ago", color: "text-ink-600 bg-ink-900/8" },
          ].map((entry) => (
            <div key={entry.action + entry.time} className="flex items-center justify-between rounded-lg border border-[#f0e8d8] bg-sand-50/60 px-3 py-2">
              <div>
                <span className={`rounded px-2 py-0.5 text-xs font-semibold ${entry.color}`}>{entry.action.replace(/_/g, " ")}</span>
                <div className="mt-0.5 text-xs text-ink-400">{entry.user}</div>
              </div>
              <span className="text-xs text-ink-400">{entry.time}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    accent: "from-ink-900/3 to-ink-900/6",
  },
];

const FeaturesPage = () => (
  <PublicLayout>
    {/* Hero */}
    <section className="relative overflow-hidden">
      <div className="hero-gradient absolute inset-0" />
      <div className="orb orb-2 absolute" style={{ top: "10%", right: "5%" }} />
      <div className="orb orb-3 absolute" style={{ bottom: "20%", left: "10%" }} />

      <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-16 sm:px-6 sm:pt-20 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="animate-fade-in-up inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-bold tracking-wide text-indigo-600">
            Platform Features
          </div>
          <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight text-ink-900 opacity-0 animate-fade-in-up-delay-1 sm:text-5xl">
            Built for the way{" "}
            <span className="gradient-text-accent">CAs actually work</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink-600 opacity-0 animate-fade-in-up-delay-2">
            Every feature designed with Indian CA practice in mind — from GSTIN checksum validation to TallyPrime voucher formats.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3 opacity-0 animate-fade-in-up-delay-3">
            <Link to="/signup" className="btn-accent px-8 py-3 text-sm">Start free trial</Link>
            <Link to="/pricing" className="btn-secondary px-8 py-3 text-sm">View pricing</Link>
          </div>
        </div>

        {/* Feature count strip */}
        <div className="mx-auto mt-14 grid max-w-3xl grid-cols-3 gap-4">
          {[
            { value: "6+", label: "Core modules" },
            { value: "16", label: "TDS sections supported" },
            { value: "4", label: "Compliance checks" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-[#e7dcc8] bg-white/70 p-4 text-center backdrop-blur-sm">
              <div className="text-2xl font-extrabold text-ink-900">{s.value}</div>
              <div className="mt-1 text-xs font-semibold text-ink-500">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Feature sections */}
    <section className="section-padding">
      <div className="mx-auto max-w-7xl space-y-24">
        {features.map((f, i) => (
          <div key={f.tag} className={`grid items-center gap-12 lg:grid-cols-2`}>
            <div className={i % 2 === 1 ? "lg:order-2" : ""}>
              <div className="inline-block rounded-full border border-mint-500/30 bg-mint-500/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-mint-600">
                {f.tag}
              </div>
              <h2 className="mt-4 text-2xl font-extrabold leading-snug text-ink-900 sm:text-3xl">
                {f.headline}
              </h2>
              <p className="mt-4 text-base leading-relaxed text-ink-600">{f.body}</p>
              <ul className="mt-6 space-y-3">
                {f.points.map((p) => (
                  <li key={p} className="flex items-start gap-3 text-sm text-ink-700">
                    <Check />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
            <div className={`hover-lift ${i % 2 === 1 ? "lg:order-1" : ""}`}>
              <div className={`rounded-2xl border border-[#e7dcc8] bg-gradient-to-br ${f.accent} p-2`}>
                {f.visual}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>

    {/* CTA */}
    <section className="section-padding">
      <div className="mx-auto max-w-7xl">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-mint-500 to-mint-600 px-6 py-16 text-center sm:px-12 sm:py-20">
          <div className="absolute -left-10 top-10 h-40 w-40 rounded-full bg-white/10 blur-[60px]" />
          <div className="absolute -right-10 bottom-10 h-32 w-32 rounded-full bg-white/10 blur-[50px]" />
          <div className="relative">
            <h2 className="text-3xl font-extrabold text-white sm:text-4xl">See it in your browser today</h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-white/80">
              Free for 14 days. 50 documents/month free forever. No credit card required.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link to="/signup" className="w-full rounded-xl bg-white px-10 py-3 text-sm font-bold text-mint-600 shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl sm:w-auto">
                Create free account
              </Link>
              <Link to="/pricing" className="w-full rounded-xl border border-white/30 px-10 py-3 text-sm font-semibold text-white transition hover:bg-white/10 sm:w-auto">
                View pricing
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  </PublicLayout>
);

export default FeaturesPage;
