#!/bin/bash
# Build and start the Next.js app against the harness.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/config.sh"
source "$HARNESS/keys.env"
cd "$REPO/apps/web"
cat > .env.local <<CONF
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_COMPANY_NAME=Acme
NEXT_PUBLIC_PRIVACY_CONTACT=privacy@acme.test
CONF
kill_matching "next-server|next start"; sleep 1
NEXT_TELEMETRY_DISABLED=1 npx next build > "$HARNESS/web-build.log" 2>&1 || { tail -30 "$HARNESS/web-build.log"; exit 1; }
(setsid nohup npx next start -p 3000 > "$HARNESS/web.log" 2>&1 &)
wait_for http://localhost:3000/login && echo "web app up on :3000"
