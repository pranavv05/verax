import { Link } from "react-router-dom";
import PublicLayout from "../components/layout/PublicLayout";
import WaitlistForm from "../components/ui/WaitlistForm";

const CheckIcon = () => (
  <svg className="h-5 w-5 flex-shrink-0 text-mint-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const features = [
  {
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
    title: "AI-Powered OCR",
    description: "GPT-4o extracts every field from invoices, bills, and bank statements with high accuracy. Handles messy scans, handwriting, and multi-page PDFs.",
    color: "text-mint-500",
    bg: "bg-mint-500/10",
  },
  {
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    title: "Compliance Validation",
    description: "Automatic GSTIN checksum validation, tax math cross-checks (CGST+SGST+IGST), TDS rate verification, and duplicate invoice detection.",
    color: "text-indigo-400",
    bg: "bg-indigo-500/10",
  },
  {
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
      </svg>
    ),
    title: "One-Click Tally Export",
    description: "Generate TallyPrime-compatible XML vouchers for Purchase, Sales, Payment and Receipt entries. Import directly into your Tally company.",
    color: "text-ember-400",
    bg: "bg-ember-500/10",
  },
  {
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
    title: "Client Portal",
    description: "Share a secure magic link. Clients upload documents without creating an account. You get notified, they stay simple.",
    color: "text-indigo-400",
    bg: "bg-indigo-500/10",
  },
  {
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    ),
    title: "Smart Name Mapping",
    description: "Vendor item names auto-mapped to your Tally stock item names using fuzzy matching. Corrections remembered and applied to future invoices.",
    color: "text-mint-500",
    bg: "bg-mint-500/10",
  },
  {
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
      </svg>
    ),
    title: "Data Tools",
    description: "Standalone utilities: clean messy Excel GST registers and convert bank statement PDFs directly to Tally XML — no AI pipeline needed.",
    color: "text-ember-400",
    bg: "bg-ember-500/10",
  },
];

const steps = [
  {
    number: "01",
    title: "Send a magic link",
    description: "Generate a secure upload link for your client with one click. They upload invoices, bank statements, or bills — no account required.",
    detail: "Link expires in 72 hours • Auto-rotates after use",
  },
  {
    number: "02",
    title: "AI processes instantly",
    description: "Our pipeline runs OCR, extracts every field, validates GSTIN, checks tax math, and flags duplicates — all before you open the file.",
    detail: "Average processing time under 2 minutes",
  },
  {
    number: "03",
    title: "Review, approve, export",
    description: "Open the side-by-side review screen, correct anything the AI missed, hit approve, and download TallyPrime-ready XML.",
    detail: "Full audit trail of every change and approval",
  },
];

const testimonials = [
  {
    quote: "We process 400+ invoices a month across 60 clients. Verax cut our data entry time by nearly 80%. The GSTIN validation alone catches errors we used to miss until filing time.",
    name: "CA Rajesh Sharma",
    firm: "Sharma & Co., Mumbai",
    initials: "RS",
    color: "from-indigo-500 to-indigo-600",
  },
  {
    quote: "The bank statement tool is a lifesaver. We upload PDFs and get Tally vouchers in seconds. No more manually keying in hundreds of transactions every month.",
    name: "CA Priya Mehta",
    firm: "Mehta Associates, Ahmedabad",
    initials: "PM",
    color: "from-mint-500 to-mint-600",
  },
  {
    quote: "The magic link for clients is brilliant. My clients just click and upload — they don't need to learn anything. The documents just appear on my dashboard ready to review.",
    name: "CA Anand Kapoor",
    firm: "Kapoor & Partners, Delhi",
    initials: "AK",
    color: "from-ember-500 to-ember-600",
  },
];

const stats = [
  { value: "10,000+", label: "Documents Processed" },
  { value: "500+", label: "CA Firms" },
  { value: "99.5%", label: "OCR Accuracy" },
  { value: "< 2 min", label: "Processing Time" },
];

