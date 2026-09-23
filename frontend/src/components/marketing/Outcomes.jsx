import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { EASE, Reveal, RevealGroup, RevealItem } from "../public/motion";
import { Tick } from "./ledger";
import { Band, Heading } from "./v3";

/**
 * Outcomes, as Mercury's feature cards: a soft tinted panel holding one
 * tactile, animated object, with the caption set underneath rather than on
 * the card. Then the capability index — an inventory of what is built.
 *
 * No numbers are claimed: nothing in this repository measures hours saved or
 * accuracy, so every outcome is written as a direction ("less", "fewer").
 * Each capability line corresponds to a shipped route/service — see
 * FEATURE_STATUS.md.
 */

const useLive = (amount = 0.5) => {
  const ref = useRef(null);
  const inView = useInView(ref, { amount });
  return [ref, inView];
};

/* ── Tactile objects ────────────────────────────────────────────────────── */

const AutoFill = () => {
  const reduced = useReducedMotion();
  const [ref, live] = useLive();
  const text = "ACME Trading Co.";
  const [n, setN] = useState(reduced ? text.length : 0);

  useEffect(() => {
    if (!live || reduced) return undefined;
    setN(0);
    let i = 0;
    const timer = window.setInterval(() => {
      i += 1;
      setN(Math.min(i, text.length));
      if (i > text.length + 18) i = 0;
    }, 90);
    return () => window.clearInterval(timer);
  }, [live, reduced]);

  return (
    <div ref={ref} className="w-[250px] space-y-2.5">
      {[
        ["Vendor", text.slice(0, n)],
        ["GSTIN", n >= text.length ? "27AABCA1234A1ZJ" : ""],
        ["Total", n >= text.length ? "₹49,560.00" : ""]
      ].map(([label, value]) => (
        <div
          key={label}
          className="flex items-center justify-between rounded-xl border border-white bg-white/90 px-4 py-2.5 shadow-[0_10px_24px_-16px_rgba(38,30,110,0.5)]"
        >
          <span className="text-[0.6875rem] font-medium text-carbon-400">{label}</span>
          <span className="vx-mono flex h-4 items-center text-[0.75rem] text-carbon-900">
            {value}
            {label === "Vendor" && n < text.length ? (
              <span className="ml-px inline-block h-3.5 w-px animate-pulse bg-brand-500" />
            ) : null}
          </span>
        </div>
      ))}
    </div>
  );
};

