/**
 * Name Mapping Service
 *
 * Handles vendor item name → Tally item name mapping per firm.
 * Provides fuzzy matching using normalised Levenshtein distance.
 */

const FUZZY_THRESHOLD = 0.55;
const MAX_SUGGESTIONS = 3;

/* ──────────────────────────────── normalisation ─────────────────────────────── */

const normalise = (str) =>
  String(str || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/* ──────────────────────────── levenshtein distance ──────────────────────────── */

const levenshtein = (a, b) => {
  const la = a.length;
  const lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;

  const prev = new Uint16Array(lb + 1);
  const curr = new Uint16Array(lb + 1);

  for (let j = 0; j <= lb; j++) prev[j] = j;

  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    prev.set(curr);
  }

  return prev[lb];
};

const similarity = (a, b) => {
  const na = normalise(a);
  const nb = normalise(b);
  if (na === nb) return 1;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(na, nb) / maxLen;
};

/* ──────────────────────────────── DB functions ──────────────────────────────── */

const getFirmMappings = async (db, { firmId }) => {
  const result = await db.query(
    `SELECT vendor_raw, tally_name, use_count
     FROM item_name_mappings
     WHERE firm_id = $1
     ORDER BY use_count DESC`,
    [firmId]
  );
  return result.rows;
};

const upsertMapping = async (db, { firmId, vendorRaw, tallyName }) => {
  await db.query(
    `INSERT INTO item_name_mappings (firm_id, vendor_raw, tally_name, use_count)
     VALUES ($1, $2, $3, 1)
     ON CONFLICT (firm_id, vendor_raw) DO UPDATE SET
       tally_name = EXCLUDED.tally_name,
       use_count = item_name_mappings.use_count + 1,
       updated_at = NOW()`,
    [firmId, vendorRaw, tallyName]
  );
};

/* ─────────────────────────── in-memory lookup/match ─────────────────────────── */

const lookupInMemory = (mappings, vendorRaw) => {
  const key = normalise(vendorRaw);
  if (!key) return null;
  const match = mappings.find((m) => normalise(m.vendor_raw) === key);
  return match ? match.tally_name : null;
};

const fuzzyMatch = (mappings, query) => {
  const nq = normalise(query);
  if (!nq || mappings.length === 0) return [];

  const scored = [];
  const seen = new Set();

  for (const m of mappings) {
    if (seen.has(m.tally_name)) continue;

    const simVendor = similarity(nq, m.vendor_raw);
    const simTally = similarity(nq, m.tally_name);
    const score = Math.max(simVendor, simTally);

    if (score >= FUZZY_THRESHOLD) {
      scored.push({ tallyName: m.tally_name, score, useCount: m.use_count });
      seen.add(m.tally_name);
    }
  }

  scored.sort((a, b) => b.score - a.score || b.useCount - a.useCount);
  return scored.slice(0, MAX_SUGGESTIONS);
};

module.exports = {
  getFirmMappings,
  upsertMapping,
  lookupInMemory,
  fuzzyMatch,
  similarity
};
