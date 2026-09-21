import { useState } from "react";
import { Link } from "react-router-dom";
import PublicLayout from "../components/layout/PublicLayout";
import ClosingCTA from "../components/marketing/ClosingCTA";
import { Section, SectionHead, Eyebrow, Tick } from "../components/marketing/ledger";
import { Reveal } from "../components/public/motion";

const plans = [
  {
    name: "Starter",
    tagline: "Perfect for solo practitioners",
    price: "Free",
    priceNote: "forever",
    highlight: false,
    badge: null,
    cta: "Create free account",
    ctaTo: "/signup",
    featureLabels: [
      "50 documents / month",
      "2 team members",
      "Unlimited clients",
      "AI OCR extraction",
      "GSTIN validation",
      "Tally XML export",
      "Magic link uploads",
      "Audit log (7 days)"
    ]
  },
  {
    name: "Professional",
    tagline: "For growing CA practices",
    price: "Early access",
    priceNote: "pricing confirmed at onboarding",
    highlight: true,
    badge: "In development",
    cta: "Join early access",
    ctaHref: "#demo",
    featureLabels: [
      "500 documents / month",
      "10 team members",
      "Unlimited clients",
      "Everything in Starter",
      "Audit log (90 days)",
      "TDS rate validation",
      "Priority support"
    ]
  },
  {
    name: "Enterprise",
    tagline: "For large firms and networks",
    price: "Custom",
    priceNote: "talk to us",
    highlight: false,
    badge: null,
    cta: "Talk to us",
    ctaHref: "#demo",
    featureLabels: [
      "Unlimited documents",
      "Unlimited team members",
      "Unlimited clients",
      "Everything in Professional",
      "Audit log (unlimited)",
      "Dedicated onboarding",
      "Custom integrations"
    ]
  }
];

const comparisonRows = [
  { label: "Documents / month", values: ["50", "500", "Unlimited"] },
  { label: "Team members", values: ["2", "10", "Unlimited"] },
  { label: "Clients", values: ["Unlimited", "Unlimited", "Unlimited"] },
  { label: "AI OCR extraction", values: [true, true, true] },
  { label: "GSTIN validation", values: [true, true, true] },
  { label: "Tax math cross-check", values: [true, true, true] },
  { label: "TDS section validation", values: [false, true, true] },
  { label: "Duplicate invoice detection", values: [true, true, true] },
  { label: "Smart name mapping", values: [true, true, true] },
  { label: "Tally XML export", values: [true, true, true] },
  { label: "Register Cleaner tool", values: [true, true, true] },
  { label: "Bank Statement XML tool", values: [true, true, true] },
  { label: "Magic link client uploads", values: [true, true, true] },
  { label: "Audit log retention", values: ["7 days", "90 days", "Unlimited"] },
  { label: "Priority support", values: [false, false, true] },
  { label: "Custom integrations", values: [false, false, true] }
];

const faqs = [
  {
    q: "Is the Starter plan really free forever?",
    a: "Yes. 50 documents per month, 2 users, and full access to OCR, compliance validation, and Tally XML export — free forever. No credit card required to sign up."
  },
  {
    q: "What counts as a document?",
    a: "Each uploaded file (invoice, bank statement, or bill) counts as one document. Re-processing an existing document does not count as a new document."
  },
  {
    q: "Verax is in early access — what does that mean for Professional and Enterprise?",
    a: "Those tiers are what we're building toward, not a live checkout. Join early access and we'll onboard you directly, confirm pricing with you before anything is billed, and take your feedback into how the paid tiers actually ship."
  },
  {
    q: "Is my data safe if I stop using Verax?",
    a: "Yes. You can export all your data at any time. After a firm is closed, data is retained for a grace period before being permanently deleted, giving you time to export."
  },
  {
    q: "Do you offer discounts for NGOs or educational institutions?",
    a: "Reach out to us directly — we're happy to talk about discounted access for charitable organizations, CA institutes, and university accounting departments."
  }
];

