// App state + every action the screens can take. Screens never talk to storage directly.

import { createLocalStore, createSupabaseStore, isCloudConfigured } from './store.js';
import { breadSchedule, kombuchaSchedule, f2Schedule, starterPeakHours, awake, DAYTIME_KINDS, TIME } from './schedule.js';
import { seedDemo } from './demo.js';
import { localFact } from './facts.js';

let store = null;
const listeners = new Set();
let state = { ready: false, mode: 'local', session: null, needsLogin: false, error: null,
  cultures: [], cultureEvents: [], projects: [], reminders: [], logs: [], facts: [], household: null, members: [] };

export const getState = () => state;
export const getStore = () => store;
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function set(patch) { state = { ...state, ...patch }; listeners.forEach((fn) => fn(state)); }

function withTimeout(promise, ms, what) {
  return Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error(`Timed out while ${what}`)), ms))]);
}

export async function init() {
  try {
    if (isCloudConfigured()) {
      set({ bootStep: 'Loading the database library' });
      store = await withTimeout(createSupabaseStore(), 15000, 'loading the database library');
      set({ bootStep: 'Checking your login' });
      const session = await withTimeout(store.session(), 10000, 'checking your login');
      set({ mode: 'supabase', session });
      // Never call Supabase inside its own auth callback (it can deadlock): defer the refresh.
      store.onAuth((s) => {
        set({ session: s, needsLogin: !s });
        if (s) setTimeout(() => { refresh().then(() => set({ ready: true })).catch((e) => set({ ready: true, error: e.message })); }, 0);
      });
      if (!session) { set({ ready: true, needsLogin: true }); return; }
      store.subscribeChanges(() => refresh());
    } else {
      store = createLocalStore();
      if (store.isEmpty()) await seedDemo(store);
      set({ mode: 'local' });
    }
    set({ bootStep: 'Loading your kitchen' });
    await withTimeout(refresh(), 15000, 'loading your kitchen');
    set({ ready: true });
  } catch (e) {
    console.error(e);
    set({ ready: true, error: e.message || String(e) });
  }
}

let refreshing = null;
export async function refresh() {
  if (!store) return;
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const [cultures, cultureEvents, projects, reminders, logs, facts] = await Promise.all([
      store.list('cultures', { order: 'created_at' }),
      store.list('culture_events', { order: 'at', desc: true }),
      store.list('projects', { order: 'started_at', desc: true }),
      store.list('reminders', { order: 'due_at' }),
      store.list('logs', { order: 'at', desc: true }),
      store.list('facts', { order: 'created_at', desc: true, limit: 30 })
    ]);
    let household = null, members = [];
    if (store.kind === 'supabase') {
      const [h, m] = await Promise.all([store.list('households'), store.list('household_members', { order: 'joined_at' })]);
      household = h[0] || null;
      members = household ? m.filter((x) => x.household_id === household.id) : [];
    }
    set({ cultures, cultureEvents, projects, reminders, logs, facts, household, members, error: null });
  })().finally(() => { refreshing = null; });
  return refreshing;
}

async function run(fn) {
  try { const r = await fn(); await refresh(); return r; }
  catch (e) { console.error(e); set({ error: e.message || String(e) }); throw e; }
}

// ---------- Auth ----------
export const signIn = (email) => store.signIn(email);
const redirect = () => window.location.origin + window.location.pathname;
export async function signInPassword(email, password) {
  const { error } = await store.client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}
export async function signUp(email, password) {
  const { data, error } = await store.client.auth.signUp({ email, password, options: { emailRedirectTo: redirect() } });
  if (error) throw new Error(error.message);
  return { needsConfirm: !data.session };
}
export async function resetPassword(email) {
  const { error } = await store.client.auth.resetPasswordForEmail(email, { redirectTo: redirect() + '#/settings' });
  if (error) throw new Error(error.message);
}
export async function setPassword(password) {
  const { error } = await store.client.auth.updateUser({ password });
  if (error) throw new Error(error.message);
}
export const signOut = async () => { await store.signOut(); set({ session: null, needsLogin: true }); };

// ---------- Projects ----------
// Steps already in the past (a backdated start) are marked done at their own time, so they don't nag.
const toReminders = (projectId, steps, notify) => {
  const now = Date.now() - 5 * TIME.MIN;
  return steps.map((s) => ({
    project_id: projectId, kind: s.kind, title: s.title, detail: s.detail || '', due_at: s.at, idx: s.idx, notify: notify !== false,
    ...(new Date(s.at).getTime() < now ? { done_at: s.at } : {})
  }));
};