const Toggles = () => {
  const reduced = useReducedMotion();
  const [ref, live] = useLive();
  const [on, setOn] = useState(reduced ? 4 : 0);

  useEffect(() => {
    if (!live || reduced) return undefined;
    setOn(0);
    const timer = window.setInterval(() => setOn((c) => (c >= 6 ? 0 : c + 1)), 650);
    return () => window.clearInterval(timer);
  }, [live, reduced]);

  return (
    <div ref={ref} className="w-[240px] space-y-3">
      {["GSTIN checksum", "Tax maths", "Duplicates", "GSTR-2B"].map((label, index) => {
        const active = on > index;
        return (
          <div key={label} className="flex items-center justify-between">
            <span className="text-[0.8125rem] font-medium text-carbon-600">{label}</span>
            <span
              className={`relative h-7 w-12 rounded-full shadow-inner transition-colors duration-500 ${
                active ? "bg-verify-500 shadow-[0_0_20px_rgba(20,184,166,0.45)]" : "bg-carbon-200"
              }`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-md transition-all duration-500 ${
                  active ? "left-6" : "left-1"
                }`}
              />
            </span>
          </div>
        );
      })}
    </div>
  );
};

const Night = () => {
  const reduced = useReducedMotion();

  return (
    <div className="relative flex w-[250px] flex-col items-center">
      <div className="relative flex h-24 w-24 items-center justify-center">
        {!reduced ? (
          <span className="vx-ring absolute inset-2 rounded-full border border-brand-500/40" aria-hidden="true" />
        ) : null}
        <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-carbon-950 shadow-[0_20px_40px_-16px_rgba(38,30,110,0.7)]">
          <span className="font-inter text-[1.125rem] font-medium tracking-[-0.02em] text-white">11:48</span>
        </span>
      </div>
      <p className="mt-2 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-carbon-400">PM · 31 March</p>
      <div className="mt-4 flex items-center gap-2 rounded-full border border-white bg-white/90 px-3.5 py-2 text-[0.75rem] font-medium text-carbon-700 shadow-sm">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-verify-500 text-white">
          <Tick size={8} />
        </span>
        Received · processing started
      </div>
    </div>
  );
};

const Ring = () => {
  const reduced = useReducedMotion();
  const r = 46;
  const c = 2 * Math.PI * r;

  return (
    <div className="flex items-center gap-6">
      <svg width="120" height="120" viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(14,16,19,0.08)" strokeWidth="10" />
        <motion.circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="url(#vx-ring-grad)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: reduced ? c * 0.28 : c }}
          whileInView={{ strokeDashoffset: c * 0.28 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 1.6, ease: EASE }}
          transform="rotate(-90 60 60)"
        />
        <defs>
          <linearGradient id="vx-ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6657D9" />
            <stop offset="100%" stopColor="#14B8A6" />
          </linearGradient>
        </defs>
        <text x="60" y="66" textAnchor="middle" className="fill-carbon-900 font-inter text-[20px] font-medium">
          72%
        </text>
      </svg>
      <div className="space-y-2 text-[0.75rem]">
        {[
          ["bg-verify-500", "Received"],
          ["bg-amber-500", "Waiting on review"],
          ["bg-carbon-300", "Outstanding"]
        ].map(([dot, label]) => (
          <p key={label} className="flex items-center gap-2 font-medium text-carbon-600">
            <span className={`h-2 w-2 rounded-full ${dot}`} />
            {label}
          </p>
        ))}
      </div>
    </div>
  );
};

const LOG = [
  ["upload", "client · 3 files"],
  ["extract", "INV-2026-0417"],
  ["edit", "invoice_date · v2"],
  ["approve", "admin · INV-2026-0431"],
  ["export", "tally.xml · 42 vouchers"],
  ["upload", "client · statement.pdf"]
];

const AuditLog = () => {
  const reduced = useReducedMotion();

  return (
    <div
      className="h-[150px] w-[260px] overflow-hidden rounded-xl bg-carbon-950 px-4 shadow-[0_20px_40px_-20px_rgba(14,16,19,0.7)]"
      style={{
        maskImage: "linear-gradient(to bottom, transparent, black 20%, black 80%, transparent)",
        WebkitMaskImage: "linear-gradient(to bottom, transparent, black 20%, black 80%, transparent)"
      }}
    >
      <div className={reduced ? "" : "vx-log-scroll"}>
        {[...LOG, ...LOG].map(([action, detail], index) => (
          <p key={index} className="vx-mono flex gap-3 py-1.5 text-[0.6875rem]" aria-hidden={index >= LOG.length}>
            <span className="w-14 flex-none text-brand-300">{action}</span>
            <span className="truncate text-carbon-300">{detail}</span>
          </p>
        ))}
      </div>
    </div>
  );
};

const Growth = () => {
  const reduced = useReducedMotion();
  const bars = [30, 42, 55, 68, 82, 96];

  return (
    <div className="relative h-[130px] w-[250px]">
      <div className="absolute inset-x-0 bottom-0 flex h-full items-end gap-3">
        {bars.map((h, index) => (
          <motion.span
            key={index}
            initial={{ height: reduced ? `${h}%` : "0%" }}
            whileInView={{ height: `${h}%` }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.8, ease: EASE, delay: reduced ? 0 : index * 0.08 }}
            className="flex-1 rounded-t-md bg-gradient-to-t from-brand-500/40 to-sky-500/70"
          />
        ))}
      </div>
      <motion.svg
        viewBox="0 0 250 130"
        className="absolute inset-0 h-full w-full overflow-visible"
        aria-hidden="true"
      >
        <motion.path
          d="M4 104 C 60 102, 120 101, 246 100"
          fill="none"
          stroke="#F59E0B"
          strokeWidth="2.5"
          strokeLinecap="round"
          initial={{ pathLength: reduced ? 1 : 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 1.2, ease: EASE, delay: reduced ? 0 : 0.5 }}
        />
      </motion.svg>
      <div className="absolute -top-2 left-0 flex gap-3 text-[0.625rem] font-semibold">
        <span className="flex items-center gap-1 text-brand-600">
          <span className="h-2 w-2 rounded-sm bg-sky-500/70" /> Clients
        </span>
        <span className="flex items-center gap-1 text-amber-600">
          <span className="h-0.5 w-3 bg-amber-500" /> Retyping
        </span>
      </div>
    </div>
  );
};

/* ── Content ────────────────────────────────────────────────────────────── */

const OUTCOMES = [
  {
    title: "Less data entry",
    body: "Vendor, GSTIN, invoice number, every line item — typed once, automatically, at upload.",
    Visual: AutoFill,
    tint: "bg-[#EEEBF8]"
  },
  {
    title: "Fewer manual checks",
    body: "Checksums, tax maths, duplicates and GSTR-2B run on every document, not the ones someone remembered.",
    Visual: Toggles,
    tint: "bg-[#E6F3F1]"
  },
  {
    title: "Faster client turnaround",
    body: "Processing starts the moment a document lands — including at 11:48 PM on the last day of the month.",
    Visual: Night,
    tint: "bg-[#ECEAE5]"
  },
  {
    title: "Visibility, per client",
    body: "What's received, outstanding, waiting on review and exported — without asking anyone.",
    Visual: Ring,
    tint: "bg-[#E8EEF8]"
  },
  {
    title: "Auditability",
    body: "Every upload, edit, approval and export in the audit log, with version history and a field-level diff.",
    Visual: AuditLog,
    tint: "bg-[#E9E7EF]"
  },
  {
    title: "Room to grow",
    body: "More clients stop meaning proportionally more retyping — the repetitive share no longer scales.",
    Visual: Growth,
    tint: "bg-[#F5EEE4]"
  }
];

const CAPABILITIES = [
  {
    group: "Collection",
    items: [
      "Secure magic-link upload",
      "Client portal logins",
      "Scheduled monthly / weekly requests",
      "Multi-file upload with progress",
      "PDF, JPG, PNG, XLSX"
    ]
  },
  {
    group: "Intelligence",
    items: [
      "Image preprocessing",
      "OCR with fallback engine",
      "LLM field extraction",
      "Confidence scoring",
      "Learned item-name mapping"
    ]
  },
  {
    group: "Compliance",
    items: [
      "GSTIN checksum + live verification",
      "CGST / SGST / IGST cross-check",
      "TDS section and rate table",
      "Duplicate invoice detection",
      "GSTR-2B reconciliation + Excel report"
    ]
  },
  {
    group: "Firm operations",
    items: [
      "Review queue and approvals",
      "Version history with diff",
      "Admin / staff roles and invites",
      "In-app and email notifications",
      "Audit log, per-firm data isolation",
      "Tally XML export, single or bulk"
    ]
  }
];

const Outcomes = () => (
  <Band id="outcomes">
    <Heading
      kicker="What changes"
      title="The month gets shorter"
      tint="at the boring end."
    />

    <RevealGroup className="mt-14 grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3" stagger={0.08}>
      {OUTCOMES.map(({ title, body, Visual, tint }) => (
        <RevealItem key={title} className="group">
          <div
            className={`relative flex h-[250px] items-center justify-center overflow-hidden rounded-2xl ${tint} transition-transform duration-500 ease-out group-hover:-translate-y-1`}
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_40%,rgba(255,255,255,0.7),transparent_70%)]"
            />
            <div className="relative">
              <Visual />
            </div>
          </div>
          <h3 className="mt-4 text-[1rem] font-medium tracking-[-0.01em] text-carbon-900">{title}</h3>
          <p className="mt-1 text-[0.9375rem] leading-[1.6] text-carbon-500">{body}</p>
        </RevealItem>
      ))}
    </RevealGroup>

    <Reveal className="mt-24 border-t border-carbon-900/10 pt-12" id="capabilities">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h3 className="font-inter text-[1.5rem] font-normal tracking-[-0.02em] text-carbon-900">
          In the product today
        </h3>
        <p className="text-[0.875rem] text-carbon-500">Every line below is shipped, not on a roadmap.</p>
      </div>

      <div className="mt-10 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {CAPABILITIES.map((column) => (
          <div key={column.group}>
            <h4 className="text-[0.8125rem] font-semibold text-carbon-900">{column.group}</h4>
            <ul className="mt-4 space-y-2.5">
              {column.items.map((item) => (
                <li key={item} className="flex gap-2 text-[0.875rem] leading-[1.5] text-carbon-500">
                  <Tick size={11} className="mt-[5px] text-verify-600" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Reveal>
  </Band>
);

export default Outcomes;
