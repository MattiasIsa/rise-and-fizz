import { html, useState, useApp, useNow, toast } from '../html.js';
import { Jar, Blobs, Sheet, Owner } from '../components.js';
import { feedCulture, createCulture, updateCulture } from '../lib/api.js';
import { starterPeakHours, TIME } from '../lib/schedule.js';
import { whenLabel } from '../lib/format.js';
import { solveFeed, fmtGrams } from '../lib/feedcalc.js';

const ago = (iso, now) => {
  if (!iso) return 'never';
  const h = (now - new Date(iso).getTime()) / TIME.HOUR;
  if (h < 1) return 'just now';
  if (h < 48) return Math.round(h) + ' h ago';
  return Math.round(h / 24) + ' days ago';
};

function AddCulture({ open, onClose }) {
  const [kind, setKind] = useState('starter');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('counter');
  const [every, setEvery] = useState(12);
  return html`<${Sheet} open=${open} onClose=${onClose} title="Add a culture">
    <div class="row wrap">
      <button type="button" class=${'chip' + (kind === 'starter' ? ' on' : '')} onClick=${() => setKind('starter')}>Sourdough starter</button>
      <button type="button" class=${'chip t' + (kind === 'scoby' ? ' on' : '')} onClick=${() => setKind('scoby')}>SCOBY</button>
    </div>
    <div class="field"><label for="cn">Name</label><input id="cn" class="input" placeholder=${kind === 'scoby' ? 'e.g. Scooby' : 'e.g. Rye starter'} value=${name} onInput=${(e) => setName(e.target.value)} /></div>
    ${kind === 'starter' && html`
      <div class="row wrap">
        <button type="button" class=${'chip w' + (location === 'counter' ? ' on' : '')} onClick=${() => { setLocation('counter'); setEvery(12); }}>On the counter</button>
        <button type="button" class=${'chip w' + (location === 'fridge' ? ' on' : '')} onClick=${() => { setLocation('fridge'); setEvery(168); }}>In the fridge</button>
      </div>
      <div class="field"><label for="ce">Feed every (hours)</label><input id="ce" class="input" type="number" inputmode="decimal" min="1" value=${every} onInput=${(e) => setEvery(e.target.value)} /></div>`}
    <button class="btn fill-y" disabled=${!name.trim() || (kind === 'starter' && !(Number(every) > 0))} onClick=${async () => { await createCulture({ kind, name: name.trim(), location, feedEveryHours: Number(every) || 12 }); onClose(); toast('Added ' + name.trim()); }}>Add</button>
  <//>`;
}

