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

// Multiple-choice quizzes: { q, options, answer (index), explain }
const QUIZ = [
  { q: 'Why does a loaf that proofs overnight in the fridge taste more sour?', options: ['The cold kills the yeast', 'The yeast slows down more than the acid-making bacteria', 'The fridge adds moisture', 'Cold flour absorbs more salt'], answer: 1, explain: 'Cold slows the yeast more than the lactic and acetic acid bacteria, so acid builds up relative to rise.' },
  { q: 'What is the dashed line on your starter jar for?', options: ['The maximum safe fill', 'Where it should be after feeding', 'Where it peaked last time', 'The water level'], answer: 2, explain: 'Marking the last peak makes it easy to spot when it gets there again.' },
  { q: 'Why do you "burp" kombucha bottles during F2?', options: ['To let oxygen in for the yeast', 'To release CO₂ before pressure builds too far', 'To taste-test it', 'To stop mould'], answer: 1, explain: 'F2 is sealed, so CO₂ builds up. A quick burp keeps the bottles safe.' },
  { q: 'When do you add fruit or ginger to kombucha?', options: ['F1, with the SCOBY', 'F2, after the SCOBY comes out', 'Before brewing the tea', 'Never, it ruins the SCOBY'], answer: 1, explain: 'Flavours go in during F2. Fruit in F1 can upset the SCOBY.' },
  { q: 'Which usually makes a starter peak sooner?', options: ['Feeding 1:5:5', 'A colder kitchen', 'Rye flour', 'Less water'], answer: 2, explain: 'Rye brings extra nutrients and enzymes, so the microbes get going faster.' },
  { q: 'Roughly what salt percentage do most sourdough recipes use?', options: ['0.5%', '2%', '5%', '10%'], answer: 1, explain: 'Most loaves sit around 1.8–2.2% of the flour weight.' },
  { q: 'What does 75% hydration mean for 500 g flour?', options: ['375 g water', '750 g water', '75 g water', '500 g water'], answer: 0, explain: 'Hydration is water as a share of flour: 0.75 × 500 g = 375 g.' },
  { q: 'Kombucha is usually ready to bottle at around which pH?', options: ['6–7', '4.5–5', '2.5–3.5', '1–1.5'], answer: 2, explain: 'It starts around 4.5 and drops as it ferments. Around 2.5–3.5 is the usual sweet spot.' }
];

export function localFact(state, kind = 'fact', seed = 0) {
  if (kind === 'quiz') return JSON.stringify(QUIZ[seed % QUIZ.length]);
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
