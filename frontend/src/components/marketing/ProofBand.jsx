import { Reveal } from "../public/motion";

/**
 * What sits under the hero, after Mercury's "Loved by…" block: a centred,
 * generously set statement over one quiet row of monochrome marks drifting
 * past with faded edges — no pills, no borders, lots of air — then a slim row
 * of trust notes.
 *
 * Mercury's row is customer logos. Verax has no customers to name yet, and
 * inventing them is the one thing an accountant would catch us on, so the
 * marks are the paperwork and systems Verax actually handles, drawn as
 * neutral glyph + wordmark (never third-party logos). The trust notes are
 * all shipped: RLS per-firm isolation, the audit log, magic-link uploads.
 */

const MARKS = [
  { label: "Tax invoices", glyph: "doc" },
  { label: "Bank statements", glyph: "rows" },
  { label: "GSTR-2B", glyph: "match" },
  { label: "TallyPrime XML", glyph: "xml" },
  { label: "Purchase registers", glyph: "grid" },
  { label: "Expense bills", glyph: "receipt" },
  { label: "GSTIN", glyph: "check" },
  { label: "Excel · XLSX", glyph: "grid" },
  { label: "TDS sections", glyph: "percent" }
];

// One stroke vocabulary: 20px box, 1.5 stroke, round joins.
const GLYPHS = {
  doc: (
    <>
      <path d="M5 2.5h7l3.5 3.5v11.5H5z" />
      <path d="M12 2.5V6h3.5M7.5 10h5M7.5 13h5" />
    </>
  ),
  rows: <path d="M3 5.5h14M3 10h14M3 14.5h9" />,
  match: (
    <>
      <path d="M3 6.5h10M3 13.5h10" />
      <path d="M13 4l3 2.5L13 9M13 11l3 2.5-3 2.5" />
    </>
  ),
  xml: <path d="M7 5.5 2.5 10 7 14.5M13 5.5l4.5 4.5-4.5 4.5" />,
  grid: (
    <>
      <rect x="3" y="3.5" width="14" height="13" rx="2" />
      <path d="M3 8h14M3 12.5h14M8.5 3.5v13" />
    </>
  ),
  receipt: (
    <>
      <path d="M5 2.5h10v15l-2-1.3-1.7 1.3-1.6-1.3-1.7 1.3L6.7 16 5 17.5z" />
      <path d="M7.5 7h5M7.5 10.5h5" />
    </>
  ),
  check: (
    <>
      <path d="M10 2.5 16 5v5c0 3.8-2.7 6.3-6 7.5-3.3-1.2-6-3.7-6-7.5V5z" />
      <path d="m7.3 10 2 2 3.6-3.8" />
    </>
  ),
  percent: (
    <>
      <path d="M15.5 4.5l-11 11" />
      <circle cx="6" cy="6" r="2" />
      <circle cx="14" cy="14" r="2" />
    </>
  )
};

const Mark = ({ mark, index }) => (
  <li className="group flex flex-none items-center gap-2.5">
    <svg
      width="22"
      height="22"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-brand-500/60 transition-colors duration-300 group-hover:text-brand-500"
    >
      {GLYPHS[mark.glyph]}
    </svg>
    {/* Staggered delays turn the per-mark sheen into one wave along the row. */}
    <span
      className="vx-mark-text whitespace-nowrap font-inter text-[1.3125rem] font-bold tracking-[-0.03em]"
      style={{ animationDelay: `${index * 0.45}s` }}
    >{mark.label}</span>
  </li>
);

const NOTES = [
  {
    label: "Your firm's data, isolated",
    detail: "Row-level security on every table",
    glyph: (
      <>
        <rect x="4" y="9" width="12" height="8.5" rx="2" />
        <path d="M7 9V6.5a3 3 0 0 1 6 0V9" />
      </>
    )
  },
  {
    label: "Every action on the record",
    detail: "Uploads, edits, approvals, exports",
    glyph: <path d="M4 5h12M4 10h12M4 15h7" />
  },
  {
    label: "No client logins to manage",
    detail: "Secure magic-link uploads",
    glyph: (
      <>
        <path d="M8.5 11.5a3 3 0 0 0 4.2 0l2.6-2.6a3 3 0 0 0-4.2-4.2l-.9.9" />
        <path d="M11.5 8.5a3 3 0 0 0-4.2 0l-2.6 2.6a3 3 0 0 0 4.2 4.2l.9-.9" />
      </>
    )
  }
];

const ProofBand = () => (
  <section data-bg="light" className="relative py-24 sm:py-28 lg:py-32">
    <div className="vx-shell">
      <Reveal className="mx-auto max-w-[44rem] text-center">
        <h2 className="font-inter text-[clamp(1.875rem,4vw,3rem)] font-medium leading-[1.12] tracking-[-0.035em] text-carbon-900">
          Made for the paperwork Indian CA firms actually receive.
        </h2>
        <p className="mx-auto mt-5 max-w-[32rem] text-[1rem] leading-[1.65] text-carbon-500">
          Invoices, bank statements, registers and GST data — read, checked and ready for Tally, whatever
          shape they arrive in.
        </p>
      </Reveal>
    </div>

    {/* Full-bleed drift over a soft brand-hue glow — Mercury's logo row. */}
    <Reveal delay={0.15} className="relative mt-14">
      <div
        aria-hidden="true"
        className="vx-proof-glow pointer-events-none absolute inset-x-0 -inset-y-24 overflow-hidden"
      >
        <div className="vx-proof-glow-a" />
        <div className="vx-proof-glow-b" />
      </div>
      <div className="vx-marquee vx-marquee-mask relative overflow-hidden py-9">
        <div className="vx-marquee-track flex w-max">
          <ul className="flex gap-14 pr-14 sm:gap-20 sm:pr-20">
            {MARKS.map((mark, index) => (
              <Mark key={mark.label} mark={mark} index={index} />
            ))}
          </ul>
          <ul className="flex gap-14 pr-14 sm:gap-20 sm:pr-20" aria-hidden="true">
            {MARKS.map((mark, index) => (
              <Mark key={mark.label} mark={mark} index={index} />
            ))}
          </ul>
        </div>
      </div>
    </Reveal>

    <div className="vx-shell">
      <Reveal delay={0.25} className="mx-auto mt-16 max-w-[56rem]">
        <ul className="grid gap-8 sm:grid-cols-3 sm:gap-6">
          {NOTES.map((note) => (
            <li key={note.label} className="flex items-start justify-center gap-3 sm:justify-start">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-white text-carbon-700 shadow-[0_6px_16px_-10px_rgba(14,16,19,0.5)] ring-1 ring-carbon-900/[0.06]">
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {note.glyph}
                </svg>
              </span>
              <span>
                <span className="block text-[0.9375rem] font-medium text-carbon-900">{note.label}</span>
                <span className="mt-0.5 block text-[0.8125rem] text-carbon-500">{note.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </Reveal>
    </div>
  </section>
);

export default ProofBand;
