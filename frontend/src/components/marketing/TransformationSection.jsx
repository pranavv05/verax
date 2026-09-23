import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { EASE, Reveal, RevealGroup, RevealItem } from "../public/motion";
import { Band, Heading } from "./v3";

/**
 * "Give Verax the documents. Give your team the exceptions."
 *
 * Shown as the product actually behaves: the Documents table, live. Client
 * uploads arrive at the top, move through the real statuses
 * (uploaded → processing → extracted | review_required) and are routed by the
 * real rules in `document-processing.worker.js`:
 *
 *   review_required  when confidence < REVIEW_CONFIDENCE_THRESHOLD (default
 *                    0.40), the document type is unknown, or what was read
 *                    doesn't match the type it was uploaded as.
 *
 * Compliance problems (GSTR-2B differences, duplicates) do *not* reroute a
 * document — they're flagged on it as warnings — and the table shows them
 * that way. Counts are illustrative, as everywhere on this page.
 */

const DOCS = [
  { file: "purchase-bills-march.pdf", pages: 12, client: "Kumar & Sons", type: "Invoice", conf: 0.93 },
  { file: "IMG_2231.jpg", pages: 1, client: "Patel Hardware", type: "Invoice", conf: 0.34, review: "Low confidence · 0.34" },
  { file: "hdfc-statement-mar.pdf", pages: 3, client: "Kumar & Sons", type: "Bank statement", conf: 0.91 },
  { file: "INV-2026-0431.pdf", pages: 1, client: "Shree Balaji Packaging", type: "Invoice", conf: 0.88, flag: "GSTR-2B differs" },
  { file: "acme-inv-0417.pdf", pages: 1, client: "ACME Trading Co.", type: "Invoice", conf: 0.97 },
  { file: "statement_q4.pdf", pages: 4, client: "Sharma Enterprises", type: "Invoice", conf: 0.82, review: "Reads as a bank statement" },
  { file: "scan_0012.pdf", pages: 1, client: "Sharma Enterprises", type: "Invoice", conf: 0.9, flag: "Possible duplicate" },
  { file: "kotak-stmt-march.pdf", pages: 5, client: "Sharma Enterprises", type: "Bank statement", conf: 0.94 },
  { file: "WhatsApp Image 0331.jpg", pages: 1, client: "Kumar & Sons", type: "Invoice", conf: 0.21, review: "Unrecognised document" },
  { file: "PH-1187-bill.pdf", pages: 2, client: "Patel Hardware", type: "Invoice", conf: 0.95 }
];

const CLIENT_COLOR = {
  "Kumar & Sons": "#14B8A6",
  "Patel Hardware": "#F59E0B",
  "Shree Balaji Packaging": "#4D8DFF",
  "ACME Trading Co.": "#6657D9",
  "Sharma Enterprises": "#EC4899"
};

const VISIBLE = 7;
const ARRIVE_MS = 1700;
const TIMES = ["11:48 PM", "11:47 PM", "11:47 PM", "11:45 PM", "11:44 PM", "11:41 PM", "11:40 PM", "11:38 PM"];

/* ── Live feed ──────────────────────────────────────────────────────────── */

const useFeed = (active, reduced) => {
  // Each row: { id, doc, stage } where stage 0 uploaded · 1 processing · 2 done
  const seed = () =>
    DOCS.slice(0, VISIBLE).map((doc, index) => ({ id: `seed-${index}`, doc, stage: 2, time: TIMES[index] }));
  const [rows, setRows] = useState(seed);
  const [counts, setCounts] = useState({ done: 196, review: 8 });
  const cursor = useRef(VISIBLE);
  const serial = useRef(0);

  useEffect(() => {
    if (!active || reduced) return undefined;
    const timers = [];

    const arrive = () => {
      const doc = DOCS[cursor.current % DOCS.length];
      cursor.current += 1;
      serial.current += 1;
      const id = `live-${serial.current}`;

      setRows((current) => [{ id, doc, stage: 0, time: "Just now" }, ...current].slice(0, VISIBLE));
      timers.push(
        window.setTimeout(() => {
          setRows((current) => current.map((row) => (row.id === id ? { ...row, stage: 1 } : row)));
        }, 450)
      );
      timers.push(
        window.setTimeout(() => {
          setRows((current) => current.map((row) => (row.id === id ? { ...row, stage: 2 } : row)));
          setCounts((c) => (doc.review ? { ...c, review: c.review + 1 } : { ...c, done: c.done + 1 }));
        }, 1400)
      );
    };

    const interval = window.setInterval(arrive, ARRIVE_MS);
    arrive();
    return () => {
      window.clearInterval(interval);
      timers.forEach(window.clearTimeout);
    };
  }, [active, reduced]);

  return { rows, counts };
};

/* ── Cells ──────────────────────────────────────────────────────────────── */

