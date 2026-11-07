#!/bin/bash
# Run every suite against a freshly reset backend. Assumes setup.sh, start.sh,
# web.sh and mobile.sh have run. Exit code is non-zero if any suite fails.
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/config.sh"
E2E="$REPO/tests/e2e"; failed=0
"$REPO/tests/harness/db-test.sh" || failed=1
for suite in auth apply hr mobile maintenance; do
  "$REPO/tests/harness/reset.sh" > "$HARNESS/reset-$suite.log" 2>&1 || { echo "reset failed before $suite"; tail -5 "$HARNESS/reset-$suite.log"; failed=1; continue; }
  file="$E2E/$suite.e2e.js"; [ -f "$file" ] || file="$E2E/$suite.e2e.mjs"
  if out=$(cd "$E2E" && HARNESS="$HARNESS" NODE_PATH="$HARNESS/node_modules" node "$file" 2>&1); then echo "$suite: $(echo "$out" | tail -1)"
  else echo "$suite: FAILED"; echo "$out" | tail -8; failed=1; fi
done
exit $failed
