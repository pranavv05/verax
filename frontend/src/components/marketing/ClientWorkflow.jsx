import { Reveal, RevealGroup, RevealItem } from "../public/motion";
import { Eyebrow, FlowRail, Section, Sheet } from "./ledger";
import { VeraxMark } from "../brand/VeraxLogo";

/**
 * The relationship the product actually sits inside: an SME on one side, a CA
 * firm on the other, and the month of paperwork that has to cross between
 * them. Drawn as three columns on one rail — the business hands over
 * documents, Verax does the mechanical work, the firm does the professional
 * work — because the handover *is* the product, not a feature of it.
 */

const CLIENT_ACTIONS = [
  "Upload from a secure link — no login needed",
  "Or sign in to their own client portal",
  "See what has been received and what is still outstanding",
  "Get asked for the month's documents automatically"
];

const FIRM_ACTIONS = [
  "Everything filed against the right client on arrival",
  "Reviewed only where a check failed or confidence was low",
  "Approved, then exported as Tally-ready XML",
  "Every upload, edit, approval and export written to the audit log"
];

const Column = ({ label, title, children }) => (
  <div>
    <p className="vx-index">{label}</p>
    <h3 className="mt-4 text-[1.375rem] font-semibold tracking-[-0.02em] text-carbon-900">
      {title}
    </h3>
    <div className="mt-7">{children}</div>
  </div>
);

const ActionList = ({ items }) => (
  <ul className="space-y-3 border-t border-hairline pt-5">
    {items.map((item) => (
      <li key={item} className="flex gap-3 text-[0.875rem] leading-[1.6] text-carbon-500">
        <span aria-hidden="true" className="mt-[9px] h-px w-3 flex-none bg-carbon-300" />
        {item}
      </li>
    ))}
  </ul>
);

const ClientWorkflow = () => (
  <Section id="workflow">
    <Reveal className="mx-auto max-w-[46rem] text-center">
      <Eyebrow className="justify-center">Client ↔ firm</Eyebrow>
      <h2 className="vx-h2-xl mt-6">
        Built for the work between
        <br />
        businesses and their CAs.
      </h2>
      <p className="vx-body mx-auto mt-7 max-w-[34rem] text-carbon-500">
        Chasing documents, filing them against the right client, and telling
        people where things stand is most of the month. Verax takes that part.
      </p>
    </Reveal>

    <RevealGroup
      className="mt-20 grid items-start gap-8 lg:grid-cols-[1fr_auto_0.9fr_auto_1fr] lg:gap-0"
      stagger={0.12}
    >
      <RevealItem>
        <Column label="The business" title="Sends the paperwork">
          <div className="flex items-end gap-2">
            {[
              { label: "Invoice", height: "h-24", lines: 5 },
              { label: "Statement", height: "h-28", lines: 6 },
              { label: "Bills", height: "h-20", lines: 4 }
            ].map((sheet) => (
              <Sheet
                key={sheet.label}
                label={sheet.label}
                lines={sheet.lines}
                className={`flex-1 ${sheet.height}`}
              />
            ))}
          </div>
          <ActionList items={CLIENT_ACTIONS} />
        </Column>
      </RevealItem>

      <RevealItem className="flex items-center justify-center lg:w-16">
        <FlowRail className="w-full lg:mt-24" />
      </RevealItem>

      <RevealItem>
        <Column label="Verax" title="Does the mechanical part">
          <div className="flex h-[112px] flex-col items-center justify-center rounded-xl bg-carbon-950 px-6">
            <VeraxMark size={26} tone="light" />
            <p className="vx-mono mt-3 text-center text-[0.5625rem] uppercase leading-[1.7] tracking-[0.14em] text-carbon-300">
              collect · extract
              <br />
              validate · reconcile
            </p>
          </div>
          <ul className="mt-5 space-y-3 border-t border-hairline pt-5">
            <li className="text-[0.875rem] leading-[1.6] text-carbon-500">
              Runs the moment a document lands, at any hour, without anyone
              starting it.
            </li>
          </ul>
        </Column>
      </RevealItem>

      <RevealItem className="flex items-center justify-center lg:w-16">
        <FlowRail className="w-full lg:mt-24" />
      </RevealItem>

      <RevealItem>
        <Column label="The firm" title="Does the professional part">
          <div className="flex h-[112px] flex-col justify-center rounded-xl border border-hairline bg-white px-5">
            <div className="flex items-baseline justify-between">
              <span className="vx-index">Queue</span>
              <span className="vx-mono text-[0.6875rem] text-carbon-400">March</span>
            </div>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[0.75rem] text-carbon-500">Needs review</span>
                <span className="vx-mono text-[0.8125rem] font-medium text-amber-600">9</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[0.75rem] text-carbon-500">Ready to export</span>
                <span className="vx-mono text-[0.8125rem] font-medium text-verify-600">207</span>
              </div>
            </div>
          </div>
          <ActionList items={FIRM_ACTIONS} />
        </Column>
      </RevealItem>
    </RevealGroup>
  </Section>
);

export default ClientWorkflow;
