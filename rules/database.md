# Database, backend and secrets

Supabase, notifications and where secrets live. Read before touching supabase/, api.js or store.js.

- **Supabase** (project `dmczyqpmcmykrnnmujga`):
  - RLS is on everywhere. Rows are yours or your household's (`rf_my_households()`), and `household_id` is set by trigger.
  - Schema changes go in as migrations. Avoid `drop` statements, because they get cancelled; write additive SQL.
  - Edge functions run with `verify_jwt = false` and check the cron secret or the user's token themselves.
- **Secrets never go in the repo or in chat.** VAPID private key and cron secret live in Supabase Vault (read through `rf_secret()`). The Anthropic key goes in as an edge function secret through the dashboard. Only the publishable key goes in `js/config.js`.
- Push notifications are sent with `urgency: high`.

## Tables
- `cultures`, `culture_events` (feed, check, peak, baby, note), `projects` (bread and kombucha, `specs` and `result` as JSON), `reminders`, `logs`, `facts`, `push_subscriptions`.
- `households` and `household_members` for the shared kitchen.
- Deleting a culture cascades to its events and reminders; projects keep their row with `culture_id` set to null.

## Scheduled jobs
- `rf-send-reminders` runs every minute and calls the `send-reminders` function.
- `rf-daily-fact` runs at 06:00 UTC and calls the `daily-fact` function.
- Both send the cron secret from Vault in an `x-cron-secret` header.
