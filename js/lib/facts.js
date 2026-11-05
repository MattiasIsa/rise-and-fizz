// Offline facts: built from the user's own data where possible, general fermentation facts otherwise.
// When Supabase is connected, the daily-fact function asks Claude instead and these are the fallback.

const GENERAL = [
  'Rye flour carries more enzymes and nutrients than white wheat, so rye starters usually peak sooner.',
  'Feeding a starter at 1:5:5 instead of 1:2:2 pushes its peak later, which is handy on warm days.',
  'A SCOBY is a mat of cellulose built by bacteria. Each batch grows a fresh layer on top.',
  'Fruit or juice in F2 gives the yeast new sugar to turn into bubbles, which is where most of the fizz comes from.',
  'Cold retard slows the yeast more than the bacteria, so a long night in the fridge makes a tangier loaf.',
  'Salt tightens gluten and slows fermentation. Most sourdough sits around 1.8–2.2% salt.',
  'The "float test" for starters is unreliable with wholegrain flours. Watching for a domed, bubbly peak works better.',
  'Kombucha usually starts around pH 4.5 and is ready somewhere between 2.5 and 3.5.'
];

const QUIZ = [
  'Quiz: why does a loaf proofed in the fridge taste more sour? (Answer: the yeast slows down more than the acid-making bacteria.)',
  'Quiz: what does the dashed line on your starter jar mark? (Answer: where it peaked last time, so you can spot the next peak.)',
  'Quiz: why burp F2 bottles? (Answer: to release CO2 so pressure doesn\'t build up too far.)',
  'Quiz: which fermentation adds the flavour, F1 or F2? (Answer: F2. Fruit goes in after the SCOBY comes out.)'
];

export function localFact(state, kind = 'fact', seed = 0) {
  if (kind === 'quiz') return QUIZ[seed % QUIZ.length];
  const own = ownFacts(state);
  const pool = own.length ? own.concat(GENERAL) : GENERAL;
  return pool[seed % pool.length];
}

export function ownFacts(state) {
  const out = [];
  const breads = state.projects.filter((p) => p.type === 'bread' && p.status === 'done' && p.rating);
  if (breads.length >= 3) {
    const best = breads.filter((b) => b.rating >= 5);
    if (best.length) {
      const avgRetard = best.reduce((s, b) => s + ((b.result && b.result.retardHours) || b.specs.retardHours || 12), 0) / best.length;
      out.push(`Your ${best.length} top-rated loaves spent about ${avgRetard.toFixed(0)} h in the fridge on average.`);
    }
    const avg = breads.reduce((s, b) => s + b.rating, 0) / breads.length;
    out.push(`You've rated ${breads.length} loaves so far, averaging ${avg.toFixed(1)} out of 5.`);
  }
  const k = state.projects.filter((p) => p.type === 'kombucha');
  if (k.length >= 2) out.push(`You've brewed ${k.length} kombucha batches. Scooby is getting a workout.`);
  return out;
}
