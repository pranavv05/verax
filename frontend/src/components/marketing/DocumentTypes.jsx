import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { EASE, RevealGroup, RevealItem } from "../public/motion";
import { Band, FitCanvas, Heading } from "./v3";

/**
 * Coverage — four real artifacts a CA firm handles, each paired with what
 * Verax does to it, and each one interactive:
 *
 *   Invoices          a stamped tax invoice beside the extracted fields and the
 *                     compliance checks; hovering a field lights the exact spot
 *                     on the paper (it cycles by itself when idle).
 *   Bank statements   a statement-of-account page under Verax's parsed rows;
 *                     hovering a row lights its source line.
 *   Purchase registers a real spreadsheet (column letters, formula bar, TOTAL
 *                     and CANCELLED rows) with a "Clean with Verax" switch that
 *                     does exactly what register_cleaner_service.py does.
 *   GST data          the GSTR-2B reconciliation screen; the filter chips
 *                     re-sort the table.
 *
 * No gradient blobs, no sparkle chips, no grey placeholder bars — every visual
 * is a specific document or a specific screen, laid out as a bento on one
 * shared neutral surface. Each is drawn on a fixed canvas and scaled to fit
 * (FitCanvas), so it stays intact on phones. All GSTINs are
 * checksum-valid; figures reconcile with the rest of the page.
 */

const PAPER_FONT = "Arial, 'Helvetica Neue', Helvetica, sans-serif";

// One quiet elevation for every sheet and panel in the bento, so the four
// tiles read as one system rather than four differently-lit photos.
const SOFT_SHADOW = "shadow-[0_1px_2px_rgba(14,16,19,0.05),0_14px_34px_-18px_rgba(14,16,19,0.22)]";

/* ── Shared ─────────────────────────────────────────────────────────────── */

/** Cycle through keys while idle; the reader's hover takes over. */
const useCycle = (keys, ms, enabled) => {
  const [auto, setAuto] = useState(0);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    if (!enabled || hover !== null) return undefined;
    const timer = window.setInterval(() => setAuto((i) => (i + 1) % keys.length), ms);
    return () => window.clearInterval(timer);
  }, [enabled, hover, keys.length, ms]);

  return [hover ?? keys[auto], setHover];
};

/** Position of `[data-hl=key]` inside `container`, in layout px (pre-transform). */
const useHighlightBox = (containerRef, key) => {
  const [box, setBox] = useState(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const target = key && container ? container.querySelector(`[data-hl="${key}"]`) : null;
    if (!target) {
      setBox(null);
      return;
    }
    let top = 0;
    let left = 0;
    let node = target;
    while (node && node !== container) {
      top += node.offsetTop;
      left += node.offsetLeft;
      node = node.offsetParent;
    }
    setBox({ top: top - 3, left: left - 4, width: target.offsetWidth + 8, height: target.offsetHeight + 6 });
  }, [containerRef, key]);

  return box;
};

const Highlight = ({ box, tone = "brand" }) => (
  <AnimatePresence>
    {box ? (
      <motion.span
        key="hl"
        aria-hidden="true"
        className={`pointer-events-none absolute z-10 rounded-[3px] border ${
          tone === "brand" ? "border-brand-500 bg-brand-500/[0.12]" : "border-sky-500 bg-sky-500/[0.12]"
        }`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, ...box }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.55, ease: EASE }}
      />
    ) : null}
  </AnimatePresence>
);

/* ── 1. Invoices ────────────────────────────────────────────────────────── */

const INVOICE_FIELDS = [
  { key: "vendor", label: "Supplier", value: "ACME Trading Co.", conf: 0.98 },
  { key: "gstin", label: "GSTIN", value: "27AABCA1234A1ZJ", conf: 0.99, verified: true },
  { key: "number", label: "Invoice no.", value: "INV-2026-0417", conf: 0.97 },
  { key: "date", label: "Date", value: "17 Mar 2026", conf: 0.96 },
  { key: "taxable", label: "Taxable", value: "₹42,000.00", conf: 0.95 },
  { key: "total", label: "Total", value: "₹49,560.00", conf: 0.97 }
];

