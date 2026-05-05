const { withTenantTransaction } = require("../db/tenant-context");
const ApiError = require("../utils/api-error");

const mapVersionListRow = (row) => ({
  id: row.id,
  documentId: row.document_id,
  versionNumber: row.version_number,
  snapshotReason: row.snapshot_reason,
  createdBy: row.created_by,
  createdByName: row.created_by_name,
  createdAt: row.created_at
});

const mapVersionDetailRow = (row) => ({
  ...mapVersionListRow(row),
  extractedData: row.extracted_data || {}
});

const snapshotDocument = async ({
  documentId,
  extractedData,
  snapshotReason,
  createdBy = null,
  trx = null
}) => {
  const run = async (db) => {
    const maxResult = await db.query(
      `
        SELECT COALESCE(MAX(version_number), 0)::int AS max_version
        FROM document_versions
        WHERE document_id = $1
      `,
      [documentId]
    );
    const versionNumber = Number(maxResult.rows[0]?.max_version || 0) + 1;

    const insertResult = await db.query(
      `
        INSERT INTO document_versions (
          document_id,
          version_number,
          extracted_data,
          snapshot_reason,
          created_by
        ) VALUES ($1, $2, $3::jsonb, $4, $5)
        RETURNING id, document_id, version_number, snapshot_reason, created_by, created_at, extracted_data
      `,
      [documentId, versionNumber, JSON.stringify(extractedData || {}), snapshotReason, createdBy]
    );

    return mapVersionDetailRow(insertResult.rows[0]);
  };

  if (trx) {
    return run(trx);
  }

  return withTenantTransaction({}, run);
};

const getVersionsForDocument = async ({ documentId, firmId }) =>
  withTenantTransaction({ firmId }, async (db) => {
    const result = await db.query(
      `
        SELECT
          v.id,
          v.document_id,
          v.version_number,
          v.snapshot_reason,
          v.created_by,
          u.name AS created_by_name,
          v.created_at
        FROM document_versions v
        JOIN documents d ON d.id = v.document_id
        LEFT JOIN users u ON u.id = v.created_by
        WHERE v.document_id = $1
          AND d.firm_id = $2
          AND d.deleted_at IS NULL
        ORDER BY v.version_number DESC
      `,
      [documentId, firmId]
    );

    return result.rows.map(mapVersionListRow);
  });

const getVersionDetail = async ({ versionId, documentId, firmId }) =>
  withTenantTransaction({ firmId }, async (db) => {
    const result = await db.query(
      `
        SELECT
          v.id,
          v.document_id,
          v.version_number,
          v.snapshot_reason,
          v.created_by,
          u.name AS created_by_name,
          v.created_at,
          v.extracted_data
        FROM document_versions v
        JOIN documents d ON d.id = v.document_id
        LEFT JOIN users u ON u.id = v.created_by
        WHERE v.id = $1
          AND v.document_id = $2
          AND d.firm_id = $3
          AND d.deleted_at IS NULL
        LIMIT 1
      `,
      [versionId, documentId, firmId]
    );

    if (result.rowCount === 0) {
      throw ApiError.notFound("Document version not found");
    }

    return mapVersionDetailRow(result.rows[0]);
  });

module.exports = {
  snapshotDocument,
  getVersionsForDocument,
  getVersionDetail
};
