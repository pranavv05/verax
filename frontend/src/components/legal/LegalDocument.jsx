import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import PublicLayout from "../layout/PublicLayout";
import { Kicker } from "../marketing/v3";

/**
 * Shared layout for /privacy and /terms, after Stripe's legal pages: a switcher
 * between the two documents, a sticky table of contents that follows the
 * reader (scroll-spy via IntersectionObserver), and numbered sections set in a
 * comfortable reading measure.
 *
 * `sections` is [{ id, title, body }] where body is JSX; each section is
 * anchor-linkable (/privacy#retention).
 */

const DOCS = [
  { to: "/privacy", label: "Privacy Policy" },
  { to: "/terms", label: "Terms of Service" }
];

export const EMAIL = "verax.hello@gmail.com";

/* Prose atoms, so the two documents read identically. */
export const P = ({ children }) => <p className="mt-4 first:mt-0">{children}</p>;
export const List = ({ items }) => (
  <ul className="mt-4 space-y-2.5">
    {items.map((item, index) => (
      <li key={index} className="flex gap-3">
        <span aria-hidden="true" className="mt-[0.65em] h-1 w-1 flex-none rounded-full bg-carbon-400" />
        <span>{item}</span>
      </li>
    ))}
  </ul>
);
export const Strong = ({ children }) => <strong className="font-medium text-carbon-900">{children}</strong>;
export const Mail = () => (
  <a
    href={`mailto:${EMAIL}`}
    className="text-brand-600 underline decoration-brand-600/30 underline-offset-2 hover:decoration-brand-600"
  >
    {EMAIL}
  </a>
);

const useActiveSection = (ids) => {
  const [active, setActive] = useState(ids[0]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      // A band across the upper part of the viewport decides the "current" section.
      { rootMargin: "-96px 0px -60% 0px" }
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [ids]);

  return active;
};

const LegalDocument = ({ title, updated, intro, sections }) => {
  const { pathname } = useLocation();
  const ids = useMemo(() => sections.map((s) => s.id), [sections]);
  const active = useActiveSection(ids);

  useEffect(() => {
    document.title = `${title} — Verax`;
  }, [title]);

  return (
    <PublicLayout>
      <div className="vx-shell pb-24 pt-16 lg:pb-32 lg:pt-24">
        {/* Header */}
        <header className="max-w-[46rem]">
          <Kicker>Legal</Kicker>
          <h1 className="mt-5 font-inter text-[clamp(2.25rem,4.5vw,3.25rem)] font-normal leading-[1.06] tracking-[-0.035em] text-carbon-900">
            {title}
          </h1>
          <p className="mt-4 text-[0.9375rem] text-carbon-400">Last updated {updated}</p>
          <p className="mt-6 text-[1.0625rem] leading-[1.7] text-carbon-600">{intro}</p>

          <nav
            aria-label="Legal documents"
            className="mt-8 inline-flex rounded-full border border-carbon-900/[0.08] bg-white p-1"
          >
            {DOCS.map((doc) => {
              const current = pathname === doc.to;
              return (
                <Link
                  key={doc.to}
                  to={doc.to}
                  aria-current={current ? "page" : undefined}
                  className={`rounded-full px-4 py-1.5 text-[0.875rem] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                    current ? "bg-carbon-900 text-white" : "text-carbon-500 hover:text-carbon-900"
                  }`}
                >
                  {doc.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <div className="mt-16 grid gap-12 border-t border-hairline pt-12 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-20">
          {/* Contents */}
          <aside className="hidden lg:block">
            <nav aria-label="On this page" className="sticky top-28">
              <p className="text-[0.8125rem] font-medium text-carbon-400">On this page</p>
              <ol className="mt-4 space-y-1 border-l border-hairline">
                {sections.map((section, index) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className={`-ml-px block border-l py-1.5 pl-4 text-[0.875rem] leading-snug transition-colors ${
                        active === section.id
                          ? "border-brand-500 text-carbon-900"
                          : "border-transparent text-carbon-500 hover:text-carbon-900"
                      }`}
                    >
                      <span className="mr-2 tabular-nums text-carbon-400">{String(index + 1).padStart(2, "0")}</span>
                      {section.title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </aside>

          {/* Body */}
          <article className="max-w-[44rem] text-[1rem] leading-[1.75] text-carbon-600">
            {sections.map((section, index) => (
              <section
                key={section.id}
                id={section.id}
                className="scroll-mt-28 border-b border-hairline py-10 first:pt-0 last:border-0"
              >
                <h2 className="flex items-baseline gap-3 font-inter text-[1.375rem] font-normal tracking-[-0.02em] text-carbon-900">
                  <span className="text-[0.875rem] tabular-nums text-carbon-400">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {section.title}
                </h2>
                <div className="mt-4">{section.body}</div>
              </section>
            ))}

            <div className="mt-6 rounded-2xl border border-carbon-900/[0.07] bg-white p-6">
              <p className="text-[1.0625rem] font-medium text-carbon-900">Questions about this document?</p>
              <p className="mt-1.5 text-[0.9375rem] text-carbon-500">
                Write to <Mail /> and a person on the team will reply.
              </p>
            </div>
          </article>
        </div>
      </div>
    </PublicLayout>
  );
};

export default LegalDocument;
