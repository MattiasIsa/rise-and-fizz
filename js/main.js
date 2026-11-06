import { html, render, Component, useState, useEffect, useApp } from './html.js';
import { Nav } from './components.js';
import { init, clearError, hardReset } from './lib/api.js';
import { Home } from './pages/home.js';
import { NewChooser, BreadForm, KombuchaForm } from './pages/new.js';
import { ProjectDetail } from './pages/detail.js';
import { Cultures } from './pages/cultures.js';
import { CultureDetail } from './pages/culture.js';
import { History } from './pages/history.js';
import { Stats } from './pages/stats.js';
import { Settings, Login } from './pages/settings.js';
import { Setup } from './pages/setup.js';

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
    if (parts[1] === 'bread') return html`<${BreadForm} key=${'nb' + (from ? from.id : '')} from=${from} culture=${query.get('culture')} />`;
    if (parts[1] === 'kombucha') return html`<${KombuchaForm} key=${'nk' + (from ? from.id : '')} from=${from} culture=${query.get('culture')} />`;
    return html`<${NewChooser} />`;
  }
  if (parts[0] === 'p' && parts[1]) {
    const p = byId(parts[1]);
    if (parts[2] === 'edit' && p) return p.type === 'bread' ? html`<${BreadForm} key=${'eb' + p.id} edit=${p} />` : html`<${KombuchaForm} key=${'ek' + p.id} edit=${p} />`;
    return html`<${ProjectDetail} id=${parts[1]} />`;
  }
  if (parts[0] === 'history') return parts[1] ? html`<${ProjectDetail} id=${parts[1]} back="#/history" />` : html`<${History} />`;
  if (parts[0] === 'c' && parts[1]) return html`<${CultureDetail} id=${parts[1]} />`;
  if (parts[0] === 'cultures') return html`<${Cultures} query=${query} />`;
  if (parts[0] === 'stats') return html`<${Stats} />`;
  if (parts[0] === 'settings') return html`<${Settings} />`;
  if (parts[0] === 'setup') return html`<${Setup} />`;
  return html`<div class="main"><div class="empty"><span class="h2">Page not found</span><a href="#/">Go home</a></div></div>`;
}

// If start-up takes suspiciously long, offer a way out instead of a frozen logo.
function Booting({ step }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSlow(true), 8000); return () => clearTimeout(t); }, []);
  return html`<div class="boot" style="display:flex;flex-direction:column;gap:18px;align-items:center;padding:0 16px">Rise & Fizz
    <span class="kicker muted">${step || 'Starting up'}…</span>
    ${slow && html`<span class="small muted" style="font-family:var(--body);font-weight:400;text-align:center;max-width:300px">Taking longer than usual. Close any other Rise & Fizz tabs, then reload. Still stuck? Reset clears the saved login (you'll sign in again).</span>
      <div class="row"><button class="btn y" onClick=${() => location.reload()}>Reload</button><button class="btn p" onClick=${hardReset}>Reset & reload</button></div>`}
  </div>`;
}

function App() {
  const s = useApp();
  const { path, query } = useRoute();
  // The Starter pack is a plain guide: show it straight away, signed in or not.
  if (path === '/setup' && (!s.ready || s.needsLogin)) return html`<${Setup} />`;
  if (!s.ready) return html`<${Booting} step=${s.bootStep} />`;
  if (s.needsLogin) return html`<${Login} />`;
  return html`
    <div class="shell">
      <${Nav} route=${path} />
      <${Page} path=${path} query=${query} s=${s} />
      ${s.error && html`<div class="toast" role="alert" style="background:var(--pink);color:#fff" onClick=${clearError}>Something went wrong: ${s.error} (tap to hide)</div>`}
    </div>`;
}

// Shows what went wrong instead of a blank screen.
class Boundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  componentDidCatch(error) { console.error(error); this.setState({ error }); }
  render() {
    const e = this.state.error;
    if (!e) return this.props.children;
    return html`<div class="main"><div class="card p stack">
      <span class="h2">Oops, something broke</span>
      <span class="small" style="font-family:var(--mono);white-space:pre-wrap;word-break:break-word">${String(e && (e.stack || e.message) || e).slice(0, 900)}</span>
      <button class="btn fill-y" onClick=${() => { this.setState({ error: null }); location.hash = '#/'; }}>Try again</button>
    </div></div>`;
  }
}

render(html`<${Boundary}><${App} /><//>`, document.getElementById('app'));
init().then(async () => {
  // If notifications are already allowed, make sure the server knows about this device.
  const { getState, getStore, tidyReminders } = await import('./lib/api.js');
  const { enablePush } = await import('./lib/push.js');
  const st = getState();
  if (st.mode === 'supabase' && st.session && 'Notification' in window && Notification.permission === 'granted') {
    enablePush(getStore()).catch((e) => console.warn('Push registration failed', e));
  }
  // Move kombucha reminders that land at night (in this phone's timezone) to the morning.
  if (st.ready && !st.needsLogin) tidyReminders().catch((e) => console.warn('Reminder tidy failed', e));
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW failed', e)));
}
