#!/usr/bin/env node
/**
 * Generates a small text-bearing invoice PDF for demo/smoke testing.
 *
 * Deliberately builds the PDF by hand rather than pulling in a PDF library:
 * the repo has no PDF fixture and no pdf dependency, and the demo only needs a
 * file whose text layer is genuinely extractable. Text is drawn with real
 * PDF text operators (BT/Tf/Td/Tj/ET) using the built-in Helvetica font, so
 * pdfplumber/PyMuPDF can read it directly without OCR, while PaddleOCR can
 * still read it if the pipeline rasterises the page instead.
 *
 * Usage: node scripts/make-test-invoice.js [outputPath]
 */

const fs = require("fs");
const path = require("path");

const LINES = [
  ["TAX INVOICE", 24, 70, 740],
  ["Sharma Steel Traders", 14, 70, 700],
  ["GSTIN: 27AAECS1234C1ZP", 11, 70, 682],
  ["Plot 14, MIDC Industrial Area, Pune, Maharashtra 411019", 10, 70, 666],
  ["Invoice No: INV-2026-0417", 11, 70, 630],
  ["Invoice Date: 12/07/2026", 11, 70, 614],
  ["Place of Supply: Maharashtra (27)", 11, 70, 598],
  ["Bill To:", 11, 70, 566],
  ["Test SME Client", 11, 70, 550],
  ["GSTIN: 29ABCDE1234F1Z5", 10, 70, 534],
  ["Description                 HSN      Qty    Rate      Amount", 10, 70, 494],
  ["MS Angle 50x50x6mm          7216     120    850.00    102000.00", 10, 70, 476],
  ["MS Flat Bar 40x6mm          7214      60    720.00     43200.00", 10, 70, 460],
  ["TMT Bar Fe500D 12mm         7214      25    absent", 10, 70, 444],
  ["Taxable Value                                        145200.00", 10, 70, 404],
  ["CGST @ 9%                                             13068.00", 10, 70, 388],
  ["SGST @ 9%                                             13068.00", 10, 70, 372],
  ["IGST @ 0%                                                 0.00", 10, 70, 356],
  ["Total Invoice Value                                  171336.00", 12, 70, 330],
  ["Amount in words: One Lakh Seventy One Thousand Three Hundred", 10, 70, 300],
  ["Thirty Six Rupees Only", 10, 70, 286],
  ["Payment Terms: 30 days from invoice date", 10, 70, 250],
  ["Bank: HDFC Bank, A/c 50200012345678, IFSC HDFC0001234", 10, 70, 234],
  ["For Sharma Steel Traders (Authorised Signatory)", 10, 70, 190]
];

// The "TMT Bar" row above intentionally has no rate/amount so the extraction has
// a partially-incomplete line item -- useful for showing the review UI doing
// real work rather than a perfectly clean parse.

const escapeText = (text) => text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

const buildContentStream = () =>
  LINES.map(
    ([text, size, x, y]) =>
      `BT /F1 ${size} Tf ${x} ${y} Td (${escapeText(text)}) Tj ET`
  ).join("\n");

const buildPdf = () => {
  const content = buildContentStream();

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] " +
      "/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [];

  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "latin1");
};

const outputPath = path.resolve(
  process.argv[2] || path.join(__dirname, "..", "..", "tests", "fixtures", "test-invoice.pdf")
);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, buildPdf());

console.log(`Wrote ${outputPath} (${fs.statSync(outputPath).size} bytes)`);
