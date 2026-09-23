import { useLayoutEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring
} from "framer-motion";
import { EASE } from "../public/motion";
import { VeraxMark } from "../brand/VeraxLogo";
import { Band, Heading, Kicker } from "./v3";

/**
 * The engine, shown the way the hero shows the product: one believable
 * screen. A light Verax window in the hero's glass bezel, sitting on the dark
 * band (white product on dark, as Stripe and Mercury do), follows a single
 * invoice through the pipeline:
 *
 *   left   the invoice in a document viewer, reacting to each stage — a scan
 *          and word boxes while it's read, highlighted fields when extracted,
 *          check pins when validated, a GSTR-2B tag, a voucher mark on export
 *   right  a Stripe-style activity timeline; events arrive one by one with
 *          timestamps and actors, and the status badge advances with them
 *
 * Driven by scroll, not a timer: the section pins, and the reader's scroll
 * plays the journey forward (and rewinds it) event by event.
 *
 * Every event maps to shipped behaviour (presigned upload → BullMQ
 * `document-processing` → OCR → LLM extraction with a confidence score →
 * compliance.service.js → GSTR-2B reconciliation → admin approval → Tally
 * XML). GSTR-2B reconciliation runs for a period, so it lands the next
 * morning rather than seconds after upload. Drawn on a fixed canvas scaled to
 * the space left in the pinned viewport, so it holds on phones.
 */

const W = 1040;
const H = 560;
// Events play across [0, PLAY_END] of the pinned scroll; the rest is a hold.
const PLAY_END = 0.86;


// stage · title · actor · time · detail · tone
const EVENTS = [
  { stage: 0, title: "Uploaded via secure link", actor: "Mehta Packaging · client", time: "11:48:02 PM", detail: "acme-inv-0417.pdf · 1 page · 412 KB", tone: "neutral", icon: "upload" },
  { stage: 0, title: "Queued for processing", actor: "Verax", time: "11:48:02 PM", detail: "document-processing", tone: "neutral", icon: "queue" },
  { stage: 1, title: "Text read", actor: "Verax · OCR", time: "11:48:05 PM", detail: "142 words across 6 regions", tone: "brand", icon: "read" },
  { stage: 1, title: "Fields extracted", actor: "Verax", time: "11:48:09 PM", detail: "12 fields · confidence 0.87", tone: "brand", icon: "fields" },
  { stage: 2, title: "GSTIN verified", actor: "Verax", time: "11:48:09 PM", detail: "27AABCA1234A1ZJ · checksum valid", tone: "good", icon: "check" },
  { stage: 2, title: "Tax maths checked", actor: "Verax", time: "11:48:09 PM", detail: "42,000.00 + 7,560.00 = 49,560.00", tone: "good", icon: "check" },
  { stage: 3, title: "Matched in GSTR-2B", actor: "Verax · March run", time: "9:14 AM", detail: "supplier filed ₹49,560.00 — no difference", tone: "good", icon: "match" },
  { stage: 4, title: "Approved", actor: "Admin", time: "9:31 AM", detail: "1 stock item mapped · logged to audit trail", tone: "good", icon: "approve" },
  { stage: 5, title: "Exported to Tally", actor: "Verax", time: "9:32 AM", detail: "tally-export-mar-2026.xml · balanced", tone: "good", icon: "export" }
];

const STATUS_BY_STAGE = [
  { label: "Uploaded", className: "bg-carbon-900/[0.06] text-carbon-600", dot: "bg-carbon-400" },
  { label: "Processing", className: "bg-brand-500/10 text-brand-700", dot: "bg-brand-500" },
  { label: "Extracted", className: "bg-verify-500/10 text-verify-700", dot: "bg-verify-500" },
  { label: "Extracted", className: "bg-verify-500/10 text-verify-700", dot: "bg-verify-500" },
  { label: "Approved", className: "bg-verify-500/12 text-verify-700", dot: "bg-verify-500" },
  { label: "Exported", className: "bg-carbon-900 text-white", dot: "bg-verify-400" }
];