const FileIcon = ({ name }) => {
  const image = /\.jpe?g$/i.test(name);
  return (
    <span
      className={`flex h-7 w-6 flex-none items-center justify-center rounded-[4px] text-[7.5px] font-bold text-white ${
        image ? "bg-sky-500" : "bg-rose-500"
      }`}
    >
      {image ? "JPG" : "PDF"}
    </span>
  );
};

const Status = ({ stage, review }) => {
  if (stage === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-carbon-900/[0.05] px-2 py-0.5 text-[11px] font-medium text-carbon-500">
        <span className="h-1.5 w-1.5 rounded-full bg-carbon-400" />
        Uploaded
      </span>
    );
  }
  if (stage === 1) {
    return (
      <span className="relative inline-flex items-center gap-1.5 overflow-hidden rounded-full bg-brand-500/10 px-2 py-0.5 text-[11px] font-medium text-brand-700">
        <span className="h-2.5 w-2.5 animate-spin rounded-full border-[1.5px] border-brand-500 border-t-transparent" />
        Processing
      </span>
    );
  }
  return review ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/12 px-2 py-0.5 text-[11px] font-medium text-amber-700">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      Needs review
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-verify-500/12 px-2 py-0.5 text-[11px] font-medium text-verify-700">
      <span className="h-1.5 w-1.5 rounded-full bg-verify-500" />
      Extracted
    </span>
  );
};

const Confidence = ({ stage, value }) => (
  <span className="flex items-center gap-2">
    <span className="h-1 w-12 overflow-hidden rounded-full bg-carbon-900/[0.07]">
      <motion.span
        className={`block h-full rounded-full ${value < 0.4 ? "bg-amber-500" : "bg-carbon-900/70"}`}
        initial={false}
        animate={{ width: stage === 2 ? `${value * 100}%` : "0%" }}
        transition={{ duration: 0.6, ease: EASE }}
      />
    </span>
    <span className="w-7 text-[11.5px] tabular-nums text-carbon-500">{stage === 2 ? value.toFixed(2) : "—"}</span>
  </span>
);

const Note = ({ stage, doc }) => {
  if (stage < 2) return <span className="text-[11.5px] text-carbon-300">—</span>;
  if (doc.review) return <span className="text-[11.5px] font-medium text-amber-700">{doc.review}</span>;
  if (doc.flag)
    return (
      <span className="inline-flex items-center gap-1 rounded border border-amber-500/30 bg-amber-50 px-1.5 py-px text-[11px] text-amber-800">
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="M8 2.5 14 13H2z" />
          <path d="M8 6.5v3" />
        </svg>
        {doc.flag}
      </span>
    );
  return <span className="text-[11.5px] text-carbon-400">Ready to approve</span>;
};

/* ── The table ──────────────────────────────────────────────────────────── */

const GRID =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 md:grid-cols-[minmax(0,1.8fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.5fr)]";

