// Sample data for demo mode, so the app is alive before Supabase is connected.
import { breadSchedule, kombuchaSchedule, f2Schedule, kombuchaRecipe, BREAD_DEFAULTS, TIME } from './schedule.js';

export async function seedDemo(store) {
  const now = Date.now();
  const iso = (ms) => new Date(ms).toISOString();

  const [rye, wheat, scooby] = await store.insert('cultures', [
    { kind: 'starter', name: 'Rye starter', location: 'counter', feed_every_hours: 12, born_on: iso(now - 210 * TIME.DAY).slice(0, 10), notes: '' },
    { kind: 'starter', name: 'Wheat starter', location: 'fridge', feed_every_hours: 168, born_on: iso(now - 80 * TIME.DAY).slice(0, 10), notes: '' },
    { kind: 'scoby', name: 'Scooby', location: 'counter', feed_every_hours: 0, born_on: iso(now - 94 * TIME.DAY).slice(0, 10), notes: '2 babies so far' }
  ]);
  await store.insert('culture_events', [
    { culture_id: rye.id, type: 'feed', at: iso(now - 8 * TIME.HOUR), data: { ratio: 2, temp: 21 } },
    { culture_id: wheat.id, type: 'feed', at: iso(now - 5 * TIME.DAY), data: { ratio: 2 } }
  ]);
  await store.insert('reminders', [
    { culture_id: rye.id, kind: 'feed', title: 'Feed Rye starter', detail: 'Peaked about 2 h ago', due_at: iso(now + 3 * TIME.HOUR), idx: 0, notify: true },
    { culture_id: wheat.id, kind: 'feed', title: 'Feed Wheat starter', detail: 'Weekly fridge feed', due_at: iso(now + 2 * TIME.DAY), idx: 0, notify: true }
  ]);

  const mkReminders = (pid, steps, doneBefore) => steps.map((s) => ({
    project_id: pid, kind: s.kind, title: s.title, detail: s.detail, due_at: s.at, idx: s.idx, notify: true,
    done_at: new Date(s.at).getTime() < doneBefore ? s.at : null
  }));

  // Active bread in the middle of folds.
  const s1 = { ...BREAD_DEFAULTS, name: 'Country loaf', cultureId: rye.id, temp: 21, notify: true };
  const start1 = now - (45 + 60 + 18) * TIME.MIN;
  const [b1] = await store.insert('projects', { type: 'bread', name: s1.name, culture_id: rye.id, status: 'active', stage: 'folds', specs: s1, started_at: iso(start1) });
  const steps1 = breadSchedule(s1, start1);
  await store.insert('reminders', mkReminders(b1.id, steps1, now));
  await store.insert('logs', steps1.filter((s) => new Date(s.at).getTime() < now).map((s) => ({ project_id: b1.id, at: s.at, text: s.title, data: { kind: s.kind } })));

  // Second bread waiting in the fridge.
  const s2 = { ...BREAD_DEFAULTS, name: 'Rye loaf', cultureId: rye.id, flours: [{ name: 'Bread flour', g: 350 }, { name: 'Rye flour', g: 150 }], water: 390, temp: 22, notify: true };
  const start2 = now - 9 * TIME.HOUR;
  const [b2] = await store.insert('projects', { type: 'bread', name: s2.name, culture_id: rye.id, status: 'active', stage: 'fridge', specs: s2, started_at: iso(start2) });
  await store.insert('reminders', mkReminders(b2.id, breadSchedule(s2, start2), now));

  // Kombucha in F1 and in F2.
  const k1 = { name: 'Batch #4', volume: 3.8, tea: 'black', temp: 24, cultureId: scooby.id, notify: true, recipe: kombuchaRecipe(3.8) };
  const kStart1 = now - 7 * TIME.DAY;
  const [kb1] = await store.insert('projects', { type: 'kombucha', name: k1.name, culture_id: scooby.id, status: 'active', stage: 'f1', specs: k1, started_at: iso(kStart1), result: { lastTaste: 22 } });
  await store.insert('reminders', mkReminders(kb1.id, kombuchaSchedule(k1, kStart1), now - 20 * TIME.HOUR));
  await store.insert('logs', [
    { project_id: kb1.id, at: iso(kStart1), text: 'Brewed 3.8 L · 210 g sugar, 15 g tea', data: {} },
    { project_id: kb1.id, at: iso(now - 4 * TIME.DAY), text: 'New SCOBY layer forming on top', data: {} },
    { project_id: kb1.id, at: iso(now - 1 * TIME.DAY), text: 'Tasted: sweet', data: { taste: 22 } }
  ]);

  const kStart2 = now - 11 * TIME.DAY;
  const f2Start = now - 1.6 * TIME.DAY;
  const k2 = { name: 'Batch #3', volume: 3.8, tea: 'black', temp: 24, cultureId: scooby.id, notify: true, recipe: kombuchaRecipe(3.8), flavors: ['Ginger', 'Raspberry'], f2Days: 3, f2StartedAt: iso(f2Start), f1Days: 9 };
  const [kb2] = await store.insert('projects', { type: 'kombucha', name: k2.name, culture_id: scooby.id, status: 'active', stage: 'f2', specs: k2, started_at: iso(kStart2) });
  await store.insert('reminders', mkReminders(kb2.id, f2Schedule(f2Start, 3), now));

  // History.
  const past = [
    { name: 'Country loaf', hyd: 375, days: 3, rating: 4, temp: 21, bulk: 400, retard: 13, rise: 70, notes: 'Open crumb, good ear. A bit flat at the edges. Next time: shorter cold retard.' },
    { name: 'Rye and seeds', hyd: 400, days: 10, rating: 3, temp: 20, bulk: 430, retard: 16, rise: 55, notes: 'Dense. Retard went too long.' },
    { name: 'Country loaf', hyd: 365, days: 17, rating: 5, temp: 22, bulk: 380, retard: 12, rise: 75, notes: 'Best one so far.' },
    { name: 'Country loaf', hyd: 360, days: 24, rating: 5, temp: 21, bulk: 410, retard: 11, rise: 72, notes: '' },
    { name: 'Whole wheat', hyd: 340, days: 31, rating: 3, temp: 19, bulk: 330, retard: 14, rise: 50, notes: 'Underproofed.' }
  ];
  for (const p of past) {
    const spec = { ...BREAD_DEFAULTS, name: p.name, water: p.hyd, temp: p.temp, retardHours: p.retard, cultureId: rye.id };
    const start = now - p.days * TIME.DAY;
    await store.insert('projects', { type: 'bread', name: p.name, culture_id: rye.id, status: 'done', stage: 'done', specs: spec, started_at: iso(start), finished_at: iso(start + 26 * TIME.HOUR), rating: p.rating, notes: p.notes, result: { bulkMinutes: p.bulk, retardHours: p.retard, measuredRise: p.rise } });
  }
  const pastK = [
    { name: 'Batch #2', days: 25, f1: 11, f2: 2, fizz: 2, flavors: [] },
    { name: 'Batch #1', days: 40, f1: 9, f2: 3, fizz: 3, flavors: ['Lemon'] }
  ];
  for (const k of pastK) {
    const start = now - k.days * TIME.DAY;
    await store.insert('projects', { type: 'kombucha', name: k.name, culture_id: scooby.id, status: 'done', stage: 'done', specs: { volume: 3.8, tea: 'black', temp: 24, flavors: k.flavors, f1Days: k.f1, f2Days: k.f2, recipe: kombuchaRecipe(3.8) }, started_at: iso(start), finished_at: iso(start + (k.f1 + k.f2) * TIME.DAY), rating: k.fizz + 1, notes: '', result: { fizz: k.fizz } });
  }
}
