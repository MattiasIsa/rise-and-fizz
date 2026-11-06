// Pure fermentation maths and schedule builders. No DOM, no network:
// everything here can be tested with plain Node.

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export const round = (n, step = 1) => Math.round(n / step) * step;
const roundTime = (ms, minutes = 15) => Math.round(ms / (minutes * MIN)) * minutes * MIN;

// ---------- Sourdough ----------

export const BREAD_DEFAULTS = {
  name: 'Country loaf',
  flours: [
    { name: 'Bread flour', g: 450 },
    { name: 'Whole wheat', g: 50 }
  ],
  water: 375,
  starter: 100,
  starterHydration: 100,
  salt: 10,
  temp: 21,
  autolyseMin: 45,
  folds: 4,
  foldEveryMin: 30,
  retardHours: 12,
  targetRise: 75
};

export function breadNumbers(spec) {
  const flourIn = (spec.flours || []).reduce((s, f) => s + (Number(f.g) || 0), 0);
  const starter = Number(spec.starter) || 0;
  const sh = (Number(spec.starterHydration) || 100) / 100;
  const starterFlour = starter / (1 + sh);
  const starterWater = starter - starterFlour;
  const flour = flourIn + starterFlour;
  const water = (Number(spec.water) || 0) + starterWater;
  const salt = Number(spec.salt) || 0;
  return {
    flour: Math.round(flour),
    flourIn: Math.round(flourIn),
    water: Math.round(water),
    hydration: flour > 0 ? Math.round((water / flour) * 100) : 0,
    saltPct: flour > 0 ? Number(((salt / flour) * 100).toFixed(1)) : 0,
    starterPct: flourIn > 0 ? Math.round((starter / flourIn) * 100) : 0,
    dough: Math.round(flourIn + (Number(spec.water) || 0) + starter + salt)
  };
}

// Rule of thumb: bulk takes ~5 h at 24 °C and roughly doubles for every 8 °C cooler.
export function bulkHours(tempC) {
  const t = Math.min(32, Math.max(14, Number(tempC) || 21));
  return 5 * Math.pow(2, (24 - t) / 8);
}

export function starterPeakHours(tempC, ratio = 2) {
  const t = Math.min(32, Math.max(14, Number(tempC) || 21));
  const base = 6 * Math.pow(2, (21 - t) / 8);
  return base * (1 + (Math.max(1, ratio) - 2) * 0.18);
}

export function breadSchedule(spec, startAt) {
  const s = { ...BREAD_DEFAULTS, ...spec };
  const start = new Date(startAt).getTime();
  const add = start + s.autolyseMin * MIN;
  const bulkMs = roundTime(bulkHours(s.temp) * HOUR);
  const shape = add + bulkMs;
  const fridge = shape + 30 * MIN;
  const bake = roundTime(fridge + s.retardHours * HOUR);
  const steps = [
    { kind: 'mix', title: 'Mix flour and water', detail: `Autolyse for ${s.autolyseMin} min`, at: start },
    { kind: 'add', title: 'Add starter and salt', detail: 'Squeeze and pinch until combined', at: add }
  ];
  for (let i = 1; i <= s.folds; i++) {
    steps.push({ kind: 'fold', title: `Stretch and fold, set ${i} of ${s.folds}`, detail: `Every ${s.foldEveryMin} min. Wet hands, four sides.`, at: add + i * s.foldEveryMin * MIN, n: i });
  }
  steps.push({ kind: 'shape', title: 'End of bulk, then shape', detail: `Look for about 50–${s.targetRise}% rise, domed and wobbly`, at: shape });
  steps.push({ kind: 'fridge', title: 'Into the fridge', detail: `Cold retard about ${s.retardHours} h`, at: fridge });
  steps.push({ kind: 'bake', title: 'Bake', detail: '250 °C lid on 20 min, then 230 °C lid off 25 min', at: bake });
  return steps.map((st, idx) => ({ ...st, idx, at: new Date(st.at).toISOString() }));
}

// ---------- Plan backwards: "I want bread at 10:00 Saturday" ----------
// readyAt = when the loaf comes out of the oven. The bake step is BAKE_MIN before that.
export const BAKE_MIN = 45;
const AWAKE = { from: 7, to: 22 }; // hands-on steps should land between 07:00 and 22:00 (phone's local time)
const asleep = (ms) => { const h = new Date(ms).getHours() + new Date(ms).getMinutes() / 60; return h < AWAKE.from || h >= AWAKE.to; };

