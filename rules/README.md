# Rise & Fizz: house rules

How Rise & Fizz looks, feels and is built. **Read this index before any change, then the files that apply.** Update the relevant file in the same commit when a decision changes. If a rule and the code disagree, ask which is right before "fixing" either.

| File | Read it when you're… |
|---|---|
| [product.md](product.md) | adding a feature or deciding what the app should do |
| [design.md](design.md) | changing anything visual: colour, type, layout, jars |
| [voice.md](voice.md) | writing any text a user sees |
| [ux.md](ux.md) | building or changing a screen, form, sheet or button |
| [code.md](code.md) | touching `js/`, `css/`, `index.html` or `sw.js` |
| [database.md](database.md) | touching `supabase/`, `api.js`, `store.js`, notifications or secrets |
| [shipping.md](shipping.md) | about to commit and push (every time) |

## The five that matter most
1. Yellow = bread, teal = kombucha, pink = attention. Colour has meaning.
2. Data never just disappears; every delete is confirmed.
3. Inputs never fight the user: clearable, prefilled from last time, validated before save.
4. Secrets never go in the repo or in chat.
5. Bump the service worker version on every deploy.
