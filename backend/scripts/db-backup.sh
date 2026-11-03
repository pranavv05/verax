#!/usr/bin/env bash
# Logical backup (pg_dump custom format) of the Verax database.
#
# Why this script exists: on managed Postgres (Render and most others) the
# only role you get is the database OWNER, not a superuser. Every tenant table
# has FORCE ROW LEVEL SECURITY, which binds the owner too, so a plain
# `pg_dump` as that role fails ("query would be affected by row-level
# security policy"), and `pg_dump --enable-row-security` is worse: with no
# firm selected it writes a dump with ZERO tenant rows and exits 0.
#
# So, when the role is not a superuser / BYPASSRLS, this script lifts FORCE
# RLS, dumps, and puts FORCE back (also on error or Ctrl-C), then checks it
# really is back. While FORCE is lifted, RLS does not bind the owner role —
# and on Render the app connects as that role. STOP the backend and worker
# first (Render: suspend both services). The script also refuses while it can
# see another session of the role, but an idle app may hold no connection at
# that moment, so that check is a backstop, not a substitute. ALLOW_LIVE=1
# skips it, accepting the window knowingly.
#
# The dump records the tables as NO FORCE (that is how they were while it
# ran). Restore it with backend/scripts/db-restore.sh, which puts FORCE back;
# the backend also refuses to start if any RLS table it owns lacks FORCE.
#
# Superuser / BYPASSRLS roles (self-hosted docker-compose) dump directly.
#
# Usage:  DATABASE_URL=postgres://... backend/scripts/db-backup.sh [output.dump]
# Restore: DATABASE_URL=postgres://... backend/scripts/db-restore.sh output.dump
# Uploaded documents live in S3, not in this dump — back the bucket up
# separately (S3 versioning or replication).
set -euo pipefail

URL="${DATABASE_URL:?set DATABASE_URL to the database owner connection string}"
OUT="${1:-verax-$(date -u +%Y%m%dT%H%M%SZ).dump}"
q() { psql "$URL" -v ON_ERROR_STOP=1 -tAqc "$1"; }

if [ "$(q "SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user")" = "t" ]; then
  pg_dump --format=custom --file="$OUT.partial" "$URL"
  mv "$OUT.partial" "$OUT"
  pg_restore --list "$OUT" > /dev/null
  echo "backup ok: $OUT"
  exit 0
fi

others="$(q "SELECT count(*) FROM pg_stat_activity WHERE usename = current_user AND datname = current_database() AND pid <> pg_backend_pid()")"
if [ "$others" != "0" ] && [ "${ALLOW_LIVE:-}" != "1" ]; then
  echo "Refusing: $others other session(s) are connected as this role (the backend/worker?)." >&2
  echo "Row Level Security is lifted for this role while the dump runs. Stop the backend and" >&2
  echo "worker first, or re-run with ALLOW_LIVE=1 to accept that window." >&2
  exit 1
fi

tables="$(q "SELECT string_agg(format('%I.%I', n.nspname, c.relname), ',' ORDER BY c.relname)
             FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE c.relkind = 'r' AND c.relforcerowsecurity")"
if [ -z "$tables" ]; then
  echo "No FORCE RLS tables found — refusing, this does not look like a Verax database." >&2
  exit 1
fi

alter_all() {
  local mode="$1" sql="" t
  IFS=',' read -ra list <<< "$tables"
  for t in "${list[@]}"; do sql+="ALTER TABLE $t $mode ROW LEVEL SECURITY;"; done
  psql "$URL" -v ON_ERROR_STOP=1 -q -1 -c "$sql"
}

restore_force() {
  local status=$?
  trap - EXIT INT TERM
  if alter_all FORCE; then
    local missing
    missing="$(q "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                  WHERE format('%I.%I', n.nspname, c.relname) = ANY (string_to_array('$tables', ','))
                    AND NOT c.relforcerowsecurity")"
    if [ "$missing" = "0" ]; then
      echo "FORCE ROW LEVEL SECURITY restored on all tables."
    else
      echo "!!! $missing table(s) still lack FORCE ROW LEVEL SECURITY. Fix before restarting the app:" >&2
      echo "!!!   run this script's FORCE step again, or ALTER TABLE <t> FORCE ROW LEVEL SECURITY" >&2
      status=1
    fi
  else
    echo "!!! Could not restore FORCE ROW LEVEL SECURITY. Before restarting the app, run for each of:" >&2
    echo "!!!   $tables" >&2
    echo "!!!   ALTER TABLE <table> FORCE ROW LEVEL SECURITY;" >&2
    status=1
  fi
  exit "$status"
}

trap restore_force EXIT INT TERM
alter_all "NO FORCE"
pg_dump --format=custom --file="$OUT.partial" "$URL"
mv "$OUT.partial" "$OUT"
pg_restore --list "$OUT" > /dev/null
echo "backup ok: $OUT"
