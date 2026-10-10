#!/usr/bin/env bash
# Database tests: build a scratch database from the live-schema snapshot,
# apply every migration dated after it, then run the SQL test suites.
#
#   TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/postgres pnpm test:db
#   ... test-db.sh --prepare-only   build forge_db_test and keep it (used by the
#                                   Campus API integration tests); runs no suites
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

if [[ "${1:-}" == "--prepare-only" ]]; then
  echo "Prepared $test_url"
  exit 0
fi

echo "→ Test suites"
for t in "$tests"/*.sql; do
  echo "  $(basename "$t")"
  psql -X -v ON_ERROR_STOP=1 "$test_url" -f "$t" 2>&1 | grep -E 'FAIL|ERROR|PASSED' | sed 's/^psql:[^:]*:[0-9]*: //'
  [[ ${PIPESTATUS[0]} -eq 0 ]] || { echo "Database tests failed." >&2; exit 1; }
done

psql_q "$admin_url" -c "drop database if exists $db"

# Replay: the database as live will be once the older migrations it is missing
# (fixtures/missing_on_live.txt) are applied before the post-snapshot ones.
# Proves the whole sequence applies cleanly, then runs tests/replay/*.sql.
replay_db="forge_db_replay"
replay_url="${TEST_DATABASE_URL%/*}/$replay_db"
psql_q "$admin_url" -c "drop database if exists $replay_db" -c "create database $replay_db"
echo "→ Replay: snapshot + migrations missing on live + migrations after $baseline_date"
psql_q "$replay_url" -f "$tests/fixtures/supabase_stubs.sql"
PGOPTIONS='-c search_path=public,extensions' psql_q "$replay_url" -f "$snapshot"
while read -r name; do
  [[ -z "$name" || "$name" == \#* ]] && continue
  echo "  $name"
  psql_q "$replay_url" -f "$migrations/$name"
done < "$tests/fixtures/missing_on_live.txt"
for f in "$migrations"/*.sql; do
  name="$(basename "$f")"
  if [[ "${name:0:8}" > "$baseline_date" || "${name:0:8}" == "$baseline_date" ]]; then
    psql_q "$replay_url" -f "$f"
  fi
done
for t in "$tests"/replay/*.sql; do
  echo "  replay/$(basename "$t")"
  psql -X -v ON_ERROR_STOP=1 "$replay_url" -f "$t" 2>&1 | grep -E 'FAIL|ERROR|PASSED' | sed 's/^psql:[^:]*:[0-9]*: //'
  [[ ${PIPESTATUS[0]} -eq 0 ]] || { echo "Database tests failed." >&2; exit 1; }
done
psql_q "$admin_url" -c "drop database if exists $replay_db"
