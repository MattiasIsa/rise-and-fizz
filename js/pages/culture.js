// One culture's own page: fun stats, useful stats, birthday, history, and actions underneath.
import { html, useState, useApp, useNow, toast, go } from '../html.js';
import { Jar, Blobs, Sheet, Owner, DeleteButton } from '../components.js';
import { updateCulture, logCultureEvent, removeCultureEvent, deleteCulture } from '../lib/api.js';
import { cultureStats, birthday, hoursSinceFeed, eatenWord, parseDay } from '../lib/culturestats.js';
import { shortDate, hhmm, whenLabel } from '../lib/format.js';
import { TIME } from '../lib/schedule.js';
import { FeedSheet } from './cultures.js';

const kg = (g) => (g >= 1000 ? (g / 1000).toFixed(g >= 10000 ? 0 : 1) + ' kg' : Math.round(g) + ' g');
const hrs = (h) => (h == null ? '–' : h >= 48 ? (h / 24).toFixed(1) + ' days' : h.toFixed(h < 10 ? 1 : 0) + ' h');
const longDate = (t) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

function Kpi({ value, label, sub, color = 'var(--yellow)' }) {
  return html`<div class="card" style="padding:12px;display:flex;flex-direction:column;gap:4px;min-width:0">
    <span class="big-num" style=${'font-size:34px;color:' + color}>${value}</span>
    <span class="kicker" style="font-size:10px">${label}</span>
    ${sub && html`<span class="small muted">${sub}</span>`}
  </div>`;
}

function Bars({ values, color }) {
  const max = Math.max(1, ...values);
  return html`<div style="display:flex;align-items:flex-end;gap:2px;height:46px" role="img" aria-label=${'Feeds per day, last 30 days: ' + values.reduce((a, b) => a + b, 0) + ' total'}>
    ${values.map((v, i) => html`<div title=${v + ' feeds'} style=${`flex:1;border-radius:2px 2px 0 0;background:${v ? color : 'rgba(255,255,255,0.08)'};height:${v ? Math.max(18, (v / max) * 100) : 6}%;${i === values.length - 1 ? 'outline:1px solid ' + color : ''}`}></div>`)}
  </div>`;
}

function BirthdayCard({ c, b, onEdit }) {
  if (!b) return html`<button class="card row between" style="text-align:left;color:inherit" onClick=${onEdit}>
    <span><span class="kicker" style="font-size:11px;color:var(--pink-text)">No birthday yet</span><br/><span class="small muted">When did ${c.name} come alive? Add a date for parties and milestones.</span></span>
    <span class="kicker" style="color:var(--yellow)">SET</span></button>`;
  if (b.isBirthday) return html`<div class="slab p tilt-l pulse-p stack" style="gap:6px;text-align:center">
    <span style="font-size:40px" aria-hidden="true">🎂🎉</span>
    <span class="big-num" style="font-size:36px">Happy birthday, ${c.name}!</span>
    <span class="kicker">${b.turning} ${b.turning === 1 ? 'year' : 'years'} of bubbles today. Extra feed recommended.</span>
  </div>`;
  if (b.milestoneToday) return html`<div class="slab y tilt-l stack" style="gap:6px;text-align:center">
    <span class="big-num" style="font-size:36px">${b.days} days today!</span>
    <span class="kicker">${c.name} hit a milestone. Treat them to some rye.</span>
  </div>`;
  return html`<div class="grid-2">
    <div class="card p" style="padding:12px;display:flex;flex-direction:column;gap:4px">
      <span class="kicker" style="font-size:10px;color:var(--pink-text)">Birthday</span>
      <span class="big-num" style="font-size:30px">${b.untilBirthday === 1 ? 'Tomorrow' : 'in ' + b.untilBirthday + ' d'}</span>
      <span class="small muted">Turns ${b.turning} on ${shortDate(b.nextBirthday)}</span>
    </div>
    <div class="card t" style="padding:12px;display:flex;flex-direction:column;gap:4px">
      <span class="kicker" style="font-size:10px;color:var(--teal-text)">Next milestone</span>
      <span class="big-num" style="font-size:30px">${b.nextMilestone ? b.nextMilestone + ' days' : 'Legend'}</span>
      <span class="small muted">${b.nextMilestone ? 'in ' + b.untilMilestone + (b.untilMilestone === 1 ? ' day' : ' days') : 'Past every milestone we have'}</span>
    </div>
  </div>`;
}

