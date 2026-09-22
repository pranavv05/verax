import PublicLayout from "../components/layout/PublicLayout";
import ClosingCTA from "../components/marketing/ClosingCTA";
import { Section, SectionHead, Eyebrow, Tick, Rail } from "../components/marketing/ledger";
import { Reveal } from "../components/public/motion";

const pillars = [
  {
    title: "Row-Level Security",
    badge: "Database-enforced",
    description:
      "PostgreSQL RLS enforces tenant isolation at the database layer. Every query automatically filters by your firm_id — no application-level gate that can be bypassed."
  },
  {
    title: "JWT + Refresh Token Chain",
    badge: "Chain rotation",
    description:
      "Short-lived access tokens (15 minutes) with httpOnly refresh cookies (7 days). Refresh tokens rotate on every use. Reuse of a revoked token invalidates the entire session chain."
  },
  {
    title: "Magic Link Security",
    badge: "64-char hex token",
    description:
      "Client upload links are 64-character cryptographically random hex tokens. They expire after 24 hours and single-rotate — a new token is issued automatically after each successful use."
  },
  {
    title: "S3 Direct Upload",
    badge: "Zero backend touch",
    description:
      "Document files never pass through our backend servers. The browser uploads directly to S3 via presigned PUT URLs. File bytes are never logged, cached, or processed by application code."
  },
  {
    title: "Complete Audit Trail",
    badge: "Immutable logs",
    description:
      "Every critical action is logged: document uploads, AI extraction, approvals, exports, team changes, and settings updates. Logs include user ID, timestamp, entity, and metadata."
  },
  {
    title: "Soft Deletes Only",
    badge: "Always recoverable",
    description:
      "No data is ever permanently destroyed by a user action. Clients, documents, and users are soft-deleted with a deleted_at timestamp. Recovery is always possible for admins."
  }
];

const architecture = [
  {
    layer: "Browser",
    items: ["HTTPS only", "httpOnly cookies (no JS access to refresh token)", "CSP headers", "XSS protection via React"]
  },
  {
    layer: "API (Express)",
    items: ["Helmet.js security headers", "CORS restricted to frontend origin", "Rate limiting (per route)", "Joi request validation"]
  },
  {
    layer: "Database (PostgreSQL)",
    items: ["Row-Level Security on every table", "app.current_firm_id set per request", "No raw SQL with user input", "Parameterised queries via Knex"]
  },
  {
    layer: "Storage (AWS S3)",
    items: ["Presigned URLs (time-limited)", "Bucket policy: private by default", "Per-firm key prefixes", "Presigned download URLs for exports"]
  }
];

const dataHandling = [
  {
    title: "Document files",
    detail:
      "Stored in AWS S3 with private ACL. Accessible only via presigned URLs with time limits. Never served through our application servers."
  },
  {
    title: "Extracted data",
    detail:
      "Stored as JSONB in PostgreSQL, scoped to your firm by RLS. Editable during review, locked once approved."
  },
  {
    title: "Passwords",
    detail:
      "Hashed with bcrypt (12 rounds). We never store plaintext passwords. Self-service, email-based password reset is available from the login page."
  },
  {
    title: "Session tokens",
    detail:
      "Refresh tokens stored as SHA-256 hashes, not plaintext. Token metadata (user-agent, IP, expiry) stored for security review. Revocable at any time."
  }
];

