import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import PublicLayout from "../components/layout/PublicLayout";
import ClosingCTA from "../components/marketing/ClosingCTA";
import PageHero from "../components/marketing/PageHero";
import Cta from "../components/marketing/Cta";
import { Band, Beam, FitCanvas, Kicker } from "../components/marketing/v3";
import { Caret, Tick } from "../components/marketing/ledger";
import { Reveal } from "../components/public/motion";

/**
 * /features — the product, one module at a time (DESIGN_SYSTEM.md).
 *
 * Hero with the six-stage pipeline, a sticky chip bar that follows the reader
 * (scroll-spy), then one section per module: copy on one side, a drawn
 * product screen on the other, sitting in the bento's inset well. Every
 * screen reuses the homepage's books (ACME Trading Co., INV-2026-0417,
 * ₹49,560; checksum-valid GSTINs) and every bullet is checked against the
 * code — see FEATURE_STATUS.md.
 */

const SOFT_SHADOW = "shadow-[0_1px_2px_rgba(14,16,19,0.05),0_14px_34px_-18px_rgba(14,16,19,0.22)]";
const WINDOW = `overflow-hidden rounded-xl border border-[#E6E5EA] bg-white ${SOFT_SHADOW}`;

const Check = () => (
  <span className="flex h-4 w-4 flex-none items-center justify-center rounded-full bg-verify-500 text-white">
    <svg
      width="8"
      height="8"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      aria-hidden="true"
    >
      <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </span>
);

const WindowBar = ({ title, right }) => (
  <div className="flex items-center justify-between border-b border-[#EFEEF2] px-4 py-2.5">
    <span className="text-[12px] font-semibold text-carbon-900">{title}</span>
    {right}
  </div>
);

/* ── Screens ────────────────────────────────────────────────────────────── */

const CLIENTS = [
  { name: "Kumar & Sons", gstin: "27AAACK4410B1Z8", docs: 27, status: "active" },
  { name: "Sharma Enterprises", gstin: "27AAKFS3321M1ZX", docs: 14, status: "active" },
  { name: "Patel Hardware", gstin: "24AAHFP9087Q1ZA", docs: 9, status: "pending" },
  { name: "Shree Balaji Packaging", gstin: "24AAGFS7182K1ZS", docs: 0, status: "inactive" }
];

const CLIENT_STATUS = {
  active: "bg-verify-500/10 text-verify-700",
  pending: "bg-amber-500/12 text-amber-700",
  inactive: "bg-carbon-900/[0.06] text-carbon-500"
};

