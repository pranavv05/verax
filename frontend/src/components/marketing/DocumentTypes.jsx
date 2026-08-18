import { Reveal, RevealGroup, RevealItem } from "../public/motion";
import { Caret, Eyebrow, Section, Tick } from "./ledger";

/**
 * "One system. Every financial document."
 *
 * Each document type gets its *own drawing*, not a shared card with a
 * different icon in it: an invoice looks like a page with fields pulled off
 * it, a bank statement looks like a run of transactions, a purchase register
 * looks like a spreadsheet, GST data looks like two columns being compared.
 * The shape of the visual is the fastest way to say what kind of paperwork
 * this is — an icon in a tinted square says nothing at all.
 *
 * Scope note: only what the pipeline actually handles today is listed here.
 * Invoices and bank statements are the two document types the extractor
 * classifies (ai-service/app/services/llm_service.py); purchase registers go
 * through the register-clean tool (backend/src/routes/tools.routes.js); GST
 * data is the GSTR-2B reconciliation (compliance.routes.js).
 */

/* ── Motif 1: an invoice, with fields lifted off it ─────────────────────── */

const Bracket = ({ className = "" }) => (
  <span aria-hidden="true" className={`pointer-events-none absolute ${className}`}>
    <span className="absolute left-0 top-0 h-2 w-2 border-l border-t border-brand-500" />
    <span className="absolute right-0 top-0 h-2 w-2 border-r border-t border-brand-500" />
    <span className="absolute bottom-0 left-0 h-2 w-2 border-b border-l border-brand-500" />
    <span className="absolute bottom-0 right-0 h-2 w-2 border-b border-r border-brand-500" />
  </span>
);

const InvoiceMotif = () => (
  <div className="flex gap-5">
    <div className="relative h-[168px] w-[124px] flex-none rounded-[3px] border border-hairline bg-white p-3">
      <span className="vx-mono block text-[0.5rem] uppercase tracking-[0.12em] text-carbon-400">
        Tax invoice
      </span>
      <span aria-hidden="true" className="vx-sheet mt-2 block h-3" />
      <span aria-hidden="true" className="vx-sheet mt-4 block h-3" />
      <span aria-hidden="true" className="vx-sheet mt-5 block h-8" />
      <span aria-hidden="true" className="vx-sheet mt-4 block h-3" />

      <Bracket className="left-2 top-7 h-5 w-[74px]" />
      <Bracket className="left-2 top-[52px] h-5 w-[96px]" />
      <Bracket className="bottom-3 left-2 h-6 w-[62px]" />
    </div>

    <ul className="flex-1 space-y-2 self-center">
      {[
        ["Vendor", "ACME Trading Co."],
        ["GSTIN", "27AABCA1234A1Z5"],
        ["Line items", "3"],
        ["CGST / SGST", "3,780 / 3,780"]
      ].map(([label, value]) => (
        <li key={label} className="flex items-baseline justify-between gap-3">
          <span className="text-[0.6875rem] uppercase tracking-[0.08em] text-carbon-400">
            {label}
          </span>
          <span className="vx-mono text-[0.75rem] text-carbon-900">{value}</span>
        </li>
      ))}
    </ul>
  </div>
);

/* ── Motif 2: a bank statement, as a run of transactions ────────────────── */

const TRANSACTIONS = [
  ["04 Mar", "NEFT / SHARMA ENTERPRISES", "", "1,20,000"],
  ["07 Mar", "UPI / RELIANCE FRESH", "2,480", ""],
  ["11 Mar", "CHQ 004192 / RENT", "45,000", ""],
  ["16 Mar", "IMPS / KUMAR & SONS", "", "88,500"],
  ["22 Mar", "GST PMT-06 CHALLAN", "31,240", ""]
];

const StatementMotif = () => (
  <div className="overflow-hidden rounded-lg border border-hairline bg-white">
    <div className="flex items-center gap-3 border-b border-hairline bg-well px-3 py-2">
      {["Date", "Narration", "Withdrawn", "Deposited"].map((head, index) => (
        <span
          key={head}
          className={`vx-mono text-[0.5625rem] uppercase tracking-[0.1em] text-carbon-400 ${
            index === 1 ? "flex-1" : "w-[62px] flex-none"
          } ${index > 1 ? "text-right" : ""}`}
        >
          {head}
        </span>
      ))}
    </div>

    {TRANSACTIONS.map(([date, narration, out, income]) => (
      <div
        key={narration}
        className="flex items-center gap-3 border-b border-hairline px-3 py-[9px] last:border-b-0"
      >
        <span className="vx-mono w-[62px] flex-none text-[0.6875rem] text-carbon-400">
          {date}
        </span>
        <span className="flex-1 truncate text-[0.6875rem] font-medium text-carbon-600">
          {narration}
        </span>
        <span className="vx-mono w-[62px] flex-none text-right text-[0.6875rem] text-carbon-900">
          {out}
        </span>
        <span className="vx-mono w-[62px] flex-none text-right text-[0.6875rem] text-verify-600">
          {income}
        </span>
      </div>
    ))}
  </div>
);

