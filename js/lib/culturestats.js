// Stats for one culture (starter or SCOBY). Pure functions, testable in Node.
const DAY = 86400000;
const HOUR = 3600000;

const dayKey = (t) => { const d = new Date(t); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
const startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);

// Parse "YYYY-MM-DD" as a local date (not UTC midnight).
export function parseDay(s) {
  if (!s) return null;
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d).getTime();
}

const MILESTONES = [7, 30, 50, 100, 200, 365, 500, 730, 1000, 1500, 2000, 3000, 5000, 10000];

export function birthday(bornOn, now = Date.now()) {
  const born = parseDay(bornOn);
  if (born == null) return null;
  const today = startOfDay(now);
  const days = Math.max(0, Math.round((today - born) / DAY));
  const b = new Date(born);
  const t = new Date(today);
  let years = t.getFullYear() - b.getFullYear();
  let next = new Date(t.getFullYear(), b.getMonth(), b.getDate()).getTime();
  if (next < today || (next === today && days === 0)) next = new Date(t.getFullYear() + 1, b.getMonth(), b.getDate()).getTime();
  if (new Date(t.getFullYear(), b.getMonth(), b.getDate()).getTime() > today) years -= 1;
  const untilBirthday = Math.round((next - today) / DAY);
  const isBirthday = untilBirthday === 0 && days > 0;
  const nextMilestone = MILESTONES.find((m) => m > days) || null;
  const milestoneToday = MILESTONES.includes(days);
  return {
    days, years: Math.max(0, years), untilBirthday, isBirthday,
    turning: isBirthday ? years : years + 1,
    nextBirthday: next,
    nextMilestone, untilMilestone: nextMilestone ? nextMilestone - days : null, milestoneToday
  };
}

// events: culture_events for this culture (any order). projects: all projects.
export function cultureStats(culture, events, projects, now = Date.now()) {
  const mine = events.filter((e) => e.culture_id === culture.id).slice().sort((a, b) => new Date(a.at) - new Date(b.at));
  const feeds = mine.filter((e) => e.type === 'feed' || e.type === 'check');
  const peaks = mine.filter((e) => e.type === 'peak' && e.data && num(e.data.hours) > 0);
  const babies = mine.filter((e) => e.type === 'baby');
  const times = feeds.map((e) => new Date(e.at).getTime());

  let flour = 0, water = 0, starter = 0, ratioSum = 0, ratioN = 0, hydSum = 0, hydN = 0;
  for (const e of feeds) {
    const d = e.data || {};
    flour += num(d.flourGrams);
    water += num(d.water);
    starter += num(d.starter);
    if (num(d.ratio) > 0) { ratioSum += num(d.ratio); ratioN++; }
    if (num(d.hydration) > 0) { hydSum += num(d.hydration); hydN++; }
  }

  let longestGapH = 0;
  for (let i = 1; i < times.length; i++) longestGapH = Math.max(longestGapH, (times[i] - times[i - 1]) / HOUR);
  const sinceLastH = times.length ? (now - times[times.length - 1]) / HOUR : null;

  // Streak: consecutive days with a feed, ending today (or yesterday, so it doesn't break before you've fed today).
  const days = new Set(times.map(dayKey));
  let streak = 0;
  let cursor = startOfDay(now);
  if (!days.has(dayKey(cursor))) cursor -= DAY;
  while (days.has(dayKey(cursor))) { streak++; cursor -= DAY; }
  let bestStreak = 0, run = 0, prev = null;
  for (const k of [...days].sort((a, b) => a - b)) {
    const t = parseDay(`${Math.floor(k / 10000)}-${Math.floor(k / 100) % 100}-${k % 100}`);
    run = prev != null && Math.round((t - prev) / DAY) === 1 ? run + 1 : 1;
    bestStreak = Math.max(bestStreak, run); prev = t;
  }

  // Feeds in the last 30 days, for a little bar chart (oldest first).
  const last30 = Array.from({ length: 30 }, (_, i) => {
    const d = startOfDay(now) - (29 - i) * DAY;
    return times.filter((t) => t >= d && t < d + DAY).length;
  });

  const used = projects.filter((p) => p.culture_id === culture.id);
  const done = used.filter((p) => p.status === 'done');
  const rated = done.filter((p) => num(p.rating) > 0);
  const best = rated.slice().sort((a, b) => num(b.rating) - num(a.rating) || new Date(b.finished_at || b.started_at) - new Date(a.finished_at || a.started_at))[0] || null;
  const litres = used.reduce((s, p) => s + num(p.specs && p.specs.volume), 0);
  const flourInBakes = used.reduce((s, p) => s + ((p.specs && p.specs.flours) || []).reduce((a, f) => a + num(f.g), 0), 0);

  const peakHours = peaks.map((e) => num(e.data.hours));
  const avgPeak = peakHours.length ? peakHours.reduce((a, b) => a + b, 0) / peakHours.length : null;

  return {
    timesFed: feeds.length,
    flour, water, starter,
    eaten: flour + water,
    flourBags: flour / 2000,
    avgRatio: ratioN ? ratioSum / ratioN : null,
    avgHydration: hydN ? hydSum / hydN : null,
    longestGapH, sinceLastH,
    streak, bestStreak,
    last30,
    firstFeed: times.length ? times[0] : null,
    peaks: peakHours.length, avgPeak, lastPeak: peakHours.length ? peakHours[peakHours.length - 1] : null,
    babies: babies.length,
    projects: used, done: done.length, active: used.filter((p) => p.status === 'active').length,
    avgRating: rated.length ? rated.reduce((s, p) => s + num(p.rating), 0) / rated.length : null,
    best, litres, flourInBakes,
    history: mine.slice().reverse()
  };
}

// Hours since the most recent feed before `at`, for logging a peak.
export function hoursSinceFeed(culture, events, at = Date.now()) {
  const last = events
    .filter((e) => e.culture_id === culture.id && e.type === 'feed' && new Date(e.at).getTime() <= at)
    .sort((a, b) => new Date(b.at) - new Date(a.at))[0];
  return last ? (at - new Date(last.at).getTime()) / HOUR : null;
}

// A playful comparison for how much it has eaten.
export function eatenWord(grams) {
  if (grams <= 0) return 'Nothing yet. Feed me!';
  if (grams < 400) return `About ${Math.max(1, Math.round(grams / 50))} ${grams < 75 ? "egg's" : "eggs'"} worth`;
  if (grams < 2000) return `About ${Math.round(grams / 250)} cups of coffee in weight`;
  if (grams < 20000) return `About ${(grams / 2000).toFixed(1)} bags of flour`;
  if (grams < 60000) return `Roughly a ${Math.round(grams / 1000)} kg suitcase`;
  return `More than a grown-up husky (${Math.round(grams / 1000)} kg)`;
}
