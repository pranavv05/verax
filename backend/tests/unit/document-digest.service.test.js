const { processDocumentDigests } = require("../../src/services/document-digest.service");
const { documentDigestTemplate, MAX_LISTED_DOCUMENTS } = require("../../src/templates/documentDigest.template");

const FIRM_A = "aaaaaaaa-0000-4000-8000-000000000001";
const FIRM_B = "aaaaaaaa-0000-4000-8000-000000000002";
const WINDOW_END = new Date("2026-09-27T02:30:00.000Z");

const digestFor = (overrides = {}) => ({
  windowEnd: WINDOW_END,
  firmName: "Sharma & Co",
  admins: [
    { id: "u1", email: "one@firm.test" },
    { id: "u2", email: "two@firm.test" }
  ],
  documents: [
    { id: "d1", fileName: "bill-1.pdf", clientName: "Kumar & Sons", needsAttention: false },
    { id: "d2", fileName: "bill-2.pdf", clientName: "Kumar & Sons", needsAttention: true }
  ],
  ...overrides
});

const makeDeps = (overrides = {}) => ({
  mode: "digest",
  frontendUrl: "https://app.verax.test",
  withTenantTransaction: jest.fn(async (_context, handler) => handler({})),
  listFirmIdsForDigest: jest.fn(async () => [FIRM_A]),
  getFirmDigest: jest.fn(async () => digestFor()),
  recordDigestSent: jest.fn(async () => {}),
  sendEmail: jest.fn(async () => ({ sent: true, provider: "resend" })),
  logError: jest.fn(),
  ...overrides
});

describe("processDocumentDigests", () => {
  it("emails each admin once and records the window it covered", async () => {
    const deps = makeDeps();

    const result = await processDocumentDigests(deps);

    expect(result).toEqual({ firms: 1, emailsSent: 2, failures: 0, skipped: false });
    expect(deps.sendEmail).toHaveBeenCalledTimes(2);
    expect(deps.sendEmail.mock.calls[0][0]).toMatchObject({
      to: "one@firm.test",
      subject: "2 documents ready for review"
    });
    expect(deps.recordDigestSent).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ firmId: FIRM_A, windowEnd: WINDOW_END, documentCount: 2 })
    );
  });

  it("sends nothing and records nothing when no documents are waiting", async () => {
    const deps = makeDeps({ getFirmDigest: jest.fn(async () => digestFor({ documents: [] })) });

    const result = await processDocumentDigests(deps);

    expect(result.emailsSent).toBe(0);
    expect(deps.sendEmail).not.toHaveBeenCalled();
    expect(deps.recordDigestSent).not.toHaveBeenCalled();
  });

  it("does not advance the window when no admin received the email", async () => {
    const deps = makeDeps({
      sendEmail: jest.fn(async () => ({ sent: false, error: "provider down" }))
    });

    const result = await processDocumentDigests(deps);

    expect(result.emailsSent).toBe(0);
    expect(deps.recordDigestSent).not.toHaveBeenCalled();
    expect(deps.logError).toHaveBeenCalled();
  });

  it("records the digest when only some admins received it", async () => {
    const sendEmail = jest
      .fn()
      .mockResolvedValueOnce({ sent: true })
      .mockRejectedValueOnce(new Error("SMTP timeout"));
    const deps = makeDeps({ sendEmail });

    const result = await processDocumentDigests(deps);

    expect(result.emailsSent).toBe(1);
    const recorded = deps.recordDigestSent.mock.calls[0][1];
    expect(recorded.results).toEqual([
      { email: "one@firm.test", sent: true, error: null },
      { email: "two@firm.test", sent: false, error: "SMTP timeout" }
    ]);
  });

  it("keeps going to the next firm when one firm fails", async () => {
    const deps = makeDeps({
      listFirmIdsForDigest: jest.fn(async () => [FIRM_A, FIRM_B]),
      getFirmDigest: jest.fn(async (_db, { firmId }) => {
        if (firmId === FIRM_A) throw new Error("db hiccup");
        return digestFor();
      })
    });

    const result = await processDocumentDigests(deps);

    expect(result).toEqual({ firms: 2, emailsSent: 2, failures: 1, skipped: false });
  });

  it.each(["instant", "off"])("does nothing in %s mode", async (mode) => {
    const deps = makeDeps({ mode });

    const result = await processDocumentDigests(deps);

    expect(result.skipped).toBe(true);
    expect(deps.listFirmIdsForDigest).not.toHaveBeenCalled();
    expect(deps.sendEmail).not.toHaveBeenCalled();
  });
});

describe("documentDigestTemplate", () => {
  it("groups documents by client, links each one and escapes names", () => {
    const html = documentDigestTemplate({
      firmName: "Sharma & Co",
      frontendUrl: "https://app.verax.test",
      documents: digestFor().documents.concat({
        id: "d3",
        fileName: "<script>.pdf",
        clientName: "Mehta Traders",
        needsAttention: false
      })
    });

    expect(html).toContain("3 documents ready for review");
    expect(html).toContain("Kumar &amp; Sons");
    expect(html).toContain("Mehta Traders");
    expect(html).toContain('href="https://app.verax.test/review/d1"');
    expect(html).toContain("&lt;script&gt;.pdf");
    expect(html).not.toContain("<script>");
    expect(html).toContain("including 1 document flagged for a closer look");
  });

  it("caps the list and says how many more there are", () => {
    const documents = Array.from({ length: MAX_LISTED_DOCUMENTS + 5 }, (_, index) => ({
      id: `d${index}`,
      fileName: `bill-${index}.pdf`,
      clientName: "Kumar & Sons",
      needsAttention: false
    }));

    const html = documentDigestTemplate({ firmName: "Sharma & Co", frontendUrl: "https://app.verax.test", documents });

    expect(html).toContain(`${MAX_LISTED_DOCUMENTS + 5} documents ready for review`);
    expect(html).toContain("…and 5 more documents.");
    expect(html).not.toContain(`bill-${MAX_LISTED_DOCUMENTS}.pdf`);
  });
});
