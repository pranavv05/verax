import PublicLayout from "../components/layout/PublicLayout";
import ClosingCTA from "../components/marketing/ClosingCTA";
import PageHero from "../components/marketing/PageHero";
import Cta from "../components/marketing/Cta";
import { Band, Beam, GlowCard, Heading, WindowChrome } from "../components/marketing/v3";
import { Tick } from "../components/marketing/ledger";
import { Reveal, RevealGroup, RevealItem } from "../components/public/motion";

/**
 * /security — every statement here is checked against the code
 * (DESIGN_SYSTEM.md §9): bcrypt cost 12 (auth.service.js), SHA-256 refresh
 * token hashes with family revocation on reuse (token-utils.js,
 * auth.service.js), 30-day resettable upload links (env.js defaults), Helmet
 * + CORS to FRONTEND_URL + per-route rate limits (app.js, routes/), per-firm
 * S3 key prefixes (documents.service.js, exports.service.js), extractions
 * locked once approved (extractions.service.js) and the RLS policy quoted
 * verbatim from the initial schema migration.
 */

const TRUST = [
  "Tenant isolation in the database",
  "Every action on the record",
  "Private, presigned storage",
  "Soft deletes, erasure on request"
];

const PILLARS = [
  {
    title: "Row-level security",
    badge: "Database-enforced",
    body: "PostgreSQL row-level security isolates every firm at the database layer. Each request runs with your firm's id set, and every table's policy filters on it — not an application check that could be skipped.",
    glyph: (
      <>
        <ellipse cx="10" cy="5" rx="6" ry="2.2" />
        <path d="M4 5v10c0 1.2 2.7 2.2 6 2.2s6-1 6-2.2V5M4 10c0 1.2 2.7 2.2 6 2.2s6-1 6-2.2" />
      </>
    )
  },
  {
    title: "Rotating sessions",
    badge: "Reuse detection",
    body: "Access tokens last 15 minutes; refresh tokens live in an httpOnly cookie for 7 days and rotate on every use. Presenting a revoked refresh token revokes the whole token family.",
    glyph: <path d="M15.5 8A5.8 5.8 0 0 0 5 6.3M4.5 12A5.8 5.8 0 0 0 15 13.7M5 3v3.3h3.3M15 17v-3.3h-3.3" />
  },
  {
    title: "Secure upload links",
    badge: "64-character token",
    body: "Client upload links carry 64-character random tokens and expire after 30 days. Your firm can reset a link at any time, and every copy sent earlier stops working immediately.",
    glyph: (
      <>
        <path d="M8.5 11.5a3 3 0 0 0 4.2 0l2.6-2.6a3 3 0 0 0-4.2-4.2l-.9.9" />
        <path d="M11.5 8.5a3 3 0 0 0-4.2 0l-2.6 2.6a3 3 0 0 0 4.2 4.2l.9-.9" />
      </>
    )
  },
  {
    title: "Direct-to-storage uploads",
    badge: "Never through our API",
    body: "Files go from the browser straight to private storage through short-lived presigned links. They never pass through our API servers; the processing service reads them from storage to extract the data.",
    glyph: <path d="M10 13.5V3.5M6.5 7 10 3.5 13.5 7M4 12.5v3a1.5 1.5 0 0 0 1.5 1.5h9a1.5 1.5 0 0 0 1.5-1.5v-3" />
  },
  {
    title: "Complete audit trail",
    badge: "Append-only",
    body: "Uploads, extraction approvals, exports, invitations and settings changes are logged with the user, the time, the record and what changed. The app only ever adds entries.",
    glyph: <path d="M4 5h12M4 10h12M4 15h7" />
  },
  {
    title: "Soft deletes",
    badge: "Erasure on request",
    body: "Deleting a client, document or user in the app hides it with a deleted_at timestamp rather than destroying it, so a mistaken delete isn't a lost record. Permanent erasure happens when you ask for it.",
    glyph: <path d="M4.5 6h11M8 6V4.5h4V6M6 6l.7 10h6.6L14 6" />
  }
];

const LAYERS = [
  {
    layer: "Browser",
    items: [
      "Refresh token in an httpOnly cookie",
      "Content-Security-Policy and HSTS headers",
      "React's output escaping against XSS"
    ]
  },
  {
    layer: "API",
    items: [
      "Helmet security headers",
      "CORS limited to the Verax app's origin",
      "Rate limits on sensitive routes",
      "Request validation with Joi schemas"
    ]
  },
  {
    layer: "Database",
    items: ["Row-level security on every table", "Firm id set on every request", "Parameterised queries throughout"]
  },
  {
    layer: "Storage",
    items: [
      "Objects reached only through presigned URLs",
      "Per-firm key prefixes",
      "Time-limited presigned uploads and downloads"
    ]
  }
];

const DATA = [
  {
    title: "Document files",
    body: "Stored in private cloud storage under your firm's own prefix, reachable only through time-limited presigned links."
  },
  {
    title: "Extracted data",
    body: "Stored in PostgreSQL and scoped to your firm by row-level security. Editable during review, locked once approved — reprocess a document to change it."
  },
  {
    title: "Passwords",
    body: "Hashed with bcrypt at cost 12; never stored in plain text. Password reset is self-service, by email, from the login page."
  },
  {
    title: "Session tokens",
    body: "Refresh tokens are stored as SHA-256 hashes, with the user-agent, IP address and expiry kept for security review."
  }
];

const POLICY = `CREATE POLICY documents_isolation_policy
  ON documents
  FOR ALL
  USING (firm_id = app.current_firm_id())
  WITH CHECK (firm_id = app.current_firm_id());`;

