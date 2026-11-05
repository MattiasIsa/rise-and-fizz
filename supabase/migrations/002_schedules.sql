-- Timers that make notifications and the daily fact happen.
-- Before running: store the cron secret in Vault (the same value as the CRON_SECRET function secret):
--   select vault.create_secret('<your cron secret>', 'cron_secret');
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobname) from cron.job where jobname in ('rf-send-reminders', 'rf-daily-fact');

-- Every minute: send push notifications for anything that's due.
select cron.schedule('rf-send-reminders', '* * * * *', $$
  select net.http_post(
    url := 'https://dmczyqpmcmykrnnmujga.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body := '{}'::jsonb
  );
$$);

-- Every morning at 06:00 UTC (07:00 in Stockholm in winter): a fresh fact for everyone.
select cron.schedule('rf-daily-fact', '0 6 * * *', $$
  select net.http_post(
    url := 'https://dmczyqpmcmykrnnmujga.supabase.co/functions/v1/daily-fact',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body := '{"kind":"fact"}'::jsonb
  );
$$);
