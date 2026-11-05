# How things work

Interaction rules we have learned the hard way. Read before building or changing a screen or form.

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
