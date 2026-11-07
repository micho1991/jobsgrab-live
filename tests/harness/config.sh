# Shared settings for the test harness. Override any of these via the environment.
REPO="${REPO:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
export HARNESS="${HARNESS:-/tmp/sb}"                 # working directory (binaries, logs, files, mail)
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
AUTH_VERSION="${AUTH_VERSION:-v2.197.0}"             # supabase/auth (GoTrue) release
POSTGREST_VERSION="${POSTGREST_VERSION:-v16.5}"
JWT_SECRET="super-secret-jwt-token-with-at-least-32-characters-long"   # test-only
CRON_SECRET="test-cron-secret"                       # test-only
P="psql -h /tmp -U postgres -v ON_ERROR_STOP=1 -q"
DENO="$HARNESS/node_modules/.bin/deno"
as_pg() { if [ "$(id -u)" = 0 ]; then su postgres -c "$*"; else bash -c "$*"; fi; }
wait_for() { for _ in $(seq 1 "${2:-60}"); do curl -s -o /dev/null "$1" && return 0; sleep 0.5; done; echo "timed out waiting for $1" >&2; return 1; }
kill_matching() { for pid in $(ps -eo pid,args | awk -v pat="$1" '$0 ~ pat && !/awk/ {print $1}'); do kill "$pid" 2>/dev/null || true; done; }
