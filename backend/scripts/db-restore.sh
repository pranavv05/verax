#!/usr/bin/env bash
# Restore a Verax pg_dump archive into an EMPTY database, then make sure every
# table with Row Level Security also has FORCE ROW LEVEL SECURITY.
#
# The FORCE step matters: a dump taken by db-backup.sh as the owner role
# records the tables as NO FORCE, and on managed Postgres the app connects as
# that owner — without FORCE, RLS would not apply to it and firms could read
# each other's data. (The backend refuses to start in that state anyway.)
#
# Usage: DATABASE_URL=postgres://owner@host/empty_db backend/scripts/db-restore.sh backup.dump
# Then point the app at that database and run `npm run migrate:latest`
# (a no-op if the dump is from the same version).
set -euo pipefail

URL="${DATABASE_URL:?set DATABASE_URL to the (empty) target database}"
DUMP="${1:?usage: db-restore.sh <file.dump>}"
q() { psql "$URL" -v ON_ERROR_STOP=1 -tAqc "$1"; }

existing="$(q "SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'")"
if [ "$existing" != "0" ]; then
  echo "Refusing: the target database already has $existing table(s). Restore into an empty database." >&2
  exit 1
fi

pg_restore --no-owner --exit-on-error -d "$URL" "$DUMP"

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
echo "restore ok: $(q "SELECT count(*) FROM knex_migrations") migrations, $forced tables with FORCE ROW LEVEL SECURITY"
