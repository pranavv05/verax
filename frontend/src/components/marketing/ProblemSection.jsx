import { useLayoutEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform
} from "framer-motion";
import { EASE } from "../public/motion";
import { VeraxMark } from "../brand/VeraxLogo";
import { Kicker } from "./v3";

/**
 * "The work today" — a pinned, scroll-driven scene in three acts.
 *
 *   I.   The mess      Scrolling walks three of the eight manual steps. A cursor darts
 *                      between five apps, the active window comes forward, the
 *                      unread count climbs and sticky notes pile up.
 *   II.  Absorption    A Verax core ignites; every window and note spirals
 *                      into it — shrinking, blurring, as if being read — while
 *                      the warm, cluttered stage cools and the headline
 *                      dissolves into its answer.
 *   III. The calm      The review queue rises out of the core; its counters
 *                      count up with the scroll and the step progress bar
 *                      collapses into one.
 *
 * Everything is driven by one `scrollYProgress` over a tall container with a
 * sticky viewport, so the reader controls the pace and can scrub backwards.
 * The stage is a fixed 1040×510 canvas scaled (0.2×–1.4×) to fit the space left under the
 * headline, so the composition holds on phones. Under reduced motion there is
 * no pinning: the manual desk and the Verax card are shown one after the other.
 * The 207 / 9 split is the page's illustrative figure and is labelled so.
 */

// Two art-directed layouts of the same desk: landscape for wide screens,
// portrait for phones, so the scene fills a narrow viewport at a readable size
// instead of shrinking a landscape desk to a third of its width.
const LAYOUTS = {
  landscape: {
    w: 1040,
    h: 510,
    windows: {
      email: { x: 24, y: 28, rotate: -1.2 },
      pdf: { x: 330, y: 92, rotate: 1 },
      sheet: { x: 560, y: 20, rotate: 0.8 },
      voucher: { x: 70, y: 272, rotate: 0.6 },
      gst: { x: 560, y: 284, rotate: -0.8 }
    },
    notes: [
      { x: 420, y: 250 },
      { x: 880, y: 220 },
      { x: 20, y: 424 },
      { x: 860, y: 424 }
    ]
  },
  portrait: {
    w: 520,
    h: 820,
    windows: {
      email: { x: 12, y: 16, rotate: -1.2 },
      pdf: { x: 200, y: 150, rotate: 1.4 },
      sheet: { x: 40, y: 300, rotate: 0.8 },
      voucher: { x: 8, y: 460, rotate: 0.6 },
      gst: { x: 90, y: 630, rotate: -0.8 }
    },
    notes: [
      { x: 330, y: 70 },
      { x: 350, y: 420 },
      { x: 20, y: 250 },
      { x: 340, y: 600 }
    ]
  }
};

// Scroll choreography (fractions of the section's scroll).
const ACT = {
  manualEnd: 0.3, // the three steps play across [0, manualEnd]
  coreIn: [0.26, 0.36],
  absorbStart: 0.33, // windows start falling in
  absorbSpan: 0.14,
  absorbStagger: 0.018,
  headlineSwap: [0.34, 0.44],
  cardIn: [0.52, 0.64],
  coreOut: [0.55, 0.66],
  counters: [0.58, 0.74]
};

// Three representative steps of the eight — enough to feel the grind
// without making the reader scroll through all of it.
const STEPS = [
  { text: "Download the attachments from a 38-email inbox.", window: "email" },
  { text: "Retype every line item into the accounting software.", window: "voucher" },
  { text: "Match it against GSTR-2B in a spreadsheet — then do it all again.", window: "gst" }
];

// Canvas positions, rotation, and where the cursor aims inside each window.
const WINDOWS = [
  { key: "email", w: 380, h: 230, aim: [150, 132] },
  { key: "pdf", w: 280, h: 200, aim: [120, 70] },
  { key: "sheet", w: 450, h: 190, aim: [300, 150] },
  { key: "voucher", w: 430, h: 200, aim: [260, 120] },
  { key: "gst", w: 420, h: 170, aim: [300, 110] }
];

const placeWindows = (layout) =>
  WINDOWS.map((win) => ({ ...win, ...LAYOUTS[layout].windows[win.key] }));

