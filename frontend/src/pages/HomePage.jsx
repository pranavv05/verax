import { Link } from "react-router-dom";
import PublicLayout from "../components/layout/PublicLayout";
import WaitlistForm from "../components/ui/WaitlistForm";

const features = [
  {
    icon: (
      <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
    title: "Client Management",
    description: "Organize all your clients with detailed profiles, GSTIN tracking, status management, and instant document request links.",
    gradient: "from-indigo-500/10 to-indigo-500/5"
  },
  {
    icon: (
      <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
    title: "Smart OCR Reviews",
    description: "AI-powered document extraction with an accountant review workflow. Upload invoices and let the system do the heavy lifting.",
    gradient: "from-mint-500/10 to-mint-500/5"
  },
  {
    icon: (
      <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
      </svg>
    ),
    title: "Tally XML Export",
    description: "Generate TallyPrime-compatible XML exports with full audit tracking. One click to move reviewed data into your accounting system.",
    gradient: "from-ember-500/10 to-ember-500/5"
  }
];

const steps = [
  {
    step: "01",
    title: "Upload Documents",
    description: "Clients upload invoices and receipts via a secure magic link — no account needed."
  },
  {
    step: "02",
    title: "AI Extracts Data",
    description: "Our OCR engine automatically extracts line items, amounts, GSTIN, and dates from each document."
  },
  {
    step: "03",
    title: "Review & Export",
    description: "Accountants review extracted data, approve entries, and export to TallyPrime XML with one click."
  }
];

const stats = [
  { value: "10,000+", label: "Documents Processed" },
  { value: "500+", label: "CA Firms Onboarded" },
  { value: "99.5%", label: "OCR Accuracy" },
  { value: "< 2min", label: "Avg. Processing Time" }
];

const HomePage = () => {
  return (
    <PublicLayout>
      {/* Hero Section */}
      <section className="hero-gradient relative overflow-hidden">
        {/* Background Orbs */}
        <div className="orb orb-1" style={{ top: "-5%", left: "5%" }} />
        <div className="orb orb-2" style={{ top: "20%", right: "0%" }} />
        <div className="orb orb-3" style={{ bottom: "10%", left: "40%" }} />

        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 md:py-36 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="animate-fade-in-up text-xs font-bold uppercase tracking-[0.25em] text-mint-500">
              Modern Practice Management
            </p>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight text-ink-900 opacity-0 animate-fade-in-up-delay-1 sm:text-5xl md:text-6xl">
              The workspace your{" "}
              <span className="gradient-text-accent">CA firm</span>{" "}
              deserves
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink-600 opacity-0 animate-fade-in-up-delay-2">
              Manage clients, automate document extraction with AI-powered OCR, and export to TallyPrime — all from one beautiful, secure platform.
            </p>
            <div id="waitlist-section" className="mt-10 opacity-0 animate-fade-in-up-delay-3">
              <WaitlistForm />
              <div className="mt-6 flex justify-center">
                <Link to="/features" className="text-sm font-semibold text-ink-600 hover:text-ink-900 transition-colors">
                  Explore Features →
                </Link>
              </div>
            </div>
          </div>

          {/* Dashboard Preview Card */}
          <div className="mx-auto mt-16 max-w-4xl opacity-0 animate-fade-in-up-delay-4">
            <div className="glass-card overflow-hidden p-1.5">
              <div className="rounded-xl bg-white/90 p-6 shadow-sm">
                <div className="flex items-center gap-3 border-b border-[#e7dcc8] pb-4">
                  <div className="flex gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-rose-400/80" />
                    <span className="h-3 w-3 rounded-full bg-amber-400/80" />
                    <span className="h-3 w-3 rounded-full bg-mint-400/80" />
                  </div>
                  <span className="text-xs font-medium text-ink-500">Verax Dashboard</span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-[#e7dcc8] bg-sand-50/50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Total Clients</p>
                    <p className="mt-2 text-3xl font-extrabold text-ink-900">142</p>
                  </div>
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Pending Review</p>
                    <p className="mt-2 text-3xl font-extrabold text-ink-900">23</p>
                  </div>
                  <div className="rounded-xl border border-mint-500/20 bg-mint-500/5 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Exported This Month</p>
                    <p className="mt-2 text-3xl font-extrabold text-ink-900">89</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="section-padding relative">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-mint-500">Why Verax</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
              Everything you need to run your practice
            </h2>
            <p className="mt-4 text-base text-ink-600">
              Purpose-built tools that help CA firms work faster, smarter, and with fewer errors.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {features.map((feature, index) => (
              <article
                key={feature.title}
                className={`card-shine hover-lift rounded-2xl border border-[#e7dcc8] bg-gradient-to-br ${feature.gradient} p-6 transition-all duration-300 stagger-${index + 1}`}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm text-ink-700">
                  {feature.icon}
                </div>
                <h3 className="mt-5 text-lg font-bold text-ink-900">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">{feature.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="section-padding bg-ink-900 relative overflow-hidden">
        {/* Subtle orbs */}
        <div className="absolute top-0 left-1/4 h-64 w-64 rounded-full bg-mint-500/10 blur-[100px]" />
        <div className="absolute bottom-0 right-1/4 h-48 w-48 rounded-full bg-indigo-500/10 blur-[80px]" />

        <div className="relative mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-mint-400">How It Works</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Three steps to smarter accounting
            </h2>
          </div>

          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {steps.map((step, index) => (
              <div key={step.step} className="relative text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-2xl font-extrabold text-mint-400 backdrop-blur-sm border border-white/10">
                  {step.step}
                </div>
                {index < steps.length - 1 && (
                  <div className="absolute right-0 top-8 hidden h-px w-full translate-x-1/2 bg-gradient-to-r from-white/20 to-transparent md:block" />
                )}
                <h3 className="mt-6 text-lg font-bold text-white">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-sand-100/60">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="section-padding">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="hover-lift rounded-2xl border border-[#e7dcc8] bg-white/80 p-6 text-center backdrop-blur-sm"
              >
                <p className="text-3xl font-extrabold text-ink-900 sm:text-4xl">{stat.value}</p>
                <p className="mt-2 text-sm font-medium text-ink-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="section-padding">
        <div className="mx-auto max-w-7xl">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-ink-900 via-ink-800 to-ink-700 px-6 py-16 text-center sm:px-12 sm:py-20">
            {/* Accent orbs */}
            <div className="absolute -left-10 top-10 h-40 w-40 rounded-full bg-mint-500/20 blur-[60px]" />
            <div className="absolute -right-10 bottom-10 h-32 w-32 rounded-full bg-indigo-500/15 blur-[50px]" />

            <div className="relative">
              <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
                Ready to modernize your practice?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-base text-sand-100/70">
                Join hundreds of CA firms already using Verax to streamline their client document workflows and Tally exports.
              </p>
              <div className="mt-8">
                <WaitlistForm />
              </div>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
};

export default HomePage;
