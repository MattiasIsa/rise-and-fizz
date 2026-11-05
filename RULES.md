# Rise & Fizz: house rules

The rules for how Rise & Fizz looks, feels and is built. **Read this before changing anything**, and update it when a decision changes. If a rule here and the code disagree, ask which one is right before "fixing" either.

## 1. What the app is for

- A tracker for **sourdough** (loaves and starters) and **kombucha** (batches and SCOBYs) for a household: Mattias and his wife share one kitchen, and everything shows **whose thing is whose**.
- It runs as an installable PWA on **Android, iPhone and laptop**. Mobile first, but every page must also work on a wide screen.
- **Data must never just disappear.** Everything lives in Supabase and syncs across devices. Deleting is always deliberate and confirmed.
- Reminders (fold, feed, taste, burp) are the core. They must arrive as real push notifications even when the app is closed.

## 2. Look: "Neon riso night"

### Colour
| Token | Hex | Use for |
|---|---|---|
| `--ink` | `#15173D` | Background, always dark. Text on bright slabs. |
| `--paper` | `#F5F0FF` | Main text |
| `--muted` | `#C9C6EE` | Secondary text |
| `--yellow` | `#FFE800` | **Bread and starters on the counter.** Primary buttons. |
| `--teal` | `#00C2B8` | **Kombucha and SCOBYs** |
| `--pink` | `#FF2E9A` | **Alerts, overdue, fridge, delete.** The "hey, look" colour. |

- On dark backgrounds, use `--pink-text` and `--teal-text` for text: the base pink and teal are for fills, borders and glows only, because they're too dark to read.
- The colour **means** something: yellow = bread, teal = kombucha, pink = attention. Don't use them decoratively against that meaning.
- Bright `.slab`s carry the important thing on a page (up next, birthdays). Use at most one or two per screen.

### Type
- **Fraunces** (display, weight 900, italic for the second word: "Your *cultures*") with the pink offset shadow for page titles (`.h-display`) and big numbers (`.big-num`).
- **Space Grotesk** for body text.
- **Space Mono**, uppercase, for labels, kickers, buttons and the top bar (`.kicker`, `.btn`).

### Texture and motion
- Grain overlay plus soft overprint `Blobs` behind each page. Blobs must never cause horizontal scroll (`overflow-x: clip` on `#app` and `.main`).
- **Jars are the signature element.** Starters and batches are shown as jars that fill and bubble with activity. Reuse `Jar` rather than inventing new icons.
- Interactive and playful is welcome (Peek ahead slider, bubbling jars, birthday party card), but never at the cost of reading the next action quickly.

### Layout
- Phone: bottom nav, 16px side gutter, no horizontal scroll, touch targets at least 44px.
- At 900px and wider, the nav becomes a sticky sidebar.
- Sheets (`Sheet`) slide up for quick actions such as feeding, logging or confirming, so you don't leave the page.

## 3. Voice and copy

- Short, warm, a little silly. Puns are welcome in headings and empty states ("Starter pack", "Knead to know", "Goodbye, Jonny"), never in instructions or errors.
- Plain words: "Feed", "Log peak", "Bake with it". No jargon without a one-line explanation.
- **Metric only**: grams, litres, °C. Dates in en-GB style (`5 NOV`), 24-hour times.
- Cultures have names and personalities (Jonny, Scooby). Talk about them like pets.

## 4. How things work (UX rules we've learned)

1. **Number inputs store the raw text.** Never snap back to a default while typing (no `Number(v) || 12`). You can clear a field; Save stays disabled until the value is valid.
2. **Prefill from last time.** Repeated actions (like feeding) start with the previous values, so the common case is one tap.
3. **Calculators work both ways.** Type a ratio and get grams, or type grams and get the ratio. Auto-filled values appear as faint placeholders you can type over. Suggest a nicer value ("use 50 g water") rather than forcing it.
4. **Quizzes are multiple choice.** Never show the answer next to the question. Reveal it only after a tap, with a one-line explanation.
5. **Every delete asks first** (`DeleteButton`) and says what goes with it and what stays. "Finish" is the way to keep something in history.
6. **Shared kitchen:** show `Owner` name tags whenever the household has two or more members. Everyone can see and act on everything.
7. **Tapping a thing opens it.** Cards (projects, cultures) open a detail page with fun stats first, useful stats next, and actions underneath.
8. **Reminders shift with reality.** Completing a fold late shifts the later folds; feeding creates the next feed reminder.
9. **Sensible defaults:** bread defaults to a cold retard overnight. Kombucha uses best-guess recipes (55 g/L sugar, 4 g/L tea, 10% starter liquid).
10. **Never block on loading.** Start-up shows what it's waiting for, and after 8 s offers Reload and Reset. The Starter pack (`#/setup`) renders even when nothing else loads.

## 5. How it's built

- **No build step.** Plain ES modules with an import map in `index.html`. Preact, hooks and htm all come from one bundle (`htm/preact/standalone.module.js`), so there's only one copy of Preact. Pin exact versions.
- **Structure:**
  - `js/lib/*` contains pure logic (schedule, feed calculator, stats). It must stay testable in Node with no browser.
  - `js/lib/api.js` holds all data access and state; pages never talk to Supabase directly.
  - `js/pages/*` holds one file per screen, and `js/components.js` holds the shared pieces.
- **The demo store must keep working.** `createLocalStore` mirrors Supabase, and anything the database cascades has to be done by hand there.
- **htm templates:** never split a tag across an `${...}` interpolation, because htm silently breaks.
- **Service worker:** add new files to `SHELL` in `sw.js`, and **bump `VERSION` (rf-vN) on every deploy.**
- **Supabase** (project `dmczyqpmcmykrnnmujga`):
  - RLS is on everywhere. Rows are yours or your household's (`rf_my_households()`), and `household_id` is set by trigger.
  - Schema changes go in as migrations. Avoid `drop` statements, because they get cancelled; write additive SQL.
  - Edge functions run with `verify_jwt = false` and check the cron secret or the user's token themselves.
- **Secrets never go in the repo or in chat.** VAPID private key and cron secret live in Supabase Vault (read through `rf_secret()`). The Anthropic key goes in as an edge function secret through the dashboard. Only the publishable key goes in `js/config.js`.
- Push notifications are sent with `urgency: high`.

## 6. Shipping checklist

1. `node --check` every changed file, and run the pure `js/lib` code with sample data in Node.
2. Bump the `sw.js` VERSION and update `SHELL` if files were added.
3. Commit with a plain message and push to `main`. GitHub Pages deploys it.
4. GitHub Pages caches for about 10 minutes, so reload after that. The service worker revalidates the app's own files.
5. Update this file if a rule changed.
