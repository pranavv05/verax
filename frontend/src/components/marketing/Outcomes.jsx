import { Reveal, RevealGroup, RevealItem } from "../public/motion";
import { Eyebrow, Section } from "./ledger";

/**
 * Outcomes, then the capability index.
 *
 * Two deliberate refusals here. There are no icons — six outcomes described in
 * a sentence each, set on rules, say more than six glyphs in tinted squares.
 * And there are no numbers: nothing in this repository measures hours saved or
 * accuracy, so every claim is written as a direction ("less", "fewer") rather
 * than as a statistic somebody made up.
 *
 * The capability list is an inventory of what is actually built. Each line
 * corresponds to a shipped route/service — see FEATURE_STATUS.md.
 */

const OUTCOMES = [
  {
    index: "01",
    title: "Less data entry",
    body: "The typing that fills a staff member's afternoon — vendor, GSTIN, invoice number, every line item — happens once, automatically, at upload."
  },
  {
    index: "02",
    title: "Fewer manual checks",
    body: "Checksums, tax math, duplicates and GSTR-2B matching run on every document instead of on the ones somebody remembered to check."
  },
  {
    index: "03",
    title: "Faster client turnaround",
    body: "Documents start processing the moment they arrive, including the ones a client sends at eleven at night on the last day of the month."
  },
  {
    index: "04",
    title: "Visibility",
    body: "What has been received, what is still outstanding, what is waiting on review and what has been exported — per client, without asking anyone."
  },
  {
    index: "05",
    title: "Auditability",
    body: "Every upload, edit, approval and export is written to an audit log, and every extraction keeps its version history with a field-level diff."
  },
  {
    index: "06",
    title: "Room to grow",
    body: "Taking on more clients stops meaning proportionally more retyping, because the repetitive share of the work no longer scales with the client list."
  }
];

const CAPABILITIES = [
  {
    group: "Collection",
    items: [
      "Secure magic-link upload",
      "Client portal logins",
      "Scheduled monthly / weekly requests",
      "Multi-file upload with progress",
      "PDF, JPG, PNG, XLSX"
    ]
  },
  {
    group: "Intelligence",
    items: [
      "Image preprocessing",
      "OCR with fallback engine",
      "LLM field extraction",
      "Confidence scoring",
      "Learned item-name mapping"
    ]
  },
  {
    group: "Compliance",
    items: [
      "GSTIN checksum + live verification",
      "CGST / SGST / IGST cross-check",
      "TDS section and rate table",
      "Duplicate invoice detection",
      "GSTR-2B reconciliation + Excel report"
    ]
  },
  {
    group: "Firm operations",
    items: [
      "Review queue and approvals",
      "Version history with diff",
      "Admin / staff roles and invites",
      "In-app and email notifications",
      "Audit log, per-firm data isolation",
      "Tally XML export, single or bulk"
    ]
  }
];

const Outcomes = () => (
  <>
    <Section id="outcomes">
      <Reveal>
        <Eyebrow>What changes</Eyebrow>
        <h2 className="vx-h2-xl mt-6 max-w-[20ch]">
          The month gets shorter
          <br />
          at the boring end.
        </h2>
      </Reveal>

      <RevealGroup
        className="mt-20 grid gap-x-14 gap-y-12 sm:grid-cols-2 lg:grid-cols-3"
        stagger={0.08}
      >
        {OUTCOMES.map((outcome) => (
          <RevealItem key={outcome.index} className="border-t border-carbon-900/15 pt-6">
            <span className="vx-index text-carbon-300">{outcome.index}</span>
            <h3 className="mt-4 text-[1.125rem] font-semibold tracking-[-0.015em] text-carbon-900">
              {outcome.title}
            </h3>
            <p className="mt-3 text-[0.9375rem] leading-[1.7] text-carbon-500">
              {outcome.body}
            </p>
          </RevealItem>
        ))}
      </RevealGroup>
    </Section>

    <Section id="capabilities" className="!pt-0">
      <Reveal className="border-t border-hairline pt-16">
        <Eyebrow>In the product today</Eyebrow>

        <div className="mt-12 grid gap-x-12 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {CAPABILITIES.map((column) => (
            <div key={column.group}>
              <h3 className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-carbon-900">
                {column.group}
              </h3>
              <ul className="mt-5 space-y-2.5">
                {column.items.map((item) => (
                  <li
                    key={item}
                    className="vx-mono text-[0.75rem] leading-[1.65] text-carbon-500"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Reveal>
    </Section>
  </>
);

export default Outcomes;