const NOTES = [
  { text: "Chase Kumar & Sons — missing bill #219", rotate: -4, color: "#FFF3A8", at: 0 },
  { text: "GSTR-2B due 14th!!", rotate: 5, color: "#FFD6E0", at: 1 },
  { text: "Patel — which invoice is the duplicate?", rotate: 3, color: "#D9F2FF", at: 1 },
  { text: "Re-check CGST on ACME", rotate: -3, color: "#FFF3A8", at: 2 }
];

const placeNotes = (layout) => NOTES.map((note, index) => ({ ...note, ...LAYOUTS[layout].notes[index] }));

// Eases for scroll-mapped transforms. A linear map of scroll → position reads
// as mechanical; easing each range makes every move start and settle softly.
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeIn = (t) => t * t * t;

/* ── Fit the canvas into the measured stage box ─────────────────────────── */

const MAX_SCALE = 1.4;

const useFit = () => {
  const ref = useRef(null);
  const [fit, setFit] = useState({ scale: 1, layout: "landscape" });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const layout = width < 640 ? "portrait" : "landscape";
      const { w, h } = LAYOUTS[layout];
      // Scales up as well as down, so a large screen gets a large scene.
      const scale = Math.max(0.2, Math.min(MAX_SCALE, width / w, height > 0 ? height / h : 1));
      setFit((prev) => (prev.scale === scale && prev.layout === layout ? prev : { scale, layout }));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, fit];
};

/* ── App windows ────────────────────────────────────────────────────────── */

const Frame = ({ title, badge, active, children }) => (
  <div
    className={`h-full overflow-hidden rounded-xl border bg-white transition-shadow duration-500 ${
      active
        ? "border-brand-500/40 shadow-[0_30px_60px_-24px_rgba(38,30,110,0.5),0_0_0_4px_rgba(102,87,217,0.1)]"
        : "border-carbon-900/10 shadow-[0_18px_40px_-24px_rgba(14,16,19,0.45)]"
    }`}
  >
    <div className="flex items-center gap-2 border-b border-carbon-900/[0.07] bg-[#F7F7F9] px-3 py-2">
      <span className="flex gap-1" aria-hidden="true">
        <span className="h-2 w-2 rounded-full bg-carbon-900/15" />
        <span className="h-2 w-2 rounded-full bg-carbon-900/15" />
        <span className="h-2 w-2 rounded-full bg-carbon-900/15" />
      </span>
      <span className="flex-1 truncate text-[11px] font-medium text-carbon-600">{title}</span>
      {badge}
    </div>
    {children}
  </div>
);

const EmailApp = ({ active, unread }) => (
  <Frame
    title="Inbox — accounts@yourfirm.in"
    active={active}
    badge={
      <span className="rounded bg-rose-500 px-1.5 text-[10px] font-semibold tabular-nums text-white">{unread}</span>
    }
  >
    <div className="divide-y divide-carbon-900/[0.06]">
      {[
        ["Kumar & Sons", "Fwd: March bills (6 attachments)", true],
        ["Patel Hardware", "Invoices + bank stmt — sorry for delay", false],
        ["Shree Balaji Pkg.", "RE: RE: GST invoice copy", false]
      ].map(([from, subject, open]) => (
        <div key={from} className={`px-3 py-2 ${open ? "bg-brand-500/[0.05]" : ""}`}>
          <div className="flex justify-between text-[11px]">
            <span className="font-semibold text-carbon-900">{from}</span>
            <span className="text-carbon-400">11:48 PM</span>
          </div>
          <p className="truncate text-[11px] text-carbon-500">{subject}</p>
        </div>
      ))}
      <div className="flex flex-wrap gap-1.5 px-3 py-2.5">
        {["bill_0417.pdf", "IMG_2231.jpg", "IMG_2232.jpg", "stmt.pdf"].map((file) => (
          <span key={file} className="rounded border border-carbon-900/10 bg-[#F7F7F9] px-1.5 py-0.5 text-[10px] text-carbon-600">
            {file}
          </span>
        ))}
      </div>
    </div>
  </Frame>
);

const PdfApp = ({ active }) => (
  <Frame title="bill_0417.pdf — Preview" active={active}>
    <div className="h-full bg-[#EDEDF0] p-3">
      <div className="rounded-sm bg-white p-3 text-[8px] leading-[1.5] text-carbon-800" style={{ fontFamily: "Arial, sans-serif" }}>
        <div className="flex justify-between">
          <span className="text-[10px] font-bold">ACME Trading Co.</span>
          <span className="font-bold text-[#1d4ed8]">TAX INVOICE</span>
        </div>
        <p className="mt-1">GSTIN: 27AABCA1234A1ZJ</p>
        <p>No. INV-2026-0417 · 17-03-2026</p>
        <div className="mt-2 space-y-1" aria-hidden="true">
          {[80, 64, 72, 50].map((w) => (
            <span key={w} className="block h-1 rounded bg-carbon-900/10" style={{ width: `${w}%` }} />
          ))}
        </div>
        <p className="mt-2 text-right font-bold">Total ₹ 49,560.00</p>
      </div>
    </div>
  </Frame>
);