/* ── Icons ──────────────────────────────────────────────────────────────── */

const I = ({ d, size = 13, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    {d}
  </svg>
);

const ICON = {
  upload: <path d="M8 11V3M4.8 6.2 8 3l3.2 3.2M3 13h10" />,
  queue: <path d="M3 4.5h10M3 8h10M3 11.5h6" />,
  read: (
    <>
      <path d="M2 4V2.5h1.5M12.5 2.5H14V4M14 12v1.5h-1.5M3.5 13.5H2V12" />
      <path d="M5 6h6M5 8.5h6M5 11h3.5" />
    </>
  ),
  fields: (
    <>
      <rect x="2.5" y="3" width="11" height="3.5" rx="1" />
      <rect x="2.5" y="9.5" width="11" height="3.5" rx="1" />
    </>
  ),
  check: <path d="m3.5 8.3 2.8 2.8 6.2-6.4" />,
  match: <path d="M2.5 5h8M2.5 11h8M10.5 3l2.5 2-2.5 2M10.5 9l2.5 2-2.5 2" />,
  approve: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <path d="m5.6 8.1 1.7 1.7 3.2-3.4" />
    </>
  ),
  export: <path d="M5.5 4.5 2 8l3.5 3.5M10.5 4.5 14 8l-3.5 3.5" />,
  chevron: <path d="m6.5 4.5 3.5 3.5-3.5 3.5" />,
  file: (
    <>
      <path d="M4 1.8h5.5L12.5 5v9.2H4z" />
      <path d="M9.5 1.8V5h3" />
    </>
  )
};

const TONE = {
  neutral: "bg-[#F1F0F4] text-carbon-500",
  brand: "bg-brand-500/10 text-brand-600",
  good: "bg-verify-500/12 text-verify-700"
};

/* ── Scroll mapping + fit ───────────────────────────────────────────────── */

const countAt = (p) =>
  Math.min(EVENTS.length, Math.max(1, 1 + Math.floor((p / PLAY_END) * EVENTS.length)));

const useFit = () => {
  const ref = useRef(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      // Allowed to grow past 1: the window should fill the pinned viewport.
      setScale(Math.max(0.25, Math.min(1.3, width / W, height > 0 ? height / H : 1)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, scale];
};

/* ── Document viewer ────────────────────────────────────────────────────── */

const Pin = ({ className, delay = 0 }) => (
  <motion.span
    initial={{ opacity: 0, scale: 0.4 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.6 }}
    transition={{ duration: 0.35, ease: EASE, delay }}
    className={`absolute z-20 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-verify-500 text-white shadow-[0_4px_10px_-2px_rgba(20,184,166,0.6)] ${className}`}
  >
    <I d={ICON.check} size={11} />
  </motion.span>
);

const Box = ({ className, delay = 0 }) => (
  <motion.span
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.3, delay }}
    className={`absolute z-10 rounded-[3px] ${className}`}
  />
);

