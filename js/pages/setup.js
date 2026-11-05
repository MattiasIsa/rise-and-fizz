import { html, useState, useApp } from '../html.js';
import { Blobs } from '../components.js';
import { pushSupport } from '../lib/push.js';

function detect() {
  const ua = navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /android/i.test(ua);
  const firefox = /firefox|fxios/i.test(ua);
  return { device: ios ? 'iphone' : android ? 'android' : 'laptop', firefox, ios };
}

const Step = ({ n, children }) => html`
  <div class="row" style="gap:12px;align-items:flex-start">
    <span class="big-num" style="font-size:26px;min-width:28px;color:var(--yellow);text-shadow:2px 2px 0 var(--pink)">${n}</span>
    <span style="padding-top:4px;line-height:1.45">${children}</span>
  </div>`;

const Done = ({ ok, label }) => html`<span class=${'badge' + (ok ? ' teal' : '')} style=${ok ? '' : 'background:transparent;border:2px solid var(--pink);color:var(--pink-text)'}>${ok ? '✓ ' + label : 'Not yet'}</span>`;

export function Setup() {
  const s = useApp();
  const d = detect();
  const [dev, setDev] = useState(d.device);
  const p = pushSupport();
  const installed = p.standalone;
  const signedIn = Boolean(s.session);
  const pinging = p.permission === 'granted';
  const url = 'mattiasisa.github.io/rise-and-fizz';

  return html`
    <div class="main">
      <${Blobs} items=${[{ c: 'pink', x: '50%', y: '40px', s: 280 }, { c: 'teal', x: '-90px', y: '700px', s: 260 }, { c: 'dots', x: '55%', y: '1300px', s: 240 }]} />
      <div class="topbar"><a href=${signedIn ? '#/settings' : '#/'}>← BACK</a><span>SETUP GUIDE</span></div>
      <h1 class="h-display">Starter<br/><i>pack</i></h1>
      <span style="font-size:17px;line-height:1.4">Everything you need to get Rise & Fizz rising on your phone. Four steps, about three minutes, no flour required.</span>

      <div class="stack" style="gap:6px">
        <span class="kicker">I'm setting up on</span>
        <div class="row wrap" role="group" aria-label="Device">
          ${[['iphone', 'iPhone'], ['android', 'Android'], ['laptop', 'Laptop']].map(([id, label]) => html`<button class=${'chip w' + (dev === id ? ' on' : '')} aria-pressed=${dev === id} onClick=${() => setDev(id)}>${label}</button>`)}
        </div>
      </div>

      <section class="slab y tilt-l stack" style="gap:12px">
        <div class="row between"><span class="kicker">Step 1</span>${dev !== 'laptop' && html`<${Done} ok=${installed} label="Installed" />`}</div>
        <span class="big-num" style="font-size:36px;line-height:.95">Find it a jar</span>
        <span style="font-weight:500">Put the app on your home screen so it opens like a real app.</span>
        ${dev === 'iphone' && html`
          <${Step} n="1">Open <b>${url}</b> in <b>Safari</b>. It has to be Safari, not Chrome or Firefox.<//>
          <${Step} n="2">Tap the <b>Share</b> button (the square with an arrow, at the bottom).<//>
          <${Step} n="3">Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>.<//>
          <${Step} n="4">Close Safari and open <b>Rise & Fizz</b> from your home screen. Do the rest of the steps in there.<//>`}
        ${dev === 'android' && html`
          <${Step} n="1">Open <b>${url}</b> in <b>Chrome</b> (best), or Firefox.<//>
          <${Step} n="2">Tap the <b>⋮</b> menu in the corner.<//>
          <${Step} n="3">Tap <b>Install app</b> or <b>Add to Home screen</b>, then confirm.<//>
          <${Step} n="4">Open <b>Rise & Fizz</b> from your home screen.<//>`}
        ${dev === 'laptop' && html`
          <${Step} n="1">Open <b>${url}</b> in Chrome, Edge, Safari or Firefox.<//>
          <${Step} n="2">Optional: in Chrome or Edge, click the <b>install</b> icon in the address bar to get it as a window. Or just bookmark it.<//>`}
      </section>

      <section class="slab t tilt-r stack" style="gap:12px">
        <div class="row between"><span class="kicker">Step 2</span><${Done} ok=${signedIn} label="Signed in" /></div>
        <span class="big-num" style="font-size:36px;line-height:.95">Wake the starter</span>
        <span style="font-weight:500">Make your own account with an email and a password.</span>
        <${Step} n="1">In the app, tap <b>New account</b>.<//>
        <${Step} n="2">Type your email and a password (at least 8 characters), then tap <b>Create my kitchen</b>.<//>
        <${Step} n="3">If it asks you to confirm, open the email from <b>Supabase</b> (check spam), tap the link once, then go back to the app and <b>Sign in</b>.${dev === 'iphone' ? ' The link opens Safari; that\'s fine, just return to the home screen app afterwards.' : ''}<//>
        <span class="small" style="font-weight:500">Everyone gets their own kitchen: your bakes, batches and starters are private to your email.</span>
      </section>

      <section class="slab p tilt-l stack" style="gap:12px">
        <div class="row between"><span class="kicker">Step 3</span><${Done} ok=${pinging} label="Pings on" /></div>
        <span class="big-num" style="font-size:36px;line-height:.95">Let it ping</span>
        <span style="font-weight:500">So the app can tell you when to fold, feed, taste and burp, even when it's closed.</span>
        ${dev === 'iphone' && html`<span class="small" style="font-weight:700">iPhone needs iOS 16.4 or newer, and the app must be opened from the home screen icon (step 1).</span>`}
        <${Step} n="1">In the app, go to <b>Settings</b>.<//>
        <${Step} n="2">Tap <b>Turn on notifications</b>, then <b>Allow</b>.<//>
        <${Step} n="3">Tap <b>Test from the server</b>, close the app, and wait about a minute for <b>"Test from Rise & Fizz"</b>.<//>
        ${signedIn && html`<a href="#/settings" class="btn" style="color:#fff;margin-top:4px">Go to Settings →</a>`}
      </section>

      <section class="card y stack" style="gap:10px">
        <span class="kicker" style="color:var(--yellow)">Step 4</span>
        <span class="h2">Knead to know</span>
        ${dev === 'iphone' && html`
          <span>• If pings stop, check <b>Settings → Notifications → Rise & Fizz</b>, and that a Focus mode isn't hiding them.</span>
          <span>• Deleting the home screen icon also switches its notifications off. Just add it again.</span>`}
        ${dev === 'android' && html`
          <span>• Pings late or missing? Go to <b>Settings → Apps → ${d.firefox ? 'Firefox' : 'Chrome'} → Battery</b> and choose <b>Unrestricted</b>.</span>
          <span>• Don't swipe the browser away in the app switcher. That can pause notifications.</span>`}
        <span>• Use the same email on every device and your kitchen syncs everywhere.</span>
        <span>• Tap <b>+</b> to start a loaf or a kombucha batch. The app builds the whole schedule.</span>
        <span>• Add your starters and SCOBYs under <b>Cultures</b> so feeding reminders work.</span>
        <span>• This guide is always under <b>Settings → Starter pack</b>.</span>
      </section>

      ${!signedIn && html`<a href="#/" class="btn fill-y block">I'm ready, sign me in →</a>`}
    </div>`;
}
