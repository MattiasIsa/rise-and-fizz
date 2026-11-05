import { html, useEffect, useState } from './html.js';
import { ownerName, ownerIndex } from './lib/api.js';

export function Blobs({ items = [] }) {
  return items.map((b) => html`<div aria-hidden="true" class=${'blob ' + b.c} style=${`left:${b.x};top:${b.y};width:${b.s}px;height:${b.s}px`}></div>`);
}

function bubbles(n, maxSize, seed = 0) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const k = i + seed;
    const size = 4 + ((k * 7) % maxSize);
    out.push({ left: 8 + ((k * 37) % 78), size, dur: 2.2 + (k % 3) * 0.7, delay: ((k * 0.45) % 3).toFixed(2) });
  }
  return out;
}

// A jar of dough or tea. fill = how full (0–100), activity = 0–100 (more bubbles, faster).
export function Jar({ type = 'bread', fill = 50, activity = 50, peak = null, w = 110, h = 160, label }) {
  const n = Math.round(2 + (activity / 100) * (type === 'tea' ? 10 : 8));
  const speed = 1.6 - (activity / 100) * 0.6;
  const bs = bubbles(n, type === 'tea' ? 6 : 9, Math.round(fill));
  return html`
    <div class="jar-wrap" role="img" aria-label=${label || (type === 'tea' ? 'Kombucha jar' : 'Starter jar')}>
      ${type === 'bread' && html`<div class="jar-lid" style=${`width:${Math.round(w * 0.82)}px`}></div>`}
      <div class=${'jar ' + type} style=${`width:${w}px;height:${h}px`}>
        <div class="fill" style=${`height:${fill}%`}></div>
        <div class="dots" style=${`height:${fill}%`}></div>
        ${type === 'tea' && html`<div class="scoby" style=${`bottom:${fill}%`}></div>`}
        ${peak != null && html`<div class="peak" style=${`bottom:${peak}%`}></div>`}
        ${bs.map((b) => html`<span class="bub" style=${`left:${b.left}%;width:${b.size}px;height:${b.size}px;animation-duration:${(b.dur * speed).toFixed(2)}s;animation-delay:${b.delay}s`}></span>`)}
      </div>
    </div>`;
}

export function Nav({ route }) {
  const on = (p) => (route === p || (p !== '/' && route.startsWith(p)) ? 'on' : '');
  return html`
    <nav class="nav" aria-label="Main">
      <span class="brand">Rise<br/><i>& fizz</i></span>
      <a href="#/" class=${route === '/' ? 'on' : ''}>HOME</a>
      <a href="#/cultures" class=${on('/cultures') || (route.startsWith('/c/') ? 'on' : '')}>CULTURES</a>
      <a href="#/new" class="plus" aria-label="Start something new">+</a>
      <a href="#/history" class=${on('/history')}>HISTORY</a>
      <a href="#/stats" class=${on('/stats')}>STATS</a>
      <a href="#/setup" class=${on('/setup') + ' start-wide-settings'}>STARTER PACK</a>
      <a href="#/settings" class=${on('/settings') + ' start-wide-settings'}>SETTINGS</a>
      <a href="#/new" class="start-wide">+ START NEW</a>
    </nav>`;
}

export function Sheet({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return;
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open]);
  if (!open) return null;
  return html`
    <div class="sheet-bg" onClick=${(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label=${title}>
        <div class="row between"><span class="h2">${title}</span><button class="icon-btn" style="color:var(--paper)" aria-label="Close" onClick=${onClose}>×</button></div>
        ${children}
      </div>
    </div>`;
}

export function Stars({ value, onChange }) {
  return html`<div class="row" role="radiogroup" aria-label="Rating">
    ${[1, 2, 3, 4, 5].map((n) => html`<button type="button" role="radio" aria-checked=${value === n} aria-label=${n + ' out of 5'} class=${'chip' + (value >= n ? ' on' : '')} style="min-width:48px" onClick=${() => onChange(n)}>${n}</button>`)}
  </div>`;
}

export function Stages({ stages, current, color = 'var(--yellow)' }) {
  const idx = stages.findIndex((s) => s.key === current);
  return html`<div class="stages" style=${`--n:${stages.length};--c:${color}`}>
    ${stages.map((s, i) => html`<span class=${current === 'done' || i < idx ? 'on' : i === idx ? 'now' : ''}><i></i>${s.label}</span>`)}
  </div>`;
}

// Small name tag showing whose loaf, batch or starter this is (only in a shared kitchen).
const OWNER_COLORS = [['#FFE800', '#15173D'], ['#FF2E9A', '#FFFFFF'], ['#00C2B8', '#15173D'], ['#F5F0FF', '#15173D']];
export function Owner({ id, style = '' }) {
  const name = ownerName(id);
  if (!name) return null;
  const [bg, fg] = OWNER_COLORS[ownerIndex(id) % OWNER_COLORS.length];
  return html`<span class="owner" style=${`background:${bg};color:${fg};${style}`} title=${name + "'s"}>${name.toUpperCase()}</span>`;
}

// A quiet delete button that asks first. what: e.g. "Jonny"; detail: what else goes with it.
export function DeleteButton({ label = 'Delete', what, detail, onDelete }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return html`
    <button class="btn" style="color:var(--pink-text);border-style:dashed;opacity:0.85" onClick=${() => setOpen(true)}>${label}</button>
    <${Sheet} open=${open} onClose=${() => setOpen(false)} title=${'Delete ' + what + '?'}>
      <span class="muted">${detail || what + ' will be removed.'} This can't be undone.</span>
      <button class="btn fill-p" disabled=${busy} onClick=${async () => { setBusy(true); try { await onDelete(); setOpen(false); } finally { setBusy(false); } }}>${busy ? 'Deleting…' : 'Yes, delete ' + what}</button>
      <button class="btn" style="color:var(--muted)" onClick=${() => setOpen(false)}>Keep it</button>
    <//>`;
}
