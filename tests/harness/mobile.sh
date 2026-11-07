#!/bin/bash
# Export the Expo app for web (the mobile e2e suite drives it at phone size).
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/config.sh"
source "$HARNESS/keys.env"
cd "$REPO/apps/mobile"
cat > .env <<CONF
EXPO_PUBLIC_SUPABASE_URL=http://localhost:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=$ANON
EXPO_PUBLIC_SITE_URL=http://localhost:3000
EXPO_PUBLIC_COMPANY_NAME=Acme
CONF
rm -rf "$HARNESS/dist-web"
EXPO_OFFLINE=1 CI=1 EXPO_NO_TELEMETRY=1 npx expo export --platform web --output-dir "$HARNESS/dist-web" > "$HARNESS/mobile-export.log" 2>&1 \
  || { tail -30 "$HARNESS/mobile-export.log"; exit 1; }
kill_matching "spa.js"; (cd "$HARNESS" && HARNESS="$HARNESS" setsid nohup node spa.js > spa.log 2>&1 &)
wait_for http://localhost:8082/ && echo "mobile web build up on :8082"