const SheetApp = ({ active }) => (
  <Frame title="purchase-register-march.xlsx" active={active}>
    <div className="text-[10.5px]">
      <div className="grid grid-cols-[28px_1.4fr_1fr_1fr_0.8fr] border-b border-carbon-900/10 bg-[#F3F6F4] text-carbon-500">
        {["", "Supplier", "Invoice", "Taxable", "GST"].map((h, i) => (
          <span key={i} className="border-r border-carbon-900/10 px-1.5 py-1 font-medium">
            {h}
          </span>
        ))}
      </div>
      {[
        ["Sharma Ent.", "INV/0012", "12500", "2,250"],
        ["Kumar & Sons", "#221", "3150", "378"],
        ["ACME Trading", "INV-2026-0417", "42,000", "=C4*18%"],
        ["", "", "", ""]
      ].map((row, r) => (
        <div key={r} className="grid grid-cols-[28px_1.4fr_1fr_1fr_0.8fr] border-b border-carbon-900/[0.07]">
          <span className="border-r border-carbon-900/10 bg-[#F7F7F9] px-1.5 py-1 text-carbon-400">{r + 2}</span>
          {row.map((cell, c) => (
            <span
              key={c}
              className={`truncate border-r border-carbon-900/[0.07] px-1.5 py-1 ${
                r === 2 && c === 3
                  ? "bg-white text-carbon-900 outline outline-2 -outline-offset-1 outline-[#1f7a4c]"
                  : "text-carbon-700"
              }`}
            >
              {cell || " "}
            </span>
          ))}
        </div>
      ))}
    </div>
  </Frame>
);

const VoucherApp = ({ active }) => (
  <Frame title="Accounting software — Purchase voucher" active={active}>
    <div className="space-y-2 p-3 text-[10.5px]">
      <div className="grid grid-cols-2 gap-2">
        {[
          ["Party A/c", "ACME Trading Co."],
          ["Supplier inv. no.", "INV-2026-04"]
        ].map(([label, value]) => (
          <div key={label}>
            <p className="text-carbon-400">{label}</p>
            <p className="mt-0.5 rounded border border-carbon-900/15 px-1.5 py-1 text-carbon-900">
              {value}
              {label.startsWith("Supplier") ? (
                <span className="ml-px inline-block h-3 w-px animate-pulse bg-carbon-900 align-middle" />
              ) : null}
            </p>
          </div>
        ))}
      </div>
      <div className="rounded border border-carbon-900/10">
        {[
          ["Industrial Packaging Rolls", "80", "20,000.00"],
          ["Corrugated Cartons — Size B", "150", "15,000.00"],
          ["", "", ""]
        ].map((row, i) => (
          <div key={i} className="grid grid-cols-[1fr_40px_70px] border-b border-carbon-900/[0.07] px-1.5 py-1 last:border-0">
            <span className="truncate text-carbon-700">{row[0] || " "}</span>
            <span className="text-right text-carbon-700">{row[1]}</span>
            <span className="text-right text-carbon-700">{row[2]}</span>
          </div>
        ))}
      </div>
    </div>
  </Frame>
);

const GstApp = ({ active }) => (
  <Frame title="GST portal — GSTR-2B · March 2026" active={active}>
    <div className="p-3 text-[10.5px]">
      <div className="flex items-center justify-between rounded bg-[#FFF7E6] px-2 py-1.5 text-[10px] text-amber-800">
        Session expires in 04:59
        <span className="font-semibold underline">Download Excel</span>
      </div>
      <div className="mt-2 space-y-1">
        {[
          ["27AABCA1234A1ZJ", "INV-2026-0417", "49,560.00"],
          ["24AAGFS7182K1ZS", "INV-2026-0431", "11,220.00"],
          ["27AAACK4410B1Z8", "221", "3,528.00"]
        ].map((row) => (
          <div key={row[1]} className="grid grid-cols-[1.3fr_1fr_0.8fr] gap-2 border-b border-carbon-900/[0.07] pb-1 text-carbon-700">
            <span className="truncate">{row[0]}</span>
            <span className="truncate">{row[1]}</span>
            <span className="text-right">{row[2]}</span>
          </div>
        ))}
      </div>
    </div>
  </Frame>
);

