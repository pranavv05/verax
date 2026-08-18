import { motion, useReducedMotion } from "framer-motion";
import { EASE } from "../public/motion";

/* Orchestration clock (seconds). Kept in one place so the pipeline strip, the
   field rows and the export button stay in step with each other. */
const T = {
  card: 0.15,
  step: [0.55, 1.0, 2.5, 3.15],
  fieldsStart: 1.35,
  fieldStagger: 0.16,
  ticks: 2.6,
  exportReady: 3.25
};

const StepIcon = ({ name }) => {
  const common = {
    width: 15,
    height: 15,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round"
  };

  if (name === "upload") {
    return (
      <svg {...common}>
        <path d="M12 16V4m0 0L8 8m4-4 4 4" />
        <path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" />
      </svg>
    );
  }
  if (name === "process") {
    return (
      <svg {...common}>
        <path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6l1.4 1.4m10 10 1.4 1.4m0-12.8-1.4 1.4m-10 10-1.4 1.4" />
        <circle cx="12" cy="12" r="3.2" />
      </svg>
    );
  }
  if (name === "validate") {
    return (
      <svg {...common}>
        <path d="M12 3 4.5 6v6c0 4.2 3.1 7.6 7.5 9 4.4-1.4 7.5-4.8 7.5-9V6L12 3Z" />
        <path d="m9 12 2.2 2.2L15.2 10" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M12 4v10m0 0-3.5-3.5M12 14l3.5-3.5" />
      <path d="M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" />
    </svg>
  );
};

const steps = [
  { key: "upload", label: "Uploaded" },
  { key: "process", label: "Extracting" },
  { key: "validate", label: "Validated" },
  { key: "export", label: "Tally ready" }
];

const fields = [
  { label: "Supplier", value: "Kirloskar Pneumatic Co." },
  { label: "Invoice no.", value: "KPC/24-25/1183", mono: true },
  { label: "GSTIN", value: "27AAACK1234M1ZP", mono: true, checked: true },
  { label: "Taxable value", value: "₹ 1,24,500.00", mono: true },
  { label: "CGST 9% + SGST 9%", value: "₹ 22,410.00", mono: true, checked: true },
  { label: "Invoice total", value: "₹ 1,46,910.00", mono: true, strong: true }
];

const Tick = ({ delay, reduced }) => (
  <motion.span
    initial={reduced ? false : { scale: 0, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={{ duration: 0.34, ease: [0.34, 1.56, 0.64, 1], delay }}
    className="flex h-4 w-4 flex-none items-center justify-center rounded-full bg-verify-500 text-white"
  >
    <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
      <path d="M2.5 6.2 4.8 8.5 9.5 3.8" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </motion.span>
);

const HeroVisual = () => {
  const reduced = useReducedMotion();
  const appear = (delay, from = { opacity: 0, y: 12 }) => ({
    initial: reduced ? false : from,
    animate: { opacity: 1, y: 0, x: 0, scale: 1 },
    transition: { duration: 0.5, ease: EASE, delay: reduced ? 0 : delay }
  });

  return (
    <div className="relative">
      {/* Ambient glow behind the panel */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-x-8 -top-10 bottom-0 rounded-[3rem] bg-gradient-to-tr from-indigo-500/20 via-indigo-400/10 to-verify-400/15 blur-3xl"
      />

      {/* Documents flying in from the top-left */}
      <div aria-hidden="true" className="pointer-events-none absolute -left-3 -top-5 z-20 hidden sm:block">
        {[0, 1, 2].map((index) => (
          <motion.div
            key={index}
            initial={reduced ? false : { opacity: 0, x: -50, y: -26, rotate: -14 }}
            animate={{ opacity: 1, x: index * 15, y: index * 9, rotate: -9 + index * 4 }}
            transition={{ duration: 0.65, ease: EASE, delay: 0.1 + index * 0.11 }}
            className="absolute h-11 w-9 rounded-md border border-hairline bg-surface"
            style={{ zIndex: 3 - index }}
          >
            <span className="absolute inset-x-1.5 top-2 h-[3px] rounded-full bg-white/15" />
            <span className="absolute inset-x-1.5 top-4 h-[3px] w-4 rounded-full bg-white/15" />
            <span className="absolute inset-x-1.5 bottom-2 h-[3px] w-5 rounded-full bg-indigo-400/50" />
          </motion.div>
        ))}
      </div>

      <motion.div
        {...appear(T.card, { opacity: 0, y: 26, scale: 0.985 })}
        className="relative z-10"
      >
        <motion.div
          animate={reduced ? undefined : { y: [0, -8, 0] }}
          transition={{ duration: 7, ease: "easeInOut", repeat: Infinity, delay: 1 }}
          className="overflow-hidden rounded-2xl border border-hairline bg-surface"
        >
          {/* Window chrome */}
          <div className="flex items-center gap-2 border-b border-hairline bg-white/[0.02] px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="ml-2 truncate font-mono text-[0.68rem] text-zinc-500">
              KPC-1183.pdf
            </span>
            <span className="ml-auto hidden items-center gap-1.5 rounded-full bg-verify-500/15 px-2 py-0.5 text-[0.65rem] font-semibold text-verify-400 sm:inline-flex">
              <motion.span
                className="h-1.5 w-1.5 rounded-full bg-verify-500"
                animate={reduced ? undefined : { opacity: [1, 0.35, 1] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              />
              98% confidence
            </span>
          </div>

          {/* Pipeline strip */}
          <div className="relative border-b border-hairline px-4 py-3.5 sm:px-5">
            <div className="relative flex items-center justify-between gap-1">
              {/* Track + animated fill, sitting behind the nodes */}
              <div className="absolute left-[9%] right-[9%] top-[13px] h-[2px] rounded-full bg-white/10" />
              <motion.div
                aria-hidden="true"
                className="absolute left-[9%] top-[13px] h-[2px] origin-left rounded-full bg-gradient-to-r from-indigo-500 to-verify-500"
                style={{ right: "9%" }}
                initial={reduced ? false : { scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 2.7, ease: "easeInOut", delay: 0.6 }}
              />

              {steps.map((step, index) => (
                <div key={step.key} className="relative z-10 flex flex-1 flex-col items-center gap-1.5">
                  <motion.span
                    initial={reduced ? false : { scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.4, ease: EASE, delay: T.step[index] }}
                    className={`flex h-7 w-7 items-center justify-center rounded-full ring-4 ring-surface ${
                      index === 3
                        ? "bg-verify-500 text-white"
                        : "bg-indigo-500 text-white"
                    }`}
                  >
                    <StepIcon name={step.key} />
                  </motion.span>
                  <motion.span
                    initial={reduced ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4, delay: T.step[index] + 0.08 }}
                    className="text-center text-[0.62rem] font-semibold uppercase tracking-[0.06em] text-zinc-500 sm:text-[0.68rem]"
                  >
                    {step.label}
                  </motion.span>
                </div>
              ))}
            </div>
          </div>

          {/* Body */}
          <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-[0.82fr_1.18fr]">
            {/* Document preview with scan beam */}
            <div className="relative hidden overflow-hidden rounded-xl border border-hairline bg-white/[0.02] p-3 md:block">
              <div className="space-y-2 rounded-lg bg-white p-3 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <span className="block h-2 w-16 rounded-full bg-graphite-800/80" />
                    <span className="block h-1.5 w-11 rounded-full bg-graphite-200" />
                  </div>
                  <span className="block h-5 w-5 rounded bg-indigo-100" />
                </div>
                <div className="h-px bg-graphite-100" />
                {[14, 11, 13].map((width, index) => (
                  <div key={index} className="flex items-center justify-between gap-2">
                    <span className="block h-1.5 rounded-full bg-graphite-200" style={{ width: `${width * 4}px` }} />
                    <span className="block h-1.5 w-8 rounded-full bg-graphite-200" />
                  </div>
                ))}
                <div className="h-px bg-graphite-100" />
                <div className="flex items-center justify-between">
                  <span className="block h-1.5 w-8 rounded-full bg-graphite-300" />
                  <span className="block h-2 w-12 rounded-full bg-indigo-500/70" />
                </div>
              </div>

              {!reduced ? (
                <motion.div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-indigo-400/25 to-transparent"
                  initial={{ top: "-16%" }}
                  animate={{ top: ["-16%", "100%"] }}
                  transition={{ duration: 2.4, ease: "easeInOut", repeat: Infinity, repeatDelay: 1.1, delay: 0.9 }}
                />
              ) : null}
            </div>

            {/* Extracted fields */}
            <div>
              <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.13em] text-zinc-500">
                Extracted fields
              </p>
              <div className="space-y-1.5">
                {fields.map((field, index) => (
                  <motion.div
                    key={field.label}
                    initial={reduced ? false : { opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      duration: 0.42,
                      ease: EASE,
                      delay: T.fieldsStart + index * T.fieldStagger
                    }}
                    className={`flex items-center justify-between gap-3 rounded-lg px-2.5 py-[0.42rem] ${
                      field.strong ? "bg-indigo-500/10" : "bg-white/[0.03]"
                    }`}
                  >
                    <span className="truncate text-[0.7rem] font-medium text-zinc-500">
                      {field.label}
                    </span>
                    <span className="flex flex-none items-center gap-1.5">
                      <span
                        className={`truncate text-[0.72rem] ${field.mono ? "font-mono" : "font-medium"} ${
                          field.strong ? "font-semibold text-indigo-300" : "text-zinc-200"
                        }`}
                      >
                        {field.value}
                      </span>
                      {field.checked ? (
                        <Tick reduced={reduced} delay={T.ticks + index * 0.06} />
                      ) : null}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {/* Export footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline bg-white/[0.02] px-4 py-3 sm:px-5">
            <motion.span
              {...appear(T.ticks + 0.2)}
              className="inline-flex items-center gap-1.5 text-[0.72rem] font-medium text-zinc-500"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-verify-500" />
              GSTIN checksum and tax math verified
            </motion.span>
            <motion.span
              initial={reduced ? false : { opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.45, ease: EASE, delay: T.exportReady }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-1.5 text-[0.72rem] font-semibold text-white"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 4v10m0 0-3.5-3.5M12 14l3.5-3.5" />
                <path d="M5 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" />
              </svg>
              Export Tally XML
            </motion.span>
          </div>
        </motion.div>
      </motion.div>

      {/* Floating stat chip */}
      <motion.div
        aria-hidden="true"
        initial={reduced ? false : { opacity: 0, y: 14, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: EASE, delay: T.exportReady + 0.2 }}
        className="absolute -bottom-5 -right-2 z-20 hidden rounded-xl border border-hairline bg-surface px-3.5 py-2.5 sm:block"
      >
        <motion.div
          animate={reduced ? undefined : { y: [0, -6, 0] }}
          transition={{ duration: 5.5, ease: "easeInOut", repeat: Infinity, delay: 0.4 }}
        >
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-zinc-500">
            Time on this invoice
          </p>
          <p className="mt-0.5 text-sm font-bold text-zinc-100">
            11 seconds <span className="font-medium text-zinc-500">/ was 4 min</span>
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default HeroVisual;