const DocumentsTable = () => {
  const reduced = useReducedMotion();
  const ref = useRef(null);
  const inView = useInView(ref, { amount: 0.4 });
  const { rows, counts } = useFeed(inView, reduced);

  return (
    <div
      ref={ref}
      className="rounded-[20px] border border-white/70 bg-white/40 p-2 shadow-[0_60px_120px_-50px_rgba(38,30,110,0.5),0_0_0_1px_rgba(14,16,19,0.04)] backdrop-blur-xl"
    >
      <div className="overflow-hidden rounded-[14px] border border-[#E6E5EA] bg-white">
        {/* Page header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ECEBEF] px-5 py-3.5">
          <div className="flex items-center gap-3">
            <p className="text-[15px] font-semibold tracking-[-0.01em] text-carbon-900">Documents</p>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-verify-500/10 px-2 py-0.5 text-[11px] font-medium text-verify-700">
              <span className="relative flex h-1.5 w-1.5">
                {!reduced ? <span className="absolute inset-0 animate-ping rounded-full bg-verify-500 opacity-60" /> : null}
                <span className="relative h-1.5 w-1.5 rounded-full bg-verify-500" />
              </span>
              Live
            </span>
          </div>
          <div className="flex items-center gap-2 text-[12px]">
            <span className="hidden rounded-md border border-[#E4E3E8] px-2.5 py-1 text-carbon-600 sm:inline">March 2026</span>
            <span className="hidden rounded-md border border-[#E4E3E8] px-2.5 py-1 text-carbon-600 sm:inline">All clients</span>
            <span className="rounded-md bg-carbon-900 px-2.5 py-1 font-medium text-white">Upload</span>
          </div>
        </div>

        {/* Tabs with live counts */}
        <div className="flex gap-5 border-b border-[#ECEBEF] px-5 text-[12.5px]">
          {[
            ["All", counts.done + counts.review, true],
            ["Extracted", counts.done],
            ["Needs review", counts.review]
          ].map(([label, count, active]) => (
            <span
              key={label}
              className={`flex items-center gap-1.5 border-b-2 py-2.5 ${
                active ? "border-carbon-900 font-medium text-carbon-900" : "border-transparent text-carbon-400"
              }`}
            >
              {label}
              <span
                className={`rounded px-1.5 text-[11px] tabular-nums ${
                  label === "Needs review" ? "bg-amber-500/12 text-amber-700" : "bg-[#F0EFF3] text-carbon-500"
                }`}
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={count}
                    initial={{ y: 8, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -8, opacity: 0 }}
                    transition={{ duration: 0.3, ease: EASE }}
                    className="inline-block"
                  >
                    {count}
                  </motion.span>
                </AnimatePresence>
              </span>
            </span>
          ))}
        </div>

        {/* Column heads */}
        <div className={`${GRID} border-b border-[#ECEBEF] bg-[#FAFAFB] px-5 py-2 text-[11px] font-medium text-carbon-400`}>
          <span>Document</span>
          <span className="hidden md:block">Client</span>
          <span className="hidden md:block">Received</span>
          <span>Status</span>
          <span className="hidden md:block">Confidence</span>
          <span className="hidden md:block">Notes</span>
        </div>

        {/* Rows */}
        <div className="relative h-[392px] overflow-hidden">
          <AnimatePresence initial={false}>
            {rows.map((row) => (
              <motion.div
                key={row.id}
                layout={!reduced}
                initial={{ opacity: 0, y: -12, backgroundColor: "rgba(102,87,217,0.08)" }}
                animate={{ opacity: 1, y: 0, backgroundColor: "rgba(102,87,217,0)" }}
                exit={{ opacity: 0 }}
                transition={{
                  layout: { duration: 0.5, ease: EASE },
                  opacity: { duration: 0.35 },
                  y: { duration: 0.5, ease: EASE },
                  backgroundColor: { duration: 2.2, ease: "easeOut" }
                }}
                className={`${GRID} h-14 border-b border-[#F0EFF3] px-5`}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <FileIcon name={row.doc.file} />
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] font-medium text-carbon-900">{row.doc.file}</span>
                    <span className="block truncate text-[11px] text-carbon-400">
                      {row.doc.type} · {row.doc.pages} {row.doc.pages === 1 ? "page" : "pages"}
                    </span>
                  </span>
                </span>
                <span className="hidden min-w-0 items-center gap-2 md:flex">
                  <span className="h-2 w-2 flex-none rounded-[3px]" style={{ background: CLIENT_COLOR[row.doc.client] }} />
                  <span className="truncate text-[12.5px] text-carbon-700">{row.doc.client}</span>
                </span>
                <span className="hidden text-[12px] tabular-nums text-carbon-500 md:block">
                  {row.time}
                </span>
                <span>
                  <Status stage={row.stage} review={row.doc.review} />
                </span>
                <span className="hidden md:block">
                  <Confidence stage={row.stage} value={row.doc.conf} />
                </span>
                <span className="hidden min-w-0 truncate md:block">
                  <Note stage={row.stage} doc={row.doc} />
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent"
          />
        </div>
      </div>
    </div>
  );
};

/* ── Rules ──────────────────────────────────────────────────────────────── */

const RULES = [
  {
    title: "Low confidence",
    body: "The extraction scored below the review threshold — 0.40 by default. A blurry phone photo is the usual culprit."
  },
  {
    title: "Unrecognised document",
    body: "Verax couldn't tell what the page is, so nobody should assume it knows."
  },
  {
    title: "Type mismatch",
    body: "Uploaded as an invoice, but the fields read like a bank statement — or the other way round."
  }
];

const TransformationSection = () => (
  <Band>
    <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
      <Heading
        kicker="The division of labour"
        title="Give Verax the documents."
        tint="Give your team the exceptions."
        lead="Every upload is read the moment it lands. Most come out clean and wait only for approval; the few Verax isn't sure about go to your review queue, with the reason attached."
      />
    </div>

    <Reveal delay={0.1} className="mt-12">
      <DocumentsTable />
    </Reveal>

    <RevealGroup className="mt-12 grid gap-8 border-t border-carbon-900/10 pt-10 sm:grid-cols-3" stagger={0.08}>
      <RevealItem className="sm:col-span-3">
        <p className="text-[13px] font-medium text-carbon-900">What sends a document to review</p>
      </RevealItem>
      {RULES.map((rule) => (
        <RevealItem key={rule.title}>
          <p className="flex items-center gap-2 text-[15px] font-medium text-carbon-900">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            {rule.title}
          </p>
          <p className="mt-2 text-[14px] leading-[1.6] text-carbon-500">{rule.body}</p>
        </RevealItem>
      ))}
      <RevealItem className="sm:col-span-3">
        <p className="text-[13px] leading-[1.6] text-carbon-400">
          Compliance findings — GSTR-2B differences, possible duplicates, GSTIN and tax-maths
          checks — don&apos;t hide a document; they&apos;re flagged on it, so whoever approves
          sees them. Counts shown are illustrative.
        </p>
      </RevealItem>
    </RevealGroup>
  </Band>
);

export default TransformationSection;