// Kombucha reminders follow the phone's current timezone: anything open that lands at night moves to the morning.
// Runs on start-up, so it also fixes reminders made while travelling.
async function realignDaytime() {
  for (const r of state.reminders) {
    if (r.done_at || !DAYTIME_KINDS.includes(r.kind) || !r.project_id) continue;
    const p = state.projects.find((x) => x.id === r.project_id);
    if (!p || p.type !== 'kombucha') continue;
    const t = new Date(r.due_at).getTime();
    const moved = awake(t);
    if (moved !== t) await store.update('reminders', r.id, { due_at: new Date(moved).toISOString(), notified_at: null });
  }
}
export function tidyReminders() { return run(realignDaytime); }

// prefeed: optional { at, title, detail } reminder to feed the starter before mixing (from Plan backwards).
export function createBread(spec, startAt, prefeed = null) {
  return run(async () => {
    const [p] = await store.insert('projects', {
      type: 'bread', name: spec.name || 'Sourdough', culture_id: spec.cultureId || null, status: 'active', stage: 'mix',
      specs: spec, started_at: new Date(startAt).toISOString()
    });
    const steps = breadSchedule(spec, startAt);
    if (prefeed) steps.unshift({ kind: 'prefeed', title: prefeed.title, detail: prefeed.detail || '', at: new Date(prefeed.at).toISOString(), idx: -1 });
    await store.insert('reminders', toReminders(p.id, steps, spec.notify));
    await addLogRaw(p.id, 'Started bake', {});
    return p;
  });
}

export function createKombucha(spec, startAt) {
  return run(async () => {
    const [p] = await store.insert('projects', {
      type: 'kombucha', name: spec.name || 'Kombucha', culture_id: spec.cultureId || null, status: 'active', stage: 'f1',
      specs: spec, started_at: new Date(startAt).toISOString()
    });
    await store.insert('reminders', toReminders(p.id, kombuchaSchedule(spec, startAt), spec.notify));
    await addLogRaw(p.id, `Brewed ${spec.volume} L · ${spec.recipe ? spec.recipe.sugar + ' g sugar, ' + spec.recipe.teaG + ' g tea' : ''}`.trim(), {});
    return p;
  });
}

export function updateProject(id, patch) { return run(() => store.update('projects', id, patch)); }

export function updateSpecs(project, specPatch, rescheduleFrom) {
  return run(async () => {
    const specs = { ...project.specs, ...specPatch };
    await store.update('projects', project.id, { specs, name: specs.name || project.name });
    if (rescheduleFrom && project.type === 'bread') {
      const steps = state.reminders.filter((r) => r.project_id === project.id);
      const fresh = breadSchedule(specs, project.started_at);
      for (const r of steps) {
        const match = fresh.find((f) => f.idx === r.idx);
        if (match && !r.done_at) await store.update('reminders', r.id, { due_at: match.at, title: match.title, detail: match.detail, notified_at: null });
      }
    }
  });
}

export function finishProject(project, { rating, notes, result }) {
  return run(async () => {
    await store.update('projects', project.id, {
      status: 'done', stage: 'done', finished_at: new Date().toISOString(),
      rating: rating ?? null, notes: notes ?? project.notes ?? '', result: { ...(project.result || {}), ...(result || {}) }
    });
    const open = state.reminders.filter((r) => r.project_id === project.id && !r.done_at);
    for (const r of open) await store.update('reminders', r.id, { done_at: new Date().toISOString(), skipped: true });
    await addLogRaw(project.id, rating ? `Finished · rated ${rating}/5` : 'Finished', {});
  });
}

export function deleteProject(project) {
  return run(async () => {
    for (const r of state.reminders.filter((x) => x.project_id === project.id)) await store.remove('reminders', r.id);
    for (const l of state.logs.filter((x) => x.project_id === project.id)) await store.remove('logs', l.id);
    await store.remove('projects', project.id);
  });
}

// ---------- Reminders ----------
export function completeReminder(r) {
  return run(async () => {
    const now = new Date().toISOString();
    await store.update('reminders', r.id, { done_at: now });
    if (r.project_id) {
      const p = state.projects.find((x) => x.id === r.project_id);
      await addLogRaw(r.project_id, r.title, { kind: r.kind });
      if (p && p.type === 'bread') {
        const stageAfter = { mix: 'mix', add: 'folds', fold: 'folds', shape: 'fridge', fridge: 'fridge', bake: 'baked' }[r.kind];
        if (stageAfter) await store.update('projects', p.id, { stage: stageAfter });
        // Push later folds relative to the one just done, so the 30-min rhythm follows you.
        if (r.kind === 'fold' || r.kind === 'add') {
          const later = state.reminders.filter((x) => x.project_id === p.id && x.kind === 'fold' && !x.done_at && x.idx > r.idx).sort((a, b) => a.idx - b.idx);
          const every = (p.specs && p.specs.foldEveryMin) || 30;
          for (let i = 0; i < later.length; i++) {
            await store.update('reminders', later[i].id, { due_at: new Date(Date.now() + (i + 1) * every * TIME.MIN).toISOString(), notified_at: null });
          }
        }
      }
      if (p && p.type === 'kombucha' && r.kind === 'fridge' && p.stage === 'f2') {
        await store.update('projects', p.id, { stage: 'chilling' });
      }
    }
    if (r.culture_id && r.kind === 'feed') await feedCultureRaw(r.culture_id, {});
  });
}

