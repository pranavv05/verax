const {
  ACTIVITY_ACTIONS,
  getDashboardInsights,
  getDocumentPipeline,
  getReviewQueue,
  getClientProgress,
  getDocumentTrend,
  getRecentActivity
} = require("../../src/services/dashboard.service");

const FIRM_ID = "aaaaaaaa-0000-4000-8000-000000000001";

// A db double that answers each query, in order, with the next canned result
// and records the SQL + params it was called with.
const fakeDb = (...results) => {
  const calls = [];
  return {
    calls,
    query: jest.fn(async (sql, params) => {
      calls.push({ sql, params });
      return results[calls.length - 1] || { rows: [] };
    })
  };
};

describe("getDocumentPipeline", () => {
  test("maps every stage and scopes the query to the firm", async () => {
    const db = fakeDb({
      rows: [{ queued: 2, processing: 1, awaiting_review: 5, ready_to_export: 3, exported: 40, failed: 1 }]
    });

    await expect(getDocumentPipeline(db, { firmId: FIRM_ID })).resolves.toEqual({
      queued: 2,
      processing: 1,
      awaitingReview: 5,
      readyToExport: 3,
      exported: 40,
      failed: 1
    });
    expect(db.calls[0].params).toEqual([FIRM_ID]);
    expect(db.calls[0].sql).toMatch(/deleted_at IS NULL/);
  });

  test("returns zeros when the firm has no documents", async () => {
    const db = fakeDb({ rows: [{}] });
    const result = await getDocumentPipeline(db, { firmId: FIRM_ID });
    expect(Object.values(result).every((n) => n === 0)).toBe(true);
  });
});

describe("getReviewQueue", () => {
  test("maps rows and keeps a missing confidence as null rather than 0", async () => {
    const db = fakeDb({
      rows: [
        {
          id: "doc-1",
          file_name: "IMG_2231.jpg",
          doc_type: "invoice",
          status: "review_required",
          uploaded_at: "2026-09-20T10:00:00.000Z",
          client_id: "client-1",
          client_name: "Patel Hardware",
          confidence_score: null
        },
        {
          id: "doc-2",
          file_name: "bill_0417.pdf",
          doc_type: "bill",
          status: "extracted",
          uploaded_at: "2026-09-21T10:00:00.000Z",
          client_id: "client-2",
          client_name: "Kumar & Sons",
          confidence_score: "0.62"
        }
      ]
    });

    const queue = await getReviewQueue(db, { firmId: FIRM_ID });

    expect(queue[0]).toMatchObject({ documentId: "doc-1", clientName: "Patel Hardware", confidence: null });
    expect(queue[1].confidence).toBe(0.62);
    expect(db.calls[0].params).toEqual([FIRM_ID, 8]);
  });
});

describe("getClientProgress", () => {
  test("derives clients without uploads from active clients minus clients with uploads", async () => {
    const db = fakeDb(
      {
        rows: [
          {
            id: "client-1",
            name: "Mehta Packaging",
            received: 12,
            approved: 9,
            awaiting_review: 3,
            last_upload_at: "2026-09-26T08:00:00.000Z"
          }
        ]
      },
      { rows: [{ with_uploads: 4, active_clients: 10 }] }
    );

    const progress = await getClientProgress(db, { firmId: FIRM_ID });

    expect(progress.clients).toEqual([
      {
        clientId: "client-1",
        clientName: "Mehta Packaging",
        received: 12,
        approved: 9,
        awaitingReview: 3,
        lastUploadAt: "2026-09-26T08:00:00.000Z"
      }
    ]);
    expect(progress).toMatchObject({ activeClients: 10, clientsWithUploads: 4, clientsWithoutUploads: 6 });
  });

  test("never reports a negative number of clients without uploads", async () => {
    const db = fakeDb({ rows: [] }, { rows: [{ with_uploads: 5, active_clients: 3 }] });
    const progress = await getClientProgress(db, { firmId: FIRM_ID });
    expect(progress.clientsWithoutUploads).toBe(0);
  });
});

describe("getDocumentTrend", () => {
  test("coerces counts to numbers and asks for 14 days by default", async () => {
    const db = fakeDb({
      rows: [
        { date: "2026-09-26", received: "4", approved: "2" },
        { date: "2026-09-27", received: 0, approved: null }
      ]
    });

    await expect(getDocumentTrend(db, { firmId: FIRM_ID })).resolves.toEqual([
      { date: "2026-09-26", received: 4, approved: 2 },
      { date: "2026-09-27", received: 0, approved: 0 }
    ]);
    expect(db.calls[0].params).toEqual([FIRM_ID, 14]);
  });
});

describe("getRecentActivity", () => {
  test("only asks for work events, never security events", async () => {
    const db = fakeDb({ rows: [] });
    await getRecentActivity(db, { firmId: FIRM_ID });

    const [, actions] = db.calls[0].params;
    expect(actions).toEqual(ACTIVITY_ACTIONS);
    expect(actions).not.toEqual(expect.arrayContaining(["login_success"]));
    expect(actions.some((action) => /login|password/.test(action))).toBe(false);
  });

  test("maps joined names and parses the export document count", async () => {
    const db = fakeDb({
      rows: [
        {
          id: "log-1",
          action: "tally_export_generated",
          entity_type: "tally_export",
          entity_id: "export-1",
          created_at: "2026-09-27T06:00:00.000Z",
          document_count: "7",
          user_name: "Demo Admin",
          client_id: "client-1",
          client_name: "Mehta Packaging",
          file_name: null
        }
      ]
    });

    const [entry] = await getRecentActivity(db, { firmId: FIRM_ID });
    expect(entry).toMatchObject({
      action: "tally_export_generated",
      userName: "Demo Admin",
      clientName: "Mehta Packaging",
      fileName: null,
      documentCount: 7
    });
  });
});

describe("getDashboardInsights", () => {
  test("runs every section inside the same db handle and returns them together", async () => {
    const db = fakeDb(
      { rows: [{ queued: 0, processing: 0, awaiting_review: 1, ready_to_export: 0, exported: 0, failed: 0 }] },
      { rows: [] },
      { rows: [] },
      { rows: [{ with_uploads: 0, active_clients: 2 }] },
      { rows: [] },
      { rows: [] }
    );

    const insights = await getDashboardInsights(db, { firmId: FIRM_ID });

    expect(Object.keys(insights).sort()).toEqual(
      ["activity", "clientProgress", "pipeline", "reviewQueue", "trend"].sort()
    );
    expect(insights.pipeline.awaitingReview).toBe(1);
    expect(insights.clientProgress.clientsWithoutUploads).toBe(2);
    expect(db.query).toHaveBeenCalledTimes(6);
    db.calls.forEach((call) => expect(call.params[0]).toBe(FIRM_ID));
  });
});