function EditSheet({ c, open, onClose }) {
  const [name, setName] = useState(c.name);
  const [born, setBorn] = useState(c.born_on ? String(c.born_on).slice(0, 10) : '');
  const [every, setEvery] = useState(String(c.feed_every_hours || 12));
  const [notes, setNotes] = useState(c.notes || '');
  const scoby = c.kind === 'scoby';
  const today = new Date().toISOString().slice(0, 10);
  const ok = name.trim() && (scoby || Number(every) > 0) && (!born || (parseDay(born) != null && born <= today));
  return html`<${Sheet} open=${open} onClose=${onClose} title=${'Edit ' + c.name}>
    <div class="field"><label for="en">Name</label><input id="en" class="input" value=${name} onInput=${(e) => setName(e.target.value)} /></div>
    <div class="field"><label for="eb">Birthday (when it came alive)</label><input id="eb" class="input" type="date" max=${today} value=${born} onInput=${(e) => setBorn(e.target.value)} /></div>
    ${!scoby && html`<div class="field"><label for="ee">Feed every (hours)</label><input id="ee" class="input" type="number" inputmode="decimal" min="1" value=${every} onInput=${(e) => setEvery(e.target.value)} /></div>`}
    <div class="field"><label for="eno">Notes</label><textarea id="eno" class="input" rows="3" style="padding:10px" value=${notes} onInput=${(e) => setNotes(e.target.value)}></textarea></div>
    <button class="btn fill-y" disabled=${!ok} onClick=${async () => {
      const patch = { name: name.trim(), born_on: born || null, notes };
      if (!scoby) patch.feed_every_hours = Number(every);
      await updateCulture(c.id, patch); onClose(); toast('Saved');
    }}>Save</button>
  <//>`;
}

function PeakSheet({ c, events, open, onClose }) {
  const since = hoursSinceFeed(c, events);
  const [hours, setHours] = useState(since != null ? since.toFixed(1) : '');
  const ok = Number(hours) > 0 && Number(hours) < 200;
  return html`<${Sheet} open=${open} onClose=${onClose} title=${'Log peak · ' + c.name}>
    <span class="muted">The peak is when it's domed, bubbly and as high as it gets, right before it starts to fall. Logging it teaches the app how fast ${c.name} really is.</span>
    <div class="field"><label for="ph">Hours after the last feed</label><input id="ph" class="input" type="number" inputmode="decimal" min="0.5" step="0.5" value=${hours} onInput=${(e) => setHours(e.target.value)} style="font-size:20px" /></div>
    <span class="small muted">${since != null ? `Last feed was ${since.toFixed(1)} h ago, so that's filled in if it's peaking right now.` : 'No feed logged yet, so type how long it took.'}</span>
    <button class="btn fill-y" disabled=${!ok} onClick=${async () => {
      const h = Number(hours);
      const at = since != null && Math.abs(h - since) < 0.3 ? new Date() : new Date(Date.now() - Math.max(0, (since || h) - h) * TIME.HOUR);
      await logCultureEvent(c.id, 'peak', { hours: h }, at); onClose(); toast('Peak logged: ' + h + ' h');
    }}>Log peak</button>
  <//>`;
}

function NoteSheet({ c, open, onClose, type = 'note' }) {
  const [text, setText] = useState('');
  const baby = type === 'baby';
  return html`<${Sheet} open=${open} onClose=${onClose} title=${baby ? 'A baby SCOBY!' : 'Add a note'}>
    ${baby && html`<span class="muted">Congratulations. Peel it off, keep it in some starter liquid, and give it a name if you like.</span>`}
    <div class="field"><label for="nt">${baby ? 'Name or note (optional)' : 'Note'}</label><input id="nt" class="input" value=${text} placeholder=${baby ? 'e.g. Scooby Jr' : 'e.g. Smells like nail polish, fed extra'} onInput=${(e) => setText(e.target.value)} /></div>
    <button class=${'btn ' + (baby ? 'fill-t' : 'fill-y')} disabled=${!baby && !text.trim()} onClick=${async () => {
      await logCultureEvent(c.id, type, text.trim() ? { text: text.trim() } : {}); onClose(); toast(baby ? 'Welcome to the family!' : 'Note added');
    }}>${baby ? 'Log baby SCOBY' : 'Add note'}</button>
  <//>`;
}