/* ── Motif 3: a purchase register, as a spreadsheet ─────────────────────── */

const RegisterMotif = () => (
  <div className="overflow-hidden rounded-lg border border-hairline bg-white">
    <div className="grid grid-cols-6">
      {Array.from({ length: 42 }, (_, index) => {
        const header = index < 6;
        // Two columns are marked as the ones being normalised — the tool's
        // whole job is turning a hand-kept register into consistent columns.
        const cleaned = !header && index % 6 >= 4;
        return (
          <span
            key={index}
            className={`h-[26px] border-b border-r border-hairline last:border-r-0 ${
              header ? "bg-well" : cleaned ? "bg-brand-500/[0.07]" : "bg-white"
            }`}
          >
            <span
              aria-hidden="true"
              className={`mx-2 mt-[10px] block h-[5px] rounded-[1px] ${
                header
                  ? "bg-carbon-300"
                  : cleaned
                    ? "bg-brand-500/40"
                    : "bg-carbon-100"
              }`}
              style={{ width: `${header ? 60 : 40 + ((index * 13) % 45)}%` }}
            />
          </span>
        );
      })}
    </div>
  </div>
);

/* ── Motif 4: GST data, as two columns being compared ───────────────────── */

const MATCHES = [
  { books: "INV-0417 · 49,560", gstr: "INV-0417 · 49,560", state: "matched" },
  { books: "INV-0431 · 12,400", gstr: "INV-0431 · 11,220", state: "mismatched" },
  { books: "INV-0448 · 8,750", gstr: "—", state: "missing" }
];

const STATE_STYLE = {
  matched: "text-verify-600",
  mismatched: "text-amber-600",
  missing: "text-carbon-400"
};

const ReconMotif = () => (
  <div>
    <div className="flex items-center gap-3">
      <span className="vx-index flex-1">Your books</span>
      <span className="w-6 flex-none" />
      <span className="vx-index flex-1 text-right">GSTR-2B</span>
    </div>

    <div className="mt-3 space-y-2">
      {MATCHES.map((row) => (
        <div key={row.books} className="flex items-center gap-3">
          <span className="vx-mono flex-1 rounded border border-hairline bg-white px-2.5 py-2 text-[0.6875rem] text-carbon-900">
            {row.books}
          </span>
          <span className={`flex w-6 flex-none justify-center ${STATE_STYLE[row.state]}`}>
            {row.state === "matched" ? <Tick size={12} /> : <Caret size={12} />}
          </span>
          <span
            className={`vx-mono flex-1 rounded border border-hairline bg-white px-2.5 py-2 text-right text-[0.6875rem] ${
              row.state === "missing" ? "text-carbon-300" : "text-carbon-900"
            }`}
          >
            {row.gstr}
          </span>
        </div>
      ))}
    </div>

    <p className="mt-4 text-[0.6875rem] leading-[1.6] text-carbon-400">
      Mismatched values and invoices your supplier never filed are surfaced
      with the reason attached.
    </p>
  </div>
);

/* ── The section ────────────────────────────────────────────────────────── */

const TYPES = [
  {
    index: "01",
    title: "Invoices",
    body: "Vendor, GSTIN, invoice number and date, every line item, tax components and totals — from a PDF, a scan, or a photograph taken on a phone. Receipts and expense bills run through the same pipeline.",
    motif: <InvoiceMotif />
  },
  {
    index: "02",
    title: "Bank statements",
    body: "Every transaction read as a row: date, narration, withdrawal, deposit, running balance — ready to become vouchers instead of a month of typing.",
    motif: <StatementMotif />
  },
  {
    index: "03",
    title: "Purchase registers",
    body: "Spreadsheet registers kept differently by every client, normalised into consistent columns — supplier, invoice, taxable value, tax components.",
    motif: <RegisterMotif />
  },
  {
    index: "04",
    title: "GST data",
    body: "GSTIN checksums and live verification, tax math cross-checks, duplicate detection, and GSTR-2B reconciliation for the period.",
    motif: <ReconMotif />
  }
];

const DocumentTypes = () => (
  <Section id="documents">
    <Reveal>
      <Eyebrow>Coverage</Eyebrow>
      <h2 className="vx-h2-xl mt-6 max-w-[24ch]">
        One system.
        <br />
        Every financial document.
      </h2>
    </Reveal>

    <RevealGroup className="mt-20 grid gap-x-16 gap-y-16 lg:grid-cols-2" stagger={0.1}>
      {TYPES.map((type) => (
        <RevealItem key={type.title} className="border-t border-carbon-900/15 pt-7">
          <div className="flex items-baseline gap-4">
            <span className="vx-index text-carbon-300">{type.index}</span>
            <h3 className="text-[1.375rem] font-semibold tracking-[-0.02em] text-carbon-900">
              {type.title}
            </h3>
          </div>

          <p className="mt-4 max-w-[34rem] text-[0.9375rem] leading-[1.7] text-carbon-500">
            {type.body}
          </p>

          <div className="mt-8">{type.motif}</div>
        </RevealItem>
      ))}
    </RevealGroup>
  </Section>
);

export default DocumentTypes;