/* ── Product Mockup ── */
const ProductMockup = () => (
  <div className="relative w-full overflow-hidden rounded-2xl border border-white/20 bg-white shadow-elevated">
    {/* Window chrome */}
    <div className="flex items-center gap-2 border-b border-[#e7dcc8] bg-sand-50/80 px-4 py-3">
      <span className="h-3 w-3 rounded-full bg-rose-400/70" />
      <span className="h-3 w-3 rounded-full bg-amber-400/70" />
      <span className="h-3 w-3 rounded-full bg-mint-400/70" />
      <span className="ml-3 flex items-center gap-1.5 rounded-md bg-white border border-[#e7dcc8] px-3 py-1 text-xs text-ink-500 font-mono">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
        verax.app/dashboard
      </span>
    </div>
    {/* Dashboard content */}
    <div className="flex min-h-0">
      {/* Sidebar */}
      <div className="hidden w-48 flex-shrink-0 border-r border-[#e7dcc8] bg-sand-50/60 p-3 sm:block">
        <div className="mb-3 rounded-lg bg-ink-900 px-2.5 py-1.5 text-xs font-bold text-white">Verax</div>
        {["Dashboard","Clients","Documents","Export","Tools"].map((item, i) => (
          <div key={item} className={`mt-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${i === 0 ? "bg-mint-500/10 text-mint-600" : "text-ink-500"}`}>{item}</div>
        ))}
      </div>
      {/* Main area */}
      <div className="flex-1 p-4">
        <div className="mb-3 text-sm font-bold text-ink-900">Dashboard Overview</div>
        {/* Stat cards */}
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Clients", value: "142", color: "text-ink-900" },
            { label: "Pending", value: "23", color: "text-ember-500" },
            { label: "Approved", value: "91", color: "text-mint-500" },
            { label: "Exports", value: "58", color: "text-indigo-500" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-[#e7dcc8] bg-white p-3">
              <div className="text-xs text-ink-500">{s.label}</div>
              <div className={`mt-1 text-xl font-extrabold ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>
        {/* Review row */}
        <div className="rounded-xl border border-[#e7dcc8] bg-white p-3">
          <div className="mb-2 text-xs font-bold text-ink-900">Recent documents</div>
          {[
            { name: "Invoice_ABC_Nov.pdf", type: "Invoice", status: "Extracted", color: "bg-indigo-100 text-indigo-700" },
            { name: "BankStmt_Oct.pdf", type: "Bank Stmt", status: "Reviewed", color: "bg-mint-500/10 text-mint-600" },
            { name: "Bill_XYZ_Q3.pdf", type: "Bill", status: "Processing", color: "bg-amber-100 text-amber-700" },
          ].map((doc) => (
            <div key={doc.name} className="flex items-center justify-between border-t border-[#f0e8d8] py-2 text-xs">
              <span className="truncate font-medium text-ink-800">{doc.name}</span>
              <div className="flex items-center gap-2">
                <span className={`rounded px-1.5 py-0.5 font-semibold ${doc.color}`}>{doc.type}</span>
                <span className="text-ink-400">{doc.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const HomePage = () => (
  <PublicLayout>
    {/* ── Hero ── */}
    <section className="relative overflow-hidden">
      <div className="hero-gradient absolute inset-0" />
      <div className="orb orb-1 absolute" style={{ top: "5%", left: "3%" }} />
      <div className="orb orb-2 absolute" style={{ top: "15%", right: "2%" }} />
      <div className="orb orb-3 absolute" style={{ bottom: "10%", left: "45%" }} />

      <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-20 lg:px-8">
        {/* Badge */}
        <div className="flex justify-center">
          <div className="animate-fade-in-up inline-flex items-center gap-2 rounded-full border border-mint-500/30 bg-mint-500/10 px-4 py-1.5 text-xs font-bold tracking-wide text-mint-600">
            <span className="h-1.5 w-1.5 rounded-full bg-mint-500 animate-pulse" />
            Purpose-built for Indian CA firms
          </div>
        </div>

        {/* Headline */}
        <h1 className="mx-auto mt-6 max-w-4xl text-center text-4xl font-extrabold leading-[1.1] tracking-tight text-ink-900 opacity-0 animate-fade-in-up-delay-1 sm:text-5xl md:text-6xl">
          Turn client documents into{" "}
          <span className="gradient-text-accent">Tally entries</span>{" "}
          in minutes
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-center text-lg leading-relaxed text-ink-600 opacity-0 animate-fade-in-up-delay-2">
          AI-powered OCR extracts invoices and bank statements. Compliance checks run automatically. One click exports to TallyPrime. Your team spends time reviewing, not typing.
        </p>

        {/* CTAs */}
        <div className="mt-8 flex flex-col items-center gap-3 opacity-0 animate-fade-in-up-delay-3 sm:flex-row sm:justify-center">
          <Link to="/signup" className="btn-accent w-full px-8 py-3 text-sm sm:w-auto">
            Start free — no card needed
          </Link>
          <Link to="/features" className="btn-ghost w-full text-center text-sm sm:w-auto">
            Explore features →
          </Link>
        </div>

        <p className="mt-4 text-center text-xs text-ink-400 opacity-0 animate-fade-in-up-delay-3">
          Free 14-day trial · 50 documents/month free forever · No credit card
        </p>

        {/* Product mockup */}
        <div className="mx-auto mt-14 max-w-4xl opacity-0 animate-fade-in-up-delay-4">
          <div className="glass-card p-1.5">
            <ProductMockup />
          </div>
        </div>
      </div>
    </section>

    {/* ── Trust bar ── */}
    <section className="border-y border-[#e7dcc8] bg-white/60 py-6 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-ink-400">
          Trusted by CA firms across India
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
          {["Sharma & Co.", "Mehta Associates", "Kapoor Partners", "Gupta & Sons", "Iyer Chartered"].map((firm) => (
            <span key={firm} className="text-sm font-bold text-ink-300">{firm}</span>
          ))}
        </div>
      </div>
    </section>

    {/* ── Features grid ── */}
    <section className="section-padding">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-mint-500">Everything you need</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
            A complete practice management platform
          </h2>
          <p className="mt-4 text-base text-ink-600">
            Not a collection of bolt-on tools. One cohesive system built around how CAs actually work.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <article key={f.title} className={`card-shine hover-lift group rounded-2xl border border-[#e7dcc8] bg-white/80 p-6 backdrop-blur-sm stagger-${(i % 5) + 1}`}>
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${f.bg} ${f.color}`}>
                {f.icon}
              </div>
              <h3 className="mt-5 text-base font-bold text-ink-900">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">{f.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>

    {/* ── How it works ── */}
    <section className="section-padding relative overflow-hidden bg-ink-900">
      <div className="absolute left-1/4 top-0 h-64 w-64 rounded-full bg-mint-500/8 blur-[100px]" />
      <div className="absolute bottom-0 right-1/4 h-48 w-48 rounded-full bg-indigo-500/8 blur-[80px]" />

      <div className="relative mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-mint-400">Workflow</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Three steps from upload to Tally
          </h2>
          <p className="mt-4 text-base text-sand-100/60">
            No complex setup. No manual data entry. Just a fast, repeatable process your whole team can follow.
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {steps.map((step, i) => (
            <div key={step.number} className="relative">
              {i < steps.length - 1 && (
                <div className="absolute left-full top-8 z-10 hidden h-px w-full -translate-x-4 bg-gradient-to-r from-white/20 via-white/10 to-transparent md:block" />
              )}
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/8 backdrop-blur-sm">
                <span className="text-2xl font-extrabold text-mint-400">{step.number}</span>
              </div>
              <h3 className="mt-6 text-lg font-bold text-white">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-sand-100/60">{step.description}</p>
              <p className="mt-3 text-xs font-semibold text-mint-400/70">{step.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* ── Feature showcase: Review ── */}
    <section className="section-padding">
      <div className="mx-auto max-w-7xl">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-mint-500">Document Review</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
              Side-by-side review with live compliance checks
            </h2>
            <p className="mt-5 text-base leading-relaxed text-ink-600">
              See the original document on the left, extracted fields on the right. Compliance errors appear inline — GSTIN invalid, tax math off, TDS rate mismatch. Fix and approve in a single screen.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                "GSTIN checksum validation with state-code lookup",
                "CGST + SGST + IGST cross-checked against total",
                "TDS section rate verified against 16 defined sections",
                "Duplicate invoice detection across approved records",
                "Fuzzy item name suggestions from your Tally ledger",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-ink-700">
                  <CheckIcon />
                  {item}
                </li>
              ))}
            </ul>
            <Link to="/features" className="btn-primary mt-8 inline-flex text-sm">
              See all features →
            </Link>
          </div>
          {/* Visual */}
          <div className="hover-lift rounded-2xl border border-[#e7dcc8] bg-gradient-to-br from-ink-900/5 to-indigo-500/5 p-1.5">
            <div className="rounded-xl bg-white p-5 shadow-soft">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-bold text-ink-900">Review: Invoice_ABC_Nov.pdf</span>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">Extracted</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { label: "Vendor Name", value: "ABC Enterprises Pvt Ltd", ok: true },
                  { label: "Vendor GSTIN", value: "27AAAAA0000A1Z5", ok: true },
                  { label: "Invoice No.", value: "INV-2024-1193", ok: true },
                  { label: "Invoice Date", value: "12 Nov 2024", ok: true },
                  { label: "CGST (9%)", value: "₹4,500", ok: true },
                  { label: "SGST (9%)", value: "₹4,500", ok: true },
                  { label: "IGST", value: "—", ok: true },
                  { label: "Total Amount", value: "₹59,000", ok: true },
                ].map((field) => (
                  <div key={field.label} className="rounded-lg border border-[#e7dcc8] bg-sand-50/60 px-3 py-2">
                    <div className="text-xs text-ink-400">{field.label}</div>
                    <div className="mt-0.5 text-sm font-semibold text-ink-900">{field.value}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-mint-500/30 bg-mint-500/8 px-3 py-2">
                <svg className="h-4 w-4 text-mint-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span className="text-xs font-semibold text-mint-600">All compliance checks passed</span>
              </div>
              <button className="btn-accent mt-4 w-full text-sm py-2.5">Approve &amp; mark reviewed</button>
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* ── Testimonials ── */}
    <section className="section-padding bg-sand-100/40">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-mint-500">What CAs say</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
            Firms that made the switch
          </h2>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {testimonials.map((t) => (
            <article key={t.name} className="hover-lift card-shine flex flex-col rounded-2xl border border-[#e7dcc8] bg-white/90 p-6 shadow-soft backdrop-blur-sm">
              {/* Stars */}
              <div className="flex gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg key={i} className="h-4 w-4 text-ember-400" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="mt-4 flex-1 text-sm leading-relaxed text-ink-700">"{t.quote}"</p>
              <div className="mt-6 flex items-center gap-3">
                <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${t.color} text-xs font-bold text-white`}>
                  {t.initials}
                </div>
                <div>
                  <p className="text-sm font-bold text-ink-900">{t.name}</p>
                  <p className="text-xs text-ink-500">{t.firm}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>

    {/* ── Stats ── */}
    <section className="section-padding">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s, i) => (
            <div key={s.label} className={`hover-lift rounded-2xl border border-[#e7dcc8] bg-white/80 p-6 text-center backdrop-blur-sm stagger-${i + 1}`}>
              <p className="text-4xl font-extrabold text-ink-900">{s.value}</p>
              <p className="mt-2 text-sm font-semibold text-ink-500">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* ── Final CTA ── */}
    <section className="section-padding">
      <div className="mx-auto max-w-7xl">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-ink-900 via-ink-800 to-ink-700 px-6 py-16 text-center sm:px-12 sm:py-24">
          <div className="absolute -left-16 top-8 h-48 w-48 rounded-full bg-mint-500/20 blur-[80px]" />
          <div className="absolute -right-16 bottom-8 h-40 w-40 rounded-full bg-indigo-500/15 blur-[70px]" />
          <div className="absolute left-1/2 top-0 h-32 w-32 -translate-x-1/2 rounded-full bg-ember-500/10 blur-[60px]" />

          <div className="relative">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-mint-400">Get started today</p>
            <h2 className="mt-4 text-3xl font-extrabold text-white sm:text-4xl">
              Ready to modernize your practice?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-sand-100/70">
              Join hundreds of CA firms using Verax. Free for up to 50 documents a month, forever.
            </p>
            <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link to="/signup" className="btn-accent w-full px-10 py-3 text-sm sm:w-auto">
                Create free account
              </Link>
              <Link to="/pricing" className="btn-ghost w-full border border-white/20 text-center text-sm text-white hover:bg-white/10 sm:w-auto px-8 py-3 rounded-lg font-semibold transition">
                View pricing
              </Link>
            </div>
            <div id="waitlist-section" className="mt-10">
              <p className="mb-4 text-sm font-semibold text-sand-100/60">Or join the early access waitlist</p>
              <WaitlistForm />
            </div>
          </div>
        </div>
      </div>
    </section>
  </PublicLayout>
);

export default HomePage;
