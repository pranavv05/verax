/**
 * A markup-driven Indian GST tax invoice — the document Verax is "looking
 * at" inside ReviewMockup, and later the hero and Document Intelligence
 * section. Built in HTML/CSS rather than as an image so it stays crisp at
 * any scale and so individual fields can be targeted for extraction
 * highlights later.
 *
 * Deliberately typeset in a plain system sans (never the site's Inter) —
 * a document set in the product's own typeface is the fastest way for a
 * mockup to read as "SaaS illustration" instead of "real paper."
 *
 * Extraction hooks: every field Verax extracts carries `data-vx-field="…"`
 * plus a shared `vx-doc-field` class. Nothing renders differently today —
 * these are anchors a future highlight-overlay layer (in ReviewMockup) can
 * select against, either by ref/DOM query or by teaching this component to
 * accept a `highlightField` prop and swap that field's className. Field
 * keys in use: vendorName, gstin, invoiceNumber, invoiceDate, totalAmount,
 * taxableValue.
 */

const DOC_FONT = "Arial, 'Helvetica Neue', Helvetica, sans-serif";

// Authored ("native") size. Consumers scale this down (ReviewMockup's
// document pane) or up (hero, Document Intelligence) with a plain CSS
// transform — see ReviewMockup.jsx for the pattern. The proportions are
// close to A4 portrait, cropped slightly shorter so it reads as a document
// rather than a full printable page.
export const INVOICE_WIDTH = 420;
export const INVOICE_HEIGHT = 500;

// Three line items whose taxable value, CGST and SGST sum exactly to the
// figures already shown in ReviewMockup's extracted-fields panel
// (₹42,000 / ₹3,780 / ₹49,560) — so the "document" and the "what Verax
// pulled out of it" panel agree, which is the whole point of the review
// screen.
const LINE_ITEMS = [
  {
    description: "Industrial Packaging Rolls — 40 GSM",
    hsn: "3920",
    qty: "80 Nos",
    rate: "₹250.00",
    taxable: "₹20,000.00",
    cgst: "₹1,800.00",
    sgst: "₹1,800.00",
    total: "₹23,600.00"
  },
  {
    description: "Corrugated Shipping Cartons — Size B",
    hsn: "4819",
    qty: "150 Nos",
    rate: "₹100.00",
    taxable: "₹15,000.00",
    cgst: "₹1,350.00",
    sgst: "₹1,350.00",
    total: "₹17,700.00"
  },
  {
    description: "BOPP Adhesive Tape (Case of 36)",
    hsn: "3919",
    qty: "14 Case",
    rate: "₹500.00",
    taxable: "₹7,000.00",
    cgst: "₹630.00",
    sgst: "₹630.00",
    total: "₹8,260.00"
  }
];

const TOTALS = {
  taxable: "₹42,000.00",
  cgst: "₹3,780.00",
  sgst: "₹3,780.00",
  grand: "₹49,560.00"
};

const MetaField = ({ label, value, field }) => (
  <div>
    <p className="text-[8px] font-semibold uppercase tracking-[0.1em] text-[#9C998D]">
      {label}
    </p>
    <p
      {...(field ? { "data-vx-field": field } : {})}
      className={`mt-0.5 text-[10px] font-medium text-[#1C1B18] ${
        field ? "vx-doc-field" : ""
      }`}
    >
      {value}
    </p>
  </div>
);

/**
 * Fixed-layout document — not responsive. Treat it as a picture of paper:
 * every consumer scales the whole 420×500 canvas rather than letting it
 * reflow, the same convention `ScaledFrame` uses for the product mockups.
 */
