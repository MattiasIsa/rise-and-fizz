import { html, useState, useApp, toast } from '../html.js';
import { Blobs } from '../components.js';
import { APP_VERSION } from '../version.js';
import { signIn, signInPassword, signUp, resetPassword, setPassword, signOut, getStore, resetDemo, serverTestPing, hardReset, createHousehold, joinHousehold, updateMembership, renameHousehold, leaveHousehold } from '../lib/api.js';
import { Sheet } from '../components.js';
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

function KitchenCard({ s }) {
  const [mode, setMode] = useState('create');
  const [kitchen, setKitchen] = useState('Our kitchen');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const me = s.session.user.id;
  const mine = s.members.find((m) => m.user_id === me);
  const go = async (fn) => { setBusy(true); try { await fn(); } catch (e) { toast(e.message); } finally { setBusy(false); } };
  if (s.household && mine) {
    const share = async () => {
      const text = `Join our Rise & Fizz kitchen! Open https://mattiasisa.github.io/rise-and-fizz/#/setup , sign up, then go to Settings → Shared kitchen and enter the code ${s.household.invite_code}`;
      try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); toast('Invite copied'); } } catch (e) { /* cancelled */ }
    };
    return html`<section class="card y stack">
      <span class="kicker" style="color:var(--yellow)">Shared kitchen</span>
      <span class="h2">${s.household.name}</span>
      <div class="stack" style="gap:6px">${s.members.map((m) => html`<span class="row" style="gap:8px"><span class="badge yellow" style="background:var(--paper)">${m.display_name.toUpperCase()}</span><span class="small muted">${m.user_id === me ? 'you' : ''}</span></span>`)}</div>
      <div class="slab y tilt-l row between">
        <span class="stack" style="gap:0"><span class="kicker" style="font-size:11px">Invite code</span><span class="big-num" style="font-size:40px;letter-spacing:0.08em">${s.household.invite_code}</span></span>
        <button class="btn solid-ink" onClick=${share}>Share</button>
      </div>
      <span class="small muted">Whoever has this code can join after signing up. Everything you both log is shared, with a name tag showing whose it is.</span>
      <div class="field"><label for="dn">Your name tag</label>
        <div class="row"><input id="dn" class="input" value=${name || mine.display_name} onInput=${(e) => setName(e.target.value)} /><button class="btn sm y" disabled=${busy || !name.trim()} onClick=${() => go(async () => { await updateMembership({ display_name: name.trim() }); setName(''); toast('Saved'); })}>Save</button></div>
      </div>
      <label class="toggle-row"><input type="checkbox" checked=${mine.notify_all} onChange=${(e) => go(() => updateMembership({ notify_all: e.target.checked }))} /><span class="stack" style="gap:0"><b>Ping me for everyone's reminders</b><span class="small muted">Otherwise you only get pinged for your own loaves, batches and starters</span></span></label>
      <button class="btn" style="color:var(--muted)" onClick=${() => { const n = prompt('Kitchen name', s.household.name); if (n && n.trim()) go(() => renameHousehold(n.trim())); }}>Rename kitchen</button>
      <button class="btn p" onClick=${() => setLeaving(true)}>Leave kitchen</button>
      <${Sheet} open=${leaving} onClose=${() => setLeaving(false)} title="Leave the shared kitchen?">
        <span class="muted">You'll stop seeing everyone else's stuff. What you made stays in the kitchen for the others.</span>
        <button class="btn fill-p" onClick=${() => go(async () => { await leaveHousehold(); setLeaving(false); toast('Left the kitchen'); })}>Leave</button>
      <//>
    </section>`;
  }
  return html`<section class="card y stack">
    <span class="kicker" style="color:var(--yellow)">Shared kitchen</span>
    <span>Share bakes, batches and starters with someone, with name tags showing whose is whose.</span>
    <div class="row wrap">
      <button class=${'chip' + (mode === 'create' ? ' on' : '')} onClick=${() => setMode('create')}>Start a kitchen</button>
      <button class=${'chip' + (mode === 'join' ? ' on' : '')} onClick=${() => setMode('join')}>I have a code</button>
    </div>
    <div class="field"><label for="myn">Your name tag</label><input id="myn" class="input" placeholder="e.g. Mattias" value=${name} onInput=${(e) => setName(e.target.value)} /></div>
    ${mode === 'create' ? html`
      <div class="field"><label for="kn">Kitchen name</label><input id="kn" class="input" value=${kitchen} onInput=${(e) => setKitchen(e.target.value)} /></div>
      <button class="btn fill-y" disabled=${busy || !name.trim()} onClick=${() => go(async () => { await createHousehold(kitchen, name); toast('Kitchen created! Share the code.'); })}>Start kitchen</button>` : html`
      <div class="field"><label for="ic">Invite code</label><input id="ic" class="input" autocapitalize="characters" maxlength="6" value=${code} onInput=${(e) => setCode(e.target.value.toUpperCase())} style="font-size:22px;letter-spacing:0.2em;text-align:center" /></div>
      <button class="btn fill-y" disabled=${busy || !name.trim() || code.length < 6} onClick=${() => go(async () => { await joinHousehold(code, name); toast('Welcome to the kitchen!'); })}>Join kitchen</button>`}
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
      ${s.mode === 'supabase' && s.session && html`<${KitchenCard} s=${s} />`}
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

      <button class="btn" style="color:var(--muted)" onClick=${hardReset}>Trouble? Reset this device and reload</button>
      <span class="small muted">Rise & Fizz · version ${APP_VERSION.replace('rf-v', '')} · ${s.mode === 'supabase' ? 'synced with Supabase' : 'demo mode'}</span>
    </div>`;
}
