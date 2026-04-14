import { Link } from "react-router-dom";
import PublicLayout from "../components/layout/PublicLayout";

const pillars = [
  {
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 2.25v2.25m0 4.5v2.25" />
      </svg>
    ),
    title: "Row-Level Security",
    description: "PostgreSQL RLS enforces tenant isolation at the database layer. Every query automatically filters by your firm_id — no application-level gate that can be bypassed.",
    badge: "Database-enforced",
    badgeColor: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
  },
  {
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
      </svg>
    ),
    title: "JWT + Refresh Token Chain",
    description: "Short-lived access tokens (15 minutes) with httpOnly refresh cookies (7 days). Refresh tokens rotate on every use. Reuse of a revoked token invalidates the entire session chain.",
    badge: "Chain rotation",
    badgeColor: "bg-mint-500/10 text-mint-600 border-mint-500/20",
  },
  {
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
      </svg>
    ),
    title: "Magic Link Security",
    description: "Client upload links are 64-character cryptographically random hex tokens. They expire after 72 hours and are single-rotation — a new token is issued automatically after each successful use.",
    badge: "64-char hex token",
    badgeColor: "bg-ember-500/10 text-ember-600 border-ember-500/20",
  },
  {
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>
    ),
    title: "S3 Direct Upload",
    description: "Document files never pass through our backend servers. The browser uploads directly to S3 via presigned PUT URLs. File bytes are never logged, cached, or processed by application code.",
    badge: "Zero backend touch",
    badgeColor: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
  },
  {
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
      </svg>
    ),
    title: "Complete Audit Trail",
    description: "Every critical action is logged: document uploads, AI extraction, approvals, exports, team changes, and settings updates. Logs include user ID, timestamp, entity, and metadata.",
    badge: "Immutable logs",
    badgeColor: "bg-mint-500/10 text-mint-600 border-mint-500/20",
  },
  {
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
    title: "Soft Deletes Only",
    description: "No data is ever permanently destroyed by a user action. Clients, documents, and users are soft-deleted with a deleted_at timestamp. Recovery is always possible for admins.",
    badge: "Always recoverable",
    badgeColor: "bg-ember-500/10 text-ember-600 border-ember-500/20",
  },
];

const architecture = [
  {
    layer: "Browser",
    items: ["HTTPS only", "httpOnly cookies (no JS access to refresh token)", "CSP headers", "XSS protection via React"],
    color: "border-indigo-500/30 bg-indigo-500/5",
    dot: "bg-indigo-500",
  },
  {
    layer: "API (Express)",
    items: ["Helmet.js security headers", "CORS restricted to frontend origin", "Rate limiting (per route)", "Joi request validation"],
    color: "border-mint-500/30 bg-mint-500/5",
    dot: "bg-mint-500",
  },
  {
    layer: "Database (PostgreSQL)",
    items: ["Row-Level Security on every table", "app.current_firm_id set per request", "No raw SQL with user input", "Parameterised queries via Knex"],
    color: "border-ember-500/30 bg-ember-500/5",
    dot: "bg-ember-500",
  },
  {
    layer: "Storage (AWS S3)",
    items: ["Presigned URLs (15 min expiry)", "Bucket policy: private by default", "Per-firm key prefixes", "Presigned download URLs for exports"],
    color: "border-indigo-500/30 bg-indigo-500/5",
    dot: "bg-indigo-500",
  },
];