const APPS = { email: EmailApp, pdf: PdfApp, sheet: SheetApp, voucher: VoucherApp, gst: GstApp };

/* ── Scroll-bound pieces ────────────────────────────────────────────────── */

/** A window that sits on the desk, then spirals into the core. */
const DeskWindow = ({ win, index, progress, active, unread, core }) => {
  const start = ACT.absorbStart + index * ACT.absorbStagger;
  const end = start + ACT.absorbSpan;
  const range = [start, end];
  const dx = core.x - (win.x + win.w / 2);
  const dy = core.y - (win.y + win.h / 2);
  const spin = index % 2 ? 24 : -24;

  // Position eases in and out; scale and fade ease in, so a window drifts
  // before it is pulled. No per-frame blur filter: it repainted every window
  // on every scroll tick and made the absorption stutter.
  const x = useTransform(progress, range, [win.x, win.x + dx], { clamp: true, ease: easeInOut });
  const y = useTransform(progress, range, [win.y, win.y + dy], { clamp: true, ease: easeInOut });
  const scale = useTransform(progress, range, [1, 0.08], { clamp: true, ease: easeIn });
  const rotate = useTransform(progress, range, [win.rotate, win.rotate + spin], { clamp: true, ease: easeInOut });
  const opacity = useTransform(progress, [start + ACT.absorbSpan * 0.45, end], [1, 0], { clamp: true, ease: easeIn });
  const App = APPS[win.key];

  return (
    <motion.div
      className="absolute left-0 top-0 origin-center"
      style={{
        width: win.w,
        height: win.h,
        x,
        y,
        scale,
        rotate,
        opacity,
        zIndex: active ? 40 : 10 + index,
        willChange: "transform, opacity"
      }}
    >
      <motion.div
        className="h-full"
        animate={{ scale: active ? 1.02 : 1, y: active ? -4 : 0 }}
        transition={{ type: "spring", stiffness: 120, damping: 22, mass: 0.8 }}
      >
        <App active={active} unread={unread} />
      </motion.div>
    </motion.div>
  );
};

/** Sticky notes: appear with the step that caused them, then get absorbed. */
const StickyNote = ({ note, index, progress, visible, core }) => {
  const start = ACT.absorbStart + 0.01 + index * 0.015;
  const range = [start, start + 0.1];
  const x = useTransform(progress, range, [note.x, core.x - 80], { clamp: true, ease: easeInOut });
  const y = useTransform(progress, range, [note.y, core.y - 30], { clamp: true, ease: easeInOut });
  const scale = useTransform(progress, range, [1, 0.1], { clamp: true, ease: easeIn });
  const opacity = useTransform(progress, [start + 0.04, start + 0.1], [1, 0], { clamp: true, ease: easeIn });

  return (
    <motion.div
      className="absolute left-0 top-0 z-[45]"
      style={{ x, y, scale, opacity, willChange: "transform, opacity" }}
    >
      <AnimatePresence>
        {visible ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, rotate: note.rotate - 6, y: -8 }}
            animate={{ opacity: 1, scale: 1, rotate: note.rotate, y: 0 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ type: "spring", stiffness: 160, damping: 20, mass: 0.7 }}
            className="w-[160px] rounded-[3px] px-3 pb-3 pt-4 text-[12px] leading-[1.35] text-carbon-800 shadow-[0_10px_20px_-8px_rgba(14,16,19,0.35)]"
            style={{ background: note.color, fontFamily: "'Segoe Print','Bradley Hand','Comic Sans MS',cursive" }}
          >
            <span className="absolute left-1/2 top-1 h-2 w-8 -translate-x-1/2 rounded-sm bg-white/60" aria-hidden="true" />
            {note.text}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
};

