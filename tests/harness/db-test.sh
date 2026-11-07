#!/bin/bash
# Database security suite on a scratch database (Supabase auth/storage stand-in + migrations).
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/config.sh"
$P -c "drop database if exists hr_db_test with (force)" -c "create database hr_db_test"
$P -d hr_db_test -f "$REPO/tests/harness/db-shim.sql"
for f in "$REPO"/supabase/migrations/*.sql "$REPO/supabase/seed.sql"; do $P -d hr_db_test -f "$f"; done
out=$($P -d hr_db_test -o /dev/null -f "$REPO/supabase/tests/security_test.sql" 2>&1) || { echo "$out" | tail -20; exit 1; }
echo "$out" | grep -q "All security & workflow tests passed" || { echo "$out" | tail -20; exit 1; }
echo "database: $(echo "$out" | grep -c 'NOTICE:  ok') checks passed"
