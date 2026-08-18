import { RevealGroup, RevealItem } from "../public/motion";

const ACCENTS = {
  indigo: {
    chip: "bg-indigo-500/12 text-indigo-700 ring-1 ring-inset ring-indigo-500/25",
    arrow: "text-indigo-500/60"
  },
  teal: {
    chip: "bg-verify-500/12 text-verify-700 ring-1 ring-inset ring-verify-500/25",
    arrow: "text-verify-500/60"
  },
  whatsapp: {
    chip: "bg-[#25D366]/12 text-[#1B7A3D] ring-1 ring-inset ring-[#25D366]/25",
    arrow: "text-[#25D366]/60"
  }
};

const Arrow = ({ className }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    className={className}
  >
    <path
      d="M5 12h13m0 0-5-5m5 5-5 5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * A short left-to-right sequence of labelled steps joined by arrows. Used for
 * the Tally export payoff and the WhatsApp roadmap — both are three or four
 * beats long, which is short enough to read as a sentence rather than a
 * process diagram.
 *
 * Below `md` the row rotates to a column and the arrows rotate with it.
 */
const FlowSteps = ({ steps, accent = "indigo" }) => {
  const tone = ACCENTS[accent] || ACCENTS.indigo;

  return (
    <RevealGroup
      className="mx-auto flex max-w-[64rem] flex-col items-stretch gap-3 md:flex-row md:items-stretch md:gap-2"
      stagger={0.1}
    >
      {steps.map((step, index) => (
        <RevealItem
          key={step.label}
          // flex-1 rather than a fixed width: four steps have to share the row
          // at 768px just as comfortably as three do at 1280px.
          className="flex min-w-0 flex-col items-center gap-3 md:flex-1 md:flex-row md:gap-2"
        >
          <div className="flex w-full min-w-0 flex-1 items-center gap-3.5 rounded-xl border border-hairline bg-surface px-5 py-4 md:flex-col md:items-start md:gap-3 md:px-4 md:py-5 lg:px-5">
            <span
              className={`flex h-9 w-9 flex-none items-center justify-center rounded-lg ${tone.chip}`}
            >
              {step.icon}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-[-0.01em] text-zinc-100">
                {step.label}
              </p>
              {step.sub ? (
                <p className="mt-1 text-[13px] leading-[1.55] text-zinc-500">{step.sub}</p>
              ) : null}
            </div>
          </div>

          {index < steps.length - 1 ? (
            <Arrow className={`${tone.arrow} rotate-90 md:rotate-0`} />
          ) : null}
        </RevealItem>
      ))}
    </RevealGroup>
  );
};

export default FlowSteps;
