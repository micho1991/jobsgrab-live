#!/bin/bash
# Fresh database with this repo's migrations, then (re)start Auth, PostgREST,
# the gateway (incl. Storage emulation), both Edge Functions and the mobile web server.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/config.sh"
cd "$HARNESS"
pkill -x auth || true; pkill -x postgrest || true
kill_matching "gateway.js"; kill_matching "spa.js"; kill_matching "deno run"; sleep 1
$P -c "drop database if exists sb with (force)" -c "create database sb"
$P -d sb <<'SQL'
alter role supabase_auth_admin set search_path = auth;
create schema auth authorization supabase_auth_admin;
create schema extensions; create schema storage;
grant usage on schema public, extensions, storage, auth to anon, authenticated, service_role;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner_id text, metadata jsonb, created_at timestamptz not null default now());
create unique index objects_bucket_name on storage.objects (bucket_id, name);
alter table storage.objects enable row level security;
grant all on storage.objects to authenticated, service_role;
create function storage.foldername(name text) returns text[] language sql immutable as $f$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $f$;
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
SQL
(set -a; . ./gotrue.env; set +a; setsid nohup ./auth > auth.log 2>&1 &)
wait_for http://127.0.0.1:9999/health
for f in "$REPO"/supabase/migrations/*.sql "$REPO/supabase/seed.sql"; do $P -d sb -f "$f"; done
(setsid nohup ./postgrest postgrest.conf > postgrest.log 2>&1 &)
wait_for http://127.0.0.1:3001/
rm -rf mail files; mkdir -p mail shots
(HARNESS="$HARNESS" setsid nohup node gateway.js > gateway.log 2>&1 &)
rm -rf fn && cp -r "$REPO/supabase/functions" fn
start_fn() { # $1 = function, $2 = port
  (cd fn && set -a && . "$HARNESS/functions.env" && set +a && DENO_SERVE_ADDRESS="tcp:127.0.0.1:$2" \
    setsid nohup "$DENO" run --node-modules-dir=none --allow-net --allow-env --allow-read --import-map="$HARNESS/import_map.json" "$1/index.ts" > "$HARNESS/fn-$1.log" 2>&1 &)
}
start_fn process-deletion 8000; start_fn maintenance 8001
wait_for http://127.0.0.1:8000/ 240; wait_for http://127.0.0.1:8001/ 240
[ -d dist-web ] && (HARNESS="$HARNESS" setsid nohup node spa.js > spa.log 2>&1 &)
wait_for http://localhost:54321/rest/v1/ 20
echo "backend reset: auth, postgrest, gateway, functions up"