const Core = ({ progress, core }) => {
  const coreRange = [ACT.coreIn[0], ACT.coreIn[1], ACT.coreOut[0], ACT.coreOut[1]];
  const scale = useTransform(progress, coreRange, [0, 1, 1.1, 0.5], { ease: easeInOut });
  const opacity = useTransform(progress, coreRange, [0, 1, 1, 0], { ease: easeInOut });
  const glow = useTransform(progress, [ACT.absorbStart, ACT.absorbStart + 0.18], [0.5, 1.4]);

  return (
    <motion.div
      className="pointer-events-none absolute z-[60] flex items-center justify-center"
      style={{ left: core.x - 90, top: core.y - 90, width: 180, height: 180, scale, opacity, willChange: "transform, opacity" }}
      aria-hidden="true"
    >
      <motion.span
        className="absolute inset-[-60px] rounded-full blur-2xl"
        style={{
          scale: glow,
          background: "radial-gradient(closest-side, rgba(102,87,217,0.55), rgba(77,141,255,0.3) 55%, transparent)"
        }}
      />
      <span className="vx-ring absolute inset-4 rounded-full border border-brand-400/60" />
      <span className="vx-ring absolute inset-4 rounded-full border border-sky-400/50" style={{ animationDelay: "1s" }} />
      <span className="relative flex h-24 w-24 items-center justify-center rounded-[28px] border border-white/15 bg-carbon-950 shadow-[0_30px_60px_-10px_rgba(102,87,217,0.8)]">
        <VeraxMark size={40} tone="light" />
      </span>
    </motion.div>
  );
};

/** Counts up with the scroll rather than with time. */
const ScrollCount = ({ progress, to, className }) => {
  const value = useTransform(progress, ACT.counters, [0, to], { clamp: true });
  const rounded = useTransform(value, (v) => Math.round(v));
  return <motion.span className={className}>{rounded}</motion.span>;
};

// The real routing reasons (document-processing.worker.js), on the same
// documents the live Documents table below shows.
const EXCEPTIONS = [
  { client: "Patel Hardware", doc: "IMG_2231.jpg", reason: "Low confidence · 0.34", tone: "amber" },
  { client: "Kumar & Sons", doc: "WhatsApp Image 0331.jpg", reason: "Unrecognised document", tone: "rose" },
  { client: "Sharma Enterprises", doc: "statement_q4.pdf", reason: "Reads as a bank statement", tone: "amber" }
];

const ExceptionRow = ({ row, index, progress }) => {
  const start = ACT.counters[0] + 0.02 + index * 0.03;
  const opacity = useTransform(progress, [start, start + 0.06], [0, 1], { clamp: true, ease: easeOut });
  const x = useTransform(progress, [start, start + 0.06], [12, 0], { clamp: true, ease: easeOut });

  return (
    <motion.li style={{ opacity, x }} className="flex items-center gap-3.5 rounded-lg px-2 py-3">
      <span className={`h-2.5 w-2.5 flex-none rounded-full ${row.tone === "rose" ? "bg-rose-500" : "bg-amber-500"}`} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium text-carbon-900">{row.client}</span>
        <span className="block text-[12.5px] text-carbon-400">{row.doc}</span>
      </span>
      <span className="text-[13.5px] text-carbon-500">{row.reason}</span>
    </motion.li>
  );
};

const VeraxCard = ({ progress }) => (
  <div className="w-[660px] max-w-full overflow-hidden rounded-[20px] border border-carbon-900/[0.06] bg-white shadow-[0_40px_90px_-40px_rgba(38,30,110,0.4),0_2px_6px_-2px_rgba(14,16,19,0.06)]">
    <div className="flex items-center justify-between border-b border-carbon-900/[0.07] px-7 py-5">
      <div>
        <p className="text-[13px] text-carbon-400">Verax · March close · all clients</p>
        <p className="mt-0.5 text-[19px] font-semibold tracking-[-0.01em] text-carbon-900">Your review queue</p>
      </div>
      <span className="rounded-full bg-verify-500/12 px-3 py-1.5 text-[12.5px] font-medium text-verify-700">Up to date</span>
    </div>

    <div className="grid grid-cols-2 gap-4 px-7 pt-6">
      <div className="rounded-2xl bg-verify-50 px-5 py-4">
        <p className="text-[13px] font-medium text-verify-700">Cleared automatically</p>
        <ScrollCount
          progress={progress}
          to={207}
          className="mt-2 block text-[38px] font-semibold leading-none tracking-[-0.03em] text-carbon-900 tabular-nums"
        />
      </div>
      <div className="rounded-2xl bg-amber-500/[0.08] px-5 py-4">
        <p className="text-[13px] font-medium text-amber-700">Need a person</p>
        <ScrollCount
          progress={progress}
          to={9}
          className="mt-2 block text-[38px] font-semibold leading-none tracking-[-0.03em] text-amber-600 tabular-nums"
        />
      </div>
    </div>

    <ul className="px-5 py-3">
      {EXCEPTIONS.map((row, index) => (
        <ExceptionRow key={row.doc} row={row} index={index} progress={progress} />
      ))}
    </ul>

    <div className="flex items-center justify-between border-t border-carbon-900/[0.07] bg-[#FAFAFB] px-7 py-4">
      <span className="text-[12.5px] text-carbon-400">+ 6 more · illustrative figures</span>
      <span className="rounded-lg bg-carbon-900 px-4 py-2 text-[14px] font-medium text-white">Review 9 exceptions</span>
    </div>
  </div>
);

