# Shipping checklist

Do this every time something goes live.

1. `node --check` every changed file, and run the pure `js/lib` code with sample data in Node.
2. Bump the version in **both** `sw.js` and `js/version.js` (`sed -i -E "s/rf-v[0-9]+/rf-vN/" sw.js js/version.js`), and update `SHELL` if files were added. Settings shows the version, so you can check a phone is up to date.
3. Commit with a plain message and push to `main`. GitHub Pages deploys it.
4. GitHub Pages caches for about 10 minutes, so reload after that. The service worker revalidates the app's own files.
5. Update the relevant file in `rules/` if a rule changed.
