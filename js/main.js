import { html, render, useState, useEffect, useApp } from './html.js';
import { Nav } from './components.js';
import { init, clearError } from './lib/api.js';
import { Home } from './pages/home.js';
import { NewChooser, BreadForm, KombuchaForm } from './pages/new.js';
import { ProjectDetail } from './pages/detail.js';
import { Cultures } from './pages/cultures.js';
import { History } from './pages/history.js';
import { Stats } from './pages/stats.js';
import { Settings, Login } from './pages/settings.js';

function parseHash() {
  const raw = (window.location.hash || '#/').slice(1) || '/';
  const [path, qs] = raw.split('?');
  return { path, query: new URLSearchParams(qs || '') };
}

function useRoute() {
  const [r, setR] = useState(parseHash());
  useEffect(() => {
    const on = () => { setR(parseHash()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return r;
}

function Page({ path, query, s }) {
  const parts = path.split('/').filter(Boolean);
  const byId = (id) => s.projects.find((p) => p.id === id);
  if (parts.length === 0) return html`<${Home} />`;
  if (parts[0] === 'new') {
    const from = query.get('from') ? byId(query.get('from')) : null;
    if (parts[1] === 'bread') return html`<${BreadForm} key=${'nb' + (from ? from.id : '')} from=${from} />`;
    if (parts[1] === 'kombucha') return html`<${KombuchaForm} key=${'nk' + (from ? from.id : '')} from=${from} />`;
    return html`<${NewChooser} />`;
  }
  if (parts[0] === 'p' && parts[1]) {
    const p = byId(parts[1]);
    if (parts[2] === 'edit' && p) return p.type === 'bread' ? html`<${BreadForm} key=${'eb' + p.id} edit=${p} />` : html`<${KombuchaForm} key=${'ek' + p.id} edit=${p} />`;
    return html`<${ProjectDetail} id=${parts[1]} />`;
  }
  if (parts[0] === 'history') return parts[1] ? html`<${ProjectDetail} id=${parts[1]} back="#/history" />` : html`<${History} />`;
  if (parts[0] === 'cultures') return html`<${Cultures} query=${query} />`;
  if (parts[0] === 'stats') return html`<${Stats} />`;
  if (parts[0] === 'settings') return html`<${Settings} />`;
  return html`<div class="main"><div class="empty"><span class="h2">Page not found</span><a href="#/">Go home</a></div></div>`;
}

function App() {
  const s = useApp();
  const { path, query } = useRoute();
  if (!s.ready) return html`<div class="boot">Rise & Fizz</div>`;
  if (s.needsLogin) return html`<${Login} />`;
  return html`
    <div class="shell">
      <${Nav} route=${path} />
      <${Page} path=${path} query=${query} s=${s} />
      ${s.error && html`<div class="toast" role="alert" style="background:var(--pink);color:#fff" onClick=${clearError}>Something went wrong: ${s.error} (tap to hide)</div>`}
    </div>`;
}

render(html`<${App} />`, document.getElementById('app'));
init();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW failed', e)));
}
