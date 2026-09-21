import PublicLayout from "../components/layout/PublicLayout";
import ClosingCTA from "../components/marketing/ClosingCTA";
import ProofBand from "../components/marketing/ProofBand";
import { Section, SectionHead, Eyebrow, Tick } from "../components/marketing/ledger";
import { Reveal } from "../components/public/motion";

const values = [
  {
    title: "Speed without sacrifice",
    description:
      "Automation should make work faster, not riskier. We automate the tedious parts while keeping CAs in control of every approval."
  },
  {
    title: "Security by architecture",
    description:
      "Data isolation isn't a setting — it's enforced by the database itself. PostgreSQL Row-Level Security means no firm can ever access another's records."
  },
  {
    title: "India-first product thinking",
    description:
      "GSTIN validation, TallyPrime compatibility, Indian TDS section tables, and INR-centric UX. We build for Indian CA practice, not a generic global market."
  },
  {
    title: "Accuracy over automation",
    description:
      "For numbers, we use rule-based processing, not just LLMs. Bank statement conversions use direct table extraction — zero hallucination risk on financial figures."
  }
];

const AboutPage = () => (
  <PublicLayout>
    {/* Hero */}
    <Section className="pt-20 sm:pt-28">
      <Reveal className="mx-auto max-w-[46rem] text-center">
        <Eyebrow className="justify-center">About Verax</Eyebrow>
        <h1 className="vx-display-xl mt-6">
          Built for how
          <br />
          CA firms actually work.
        </h1>
        <p className="vx-body mx-auto mt-7 max-w-[36rem]">
          Verax exists because CA firms deserve tools that understand Indian
          accounting — not generic software retrofitted with a GSTIN field.
        </p>
      </Reveal>
    </Section>

    <ProofBand />

    {/* Mission */}
    <Section>
      <Reveal className="mx-auto max-w-[42rem]">
        <Eyebrow>Our mission</Eyebrow>
        <h2 className="vx-h2-xl mt-5">Make data entry extinct for CA firms</h2>
        <div className="mt-8 space-y-4">
          <p className="vx-body">
            A mid-size CA firm in India processes hundreds of documents every
            month. Invoices arrive as phone photos. Bank statements come as
            PDF exports. Each one gets manually re-typed into Tally.
          </p>
          <p className="vx-body">
            That&apos;s not accounting work — it&apos;s data entry. It&apos;s
            repetitive, error-prone, and it keeps qualified CAs away from
            advisory work that actually grows their clients&apos; businesses.
          </p>
          <p className="vx-body">
            Verax automates the pipeline: upload → OCR → compliance check →
            review → Tally XML. The CA still reviews and approves everything.
            But the typing, the GSTIN lookups, the tax math — all gone.
          </p>
        </div>
      </Reveal>
    </Section>

    {/* Team */}
    <Section className="border-y border-hairline bg-well">
      <SectionHead eyebrow="The team" title="Who builds Verax" align="center" />
      <Reveal delay={0.1} className="mx-auto mt-14 max-w-sm">
        <article className="rounded-2xl border border-hairline bg-surface p-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-carbon-900 text-lg font-extrabold text-white">
            PV
          </div>
          <h3 className="mt-5 text-base font-extrabold text-carbon-900">Pranav Vatsa</h3>
          <p className="text-sm font-semibold text-verify-700">Founder</p>
          <p className="mt-3 text-sm leading-relaxed text-carbon-500">
            Building Verax to take data entry out of day-to-day CA practice.
          </p>
        </article>
      </Reveal>
    </Section>

    {/* Values */}
    <Section>
      <SectionHead eyebrow="What drives us" title="Our values" align="center" />
      <div className="mt-14 grid gap-5 sm:grid-cols-2">
        {values.map((v, i) => (
          <Reveal key={v.title} delay={0.05 * i}>
            <article className="h-full rounded-2xl border border-hairline bg-surface p-6">
              <Tick className="text-verify-600" size={16} />
              <h3 className="mt-4 text-base font-bold text-carbon-900">{v.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-carbon-500">{v.description}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </Section>

    <ClosingCTA />
  </PublicLayout>
);

export default AboutPage;
