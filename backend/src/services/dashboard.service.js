const getDashboardOverview = async (db, { firmId }) => {
  const result = await db.query(
    `
      WITH client_count AS (
        SELECT COUNT(*)::int AS n
        FROM clients
        WHERE firm_id = $1 AND deleted_at IS NULL
      ),
      awaiting_review AS (
        SELECT COUNT(*)::int AS n
        FROM documents
        WHERE firm_id = $1
          AND deleted_at IS NULL
          AND status IN ('extracted', 'review_required')
      ),
      approved_today AS (
        SELECT COUNT(*)::int AS n
        FROM extractions e
        JOIN documents d ON d.id = e.document_id
        WHERE d.firm_id = $1
          AND d.deleted_at IS NULL
          AND e.deleted_at IS NULL
          AND e.reviewed_at IS NOT NULL
          AND (e.reviewed_at AT TIME ZONE 'Asia/Kolkata')::date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date
      ),
      exports_this_month AS (
        SELECT COUNT(*)::int AS n
        FROM tally_exports
        WHERE firm_id = $1
          AND deleted_at IS NULL
          AND status <> 'failed'
          AND date_trunc('month', COALESCE(exported_at, created_at) AT TIME ZONE 'Asia/Kolkata')
              = date_trunc('month', NOW() AT TIME ZONE 'Asia/Kolkata')
      )
      SELECT
        (SELECT n FROM client_count) AS total_clients,
        (SELECT n FROM awaiting_review) AS awaiting_review,
        (SELECT n FROM approved_today) AS approved_today,
        (SELECT n FROM exports_this_month) AS exports_this_month
    `,
    [firmId]
  );

  const row = result.rows[0];
  return {
    totalClients: row.total_clients,
    awaitingReview: row.awaiting_review,
    approvedToday: row.approved_today,
    exportsThisMonth: row.exports_this_month
  };
};

// Everything below feeds the dashboard home. All of it is read-only and runs
// inside the caller's tenant transaction, so RLS scopes it to the firm as well
// as the explicit firm_id filters. Month and day boundaries are IST, matching
// getDashboardOverview.

const REVIEW_QUEUE_LIMIT = 8;
const CLIENT_PROGRESS_LIMIT = 6;
const ACTIVITY_LIMIT = 8;
const TREND_DAYS = 14;

// The work events a firm's staff care about day to day. Security events
// (logins, password resets) stay on the admin-only audit log page.
const ACTIVITY_ACTIONS = [
  "document_upload_confirmed",
  "document_processed",
  "document_processing_failed",
  "extraction_approved",
  "tally_export_generated",
  "bulk_export_generated",
  "client_created",
  "client_request_docs"
];

const getDocumentPipeline = async (db, { firmId }) => {
  const result = await db.query(
    `
      SELECT
        COUNT(*) FILTER (WHERE status = 'uploaded' AND processing_error IS NULL)::int AS queued,
        COUNT(*) FILTER (WHERE status = 'processing')::int AS processing,
        COUNT(*) FILTER (WHERE status IN ('extracted', 'review_required'))::int AS awaiting_review,
        COUNT(*) FILTER (WHERE status = 'reviewed')::int AS ready_to_export,
        COUNT(*) FILTER (WHERE status = 'exported')::int AS exported,
        COUNT(*) FILTER (WHERE status = 'uploaded' AND processing_error IS NOT NULL)::int AS failed
      FROM documents
      WHERE firm_id = $1 AND deleted_at IS NULL
    `,
    [firmId]
  );

  const row = result.rows[0] || {};
  return {
    queued: row.queued || 0,
    processing: row.processing || 0,
    awaitingReview: row.awaiting_review || 0,
    readyToExport: row.ready_to_export || 0,
    exported: row.exported || 0,
    failed: row.failed || 0
  };
};

const getReviewQueue = async (db, { firmId, limit = REVIEW_QUEUE_LIMIT }) => {
  // Flagged documents first, then the least confident, then the oldest.
  const result = await db.query(
    `
      SELECT d.id,
             d.file_name,
             d.doc_type,
             d.status,
             d.uploaded_at,
             c.id AS client_id,
             c.name AS client_name,
             e.confidence_score
      FROM documents d
      JOIN clients c ON c.id = d.client_id AND c.deleted_at IS NULL
      LEFT JOIN extractions e ON e.document_id = d.id AND e.deleted_at IS NULL
      WHERE d.firm_id = $1
        AND d.deleted_at IS NULL
        AND d.status IN ('extracted', 'review_required')
      ORDER BY (d.status = 'review_required') DESC,
               e.confidence_score ASC NULLS FIRST,
               d.uploaded_at ASC
      LIMIT $2
    `,
    [firmId, limit]
  );

  return result.rows.map((row) => ({
    documentId: row.id,
    fileName: row.file_name,
    docType: row.doc_type,
    status: row.status,
    uploadedAt: row.uploaded_at,
    clientId: row.client_id,
    clientName: row.client_name,
    confidence: row.confidence_score === null || row.confidence_score === undefined
      ? null
      : Number(row.confidence_score)
  }));
};