const InvoiceDocument = ({ className = "" }) => (
  <div
    className={`flex flex-col bg-[#FAFAF7] text-[#1C1B18] ${className}`}
    style={{ width: INVOICE_WIDTH, height: INVOICE_HEIGHT, fontFamily: DOC_FONT }}
  >
    <div className="flex flex-1 flex-col px-7 py-6">
      {/* Vendor header */}
      <div className="flex items-start justify-between">
        <div>
          <p
            data-vx-field="vendorName"
            className="vx-doc-field text-[16px] font-bold leading-tight tracking-[-0.01em] text-[#1C1B18]"
          >
            ACME Trading Co.
          </p>
          <p className="mt-1 text-[9px] leading-[1.5] text-[#726F65]">
            Plot No. 14, MIDC Industrial Area,
            <br />
            Andheri East, Mumbai, Maharashtra – 400093
          </p>
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9C998D]">
          Tax Invoice
        </p>
      </div>

      <div className="mt-3 flex gap-5 text-[9px] text-[#4A483F]">
        <p>
          GSTIN:{" "}
          <span data-vx-field="gstin" className="vx-doc-field font-semibold text-[#1C1B18]">
            27AABCA1234A1Z5
          </span>
        </p>
        <p>
          PAN: <span className="font-semibold text-[#1C1B18]">AABCA1234A</span>
        </p>
      </div>

      <div className="mt-4 h-px w-full bg-[#D8D5CB]" />

      {/* Invoice metadata */}
      <div className="mt-4 grid grid-cols-4 gap-3">
        <MetaField label="Invoice No." value="INV-2026-0417" field="invoiceNumber" />
        <MetaField label="Invoice Date" value="17/04/2026" field="invoiceDate" />
        <MetaField label="Place of Supply" value="Maharashtra" />
        <MetaField label="Reverse Charge" value="No" />
      </div>

      {/* Bill To / Ship To */}
      <div className="mt-4 grid grid-cols-2 gap-5 border-t border-[#E2E0D8] pt-4">
        <div>
          <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-[#9C998D]">
            Bill To
          </p>
          <p className="mt-1 text-[10px] font-semibold text-[#1C1B18]">
            Verax Technologies Pvt. Ltd.
          </p>
          <p className="mt-0.5 text-[9px] leading-[1.5] text-[#726F65]">
            4th Floor, Amar Business Park, Baner Road,
            <br />
            Pune, Maharashtra – 411045
          </p>
        </div>
        <div>
          <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-[#9C998D]">
            Ship To
          </p>
          <p className="mt-1 text-[9px] leading-[1.5] text-[#726F65]">
            Same as billing address
          </p>
        </div>
      </div>

      {/* Line items */}
      <table className="mt-4 w-full border-collapse text-[8px]">
        <thead>
          <tr className="border-y border-[#D8D5CB] text-[#726F65]">
            <th className="py-1.5 pr-2 text-left font-semibold">Description</th>
            <th className="px-1.5 py-1.5 text-left font-semibold">HSN</th>
            <th className="px-1.5 py-1.5 text-right font-semibold">Qty</th>
            <th className="px-1.5 py-1.5 text-right font-semibold">Rate</th>
            <th className="px-1.5 py-1.5 text-right font-semibold">Taxable</th>
            <th className="px-1.5 py-1.5 text-right font-semibold">CGST</th>
            <th className="px-1.5 py-1.5 text-right font-semibold">SGST</th>
            <th className="py-1.5 pl-1.5 text-right font-semibold">Total</th>
          </tr>
        </thead>
        <tbody>
          {LINE_ITEMS.map((item) => (
            <tr key={item.description} className="border-b border-[#EAE8E0] text-[#3A3830]">
              <td className="py-1.5 pr-2 text-left leading-[1.3]">{item.description}</td>
              <td className="px-1.5 py-1.5 text-left">{item.hsn}</td>
              <td className="px-1.5 py-1.5 text-right">{item.qty}</td>
              <td className="px-1.5 py-1.5 text-right">{item.rate}</td>
              <td className="px-1.5 py-1.5 text-right">{item.taxable}</td>
              <td className="px-1.5 py-1.5 text-right">{item.cgst}</td>
              <td className="px-1.5 py-1.5 text-right">{item.sgst}</td>
              <td className="py-1.5 pl-1.5 text-right font-medium">{item.total}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="mt-3 flex justify-end">
        <div className="w-[168px] space-y-1">
          <div className="flex items-center justify-between text-[9px] text-[#726F65]">
            <span>Taxable Value</span>
            <span
              data-vx-field="taxableValue"
              className="vx-doc-field font-medium text-[#1C1B18]"
            >
              {TOTALS.taxable}
            </span>
          </div>
          <div className="flex items-center justify-between text-[9px] text-[#726F65]">
            <span>CGST</span>
            <span className="font-medium text-[#1C1B18]">{TOTALS.cgst}</span>
          </div>
          <div className="flex items-center justify-between text-[9px] text-[#726F65]">
            <span>SGST</span>
            <span className="font-medium text-[#1C1B18]">{TOTALS.sgst}</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between border-t border-[#D8D5CB] pt-1.5 text-[11px] font-bold text-[#1C1B18]">
            <span>Total</span>
            <span data-vx-field="totalAmount" className="vx-doc-field">
              {TOTALS.grand}
            </span>
          </div>
        </div>
      </div>

      {/* Amount in words */}
      <p className="mt-3 text-[8px] italic text-[#726F65]">
        Amount in Words: Indian Rupees Forty-Nine Thousand Five Hundred Sixty Only
      </p>

      {/* Bank details + signatory */}
      <div className="mt-auto flex items-end justify-between border-t border-[#E2E0D8] pt-3">
        <div className="text-[8px] leading-[1.6] text-[#726F65]">
          <p className="font-semibold uppercase tracking-[0.1em] text-[#9C998D]">
            Bank Details
          </p>
          <p>HDFC Bank, Andheri East Branch</p>
          <p>A/c No. 50200012345678 · IFSC HDFC0001234</p>
        </div>
        <div className="text-right text-[8px] text-[#726F65]">
          <p className="mb-4 text-[9px] font-medium text-[#1C1B18]">For ACME Trading Co.</p>
          <p className="border-t border-[#B9B6A9] pt-1">Authorized Signatory</p>
        </div>
      </div>
    </div>
  </div>
);

export default InvoiceDocument;
