# Code structure

How the front end is built. Read before touching js/, css/, index.html or sw.js.

- **No build step.** Plain ES modules with an import map in `index.html`. Preact, hooks and htm all come from one bundle (`htm/preact/standalone.module.js`), so there's only one copy of Preact. Pin exact versions.
- **Structure:**
  - `js/lib/*` contains pure logic (schedule, feed calculator, stats). It must stay testable in Node with no browser.
  - `js/lib/api.js` holds all data access and state; pages never talk to Supabase directly.
  - `js/pages/*` holds one file per screen, and `js/components.js` holds the shared pieces.
- **The demo store must keep working.** `createLocalStore` mirrors Supabase, and anything the database cascades has to be done by hand there.
- **htm templates:** never split a tag across an `${...}` interpolation, because htm silently breaks.
- **Service worker:** add new files to `SHELL` in `sw.js`, and **bump the version (rf-vN) in `sw.js` and `js/version.js` on every deploy.**
