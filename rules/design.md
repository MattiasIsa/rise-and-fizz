# Design: "Neon riso night"

Colour, type, texture, layout. Read before any visual change.

## Colour
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

## Type
- **Fraunces** (display, weight 900, italic for the second word: "Your *cultures*") with the pink offset shadow for page titles (`.h-display`) and big numbers (`.big-num`).
- **Space Grotesk** for body text.
- **Space Mono**, uppercase, for labels, kickers, buttons and the top bar (`.kicker`, `.btn`).

## Texture and motion
- Grain overlay plus soft overprint `Blobs` behind each page. Blobs must never cause horizontal scroll (`overflow-x: clip` on `#app` and `.main`).
- **Jars are the signature element.** Starters and batches are shown as jars that fill and bubble with activity. Reuse `Jar` rather than inventing new icons.
- Interactive and playful is welcome (Peek ahead slider, bubbling jars, birthday party card), but never at the cost of reading the next action quickly.

## Layout
- Phone: bottom nav, 16px side gutter, no horizontal scroll, touch targets at least 44px.
- Never put `overflow: hidden` (or `overflow-x: hidden`) on `html` or `body`. On iPhone it makes the fixed bottom bar drift while scrolling. Clip sideways overflow on `#app` and `.main` with `overflow-x: clip` instead, and keep `backdrop-filter` off fixed bars.
- At 900px and wider, the nav becomes a sticky sidebar.
- Sheets (`Sheet`) slide up for quick actions such as feeding, logging or confirming, so you don't leave the page.
