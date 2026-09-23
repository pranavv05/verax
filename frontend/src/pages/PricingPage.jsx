import { Fragment, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import PublicLayout from "../components/layout/PublicLayout";
import ClosingCTA from "../components/marketing/ClosingCTA";
import PageHero from "../components/marketing/PageHero";
import Cta from "../components/marketing/Cta";
import { Band, Heading } from "../components/marketing/v3";
import { Tick } from "../components/marketing/ledger";
import { EASE, Reveal } from "../components/public/motion";

/**
 * /pricing — after Mercury's joined plan panel and Linear's "Everything in X,
 * plus" inheritance (DESIGN_SYSTEM.md).
 *
 * The plan limits (documents per month, team size, audit retention, TDS on
 * Professional) are the *planned* plans. Nothing in the backend enforces them
 * yet — `firms.plan` is stored ('starter' on signup) but never checked — so the
 * page says so plainly next to the plans and above the comparison table.
 */

const PLANS = [
  {
    name: "Starter",
    tagline: "For solo practitioners and small firms.",
    price: "Free",
    note: "No card needed",
    cta: { label: "Create free account", to: "/signup", variant: "primary" },
    intro: "Includes:",
    features: [
      "50 documents / month",
      "2 team members",
      "Unlimited clients",
      "AI document reading",
      "GSTIN validation",
      "Tally XML export",
      "Upload links for clients",
      "Audit log (7 days)"
    ]
  },
  {
    name: "Professional",
    badge: "In development",
    tagline: "For growing CA practices.",
    price: "Early access",
    note: "Pricing confirmed with you at onboarding",
    cta: { label: "Join early access", href: "/#demo", variant: "quiet" },
    intro: "Everything in Starter, plus:",
    features: [
      "500 documents / month",
      "10 team members",
      "TDS rate validation",
      "Audit log (90 days)",
      "Priority support"
    ]
  },
  {
    name: "Enterprise",
    tagline: "For large firms and networks.",
    price: "Custom",
    note: "Priced for your firm",
    cta: { label: "Talk to us", href: "/#demo", variant: "quiet" },
    intro: "Everything in Professional, plus:",
    features: [
      "Unlimited documents",
      "Unlimited team members",
      "Audit log (unlimited)",
      "Dedicated onboarding",
      "Custom integrations"
    ]
  }
];

const COMPARISON = [
  {
    group: "Usage",
    rows: [
      ["Documents / month", "50", "500", "Unlimited"],
      ["Team members", "2", "10", "Unlimited"],
      ["Clients", "Unlimited", "Unlimited", "Unlimited"]
    ]
  },
  {
    group: "Reading and checks",
    rows: [
      ["AI document reading", true, true, true],
      ["GSTIN validation", true, true, true],
      ["Tax maths cross-check", true, true, true],
      ["TDS section validation", false, true, true],
      ["Duplicate invoice detection", true, true, true],
      ["Learned item-name mapping", true, true, true]
    ]
  },
  {
    group: "Export and tools",
    rows: [
      ["Tally XML export", true, true, true],
      ["Register Cleaner", true, true, true],
      ["Bank statement → Tally XML", true, true, true],
      ["Upload links for clients", true, true, true]
    ]
  },
  {
    group: "Records and support",
    rows: [
      ["Audit log retention", "7 days", "90 days", "Unlimited"],
      ["Priority support", false, true, true],
      ["Dedicated onboarding", false, false, true],
      ["Custom integrations", false, false, true]
    ]
  }
];

const FAQS = [
  {
    q: "Is the Starter plan really free forever?",
    a: "Yes. Starter is free forever, with no credit card needed to sign up, and it includes document reading, compliance checks and Tally XML export."
  },
  {
    q: "Are the plan limits enforced today?",
    a: "Not yet. The limits shown are the plans we are building toward. During early access every account can use the full product while we confirm the paid tiers with our first firms."
  },
  {
    q: "What counts as a document?",
    a: "Each uploaded file — an invoice, bill or bank statement — counts as one document. Reprocessing a document you already uploaded does not count again."
  },
  {
    q: "What does early access mean for Professional and Enterprise?",
    a: "Those tiers are what we're building toward, not a live checkout. Join early access and we'll onboard you directly, confirm pricing with you before anything is billed, and shape the paid tiers with your feedback."
  },
  {
    q: "What happens to my data if I stop using Verax?",
    a: (
      <>
        Your data is yours. When your account closes you can ask us for an export within 30 days; after that it is
        deleted. The details are in our{" "}
        <Link
          to="/terms"
          className="text-brand-600 underline decoration-brand-600/30 underline-offset-2 hover:decoration-brand-600"
        >
          Terms
        </Link>{" "}
        and{" "}
        <Link
          to="/privacy"
          className="text-brand-600 underline decoration-brand-600/30 underline-offset-2 hover:decoration-brand-600"
        >
          Privacy Policy
        </Link>
        .
      </>
    )
  },
  {
    q: "Do you offer discounts for NGOs or educational institutions?",
    a: "Write to us — we're happy to talk about discounted access for charitable organisations, CA institutes and university accounting departments."
  }
];

/* ── Pieces ─────────────────────────────────────────────────────────────── */

const Planned = () => (
  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/[0.07] px-2.5 py-0.5 text-[12px] font-medium text-amber-700">
    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber-500" />
    Planned limits — not enforced during early access
  </span>
);

const Cell = ({ value }) =>
  typeof value === "boolean" ? (
    value ? (
      <Tick className="mx-auto text-verify-600" size={13} />
    ) : (
      <span className="text-carbon-300" aria-label="Not included">
        —
      </span>
    )
  ) : (
    <span className="text-[0.875rem] font-medium tabular-nums text-carbon-700">{value}</span>
  );

const FaqItem = ({ item, open, onToggle, id }) => {
  const reduced = useReducedMotion();
  return (
    <div className="border-b border-carbon-900/[0.08]">
      <h3>
        <button
          type="button"
          id={`${id}-q`}
          aria-expanded={open}
          aria-controls={`${id}-a`}
          onClick={onToggle}
          className="group flex w-full items-center justify-between gap-6 py-5 text-left focus-visible:outline-none"
        >
          <span className="text-[1rem] font-medium text-carbon-900 group-focus-visible:underline">{item.q}</span>
          <span
            aria-hidden="true"
            className={`flex h-7 w-7 flex-none items-center justify-center rounded-full border border-carbon-900/10 bg-white text-carbon-500 transition-transform duration-300 ${
              open ? "rotate-45" : ""
            }`}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path d="M6 1.5v9M1.5 6h9" />
            </svg>
          </span>
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={`${id}-a`}
            role="region"
            aria-labelledby={`${id}-q`}
            initial={reduced ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="overflow-hidden"
          >
            <p className="max-w-[40rem] pb-6 text-[0.9375rem] leading-[1.7] text-carbon-500">{item.a}</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

/* ── Page ───────────────────────────────────────────────────────────────── */

const PricingPage = () => {
  const [openFaq, setOpenFaq] = useState(0);

  return (
    <PublicLayout>
      <PageHero
        kicker="Pricing"
        title="Start free."
        accent="Grow when you're ready."
        lead="No per-user seat fees and no hidden charges. Starter is free today; Professional and Enterprise are in early access — join now and we'll onboard you directly."
      >
        {/* Mercury's joined plan panel */}
        <div className="mx-auto max-w-[68rem] overflow-hidden rounded-[22px] border border-carbon-900/[0.07] bg-white shadow-[0_1px_2px_rgba(14,16,19,0.04),0_40px_90px_-60px_rgba(38,30,110,0.45)]">
          <div className="grid divide-y divide-carbon-900/[0.07] lg:grid-cols-3 lg:divide-x lg:divide-y-0">
            {PLANS.map((plan) => (
              <div key={plan.name} className="relative flex flex-col p-7 sm:p-8">
                {plan.badge ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-brand-500 via-sky-500 to-verify-500"
                  />
                ) : null}
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-inter text-[1.25rem] font-medium tracking-[-0.02em] text-carbon-900">
                    {plan.name}
                  </h2>
                  {plan.badge ? (
                    <span className="rounded-full bg-brand-500/10 px-2.5 py-0.5 text-[12px] font-medium text-brand-700">
                      {plan.badge}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1.5 text-[0.9375rem] text-carbon-500">{plan.tagline}</p>

                <p className="mt-7 font-inter text-[2.25rem] font-semibold leading-none tracking-[-0.035em] text-carbon-900">
                  {plan.price}
                </p>
                <p className="mt-2 text-[0.8125rem] text-carbon-400">{plan.note}</p>

                <Cta to={plan.cta.to} href={plan.cta.href} variant={plan.cta.variant} className="mt-7 w-full">
                  {plan.cta.label}
                </Cta>

                <p className="mt-8 text-[0.875rem] font-medium text-carbon-900">{plan.intro}</p>
                <ul className="mt-4 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-[0.9375rem] text-carbon-600">
                      <Tick className="mt-[6px] text-verify-600" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2 border-t border-carbon-900/[0.06] bg-[#FAFAFB] px-7 py-4 text-[0.8125rem] text-carbon-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <Planned />
            <span>
              Starter is live today. Paid-tier pricing is confirmed with early-access firms before anything is billed.
            </span>
          </div>
        </div>
      </PageHero>

      {/* Comparison */}
      <Band>
        <Heading kicker="Compare" title="Every plan, side by side." tint="Planned limits included." align="center" />

        <Reveal className="mt-10 flex justify-center">
          <Planned />
        </Reveal>

        <Reveal className="mt-8 overflow-x-auto rounded-[22px] border border-carbon-900/[0.07] bg-white shadow-[0_1px_2px_rgba(14,16,19,0.04)]">
          <table className="w-full min-w-[640px] border-collapse">
            <caption className="sr-only">Feature comparison between Starter, Professional and Enterprise</caption>
            <thead>
              <tr className="border-b border-carbon-900/[0.07]">
                <th scope="col" className="w-[40%] px-6 py-5 text-left text-[0.8125rem] font-medium text-carbon-400">
                  Feature
                </th>
                {PLANS.map((plan) => (
                  <th key={plan.name} scope="col" className="px-6 py-5 text-center">
                    <span className="block text-[1rem] font-medium text-carbon-900">{plan.name}</span>
                    <span className="mt-0.5 block text-[0.8125rem] font-normal text-carbon-400">{plan.price}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((section) => (
                <Fragment key={section.group}>
                  <tr className="bg-[#FAFAFB]">
                    <th
                      colSpan={4}
                      scope="colgroup"
                      className="px-6 pb-2.5 pt-5 text-left text-[0.8125rem] font-semibold text-carbon-900"
                    >
                      {section.group}
                    </th>
                  </tr>
                  {section.rows.map(([label, ...values]) => (
                    <tr
                      key={label}
                      className="border-t border-carbon-900/[0.05] transition-colors hover:bg-brand-500/[0.025]"
                    >
                      <th scope="row" className="px-6 py-3.5 text-left text-[0.9375rem] font-normal text-carbon-600">
                        {label}
                      </th>
                      {values.map((value, index) => (
                        <td key={index} className="px-6 py-3.5 text-center">
                          <Cell value={value} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </Reveal>
      </Band>

      {/* FAQ: Linear's two-column layout */}
      <Band className="!pt-0">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-20">
          <Heading
            kicker="FAQ"
            title="Questions,"
            tint="answered plainly."
            className="lg:sticky lg:top-28 lg:self-start"
          >
            <p className="mt-6 text-[0.9375rem] leading-[1.7] text-carbon-500">
              Something else?{" "}
              <a
                href="mailto:verax.hello@gmail.com"
                className="text-brand-600 underline decoration-brand-600/30 underline-offset-2 hover:decoration-brand-600"
              >
                verax.hello@gmail.com
              </a>
            </p>
          </Heading>
          <Reveal className="border-t border-carbon-900/[0.08]">
            {FAQS.map((item, index) => (
              <FaqItem
                key={item.q}
                id={`faq-${index}`}
                item={item}
                open={openFaq === index}
                onToggle={() => setOpenFaq(openFaq === index ? null : index)}
              />
            ))}
          </Reveal>
        </div>
      </Band>

      <ClosingCTA />
    </PublicLayout>
  );
};

export default PricingPage;