function eventLine(e) {
  const d = e.data || {};
  if (e.type === 'feed') {
    const parts = [];
    if (d.starter || d.flourGrams || d.water) parts.push(`${Math.round(d.starter || 0)} + ${Math.round(d.flourGrams || 0)} + ${Math.round(d.water || 0)} g`);
    if (d.ratioText) parts.push(d.ratioText);
    if (d.flour) parts.push(d.flour);
    if (d.temp) parts.push(d.temp + ' °C');
    return { icon: '🍞', title: 'Fed', detail: parts.join(' · ') || 'Quick feed', color: 'var(--yellow)' };
  }
  if (e.type === 'check') return { icon: '👀', title: 'Checked', detail: d.text || '', color: 'var(--teal-text)' };
  if (e.type === 'peak') return { icon: '⛰️', title: 'Peaked', detail: `${d.hours} h after feeding`, color: 'var(--pink-text)' };
  if (e.type === 'baby') return { icon: '🐣', title: 'Baby SCOBY', detail: d.text || '', color: 'var(--teal-text)' };
  return { icon: '✎', title: 'Note', detail: d.text || '', color: 'var(--muted)' };
}

export function CultureDetail({ id }) {
  const s = useApp();
  const now = useNow(60000);
  const [sheet, setSheet] = useState(null); // 'feed' | 'peak' | 'edit' | 'note' | 'baby'
  const [showAll, setShowAll] = useState(false);
  const c = s.cultures.find((x) => x.id === id);
  if (!c) return html`<div class="main"><div class="topbar"><a href="#/cultures">← CULTURES</a></div><h1 class="h-display">Not <i>found</i></h1><span class="muted">This culture may have been removed.</span></div>`;

  const scoby = c.kind === 'scoby';
  const st = cultureStats(c, s.cultureEvents, s.projects, now);
  const b = birthday(c.born_on, now);
  const due = s.reminders.find((r) => r.culture_id === c.id && !r.done_at);
  const accent = scoby ? 't' : c.location === 'fridge' ? 'p' : 'y';
  const color = scoby ? 'var(--teal)' : c.location === 'fridge' ? 'var(--pink)' : 'var(--yellow)';
  const textColor = scoby ? 'var(--teal-text)' : c.location === 'fridge' ? 'var(--pink-text)' : 'var(--yellow)';
  const hungry = due && new Date(due.due_at).getTime() < now + TIME.HOUR;
  const history = showAll ? st.history : st.history.slice(0, 8);
  const close = () => setSheet(null);

  return html`
    <div class="main">
      <${Blobs} items=${[{ c: scoby ? 'teal' : 'yellow', x: '70%', y: '-30px', s: 280 }, { c: 'pink', x: '-10%', y: '320px', s: 200 }]} />
      <div class="topbar"><a href="#/cultures">← CULTURES</a><button class="kicker" style="background:none;border:0;color:inherit;padding:8px 0" onClick=${() => setSheet('edit')}>EDIT ✎</button></div>

      <div class="row" style="gap:18px;align-items:flex-end">
        <${Jar} type=${scoby ? 'tea' : 'bread'} fill=${scoby ? 72 : c.location === 'fridge' ? 32 : 55} activity=${scoby ? 80 : c.location === 'fridge' ? 12 : hungry ? 25 : 70} peak=${scoby ? null : 78} w=${120} h=${170} label=${c.name} />
        <div class="stack" style="gap:6px;min-width:0;flex:1">
          <span class="kicker" style=${'font-size:11px;color:' + textColor}>${scoby ? 'SCOBY · kombucha' : 'Sourdough starter · ' + c.location}</span>
          <h1 class="h-display" style="margin:0;font-size:clamp(40px,11vw,72px);overflow-wrap:anywhere">${c.name}</h1>
          <${Owner} id=${c.user_id} />
          <span class="small muted">${b ? `Born ${longDate(parseDay(c.born_on))}` : 'Birthday unknown'}${!scoby && due ? ` · next feed ${whenLabel(due.due_at, now)}` : ''}</span>
        </div>
      </div>

      <${BirthdayCard} c=${c} b=${b} onEdit=${() => setSheet('edit')} />

      <span class="kicker" style="margin-top:8px">The fun stuff</span>
      <div class="grid-2">
        <${Kpi} value=${b ? b.days.toLocaleString('en-GB') : '?'} label="Days alive" sub=${b && b.years ? `${b.years} ${b.years === 1 ? 'year' : 'years'} and counting` : b ? 'A youngster' : 'Set a birthday'} color=${textColor} />
        <${Kpi} value=${st.timesFed} label=${scoby ? 'Check-ups' : 'Times fed'} sub=${st.firstFeed ? 'since ' + shortDate(st.firstFeed) : 'None logged yet'} color=${textColor} />
        ${!scoby && html`
          <${Kpi} value=${kg(st.flour)} label="Flour eaten" sub=${st.flour ? `≈ ${st.flourBags.toFixed(st.flourBags < 1 ? 2 : 1)} bags (2 kg)` : 'Log feeds with grams'} />
          <${Kpi} value=${kg(st.water)} label="Water drunk" sub=${st.water ? `≈ ${Math.round(st.water / 250)} glasses` : '–'} color="var(--teal-text)" />
          <${Kpi} value=${st.streak + (st.streak === 1 ? ' day' : ' days')} label="Feeding streak" sub=${'Best ever: ' + st.bestStreak} color="var(--pink-text)" />
          <${Kpi} value=${hrs(st.longestGapH)} label="Longest hungry" sub=${st.sinceLastH != null ? 'Last fed ' + hrs(st.sinceLastH) + ' ago' : 'Never fed (yet)'} color="var(--pink-text)" />`}
        ${scoby && html`
          <${Kpi} value=${st.projects.length} label="Batches brewed" sub=${st.active ? st.active + ' brewing now' : 'None brewing'} />
          <${Kpi} value=${st.litres.toFixed(1) + ' L'} label="Kombucha made" sub=${st.litres ? `≈ ${Math.round(st.litres / 0.33)} cans' worth` : 'Start a batch'} color="var(--pink-text)" />
          <${Kpi} value=${st.babies} label="Baby SCOBYs" sub=${st.babies ? 'A proud parent' : 'No babies yet'} />
          <${Kpi} value=${hrs(st.sinceLastH)} label="Since last check" sub=${st.sinceLastH == null ? 'Never checked' : ''} color="var(--pink-text)" />`}
      </div>
      ${!scoby && st.eaten > 0 && html`<span class="small" style="color:var(--yellow)">All in all, ${c.name} has eaten ${kg(st.eaten)}. ${eatenWord(st.eaten)}.</span>`}
      <div class="card" style="padding:12px;display:flex;flex-direction:column;gap:8px">
        <div class="row between"><span class="kicker" style="font-size:10px">${scoby ? 'Check-ups' : 'Feeds'}, last 30 days</span><span class="kicker" style=${'font-size:10px;color:' + textColor}>${st.last30.reduce((a, x) => a + x, 0)}</span></div>
        <${Bars} values=${st.last30} color=${color} />
      </div>

      <span class="kicker" style="margin-top:8px">The useful stuff</span>
      <div class="grid-2">
        ${!scoby && html`
          <${Kpi} value=${st.projects.length} label="Loaves made" sub=${st.active ? st.active + ' in progress' : st.done ? st.done + ' baked' : 'Bake one!'} />
          <${Kpi} value=${st.avgRating ? st.avgRating.toFixed(1) + '★' : '–'} label="Average loaf" sub=${st.avgRating ? 'from rated bakes' : 'Rate a finished loaf'} color="var(--pink-text)" />
          <${Kpi} value=${hrs(st.avgPeak)} label="Avg time to peak" sub=${st.peaks ? `${st.peaks} peaks logged · last ${hrs(st.lastPeak)}` : 'Tap "Log peak" below'} color="var(--teal-text)" />
          <${Kpi} value=${st.avgRatio ? '1:' + st.avgRatio.toFixed(1) : '–'} label="Usual ratio" sub=${st.avgHydration ? Math.round(st.avgHydration * 100) + '% hydration' : ''} />
          ${st.flourInBakes > 0 && html`<${Kpi} value=${kg(st.flourInBakes)} label="Flour it raised" sub="in all its loaves" color="var(--teal-text)" />`}`}
        ${scoby && html`
          <${Kpi} value=${st.done} label="Batches finished" sub=${st.avgRating ? 'avg ' + st.avgRating.toFixed(1) + '★' : ''} />
          <${Kpi} value=${st.projects.length ? (st.litres / st.projects.length).toFixed(1) + ' L' : '–'} label="Avg batch size" color="var(--teal-text)" />`}
      </div>
      ${st.best && html`
        <a href=${'#/history/' + st.best.id} class=${'card row between ' + accent} style="color:inherit;text-decoration:none;gap:12px">
          <span class="stack" style="gap:2px;min-width:0"><span class="kicker" style=${'font-size:10px;color:' + textColor}>Best ${scoby ? 'batch' : 'loaf'} with ${c.name}</span><span style="font-weight:700">${st.best.name}</span><span class="small muted">${shortDate(st.best.finished_at || st.best.started_at)}</span></span>
          <span style="color:var(--yellow);font-size:18px;white-space:nowrap" aria-label=${st.best.rating + ' out of 5'}>${'★'.repeat(st.best.rating)}</span>
        </a>`}

      <span class="kicker" style="margin-top:8px">Log something</span>
      <div class="grid-2">
        <button class=${'btn fill-' + (scoby ? 't' : 'y')} onClick=${() => setSheet('feed')}>${scoby ? 'Log a check' : 'Log feed'}</button>
        ${!scoby && html`<button class="btn p" onClick=${() => setSheet('peak')}>Log peak</button>`}
        ${scoby && html`<button class="btn t" onClick=${() => setSheet('baby')}>Baby SCOBY</button>`}
        <a class="btn y" href=${(scoby ? '#/new/kombucha' : '#/new/bread') + '?culture=' + c.id}>${scoby ? 'Brew with it' : 'Bake with it'}</a>
        <button class="btn" style="color:var(--muted)" onClick=${() => setSheet('note')}>Add note</button>
        ${!scoby && html`<button class="btn" style="color:var(--muted)" onClick=${async () => { await updateCulture(c.id, { location: c.location === 'fridge' ? 'counter' : 'fridge', feed_every_hours: c.location === 'fridge' ? 12 : 168 }); toast(c.location === 'fridge' ? 'Out on the counter' : 'Tucked in the fridge'); }}>Move to ${c.location === 'fridge' ? 'counter' : 'fridge'}</button>`}
      </div>

      ${st.projects.length > 0 && html`
        <span class="kicker" style="margin-top:8px">${scoby ? 'Batches' : 'Loaves'} with ${c.name}</span>
        <div class="stack" style="gap:6px">
          ${st.projects.slice().sort((a, b2) => new Date(b2.started_at) - new Date(a.started_at)).slice(0, 6).map((p) => html`
            <a href=${(p.status === 'active' ? '#/p/' : '#/history/') + p.id} class="card row between" style="color:inherit;text-decoration:none;padding:10px 12px">
              <span class="stack" style="gap:2px;min-width:0"><span style="font-weight:700">${p.name}</span><span class="small muted">${shortDate(p.started_at)} · ${p.status === 'active' ? 'in progress' : 'done'}</span></span>
              ${p.rating ? html`<span style="color:var(--yellow);white-space:nowrap" aria-label=${p.rating + ' out of 5'}>${'★'.repeat(p.rating)}</span>` : html`<span class="kicker" style="font-size:10px;color:var(--muted)">›</span>`}
            </a>`)}
        </div>`}

      <span class="kicker" style="margin-top:8px">Diary</span>
      ${st.history.length === 0 && html`<span class="muted small">Nothing logged yet. Every feed, peak and note lands here.</span>`}
      <div class="stack" style="gap:0">
        ${history.map((e) => {
          const l = eventLine(e);
          return html`<div class="row" style="gap:12px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);align-items:center">
            <span aria-hidden="true" style="font-size:18px;width:24px;text-align:center">${l.icon}</span>
            <span class="stack" style="gap:2px;flex:1;min-width:0">
              <span><b style=${'color:' + l.color}>${l.title}</b> <span class="small muted">${shortDate(e.at)} ${hhmm(e.at)}</span> <${Owner} id=${e.user_id} /></span>
              ${l.detail && html`<span class="small muted" style="overflow-wrap:anywhere">${l.detail}</span>`}
            </span>
            <button aria-label="Delete entry" style="background:none;border:0;color:var(--muted);font-size:18px;min-width:40px;min-height:40px" onClick=${async () => { if (confirm('Delete this entry?')) { await removeCultureEvent(e.id); toast('Deleted'); } }}>×</button>
          </div>`;
        })}
      </div>
      ${st.history.length > 8 && html`<button class="btn" style="color:var(--muted)" onClick=${() => setShowAll(!showAll)}>${showAll ? 'Show less' : `Show all ${st.history.length}`}</button>`}

      <div style="margin-top:24px"><${DeleteButton} label=${'Delete ' + c.name} what=${c.name} detail=${`${c.name} and all ${st.history.length} diary ${st.history.length === 1 ? 'entry' : 'entries'} (feeds, peaks, notes) and reminders will be removed.${st.projects.length ? ` Your ${st.projects.length} ${scoby ? (st.projects.length === 1 ? 'batch stays' : 'batches stay') : (st.projects.length === 1 ? 'loaf stays' : 'loaves stay')} in History.` : ''}`} onDelete=${async () => { await deleteCulture(c); toast('Goodbye, ' + c.name); go('/cultures'); }} /></div>

      ${sheet === 'feed' && html`<${FeedSheet} c=${c} onClose=${close} />`}
      ${sheet === 'peak' && html`<${PeakSheet} c=${c} events=${s.cultureEvents} open=${true} onClose=${close} />`}
      ${sheet === 'edit' && html`<${EditSheet} c=${c} open=${true} onClose=${close} />`}
      ${(sheet === 'note' || sheet === 'baby') && html`<${NoteSheet} c=${c} type=${sheet} open=${true} onClose=${close} />`}
    </div>`;
}
