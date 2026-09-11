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

module.exports = {
  getDashboardOverview
};