const Cursor = ({ target, progress, windows }) => {
  const win = windows.find((w) => w.key === target);
  const opacity = useTransform(progress, [0, 0.02, ACT.absorbStart - 0.04, ACT.absorbStart], [0, 1, 1, 0]);
  return (
    <motion.svg
      width="22"
      height="22"
      viewBox="0 0 20 20"
      aria-hidden="true"
      className="pointer-events-none absolute left-0 top-0 z-50 drop-shadow-[0_2px_3px_rgba(0,0,0,0.35)]"
      style={{ opacity }}
      animate={{ x: win.x + win.aim[0], y: win.y + win.aim[1] }}
      transition={{ type: "spring", stiffness: 70, damping: 18, mass: 0.9 }}
    >
      <path d="M3 2.5v13.2l3.6-3.4 2.3 5.2 2.3-1-2.3-5.1h5z" fill="#0E1013" stroke="#fff" strokeWidth="1.2" strokeLinejoin="round" />
    </motion.svg>
  );
};

/** Eight segments that fill with the steps, then fold into one. */
const StepRail = ({ step, progress }) => {
  const collapsed = useTransform(progress, [ACT.absorbStart, ACT.absorbStart + 0.14], [0, 1], {
    clamp: true,
    ease: easeInOut
  });
  return (
    <div className="flex w-full max-w-[320px] items-center gap-1.5" aria-hidden="true">
      {STEPS.map((s, index) => (
        <RailSegment key={s.text} index={index} step={step} collapsed={collapsed} />
      ))}
    </div>
  );
};

const RailSegment = ({ index, step, collapsed }) => {
  // Segment 0 grows to fill the rail; the other seven shrink away.
  const flex = useTransform(collapsed, [0, 1], index === 0 ? [1, STEPS.length] : [1, 0.0001]);
  const opacity = useTransform(collapsed, [0, 1], index === 0 ? [1, 1] : [1, 0]);
  const gradient = useTransform(collapsed, [0.4, 1], [0, 1]);
  const filled = index <= step;

  return (
    <motion.span className="relative h-1 overflow-hidden rounded-full bg-carbon-900/10" style={{ flexGrow: flex, flexBasis: 0, opacity }}>
      <span
        className={`absolute inset-y-0 left-0 rounded-full bg-carbon-900 transition-[width] duration-700 ease-out ${filled ? "w-full" : "w-0"}`}
      />
      {index === 0 ? (
        <motion.span
          className="absolute inset-0 rounded-full bg-gradient-to-r from-brand-500 via-sky-500 to-verify-500"
          style={{ opacity: gradient }}
        />
      ) : null}
    </motion.span>
  );
};

/* ── The scene ──────────────────────────────────────────────────────────── */