export function snoozeReminder(r, minutes = 10) {
  return run(() => store.update('reminders', r.id, { due_at: new Date(Date.now() + minutes * TIME.MIN).toISOString(), notified_at: null }));
}

export function moveReminder(r, isoDate) {
  return run(() => store.update('reminders', r.id, { due_at: new Date(isoDate).toISOString(), notified_at: null }));
}

// ---------- Kombucha actions ----------
export function bottleForF2(project, { flavors, days }) {
  return run(async () => {
    const now = new Date();
    for (const r of state.reminders.filter((x) => x.project_id === project.id && x.kind === 'taste' && !x.done_at)) {
      await store.update('reminders', r.id, { done_at: now.toISOString(), skipped: true });
    }
    await store.update('projects', project.id, {
      stage: 'f2', specs: { ...project.specs, flavors, f2Days: days, f2StartedAt: now.toISOString(), f1Days: Math.round((now - new Date(project.started_at)) / TIME.DAY) }
    });
    await store.insert('reminders', toReminders(project.id, f2Schedule(now, days), project.specs && project.specs.notify));
    await addLogRaw(project.id, `Bottled for F2${flavors.length ? ' · ' + flavors.join(', ') : ''}`, { flavors });
  });
}

export function logTaste(project, value, ph) {
  return run(async () => {
    const data = { taste: value };
    if (ph) data.ph = Number(ph);
    const words = value < 28 ? 'sweet' : value < 55 ? 'balanced' : value < 80 ? 'tart' : 'vinegary';
    await addLogRaw(project.id, `Tasted: ${words}${ph ? ' · pH ' + ph : ''}`, data);
    await store.update('projects', project.id, { result: { ...(project.result || {}), lastTaste: value, ph: ph ? Number(ph) : (project.result || {}).ph } });
    const due = state.reminders.find((r) => r.project_id === project.id && r.kind === 'taste' && !r.done_at && new Date(r.due_at) <= new Date(Date.now() + 6 * TIME.HOUR));
    if (due) await store.update('reminders', due.id, { done_at: new Date().toISOString() });
  });
}

// ---------- Logs ----------
async function addLogRaw(projectId, text, data) {
  return store.insert('logs', { project_id: projectId, at: new Date().toISOString(), text, data: data || {} });
}
export function addLog(projectId, text, data) { return run(() => addLogRaw(projectId, text, data)); }
export function updateLog(id, patch) { return run(() => store.update('logs', id, patch)); }
export function removeLog(id) { return run(() => store.remove('logs', id)); }

export async function addPhoto(projectId, file) {
  if (store.kind !== 'supabase') {
    const dataUrl = await shrinkImage(file, 900);
    return addLog(projectId, 'Photo', { photo: dataUrl });
  }
  const path = await store.uploadPhoto(file, state.session.user.id);
  return addLog(projectId, 'Photo', { photo_path: path });
}

function shrinkImage(file, max) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', 0.75));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export const photoUrl = (data) => (data.photo ? Promise.resolve(data.photo) : store.photoUrl ? store.photoUrl(data.photo_path) : Promise.resolve(null));

// ---------- Cultures ----------
export function createCulture(c) {
  return run(async () => {
    const [row] = await store.insert('cultures', { kind: c.kind, name: c.name, location: c.location || 'counter', feed_every_hours: c.feedEveryHours || (c.location === 'fridge' ? 168 : 12), notes: c.notes || '', born_on: c.bornOn || new Date().toISOString().slice(0, 10) });
    return row;
  });
}
export function updateCulture(id, patch) { return run(() => store.update('cultures', id, patch)); }