function FeedSheet({ c, onClose }) {
  const [ratioText, setRatioText] = useState('1:2:2');
  const [ratioMode, setRatioMode] = useState('user'); // 'user' = ratio drives grams, 'auto' = grams drive ratio
  const [typed, setTyped] = useState({ s: '', f: '', w: '' });
  const [last, setLast] = useState('s');
  const [temp, setTemp] = useState(21);
  const [flour, setFlour] = useState('');
  if (!c) return null;
  const scoby = c.kind === 'scoby';
  const calc = solveFeed(typed, ratioText, last);

  const typeGram = (k) => (e) => {
    const next = { ...typed, [k]: e.target.value };
    setTyped(next); setLast(k);
    const count = Object.values(next).filter((v) => v !== '').length;
    setRatioMode(count >= 2 ? 'auto' : 'user');
  };
  // Changing the ratio keeps only the amount you typed last; the rest follows the new ratio.
  const pickRatio = (text) => {
    setRatioText(text); setRatioMode('user');
    setTyped((t) => ({ s: '', f: '', w: '', [last]: t[last] }));
  };
  const ratioShown = ratioMode === 'auto' && calc.actualText ? calc.actualText : ratioText;
  const presets = ['1:1:1', '1:2:2', '1:5:5'];
  const gramBox = (k, label) => html`
    <div class="field">
      <label for=${'g' + k}>${label} (g)</label>
      <input id=${'g' + k} class="input" type="number" inputmode="decimal" min="0" value=${typed[k]} placeholder=${k in calc.auto ? fmtGrams(calc.auto[k]) : 'g'} onInput=${typeGram(k)} style="font-size:20px" />
    </div>`;

  return html`<${Sheet} open=${!!c} onClose=${onClose} title=${scoby ? 'Log a check · ' + c.name : 'Feed · ' + c.name}>
    ${!scoby && html`
      <span class="label">Ratio (starter : flour : water)</span>
      <div class="row wrap">
        ${presets.map((r) => html`<button type="button" class=${'chip' + (ratioShown === r ? ' on' : '')} onClick=${() => pickRatio(r)}>${r}</button>`)}
        <input class="input" aria-label="Custom ratio" inputmode="decimal" value=${ratioShown} onInput=${(e) => pickRatio(e.target.value)} onFocus=${() => { if (ratioMode === 'auto' && calc.actualText) { setRatioText(calc.actualText); setRatioMode('user'); } }} style=${'flex:1;min-width:110px;' + (ratioMode === 'auto' ? 'border-color:var(--teal);color:var(--teal-text)' : '')} />
      </div>
      <div class="grid-3">${gramBox('s', 'Starter')}${gramBox('f', 'Flour')}${gramBox('w', 'Water')}</div>
      <div class=${'card' + (ratioMode === 'auto' ? ' t' : '')} style="padding:10px 12px;display:flex;flex-direction:column;gap:4px">
        ${calc.complete ? html`
          <span class="kicker" style="font-size:11px">${ratioMode === 'auto' ? 'Your ratio' : 'Feeding'} <span style="color:var(--yellow)">${calc.actualText}</span>${calc.hydration != null ? html` · <span style="color:var(--teal-text)">${Math.round(calc.hydration * 100)}% hydration</span>` : ''}</span>
          <span class="small muted">${fmtGrams(calc.full.s)} g starter + ${fmtGrams(calc.full.f)} g flour + ${fmtGrams(calc.full.w)} g water = ${fmtGrams(calc.full.s + calc.full.f + calc.full.w)} g</span>` : html`
          <span class="small muted">${calc.r ? 'Type any amount and the rest fills in. Faint numbers are suggestions you can type over.' : 'Type a ratio like 1:2:2, or 1:5 for 1:5:5.'}</span>`}
        ${calc.suggestion && html`
          <div class="row between" style="gap:8px;margin-top:4px">
            <span class="small" style="color:var(--pink-text)">${calc.suggestion.text}</span>
            <button type="button" class="btn sm p" onClick=${() => setTyped({ ...typed, w: String(calc.suggestion.water) })}>Use ${calc.suggestion.water} g</button>
          </div>`}
      </div>
      <div class="field"><label for="ff">Flour type (optional)</label><input id="ff" class="input" placeholder="e.g. rye, whole wheat" value=${flour} onInput=${(e) => setFlour(e.target.value)} /></div>
      <label for="ft" class="row between kicker"><span>Kitchen temp</span><span style="color:var(--yellow)">${temp} °C</span></label>
      <input id="ft" type="range" min="16" max="30" step="0.5" value=${temp} onInput=${(e) => setTemp(Number(e.target.value))} />
      <span class="small muted">Expect a peak in about ${starterPeakHours(temp, calc.feedRatio).toFixed(1)} h.</span>`}
    ${scoby && html`<span class="muted">Note how Scooby looks. You can add details in a batch log too.</span>`}
    <button class=${'btn ' + (scoby ? 'fill-t' : 'fill-y')} onClick=${async () => {
      const data = scoby ? {} : { ratio: calc.feedRatio, ratioText: calc.actualText || ratioText, starter: calc.full.s, flourGrams: calc.full.f, water: calc.full.w, hydration: calc.hydration, temp, flour };
      await feedCulture(c.id, data); onClose(); toast(scoby ? 'Check logged' : 'Fed! Next reminder is set.');
    }}>${scoby ? 'Log check' : 'Log feed'}</button>
    ${!scoby && html`<button class="btn" style="color:var(--muted)" onClick=${async () => { await updateCulture(c.id, { location: c.location === 'fridge' ? 'counter' : 'fridge', feed_every_hours: c.location === 'fridge' ? 12 : 168 }); onClose(); toast('Moved'); }}>Move to ${c.location === 'fridge' ? 'counter' : 'fridge'}</button>`}
  <//>`;
}

