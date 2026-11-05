import { html, useState, useApp, toast } from '../html.js';
import { Blobs } from '../components.js';
import { signIn, signOut, getStore, resetDemo } from '../lib/api.js';
import { pushSupport, enablePush, testNotification } from '../lib/push.js';

export function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const go = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { await signIn(email.trim()); setSent(true); } catch (err) { toast('Could not send: ' + err.message); } finally { setBusy(false); }
  };
  return html`
    <div class="main">
      <${Blobs} items=${[{ c: 'pink', x: '45%', y: '80px', s: 300 }, { c: 'teal', x: '-80px', y: '420px', s: 260 }, { c: 'dots', x: '60%', y: '560px', s: 220 }]} />
      <div style="height:6vh"></div>
      <h1 class="h-display">Rise<br/><i>& fizz</i></h1>
      <span class="muted">Your sourdough and kombucha, tracked. Sign in to sync across your phone and laptop.</span>
      ${sent ? html`
        <div class="slab y tilt-l stack"><span class="big-num" style="font-size:30px">Check your email</span><span>We sent a sign-in link to <b>${email}</b>. Open it on this device.</span></div>
        <button class="btn y" onClick=${() => setSent(false)}>Use another email</button>` : html`
        <form class="stack" onSubmit=${go}>
          <div class="field"><label for="em">Email</label><input id="em" class="input" type="email" required autocomplete="email" value=${email} onInput=${(e) => setEmail(e.target.value)} /></div>
          <button class="btn fill-y block" disabled=${busy || !email}>${busy ? 'Sending…' : 'Send me a sign-in link'}</button>
          <span class="small muted">No password needed. The link logs you in.</span>
        </form>`}
    </div>`;
}

export function Settings() {
  const s = useApp();
  const [p, setP] = useState(pushSupport());
  const [busy, setBusy] = useState(false);
  const store = getStore();
  const enable = async () => {
    setBusy(true);
    try { await enablePush(store); setP(pushSupport()); toast('Notifications on!'); } catch (e) { toast(e.message); } finally { setBusy(false); }
  };
  return html`
    <div class="main">
      <div class="topbar"><a href="#/">← HOME</a><span>SETTINGS</span></div>
      <h1 class="h-display">Set<i>tings</i></h1>

      <section class="card stack">
        <span class="kicker" style="color:var(--yellow)">Account</span>
        ${s.mode === 'supabase' && s.session ? html`
          <span>Signed in as <b>${s.session.user.email}</b>. Your data syncs to every device you sign in on.</span>
          <button class="btn p" onClick=${signOut}>Sign out</button>` : html`
          <span>Demo mode. Data is saved in this browser only.</span>
          <button class="btn y" onClick=${async () => { await resetDemo(); toast('Demo data reset'); }}>Reset demo data</button>`}
      </section>

      <section class="card p stack">
        <span class="kicker" style="color:var(--pink-text)">Notifications</span>
        ${p.permission === 'granted' ? html`
          <span>Notifications are on for this device.</span>
          <button class="btn p" onClick=${() => testNotification().catch((e) => toast(e.message))}>Send a test</button>
          ${s.mode === 'supabase' && html`<button class="btn" style="color:var(--muted)" disabled=${busy} onClick=${enable}>Re-register this device</button>`}` : p.needsInstall ? html`
          <span><b>On iPhone, install the app first:</b> tap the Share button, choose <b>Add to Home Screen</b>, then open Rise & Fizz from your home screen and come back here.</span>` : !p.hasApi ? html`
          <span>This browser doesn't support push notifications. Try Chrome, Edge, Firefox or Safari.</span>` : p.permission === 'denied' ? html`
          <span>Notifications are blocked. Allow them for this site in your browser or phone settings, then reload.</span>` : html`
          <span>Get pinged for folds, feeds, tastes and burps, even when the app is closed.</span>
          <button class="btn fill-p" disabled=${busy || s.mode !== 'supabase'} onClick=${enable}>${busy ? 'Turning on…' : 'Turn on notifications'}</button>
          ${s.mode !== 'supabase' && html`<span class="small muted">Available once you're signed in.</span>`}`}
      </section>

      <section class="card t stack">
        <span class="kicker" style="color:var(--teal-text)">Install the app</span>
        <span><b>iPhone / iPad:</b> Safari → Share → Add to Home Screen.</span>
        <span><b>Android:</b> Chrome menu ⋮ → Install app (or Add to Home screen).</span>
        <span><b>Laptop:</b> Chrome or Edge → the install icon in the address bar. Or just bookmark it.</span>
      </section>

      <span class="small muted">Rise & Fizz · ${s.mode === 'supabase' ? 'synced with Supabase' : 'demo mode'}</span>
    </div>`;
}
