const {
  parseTallyResponse,
  remoteIdForDocument
} = require("../../src/services/tally-connector.service");
const { buildVoucherXml } = require("../../src/services/tally-xml.service");

describe("remoteIdForDocument", () => {
  test("is stable for a given document id", () => {
    expect(remoteIdForDocument("abc")).toBe("verax-doc-abc");
    expect(remoteIdForDocument("abc")).toBe(remoteIdForDocument("abc"));
  });
});

describe("parseTallyResponse", () => {
  test("a clean create is ok", () => {
    const xml = `<RESPONSE><CREATED>1</CREATED><ALTERED>0</ALTERED><ERRORS>0</ERRORS><EXCEPTIONS>0</EXCEPTIONS></RESPONSE>`;
    const result = parseTallyResponse(xml);
    expect(result.ok).toBe(true);
    expect(result.created).toBe(1);
    expect(result.lineErrors).toEqual([]);
  });

  test("an alter (re-import of same REMOTEID) is ok", () => {
    const xml = `<RESPONSE><CREATED>0</CREATED><ALTERED>1</ALTERED><ERRORS>0</ERRORS></RESPONSE>`;
    const result = parseTallyResponse(xml);
    expect(result.ok).toBe(true);
    expect(result.altered).toBe(1);
  });

  test("a LINEERROR is a terminal, non-ok result", () => {
    const xml = `<RESPONSE><CREATED>0</CREATED><ALTERED>0</ALTERED><ERRORS>1</ERRORS><LINEERROR>Ledger 'Foo' does not exist</LINEERROR></RESPONSE>`;
    const result = parseTallyResponse(xml);
    expect(result.ok).toBe(false);
    expect(result.retryable).toBe(false);
    expect(result.lineErrors).toContain("Ledger 'Foo' does not exist");
    expect(result.error).toMatch(/does not exist/);
  });

  test("captures multiple line errors", () => {
    const xml = `<RESPONSE><ERRORS>2</ERRORS><LINEERROR>err one</LINEERROR><LINEERROR>err two</LINEERROR></RESPONSE>`;
    const result = parseTallyResponse(xml);
    expect(result.lineErrors).toHaveLength(2);
    expect(result.ok).toBe(false);
  });

  test("zero created and zero altered with no errors is still not ok", () => {
    const xml = `<RESPONSE><CREATED>0</CREATED><ALTERED>0</ALTERED><ERRORS>0</ERRORS></RESPONSE>`;
    const result = parseTallyResponse(xml);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/no created or altered/i);
  });

  test("tolerates whitespace and mixed case tags", () => {
    const xml = `<RESPONSE>\n  <CREATED> 1 </CREATED>\n  <ERRORS>0</ERRORS>\n</RESPONSE>`;
    const result = parseTallyResponse(xml);
    expect(result.created).toBe(1);
    expect(result.ok).toBe(true);
  });

  test("handles empty/garbage input without throwing", () => {
    expect(parseTallyResponse("").ok).toBe(false);
    expect(parseTallyResponse(null).ok).toBe(false);
    expect(parseTallyResponse("not xml").ok).toBe(false);
  });
});

// The Windows agent (tally-agent/, Go) re-implements this parser. Both read the
// same fixture file, so the two implementations can't silently drift apart.
describe("parseTallyResponse parity with the Tally agent", () => {
  const fixtures = require("../../../tally-agent/testdata/tally_responses.json");
  test.each(fixtures.map((f) => [f.name, f]))("%s", (_name, fixture) => {
    const result = parseTallyResponse(fixture.xml);
    expect(result).toMatchObject(fixture.expect);
    expect(result.retryable).toBe(false);
  });
});

describe("buildVoucherXml idempotency (REMOTEID injection)", () => {
  const invoiceDoc = {
    id: "doc-1",
    doc_type: "invoice",
    file_name: "inv.pdf",
    uploaded_at: "2026-05-01",
    structured_data: {
      invoice_number: "INV-1",
      invoice_date: "2026-05-01",
      vendor_name: "Acme",
      total_amount: 1180,
      cgst: 90,
      sgst: 90
    }
  };

  test("no remoteId -> no REMOTEID attribute (file-export path unchanged)", () => {
    const xml = buildVoucherXml(invoiceDoc);
    expect(xml).not.toMatch(/REMOTEID=/);
    expect(xml).toMatch(/<VOUCHER /);
  });

  test("remoteId -> stable REMOTEID and VCHKEY on the voucher", () => {
    const remoteId = remoteIdForDocument(invoiceDoc.id);
    const xml = buildVoucherXml(invoiceDoc, { remoteId });
    expect(xml).toMatch(new RegExp(`REMOTEID="${remoteId}"`));
    expect(xml).toMatch(new RegExp(`VCHKEY="${remoteId}"`));
  });

  test("the same document produces identical XML twice (idempotent push)", () => {
    const remoteId = remoteIdForDocument(invoiceDoc.id);
    const a = buildVoucherXml(invoiceDoc, { remoteId });
    const b = buildVoucherXml(invoiceDoc, { remoteId });
    expect(a).toBe(b);
  });

  test("multiple vouchers from one bank statement get distinct suffixed remote ids", () => {
    const bankDoc = {
      id: "doc-bank",
      doc_type: "bank_statement",
      file_name: "stmt.pdf",
      uploaded_at: "2026-05-01",
      structured_data: {
        bank_name: "HDFC",
        account_number: "123",
        transactions: [
          { date: "2026-05-01", narration: "A", debit: 100 },
          { date: "2026-05-02", narration: "B", credit: 200 }
        ]
      }
    };
    const remoteId = remoteIdForDocument(bankDoc.id);
    const xml = buildVoucherXml(bankDoc, { remoteId });
    expect(xml).toMatch(new RegExp(`REMOTEID="${remoteId}"`));
    expect(xml).toMatch(new RegExp(`REMOTEID="${remoteId}-1"`));
  });
});