export function Cultures({ query }) {
  const s = useApp();
  const now = useNow(60000);
  const [adding, setAdding] = useState(query.get('add') === '1');
  const [feeding, setFeeding] = useState(null);
  return html`
    <div class="main">
      <${Blobs} items=${[{ c: 'pink', x: '50%', y: '-40px', s: 260 }]} />
      <div class="topbar"><span>${s.cultures.length} LIVING THINGS</span><a href="#/settings">SETTINGS ⚙</a></div>
      <h1 class="h-display">Your<br/><i>cultures</i></h1>
      <span class="muted small">The living things you keep between bakes and batches</span>
      ${s.cultures.map((c) => {
        const scoby = c.kind === 'scoby';
        const last = s.cultureEvents.find((e) => e.culture_id === c.id);
        const due = s.reminders.find((r) => r.culture_id === c.id && !r.done_at);
        const uses = s.projects.filter((p) => p.culture_id === c.id).length;
        const hungry = due && new Date(due.due_at).getTime() < now + TIME.HOUR;
        const ageDays = c.born_on ? Math.round((now - new Date(c.born_on).getTime()) / TIME.DAY) : null;
        const accent = scoby ? 't' : c.location === 'fridge' ? 'p' : 'y';
        return html`
          <div class=${'card row ' + accent} style="gap:16px;align-items:center">
            <${Jar} type=${scoby ? 'tea' : 'bread'} fill=${scoby ? 70 : c.location === 'fridge' ? 30 : 46} activity=${scoby ? 80 : c.location === 'fridge' ? 10 : hungry ? 25 : 60} w=${70} h=${92} label=${c.name} />
            <div class="stack" style="gap:4px;flex:1;min-width:0">
              <span class="kicker" style=${'font-size:10px;color:' + (scoby ? 'var(--teal-text)' : c.location === 'fridge' ? 'var(--pink-text)' : 'var(--yellow)')}>${scoby ? 'SCOBY · kombucha' : 'Starter · ' + c.location}</span>
              <span class="big-num" style="font-size:28px;line-height:1">${c.name}</span><${Owner} id=${c.user_id} />
              <span class="small" style="font-weight:700">${scoby ? (uses ? `In ${uses} batches` : 'Ready for a batch') : hungry ? 'Hungry!' : `Fed ${ago(last && last.at, now)}`}</span>
              <span class="small muted">${ageDays != null ? ageDays + ' days old · ' : ''}${scoby ? (c.notes || '') : `feeds every ~${c.feed_every_hours} h${due ? ' · next ' + whenLabel(due.due_at, now) : ''}`}</span>
              <button class=${'btn sm ' + accent} style="align-self:flex-start;margin-top:6px" onClick=${() => setFeeding(c)}>${scoby ? 'Log a check' : 'Log feed'}</button>
            </div>
          </div>`;
      })}
      <button class="btn" style="color:var(--muted);border-style:dashed;min-height:56px" onClick=${() => setAdding(true)}>+ Add a starter or SCOBY</button>
      <${AddCulture} open=${adding} onClose=${() => setAdding(false)} />
      <${FeedSheet} c=${feeding} onClose=${() => setFeeding(null)} />
    </div>`;
}
