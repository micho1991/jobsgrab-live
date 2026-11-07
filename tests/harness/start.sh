#!/bin/bash
# Start Postgres, the SMTP sink and the auth-email template server.
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/config.sh"
cd "$HARNESS"
as_pg "$PGBIN/pg_ctl -D $HARNESS/pgdata -l $HARNESS/postgres.log -o '-k /tmp -c listen_addresses=localhost' -w start" >/dev/null 2>&1 || true
psql -h /tmp -U postgres -Atqc "select 1" >/dev/null || { echo "Postgres did not start"; exit 1; }
psql -h /tmp -U postgres -q <<'SQL' 2>/dev/null
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then create role authenticator login noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then create role supabase_auth_admin login superuser; end if;
end $$;
grant anon, authenticated, service_role to authenticator;
SQL
kill_matching "smtp_sink.py"; (HARNESS="$HARNESS" setsid nohup python3 smtp_sink.py > smtp.log 2>&1 &)
kill_matching "http.server 8011"; (cd "$REPO/supabase/templates" && setsid nohup python3 -m http.server 8011 --bind 127.0.0.1 > "$HARNESS/templates.log" 2>&1 &)
sleep 1; echo "postgres, smtp sink and templates up"
