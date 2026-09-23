import { useState } from "react";
import PublicLayout from "../components/layout/PublicLayout";
import ClosingCTA from "../components/marketing/ClosingCTA";
import PageHero from "../components/marketing/PageHero";
import ProofBand from "../components/marketing/ProofBand";
import Cta from "../components/marketing/Cta";
import { Band, Beam, GlowCard, Heading } from "../components/marketing/v3";
import { Reveal, RevealGroup, RevealItem } from "../components/public/motion";

/**
 * /about — who builds Verax and why (DESIGN_SYSTEM.md).
 *
 * The founder photo is read from `public/team/pranav-vatsa.jpg`; until that
 * file exists the card falls back to initials, so the page never shows a
 * broken image.
 */

const FOUNDER_PHOTO = "/team/pranav-vatsa.jpg";

const PIPELINE = ["Upload", "Read", "Check", "Review", "Tally XML"];

const VALUES = [
  {
    title: "Speed without sacrifice",
    body: "Automation should make work faster, not riskier. We automate the tedious parts and keep CAs in control of every approval.",
    glyph: <path d="M3 10h8.5M8.5 5.5 13 10l-4.5 4.5M15.5 4v12" />
  },
  {
    title: "Security by architecture",
    body: "Data isolation isn't a setting — the database enforces it. PostgreSQL row-level security means no firm can reach another firm's records.",
    glyph: (
      <>
        <rect x="4" y="9" width="12" height="8.5" rx="2" />
        <path d="M7 9V6.5a3 3 0 0 1 6 0V9" />
      </>
    )
  },
  {
    title: "India-first product thinking",
    body: "GSTIN validation, TallyPrime compatibility, Indian TDS sections and rupee formatting. We build for Indian CA practice, not a generic global market.",
    glyph: (
      <>
        <circle cx="10" cy="10" r="6.5" />
        <path d="M3.5 10h13M10 3.5c2 2 2.8 4.2 2.8 6.5S12 14.5 10 16.5M10 3.5C8 5.5 7.2 7.7 7.2 10s.8 4.5 2.8 6.5" />
      </>
    )
  },
  {
    title: "Accuracy over automation",
    body: "For numbers, rules come before models. Bank statement amounts and dates are read straight from the statement's own table — AI only suggests the ledger — and nothing is exported until a person approves it.",
    glyph: <path d="m4.5 10.5 3.5 3.5 7.5-8" />
  }
];