const InvoiceCanvas = () => {
  const reduced = useReducedMotion();
  const ref = useRef(null);
  const inView = useInView(ref, { amount: 0.4 });
  const seen = useInView(ref, { amount: 0.4, once: true });
  const paperRef = useRef(null);
  const [active, setHover] = useCycle(
    INVOICE_FIELDS.map((f) => f.key),
    1500,
    inView && !reduced
  );
  const box = useHighlightBox(paperRef, active);

  return (
    <div ref={ref} className="relative h-full w-full">
      {/* The paper, upright and scaled up so its detail reads at bento size */}
      <div className="absolute left-[22px] top-[36px] w-[300px]">
        <div className={`relative rounded-[3px] ${SOFT_SHADOW}`}>
          <div
            ref={paperRef}
            className="relative rounded-[3px] bg-[#FDFCF9] px-5 pb-6 pt-5 text-[#1f2126]"
            style={{ fontFamily: PAPER_FONT }}
          >
            <Highlight box={box} />

            <div className="flex items-start justify-between">
              <div>
                <p data-hl="vendor" className="inline-block text-[12px] font-bold">
                  ACME Trading Co.
                </p>
                <p className="text-[6.5px] leading-[1.5] text-[#666]">
                  Plot 14, MIDC Bhosari, Pune 411026
                </p>
                <p data-hl="gstin" className="mt-1 inline-block text-[7px]">
                  GSTIN: <b>27AABCA1234A1ZJ</b>
                </p>
              </div>
              <div className="text-right text-[7px]">
                <p className="text-[9px] font-bold tracking-[0.1em] text-[#1d4ed8]">TAX INVOICE</p>
                <p data-hl="number" className="mt-1 inline-block">
                  No. <b>INV-2026-0417</b>
                </p>
                <br />
                <p data-hl="date" className="inline-block">
                  Date <b>17-03-2026</b>
                </p>
              </div>
            </div>

            <table className="mt-4 w-full text-[6.5px]">
              <thead>
                <tr className="border-y border-[#222] text-left">
                  <th className="py-[3px] font-bold">Description</th>
                  <th className="py-[3px] text-right font-bold">Qty</th>
                  <th className="py-[3px] text-right font-bold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Industrial Packaging Rolls", "80", "20,000.00"],
                  ["Corrugated Cartons — Size B", "150", "15,000.00"],
                  ["BOPP Adhesive Tape", "14", "7,000.00"]
                ].map((row) => (
                  <tr key={row[0]} className="border-b border-[#ddd]">
                    <td className="py-[3px]">{row[0]}</td>
                    <td className="py-[3px] text-right">{row[1]}</td>
                    <td className="py-[3px] text-right">{row[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="ml-auto mt-3 w-[55%] space-y-[2px] text-[6.8px]">
              <div data-hl="taxable" className="flex justify-between">
                <span className="text-[#666]">Taxable value</span>
                <span>42,000.00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#666]">CGST 9% + SGST 9%</span>
                <span>7,560.00</span>
              </div>
              <div data-hl="total" className="flex justify-between border-t border-[#222] pt-[2px] text-[8.5px] font-bold">
                <span>Total</span>
                <span>₹ 49,560.00</span>
              </div>
            </div>

            <p className="mt-4 text-[6px] text-[#888]">For ACME Trading Co. — Authorised signatory</p>

            {/* Rubber stamp and pen initials: the marks a real bill picks up */}
            <span
              aria-hidden="true"
              className="absolute bottom-[44px] left-[22px] rotate-[-14deg] rounded-[4px] border-2 border-[#2446b8]/70 px-2 py-0.5 text-center text-[7px] font-bold leading-tight tracking-[0.08em] text-[#2446b8]/70"
            >
              RECEIVED
              <br />
              <span className="text-[8px]">18 MAR 2026</span>
            </span>
            <span
              aria-hidden="true"
              className="absolute bottom-[12px] left-[150px] rotate-[-6deg] text-[15px] text-[#1b3fae]/80"
              style={{ fontFamily: "'Segoe Script','Brush Script MT',cursive" }}
            >
              ✓ RK
            </span>

          </div>
        </div>
      </div>

      {/* Verax: what came off the page */}
      <div className={`absolute right-[20px] top-[52px] w-[252px] overflow-hidden rounded-xl border border-[#E6E5EA] bg-white ${SOFT_SHADOW}`}>
        <div className="flex items-center justify-between border-b border-[#EFEEF2] px-3.5 py-2.5">
          <span className="text-[11.5px] font-semibold text-carbon-900">Extracted fields</span>
          <span className="rounded-full bg-verify-500/10 px-1.5 py-px text-[10px] font-medium text-verify-700">
            6 of 6
          </span>
        </div>
        <ul className="py-1" onMouseLeave={() => setHover(null)}>
          {INVOICE_FIELDS.map((field) => (
            <li
              key={field.key}
              onMouseEnter={() => setHover(field.key)}
              className={`flex cursor-default items-center gap-2 px-3.5 py-[7px] transition-colors duration-200 ${
                active === field.key ? "bg-brand-500/[0.06]" : ""
              }`}
            >
              <span
                className={`h-4 w-[3px] flex-none rounded-full transition-colors duration-200 ${
                  active === field.key ? "bg-brand-500" : "bg-transparent"
                }`}
              />
              <span className="w-[56px] flex-none whitespace-nowrap text-[10px] text-carbon-400">{field.label}</span>
              <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-carbon-900">{field.value}</span>
              {field.verified ? (
                <span className="rounded bg-verify-500/10 px-1 text-[9.5px] font-medium text-verify-700">Verified</span>
              ) : (
                <span className="text-[10px] tabular-nums text-carbon-400">{field.conf.toFixed(2)}</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* The checks compliance.service.js runs on every invoice */}
      <div className={`absolute left-[22px] top-[318px] w-[300px] rounded-xl border border-[#E6E5EA] bg-white px-3.5 py-3 ${SOFT_SHADOW}`}>
        <p className="text-[10.5px] font-medium text-carbon-400">Checks · INV-2026-0417</p>
        <ul className="mt-2 space-y-1.5">
          {["GSTIN checksum", "CGST + SGST = total tax", "Not a duplicate"].map((label, index) => (
            <motion.li
              key={label}
              initial={reduced ? false : { opacity: 0, x: -6 }}
              animate={seen || reduced ? { opacity: 1, x: 0 } : { opacity: 0, x: -6 }}
              transition={{ duration: 0.5, ease: EASE, delay: reduced ? 0 : 0.3 + index * 0.12 }}
              className="flex items-center justify-between text-[11px] text-carbon-700"
            >
              {label}
              <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-verify-500 text-white">
                <svg width="8" height="8" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true">
                  <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </motion.li>
          ))}
        </ul>
      </div>

      {/* Where the invoice ends up: a balanced purchase voucher for Tally */}
      <div className={`absolute right-[20px] top-[312px] w-[252px] overflow-hidden rounded-xl border border-[#E6E5EA] bg-white ${SOFT_SHADOW}`}>
        <div className="flex items-center justify-between border-b border-[#EFEEF2] px-3.5 py-2">
          <span className="text-[11px] font-semibold text-carbon-900">Purchase voucher</span>
          <span className="rounded-full bg-brand-500/10 px-1.5 py-px text-[9.5px] font-medium text-brand-700">Ready for Tally</span>
        </div>
        <div className="space-y-1 px-3.5 py-2.5 text-[10.5px] tabular-nums">
          {[
            ["Purchase A/c", "Dr", "42,000.00"],
            ["Input CGST 9%", "Dr", "3,780.00"],
            ["Input SGST 9%", "Dr", "3,780.00"],
            ["ACME Trading Co.", "Cr", "49,560.00"]
          ].map(([ledger, side, amount]) => (
            <p key={ledger} className="flex items-center gap-2 text-carbon-700">
              <span className="min-w-0 flex-1 truncate">{ledger}</span>
              <span className="w-4 text-carbon-400">{side}</span>
              <span className="w-[62px] text-right font-medium text-carbon-900">{amount}</span>
            </p>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ── 2. Bank statements ─────────────────────────────────────────────────── */

const TXNS = [
  { key: "t1", date: "04-03-26", narration: "NEFT-SHARMA ENTERPRISES-INV0012", ref: "N06341", dr: "", cr: "1,20,000.00", bal: "4,82,310.00" },
  { key: "t2", date: "07-03-26", narration: "UPI/RELIANCE FRESH/STORE 412", ref: "UPI8812", dr: "2,480.00", cr: "", bal: "4,79,830.00" },
  { key: "t3", date: "11-03-26", narration: "CHQ 004192 RENT MARCH", ref: "004192", dr: "45,000.00", cr: "", bal: "4,34,830.00" },
  { key: "t4", date: "16-03-26", narration: "IMPS-KUMAR AND SONS-221", ref: "IM7720", dr: "", cr: "88,500.00", bal: "5,23,330.00" },
  { key: "t5", date: "22-03-26", narration: "GST PMT-06 CHALLAN MAR", ref: "CIN2203", dr: "31,240.00", cr: "", bal: "4,92,090.00" }
];

const PARSED = [
  { key: "t1", date: "4 Mar", party: "Sharma Enterprises", amount: "+1,20,000.00" },
  { key: "t2", date: "7 Mar", party: "Reliance Fresh", amount: "−2,480.00" },
  { key: "t3", date: "11 Mar", party: "Rent · Chq 004192", amount: "−45,000.00" },
  { key: "t4", date: "16 Mar", party: "Kumar & Sons", amount: "+88,500.00" },
  { key: "t5", date: "22 Mar", party: "GST PMT-06 challan", amount: "−31,240.00" }
];

const StatementCanvas = () => {
  const reduced = useReducedMotion();
  const ref = useRef(null);
  const inView = useInView(ref, { amount: 0.4 });
  const [active, setHover] = useCycle(
    TXNS.map((t) => t.key),
    1400,
    inView && !reduced
  );

  return (
    <div ref={ref} className="relative h-full w-full">
      {/* The statement page */}
      <div
        className={`absolute left-[24px] top-[24px] w-[400px] rounded-[3px] bg-[#FDFCF9] px-4 pb-3 pt-3.5 text-[#1f2126] ${SOFT_SHADOW}`}
        style={{ fontFamily: PAPER_FONT }}
      >
        <div className="flex items-start justify-between border-b-2 border-[#0b3a6e] pb-1.5">
          <div>
            <p className="text-[9px] font-bold text-[#0b3a6e]">STATEMENT OF ACCOUNT</p>
            <p className="text-[6.5px] text-[#555]">Mehta Packaging Pvt. Ltd. · Current A/c ····4521</p>
          </div>
          <p className="text-right text-[6.5px] text-[#555]">
            Period 01-03-2026 to 31-03-2026
            <br />
            Page 1 of 3
          </p>
        </div>
        <div className="mt-1 grid grid-cols-[42px_1fr_40px_52px_56px_58px] gap-1.5 border-b border-[#999] py-[3px] text-[6.3px] font-bold">
          <span>Date</span>
          <span>Narration</span>
          <span>Ref</span>
          <span className="text-right">Withdrawal</span>
          <span className="text-right">Deposit</span>
          <span className="text-right">Balance</span>
        </div>
        {TXNS.map((t) => (
          <div
            key={t.key}
            className={`grid grid-cols-[42px_1fr_40px_52px_56px_58px] gap-1.5 border-b border-[#e3e3e3] py-[4px] text-[6.3px] transition-colors duration-500 ${
              active === t.key ? "bg-sky-500/[0.12]" : ""
            }`}
          >
            <span>{t.date}</span>
            <span className="truncate">{t.narration}</span>
            <span className="truncate">{t.ref}</span>
            <span className="text-right">{t.dr}</span>
            <span className="text-right">{t.cr}</span>
            <span className="text-right">{t.bal}</span>
          </div>
        ))}
        <div className="grid grid-cols-[42px_1fr] gap-1.5 py-[4px] text-[6.3px] text-[#999]">
          <span>…</span>
          <span>37 more transactions</span>
        </div>
      </div>

      {/* Verax: parsed rows */}
      <div className={`absolute bottom-[20px] right-[20px] w-[268px] overflow-hidden rounded-xl border border-[#E6E5EA] bg-white ${SOFT_SHADOW}`}>
        <div className="flex items-center justify-between border-b border-[#EFEEF2] px-3.5 py-2.5">
          <span className="text-[11.5px] font-semibold text-carbon-900">Transactions</span>
          <span className="text-[10.5px] tabular-nums text-carbon-400">42 rows · 3 pages</span>
        </div>
        <ul className="py-1" onMouseLeave={() => setHover(null)}>
          {PARSED.map((row) => (
            <li
              key={row.key}
              onMouseEnter={() => setHover(row.key)}
              className={`flex cursor-default items-center gap-2.5 px-3.5 py-[5px] transition-colors duration-300 ${
                active === row.key ? "bg-sky-500/[0.07]" : ""
              }`}
            >
              <span className="w-10 flex-none text-[10.5px] tabular-nums text-carbon-400">{row.date}</span>
              <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-carbon-900">{row.party}</span>
              <span
                className={`text-[11px] font-medium tabular-nums ${
                  row.amount.startsWith("+") ? "text-verify-700" : "text-carbon-700"
                }`}
              >
                {row.amount}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

/* ── 3. Purchase registers ──────────────────────────────────────────────── */

// Mirrors register_cleaner_service.py: drops blank / TOTAL / CANCELLED rows
// and parses mixed date and amount formats into one.
const MESSY = [
  { id: 1, cells: ["12/3/26", "Sharma Enterprises", "12500", "2,250"] },
  { id: 2, cells: ["2026-03-14", "Kumar & Sons", "₹ 3,150", "378.00"] },
  { id: 3, cells: ["15 Mar", "Patel Hardware", "8,400.00", "1512"] },
  { id: 4, cells: ["", "TOTAL", "24,050", "4,140"], kind: "total" },
  { id: 5, cells: ["16-03-26", "CANCELLED - Rao Traders", "-", "-"], kind: "cancelled" }
];

const CLEAN = [
  { id: 1, cells: ["12-03-2026", "Sharma Enterprises", "12,500.00", "2,250.00"] },
  { id: 2, cells: ["14-03-2026", "Kumar & Sons", "3,150.00", "378.00"] },
  { id: 3, cells: ["15-03-2026", "Patel Hardware", "8,400.00", "1,512.00"] }
];

const SheetCanvas = () => {
  const reduced = useReducedMotion();
  const ref = useRef(null);
  const inView = useInView(ref, { amount: 0.5 });
  const [clean, setClean] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!inView || touched || reduced) return undefined;
    const timer = window.setInterval(() => setClean((c) => !c), 2800);
    return () => window.clearInterval(timer);
  }, [inView, touched, reduced]);

  const rows = clean ? CLEAN : MESSY;
  const COLS = "grid-cols-[30px_84px_1.6fr_1fr_0.9fr]";

  return (
    <div ref={ref} className="relative flex h-full w-full items-center p-[20px]">
      <div className={`w-full overflow-hidden rounded-xl border border-[#E6E5EA] bg-white ${SOFT_SHADOW}`}>
        {/* Title bar */}
        <div className="flex items-center justify-between border-b border-[#EFEEF2] px-3 py-2">
          <span className="flex items-center gap-2 text-[11px] font-medium text-carbon-800">
            <span className="flex h-4 w-4 items-center justify-center rounded-[3px] bg-[#1E6B45] text-[8px] font-bold text-white">
              X
            </span>
            purchase-register-march.xlsx
          </span>
          <button
            type="button"
            onClick={() => {
              setTouched(true);
              setClean((c) => !c);
            }}
            aria-pressed={clean}
            className="flex items-center gap-2 rounded-full border border-[#E4E3E8] py-0.5 pl-2.5 pr-1 text-[10.5px] font-medium text-carbon-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            Clean with Verax
            <span className={`relative h-4 w-7 rounded-full transition-colors duration-500 ${clean ? "bg-brand-500" : "bg-carbon-900/15"}`}>
              <span
                className={`absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform duration-500 ease-out ${
                  clean ? "translate-x-3" : "translate-x-0"
                }`}
              />
            </span>
          </button>
        </div>
        {/* Formula bar */}
        <div className="flex items-center gap-2 border-b border-[#E3E4E8] bg-[#F8F9FA] px-2 py-1 text-[10.5px]">
          <span className="w-9 rounded border border-[#D9DBDF] bg-white px-1 text-center text-carbon-500">D4</span>
          <span className="italic text-carbon-400">fx</span>
          <span className="text-carbon-700">12500</span>
        </div>
        {/* Column letters */}
        <div className={`grid ${COLS} border-b border-[#D9DBDF] bg-[#F1F3F4] text-center text-[10px] text-carbon-500`}>
          {["", "A", "B", "C", "D"].map((c) => (
            <span key={c} className="border-r border-[#D9DBDF] py-0.5">
              {c}
            </span>
          ))}
        </div>
        <div className={`grid ${COLS} border-b border-[#E3E4E8] text-[10.5px] font-semibold text-carbon-700`}>
          <span className="border-r border-[#D9DBDF] bg-[#F1F3F4] py-1 text-center font-normal text-carbon-500">1</span>
          {["Date", "Supplier", "Taxable", "GST"].map((h, i) => (
            <span key={h} className={`border-r border-[#E3E4E8] px-1.5 py-1 ${i > 1 ? "text-right" : ""}`}>
              {h}
            </span>
          ))}
        </div>
        <AnimatePresence initial={false}>
          {rows.map((row, index) => (
            <motion.div
              key={row.id}
              initial={reduced ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={reduced ? undefined : { opacity: 0, height: 0 }}
              transition={{ duration: 0.55, ease: EASE }}
              className="overflow-hidden"
            >
              <div
                className={`grid ${COLS} border-b border-[#E3E4E8] text-[10.5px] ${
                  row.kind === "total" ? "font-bold" : ""
                } ${row.kind === "cancelled" ? "text-carbon-400 line-through" : "text-carbon-800"}`}
              >
                <span className="border-r border-[#D9DBDF] bg-[#F1F3F4] py-1 text-center text-carbon-500 no-underline">
                  {index + 2}
                </span>
                {row.cells.map((cell, col) => (
                  <AnimatePresence mode="wait" key={col}>
                    <motion.span
                      key={`${clean}-${cell}`}
                      initial={reduced ? false : { opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduced ? undefined : { opacity: 0, y: -5 }}
                      transition={{ duration: 0.25, ease: EASE, delay: reduced ? 0 : col * 0.04 + index * 0.03 }}
                      className={`truncate border-r border-[#E3E4E8] px-1.5 py-1 tabular-nums ${col > 1 ? "text-right" : ""} ${
                        clean ? "bg-verify-500/[0.04]" : ""
                      }`}
                    >
                      {cell || " "}
                    </motion.span>
                  </AnimatePresence>
                ))}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div className="flex items-center gap-4 bg-[#FAFAFB] px-3 py-1.5 text-[10px] text-carbon-500">
          <span className="rounded border border-[#E4E3E8] bg-white px-2 py-0.5 font-medium text-carbon-700">
            {clean ? "Cleaned" : "Sheet1"}
          </span>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={clean ? "c" : "m"}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="ml-auto"
            >
              {clean ? "2 rows dropped · dates and amounts normalised" : "5 rows · mixed formats"}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

/* ── 4. GST data ────────────────────────────────────────────────────────── */

const RECON = [
  { supplier: "ACME Trading Co.", gstin: "27AABCA1234A1ZJ", inv: "INV-2026-0417", books: "49,560.00", gstr: "49,560.00", status: "matched" },
  { supplier: "Shree Balaji Packaging", gstin: "24AAGFS7182K1ZS", inv: "INV-2026-0431", books: "12,400.00", gstr: "11,220.00", status: "differs" },
  { supplier: "Kumar & Sons", gstin: "27AAACK4410B1Z8", inv: "221", books: "3,528.00", gstr: "3,528.00", status: "matched" },
  { supplier: "Patel Hardware", gstin: "24AAHFP9087Q1ZA", inv: "PH/1187", books: "8,750.00", gstr: "—", status: "missing" },
  { supplier: "Sharma Enterprises", gstin: "27AAKFS3321M1ZX", inv: "INV/0012", books: "14,750.00", gstr: "14,750.00", status: "matched" }
];

const STATUS = {
  matched: { label: "Matched", className: "bg-verify-500/10 text-verify-700", dot: "bg-verify-500" },
  differs: { label: "Value differs", className: "bg-amber-500/12 text-amber-700", dot: "bg-amber-500" },
  missing: { label: "Not in 2B", className: "bg-rose-500/10 text-rose-700", dot: "bg-rose-500" }
};

const FILTERS = [
  { key: "all", label: "All", count: 194 },
  { key: "matched", label: "Matched", count: 184 },
  { key: "differs", label: "Value differs", count: 7 },
  { key: "missing", label: "Not in 2B", count: 3 }
];

const GstCanvas = () => {
  const reduced = useReducedMotion();
  const ref = useRef(null);
  const inView = useInView(ref, { amount: 0.4 });
  const [filter, setHover] = useCycle(
    FILTERS.map((f) => f.key),
    2200,
    inView && !reduced
  );
  const [picked, setPicked] = useState(null);
  const current = picked ?? filter;
  const rows = current === "all" ? RECON : RECON.filter((r) => r.status === current);

  return (
    <div ref={ref} className="relative h-full w-full p-[20px]">
      <div className={`h-full overflow-hidden rounded-xl border border-[#E6E5EA] bg-white ${SOFT_SHADOW}`}>
        <div className="flex items-center justify-between border-b border-[#EFEEF2] px-4 py-2.5">
          <div>
            <p className="text-[10.5px] text-carbon-400">Reconciliation · Mehta Packaging Pvt. Ltd.</p>
            <p className="text-[13px] font-semibold text-carbon-900">GSTR-2B · March 2026</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-[#E4E3E8] px-2.5 py-1 text-[11px] font-medium text-carbon-700">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M8 2.5v7.5M5 7l3 3 3-3M3 13h10" />
            </svg>
            Export to Excel
          </span>
        </div>

        <div className="flex gap-1.5 border-b border-[#EFEEF2] px-4 py-2" onMouseLeave={() => setHover(null)}>
          {FILTERS.map((f) => {
            const on = current === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onMouseEnter={() => setHover(f.key)}
                onClick={() => setPicked((p) => (p === f.key ? null : f.key))}
                className={`relative rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                  on ? "text-white" : "text-carbon-500 hover:text-carbon-900"
                }`}
              >
                {on ? (
                  <motion.span
                    layoutId="vx-recon-chip"
                    className="absolute inset-0 rounded-full bg-carbon-900"
                    transition={{ type: "spring", stiffness: 260, damping: 30 }}
                  />
                ) : null}
                <span className="relative">
                  {f.label} <span className={`tabular-nums ${on ? "text-white/60" : "text-carbon-400"}`}>{f.count}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-[1.5fr_1.1fr_0.9fr_0.9fr_1fr] gap-2 border-b border-[#EFEEF2] bg-[#FAFAFB] px-4 py-1.5 text-[10.5px] font-medium text-carbon-400">
          <span>Supplier</span>
          <span>Invoice</span>
          <span className="text-right">Books</span>
          <span className="text-right">GSTR-2B</span>
          <span className="text-right">Status</span>
        </div>
        <div className="relative">
          <AnimatePresence initial={false} mode="popLayout">
            {rows.map((row) => (
              <motion.div
                key={row.inv}
                layout={!reduced}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.35, ease: EASE }}
                className="grid grid-cols-[1.5fr_1.1fr_0.9fr_0.9fr_1fr] items-center gap-2 border-b border-[#F2F1F4] px-4 py-2 text-[11px]"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-carbon-900">{row.supplier}</span>
                  <span className="block truncate text-[10px] text-carbon-400">{row.gstin}</span>
                </span>
                <span className="truncate text-carbon-600">{row.inv}</span>
                <span className="text-right tabular-nums text-carbon-800">{row.books}</span>
                <span
                  className={`text-right tabular-nums ${
                    row.status === "differs" ? "font-semibold text-amber-700" : row.status === "missing" ? "text-carbon-300" : "text-carbon-800"
                  }`}
                >
                  {row.gstr}
                </span>
                <span className="text-right">
                  <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-medium ${STATUS[row.status].className}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${STATUS[row.status].dot}`} />
                    {STATUS[row.status].label}
                  </span>
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

/* ── The bento ──────────────────────────────────────────────────────────── */

// Invoices is the tall anchor tile; statements and registers stack beside it;
// GST reconciliation runs the full width underneath, text beside the screen.
const CARDS = [
  {
    title: "Invoices",
    body: "PDFs, scans and phone photos — stamped, signed, slightly crooked. Supplier, GSTIN, number, date, every line item and the tax, each with a confidence score.",
    hint: "Hover a field to see where it came from",
    span: "lg:col-span-7 lg:row-span-2",
    canvas: { w: 600, h: 470 },
    Visual: InvoiceCanvas
  },
  {
    title: "Bank statements",
    body: "Every transaction read as a row — date, narration, withdrawal, deposit — across every page.",
    hint: "Hover a row to find its line",
    span: "lg:col-span-5",
    canvas: { w: 480, h: 300 },
    Visual: StatementCanvas
  },
  {
    title: "Purchase registers",
    body: "Verax finds the header, drops blank, total and cancelled rows, and puts dates and amounts in one format.",
    hint: "Flip the switch",
    span: "lg:col-span-5",
    canvas: { w: 480, h: 300 },
    Visual: SheetCanvas
  },
  {
    title: "GST data",
    body: "Your purchase records matched against GSTR-2B, with every difference and every invoice your supplier never filed — then exported to Excel.",
    hint: "Filter the results",
    span: "lg:col-span-12",
    canvas: { w: 700, h: 330 },
    wide: true,
    Visual: GstCanvas
  }
];

const Tile = ({ title, body, hint, canvas, wide, Visual }) => (
  <article
    className={`group flex h-full flex-col rounded-[22px] border border-carbon-900/[0.07] bg-white p-2 shadow-[0_1px_2px_rgba(14,16,19,0.04)] transition-shadow duration-500 hover:shadow-[0_30px_70px_-45px_rgba(38,30,110,0.3)] ${
      wide ? "lg:flex-row" : ""
    }`}
  >
    <div
      className={`px-4 pb-5 pt-4 sm:px-5 ${
        wide ? "lg:flex lg:w-[34%] lg:flex-none lg:flex-col lg:justify-between lg:py-6 lg:pr-8" : ""
      }`}
    >
      <div>
        <h3 className="font-inter text-[1.1875rem] font-normal tracking-[-0.02em] text-carbon-900">{title}</h3>
        <p className="mt-1.5 max-w-[34rem] text-[0.9375rem] leading-[1.6] text-carbon-500">{body}</p>
      </div>
      <p className="mt-3 hidden items-center gap-1.5 text-[12px] text-carbon-400 transition-colors duration-300 group-hover:text-carbon-600 sm:flex">
        <span className="h-1.5 w-1.5 rounded-full bg-brand-500/60" aria-hidden="true" />
        {hint}
      </p>
    </div>

    {/* The inset surface every mockup sits on — one neutral, a faint grid */}
    <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-[16px] bg-[#F5F5F7]">
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
      <div className="relative w-full" style={{ maxWidth: canvas.w }}>
        <FitCanvas w={canvas.w} h={canvas.h}>
          <Visual />
        </FitCanvas>
      </div>
    </div>
  </article>
);

const DocumentTypes = () => (
  <Band id="documents">
    <Heading
      kicker="Coverage"
      title="One system for every financial document."
      tint="Read, cleaned and checked on arrival."
    />

    <RevealGroup className="mt-14 grid gap-3 lg:grid-cols-12" stagger={0.1}>
      {CARDS.map(({ span, ...card }) => (
        <RevealItem key={card.title} className={span}>
          <Tile {...card} />
        </RevealItem>
      ))}
    </RevealGroup>
  </Band>
);

export default DocumentTypes;
