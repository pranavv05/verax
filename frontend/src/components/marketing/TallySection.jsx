import { Reveal } from "../public/motion";
import { Eyebrow, Section } from "./ledger";

/**
 * The last mile, and the one CAs actually judge the product on.
 *
 * The XML below is the shape `backend/src/services/tally-xml.service.js`
 * genuinely emits — party ledger, purchase ledger, the GST ledger lines, an
 * inventory entry — with the same figures the rest of the page has been
 * carrying since the hero. If the numbers on a marketing page don't reconcile
 * with each other, an accountant will notice before anyone else.
 */

const STAGES = [
  { index: "01", label: "Document", detail: "invoice, statement, register" },
  { index: "02", label: "Extraction", detail: "fields, validated" },
  { index: "03", label: "Voucher", detail: "balanced, ledgered" },
  { index: "04", label: "XML", detail: "one document or a whole month" }
];

/** One line of XML. `depth` is indentation, not nesting logic — this is art. */
const Ln = ({ depth = 0, tag, value, attr }) => (
  <div style={{ paddingLeft: depth * 14 }} className="whitespace-pre">
    <span className="text-carbon-400">&lt;{tag}</span>
    {attr ? <span className="text-brand-400">{` ${attr}`}</span> : null}
    <span className="text-carbon-400">&gt;</span>
    {value !== undefined ? (
      <>
        <span className="text-white">{value}</span>
        <span className="text-carbon-400">&lt;/{tag}&gt;</span>
      </>
    ) : null}
  </div>
);

const Close = ({ depth = 0, tag }) => (
  <div style={{ paddingLeft: depth * 14 }} className="whitespace-pre text-carbon-400">
    &lt;/{tag}&gt;
  </div>
);

const TallySection = () => (
  <Section id="tally" dark>
    <div className="grid gap-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-20">
      <Reveal>
        <Eyebrow dark>Tally export</Eyebrow>

        <h2 className="vx-h2-xl mt-6 text-white">
          From document to Tally.
          <br />
          Without the re-entry.
        </h2>

        <p className="vx-body mt-7 max-w-[32rem] text-carbon-300">
          Approved documents become balanced TallyPrime vouchers — party
          ledger, purchase ledger, each GST component on its own line, and
          inventory entries where line items were mapped to stock items.
        </p>

        <p className="vx-body mt-5 max-w-[32rem] text-carbon-300">
          Export one document, or every reviewed document for a client and a
          date range in a single file. Item names your team corrected once are
          remembered for next month.
        </p>

        <ol className="mt-12 grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 sm:grid-cols-2">
          {STAGES.map((stage) => (
            <li key={stage.index} className="bg-carbon-950 px-5 py-4">
              <span className="vx-mono text-[0.625rem] tracking-[0.14em] text-carbon-400">
                {stage.index}
              </span>
              <p className="mt-2 text-[0.9375rem] font-medium text-white">{stage.label}</p>
              <p className="mt-1 text-[0.75rem] leading-[1.5] text-carbon-400">
                {stage.detail}
              </p>
            </li>
          ))}
        </ol>
      </Reveal>

      <Reveal delay={0.1}>
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-carbon-900">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
            <span className="vx-mono text-[0.6875rem] text-carbon-300">
              acme-trading-march-2026.xml
            </span>
            <span className="vx-mono text-[0.625rem] uppercase tracking-[0.12em] text-verify-400">
              balanced
            </span>
          </div>

          <div className="vx-mono overflow-x-auto px-5 py-5 text-[0.6875rem] leading-[1.85]">
            <Ln tag="VOUCHER" attr={'VCHTYPE="Purchase" ACTION="Create"'} />
            <Ln depth={1} tag="DATE" value="20260317" />
            <Ln depth={1} tag="PARTYLEDGERNAME" value="ACME Trading Co." />
            <Ln depth={1} tag="PARTYGSTIN" value="27AABCA1234A1Z5" />
            <Ln depth={1} tag="REFERENCE" value="INV-2026-0417" />
            <Ln depth={1} tag="ALLLEDGERENTRIES.LIST" />
            <Ln depth={2} tag="LEDGERNAME" value="ACME Trading Co." />
            <Ln depth={2} tag="AMOUNT" value="49560.00" />
            <Close depth={1} tag="ALLLEDGERENTRIES.LIST" />
            <Ln depth={1} tag="ALLLEDGERENTRIES.LIST" />
            <Ln depth={2} tag="LEDGERNAME" value="Purchase Account" />
            <Ln depth={2} tag="AMOUNT" value="-42000.00" />
            <Close depth={1} tag="ALLLEDGERENTRIES.LIST" />
            <Ln depth={1} tag="ALLLEDGERENTRIES.LIST" />
            <Ln depth={2} tag="LEDGERNAME" value="CGST" />
            <Ln depth={2} tag="AMOUNT" value="-3780.00" />
            <Close depth={1} tag="ALLLEDGERENTRIES.LIST" />
            <Ln depth={1} tag="ALLLEDGERENTRIES.LIST" />
            <Ln depth={2} tag="LEDGERNAME" value="SGST" />
            <Ln depth={2} tag="AMOUNT" value="-3780.00" />
            <Close depth={1} tag="ALLLEDGERENTRIES.LIST" />
            <Ln depth={1} tag="ALLINVENTORYENTRIES.LIST" />
            <Ln depth={2} tag="STOCKITEMNAME" value="Packaging Rolls 40 GSM" />
            <Ln depth={2} tag="ACTUALQTY" value="80 Nos" />
            <Ln depth={2} tag="AMOUNT" value="-20000.00" />
            <Close depth={1} tag="ALLINVENTORYENTRIES.LIST" />
            <Close tag="VOUCHER" />
          </div>
        </div>

        <p className="mt-5 text-[0.75rem] leading-[1.6] text-carbon-400">
          Import into TallyPrime as you would any other XML. Verax generates
          the file; it does not connect to or modify your Tally installation.
        </p>
      </Reveal>
    </div>
  </Section>
);

export default TallySection;
