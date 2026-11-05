const pad = (n) => String(n).padStart(2, '0');

export function hhmm(date) {
  const d = new Date(date);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function dayLabel(date, now = new Date()) {
  const d = new Date(date);
  const a = new Date(now); a.setHours(0, 0, 0, 0);
  const b = new Date(d); b.setHours(0, 0, 0, 0);
  const diff = Math.round((b - a) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function shortDate(date) {
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase();
}

// "in 12 min", "18:00", "tomorrow 09:00", "12 min late"
export function whenLabel(date, now = Date.now()) {
  const t = new Date(date).getTime();
  const diffMin = Math.round((t - now) / 60000);
  if (diffMin <= -1) {
    const late = -diffMin;
    return late < 60 ? `${late} min late` : `${Math.round(late / 60)} h late`;
  }
  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `in ${diffMin} min`;
  const label = dayLabel(t, new Date(now));
  return label === 'Today' ? hhmm(t) : `${label.toLowerCase()} ${hhmm(t)}`;
}

export function duration(minutes) {
  if (minutes == null) return '';
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} min`;
  return r === 0 ? `${h} h` : `${h} h ${r} min`;
}

export function compactDuration(minutes) {
  const m = Math.max(0, Math.round(minutes));
  return `${Math.floor(m / 60)}H${pad(m % 60)}`;
}

export function clock(seconds) {
  const s = Math.max(0, Math.round(seconds));
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}

export function greeting(now = new Date()) {
  const h = new Date(now).getHours();
  const day = new Date(now).toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase();
  const part = h < 5 ? 'NIGHT' : h < 12 ? 'MORNING' : h < 18 ? 'AFTERNOON' : 'EVENING';
  return `${day} · ${part}`;
}

export function toLocalInput(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
