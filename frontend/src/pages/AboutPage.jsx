import { Link } from "react-router-dom";
import PublicLayout from "../components/layout/PublicLayout";
import WaitlistForm from "../components/ui/WaitlistForm";

const values = [
  {
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
    title: "Speed without sacrifice",
    description: "Automation should make work faster, not riskier. We automate the tedious parts while keeping CAs in control of every approval.",
    color: "text-mint-500",
    bg: "bg-mint-500/10",
  },
  {
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    title: "Security by architecture",
    description: "Data isolation isn't a setting — it's enforced by the database itself. PostgreSQL Row-Level Security means no firm can ever access another's records.",
    color: "text-indigo-400",
    bg: "bg-indigo-500/10",
  },
  {
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
      </svg>
    ),
    title: "India-first product thinking",
    description: "GSTIN validation, TallyPrime compatibility, Indian TDS section tables, and INR-centric UX. We build for Indian CA practice, not a generic global market.",
    color: "text-ember-400",
    bg: "bg-ember-500/10",
  },
  {
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    ),
    title: "Accuracy over automation",
    description: "For numbers, we use rule-based processing, not just LLMs. Bank statement conversions use direct table extraction — zero hallucination risk on financial figures.",
    color: "text-mint-500",
    bg: "bg-mint-500/10",
  },
];

const team = [
  {
    name: "Pranav Verma",
    role: "Founder & CEO",
    bio: "Former CA, turned product builder. Built Verax after spending three years watching his own firm drown in invoice data entry.",
    initials: "PV",
    gradient: "from-ink-900 to-ink-700",
  },
  {
    name: "Arjun Nair",
    role: "Head of Engineering",
    bio: "Full-stack engineer with a focus on data pipelines and document AI. Led OCR infra at two fintech startups before Verax.",
    initials: "AN",
    gradient: "from-indigo-600 to-indigo-500",
  },
  {
    name: "Sneha Kulkarni",
    role: "Head of Product",
    bio: "CA by qualification, designer by passion. Bridges the gap between what accountants need and what gets built.",
    initials: "SK",
    gradient: "from-mint-600 to-mint-500",
  },
];

const milestones = [
  { year: "2022", event: "Founded in Pune after seeing CA firms lose hours to manual invoice entry" },
  { year: "2023", event: "First 50 CA firms onboarded; TallyPrime XML export shipped" },
  { year: "2024", event: "AI extraction with GPT-4o, GSTIN compliance engine, bank statement processing" },
  { year: "2025", event: "500+ firms, 10,000+ documents monthly, bank statement → Tally XML tool launched" },
];

