// Starter feed calculator: grams <-> ratio. Pure functions, testable in Node.
// Ratio is starter : flour : water. "1:5" is shorthand for 1:5:5.

export const KEYS = ['s', 'f', 'w'];
const NICE_HYDRATION = [0.5, 0.6, 0.65, 0.7, 0.75, 0.8, 0.9, 1, 1.25, 1.5];

export function parseRatio(text) {
  const parts = String(text || '').trim().split(/\s*[:/\s]\s*/).filter(Boolean).map(Number);
  if (parts.some((n) => !(n > 0))) return null;
  if (parts.length === 3) return { s: parts[0], f: parts[1], w: parts[2] };
  if (parts.length === 2) return { s: parts[0], f: parts[1], w: parts[1] };
  return null;
}

const trim = (n) => String(Math.round(n * 10) / 10);
export const fmtGrams = (n) => (n == null || !Number.isFinite(n) ? '' : String(Math.round(n)));
export function fmtRatio(r) {
  if (!r) return '';
  const k = r.s > 0 ? r.s : 1;
  return `1:${trim(r.f / k)}:${trim(r.w / k)}`;
}

// typed: { s, f, w } strings (empty = not typed). last: the key typed most recently.
// Returns the values to use, which ones were filled in for you, the actual ratio and a suggestion.
export function solveFeed(typed, ratioText, last) {
  const r = parseRatio(ratioText);
  const num = (v) => (v === '' || v == null ? null : Number(v));
  const user = {};
  KEYS.forEach((k) => { const n = num(typed[k]); if (n != null && n >= 0 && Number.isFinite(n)) user[k] = n; });
  const known = Object.keys(user);
  const auto = {};

  if (r && known.length === 1) {
    const k = known[0];
    const unit = user[k] / r[k];
    KEYS.filter((x) => x !== k).forEach((x) => { auto[x] = unit * r[x]; });
  } else if (r && known.length === 2) {
    const missing = KEYS.find((x) => !(x in user));
    // Anchor the missing amount to flour if we have it, else starter, else whatever was typed last.
    const anchor = 'f' in user && missing !== 'f' ? 'f' : 's' in user && missing !== 's' ? 's' : last && last in user ? last : known[0];
    auto[missing] = (user[anchor] / r[anchor]) * r[missing];
  }

  const full = {};
  KEYS.forEach((k) => { full[k] = k in user ? user[k] : k in auto ? auto[k] : null; });
  const complete = KEYS.every((k) => full[k] != null);
  const actual = complete && full.s > 0 ? { s: full.s, f: full.f, w: full.w } : null;
  const hydration = full.f > 0 && full.w != null ? full.w / full.f : null;

  // When flour and water were both typed and the hydration is odd, suggest the nearest round one.
  let suggestion = null;
  if ('f' in user && 'w' in user && user.f > 0) {
    const h = user.w / user.f;
    const nearest = NICE_HYDRATION.reduce((a, b) => (Math.abs(b - h) < Math.abs(a - h) ? b : a));
    if (Math.abs(nearest - h) > 0.015) {
      const water = Math.round(user.f * nearest);
      suggestion = { hydration: nearest, water, text: `Close to ${Math.round(nearest * 100)}% hydration: use ${water} g water` };
    }
  }

  const differs = actual && r && KEYS.some((k) => Math.abs(actual[k] / actual.s - r[k] / r.s) > 0.05);
  return { r, user, auto, full, complete, actual, actualText: actual ? fmtRatio(actual) : '', differs, hydration, suggestion, feedRatio: actual ? actual.f / actual.s : r ? r.f / r.s : 2 };
}
