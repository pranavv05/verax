#!/usr/bin/env bash
# Restore a Verax backup into an EMPTY database, then verify that every table
# with Row Level Security also has FORCE ROW LEVEL SECURITY.
#
# Accepts either format db-backup.sh writes:
#   - .vxbak (owner-role backup): schema + data + sequences, loaded in ONE
#     transaction, so a failed restore leaves the database empty, not half-full.
#     Row counts are checked against the backup's manifest.
#   - pg_dump custom format (superuser backup, or any pg_dump -Fc).
#
# The FORCE check matters: on managed Postgres the app connects as the table
# owner, and without FORCE, RLS would not apply to it — firms could read each
# other's data. (The backend refuses to start in that state anyway.)
#
# Usage: DATABASE_URL=postgres://owner@host/empty_db backend/scripts/db-restore.sh <backup>
# Then point the app at that database; `npm run migrate:latest` is a no-op if
# the backup came from the same version.
set -euo pipefail

URL="${DATABASE_URL:?set DATABASE_URL to the (empty) target database}"
BACKUP="${1:?usage: db-restore.sh <backup file>}"
q() { psql "$URL" -X -v ON_ERROR_STOP=1 -tAqc "$1"; }

existing="$(q "SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'")"
if [ "$existing" != "0" ]; then
  echo "Refusing: the target database already has $existing table(s). Restore into an empty database." >&2
  exit 1
fi

if pg_restore --list "$BACKUP" > /dev/null 2>&1; then
  pg_restore --no-owner --exit-on-error -d "$URL" "$BACKUP"
else
  WORK="$(mktemp -d)"
  trap 'rm -rf "$WORK"' EXIT
  tar -xzf "$BACKUP" -C "$WORK"
  grep -q $'^format\tverax-backup-1$' "$WORK/VERSION" || { echo "Not a Verax backup: $BACKUP" >&2; exit 1; }
  # Row counts are checked inside the same transaction, after the data load
  # and before post-data turns RLS on: any mismatch aborts the whole restore.
  {
    echo "DO \$verify\$ BEGIN"
    while IFS=$'\t' read -r table expected; do
      echo "  IF (SELECT count(*) FROM $table) <> $expected THEN"
      echo "    RAISE EXCEPTION 'row count mismatch in %: expected $expected', '$table';"
      echo "  END IF;"
    done < "$WORK/manifest.tsv"
    echo "END \$verify\$;"
  } > "$WORK/verify.sql"
  # \copy paths in load.sql are relative to the backup directory.
  (cd "$WORK" && psql "$URL" -X -q -v ON_ERROR_STOP=1 --single-transaction \
    -f pre-data.sql -f load.sql -f sequences.sql -f verify.sql -f post-data.sql > /dev/null)
  echo "data ok: $(wc -l < "$WORK/manifest.tsv" | tr -d ' ') tables, row counts match the backup"
fi

# Older backups (or a pg_dump taken while FORCE was lifted) may lack FORCE.
q "DO \$\$
DECLARE t record;
BEGIN
  FOR t IN SELECT n.nspname, c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE c.relkind = 'r' AND c.relrowsecurity AND NOT c.relforcerowsecurity
  LOOP
    EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', t.nspname, t.relname);
  END LOOP;
END \$\$;"

missing="$(q "SELECT count(*) FROM pg_class WHERE relkind = 'r' AND relrowsecurity AND NOT relforcerowsecurity")"
forced="$(q "SELECT count(*) FROM pg_class WHERE relkind = 'r' AND relforcerowsecurity")"
if [ "$missing" != "0" ] || [ "$forced" = "0" ]; then
  echo "!!! Restore finished but FORCE ROW LEVEL SECURITY is not in place ($missing missing, $forced forced)." >&2
  exit 1
fi
# Fresh tables have no planner statistics: without this, pages that take
# 0.2s can take 5s+ until autovacuum gets round to them.
q "SET client_min_messages = error; ANALYZE" > /dev/null
echo "restore ok: $(q "SELECT count(*) FROM knex_migrations") migrations, $forced tables with FORCE ROW LEVEL SECURITY"