const AboutPage = () => (
  <PublicLayout>
    {/* Hero */}
    <section className="relative overflow-hidden">
      <div className="hero-gradient absolute inset-0" />
      <div className="orb orb-1 absolute" style={{ top: "0%", right: "15%" }} />
      <div className="orb orb-3 absolute" style={{ bottom: "10%", left: "5%" }} />

      <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-16 sm:px-6 sm:pt-20 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="animate-fade-in-up inline-flex items-center gap-2 rounded-full border border-mint-500/30 bg-mint-500/10 px-4 py-1.5 text-xs font-bold tracking-wide text-mint-600">
            About Verax
          </div>
          <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight text-ink-900 opacity-0 animate-fade-in-up-delay-1 sm:text-5xl">
            Built by accountants,{" "}
            <span className="gradient-text-accent">for accountants</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink-600 opacity-0 animate-fade-in-up-delay-2">
            Verax exists because CA firms deserve tools that understand Indian accounting — not generic software retrofitted with a GSTIN field.
          </p>
        </div>
      </div>
    </section>

    {/* Mission */}
    <section className="section-padding">
      <div className="mx-auto max-w-7xl">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-mint-500">Our mission</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
              Make data entry extinct for CA firms
            </h2>
            <div className="mt-6 space-y-4 text-base leading-relaxed text-ink-600">
              <p>
                A mid-size CA firm in India processes 300–1,000 documents every month. Invoices arrive as phone photos. Bank statements come as PDF exports. Each one gets manually re-typed into Tally.
              </p>
              <p>
                That's not accounting work — it's data entry. It's repetitive, error-prone, and it keeps qualified CAs away from advisory work that actually grows their clients' businesses.
              </p>
              <p>
                Verax automates the pipeline: upload → OCR → compliance check → review → Tally XML. The CA still reviews and approves everything. But the typing, the GSTIN lookups, the tax math — all gone.
              </p>
            </div>
          </div>

          {/* Stats card */}
          <div className="hover-lift rounded-2xl border border-[#e7dcc8] bg-gradient-to-br from-ink-900 to-ink-800 p-8 text-white">
            <p className="mb-6 text-sm font-semibold text-sand-100/60">Impact so far</p>
            <div className="space-y-6">
              {[
                { icon: "🏢", value: "500+", label: "CA firms onboarded" },
                { icon: "📄", value: "10,000+", label: "Documents processed monthly" },
                { icon: "⏱", value: "< 2 min", label: "Average AI processing time" },
                { icon: "✅", value: "99.5%", label: "OCR field accuracy" },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-white/8 text-xl">
                    {s.icon}
                  </div>
                  <div>
                    <div className="text-2xl font-extrabold">{s.value}</div>
                    <div className="text-sm text-sand-100/60">{s.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* Timeline */}
    <section className="section-padding bg-sand-100/40">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-mint-500">Our journey</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
            How we got here
          </h2>
        </div>
        <div className="mx-auto mt-14 max-w-3xl">
          <div className="relative">
            <div className="absolute left-8 top-0 h-full w-px bg-gradient-to-b from-mint-500/60 via-indigo-500/30 to-transparent" />
            <div className="space-y-10">
              {milestones.map((m, i) => (
                <div key={m.year} className="relative flex gap-6">
                  <div className={`relative z-10 flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl border border-[#e7dcc8] bg-white text-sm font-extrabold text-ink-900 shadow-soft stagger-${i + 1}`}>
                    {m.year}
                  </div>
                  <div className="flex flex-1 items-center">
                    <p className="text-base text-ink-700">{m.event}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* Team */}
    <section className="section-padding">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-mint-500">The team</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
            Who builds Verax
          </h2>
          <p className="mt-4 text-base text-ink-600">
            A small team that's deeply familiar with Indian accounting workflows.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-3">
          {team.map((member, i) => (
            <article key={member.name} className={`hover-lift card-shine rounded-2xl border border-[#e7dcc8] bg-white/90 p-6 text-center backdrop-blur-sm stagger-${i + 1}`}>
              <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br ${member.gradient} text-xl font-extrabold text-white shadow-elevated`}>
                {member.initials}
              </div>
              <h3 className="mt-5 text-base font-extrabold text-ink-900">{member.name}</h3>
              <p className="text-sm font-semibold text-mint-600">{member.role}</p>
              <p className="mt-3 text-sm leading-relaxed text-ink-600">{member.bio}</p>
            </article>
          ))}
        </div>
      </div>
    </section>

    {/* Values */}
    <section className="section-padding bg-sand-100/40">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-mint-500">What drives us</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
            Our values
          </h2>
        </div>
        <div className="mt-14 grid gap-6 sm:grid-cols-2">
          {values.map((v, i) => (
            <article key={v.title} className={`hover-lift card-shine rounded-2xl border border-[#e7dcc8] bg-white/80 p-6 backdrop-blur-sm stagger-${i + 1}`}>
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${v.bg} ${v.color}`}>
                {v.icon}
              </div>
              <h3 className="mt-5 text-base font-bold text-ink-900">{v.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">{v.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>

    {/* CTA */}
    <section className="section-padding">
      <div className="mx-auto max-w-7xl">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-ink-900 via-ink-800 to-ink-700 px-6 py-16 text-center sm:px-12 sm:py-20">
          <div className="absolute -left-10 top-10 h-40 w-40 rounded-full bg-mint-500/20 blur-[60px]" />
          <div className="absolute -right-10 bottom-10 h-32 w-32 rounded-full bg-indigo-500/15 blur-[50px]" />
          <div className="relative">
            <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
              Have questions? We're reachable.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-sand-100/70">
              Whether you're curious about pricing, security, or custom integrations — our team is happy to talk.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link to="/signup" className="btn-accent w-full px-10 py-3 text-sm sm:w-auto">
                Start free trial
              </Link>
              <Link to="/security" className="w-full rounded-xl border border-white/20 px-10 py-3 text-center text-sm font-semibold text-white transition hover:bg-white/10 sm:w-auto">
                Read our security page
              </Link>
            </div>
            <div className="mt-10" id="waitlist-section">
              <p className="mb-4 text-sm font-semibold text-sand-100/60">Or join the early access waitlist</p>
              <WaitlistForm />
            </div>
          </div>
        </div>
      </div>
    </section>
  </PublicLayout>
);

export default AboutPage;
