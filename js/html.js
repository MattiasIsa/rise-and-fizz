import { html, render } from 'htm/preact';
import { useState, useEffect, useMemo, useRef, useCallback } from 'preact/hooks';
import { getState, subscribe } from './lib/api.js';

export { html, render, useState, useEffect, useMemo, useRef, useCallback };

export function useApp() {
  const [s, setS] = useState(getState());
  useEffect(() => subscribe(setS), []);
  return s;
}

// Re-render every `ms` so countdowns and "in 12 min" labels stay fresh.
export function useNow(ms = 30000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

export const go = (path) => { window.location.hash = '#' + path; };

let toastTimer = null;
export function toast(msg) {
  let el = document.getElementById('rf-toast');
  if (!el) { el = document.createElement('div'); el.id = 'rf-toast'; el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.display = 'none'; }, 2600);
}