const Scene = () => {
  const containerRef = useRef(null);
  const [stageRef, fit] = useFit();
  const { scale, layout } = fit;
  const CANVAS_W = LAYOUTS[layout].w;
  const CANVAS_H = LAYOUTS[layout].h;
  const core = { x: CANVAS_W / 2, y: CANVAS_H / 2 };
  const windows = placeWindows(layout);
  const notes = placeNotes(layout);
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start start", "end end"] });
  // A soft, critically damped spring: wheel ticks arrive as discrete jumps,
  // and this turns them into one continuous glide without overshoot.
  const progress = useSpring(scrollYProgress, { stiffness: 60, damping: 20, mass: 0.6, restDelta: 0.0001 });

  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState("manual"); // manual · absorb · calm
  useMotionValueEvent(progress, "change", (p) => {
    setStep(Math.min(STEPS.length - 1, Math.max(0, Math.floor((p / ACT.manualEnd) * STEPS.length))));
    setPhase(p < ACT.absorbStart ? "manual" : p < ACT.cardIn[0] ? "absorb" : "calm");
  });

  const activeWindow = STEPS[step].window;
  const unread = 38 + step * 5;

  // Stage atmosphere: warm and busy → cool and calm.
  // Two fixed gradients cross-faded by opacity, rather than interpolating the
  // gradient string (which repainted the whole stage every frame).
  const calmBg = useTransform(progress, [ACT.absorbStart - 0.05, ACT.cardIn[0]], [0, 1], { clamp: true, ease: easeInOut });
  // Once the desk is gone the frame has nothing to hold: it dissolves while
  // the review card rises, leaving the card on the page itself.
  const frameOpacity = useTransform(progress, ACT.cardIn, [1, 0], { clamp: true, ease: easeInOut });

  // Headline swap.
  const headEase = { clamp: true, ease: easeInOut };
  const headIn = [ACT.headlineSwap[1] - 0.04, ACT.headlineSwap[1] + 0.06];
  const manualHeadOpacity = useTransform(progress, ACT.headlineSwap, [1, 0], headEase);
  const manualHeadBlur = useTransform(progress, ACT.headlineSwap, ["blur(0px)", "blur(6px)"], headEase);
  const manualHeadY = useTransform(progress, ACT.headlineSwap, [0, -12], headEase);
  const veraxHeadOpacity = useTransform(progress, headIn, [0, 1], headEase);
  const veraxHeadBlur = useTransform(progress, headIn, ["blur(6px)", "blur(0px)"], headEase);
  const veraxHeadY = useTransform(progress, headIn, [12, 0], headEase);

  // Card rising out of the core.
  const cardEase = { clamp: true, ease: easeOut };
  const cardOpacity = useTransform(progress, ACT.cardIn, [0, 1], cardEase);
  const cardScale = useTransform(progress, ACT.cardIn, [0.82, 1], cardEase);
  const cardY = useTransform(progress, ACT.cardIn, [28, 0], cardEase);

  // Scroll hint fades as soon as the reader starts.
  const hintOpacity = useTransform(progress, [0, 0.04], [1, 0]);

  return (
    <div ref={containerRef} className="relative h-[240vh]">
      <div className="sticky top-16 flex h-[calc(100svh-4rem)] flex-col px-4 pb-4 pt-5 sm:px-8 lg:pt-7">
        {/* Headline — two lines of copy occupying the same place */}
        <div className="mx-auto w-full max-w-[52rem] text-center">
          <Kicker className="justify-center">The work today</Kicker>
          <div className="relative mt-3 h-[4.6rem] sm:h-[5.2rem]">
            <motion.h2
              style={{ opacity: manualHeadOpacity, filter: manualHeadBlur, y: manualHeadY }}
              className="absolute inset-x-0 top-0 font-inter text-[clamp(1.5rem,2.8vw,2.25rem)] font-normal leading-[1.14] tracking-[-0.03em] text-carbon-900"
            >
              Your staff shouldn&apos;t be doing this.{" "}
              <span className="text-carbon-400">Eight steps, five apps, every document.</span>
            </motion.h2>
            <motion.p
              aria-hidden="true"
              style={{ opacity: veraxHeadOpacity, filter: veraxHeadBlur, y: veraxHeadY }}
              className="absolute inset-x-0 top-0 font-inter text-[clamp(1.5rem,2.8vw,2.25rem)] font-normal leading-[1.14] tracking-[-0.03em] text-carbon-900"
            >
              Verax does the eight steps.{" "}
              <span className="vx-hero-gradient">You review the exceptions.</span>
            </motion.p>
          </div>
        </div>

        {/* Stage */}
        <div ref={stageRef} className="relative mx-auto mt-3 flex min-h-0 w-full max-w-[1400px] flex-1 items-center justify-center">
          <div className="relative" style={{ width: CANVAS_W * scale, height: CANVAS_H * scale }}>
            <motion.div
              aria-hidden="true"
              className="absolute inset-0 overflow-hidden rounded-[28px] border border-white/70 shadow-[0_40px_80px_-50px_rgba(38,30,110,0.45)]"
              style={{ opacity: frameOpacity, backgroundImage: "linear-gradient(180deg, #F6EEE4 0%, #F1ECF4 100%)" }}
            >
              <motion.div
                className="absolute inset-0"
                style={{ opacity: calmBg, backgroundImage: "linear-gradient(180deg, #ECEBFA 0%, #EAF3F6 100%)" }}
              />
            </motion.div>
            <div
              className="absolute left-0 top-0 origin-top-left"
              style={{ width: CANVAS_W, height: CANVAS_H, transform: `scale(${scale})` }}
            >
              {windows.map((win, index) => (
                <DeskWindow
                  key={`${layout}-${win.key}`}
                  core={core}
                  win={win}
                  index={index}
                  progress={progress}
                  active={phase === "manual" && win.key === activeWindow}
                  unread={unread}
                />
              ))}

              {notes.map((note, index) => (
                <StickyNote
                  key={`${layout}-${note.text}`}
                  core={core}
                  note={note}
                  index={index}
                  progress={progress}
                  visible={step >= note.at || phase !== "manual"}
                />
              ))}

              <Cursor target={activeWindow} progress={progress} windows={windows} />
              <Core progress={progress} core={core} />

              <motion.div
                className="absolute inset-0 z-[70] flex items-center justify-center px-2"
                style={{
                  opacity: cardOpacity,
                  scale: cardScale,
                  y: cardY,
                  willChange: "transform, opacity",
                  pointerEvents: phase === "calm" ? "auto" : "none"
                }}
              >
                <VeraxCard progress={progress} />
              </motion.div>
            </div>
          </div>
        </div>

        {/* Caption + rail */}
        <div className="relative mx-auto mt-3 flex w-full max-w-[640px] flex-col items-center gap-2.5">
          <div className="flex h-6 items-center justify-center overflow-hidden text-center">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={phase === "manual" ? `m-${step}` : phase}
                initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
                transition={{ duration: 0.4, ease: EASE }}
                className="text-[14px] text-carbon-600 sm:text-[15px]"
              >
                {phase === "manual" ? (
                  <>
                    <span className="font-medium text-carbon-900">Every document · </span>
                    {STEPS[step].text}
                  </>
                ) : phase === "absorb" ? (
                  <span className="font-medium text-carbon-900">Verax reads every document, the moment it lands…</span>
                ) : (
                  <>
                    <span className="font-medium text-carbon-900">One step · </span>
                    review the exceptions.
                  </>
                )}
              </motion.p>
            </AnimatePresence>
          </div>
          <StepRail step={step} progress={progress} />
          <motion.p
            style={{ opacity: hintOpacity }}
            className="pointer-events-none absolute bottom-full mb-6 flex items-center gap-2 rounded-full bg-white/85 px-3 py-1 text-[12px] text-carbon-500 shadow-[0_4px_12px_-6px_rgba(14,16,19,0.25)] backdrop-blur"
          >
            <span className="relative flex h-5 w-3.5 justify-center rounded-full border border-carbon-300">
              <span className="mt-1 h-1 w-0.5 animate-bounce rounded-full bg-carbon-400" />
            </span>
            Scroll to see the month
          </motion.p>
        </div>
      </div>
    </div>
  );
};

