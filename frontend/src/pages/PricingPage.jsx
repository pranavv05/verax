import { useState } from "react";
import { Link } from "react-router-dom";
import PublicLayout from "../components/layout/PublicLayout";

const Check = ({ color = "text-mint-500" }) => (
  <svg className={`mt-0.5 h-5 w-5 flex-shrink-0 ${color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const X = () => (
  <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-ink-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const plans = [
  {
    name: "Starter",
    tagline: "Perfect for solo practitioners",
    monthly: 0,
    annual: 0,
    highlight: false,
    badge: null,
    cta: "Start for free",
    ctaTo: "/signup",
    features: [
      "50 documents / month",
      "2 team members",
      "Unlimited clients",
      "AI OCR extraction",
      "GSTIN validation",
      "Tally XML export",
      "Magic link uploads",
      "Audit log (7 days)",
      null,
      null,
    ],
    featureLabels: [
      "50 documents / month",
      "2 team members",
      "Unlimited clients",
      "AI OCR extraction",
      "GSTIN validation",
      "Tally XML export",
      "Magic link uploads",
      "Audit log (7 days)",
      "TDS rate validation",
      "Priority support",
    ],
  },
  {
    name: "Professional",
    tagline: "For growing CA practices",
    monthly: 2499,
    annual: 1999,
    highlight: true,
    badge: "Most popular",
    cta: "Start 14-day trial",
    ctaTo: "/signup",
    features: [
      "500 documents / month",
      "10 team members",
      "Unlimited clients",
      "AI OCR extraction",
      "GSTIN validation",
      "Tally XML export",
      "Magic link uploads",
      "Audit log (90 days)",
      "TDS rate validation",
      null,
    ],
    featureLabels: [
      "500 documents / month",
      "10 team members",
      "Unlimited clients",
      "AI OCR extraction",
      "GSTIN validation",
      "Tally XML export",
      "Magic link uploads",
      "Audit log (90 days)",
      "TDS rate validation",
      "Priority support",
    ],
  },
  {
    name: "Enterprise",
    tagline: "For large firms and networks",
    monthly: null,
    annual: null,
    highlight: false,
    badge: null,
    cta: "Contact us",
    ctaTo: "/about",
    features: [
      "Unlimited documents",
      "Unlimited team members",
      "Unlimited clients",
      "AI OCR extraction",
      "GSTIN validation",
      "Tally XML export",
      "Magic link uploads",
      "Audit log (unlimited)",
      "TDS rate validation",
      "Priority support",
    ],
    featureLabels: [
      "Unlimited documents",
      "Unlimited team members",
      "Unlimited clients",
      "AI OCR extraction",
      "GSTIN validation",
      "Tally XML export",
      "Magic link uploads",
      "Audit log (unlimited)",
      "TDS rate validation",
      "Dedicated account manager",
    ],
  },
];

const faqs = [
  {
    q: "Is the Starter plan really free forever?",
    a: "Yes. 50 documents per month, 2 users, and full access to OCR, compliance validation, and Tally XML export — free forever. No credit card required to sign up.",
  },
  {
    q: "What counts as a document?",
    a: "Each uploaded file (invoice, bank statement, or bill) counts as one document. Re-processing an existing document does not count as a new document.",
  },
  {
    q: "Can I switch plans any time?",
    a: "Yes. Upgrades take effect immediately. Downgrades take effect at the end of the current billing cycle. All your data is preserved on plan changes.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept UPI, credit/debit cards (Visa, Mastercard, Rupay), and net banking via Razorpay. Enterprise plans support invoice-based billing.",
  },
  {
    q: "Is my data safe if I cancel?",
    a: "Yes. You can export all your data at any time. After cancellation, your data is retained for 30 days before being permanently deleted, giving you time to export.",
  },
  {
    q: "Do you offer discounts for NGOs or educational institutions?",
    a: "Yes — reach out to us directly. We offer discounted plans for charitable organizations, CA institutes, and university accounting departments.",
  },
];

const FaqItem = ({ q, a }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[#e7dcc8] last:border-0">
      <button
        className="flex w-full items-center justify-between py-5 text-left"
        onClick={() => setOpen(!open)}
      >
        <span className="text-sm font-bold text-ink-900 pr-4">{q}</span>
        <svg
          className={`h-5 w-5 flex-shrink-0 text-ink-500 transition-transform duration-200 ${open ? "rotate-45" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>
      {open && (
        <div className="pb-5 text-sm leading-relaxed text-ink-600">{a}</div>
      )}
    </div>
  );
};

const PricingPage = () => {
  const [annual, setAnnual] = useState(false);

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="hero-gradient absolute inset-0" />
        <div className="orb orb-1 absolute" style={{ top: "5%", left: "5%" }} />
        <div className="orb orb-2 absolute" style={{ top: "10%", right: "5%" }} />

        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-16 sm:px-6 sm:pt-20 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="animate-fade-in-up inline-flex items-center gap-2 rounded-full border border-ember-500/30 bg-ember-500/10 px-4 py-1.5 text-xs font-bold tracking-wide text-ember-600">
              Simple, transparent pricing
            </div>
            <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight text-ink-900 opacity-0 animate-fade-in-up-delay-1 sm:text-5xl">
              Pay for what you use.{" "}
              <span className="gradient-text-accent">Start free.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg text-ink-600 opacity-0 animate-fade-in-up-delay-2">
              No per-user seat fees. No hidden charges. Just a straightforward document limit based on your firm's scale.
            </p>

            {/* Monthly / Annual toggle */}
            <div className="mt-8 flex items-center justify-center gap-3 opacity-0 animate-fade-in-up-delay-3">
              <span className={`text-sm font-semibold ${!annual ? "text-ink-900" : "text-ink-400"}`}>Monthly</span>
              <button
                onClick={() => setAnnual(!annual)}
                className={`relative h-7 w-12 rounded-full transition-colors duration-200 ${annual ? "bg-mint-500" : "bg-ink-300"}`}
              >
                <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${annual ? "translate-x-6" : "translate-x-1"}`} />
              </button>
              <span className={`text-sm font-semibold ${annual ? "text-ink-900" : "text-ink-400"}`}>
                Annual
                <span className="ml-2 rounded-full bg-mint-500/10 px-2 py-0.5 text-xs font-bold text-mint-600">Save 20%</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing cards */}
      <section className="relative -mt-4 pb-16 sm:pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-3">
            {plans.map((plan, i) => (
              <div
                key={plan.name}
                className={`relative flex flex-col rounded-2xl border p-8 transition-all duration-300 hover:-translate-y-1 ${
                  plan.highlight
                    ? "border-mint-500/50 bg-gradient-to-b from-mint-500/5 to-white shadow-elevated"
                    : "border-[#e7dcc8] bg-white/90 shadow-soft"
                } stagger-${i + 1}`}
              >
                {plan.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-gradient-to-r from-mint-500 to-mint-600 px-4 py-1 text-xs font-bold text-white shadow">
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div>
                  <h3 className="text-lg font-extrabold text-ink-900">{plan.name}</h3>
                  <p className="mt-1 text-sm text-ink-500">{plan.tagline}</p>

                  <div className="mt-6">
                    {plan.monthly === null ? (
                      <div>
                        <span className="text-4xl font-extrabold text-ink-900">Custom</span>
                      </div>
                    ) : plan.monthly === 0 ? (
                      <div>
                        <span className="text-4xl font-extrabold text-ink-900">Free</span>
                        <span className="ml-2 text-sm text-ink-400">forever</span>
                      </div>
                    ) : (
                      <div>
                        <span className="text-4xl font-extrabold text-ink-900">
                          ₹{(annual ? plan.annual : plan.monthly).toLocaleString("en-IN")}
                        </span>
                        <span className="ml-1 text-sm text-ink-400">/ month</span>
                        {annual && (
                          <div className="mt-1 text-xs text-mint-600 font-semibold">
                            Billed ₹{(plan.annual * 12).toLocaleString("en-IN")} annually
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <Link
                  to={plan.ctaTo}
                  className={`mt-8 block rounded-xl py-3 text-center text-sm font-bold transition-all duration-200 ${
                    plan.highlight
                      ? "bg-gradient-to-r from-mint-500 to-mint-600 text-white shadow-glow hover:shadow-lg hover:-translate-y-0.5"
                      : plan.monthly === null
                      ? "border border-ink-900 bg-white text-ink-900 hover:bg-ink-900 hover:text-white"
                      : "border border-[#d9c9a8] bg-sand-50 text-ink-900 hover:bg-sand-100"
                  }`}
                >
                  {plan.cta}
                </Link>

                <ul className="mt-8 space-y-3">
                  {plan.featureLabels.map((label, j) => (
                    <li key={label} className="flex items-start gap-3 text-sm text-ink-700">
                      {plan.features[j] ? (
                        <Check color={plan.highlight ? "text-mint-500" : "text-mint-500"} />
                      ) : (
                        <X />
                      )}
                      <span className={plan.features[j] ? "" : "text-ink-400"}>{label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <p className="mt-8 text-center text-sm text-ink-500">
            All plans include unlimited data export, 99.9% uptime SLA, and end-to-end encryption.
          </p>
        </div>
      </section>

      {/* Comparison table */}
      <section className="section-padding bg-sand-100/40">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">Full feature comparison</h2>
          </div>
          <div className="mt-10 overflow-x-auto rounded-2xl border border-[#e7dcc8] bg-white shadow-soft">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-[#e7dcc8] bg-sand-50/80">
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest text-ink-500 w-1/2">Feature</th>
                  {plans.map((p) => (
                    <th key={p.name} className={`px-6 py-4 text-center text-sm font-extrabold ${p.highlight ? "text-mint-600" : "text-ink-900"}`}>
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Documents / month", values: ["50", "500", "Unlimited"] },
                  { label: "Team members", values: ["2", "10", "Unlimited"] },
                  { label: "Clients", values: ["∞", "∞", "∞"] },
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
                  { label: "Dedicated account manager", values: [false, false, true] },
                  { label: "Custom integrations", values: [false, false, true] },
                ].map((row, i) => (
                  <tr key={row.label} className={`border-b border-[#f0e8d8] ${i % 2 === 0 ? "" : "bg-sand-50/30"}`}>
                    <td className="px-6 py-3.5 text-sm font-semibold text-ink-800">{row.label}</td>
                    {row.values.map((v, j) => (
                      <td key={j} className="px-6 py-3.5 text-center">
                        {typeof v === "boolean" ? (
                          v ? (
                            <svg className="mx-auto h-5 w-5 text-mint-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          ) : (
                            <svg className="mx-auto h-4 w-4 text-ink-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M18 12H6" />
                            </svg>
                          )
                        ) : (
                          <span className={`text-sm font-semibold ${j === 1 ? "text-mint-600" : "text-ink-700"}`}>{v}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section-padding">
        <div className="mx-auto max-w-3xl">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-mint-500">FAQ</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
              Common questions
            </h2>
          </div>
          <div className="mt-12 rounded-2xl border border-[#e7dcc8] bg-white/90 px-6 shadow-soft">
            {faqs.map((faq) => (
              <FaqItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding">
        <div className="mx-auto max-w-7xl">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-ink-900 via-ink-800 to-ink-700 px-6 py-16 text-center sm:px-12 sm:py-20">
            <div className="absolute -left-10 top-10 h-48 w-48 rounded-full bg-mint-500/20 blur-[80px]" />
            <div className="absolute -right-10 bottom-10 h-40 w-40 rounded-full bg-indigo-500/15 blur-[70px]" />
            <div className="relative">
              <h2 className="text-3xl font-extrabold text-white sm:text-4xl">Start free today</h2>
              <p className="mx-auto mt-4 max-w-xl text-base text-sand-100/70">
                No credit card. 50 documents/month free forever. Upgrade when you need more.
              </p>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <Link to="/signup" className="btn-accent w-full px-10 py-3 text-sm sm:w-auto">
                  Create free account
                </Link>
                <Link to="/features" className="w-full rounded-xl border border-white/20 px-10 py-3 text-center text-sm font-semibold text-white transition hover:bg-white/10 sm:w-auto">
                  Compare features
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
};

export default PricingPage;