const ClientsScreen = () => (
  <div className="relative h-full w-full p-5">
    <div className={WINDOW}>
      <WindowBar
        title="Clients"
        right={
          <span className="flex items-center gap-2 rounded-md border border-[#E4E3E8] px-2 py-1 text-[10.5px] text-carbon-400">
            <svg
              width="11"
              height="11"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              aria-hidden="true"
            >
              <circle cx="7" cy="7" r="4.5" />
              <path d="m10.5 10.5 3 3" strokeLinecap="round" />
            </svg>
            Search name, email, phone or GSTIN
          </span>
        }
      />
      <div className="grid grid-cols-[1.6fr_1.3fr_0.6fr_0.8fr] gap-2 bg-[#FAFAFB] px-4 py-1.5 text-[10px] font-medium text-carbon-400">
        <span>Client</span>
        <span>GSTIN</span>
        <span className="text-right">Docs</span>
        <span className="text-right">Status</span>
      </div>
      {CLIENTS.map((client) => (
        <div
          key={client.name}
          className="grid grid-cols-[1.6fr_1.3fr_0.6fr_0.8fr] items-center gap-2 border-t border-[#F2F1F4] px-4 py-2.5 text-[11.5px]"
        >
          <span className="truncate font-medium text-carbon-900">{client.name}</span>
          <span className="vx-mono truncate text-[10.5px] text-carbon-500">{client.gstin}</span>
          <span className="text-right tabular-nums text-carbon-700">{client.docs}</span>
          <span className="text-right">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${CLIENT_STATUS[client.status]}`}
            >
              {client.status}
            </span>
          </span>
        </div>
      ))}
    </div>

    <div
      className={`absolute bottom-5 right-5 w-[250px] rounded-xl bg-carbon-950 p-3.5 text-white shadow-[0_20px_40px_-12px_rgba(14,16,19,0.55)]`}
    >
      <p className="flex items-center gap-2 text-[12px] font-medium">
        <Check />
        Upload link copied
      </p>
      <p className="mt-1 pl-6 text-[11px] text-carbon-400">Kumar &amp; Sons · expires in 24 hours</p>
    </div>
  </div>
);

const FIELDS = [
  { label: "Supplier", value: "ACME Trading Co.", conf: 0.98 },
  { label: "GSTIN", value: "27AABCA1234A1ZJ", conf: 0.99, mono: true },
  { label: "Invoice no.", value: "INV-2026-0417", conf: 0.97 },
  { label: "Date", value: "17 Mar 2026", conf: 0.96 },
  { label: "HSN", value: "4819 · 3919", conf: 0.88 },
  { label: "Taxable", value: "₹42,000.00", conf: 0.95 },
  { label: "CGST 9%", value: "₹3,780.00", conf: 0.94 },
  { label: "SGST 9%", value: "₹3,780.00", conf: 0.94 },
  { label: "Total", value: "₹49,560.00", conf: 0.97 }
];

const ExtractionScreen = () => (
  <div className="relative h-full w-full p-5">
    <div className={WINDOW}>
      <WindowBar
        title="acme-inv-0417.pdf"
        right={
          <span className="rounded-full bg-verify-500/10 px-2 py-0.5 text-[10px] font-medium text-verify-700">
            Extracted
          </span>
        }
      />
      <ul className="divide-y divide-[#F2F1F4]">
        {FIELDS.map((field) => (
          <li key={field.label} className="grid grid-cols-[76px_1fr_86px] items-center gap-3 px-4 py-[7px]">
            <span className="text-[10.5px] text-carbon-400">{field.label}</span>
            <span
              className={`truncate text-[11.5px] font-medium text-carbon-900 ${field.mono ? "vx-mono text-[10.5px]" : ""}`}
            >
              {field.value}
            </span>
            <span className="flex items-center gap-2">
              <span className="h-1 flex-1 overflow-hidden rounded-full bg-carbon-900/[0.06]">
                <span
                  className={`block h-full rounded-full ${field.conf >= 0.9 ? "bg-verify-500" : "bg-amber-500"}`}
                  style={{ width: `${field.conf * 100}%` }}
                />
              </span>
              <span className="w-7 text-right text-[10px] tabular-nums text-carbon-400">{field.conf.toFixed(2)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  </div>
);

const CHECKS = [
  { label: "GSTIN checksum", detail: "27AABCA1234A1ZJ · format, state code, PAN and check digit", ok: true },
  { label: "Tax maths", detail: "CGST 3,780 + SGST 3,780 = 7,560 · 42,000 + 7,560 = 49,560", ok: true },
  { label: "GSTR-2B", detail: "Supplier filed it · 2B value 49,560.00 matches your books", ok: true },
  { label: "Possible duplicate", detail: "Same GSTIN and invoice number as an approved document", ok: false }
];

const ComplianceScreen = () => (
  <div className="relative h-full w-full p-5">
    <div className={WINDOW}>
      <WindowBar
        title="Compliance · INV-2026-0417"
        right={
          <span className="rounded-full bg-amber-500/12 px-2 py-0.5 text-[10px] font-medium text-amber-700">
            1 warning
          </span>
        }
      />
      <ul className="space-y-2 p-3">
        {CHECKS.map((check) => (
          <li
            key={check.label}
            className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 ${
              check.ok ? "border-[#EFEEF2] bg-white" : "border-amber-500/25 bg-amber-500/[0.06]"
            }`}
          >
            {check.ok ? (
              <span className="mt-px">
                <Check />
              </span>
            ) : (
              <Caret size={15} className="mt-px text-amber-600" />
            )}
            <span className="min-w-0">
              <span className={`block text-[11.5px] font-medium ${check.ok ? "text-carbon-900" : "text-amber-800"}`}>
                {check.label}
              </span>
              <span className="mt-0.5 block text-[10.5px] leading-[1.45] text-carbon-500">{check.detail}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  </div>
);

const ExportScreen = () => (
  <div className="relative h-full w-full p-5">
    <div className={WINDOW}>
      <WindowBar
        title="Export to Tally · Kumar & Sons"
        right={<span className="text-[10.5px] text-carbon-400">March 2026</span>}
      />
      <div className="space-y-1.5 p-3">
        {[
          ["acme-inv-0417.pdf", "Purchase", "49,560.00"],
          ["hdfc-statement-mar.pdf", "Payment · Receipt", "42 entries"],
          ["kumar-bill-221.pdf", "Purchase", "3,528.00"]
        ].map(([file, voucher, amount]) => (
          <div key={file} className="flex items-center gap-3 rounded-lg bg-[#FAFAFB] px-3 py-2 text-[11px]">
            <span className="flex h-4 w-4 items-center justify-center rounded-[4px] bg-brand-500 text-white">
              <svg
                width="9"
                height="9"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                aria-hidden="true"
              >
                <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="vx-mono min-w-0 flex-1 truncate text-[10.5px] text-carbon-800">{file}</span>
            <span className="text-carbon-400">{voucher}</span>
            <span className="w-[66px] text-right font-medium tabular-nums text-carbon-900">{amount}</span>
          </div>
        ))}
      </div>
      <div className="mx-3 mb-3 rounded-lg border border-verify-500/25 bg-verify-500/[0.06] px-3 py-2.5">
        <p className="flex items-center gap-2 text-[11.5px] font-medium text-verify-700">
          <Check />
          Balanced — debits equal credits on every voucher
        </p>
      </div>
      <div className="flex items-center justify-between border-t border-[#EFEEF2] bg-[#FAFAFB] px-4 py-2.5">
        <span className="vx-mono text-[10.5px] text-carbon-500">tally-export-mar-2026.xml</span>
        <span className="rounded-md bg-carbon-900 px-3 py-1.5 text-[11px] font-medium text-white">Download XML</span>
      </div>
    </div>
  </div>
);

const ToolsScreen = () => (
  <div className="relative grid h-full w-full grid-cols-2 gap-3 p-5">
    <div className={`${WINDOW} flex flex-col`}>
      <WindowBar title="Register Cleaner" />
      <div className="flex-1 space-y-1 p-3 text-[10.5px]">
        {[
          ["12/3/26", "Sharma Ent.", "12500", false],
          ["2026-03-14", "Kumar & Sons", "₹ 3,150", false],
          ["", "TOTAL", "24,050", true],
          ["16-03-26", "CANCELLED", "-", true]
        ].map(([date, party, amount, drop]) => (
          <div
            key={party}
            className={`grid grid-cols-[60px_1fr_50px] gap-1.5 rounded px-1.5 py-1 ${
              drop ? "bg-rose-500/[0.06] text-carbon-400 line-through" : "text-carbon-700"
            }`}
          >
            <span className="truncate">{date || " "}</span>
            <span className="truncate">{party}</span>
            <span className="text-right tabular-nums">{amount}</span>
          </div>
        ))}
      </div>
      <p className="border-t border-[#EFEEF2] bg-[#FAFAFB] px-3 py-2 text-[10.5px] text-carbon-500">
        2 rows dropped · formats unified
      </p>
    </div>

    <div className={`${WINDOW} flex flex-col`}>
      <WindowBar title="Bank statement → XML" />
      <div className="flex-1 space-y-1 p-3 text-[10.5px]">
        {[
          ["UPI/SWIGGY/ORDER 8812", "Food & Beverage", 0.94],
          ["UBER INDIA TRIP 0314", "Travel & Conveyance", 0.92],
          ["AIRTEL BROADBAND MAR", "Utilities", 0.95],
          ["NEFT-SALARY-MARCH", "Salary", 0.9]
        ].map(([narration, ledger, conf]) => (
          <div key={narration} className="rounded bg-[#FAFAFB] px-2 py-1.5">
            <p className="vx-mono truncate text-[9.5px] text-carbon-500">{narration}</p>
            <p className="mt-0.5 flex items-center justify-between text-carbon-800">
              {ledger}
              <span className="text-[9.5px] tabular-nums text-carbon-400">{conf.toFixed(2)}</span>
            </p>
          </div>
        ))}
      </div>
      <p className="border-t border-[#EFEEF2] bg-[#FAFAFB] px-3 py-2 text-[10.5px] text-carbon-500">
        Suggested ledgers · you confirm
      </p>
    </div>
  </div>
);

const AUDIT = [
  { action: "tally_export_generated", who: "Priya · staff", when: "2 min ago" },
  { action: "extraction_approved", who: "Priya · staff", when: "6 min ago" },
  { action: "document_upload_confirmed", who: "Kumar & Sons · upload link", when: "1 hr ago" },
  { action: "client_portal_invite_emailed", who: "Rajesh · admin", when: "Yesterday" }
];

const AuditScreen = () => (
  <div className="relative h-full w-full p-5">
    <div className={WINDOW}>
      <WindowBar
        title="Audit log"
        right={<span className="text-[10.5px] text-carbon-400">Mehta Packaging Pvt. Ltd.</span>}
      />
      <ol className="relative px-4 py-3">
        <span aria-hidden="true" className="absolute bottom-6 left-[23px] top-6 w-px bg-[#E6E5EA]" />
        {AUDIT.map((entry) => (
          <li key={entry.action} className="relative flex items-start gap-3 py-2">
            <span className="relative z-10 mt-1 h-2.5 w-2.5 flex-none rounded-full border-2 border-white bg-brand-500 ring-1 ring-brand-500/30" />
            <span className="min-w-0 flex-1">
              <span className="vx-mono block text-[10.5px] text-carbon-900">{entry.action}</span>
              <span className="text-[10.5px] text-carbon-400">{entry.who}</span>
            </span>
            <span className="text-[10.5px] text-carbon-400">{entry.when}</span>
          </li>
        ))}
      </ol>
      <div className="flex items-center gap-2 border-t border-[#EFEEF2] bg-[#FAFAFB] px-4 py-2.5 text-[10.5px] text-carbon-500">
        <svg
          width="12"
          height="12"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <rect x="4" y="9" width="12" height="8.5" rx="2" />
          <path d="M7 9V6.5a3 3 0 0 1 6 0V9" />
        </svg>
        Row-level security: only this firm&apos;s records are visible here
      </div>
    </div>
  </div>
);

/* ── Content ────────────────────────────────────────────────────────────── */

const MODULES = [
  {
    id: "clients",
    nav: "Clients",
    kicker: "Client management",
    title: "Every client, every document,",
    tint: "in one place.",
    body: "Keep a roster of your clients with their GSTINs and contact details, send each one a secure upload link, and see where every document stands.",
    points: [
      "GSTIN stored and validated on each client profile",
      "One-click upload links that expire after 24 hours and rotate after each use",
      "Per-client counts: total, pending, reviewed and exported",
      "Search across name, email, phone and GSTIN",
      "Client status: active, pending or inactive"
    ],
    Screen: ClientsScreen
  },
  {
    id: "extraction",
    nav: "Extraction",
    kicker: "Document reading",
    title: "OCR that understands",
    tint: "accounting documents.",
    body: "PaddleOCR (with Tesseract as a fallback) reads the page; a language model turns the text into structured fields — not just text, but line items, tax and bank transactions.",
    points: [
      "Invoices and bills: supplier, GSTIN, number, date, line items, HSN, CGST/SGST/IGST and TDS",
      "Bank statements: account details and every transaction with narration, debit, credit and balance",
      "Scanned PDFs, phone photos and multi-page documents",
      "A confidence score on every document; low-confidence ones go to review"
    ],
    Screen: ExtractionScreen
  },
  {
    id: "compliance",
    nav: "Compliance",
    kicker: "Compliance checks",
    title: "Catch the errors",
    tint: "before they reach a filing.",
    body: "Every extraction runs through automatic checks, and each finding appears next to the field it concerns, so you know exactly what to fix.",
    points: [
      "GSTIN: format, state code, PAN pattern and check digit",
      "Tax maths: CGST + SGST + IGST must equal the tax, and taxable + tax must equal the total",
      "TDS: the rate is checked against 16 sections (194C, 194J, 194I, 194H and more)",
      "Duplicates: the same supplier GSTIN and invoice number already approved is flagged",
      "GSTR-2B reconciliation: purchases matched against 2B, with every difference listed and an Excel report"
    ],
    Screen: ComplianceScreen
  },
  {
    id: "export",
    nav: "Tally export",
    kicker: "Tally XML export",
    title: "From an approved document",
    tint: "to TallyPrime in one click.",
    body: "Pick a client and the approved documents, and generate. The XML balances by construction — debits always equal credits — and stays in your export history to download again.",
    points: [
      "Purchase vouchers for invoices and bills",
      "Payment and receipt vouchers for bank transactions",
      "Inventory entries with your Tally stock-item names, HSN, units and rates",
      "CGST, SGST and IGST ledger entries computed for you",
      "Export is blocked if a document's tax maths doesn't reconcile"
    ],
    Screen: ExportScreen
  },
  {
    id: "tools",
    nav: "Data tools",
    kicker: "Data tools",
    title: "Two utilities for",
    tint: "the jobs you do every month.",
    body: "Both work on their own, outside the document pipeline: upload a file, download the result — no queue.",
    points: [
      "Register Cleaner: tidies messy purchase and sales registers into one clean sheet",
      "Handles multi-sheet workbooks, repeated header blocks and multi-row headers",
      "Drops blank, TOTAL and CANCELLED rows, and puts dates and amounts in one format",
      "Bank Statement → Tally XML: amounts and dates are read straight from the statement's own table",
      "An AI model only suggests the ledger for each narration, with a confidence score, for you to confirm"
    ],
    Screen: ToolsScreen
  },
  {
    id: "security",
    nav: "Security",
    kicker: "Security & audit",
    title: "Every action on the record,",
    tint: "every firm kept apart.",
    body: "Each firm's data is isolated by the database itself, and every important action is logged with who did it and when.",
    points: [
      "PostgreSQL row-level security scopes every query to your firm",
      "Short-lived access tokens and rotating refresh tokens in an httpOnly cookie",
      "Audit log of uploads, approvals, exports, invitations and settings changes",
      "Deletes in the app are soft — records are hidden, not destroyed — and permanent erasure happens only on your request"
    ],
    Screen: AuditScreen
  }
];

const PIPELINE = ["Upload link", "Read", "Check", "Review", "Reconcile", "Export"];

/* ── Sticky module bar ──────────────────────────────────────────────────── */

const useActiveModule = (ids) => {
  const [active, setActive] = useState(null);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-140px 0px -55% 0px" }
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [ids]);

  return active;
};

const ModuleBar = () => {
  const reduced = useReducedMotion();
  const ids = useMemo(() => MODULES.map((m) => m.id), []);
  const active = useActiveModule(ids);

  return (
    <div className="sticky top-16 z-30 border-y border-carbon-900/[0.06] bg-[#F7F6F2]/80 backdrop-blur-xl">
      <nav aria-label="Product modules" className="vx-shell">
        <ul className="-mx-2 flex gap-1 overflow-x-auto py-2.5 [scrollbar-width:none] sm:justify-center">
          {MODULES.map((module) => {
            const on = active === module.id;
            return (
              <li key={module.id} className="flex-none">
                <a
                  href={`#${module.id}`}
                  aria-current={on ? "true" : undefined}
                  className={`relative block rounded-full px-3.5 py-1.5 text-[13.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                    on ? "text-carbon-900" : "text-carbon-500 hover:text-carbon-900"
                  }`}
                >
                  {on ? (
                    <motion.span
                      layoutId="vx-module-pill"
                      aria-hidden="true"
                      className="absolute inset-0 rounded-full bg-white shadow-[0_1px_2px_rgba(14,16,19,0.08)] ring-1 ring-carbon-900/[0.06]"
                      transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36 }}
                    />
                  ) : null}
                  <span className="relative">{module.nav}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
};

/* ── Sections ───────────────────────────────────────────────────────────── */

const Module = ({ module, index }) => {
  const flip = index % 2 === 1;
  const { Screen } = module;

  return (
    <div id={module.id} className="scroll-mt-32 grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <Reveal className={flip ? "lg:order-2" : ""}>
        <Kicker>{module.kicker}</Kicker>
        <h2 className="mt-5 font-inter text-[clamp(1.75rem,2.9vw,2.375rem)] font-normal leading-[1.14] tracking-[-0.03em] text-carbon-900">
          {module.title} <span className="text-carbon-400">{module.tint}</span>
        </h2>
        <p className="mt-5 max-w-[34rem] text-[1.0625rem] leading-[1.7] text-carbon-500">{module.body}</p>
        <ul className="mt-7 space-y-3">
          {module.points.map((point) => (
            <li key={point} className="flex items-start gap-3 text-[0.9375rem] leading-[1.6] text-carbon-600">
              <Tick className="mt-[6px] text-verify-600" />
              {point}
            </li>
          ))}
        </ul>
      </Reveal>

      <Reveal delay={0.1} className={flip ? "lg:order-1" : ""}>
        <div className="rounded-[22px] border border-carbon-900/[0.07] bg-white p-2 shadow-[0_1px_2px_rgba(14,16,19,0.04),0_30px_70px_-50px_rgba(38,30,110,0.35)]">
          <div className="relative overflow-hidden rounded-[16px] bg-[#F5F5F7]">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage: "radial-gradient(rgba(14,16,19,0.08) 1px, transparent 1px)",
                backgroundSize: "16px 16px",
                maskImage: "radial-gradient(80% 70% at 50% 45%, black, transparent 85%)",
                WebkitMaskImage: "radial-gradient(80% 70% at 50% 45%, black, transparent 85%)"
              }}
            />
            <div aria-hidden="true" className="relative mx-auto w-full max-w-[520px]">
              <FitCanvas w={520} h={400}>
                <Screen />
              </FitCanvas>
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  );
};

const FeaturesPage = () => (
  <PublicLayout>
    <PageHero
      kicker="Product"
      title="Every step from a client's upload"
      accent="to a balanced Tally voucher."
      lead="Collection, reading, compliance checks, review and export — built for the way Indian CA firms work, with your team approving every voucher."
      actions={
        <>
          <Cta href="/#demo" size="lg">
            Book a demo
          </Cta>
          <Cta to="/pricing" variant="glass" size="lg">
            See pricing
          </Cta>
        </>
      }
    >
      {/* The pipeline at a glance */}
      {/* The pipeline at a glance: a wrapped row of stages with chevrons
          below lg, one line joined by travelling beams from lg up. */}
      <ol className="mx-auto flex max-w-[64rem] flex-wrap items-center justify-center gap-x-1.5 gap-y-2.5 lg:flex-nowrap lg:gap-0">
        {PIPELINE.map((stage, index) => (
          <li key={stage} className="flex items-center gap-1.5 lg:gap-0">
            <span className="flex items-center gap-2 whitespace-nowrap rounded-full border border-white/80 bg-white/70 px-3.5 py-1.5 text-[13px] font-medium text-carbon-800 shadow-[0_8px_24px_-18px_rgba(38,30,110,0.5)] backdrop-blur sm:px-4 sm:py-2 sm:text-[13.5px]">
              <span className="text-[11px] tabular-nums text-carbon-400">{String(index + 1).padStart(2, "0")}</span>
              {stage}
            </span>
            {index < PIPELINE.length - 1 ? (
              <>
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="none"
                  aria-hidden="true"
                  className="text-carbon-300 lg:hidden"
                >
                  <path
                    d="M3 1.5 6.5 5 3 8.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <Beam delay={index * 0.35} className="hidden w-12 lg:flex" />
              </>
            ) : null}
          </li>
        ))}
      </ol>
    </PageHero>

    <ModuleBar />

    <Band>
      <div className="space-y-28 lg:space-y-36">
        {MODULES.map((module, index) => (
          <Module key={module.id} module={module} index={index} />
        ))}
      </div>
    </Band>

    <ClosingCTA />
  </PublicLayout>
);

export default FeaturesPage;
