import PublicLayout from "../components/layout/PublicLayout";
import WaitlistForm from "../components/ui/WaitlistForm";

const values = [
  {
    icon: (
      <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
    title: "Speed & Efficiency",
    description: "Automate the repetitive parts of accounting so your team can focus on advisory work that truly matters."
  },
  {
    icon: (
      <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    title: "Security First",
    description: "Multi-tenant isolation ensures your clients' financial data stays private and protected at every layer."
  },
  {
    icon: (
      <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
      </svg>
    ),
    title: "Built for India",
    description: "GSTIN validation, TallyPrime compatibility, and workflows designed specifically for Indian CA firms."
  },
  {
    icon: (
      <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
      </svg>
    ),
    title: "AI-Powered",
    description: "Smart OCR extraction that learns and improves, turning stacks of invoices into structured, reviewable data."
  }
];

const AboutPage = () => {
  return (
    <PublicLayout>
      {/* Hero */}
      <section className="hero-gradient relative overflow-hidden">
        <div className="orb orb-1" style={{ top: "0%", right: "15%" }} />
        <div className="orb orb-3" style={{ bottom: "10%", left: "5%" }} />

        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="animate-fade-in-up text-xs font-bold uppercase tracking-[0.25em] text-mint-500">
              About Verax
            </p>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight text-ink-900 opacity-0 animate-fade-in-up-delay-1 sm:text-5xl">
              Simplifying accounting,{" "}
              <span className="gradient-text-accent">one firm at a time</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink-600 opacity-0 animate-fade-in-up-delay-2">
              We believe Chartered Accountants deserve modern, beautiful tools that make their daily work effortless.
            </p>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="section-padding">
        <div className="mx-auto max-w-7xl">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-mint-500">Our Mission</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
                Empowering CA firms with technology
              </h2>
              <p className="mt-6 text-base leading-relaxed text-ink-600">
                Indian CA firms handle thousands of documents every month — invoices, receipts, bank statements, and more. Yet most still rely on manual data entry and disconnected tools.
              </p>
              <p className="mt-4 text-base leading-relaxed text-ink-600">
                Verax was built to change that. We combine AI-powered document extraction, streamlined review workflows, and direct TallyPrime integration into one cohesive platform that respects how CAs actually work.
              </p>
              <p className="mt-4 text-base leading-relaxed text-ink-600">
                Our goal is simple: give every CA firm — from solo practitioners to large practices — the tools to work faster, with fewer errors, and with complete peace of mind about data security.
              </p>
            </div>

            {/* Visual */}
            <div className="relative">
              <div className="hover-lift rounded-2xl border border-[#e7dcc8] bg-gradient-to-br from-ink-900 to-ink-800 p-8 text-white">
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-mint-500/20">
                      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="text-mint-400">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21m-3.75 3H21" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-2xl font-extrabold">500+</p>
                      <p className="text-sm text-sand-100/60">CA firms trust us</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/20">
                      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="text-indigo-400">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-2xl font-extrabold">10,000+</p>
                      <p className="text-sm text-sand-100/60">Documents processed monthly</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-ember-500/20">
                      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="text-ember-400">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-2xl font-extrabold">&lt; 2 min</p>
                      <p className="text-sm text-sand-100/60">Average processing time</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="section-padding bg-sand-100/50">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-mint-500">Our Values</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
              What drives us every day
            </h2>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2">
            {values.map((value) => (
              <article
                key={value.title}
                className="hover-lift card-shine rounded-2xl border border-[#e7dcc8] bg-white/80 p-6 backdrop-blur-sm"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-mint-500/10 to-indigo-500/10 text-ink-700">
                  {value.icon}
                </div>
                <h3 className="mt-5 text-lg font-bold text-ink-900">{value.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">{value.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="section-padding">
        <div className="mx-auto max-w-7xl">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-ink-900 via-ink-800 to-ink-700 px-6 py-16 text-center sm:px-12 sm:py-20">
            <div className="absolute -left-10 top-10 h-40 w-40 rounded-full bg-mint-500/20 blur-[60px]" />
            <div className="absolute -right-10 bottom-10 h-32 w-32 rounded-full bg-indigo-500/15 blur-[50px]" />

            <div className="relative">
              <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
                Have questions?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-base text-sand-100/70">
                We'd love to hear from you. Whether you're ready to get started or just exploring, our team is here to help.
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

export default AboutPage;