const Viewer = ({ stage, reduced }) => (
  <div className="flex h-full flex-col bg-[#F3F3F6]">
    <div className="flex h-10 items-center justify-between border-b border-[#ECEBEF] bg-white/70 px-4 text-[12px] text-carbon-500">
      <span className="flex items-center gap-1.5">
        <I d={ICON.file} size={13} className="text-carbon-400" />
        <span className="font-medium text-carbon-700">acme-inv-0417.pdf</span>
        <span className="text-carbon-400">· page 1 of 1</span>
      </span>
      <span className="tabular-nums">100%</span>
    </div>

    <div className="relative flex flex-1 items-start justify-center overflow-hidden pt-6">
      <div
        className="relative h-[430px] w-[340px] bg-white px-7 py-7 text-[#1d1f24] shadow-[0_1px_2px_rgba(14,16,19,0.08),0_16px_40px_-16px_rgba(14,16,19,0.3)]"
        style={{ fontFamily: "Arial, 'Helvetica Neue', Helvetica, sans-serif" }}
      >
        {/* Stage 1: the read — a scan band sweeps, word boxes land */}
        <AnimatePresence>
          {stage === 1 ? (
            <>
              {!reduced ? (
                <motion.span
                  key="scan"
                  aria-hidden="true"
                  className="absolute inset-x-0 z-10 h-16"
                  style={{ background: "linear-gradient(to bottom, rgba(102,87,217,0), rgba(102,87,217,0.16) 70%, rgba(102,87,217,0))" }}
                  initial={{ top: "-10%", opacity: 0 }}
                  animate={{ top: "100%", opacity: [0, 1, 1, 0] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.6, ease: "linear", repeat: Infinity }}
                />
              ) : null}
              <Box key="w1" className="left-[24px] top-[24px] h-[18px] w-[136px] border border-brand-500/70 bg-brand-500/10" delay={0.1} />
              <Box key="w2" className="left-[24px] top-[62px] h-[14px] w-[150px] border border-brand-500/70 bg-brand-500/10" delay={0.25} />
              <Box key="w3" className="right-[24px] top-[42px] h-[14px] w-[100px] border border-brand-500/70 bg-brand-500/10" delay={0.4} />
              <Box key="w4" className="right-[24px] bottom-[84px] h-[18px] w-[150px] border border-brand-500/70 bg-brand-500/10" delay={0.55} />
            </>
          ) : null}
        </AnimatePresence>

        {/* Stage 2: validated fields get pins */}
        <AnimatePresence>
          {stage >= 2 ? (
            <>
              <Pin key="p1" className="left-[176px] top-[60px]" />
              <Pin key="p2" className="right-[8px] bottom-[83px]" delay={0.15} />
            </>
          ) : null}
        </AnimatePresence>

        {/* Stage 3: GSTR-2B tag */}
        <AnimatePresence>
          {stage >= 3 ? (
            <motion.span
              key="gstr"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="absolute -right-[64px] top-[128px] z-20 flex items-center gap-1.5 rounded-full border border-verify-500/25 bg-white px-2.5 py-1 text-[11px] font-medium text-verify-700 shadow-[0_8px_20px_-8px_rgba(14,16,19,0.35)]"
              style={{ fontFamily: "Inter, sans-serif" }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-verify-500" />
              In GSTR-2B · matched
            </motion.span>
          ) : null}
        </AnimatePresence>

        {/* Stage 5: voucher mark */}
        <AnimatePresence>
          {stage >= 5 ? (
            <motion.span
              key="voucher"
              initial={{ opacity: 0, scale: 1.4, rotate: -14 }}
              animate={{ opacity: 1, scale: 1, rotate: -9 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 18 }}
              className="absolute bottom-[30px] left-[24px] z-20 rounded-[4px] border-2 border-verify-600/70 px-2 py-1 text-center text-[9px] font-bold leading-tight tracking-[0.1em] text-verify-700/80"
            >
              VOUCHER CREATED
              <br />
              <span className="text-[8px] font-medium tracking-normal">Tally · 9:32 AM</span>
            </motion.span>
          ) : null}
        </AnimatePresence>

        <div className="flex items-start justify-between">
          <div>
            <p className="text-[15px] font-bold">ACME Trading Co.</p>
            <p className="mt-1 text-[8px] leading-[1.5] text-[#6b6f78]">Plot 14, MIDC Bhosari, Pune 411026</p>
            <p className="mt-1.5 text-[9px]">
              GSTIN <b>27AABCA1234A1ZJ</b>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-bold tracking-[0.12em] text-[#1d4ed8]">TAX INVOICE</p>
            <p className="mt-1.5 text-[9px]">
              No. <b>INV-2026-0417</b>
            </p>
            <p className="mt-0.5 text-[9px]">
              Date <b>17-03-2026</b>
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-[2px] bg-[#f4f5f7] p-2 text-[8px] leading-[1.5]">
          <p className="font-bold text-[#6b6f78]">BILL TO</p>
          <p className="font-bold">Mehta Packaging Pvt. Ltd.</p>
          <p className="text-[#6b6f78]">Andheri East, Mumbai 400069</p>
        </div>

        <table className="mt-4 w-full text-[8.5px]">
          <thead>
            <tr className="bg-[#1d4ed8] text-left text-white">
              <th className="px-1.5 py-1 font-bold">Description</th>
              <th className="px-1.5 py-1 text-right font-bold">Qty</th>
              <th className="px-1.5 py-1 text-right font-bold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Industrial Packaging Rolls", "80", "20,000.00"],
              ["Corrugated Cartons — Size B", "150", "15,000.00"],
              ["BOPP Adhesive Tape", "14", "7,000.00"]
            ].map((row) => (
              <tr key={row[0]} className="border-b border-[#e6e7ea]">
                <td className="px-1.5 py-1.5">{row[0]}</td>
                <td className="px-1.5 py-1.5 text-right">{row[1]}</td>
                <td className="px-1.5 py-1.5 text-right">{row[2]}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="ml-auto mt-4 w-[58%] space-y-1 text-[9px]">
          {[
            ["Taxable value", "42,000.00"],
            ["CGST 9%", "3,780.00"],
            ["SGST 9%", "3,780.00"]
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between">
              <span className="text-[#6b6f78]">{label}</span>
              <span>{value}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-[#1d1f24] pt-1 text-[11px] font-bold">
            <span>Total</span>
            <span>₹ 49,560.00</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

/* ── Activity timeline ──────────────────────────────────────────────────── */

const Timeline = ({ count }) => {
  // Newest first, like Stripe's event log — the latest event always enters
  // at the top, and older ones slide down (and out of view) beneath it.
  const shown = EVENTS.slice(0, count).reverse();
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 items-center justify-between border-b border-[#ECEBEF] px-5">
        <span className="text-[12.5px] font-semibold text-carbon-900">Activity</span>
        <span className="text-[11.5px] tabular-nums text-carbon-400">{count} events</span>
      </div>
      <div className="relative flex-1 overflow-hidden px-5 pt-4">
        <ol className="relative">
          <AnimatePresence initial={false}>
            {shown.map((event, index) => {
              const latest = index === 0;
              const last = index === shown.length - 1;
              return (
                <motion.li
                  key={event.title}
                  layout
                  initial={{ opacity: 0, y: -8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.45, ease: EASE }}
                  className="relative flex gap-3 overflow-hidden pb-3.5"
                >
                  {!last ? <span aria-hidden="true" className="absolute left-[11px] top-7 h-full w-px bg-[#ECEBEF]" /> : null}
                  <span
                    className={`relative flex h-[23px] w-[23px] flex-none items-center justify-center rounded-full ${TONE[event.tone]} ${
                      latest ? "ring-4 ring-brand-500/10" : ""
                    }`}
                  >
                    <I d={ICON[event.icon]} size={12} />
                  </span>
                  <span className="min-w-0 flex-1 pt-0.5">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-[12.5px] font-medium text-carbon-900">{event.title}</span>
                      <span className="flex-none text-[11px] tabular-nums text-carbon-400">{event.time}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[11.5px] text-carbon-500">{event.detail}</span>
                    <span className="mt-0.5 block text-[10.5px] text-carbon-400">{event.actor}</span>
                  </span>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ol>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent"
        />
      </div>
    </div>
  );
};

/* ── The window ─────────────────────────────────────────────────────────── */

const EngineWindow = ({ count, stage, reduced }) => {
  const status = STATUS_BY_STAGE[stage];
  return (
    <div className="h-full rounded-[20px] border border-white/15 bg-white/[0.07] p-2 shadow-[0_60px_120px_-40px_rgba(102,87,217,0.55)] backdrop-blur-xl">
      <div className="flex h-full flex-col overflow-hidden rounded-[14px] bg-white">
        {/* App header */}
        <div className="flex h-14 flex-none items-center gap-4 border-b border-[#ECEBEF] px-5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-carbon-950">
            <VeraxMark size={14} tone="light" />
          </span>
          <span className="flex items-center gap-1 text-[12px] text-carbon-400">
            Mehta Packaging <I d={ICON.chevron} size={11} /> Documents <I d={ICON.chevron} size={11} />
            <span className="font-medium text-carbon-900">acme-inv-0417.pdf</span>
          </span>
          {/* A plain element: scroll can change the stage faster than any
              enter/exit animation, and a stranded badge is worse than none. */}
          <span
            className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-colors duration-300 ${status.className}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </span>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[1.25fr_1fr]">
          <div className="min-h-0 border-r border-[#ECEBEF]">
            <Viewer stage={stage} reduced={reduced} />
          </div>
          <div className="min-h-0">
            <Timeline count={count} />
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Section ────────────────────────────────────────────────────────────── */

const Scene = () => {
  const containerRef = useRef(null);
  const [stageRef, scale] = useFit();
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start start", "end end"] });
  const progress = useSpring(scrollYProgress, { stiffness: 150, damping: 32, mass: 0.35 });

  const [count, setCount] = useState(1);
  useMotionValueEvent(progress, "change", (p) => {
    const next = countAt(p);
    setCount((c) => (c === next ? c : next));
  });
  const stage = EVENTS[count - 1].stage;

  return (
    <div ref={containerRef} className="relative h-[300vh]">
      <div className="sticky top-16 flex h-[calc(100svh-4rem)] flex-col px-4 pb-5 pt-6 sm:px-8 lg:pt-8">
        <div className="mx-auto w-full max-w-[46rem] text-center">
          <Kicker dark className="justify-center">The Verax engine</Kicker>
          <h2 className="mt-4 font-inter text-[clamp(1.6rem,3vw,2.375rem)] font-normal leading-[1.14] tracking-[-0.03em] text-white">
            One invoice, start to finish.{" "}
            <span className="text-carbon-400">Five of the six stages run without anyone watching.</span>
          </h2>
        </div>

        <div ref={stageRef} className="relative mx-auto mt-5 flex min-h-0 w-full max-w-[1320px] flex-1 items-center justify-center">
          <div style={{ width: W * scale, height: H * scale }} className="relative">
            <div className="absolute left-0 top-0 origin-top-left" style={{ width: W, height: H, transform: `scale(${scale})` }}>
              <EngineWindow count={count} stage={stage} reduced={false} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/** Reduced motion: no pinning — the finished journey, still. */
const StaticScene = () => (
  <Band id="how-it-works" dark aurora>
    <Heading
      dark
      align="center"
      kicker="The Verax engine"
      title="One invoice, start to finish."
      tint="Five of the six stages run without anyone watching."
    />
    <div className="mx-auto mt-12 max-w-[1040px]">
      <div className="relative w-full" style={{ aspectRatio: `${W} / ${H}` }}>
        <div className="absolute inset-0">
          <EngineWindow count={EVENTS.length} stage={5} reduced />
        </div>
      </div>
    </div>
  </Band>
);

const VeraxEngine = () => {
  const reduced = useReducedMotion();
  if (reduced) return <StaticScene />;

  return (
    <section id="how-it-works" data-bg="dark" className="relative scroll-mt-16 text-carbon-200">
      {/* Same near-black, aurora and dot grid as the other dark bands */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, rgba(8,9,11,0) 0px, #08090B 200px, #08090B calc(100% - 200px), rgba(8,9,11,0) 100%)"
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: [
            "radial-gradient(40% 30% at 15% 20%, rgba(102,87,217,0.3), transparent 70%)",
            "radial-gradient(35% 30% at 85% 30%, rgba(77,141,255,0.22), transparent 70%)",
            "radial-gradient(40% 30% at 55% 80%, rgba(20,184,166,0.15), transparent 70%)"
          ].join(",")
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          maskImage: "radial-gradient(70% 45% at 50% 50%, black, transparent 80%)",
          WebkitMaskImage: "radial-gradient(70% 45% at 50% 50%, black, transparent 80%)"
        }}
      />
      <div className="relative">
        <Scene />
      </div>
    </section>
  );
};

export default VeraxEngine;
