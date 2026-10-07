#!/usr/bin/env bash
# Database tests: build a scratch database from the live-schema snapshot,
# apply every migration dated after it, then run the SQL test suites.
#
#   TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/postgres pnpm test:db
#
# TEST_DATABASE_URL must point at a disposable Postgres 17 server: a database
# named forge_db_test is dropped and recreated on it. Never point it at a
# real project.
set -euo pipefail

: "${TEST_DATABASE_URL:?Set TEST_DATABASE_URL to a disposable Postgres server}"
case "$TEST_DATABASE_URL" in
  *supabase.co*|*supabase.com*) echo "Refusing to run against a Supabase project." >&2; exit 1 ;;
esac

here="$(cd "$(dirname "$0")/.." && pwd)"
tests="$here/supabase/tests"
migrations="$here/supabase/migrations"
snapshot="$tests/fixtures/public_schema_2026-10-08.sql"
baseline_date="20261008"
db="forge_db_test"

admin_url="$TEST_DATABASE_URL"
test_url="${TEST_DATABASE_URL%/*}/$db"
# Quiet NOTICEs; any SQL error stops the run (set -e).
psql_q() { PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning" psql -X -q -v ON_ERROR_STOP=1 "$@"; }

psql_q "$admin_url" -c "drop database if exists $db" -c "create database $db"

echo "→ Supabase stubs and live-schema snapshot"
psql_q "$test_url" -f "$tests/fixtures/supabase_stubs.sql"
PGOPTIONS='-c search_path=public,extensions' psql_q "$test_url" -f "$snapshot"

echo "→ Migrations after $baseline_date"
for f in "$migrations"/*.sql; do
  name="$(basename "$f")"
  if [[ "${name:0:8}" > "$baseline_date" || "${name:0:8}" == "$baseline_date" ]]; then
    echo "  $name"
    psql_q "$test_url" -f "$f"
  fi
done

echo "→ Test suites"
for t in "$tests"/*.sql; do
  echo "  $(basename "$t")"
  psql -X -v ON_ERROR_STOP=1 "$test_url" -f "$t" 2>&1 | grep -E 'FAIL|ERROR|PASSED' | sed 's/^psql:[^:]*:[0-9]*: //'
  [[ ${PIPESTATUS[0]} -eq 0 ]] || { echo "Database tests failed." >&2; exit 1; }
done

psql_q "$admin_url" -c "drop database if exists $db"