function fitStart(spec, bakeAt) {
  let start = bakeAt - (new Date(breadSchedule(spec, 0).slice(-1)[0].at).getTime());
  for (let i = 0; i < 3; i++) { // rounding inside breadSchedule can drift a few minutes; settle it
    const bake = new Date(breadSchedule(spec, start).slice(-1)[0].at).getTime();
    if (bake === bakeAt) break;
    start += bakeAt - bake;
  }
  return start;
}

// opts: { peakHours } how long the chosen starter takes to peak after a feed (null = no starter feed step).
export function planBackwards(spec, readyAt, opts = {}, now = Date.now()) {
  const s = { ...BREAD_DEFAULTS, ...spec };
  const ready = new Date(readyAt).getTime();
  const bakeAt = ready - BAKE_MIN * MIN;
  const build = (retardHours) => {
    const sp = { ...s, retardHours };
    const start = fitStart(sp, bakeAt);
    const steps = breadSchedule(sp, start);
    const addAt = new Date(steps.find((x) => x.kind === 'add').at).getTime();
    const feedAt = opts.peakHours ? roundTime(addAt - opts.peakHours * HOUR) : null;
    // Folds, shaping and fridge need hands. So does the feed. Baking is the wake-up you asked for.
    const handsOn = [feedAt, ...steps.filter((x) => x.kind !== 'bake').map((x) => new Date(x.at).getTime())].filter((x) => x != null);
    const night = handsOn.filter(asleep).length;
    return { retardHours, start, steps, feedAt, night, first: Math.min(...handsOn) };
  };
  const plan = build(Number(s.retardHours) || 12);
  const warnings = [];
  if (plan.first < now) warnings.push({ kind: 'late', text: 'That is too soon to fit everything in. Pick a later time, or shorten the fridge time.' });
  if (plan.night) warnings.push({ kind: 'night', text: `${plan.night} hands-on ${plan.night === 1 ? 'step lands' : 'steps land'} between 22:00 and 07:00.` });

  // Suggest the fridge time closest to yours (8–48 h) that keeps every hands-on step in the daytime.
  let better = null;
  if (plan.night || plan.first < now) {
    for (let d = 0.5; d <= 40 && !better; d += 0.5) {
      for (const h of [plan.retardHours + d, plan.retardHours - d]) {
        if (h < 8 || h > 48) continue;
        const alt = build(h);
        if (!alt.night && alt.first >= now) { better = alt; break; }
      }
    }
  }
  return { ...plan, ready, bakeAt, warnings, better: better ? { retardHours: better.retardHours, start: better.start, feedAt: better.feedAt } : null };
}

export const BREAD_STAGES = [
  { key: 'mix', label: 'Mix', kinds: ['mix', 'add'] },
  { key: 'folds', label: 'Folds', kinds: ['fold'] },
  { key: 'bulk', label: 'Bulk', kinds: [] },
  { key: 'shape', label: 'Shape', kinds: ['shape'] },
  { key: 'fridge', label: 'Fridge', kinds: ['fridge'] },
  { key: 'bake', label: 'Bake', kinds: ['bake'] }
];

// Which stage a bread is in, from its steps (reminders) and the clock.
export function breadStage(steps) {
  const sorted = [...steps].sort((a, b) => (a.idx ?? 0) - (b.idx ?? 0));
  const next = sorted.find((s) => !s.done_at);
  if (!next) return 'done';
  if (next.kind === 'mix' || next.kind === 'add' || next.kind === 'prefeed') return 'mix';
  if (next.kind === 'fold') return 'folds';
  if (next.kind === 'shape') return 'bulk';
  if (next.kind === 'fridge') return 'shape';
  if (next.kind === 'bake') return 'fridge';
  return 'bulk';
}

// Estimated rise during bulk, from the time since starter went in.
export function estimateRise(project, steps, now = Date.now()) {
  const add = steps.find((s) => s.kind === 'add');
  const spec = project.specs || {};
  const target = spec.targetRise || 75;
  if (!add) return { rise: 0, target, minutesLeft: null };
  const startMs = new Date(add.done_at || add.at).getTime();
  const bulkMs = bulkHours(spec.temp) * HOUR;
  const elapsed = Math.max(0, now - startMs);
  const frac = Math.min(1.25, elapsed / bulkMs);
  const measured = (project.result && project.result.measuredRise) || null;
  const rise = measured != null && frac < 1 ? measured : Math.round(target * Math.min(frac, 1.2));
  const minutesLeft = Math.max(0, Math.round((bulkMs - elapsed) / MIN));
  return { rise: Math.max(0, rise), target, minutesLeft };
}

// ---------- Kombucha ----------

export const KOMBUCHA_DEFAULTS = {
  name: 'Batch',
  volume: 3.8,
  tea: 'black',
  temp: 24,
  measurePh: false
};

