#!/bin/bash
# One-time setup: downloads Supabase Auth + PostgREST, installs Deno and test
# dependencies, creates a Postgres cluster and writes config. Idempotent.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/config.sh"
mkdir -p "$HARNESS" && cd "$HARNESS"

[ -x auth ] || { curl -fsSL -o auth.tgz "https://github.com/supabase/auth/releases/download/$AUTH_VERSION/auth-$AUTH_VERSION-x86.tar.gz" && tar xzf auth.tgz && rm auth.tgz; }
[ -x postgrest ] || { curl -fsSL -o pgrst.tar.xz "https://github.com/PostgREST/postgrest/releases/download/$POSTGREST_VERSION/postgrest-$POSTGREST_VERSION-linux-static-x86-64.tar.xz" && tar xJf pgrst.tar.xz && rm pgrst.tar.xz; }
cp "$REPO/tests/harness/"{package.json,gateway.js,spa.js,smtp_sink.py} .
npm install --no-audit --no-fund --silent

if [ ! -f pgdata/PG_VERSION ]; then
  mkdir -p pgdata && [ "$(id -u)" = 0 ] && chown postgres "$HARNESS" pgdata
  as_pg "$PGBIN/initdb -D $HARNESS/pgdata -U postgres -A trust >/dev/null"
fi

node -e '
const c=require("crypto"),s=process.argv[1];
const b=o=>Buffer.from(JSON.stringify(o)).toString("base64url");
const t=p=>{const h=b({alg:"HS256",typ:"JWT"}),q=b(p);return h+"."+q+"."+c.createHmac("sha256",s).update(h+"."+q).digest("base64url")};
const exp=Math.floor(Date.now()/1000)+10*365*86400;
console.log("ANON="+t({role:"anon",iss:"supabase",exp}));console.log("SERVICE="+t({role:"service_role",iss:"supabase",exp}));' "$JWT_SECRET" > keys.env
source keys.env

cat > gotrue.env <<CONF
GOTRUE_DB_DRIVER=postgres
DATABASE_URL=postgres://supabase_auth_admin@localhost:5432/sb?sslmode=disable
GOTRUE_DB_NAMESPACE=auth
GOTRUE_DB_MIGRATIONS_PATH=$HARNESS/migrations
API_EXTERNAL_URL=http://localhost:54321/auth/v1
GOTRUE_API_HOST=127.0.0.1
PORT=9999
GOTRUE_SITE_URL=http://localhost:3000
GOTRUE_URI_ALLOW_LIST=http://localhost:3000/**
GOTRUE_JWT_SECRET=$JWT_SECRET
GOTRUE_JWT_EXP=3600
GOTRUE_JWT_AUD=authenticated
GOTRUE_JWT_ADMIN_ROLES=service_role
GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated
GOTRUE_DISABLE_SIGNUP=false
GOTRUE_EXTERNAL_EMAIL_ENABLED=true
GOTRUE_MAILER_AUTOCONFIRM=false
GOTRUE_MAILER_SECURE_EMAIL_CHANGE_ENABLED=true
GOTRUE_SMTP_HOST=localhost
GOTRUE_SMTP_PORT=2500
GOTRUE_SMTP_USER=sink
GOTRUE_SMTP_PASS=sink
GOTRUE_SMTP_ADMIN_EMAIL=noreply@acme.test
GOTRUE_SMTP_SENDER_NAME="Acme Careers"
GOTRUE_MAILER_TEMPLATES_CONFIRMATION=http://127.0.0.1:8011/confirmation.html
GOTRUE_MAILER_TEMPLATES_RECOVERY=http://127.0.0.1:8011/recovery.html
GOTRUE_MAILER_SUBJECTS_CONFIRMATION="Confirm your email address"
GOTRUE_MAILER_SUBJECTS_RECOVERY="Reset your password"
GOTRUE_PASSWORD_MIN_LENGTH=8
GOTRUE_PASSWORD_REQUIRED_CHARACTERS=abcdefghijklmnopqrstuvwxyz:ABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789
GOTRUE_RATE_LIMIT_EMAIL_SENT=1000
GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_REAUTHENTICATION=false
GOTRUE_EXTERNAL_GOOGLE_ENABLED=true
GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID=test-client.apps.googleusercontent.com
GOTRUE_EXTERNAL_GOOGLE_SECRET=test-secret
GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI=http://localhost:54321/auth/v1/callback
GOTRUE_LOG_LEVEL=warn
CONF

cat > postgrest.conf <<CONF
db-uri = "postgres://authenticator@localhost:5432/sb?sslmode=disable"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$JWT_SECRET"
server-host = "127.0.0.1"
server-port = 3001
CONF

cat > functions.env <<CONF
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=$ANON
SUPABASE_SERVICE_ROLE_KEY=$SERVICE
APP_URL=http://localhost:3000
EMAIL_WORKER_SECRET=$CRON_SECRET
CONF
supa_js=$(node -p "require('$REPO/apps/web/node_modules/@supabase/supabase-js/package.json').version")
echo "{\"imports\":{\"jsr:@supabase/supabase-js@2\":\"npm:@supabase/supabase-js@$supa_js\"}}" > import_map.json
echo "harness ready in $HARNESS"
