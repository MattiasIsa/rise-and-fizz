import { html, useState, useApp, toast } from '../html.js';
import { Blobs } from '../components.js';
import { signIn, signInPassword, signUp, resetPassword, setPassword, signOut, getStore, resetDemo, serverTestPing } from '../lib/api.js';
import { pushSupport, enablePush, testNotification } from '../lib/push.js';

export function Login() {
  const [mode, setMode] = useState('signin'); // signin | signup | link
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const act = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg('');
    try {
      if (mode === 'signin') await signInPassword(email.trim(), pw);
      else if (mode === 'signup') { const r = await signUp(email.trim(), pw); if (r.needsConfirm) setMsg('Almost there! Open the email from Supabase and tap the confirm link once. Then come back here and sign in.'); }
      else { await signIn(email.trim()); setMsg('Check your email and click the sign-in link. Best on a laptop: on iPhone, use a password instead.'); }
    } catch (err) {
      toast(err.message.includes('Invalid login') ? 'Wrong email or password' : err.message);
    } finally { setBusy(false); }
  };
  const forgot = async () => {
    if (!email.trim()) { toast('Type your email first'); return; }
    try { await resetPassword(email.trim()); setMsg('We emailed you a link. Open it, then set a new password in Settings.'); } catch (err) { toast(err.message); }
  };
  const tab = (id, label) => html`<button type="button" class=${'chip w' + (mode === id ? ' on' : '')} aria-pressed=${mode === id} onClick=${() => { setMode(id); setMsg(''); }}>${label}</button>`;
  return html`
    <div class="main">
      <${Blobs} items=${[{ c: 'pink', x: '45%', y: '80px', s: 300 }, { c: 'teal', x: '-80px', y: '460px', s: 260 }, { c: 'dots', x: '60%', y: '640px', s: 220 }]} />
      <div style="height:5vh"></div>
      <h1 class="h-display">Rise<br/><i>& fizz</i></h1>
      <span class="muted">Your sourdough and kombucha, tracked. Sign in to sync across your phone and laptop.</span>
      <div class="row wrap" role="group" aria-label="Sign-in method">${tab('signin', 'Sign in')}${tab('signup', 'New account')}${tab('link', 'Email link')}</div>
      ${msg && html`<div class="slab y tilt-l"><span style="font-weight:500">${msg}</span></div>`}
      <form class="stack" onSubmit=${act}>
        <div class="field"><label for="em">Email</label><input id="em" class="input" type="email" required autocomplete="email" value=${email} onInput=${(e) => setEmail(e.target.value)} /></div>
        ${mode !== 'link' && html`<div class="field"><label for="pw">Password${mode === 'signup' ? ' (at least 8 characters)' : ''}</label><input id="pw" class="input" type="password" required minlength=${mode === 'signup' ? 8 : 1} autocomplete=${mode === 'signup' ? 'new-password' : 'current-password'} value=${pw} onInput=${(e) => setPw(e.target.value)} /></div>`}
        <button class="btn fill-y block" disabled=${busy || !email || (mode !== 'link' && pw.length < (mode === 'signup' ? 8 : 1))}>${busy ? 'One sec…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create my kitchen' : 'Email me a sign-in link'}</button>
        ${mode === 'signin' && html`<button type="button" class="btn" style="color:var(--muted);border:0" onClick=${forgot}>Forgot password?</button>`}
      </form>
      <a href="#/setup" class="card t row between" style="text-decoration:none;color:inherit;margin-top:8px">
        <span class="stack" style="gap:2px"><b>New here? Grab the Starter pack</b><span class="small muted">Install, sign in and notifications, step by step</span></span>
        <span aria-hidden="true" style="color:var(--teal-text);font-size:22px">→</span>
      </a>
    </div>`;
}

function PasswordCard() {
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  return html`<section class="card stack">
    <span class="kicker" style="color:var(--yellow)">Password</span>
    <span class="small muted">Set or change the password you sign in with.</span>
    <div class="row">
      <input class="input" type="password" aria-label="New password" placeholder="New password (8+ characters)" autocomplete="new-password" value=${pw} onInput=${(e) => setPw(e.target.value)} />
      <button class="btn sm y" disabled=${busy || pw.length < 8} onClick=${async () => { setBusy(true); try { await setPassword(pw); setPw(''); toast('Password saved'); } catch (e) { toast(e.message); } finally { setBusy(false); } }}>Save</button>
    </div>
  </section>`;
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
      <a href="#/setup" class="slab t tilt-r row between" style="text-decoration:none">
        <span class="stack" style="gap:2px"><span class="big-num" style="font-size:28px">Starter pack</span><span style="font-weight:500">Setup guide for new phones and new people</span></span>
        <span aria-hidden="true" style="font-size:26px">→</span>
      </a>

      <section class="card stack">
        <span class="kicker" style="color:var(--yellow)">Account</span>
        ${s.mode === 'supabase' && s.session ? html`
          <span>Signed in as <b>${s.session.user.email}</b>. Your data syncs to every device you sign in on.</span>
          <button class="btn p" onClick=${signOut}>Sign out</button>` : html`
          <span>Demo mode. Data is saved in this browser only.</span>
          <button class="btn y" onClick=${async () => { await resetDemo(); toast('Demo data reset'); }}>Reset demo data</button>`}
      </section>
      ${s.mode === 'supabase' && s.session && html`<${PasswordCard} />`}

      <section class="card p stack">
        <span class="kicker" style="color:var(--pink-text)">Notifications</span>
        ${p.permission === 'granted' ? html`
          <span>Notifications are on for this device.</span>
          <button class="btn p" onClick=${() => testNotification().catch((e) => toast(e.message))}>Test on this phone</button>
          ${s.mode === 'supabase' && html`
            <button class="btn fill-p" disabled=${busy} onClick=${async () => { setBusy(true); try { await enablePush(store); await serverTestPing(); toast('Sent! Close the app; it should arrive within a minute.'); } catch (e) { toast(e.message); } finally { setBusy(false); } }}>Test from the server</button>
            <span class="small muted">The server test is the real one: it's how fold and feed reminders reach you when the app is closed.</span>`}` : p.needsInstall ? html`
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