const FaqItem = ({ q, a }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-hairline last:border-0">
      <button
        type="button"
        className="flex w-full items-center justify-between py-5 text-left"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="pr-4 text-sm font-bold text-carbon-900">{q}</span>
        <svg
          className={`h-5 w-5 flex-shrink-0 text-carbon-400 transition-transform duration-200 ${open ? "rotate-45" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>
      {open && <div className="pb-5 text-sm leading-relaxed text-carbon-500">{a}</div>}
    </div>
  );
};

const PricingPage = () => (
  <PublicLayout>
    {/* Hero */}
    <Section className="pt-20 sm:pt-28">
      <Reveal className="mx-auto max-w-[46rem] text-center">
        <Eyebrow className="justify-center">Simple, transparent pricing</Eyebrow>
        <h1 className="vx-display-xl mt-6">
          Start free.
          <br />
          Scale when you&apos;re ready.
        </h1>
        <p className="vx-body mx-auto mt-7 max-w-[34rem]">
          No per-user seat fees, no hidden charges. Starter is free today;
          Professional and Enterprise are in early access — join now and we&apos;ll
          onboard you directly.
        </p>
      </Reveal>
    </Section>

    {/* Pricing cards */}
    <Section className="pt-0">
      <div className="grid gap-6 lg:grid-cols-3">
        {plans.map((plan, i) => (
          <Reveal key={plan.name} delay={0.05 * i}>
            <div
              className={`relative flex h-full flex-col rounded-2xl border p-8 ${
                plan.highlight ? "border-carbon-900 bg-surface" : "border-hairline bg-surface"
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-carbon-900 px-4 py-1 text-xs font-bold text-white">{plan.badge}</span>
                </div>
              )}

              <h3 className="text-lg font-extrabold text-carbon-900">{plan.name}</h3>
              <p className="mt-1 text-sm text-carbon-500">{plan.tagline}</p>

              <div className="mt-6">
                <span className="text-4xl font-extrabold text-carbon-900">{plan.price}</span>
                <div className="mt-1 text-xs text-carbon-400">{plan.priceNote}</div>
              </div>

              {plan.ctaTo ? (
                <Link
                  to={plan.ctaTo}
                  className={`mt-8 block rounded-full py-3 text-center text-sm font-medium ${
                    plan.highlight ? "bg-carbon-900 text-white hover:bg-carbon-700" : "border border-hairline text-carbon-900 hover:border-hairline-strong"
                  }`}
                >
                  {plan.cta}
                </Link>
              ) : (
                <a
                  href={plan.ctaHref}
                  className={`mt-8 block rounded-full py-3 text-center text-sm font-medium ${
                    plan.highlight ? "bg-carbon-900 text-white hover:bg-carbon-700" : "border border-hairline text-carbon-900 hover:border-hairline-strong"
                  }`}
                >
                  {plan.cta}
                </a>
              )}

              <ul className="mt-8 space-y-3">
                {plan.featureLabels.map((label) => (
                  <li key={label} className="flex items-start gap-3 text-sm text-carbon-600">
                    <Tick className="mt-1 text-verify-600" />
                    {label}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        ))}
      </div>

      <p className="mt-8 text-center text-sm text-carbon-500">
        Starter is live today. Professional and Enterprise pricing is confirmed
        directly with early-access customers before anything is billed.
      </p>
    </Section>

    {/* Comparison table */}
    <Section className="border-y border-hairline bg-well">
      <SectionHead eyebrow="Compare" title="Full feature comparison" align="center" />
      <div className="mt-12 overflow-x-auto rounded-2xl border border-hairline bg-surface">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-hairline bg-well">
              <th className="w-1/2 px-6 py-4 text-left text-xs font-bold uppercase tracking-widest text-carbon-500">Feature</th>
              {plans.map((p) => (
                <th key={p.name} className="px-6 py-4 text-center text-sm font-extrabold text-carbon-900">
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comparisonRows.map((row, i) => (
              <tr key={row.label} className={`border-b border-hairline ${i % 2 === 1 ? "bg-well/50" : ""}`}>
                <td className="px-6 py-3.5 text-sm font-semibold text-carbon-700">{row.label}</td>
                {row.values.map((v, j) => (
                  <td key={j} className="px-6 py-3.5 text-center">
                    {typeof v === "boolean" ? (
                      v ? <Tick className="mx-auto text-verify-600" /> : <span className="text-carbon-200">—</span>
                    ) : (
                      <span className="text-sm font-semibold text-carbon-700">{v}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>

    {/* FAQ */}
    <Section>
      <SectionHead eyebrow="FAQ" title="Common questions" align="center" />
      <Reveal className="mx-auto mt-12 max-w-3xl rounded-2xl border border-hairline bg-surface px-6">
        {faqs.map((faq) => (
          <FaqItem key={faq.q} q={faq.q} a={faq.a} />
        ))}
      </Reveal>
    </Section>

    <ClosingCTA />
  </PublicLayout>
);

export default PricingPage;