export function kombuchaRecipe(volumeL) {
  const v = Math.max(0.5, Number(volumeL) || 3.8);
  const starterMl = round(v * 100, 10);
  return {
    sugar: round(v * 55, 5),
    teaG: Math.round(v * 4),
    bags: Math.round(v * 2),
    starterMl,
    waterL: Number((v - starterMl / 1000).toFixed(1))
  };
}

export function f1Days(tempC) {
  const t = Math.min(32, Math.max(16, Number(tempC) || 24));
  return Math.max(5, Math.round(8 * Math.pow(2, (24 - t) / 8)));
}

export function kombuchaSchedule(spec, startAt) {
  const s = { ...KOMBUCHA_DEFAULTS, ...spec };
  const start = new Date(startAt);
  const days = f1Days(s.temp);
  const first = Math.max(4, days - 2);
  const at9 = (d) => { const x = new Date(start); x.setDate(x.getDate() + d); x.setHours(9, 0, 0, 0); return x.getTime(); };
  const steps = [{ kind: 'brew', title: 'Brew sweet tea, let it cool', detail: 'Below 30 °C before adding the SCOBY and starter liquid', at: start.getTime() }];
  for (let d = first; d <= days + 2; d++) {
    steps.push({ kind: 'taste', title: d === first ? 'First taste' : `Taste, day ${d}`, detail: d === first ? 'Straw in from the side, under the SCOBY' : 'Sweet still, or ready to bottle?', at: at9(d), day: d });
  }
  return steps.map((st, idx) => ({ ...st, idx, at: new Date(st.at).toISOString() }));
}

export function f2Schedule(startAt, days = 3, baseIdx = 100) {
  const start = new Date(startAt).getTime();
  const steps = [];
  for (let d = 1; d <= days; d++) {
    steps.push({ kind: 'burp', title: `Burp the bottles (F2 day ${d})`, detail: 'Open each cap briefly to release pressure', at: awake(start + d * DAY) });
  }
  steps.push({ kind: 'fridge', title: 'Move bottles to the fridge', detail: 'Stops the fizz from building further', at: awake(start + days * DAY + 2 * HOUR) });
  return steps.map((st, i) => ({ ...st, idx: baseIdx + i, at: new Date(st.at).toISOString() }));
}

export function kombuchaDay(project, now = Date.now()) {
  const phase = project.stage === 'f2' ? 'f2' : 'f1';
  const from = phase === 'f2' && project.specs && project.specs.f2StartedAt ? project.specs.f2StartedAt : project.started_at;
  return Math.max(0, Math.floor((now - new Date(from).getTime()) / DAY));
}

// Activity curve for a jar: low at first, peaks around the end of F1.
export function kombuchaActivity(day, totalDays) {
  const t = Math.min(1.3, day / Math.max(1, totalDays));
  return Math.round(Math.max(0.08, Math.min(1, t < 1 ? Math.pow(t, 0.8) : 1 - (t - 1) * 0.8)) * 100);
}

export function tasteWord(v) {
  if (v < 28) return { word: 'Sweet', advice: 'Give it 1–2 more days.' };
  if (v < 55) return { word: 'Balanced', advice: 'Ready. Bottle it for F2 today.' };
  if (v < 80) return { word: 'Tart', advice: 'Bottle now; fruit will soften it.' };
  return { word: 'Vinegar', advice: 'Keep it as starter liquid for the next batch.' };
}

export function tasteColor(v) {
  const stops = [[255, 232, 0], [200, 240, 74], [0, 194, 184]];
  const t = Math.min(1, Math.max(0, v / 100));
  const a = t < 0.5 ? stops[0] : stops[1];
  const b = t < 0.5 ? stops[1] : stops[2];
  const u = t < 0.5 ? t * 2 : (t - 0.5) * 2;
  return a.map((x, i) => Math.round(x + (b[i] - x) * u));
}

// Kombucha steps don't need the middle of the night (phone's local time):
// 22:00–24:00 moves back to 21:00 the same evening, 00:00–07:00 moves on to 09:00.
export const QUIET = { from: 22, to: 7, evening: 21, wake: 9 };
export function awake(at) {
  const d = new Date(at);
  const h = d.getHours();
  if (h >= QUIET.from) d.setHours(QUIET.evening, 0, 0, 0);
  else if (h < QUIET.to) d.setHours(QUIET.wake, 0, 0, 0);
  return d.getTime();
}
export const DAYTIME_KINDS = ['taste', 'burp', 'fridge'];

export const TIME = { MIN, HOUR, DAY };
