import { html, useState, useApp, useNow, toast } from '../html.js';
import { Jar, Blobs, Sheet, Owner } from '../components.js';
import { feedCulture, createCulture, updateCulture } from '../lib/api.js';
import { starterPeakHours, TIME } from '../lib/schedule.js';
import { whenLabel } from '../lib/format.js';

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
      <div class="field"><label for="ce">Feed every (hours)</label><input id="ce" class="input" type="number" value=${every} onInput=${(e) => setEvery(Number(e.target.value) || 12)} /></div>`}
    <button class="btn fill-y" disabled=${!name.trim()} onClick=${async () => { await createCulture({ kind, name: name.trim(), location, feedEveryHours: every }); onClose(); toast('Added ' + name.trim()); }}>Add</button>
  <//>`;
}

function FeedSheet({ c, onClose }) {
  const [ratio, setRatio] = useState(2);
  const [temp, setTemp] = useState(21);
  const [flour, setFlour] = useState('');
  if (!c) return null;
  const scoby = c.kind === 'scoby';
  return html`<${Sheet} open=${!!c} onClose=${onClose} title=${scoby ? 'Log a check · ' + c.name : 'Feed · ' + c.name}>
    ${!scoby && html`
      <span class="label">Ratio (starter : flour : water)</span>
      <div class="row wrap">${[1, 2, 5].map((r) => html`<button type="button" class=${'chip' + (ratio === r ? ' on' : '')} onClick=${() => setRatio(r)}>1:${r}:${r}</button>`)}</div>
      <div class="field"><label for="ff">Flour (optional)</label><input id="ff" class="input" placeholder="e.g. rye, whole wheat" value=${flour} onInput=${(e) => setFlour(e.target.value)} /></div>
      <label for="ft" class="row between kicker"><span>Kitchen temp</span><span style="color:var(--yellow)">${temp} °C</span></label>
      <input id="ft" type="range" min="16" max="30" step="0.5" value=${temp} onInput=${(e) => setTemp(Number(e.target.value))} />
      <span class="small muted">Expect a peak in about ${starterPeakHours(temp, ratio).toFixed(1)} h.</span>`}
    ${scoby && html`<span class="muted">Note how Scooby looks. You can add details in a batch log too.</span>`}
    <button class=${'btn ' + (scoby ? 'fill-t' : 'fill-y')} onClick=${async () => { await feedCulture(c.id, scoby ? {} : { ratio, temp, flour }); onClose(); toast(scoby ? 'Check logged' : 'Fed! Next reminder is set.'); }}>${scoby ? 'Log check' : 'Log feed'}</button>
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