const getClientProgress = async (db, { firmId, limit = CLIENT_PROGRESS_LIMIT }) => {
  const result = await db.query(
    `
      WITH month_docs AS (
        SELECT client_id, status, uploaded_at
        FROM documents
        WHERE firm_id = $1
          AND deleted_at IS NULL
          AND date_trunc('month', uploaded_at AT TIME ZONE 'Asia/Kolkata')
              = date_trunc('month', NOW() AT TIME ZONE 'Asia/Kolkata')
      )
      SELECT c.id,
             c.name,
             COUNT(*)::int AS received,
             COUNT(*) FILTER (WHERE md.status IN ('reviewed', 'exported'))::int AS approved,
             COUNT(*) FILTER (WHERE md.status IN ('extracted', 'review_required'))::int AS awaiting_review,
             MAX(md.uploaded_at) AS last_upload_at
      FROM clients c
      JOIN month_docs md ON md.client_id = c.id
      WHERE c.firm_id = $1 AND c.deleted_at IS NULL
      GROUP BY c.id, c.name
      ORDER BY awaiting_review DESC, received DESC, c.name ASC
      LIMIT $2
    `,
    [firmId, limit]
  );

  const coverage = await db.query(
    `
      SELECT
        COUNT(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM documents d
          WHERE d.client_id = c.id
            AND d.deleted_at IS NULL
            AND date_trunc('month', d.uploaded_at AT TIME ZONE 'Asia/Kolkata')
                = date_trunc('month', NOW() AT TIME ZONE 'Asia/Kolkata')
        ))::int AS with_uploads,
        COUNT(*)::int AS active_clients
      FROM clients c
      WHERE c.firm_id = $1 AND c.deleted_at IS NULL AND c.status = 'active'
    `,
    [firmId]
  );

  const coverageRow = coverage.rows[0] || {};
  const activeClients = coverageRow.active_clients || 0;
  const withUploads = coverageRow.with_uploads || 0;

  return {
    clients: result.rows.map((row) => ({
      clientId: row.id,
      clientName: row.name,
      received: row.received,
      approved: row.approved,
      awaitingReview: row.awaiting_review,
      lastUploadAt: row.last_upload_at
    })),
    activeClients,
    clientsWithUploads: withUploads,
    clientsWithoutUploads: Math.max(0, activeClients - withUploads)
  };
};

const getDocumentTrend = async (db, { firmId, days = TREND_DAYS }) => {
  const result = await db.query(
    `
      WITH days AS (
        SELECT generate_series(
          (NOW() AT TIME ZONE 'Asia/Kolkata')::date - ($2::int - 1),
          (NOW() AT TIME ZONE 'Asia/Kolkata')::date,
          interval '1 day'
        )::date AS day
      ),
      received AS (
        SELECT (uploaded_at AT TIME ZONE 'Asia/Kolkata')::date AS day, COUNT(*)::int AS n
        FROM documents
        WHERE firm_id = $1
          AND deleted_at IS NULL
          AND uploaded_at >= NOW() - ($2::int + 1) * interval '1 day'
        GROUP BY 1
      ),
      approved AS (
        SELECT (e.reviewed_at AT TIME ZONE 'Asia/Kolkata')::date AS day, COUNT(*)::int AS n
        FROM extractions e
        JOIN documents d ON d.id = e.document_id
        WHERE d.firm_id = $1
          AND d.deleted_at IS NULL
          AND e.deleted_at IS NULL
          AND e.reviewed_at >= NOW() - ($2::int + 1) * interval '1 day'
        GROUP BY 1
      )
      SELECT to_char(days.day, 'YYYY-MM-DD') AS date,
             COALESCE(received.n, 0) AS received,
             COALESCE(approved.n, 0) AS approved
      FROM days
      LEFT JOIN received ON received.day = days.day
      LEFT JOIN approved ON approved.day = days.day
      ORDER BY days.day ASC
    `,
    [firmId, days]
  );

  return result.rows.map((row) => ({
    date: row.date,
    received: Number(row.received) || 0,
    approved: Number(row.approved) || 0
  }));
};

const getRecentActivity = async (db, { firmId, limit = ACTIVITY_LIMIT }) => {
  // metadata.clientId is free text; only cast it when it looks like a uuid
  // (same guard as the audit log page).
  const result = await db.query(
    `
      SELECT al.id,
             al.action,
             al.entity_type,
             al.entity_id,
             al.created_at,
             al.metadata ->> 'documentCount' AS document_count,
             u.name AS user_name,
             cl.id AS client_id,
             cl.name AS client_name,
             d.file_name
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id AND u.deleted_at IS NULL
      LEFT JOIN clients cl ON cl.id = (
        CASE
          WHEN al.metadata ->> 'clientId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            THEN (al.metadata ->> 'clientId')::uuid
          WHEN al.entity_type = 'client' THEN al.entity_id
        END
      ) AND cl.deleted_at IS NULL
      LEFT JOIN documents d
        ON al.entity_type = 'document' AND d.id = al.entity_id AND d.deleted_at IS NULL
      WHERE al.firm_id = $1
        AND al.deleted_at IS NULL
        AND al.action = ANY($2::text[])
      ORDER BY al.created_at DESC
      LIMIT $3
    `,
    [firmId, ACTIVITY_ACTIONS, limit]
  );

  return result.rows.map((row) => ({
    id: row.id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    createdAt: row.created_at,
    userName: row.user_name || null,
    clientId: row.client_id || null,
    clientName: row.client_name || null,
    fileName: row.file_name || null,
    documentCount: row.document_count === null || row.document_count === undefined
      ? null
      : Number(row.document_count)
  }));
};

const getDashboardInsights = async (db, { firmId }) => {
  // One pg client per transaction, so these run one after another.
  const pipeline = await getDocumentPipeline(db, { firmId });
  const reviewQueue = await getReviewQueue(db, { firmId });
  const clientProgress = await getClientProgress(db, { firmId });
  const trend = await getDocumentTrend(db, { firmId });
  const activity = await getRecentActivity(db, { firmId });

  return { pipeline, reviewQueue, clientProgress, trend, activity };
};

module.exports = {
  ACTIVITY_ACTIONS,
  getDashboardOverview,
  getDashboardInsights,
  getDocumentPipeline,
  getReviewQueue,
  getClientProgress,
  getDocumentTrend,
  getRecentActivity
};
