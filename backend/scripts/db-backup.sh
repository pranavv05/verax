#!/usr/bin/env bash
# Logical backup of the Verax database, safe to run while the app is live.
#
# Why this script exists: on managed Postgres (Render and most others) the
# only role you get is the database OWNER, not a superuser. Every tenant table
# has FORCE ROW LEVEL SECURITY, which binds the owner too, so a plain
# `pg_dump` as that role fails ("query would be affected by row-level
# security policy"), and `pg_dump --enable-row-security` is worse: with no
# firm selected it writes a dump with ZERO tenant rows and exits 0.
#
# How it works for an owner role:
#   - schema: pg_dump --schema-only (reads no rows, so RLS doesn't apply);
#   - data: one shared snapshot is exported, then each table is copied in its
#     own transaction that imports that snapshot, lifts FORCE RLS, copies,
#     and ROLLS BACK. The lifted FORCE is never committed: no other session
#     ever sees it, and a crash or kill mid-backup leaves nothing to undo.
#     Every table is read at the same instant, so the backup is consistent.
#   - Lifting FORCE takes an exclusive lock on that one table for as long as
#     its copy runs, so app requests touching it wait (not fail) meanwhile.
#     lock_timeout stops the backup, rather than the app, from waiting long.
#
# Superuser / BYPASSRLS roles (self-hosted docker-compose) use pg_dump -Fc.
#
# Usage:   DATABASE_URL=postgres://... backend/scripts/db-backup.sh [output]
# Restore: DATABASE_URL=postgres://<empty db> backend/scripts/db-restore.sh <output>
# Uploaded documents live in S3, not in this backup — enable S3 versioning.
set -euo pipefail

URL="${DATABASE_URL:?set DATABASE_URL to the database owner connection string}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
LOCK_TIMEOUT="${BACKUP_LOCK_TIMEOUT:-15s}"
q() { psql "$URL" -X -v ON_ERROR_STOP=1 -tAqc "$1"; }

if [ "$(q "SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user")" = "t" ]; then
  OUT="${1:-verax-$STAMP.dump}"
  pg_dump --format=custom --file="$OUT.partial" "$URL"
  mv "$OUT.partial" "$OUT"
  pg_restore --list "$OUT" > /dev/null
  echo "backup ok: $OUT (pg_dump custom format)"
  exit 0
fi

OUT="${1:-verax-$STAMP.vxbak}"
WORK="$(mktemp -d)"
cleanup() {
  local status=$?
  if [ -n "${HOLD_PID:-}" ]; then kill "$HOLD_PID" 2> /dev/null || true; fi
  rm -rf "$WORK"
  [ "$status" = "0" ] || rm -f "$OUT.partial"
  exit "$status"
}
trap cleanup EXIT INT TERM
mkdir -p "$WORK/data"

# 1. Hold one snapshot open for the whole backup.
coproc HOLD { psql "$URL" -X -v ON_ERROR_STOP=1 -tAq; }
echo "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SELECT pg_export_snapshot();" >&"${HOLD[1]}"
read -r -t 30 SNAPSHOT <&"${HOLD[0]}" || { echo "could not export a snapshot" >&2; exit 1; }

# 2. Schema, from that same snapshot. No ownership, so it restores as any role.
pg_dump "$URL" --snapshot="$SNAPSHOT" --no-owner --section=pre-data --file="$WORK/pre-data.sql"
pg_dump "$URL" --snapshot="$SNAPSHOT" --no-owner --section=post-data --file="$WORK/post-data.sql"

# 3. Data, one table per rolled-back transaction on the shared snapshot.
: > "$WORK/load.sql"
: > "$WORK/manifest.tsv"
n=0
while IFS='|' read -r qualified forced; do
  [ -n "$qualified" ] || continue
  n=$((n + 1))
  file="data/$n.copy"
  lift=""
  [ "$forced" = "t" ] && lift="ALTER TABLE $qualified NO FORCE ROW LEVEL SECURITY;"
  psql "$URL" -X -v ON_ERROR_STOP=1 -tAq > /dev/null <<SQL
BEGIN ISOLATION LEVEL REPEATABLE READ;
SET TRANSACTION SNAPSHOT '$SNAPSHOT';
SET LOCAL lock_timeout = '$LOCK_TIMEOUT';
$lift
\\copy $qualified TO '$WORK/$file'
ROLLBACK;
SQL
  # Text-format COPY escapes newlines inside values: one line per row.
  rows="$(wc -l < "$WORK/$file" | tr -d ' ')"
  printf '\\copy %s FROM %s\n' "$qualified" "'$file'" >> "$WORK/load.sql"
  printf '%s\t%s\n' "$qualified" "$rows" >> "$WORK/manifest.tsv"
done < <(q "SELECT format('%I.%I', n.nspname, c.relname), c.relforcerowsecurity
             FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE c.relkind IN ('r', 'p')
               AND n.nspname NOT IN ('pg_catalog', 'information_schema')
               AND n.nspname NOT LIKE 'pg_toast%'
               AND NOT EXISTS (SELECT 1 FROM pg_depend dep
                               WHERE dep.objid = c.oid AND dep.deptype = 'e')
             ORDER BY 1")

# 4. Sequence positions (not covered by the snapshot; read at the end, so
#    they are never behind the copied rows).
q "SELECT format('SELECT pg_catalog.setval(%L, %s, %s);', format('%I.%I', schemaname, sequencename), last_value, 'true')
     FROM pg_sequences WHERE last_value IS NOT NULL" > "$WORK/sequences.sql"

echo "COMMIT;" >&"${HOLD[1]}"
exec {HOLD[1]}>&-
wait "$HOLD_PID" 2> /dev/null || true
HOLD_PID=""

printf 'format\tverax-backup-1\ncreated\t%s\ntables\t%s\n' "$STAMP" "$n" > "$WORK/VERSION"
tar -czf "$OUT.partial" -C "$WORK" VERSION manifest.tsv pre-data.sql load.sql sequences.sql post-data.sql data
mv "$OUT.partial" "$OUT"
total="$(awk -F'\t' '{s += $2} END {print s + 0}' "$WORK/manifest.tsv")"
echo "backup ok: $OUT ($n tables, $total rows)"
