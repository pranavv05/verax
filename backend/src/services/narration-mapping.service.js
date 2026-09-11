const ApiError = require("../utils/api-error");
const { withTenantTransaction } = require("../db/tenant-context");

const MATCH_TYPES = new Set(["exact", "contains", "starts_with"]);

const mapMapping = (row) => ({
  id: row.id,
  firmId: row.firm_id,
  narrationPattern: row.narration_pattern,
  ledgerName: row.ledger_name,
  matchType: row.match_type,
  usageCount: row.usage_count,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const assertMatchType = (matchType) => {
  if (!MATCH_TYPES.has(matchType)) {
    throw ApiError.badRequest("Invalid matchType");
  }
};

const matches = (narration, pattern, matchType) => {
  const lowerNarration = narration.toLowerCase();
  const lowerPattern = pattern.toLowerCase();
  if (matchType === "exact") return lowerNarration === lowerPattern;
  if (matchType === "starts_with") return lowerNarration.startsWith(lowerPattern);
  return lowerNarration.includes(lowerPattern);
};

const listMappings = async ({ firmId }) =>
  withTenantTransaction({ firmId }, async (db) => {
    const result = await db.query(
      `
        SELECT *
        FROM narration_mappings
        WHERE firm_id = $1
        ORDER BY usage_count DESC, updated_at DESC
      `,
      [firmId]
    );
    return result.rows.map(mapMapping);
  });

// Upserts on (firm_id, narration_pattern, match_type): repeat corrections for the
// same pattern update the ledger and bump usage_count instead of creating
// duplicate, conflicting rows for the same pattern.
const createMapping = async ({ firmId, narrationPattern, ledgerName, matchType, createdBy }) => {
  const pattern = String(narrationPattern || "").trim();
  const ledger = String(ledgerName || "").trim();
  if (!pattern) throw ApiError.badRequest("narrationPattern is required");
  if (!ledger) throw ApiError.badRequest("ledgerName is required");
  assertMatchType(matchType);

  return withTenantTransaction({ firmId }, async (db) => {
    const result = await db.query(
      `
        INSERT INTO narration_mappings (firm_id, narration_pattern, ledger_name, match_type, created_by)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (firm_id, narration_pattern, match_type)
        DO UPDATE SET
          ledger_name = EXCLUDED.ledger_name,
          usage_count = narration_mappings.usage_count + 1,
          updated_at = NOW()
        RETURNING *
      `,
      [firmId, pattern, ledger, matchType, createdBy ?? null]
    );
    return mapMapping(result.rows[0]);
  });
};

const deleteMapping = async ({ firmId, mappingId }) =>
  withTenantTransaction({ firmId }, async (db) => {
    const result = await db.query(
      `
        DELETE FROM narration_mappings
        WHERE id = $1
          AND firm_id = $2
        RETURNING *
      `,
      [mappingId, firmId]
    );
    if (result.rowCount === 0) throw ApiError.notFound("Mapping not found");
    return mapMapping(result.rows[0]);
  });

// Applies a firm's saved mappings to a batch of narrations without an LLM call.
// Each narration can match several stored patterns, so candidates are ranked
// exact > starts_with > contains, then by longest pattern (the most specific
// match), then by usage_count — the same "most specific wins" idea the invoice
// column-detection code already uses.
const applyMappings = async ({ firmId, narrations }) => {
  const mappings = await listMappings({ firmId });
  const typeRank = { exact: 0, starts_with: 1, contains: 2 };

  return narrations.map((narration) => {
    const text = String(narration || "");
    const candidates = mappings.filter((mapping) => matches(text, mapping.narrationPattern, mapping.matchType));
    if (candidates.length === 0) {
      return { narration: text, ledgerName: null, matched: false, mappingId: null };
    }

    candidates.sort((a, b) => {
      const rankDiff = typeRank[a.matchType] - typeRank[b.matchType];
      if (rankDiff !== 0) return rankDiff;
      const lengthDiff = b.narrationPattern.length - a.narrationPattern.length;
      if (lengthDiff !== 0) return lengthDiff;
      return b.usageCount - a.usageCount;
    });

    const best = candidates[0];
    return { narration: text, ledgerName: best.ledgerName, matched: true, mappingId: best.id };
  });
};

module.exports = {
  listMappings,
  createMapping,
  deleteMapping,
  applyMappings
};