const SecurityPage = () => (
  <PublicLayout>
    <PageHero
      kicker="Security"
      title="Your clients' data,"
      accent="safe by design."
      lead="Financial data demands serious security. Isolation, auditability and recoverability were built into Verax's architecture from the first table."
    >
      <ul className="mx-auto flex max-w-[56rem] flex-wrap justify-center gap-2.5">
        {TRUST.map((label) => (
          <li
            key={label}
            className="flex items-center gap-2 rounded-full border border-white/80 bg-white/70 px-4 py-2 text-[13.5px] font-medium text-carbon-700 shadow-[0_8px_24px_-18px_rgba(38,30,110,0.5)] backdrop-blur"
          >
            <Tick className="text-verify-600" />
            {label}
          </li>
        ))}
      </ul>
    </PageHero>

    {/* Pillars */}
    <Band>
      <Heading kicker="Six layers" title="Protection built into the architecture," tint="not bolted on." />
      <RevealGroup className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" stagger={0.07}>
        {PILLARS.map((pillar) => (
          <RevealItem key={pillar.title} className="h-full">
            <GlowCard className="h-full p-7">
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-carbon-900/[0.07] bg-white text-brand-600 shadow-[0_1px_2px_rgba(14,16,19,0.06)]">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {pillar.glyph}
                  </svg>
                </span>
                <span className="rounded-full bg-verify-500/10 px-2.5 py-1 text-[11.5px] font-medium text-verify-700">
                  {pillar.badge}
                </span>
              </div>
              <h3 className="mt-5 text-[1.0625rem] font-medium tracking-[-0.015em] text-carbon-900">{pillar.title}</h3>
              <p className="mt-2 text-[0.9375rem] leading-[1.65] text-carbon-500">{pillar.body}</p>
            </GlowCard>
          </RevealItem>
        ))}
      </RevealGroup>
    </Band>

    {/* Layers: the page's one dark band */}
    <Band dark aurora>
      <Heading
        kicker="Architecture"
        title="Safeguards at every layer,"
        tint="from the browser to the database."
        align="center"
        dark
      />
      <div className="mt-16 grid items-stretch gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
        {LAYERS.map((layer, index) => (
          <div key={layer.layer} className="contents">
            <Reveal delay={0.06 * index} className="h-full">
              <GlowCard dark className="h-full p-6">
                <p className="text-[0.8125rem] font-medium tabular-nums text-carbon-400">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-1 text-[1.125rem] font-medium tracking-[-0.015em] text-white">{layer.layer}</h3>
                <ul className="mt-5 space-y-3">
                  {layer.items.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-[0.875rem] leading-[1.55] text-carbon-300">
                      <Tick className="mt-[5px] text-verify-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              </GlowCard>
            </Reveal>
            {index < LAYERS.length - 1 ? <Beam dark delay={index * 0.4} className="lg:w-8" /> : null}
          </div>
        ))}
      </div>
    </Band>

    {/* Data handling + isolation */}
    <Band>
      <div className="grid items-start gap-14 lg:grid-cols-2 lg:gap-20">
        <div>
          <Heading kicker="Data handling" title="What we store," tint="and how." />
          <Reveal delay={0.08} className="mt-10 divide-y divide-carbon-900/[0.07] border-y border-carbon-900/[0.07]">
            {DATA.map((item) => (
              <div key={item.title} className="py-5">
                <h3 className="text-[1rem] font-medium text-carbon-900">{item.title}</h3>
                <p className="mt-1.5 text-[0.9375rem] leading-[1.65] text-carbon-500">{item.body}</p>
              </div>
            ))}
          </Reveal>
        </div>

        <div>
          <Heading kicker="Tenant isolation" title="Your data is invisible" tint="to every other firm." />
          <Reveal delay={0.08} className="mt-6 space-y-4 text-[1rem] leading-[1.7] text-carbon-500">
            <p>
              Isolation isn&apos;t left to application code. PostgreSQL row-level security policies run inside the
              database engine before any query returns a row.
            </p>
            <p>Even if a bug sent the wrong firm id, the database would return nothing that belongs to another firm.</p>
          </Reveal>
          <Reveal
            delay={0.14}
            className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-carbon-950 shadow-[0_30px_70px_-40px_rgba(14,16,19,0.8)]"
          >
            <WindowChrome label="migrations · initial schema" dark />
            <pre className="overflow-x-auto p-5 text-[0.8125rem] leading-[1.7]">
              <code className="vx-mono text-carbon-200">{POLICY}</code>
            </pre>
            <p className="border-t border-white/10 px-5 py-3.5 text-[0.8125rem] text-carbon-400">
              Every table has an equivalent policy, and every request sets the firm id before it queries.
            </p>
          </Reveal>
        </div>
      </div>
    </Band>

    {/* Responsible disclosure */}
    <Band className="!pt-0">
      <Reveal>
        <GlowCard className="mx-auto max-w-[52rem] p-8 text-center sm:p-12">
          <h2 className="font-inter text-[clamp(1.5rem,2.6vw,2rem)] font-normal tracking-[-0.03em] text-carbon-900">
            Found a vulnerability? <span className="text-carbon-400">Tell us privately.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-[34rem] text-[1rem] leading-[1.7] text-carbon-500">
            We take security reports seriously. Please reach out before any public disclosure — we aim to acknowledge
            reports within 24 hours and resolve confirmed issues within 7 days.
          </p>
          <div className="mt-8 flex justify-center">
            <Cta href="mailto:verax.hello@gmail.com" variant="quiet">
              verax.hello@gmail.com
            </Cta>
          </div>
        </GlowCard>
      </Reveal>
    </Band>

    <ClosingCTA />
  </PublicLayout>
);

export default SecurityPage;
