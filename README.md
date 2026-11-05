# Rise & Fizz

A tracker for sourdough and kombucha, in a neon risograph style. It works on Android, iPhone and laptop browsers, and you can install it on a phone's home screen.

- **Home**: what needs you next (fold, feed, taste, burp) and every loaf and batch in progress, with live bubbling jars.
- **Start new**: pick sourdough or kombucha, enter your specs, and get a full schedule with reminders.
- **Active pages**: fold countdown, measured rise, taste-o-meter, F2 bottling, notes and photos.
- **Cultures**: your starters and SCOBYs, with feed logs and reminders.
- **Journal**: everything you've finished, with full specs and durations.
- **Stats**: charts, raw data, CSV export and a daily fact from Claude.

## How it runs

A static site with no build step: plain ES modules, [Preact](https://preactjs.com) and [htm](https://github.com/developit/htm) loaded from esm.sh. Hosted on GitHub Pages. Data, logins, photos and notifications run on [Supabase](https://supabase.com).

Leave `js/config.js` empty to run in **demo mode**, where sample data is kept in the browser only.

## Supabase setup (one time)

1. **Database**: run `supabase/migrations/001_init.sql` in the SQL editor.
2. **Auth**: under Authentication → URL Configuration, set the Site URL to the GitHub Pages address (e.g. `https://mattiasisa.github.io/rise-and-fizz/`) and add it to Redirect URLs.
3. **Functions**: deploy `supabase/functions/send-reminders` and `supabase/functions/daily-fact` with JWT verification off (see `supabase/config.toml`).
4. **Function secrets**: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (e.g. `mailto:you@example.com`), `CRON_SECRET`, `ANTHROPIC_API_KEY`.
5. **Timers**: store the cron secret in Vault (`select vault.create_secret('<secret>', 'cron_secret');`), then run `supabase/migrations/002_schedules.sql`.

## Notifications

- **Android and desktop**: Settings → Turn on notifications.
- **iPhone / iPad (iOS 16.4+)**: Safari → Share → Add to Home Screen, open the app from the home screen, then Settings → Turn on notifications.