/* ── Reduced motion: no pinning, both states shown in order ─────────────── */

const StaticScene = () => (
  <div className="vx-shell py-20 sm:py-28">
    <div className="mx-auto max-w-[46rem] text-center">
      <Kicker className="justify-center">The work today</Kicker>
      <h2 className="mt-4 font-inter text-[clamp(1.6rem,3.2vw,2.5rem)] font-normal leading-[1.14] tracking-[-0.03em] text-carbon-900">
        Your staff shouldn&apos;t be doing this.{" "}
        <span className="text-carbon-400">Eight steps, five apps, every document.</span>
      </h2>
    </div>
    <ol className="mx-auto mt-10 max-w-[40rem] space-y-2 text-[15px] text-carbon-600">
      {STEPS.map((s, index) => (
        <li key={s.text}>
          <span className="font-medium text-carbon-900">{index + 1}.</span> {s.text}
        </li>
      ))}
    </ol>
    <p className="mx-auto mt-14 max-w-[46rem] text-center font-inter text-[clamp(1.6rem,3.2vw,2.5rem)] font-normal leading-[1.14] tracking-[-0.03em] text-carbon-900">
      Verax does the eight steps. <span className="vx-hero-gradient">You review the exceptions.</span>
    </p>
  </div>
);

const ProblemSection = () => {
  const reduced = useReducedMotion();
  return (
    <section id="problem" data-bg="light" className="relative">
      {reduced ? <StaticScene /> : <Scene />}
    </section>
  );
};

export default ProblemSection;