// The initials always render; the photo sits on top, invisible until it has
// actually loaded, and is removed if it fails — so a missing file never shows
// the browser's broken-image icon, not even for a frame.
const FounderPhoto = () => {
  const [state, setState] = useState("loading"); // loading · loaded · failed

  return (
    <span className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-[22px] bg-gradient-to-br from-brand-500 via-sky-500 to-verify-500 font-inter text-[1.75rem] font-semibold tracking-[-0.02em] text-white shadow-[0_20px_40px_-20px_rgba(38,30,110,0.6)]">
      <span aria-hidden={state === "loaded" ? "true" : undefined}>PV</span>
      {state !== "failed" ? (
        <img
          src={FOUNDER_PHOTO}
          alt={state === "loaded" ? "Pranav Vatsa" : ""}
          width="96"
          height="96"
          loading="lazy"
          onLoad={(event) => setState(event.currentTarget.naturalWidth > 0 ? "loaded" : "failed")}
          onError={() => setState("failed")}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
            state === "loaded" ? "opacity-100" : "opacity-0"
          }`}
        />
      ) : null}
    </span>
  );
};

const AboutPage = () => (
  <PublicLayout>
    <PageHero
      kicker="About Verax"
      title="Built for how CA firms"
      accent="actually work."
      lead="Verax exists because CA firms deserve tools that understand Indian accounting — not generic software retrofitted with a GSTIN field."
      actions={
        <>
          <Cta href="/#demo" size="lg">
            Book a demo
          </Cta>
          <Cta to="/features" variant="glass" size="lg">
            See the product
          </Cta>
        </>
      }
    />

    <ProofBand />

    {/* Mission */}
    <Band aurora>
      <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-20">
        <Heading kicker="Our mission" title="Make data entry extinct" tint="for CA firms." />
        <Reveal delay={0.1} className="space-y-5 text-[1.0625rem] leading-[1.75] text-carbon-500">
          <p>
            A mid-size CA firm in India processes hundreds of documents every month. Invoices arrive as phone photos.
            Bank statements come as PDF exports. Each one gets retyped into Tally by hand.
          </p>
          <p>
            That isn&apos;t accounting work — it&apos;s data entry. It&apos;s repetitive and error-prone, and it keeps
            qualified people away from the advisory work that actually grows their clients&apos; businesses.
          </p>
          <p className="text-carbon-900">
            Verax automates the pipeline. The CA still reviews and approves everything — but the typing, the GSTIN
            lookups and the tax maths are gone.
          </p>
        </Reveal>
      </div>

      <Reveal delay={0.15} className="mt-16">
        <ol className="mx-auto flex max-w-[56rem] flex-wrap items-center justify-center gap-x-1.5 gap-y-2.5 lg:flex-nowrap lg:gap-0">
          {PIPELINE.map((stage, index) => (
            <li key={stage} className="flex items-center gap-1.5 lg:gap-0">
              <span className="whitespace-nowrap rounded-full border border-white/80 bg-white/80 px-4 py-2 text-[14px] font-medium text-carbon-800 shadow-[0_8px_24px_-18px_rgba(38,30,110,0.5)] backdrop-blur">
                {stage}
              </span>
              {index < PIPELINE.length - 1 ? (
                <>
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    fill="none"
                    aria-hidden="true"
                    className="text-carbon-300 lg:hidden"
                  >
                    <path
                      d="M3 1.5 6.5 5 3 8.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <Beam delay={index * 0.4} className="hidden w-16 lg:flex" />
                </>
              ) : null}
            </li>
          ))}
        </ol>
        <p className="mt-5 text-center text-[0.875rem] text-carbon-400">
          A person approves every voucher before it reaches Tally.
        </p>
      </Reveal>
    </Band>

    {/* Team */}
    <Band>
      <Heading kicker="The team" title="Who builds Verax." align="center" />
      <Reveal delay={0.1} className="mx-auto mt-14 max-w-[26rem]">
        <GlowCard className="p-8 text-center">
          <div className="flex justify-center">
            <FounderPhoto />
          </div>
          <h3 className="mt-6 font-inter text-[1.25rem] font-medium tracking-[-0.02em] text-carbon-900">
            Pranav Vatsa
          </h3>
          <p className="mt-1 text-[0.875rem] font-medium">
            <span className="vx-hero-gradient">Founder</span>
          </p>
          <p className="mt-4 text-[0.9375rem] leading-[1.65] text-carbon-500">
            Building Verax to take data entry out of day-to-day CA practice.
          </p>
          <a
            href="mailto:verax.hello@gmail.com"
            className="group mt-6 inline-flex items-center text-[0.875rem] font-medium text-brand-600 hover:text-brand-700"
          >
            verax.hello@gmail.com
            <svg
              width="9"
              height="9"
              viewBox="0 0 10 10"
              fill="none"
              aria-hidden="true"
              className="ml-1 transition-transform duration-200 group-hover:translate-x-0.5"
            >
              <path
                d="M3 1.5 6.5 5 3 8.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        </GlowCard>
      </Reveal>
    </Band>

    {/* Values */}
    <Band className="!pt-0">
      <Heading kicker="What drives us" title="Four rules we build by." tint="Each one shows up in the product." />
      <RevealGroup className="mt-14 grid gap-4 sm:grid-cols-2" stagger={0.08}>
        {VALUES.map((value) => (
          <RevealItem key={value.title} className="h-full">
            <GlowCard className="h-full p-7">
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
                  {value.glyph}
                </svg>
              </span>
              <h3 className="mt-5 text-[1.0625rem] font-medium tracking-[-0.015em] text-carbon-900">{value.title}</h3>
              <p className="mt-2 text-[0.9375rem] leading-[1.65] text-carbon-500">{value.body}</p>
            </GlowCard>
          </RevealItem>
        ))}
      </RevealGroup>
    </Band>

    <ClosingCTA />
  </PublicLayout>
);

export default AboutPage;
