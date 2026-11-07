-- Run ONCE in the Supabase SQL Editor after deploying the send-emails and maintenance functions.
-- 1) Enable extensions (or via Dashboard → Database → Extensions)
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- 2) Store the function URLs + shared secret in Vault (replace the placeholders)
select vault.create_secret('https://<PROJECT-REF>.supabase.co/functions/v1/send-emails', 'email_worker_url');
select vault.create_secret('https://<PROJECT-REF>.supabase.co/functions/v1/maintenance', 'maintenance_url');
select vault.create_secret('<SAME VALUE AS THE EMAIL_WORKER_SECRET FUNCTION SECRET>',     'email_worker_secret');

-- 3) Deliver queued emails every minute
select cron.schedule('drain-email-outbox', '* * * * *', $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'email_worker_url'),
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-worker-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'email_worker_secret')),
    body    := '{}'::jsonb)
$$);

-- 4) Daily maintenance at 03:17 UTC: abandoned uploads, retention, log pruning
select cron.schedule('daily-maintenance', '17 3 * * *', $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'maintenance_url'),
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-worker-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'email_worker_secret')),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000)
$$);

-- Check runs: select * from cron.job_run_details order by start_time desc limit 20;