const SecurityPage = () => (
  <PublicLayout>
    {/* Hero */}
    <section className="relative overflow-hidden">
      <div className="hero-gradient absolute inset-0" />
      <div className="orb orb-2 absolute" style={{ top: "5%", right: "5%" }} />
      <div className="orb orb-3 absolute" style={{ bottom: "15%", left: "8%" }} />

      <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-16 sm:px-6 sm:pt-20 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="animate-fade-in-up inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-bold tracking-wide text-indigo-600">
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
            Security & Trust
          </div>
          <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight text-ink-900 opacity-0 animate-fade-in-up-delay-1 sm:text-5xl">
            Your clients' data is{" "}
            <span className="gradient-text-accent">safe by design</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink-600 opacity-0 animate-fade-in-up-delay-2">
            Financial data demands serious security. Every architectural decision in Verax was made with isolation, auditability, and recoverability as first-class requirements.
          </p>
        </div>

        {/* Trust indicators */}
        <div className="mx-auto mt-14 grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { icon: "🔒", label: "End-to-end encryption" },
            { icon: "🏢", label: "Multi-tenant isolation" },
            { icon: "📋", label: "Full audit trail" },
            { icon: "🇮🇳", label: "India data residency" },
          ].map((t) => (
            <div key={t.label} className="rounded-2xl border border-[#e7dcc8] bg-white/70 p-4 text-center backdrop-blur-sm">
              <div className="text-2xl">{t.icon}</div>
              <div className="mt-2 text-xs font-bold text-ink-700">{t.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Security pillars */}
    <section className="section-padding">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-mint-500">Security pillars</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
            Six layers of protection
          </h2>
          <p className="mt-4 text-base text-ink-600">
            Not bolt-on security. Each layer is part of the core architecture.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {pillars.map((p, i) => (
            <article key={p.title} className={`hover-lift card-shine rounded-2xl border border-[#e7dcc8] bg-white/80 p-6 backdrop-blur-sm stagger-${(i % 5) + 1}`}>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-ink-900/5 text-ink-700">
                {p.icon}
              </div>
              <div className="mt-4 flex items-start justify-between gap-2">
                <h3 className="text-base font-bold text-ink-900">{p.title}</h3>
                <span className={`flex-shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${p.badgeColor}`}>
                  {p.badge}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">{p.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>

    {/* Architecture breakdown */}
    <section className="section-padding bg-ink-900 relative overflow-hidden">
      <div className="absolute left-1/4 top-0 h-64 w-64 rounded-full bg-mint-500/8 blur-[100px]" />
      <div className="absolute bottom-0 right-1/4 h-48 w-48 rounded-full bg-indigo-500/8 blur-[80px]" />

      <div className="relative mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-mint-400">Architecture</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Security at every layer
          </h2>
          <p className="mt-4 text-base text-sand-100/60">
            From the browser to the database, each layer adds independent safeguards.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {architecture.map((layer, i) => (
            <div key={layer.layer} className={`rounded-2xl border p-5 ${layer.color} stagger-${i + 1}`}>
              <div className="flex items-center gap-2 mb-4">
                <span className={`h-2.5 w-2.5 rounded-full ${layer.dot}`} />
                <span className="text-sm font-extrabold text-ink-900">{layer.layer}</span>
              </div>
              <ul className="space-y-2">
                {layer.items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-xs text-ink-700">
                    <svg className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-mint-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Data handling */}
    <section className="section-padding">
      <div className="mx-auto max-w-7xl">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-mint-500">Data handling</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
              What we store. What we don't.
            </h2>
            <div className="mt-8 space-y-5">
              {[
                {
                  title: "Document files",
                  detail: "Stored in AWS S3 with private ACL. Accessible only via presigned URLs with time limits. Never served through our application servers.",
                  icon: "📄",
                },
                {
                  title: "Extracted data",
                  detail: "Stored as JSONB in PostgreSQL, scoped to your firm by RLS. Editable during review. Deleted on firm closure after 30-day grace period.",
                  icon: "🗃",
                },
                {
                  title: "Passwords",
                  detail: "Hashed with bcrypt (12 rounds). We never store plaintext passwords. Password reset requires re-registration (email-based flow coming soon).",
                  icon: "🔑",
                },
                {
                  title: "Session tokens",
                  detail: "Refresh tokens stored as SHA-256 hashes, not plaintext. Token metadata (user-agent, IP, expiry) stored for security review. Revocable at any time.",
                  icon: "🎫",
                },
              ].map((item) => (
                <div key={item.title} className="flex gap-4 rounded-xl border border-[#e7dcc8] bg-white/80 p-4">
                  <div className="text-2xl">{item.icon}</div>
                  <div>
                    <div className="text-sm font-bold text-ink-900">{item.title}</div>
                    <div className="mt-1 text-sm leading-relaxed text-ink-600">{item.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-mint-500">Tenant isolation</p>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-ink-900">
              Your data is invisible to other firms
            </h2>
            <p className="mt-4 text-base leading-relaxed text-ink-600">
              Multi-tenancy in Verax is not enforced by application code — it's enforced by the database itself. PostgreSQL Row-Level Security policies run inside the database engine before any query returns data.
            </p>
            <p className="mt-4 text-base leading-relaxed text-ink-600">
              Even if there were a bug in application routing that sent the wrong firm_id, the database would return zero rows. No workaround exists at the application layer.
            </p>

            <div className="mt-8 rounded-2xl border border-[#e7dcc8] bg-sand-50/60 p-5">
              <div className="mb-3 text-xs font-bold uppercase tracking-widest text-ink-500">RLS policy example</div>
              <pre className="overflow-x-auto rounded-lg bg-ink-900 p-4 text-xs leading-relaxed text-mint-400">
{`CREATE POLICY firm_isolation ON documents
  USING (
    firm_id = current_setting(
      'app.current_firm_id'
    )::uuid
  );`}
              </pre>
              <p className="mt-3 text-xs text-ink-500">
                Every table has an equivalent policy. Every request sets <code className="font-mono text-ink-700">app.current_firm_id</code> before executing queries.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* Responsible disclosure */}
    <section className="section-padding bg-sand-100/40">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-mint-500">Responsible disclosure</p>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
          Found a vulnerability?
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-base text-ink-600">
          We take security reports seriously. If you discover a vulnerability, please reach out privately before public disclosure. We aim to acknowledge reports within 24 hours and resolve confirmed issues within 7 days.
        </p>
        <div className="mt-8 inline-flex items-center gap-3 rounded-2xl border border-[#e7dcc8] bg-white/80 px-6 py-4 shadow-soft">
          <svg className="h-5 w-5 text-ink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
          <span className="font-mono text-sm font-semibold text-ink-900">security@verax.app</span>
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
            <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
              Secure by default. Free to start.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-sand-100/70">
              All plans include every security feature described on this page. Security is not a premium add-on.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link to="/signup" className="btn-accent w-full px-10 py-3 text-sm sm:w-auto">
                Create free account
              </Link>
              <Link to="/pricing" className="w-full rounded-xl border border-white/20 px-10 py-3 text-center text-sm font-semibold text-white transition hover:bg-white/10 sm:w-auto">
                View pricing
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  </PublicLayout>
);

export default SecurityPage;
