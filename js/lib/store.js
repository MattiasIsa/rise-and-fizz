// Storage backends with one interface:
//   list(table, { eq, order, desc, limit }), insert(table, rows), update(table, id, patch), remove(table, id)
// "local" keeps everything in this browser (demo mode).
// "supabase" syncs to your Supabase project, so every device sees the same data.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

export const TABLES = ['cultures', 'culture_events', 'projects', 'reminders', 'logs', 'facts'];
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36));

function sortRows(rows, order, desc) {
  if (!order) return rows;
  return [...rows].sort((a, b) => {
    const x = a[order], y = b[order];
    if (x === y) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    return (x < y ? -1 : 1) * (desc ? -1 : 1);
  });
}

export function createLocalStore() {
  const key = (t) => 'rf:' + t;
  const read = (t) => { try { return JSON.parse(localStorage.getItem(key(t)) || '[]'); } catch { return []; } };
  const write = (t, rows) => { try { localStorage.setItem(key(t), JSON.stringify(rows)); } catch (e) { console.warn('Could not save', e); } };
  return {
    kind: 'local',
    async list(table, { eq = {}, order, desc, limit } = {}) {
      let rows = read(table).filter((r) => Object.entries(eq).every(([k, v]) => r[k] === v));
      rows = sortRows(rows, order, desc);
      return limit ? rows.slice(0, limit) : rows;
    },
    async insert(table, input) {
      const list = Array.isArray(input) ? input : [input];
      const now = new Date().toISOString();
      const rows = list.map((r) => ({ id: uid(), created_at: now, ...r }));
      write(table, read(table).concat(rows));
      return rows;
    },
    async update(table, id, patch) {
      const rows = read(table);
      const i = rows.findIndex((r) => r.id === id);
      if (i < 0) return null;
      rows[i] = { ...rows[i], ...patch };
      write(table, rows);
      return rows[i];
    },
    async remove(table, id) {
      write(table, read(table).filter((r) => r.id !== id));
    },
    isEmpty() { return TABLES.every((t) => read(t).length === 0); },
    async resetAll() { TABLES.forEach((t) => localStorage.removeItem(key(t))); }
  };
}

export async function createSupabaseStore() {
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  const fail = (error) => { if (error) throw new Error(error.message || String(error)); };
  return {
    kind: 'supabase',
    client,
    async list(table, { eq = {}, order, desc, limit } = {}) {
      let q = client.from(table).select('*');
      Object.entries(eq).forEach(([k, v]) => { q = q.eq(k, v); });
      if (order) q = q.order(order, { ascending: !desc });
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      fail(error);
      return data || [];
    },
    async insert(table, input) {
      const list = Array.isArray(input) ? input : [input];
      const { data, error } = await client.from(table).insert(list).select();
      fail(error);
      return data || [];
    },
    async update(table, id, patch) {
      const { data, error } = await client.from(table).update(patch).eq('id', id).select().single();
      fail(error);
      return data;
    },
    async remove(table, id) {
      const { error } = await client.from(table).delete().eq('id', id);
      fail(error);
    },
    async session() { const { data } = await client.auth.getSession(); return data.session; },
    onAuth(cb) { return client.auth.onAuthStateChange((_e, session) => cb(session)); },
    async signIn(email) {
      const redirect = window.location.origin + window.location.pathname;
      const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } });
      fail(error);
    },
    async signOut() { await client.auth.signOut(); },
    async invoke(name, body) {
      const { data, error } = await client.functions.invoke(name, { body });
      fail(error);
      return data;
    },
    async uploadPhoto(file, userId) {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${userId}/${uid()}.${ext}`;
      const { error } = await client.storage.from('photos').upload(path, file, { contentType: file.type });
      fail(error);
      return path;
    },
    async photoUrl(path) {
      const { data } = await client.storage.from('photos').createSignedUrl(path, 3600);
      return data ? data.signedUrl : null;
    },
    subscribeChanges(cb) {
      const ch = client.channel('rf-changes');
      TABLES.concat('household_members').forEach((t) => ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, cb));
      ch.subscribe();
      return () => client.removeChannel(ch);
    }
  };
}

export const isCloudConfigured = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