const SecurityPage = () => (
  <PublicLayout>
    {/* Hero */}
    <Section className="pt-20 sm:pt-28">
      <Reveal className="mx-auto max-w-[46rem] text-center">
        <Eyebrow className="justify-center">Security &amp; trust</Eyebrow>
        <h1 className="vx-display-xl mt-6">
          Your clients&apos; data is
          <br />
          safe by design.
        </h1>
        <p className="vx-body mx-auto mt-7 max-w-[36rem]">
          Financial data demands serious security. Every architectural decision in
          Verax was made with isolation, auditability, and recoverability as
          first-class requirements.
        </p>
      </Reveal>

      <Reveal delay={0.1} className="mx-auto mt-14 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
        {["Tenant isolation by database", "Full audit trail", "Presigned, private storage", "Soft deletes only"].map((label) => (
          <div key={label} className="rounded-xl border border-hairline bg-surface px-3 py-4 text-center">
            <p className="text-[0.75rem] font-medium leading-snug text-carbon-600">{label}</p>
          </div>
        ))}
      </Reveal>
    </Section>

    {/* Security pillars */}
    <Section>
      <SectionHead
        eyebrow="Security pillars"
        title="Six layers of protection"
        body="Not bolt-on security. Each layer is part of the core architecture."
        align="center"
      />

      <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {pillars.map((p, i) => (
          <Reveal key={p.title} delay={0.04 * (i % 3)}>
            <article className="h-full rounded-2xl border border-hairline bg-surface p-6">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-[0.9375rem] font-bold text-carbon-900">{p.title}</h3>
                <span className="flex flex-none items-center gap-1.5 rounded-full border border-hairline bg-well px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-carbon-600">
                  <Tick className="text-verify-600" />
                  {p.badge}
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-carbon-500">{p.description}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </Section>

    {/* Architecture breakdown */}
    <Section dark>
      <SectionHead
        eyebrow="Architecture"
        title="Security at every layer"
        body="From the browser to the database, each layer adds independent safeguards."
        align="center"
        dark
      />

      <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {architecture.map((layer, i) => (
          <Reveal key={layer.layer} delay={0.04 * i}>
            <div className="h-full rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="mb-4 flex items-center gap-2">
                <span aria-hidden="true" className="h-[7px] w-[7px] flex-none bg-brand-400" />
                <span className="text-sm font-bold text-white">{layer.layer}</span>
              </div>
              <ul className="space-y-2.5">
                {layer.items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-xs leading-relaxed text-carbon-300">
                    <Tick className="mt-0.5 text-verify-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>

    {/* Data handling */}
    <Section>
      <div className="grid items-start gap-12 lg:grid-cols-2">
        <Reveal>
          <Eyebrow>Data handling</Eyebrow>
          <h2 className="vx-h2-xl mt-5">What we store. What we don&apos;t.</h2>
          <div className="mt-8 space-y-4">
            {dataHandling.map((item) => (
              <div key={item.title} className="rounded-xl border border-hairline bg-surface p-4">
                <div className="text-sm font-bold text-carbon-900">{item.title}</div>
                <div className="mt-1.5 text-sm leading-relaxed text-carbon-500">{item.detail}</div>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <Eyebrow>Tenant isolation</Eyebrow>
          <h2 className="vx-h2-xl mt-5 text-[1.75rem]">Your data is invisible to other firms</h2>
          <p className="vx-body mt-6 max-w-[34rem]">
            Multi-tenancy in Verax is not enforced by application code — it&apos;s
            enforced by the database itself. PostgreSQL Row-Level Security
            policies run inside the database engine before any query returns
            data.
          </p>
          <p className="vx-body mt-4 max-w-[34rem]">
            Even if there were a bug in application routing that sent the wrong
            firm_id, the database would return zero rows. No workaround exists
            at the application layer.
          </p>

          <div className="mt-8 rounded-2xl border border-hairline bg-well p-5">
            <div className="vx-index mb-3">RLS policy example</div>
            <pre className="overflow-x-auto rounded-lg bg-carbon-950 p-4 text-xs leading-relaxed text-verify-400">
{`CREATE POLICY firm_isolation ON documents
  USING (
    firm_id = current_setting(
      'app.current_firm_id'
    )::uuid
  );`}
            </pre>
            <p className="mt-3 text-xs text-carbon-500">
              Every table has an equivalent policy. Every request sets{" "}
              <code className="vx-mono text-carbon-700">app.current_firm_id</code>{" "}
              before executing queries.
            </p>
          </div>
        </Reveal>
      </div>
    </Section>

    {/* Responsible disclosure */}
    <Section className="border-y border-hairline bg-well">
      <Reveal className="mx-auto max-w-[38rem] text-center">
        <Eyebrow className="justify-center">Responsible disclosure</Eyebrow>
        <h2 className="vx-h2-xl mt-5 text-[2rem]">Found a vulnerability?</h2>
        <p className="vx-body mx-auto mt-5 max-w-[32rem]">
          We take security reports seriously. If you discover a vulnerability,
          please reach out privately before public disclosure. We aim to
          acknowledge reports within 24 hours and resolve confirmed issues
          within 7 days.
        </p>
        <Rail className="mx-auto my-8 w-20" />
        <a
          href="mailto:verax.hello@gmail.com"
          className="vx-mono inline-flex items-center gap-2 rounded-full border border-hairline bg-surface px-5 py-3 text-sm font-medium text-carbon-900 transition-colors hover:border-hairline-strong"
        >
          verax.hello@gmail.com
        </a>
      </Reveal>
    </Section>

    <ClosingCTA />
  </PublicLayout>
);

export default SecurityPage;
