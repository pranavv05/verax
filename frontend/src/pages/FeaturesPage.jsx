import { Link } from "react-router-dom";
import PublicLayout from "../components/layout/PublicLayout";

const featureDetails = [
  {
    title: "Client Management",
    subtitle: "Organize your entire client roster",
    description: "Create and manage client profiles with detailed information including GSTIN, contact details, and status tracking. Generate secure upload links for clients to submit documents without needing an account.",
    highlights: ["Detailed client profiles with GSTIN tracking", "One-click secure upload link generation", "Status management (Active, Pending, Inactive)", "Search and filter across all client records", "Paginated client directory"],
    icon: (
      <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
    gradient: "from-indigo-500 to-indigo-600",
    bgGradient: "from-indigo-500/5 to-indigo-500/10"
  },
  {
    title: "Smart OCR Reviews",
    subtitle: "AI-powered document processing",
    description: "Our AI-driven OCR engine automatically extracts key data from uploaded invoices, receipts, and financial documents. Accountants then review and approve extracted data through an intuitive workflow.",
    highlights: ["Automatic text and data extraction from invoices", "Structured extraction of amounts, dates, GSTIN", "Side-by-side document preview and data review", "Approve, reject, or edit extracted entries", "Full audit trail of all review actions"],
    icon: (
      <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
    gradient: "from-mint-500 to-mint-600",
    bgGradient: "from-mint-500/5 to-mint-500/10"
  },
  {
    title: "Tally XML Export",
    subtitle: "Seamless TallyPrime integration",
    description: "Generate TallyPrime-compatible XML voucher exports directly from approved documents. Select clients, choose date ranges, pick specific documents, and download instantly.",
    highlights: ["TallyPrime-ready XML voucher generation", "Client-specific export filtering", "Date range selection for targeted exports", "Download history with re-download capability", "Status tracking for all generated exports"],
    icon: (
      <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
      </svg>
    ),
    gradient: "from-ember-500 to-ember-600",
    bgGradient: "from-ember-500/5 to-ember-500/10"
  },
  {
    title: "Multi-Tenant Security",
    subtitle: "Firm-isolated data architecture",
    description: "Every firm gets its own isolated tenant with strict data boundaries. Your clients' data is never mixed with other firms, ensuring complete privacy and compliance.",
    highlights: ["Strict tenant-level data isolation", "Secure authentication with session management", "Role-based access control", "Encrypted data at rest and in transit", "Magic link public uploads with expiry"],
    icon: (
      <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    gradient: "from-ink-700 to-ink-900",
    bgGradient: "from-ink-900/5 to-ink-900/10"
  }
];

const FeaturesPage = () => {
  return (
    <PublicLayout>
      {/* Hero */}
      <section className="hero-gradient relative overflow-hidden">
        <div className="orb orb-2" style={{ top: "10%", right: "5%" }} />
        <div className="orb orb-3" style={{ bottom: "20%", left: "10%" }} />

        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="animate-fade-in-up text-xs font-bold uppercase tracking-[0.25em] text-mint-500">
              Platform Features
            </p>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight text-ink-900 opacity-0 animate-fade-in-up-delay-1 sm:text-5xl">
              Built for the way{" "}
              <span className="gradient-text-accent">CAs actually work</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink-600 opacity-0 animate-fade-in-up-delay-2">
              Every feature is designed with Indian CA firms in mind — from GSTIN validation to TallyPrime exports.
            </p>
          </div>
        </div>
      </section>

      {/* Feature Details */}
      <section className="section-padding">
        <div className="mx-auto max-w-7xl space-y-20">
          {featureDetails.map((feature, index) => (
            <div
              key={feature.title}
              className={`grid items-center gap-10 lg:grid-cols-2 ${index % 2 === 1 ? "lg:direction-reverse" : ""}`}
            >
              {/* Content side */}
              <div className={index % 2 === 1 ? "lg:order-2" : ""}>
                <div className={`inline-flex items-center justify-center rounded-2xl bg-gradient-to-br ${feature.gradient} p-3 text-white`}>
                  {feature.icon}
                </div>
                <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-ink-500">
                  {feature.subtitle}
                </p>
                <h2 className="mt-2 text-2xl font-extrabold text-ink-900 sm:text-3xl">
                  {feature.title}
                </h2>
                <p className="mt-4 text-base leading-relaxed text-ink-600">
                  {feature.description}
                </p>
                <ul className="mt-6 space-y-3">
                  {feature.highlights.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-ink-700">
                      <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-mint-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Visual card side */}
              <div className={index % 2 === 1 ? "lg:order-1" : ""}>
                <div className={`hover-lift rounded-2xl border border-[#e7dcc8] bg-gradient-to-br ${feature.bgGradient} p-8`}>
                  <div className="rounded-xl bg-white/80 p-6 shadow-sm backdrop-blur-sm">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${feature.gradient} text-white`}>
                        {feature.icon}
                      </div>
                      <div>
                        <p className="font-bold text-ink-900">{feature.title}</p>
                        <p className="text-xs text-ink-500">{feature.subtitle}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {feature.highlights.slice(0, 3).map((h) => (
                        <div key={h} className="flex items-center gap-2 rounded-lg border border-[#e7dcc8] bg-sand-50/60 px-3 py-2 text-xs text-ink-700">
                          <span className="h-2 w-2 rounded-full bg-mint-500" />
                          {h}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding">
        <div className="mx-auto max-w-7xl">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-mint-500 to-mint-600 px-6 py-16 text-center sm:px-12 sm:py-20">
            <div className="absolute -left-10 top-10 h-40 w-40 rounded-full bg-white/10 blur-[60px]" />
            <div className="absolute -right-10 bottom-10 h-32 w-32 rounded-full bg-white/10 blur-[50px]" />

            <div className="relative">
              <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
                See it in action
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-base text-white/80">
                Start your free trial today and experience how CA Suite can transform your firm's workflow.
              </p>
              <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                <Link to="/signup" className="rounded-lg bg-white px-10 py-3.5 text-base font-semibold text-mint-600 transition-all duration-300 hover:shadow-elevated hover:-translate-y-0.5">
                  Get Started Free
                </Link>
                <Link to="/login" className="rounded-lg border border-white/30 px-8 py-3.5 text-base font-semibold text-white transition-all duration-300 hover:bg-white/10">
                  Sign In
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
};

export default FeaturesPage;