async function feedCultureRaw(cultureId, data) {
  const c = state.cultures.find((x) => x.id === cultureId);
  const now = new Date();
  await store.insert('culture_events', { culture_id: cultureId, type: c && c.kind === 'scoby' ? 'check' : 'feed', at: now.toISOString(), data: data || {} });
  if (!c || c.kind === 'scoby') return;
  // A feed also ticks off any planned bake's "feed the starter" step that's due within the next few hours.
  const bakes = state.projects.filter((p) => p.culture_id === cultureId && p.status === 'active').map((p) => p.id);
  for (const r of state.reminders.filter((x) => x.kind === 'prefeed' && !x.done_at && bakes.includes(x.project_id) && new Date(x.due_at).getTime() < now.getTime() + 4 * TIME.HOUR)) {
    await store.update('reminders', r.id, { done_at: now.toISOString() });
  }
  for (const r of state.reminders.filter((x) => x.culture_id === cultureId && !x.done_at)) {
    await store.update('reminders', r.id, { done_at: now.toISOString(), skipped: true });
  }
  const next = new Date(now.getTime() + (c.feed_every_hours || 12) * TIME.HOUR);
  const peak = starterPeakHours(data.temp || 21, data.ratio || 2);
  await store.insert('reminders', { culture_id: cultureId, kind: 'feed', title: `Feed ${c.name}`, detail: c.location === 'fridge' ? 'Weekly fridge feed' : `Peaks about ${peak.toFixed(1)} h after a feed`, due_at: next.toISOString(), idx: 0, notify: true });
}
export function feedCulture(cultureId, data) { return run(() => feedCultureRaw(cultureId, data)); }
// Other moments in a culture's life: 'peak' ({hours}), 'baby' (new SCOBY), 'note' ({text}).
export function logCultureEvent(cultureId, type, data = {}, at = new Date()) {
  return run(() => store.insert('culture_events', { culture_id: cultureId, type, at: new Date(at).toISOString(), data }));
}
// Deletes a culture with its feeds, peaks, notes and reminders. Loaves and batches stay, just unlinked.
export function deleteCulture(c) {
  return run(async () => {
    if (store.kind !== 'supabase') {
      // The database cascades this; the demo store needs it done by hand.
      for (const e of state.cultureEvents.filter((x) => x.culture_id === c.id)) await store.remove('culture_events', e.id);
      for (const r of state.reminders.filter((x) => x.culture_id === c.id)) await store.remove('reminders', r.id);
      for (const p of state.projects.filter((x) => x.culture_id === c.id)) await store.update('projects', p.id, { culture_id: null });
    }
    await store.remove('cultures', c.id);
  });
}
export function removeCultureEvent(id) { return run(() => store.remove('culture_events', id)); }

// ---------- Facts ----------
export async function newFact(kind = 'fact') {
  if (store.kind === 'supabase') {
    try { return await run(() => store.invoke('daily-fact', { kind })); }
    catch (e) { console.warn('AI fact unavailable, using a local one', e); }
  }
  const text = localFact(state, kind, state.facts.length);
  return run(() => store.insert('facts', { kind: kind + '-local', text }));
}

// Real end-to-end test: the server sends this within about a minute, even if the app is closed.
export function serverTestPing() {
  return run(() => store.insert('reminders', { kind: 'test', title: 'Test from Rise & Fizz', detail: 'Server notifications work. Bubbles incoming!', due_at: new Date().toISOString(), idx: 0, notify: true }));
}

// ---------- Shared kitchen ----------
async function rpc(fn, args) {
  const { data, error } = await store.client.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
}
export const createHousehold = (name, myName) => run(() => rpc('rf_create_household', { kitchen_name: name, my_name: myName }));
export const joinHousehold = (code, myName) => run(() => rpc('rf_join_household', { code, my_name: myName }));
export function updateMembership(patch) {
  return run(async () => {
    const me = state.session.user.id;
    const { error } = await store.client.from('household_members').update(patch).eq('household_id', state.household.id).eq('user_id', me);
    if (error) throw new Error(error.message);
  });
}
export function renameHousehold(name) {
  return run(async () => {
    const { error } = await store.client.from('households').update({ name }).eq('id', state.household.id);
    if (error) throw new Error(error.message);
  });
}
export function leaveHousehold() {
  return run(async () => {
    const { error } = await store.client.from('household_members').delete().eq('household_id', state.household.id).eq('user_id', state.session.user.id);
    if (error) throw new Error(error.message);
  });
}

// Display name for whoever owns a row, when the kitchen is shared.
export function ownerName(userId) {
  if (!state.household || state.members.length < 2) return null;
  const m = state.members.find((x) => x.user_id === userId);
  return m ? m.display_name : null;
}
export function ownerIndex(userId) {
  return Math.max(0, state.members.findIndex((x) => x.user_id === userId));
}

// Escape hatch: forget the saved login and cached files, then start fresh.
export async function hardReset() {
  try { Object.keys(localStorage).filter((k) => k.startsWith('sb-')).forEach((k) => localStorage.removeItem(k)); } catch {}
  try { const keys = await caches.keys(); await Promise.all(keys.map((k) => caches.delete(k))); } catch {}
  try { const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map((r) => r.unregister())); } catch {}
  location.reload();
}

export function clearError() { set({ error: null }); }
export async function resetDemo() { if (store.kind === 'local') { await store.resetAll(); await seedDemo(store); await refresh(); } }
