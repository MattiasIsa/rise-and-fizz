import { html, useState, useEffect, useApp, useNow, go, toast } from '../html.js';
import { Jar, Blobs, Sheet, Stars, Stages } from '../components.js';
import * as api from '../lib/api.js';
import { BREAD_STAGES, breadNumbers, estimateRise, tasteWord, tasteColor, kombuchaActivity, f1Days, TIME } from '../lib/schedule.js';
import { whenLabel, hhmm, dayLabel, shortDate, clock, duration, toLocalInput, compactDuration } from '../lib/format.js';
import { projectView } from './home.js';

function PhotoThumb({ data }) {
  const [src, setSrc] = useState(data.photo || null);
  useEffect(() => { if (!src) api.photoUrl(data).then(setSrc).catch(() => {}); }, []);
  return src ? html`<img src=${src} alt="Photo from the log" style="width:100%;aspect-ratio:1;object-fit:cover;border:2px solid var(--line);border-radius:4px" />` : html`<span class="empty" style="aspect-ratio:1"></span>`;
}

function LogSection({ project, logs, accent }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const photos = logs.filter((l) => l.data && (l.data.photo || l.data.photo_path));
  const add = async () => { if (!text.trim()) return; setBusy(true); try { await api.addLog(project.id, text.trim(), {}); setText(''); } finally { setBusy(false); } };
  const upload = async (e) => { const f = e.target.files && e.target.files[0]; if (!f) return; setBusy(true); try { await api.addPhoto(project.id, f); toast('Photo added'); } catch (err) { toast('Upload failed: ' + err.message); } finally { setBusy(false); e.target.value = ''; } };
  return html`
    <section class="stack" style="gap:6px" aria-label="Log">
      <span class="kicker">Log</span>
      <div class="row">
        <input class="input" aria-label="Add a note" placeholder="Add a note…" value=${text} onInput=${(e) => setText(e.target.value)} onKeyDown=${(e) => e.key === 'Enter' && add()} />
        <button class=${'btn sm ' + accent} disabled=${busy} onClick=${add}>Add</button>
        <label class="btn sm p" style="cursor:pointer">Photo<input type="file" accept="image/*" capture="environment" onChange=${upload} style="display:none" /></label>
      </div>
      ${photos.length > 0 && html`<div class="grid-3">${photos.slice(0, 6).map((l) => html`<${PhotoThumb} key=${l.id} data=${l.data} />`)}</div>`}
      ${logs.filter((l) => !(l.data && (l.data.photo || l.data.photo_path))).map((l) => html`
        <div class="list-row"><span class="t" style=${accent === 't' ? 'color:var(--teal-text)' : ''}>${dayLabel(l.at) === 'Today' ? hhmm(l.at) : shortDate(l.at)}</span><span style="font-size:14px">${l.text}</span></div>`)}
    </section>`;
}

function StepList({ steps, now, accent }) {
  const [edit, setEdit] = useState(null);
  const [when, setWhen] = useState('');
  const open = (r) => { setEdit(r); setWhen(toLocalInput(r.due_at)); };
  const color = accent === 't' ? 'var(--teal-text)' : 'var(--yellow)';
  return html`
    <section class="stack" style="gap:8px" aria-label="Schedule">
      <span class="kicker">Schedule · tap to change</span>
      ${steps.map((r) => html`
        <button class=${'step' + (r.done_at ? ' done' : '')} onClick=${() => open(r)}>
          <span class="when" style=${'color:' + color}>${r.done_at ? '✓ ' + hhmm(r.done_at) : `${dayLabel(r.due_at).toUpperCase()}\n${hhmm(r.due_at)}`}</span>
          <span class="stack" style="gap:2px"><span class="title" style="font-weight:700">${r.title}</span><span class="small muted">${r.done_at ? (r.skipped ? 'Skipped' : 'Done') : whenLabel(r.due_at, now)}</span></span>
        </button>`)}
      <${Sheet} open=${!!edit} onClose=${() => setEdit(null)} title=${edit ? edit.title : ''}>
        ${edit && html`
          <div class="field"><label for="mv">Time</label><input id="mv" class="input" type="datetime-local" value=${when} onInput=${(e) => setWhen(e.target.value)} /></div>
          <button class="btn fill-y" onClick=${async () => { await api.moveReminder(edit, when); setEdit(null); toast('Moved'); }}>Move to this time</button>
          ${!edit.done_at && html`<button class=${'btn ' + (accent === 't' ? 'fill-t' : 'y')} onClick=${async () => { await api.completeReminder(edit); setEdit(null); toast('Done'); }}>Mark as done now</button>`}
        `}
      <//>
    </section>`;
}

function FinishSheet({ project, open, onClose }) {
  const tea = project.type === 'kombucha';
  const [rating, setRating] = useState(project.rating || 4);
  const [fizz, setFizz] = useState(3);
  const [notes, setNotes] = useState(project.notes || '');
  const [rise, setRise] = useState('');
  return html`<${Sheet} open=${open} onClose=${onClose} title=${tea ? 'Finish batch' : 'How did it turn out?'}>
    <span class="label">Rating</span><${Stars} value=${rating} onChange=${setRating} />
    ${tea ? html`<span class="label">Fizz</span><${Stars} value=${fizz} onChange=${setFizz} />`
      : html`<div class="field"><label for="fr">Rise at shaping (%, optional)</label><input id="fr" class="input" type="number" value=${rise} onInput=${(e) => setRise(e.target.value)} /></div>`}
    <div class="field"><label for="fn">Notes</label><textarea id="fn" class="input" placeholder="Crumb, crust, taste, what to try next time…" value=${notes} onInput=${(e) => setNotes(e.target.value)}></textarea></div>
    <button class=${'btn block ' + (tea ? 'fill-t' : 'fill-y')} onClick=${async () => {
      const result = tea ? { fizz } : rise ? { measuredRise: Number(rise) } : {};
      await api.finishProject(project, { rating, notes, result }); onClose(); toast('Saved to your journal'); go('/history/' + project.id);
    }}>Save to journal</button>
  <//>`;
}

function BreadActive({ p, s, now }) {
  const v = projectView(p, s.reminders, now);
  const steps = v.steps.sort((a, b) => a.idx - b.idx);
  const next = steps.find((r) => !r.done_at);
  const folds = steps.filter((r) => r.kind === 'fold');
  const foldsDone = folds.filter((r) => r.done_at).length;
  const secs = next ? Math.round((new Date(next.due_at).getTime() - now) / 1000) : 0;
  const n = breadNumbers(p.specs);
  const [finish, setFinish] = useState(false);
  const [rise, setRise] = useState('');
  const logs = s.logs.filter((l) => l.project_id === p.id);
  const culture = s.cultures.find((c) => c.id === p.culture_id);
  return html`
    <div class="row" style="gap:16px;align-items:flex-end">
      <${Jar} type="bread" fill=${v.fill} activity=${v.activity} peak=${28 + v.est.target * 0.55} w=${110} h=${160} label=${`Dough risen about ${v.est.rise} percent`} />
      <div class="stack" style="gap:6px">
        <span class="kicker">${p.name} / ${v.label}</span>
        <h1 class="big-num" style="margin:0;font-size:46px;text-shadow:3px 2px 0 var(--teal)">${p.name}</h1>
        ${v.inBulk && html`<span class="badge">+${v.est.rise}% · ${v.est.minutesLeft ? compactDuration(v.est.minutesLeft) + ' TO GO' : 'READY TO SHAPE'}</span>`}
      </div>
    </div>
    <${Stages} stages=${BREAD_STAGES} current=${v.stage} />

    ${next ? html`
      <div class="card y stack" style="align-items:center;gap:8px;text-align:center">
        <span class="kicker">${secs > 0 ? 'Next: ' + next.title : 'Now: ' + next.title}</span>
        <span class="big-num" style="font-size:80px;color:var(--yellow);font-variant-numeric:tabular-nums;animation:glowY 2.6s ease-in-out infinite;border-radius:8px;padding:0 8px">${secs > 3600 ? hhmm(next.due_at) : secs > 0 ? clock(secs) : 'Now!'}</span>
        ${folds.length > 0 && html`<div class="row" aria-label=${`Folds done: ${foldsDone} of ${folds.length}`}>${folds.map((f) => html`<span style=${`width:40px;height:10px;background:${f.done_at ? 'var(--yellow)' : 'var(--line-strong)'};box-shadow:${f.done_at ? '0 0 10px rgba(255,232,0,.7)' : 'none'}`}></span>`)}</div>`}
        <span class="small muted">${next.detail}</span>
        <button class="btn fill-y tilt-l" style="width:100%;min-height:56px" onClick=${async () => { await api.completeReminder(next); toast('Logged!'); }}>Done · ${next.title.replace(/, set \d of \d/, '')}</button>
      </div>` : html`
      <div class="card y stack" style="text-align:center;align-items:center"><span class="h2">Out of the oven?</span><span class="small muted">Rate it and add notes to your journal.</span></div>`}

    ${v.inBulk && html`<div class="card row">
      <input class="input" type="number" inputmode="numeric" aria-label="Measured rise in percent" placeholder="Measured rise %" value=${rise} onInput=${(e) => setRise(e.target.value)} />
      <button class="btn sm y" onClick=${async () => { if (!rise) return; await api.updateProject(p.id, { result: { ...(p.result || {}), measuredRise: Number(rise) } }); await api.addLog(p.id, `Measured rise: +${rise}%`, { rise: Number(rise) }); setRise(''); toast('Rise logged'); }}>Log rise</button>
    </div>`}

    <div class="grid-auto" style="grid-template-columns:repeat(4,minmax(0,1fr))">
      ${[[n.hydration + '%', 'Hydration'], [n.flourIn + 'g', 'Flour'], [culture ? culture.name.split(' ')[0] : '—', 'Starter'], [p.specs.temp + '°', 'Kitchen']].map(([a, b]) => html`
        <span class="card" style="padding:10px 6px;display:flex;flex-direction:column;align-items:center"><b class="big-num" style="font-size:22px">${a}</b><span class="kicker muted" style="font-size:9px">${b}</span></span>`)}
    </div>

    <${StepList} steps=${steps} now=${now} accent="y" />
    <${LogSection} project=${p} logs=${logs} accent="y" />
    <button class="btn fill-y block" onClick=${() => setFinish(true)}>Finish & rate</button>
    <${FinishSheet} project=${p} open=${finish} onClose=${() => setFinish(false)} />`;
}

function KombuchaActive({ p, s, now }) {
  const v = projectView(p, s.reminders, now);
  const steps = v.steps.sort((a, b) => new Date(a.due_at) - new Date(b.due_at));
  const [taste, setTaste] = useState((p.result && p.result.lastTaste) ?? 30);
  const [ph, setPh] = useState('');
  const [flavors, setFlavors] = useState(() => (p.specs.flavors || []));
  const [f2Days, setF2Days] = useState(3);
  const [finish, setFinish] = useState(false);
  const logs = s.logs.filter((l) => l.project_id === p.id);
  const tw = tasteWord(taste);
  const c = tasteColor(taste);
  const total = f1Days(p.specs.temp);
  const daysShown = Math.max(total + 1, v.day + 1);
  const bars = Array.from({ length: Math.min(14, daysShown) }, (_, d) => ({ d, h: d <= v.day ? kombuchaActivity(d, total) : 0, today: d === v.day }));
  const culture = s.cultures.find((x) => x.id === p.culture_id);
  const toggle = (f) => setFlavors(flavors.includes(f) ? flavors.filter((x) => x !== f) : flavors.concat(f));
  const recipe = p.specs.recipe || {};
  return html`
    <div class="row" style="gap:16px;align-items:flex-end">
      <${Jar} type="tea" fill=${v.fill} activity=${v.activity} w=${110} h=${160} label=${`Kombucha jar, activity ${v.activity} percent`} />
      <div class="stack" style="gap:6px">
        <span class="kicker">${culture ? culture.name : 'SCOBY'} · ${p.specs.tea} tea · ${p.specs.volume} L</span>
        <h1 class="big-num" style="margin:0;font-size:46px;text-shadow:3px 2px 0 var(--pink)">${p.name}</h1>
        <span class="badge teal">${v.label}${p.stage === 'f1' ? ' OF ~' + total : ''}</span>
        <span class="small muted">Started ${shortDate(p.started_at)} · ${p.specs.temp} °C</span>
      </div>
    </div>

    ${p.stage === 'f1' && html`
      <div class="stack" style="gap:6px">
        <span class="kicker">Activity by day</span>
        <div class="bars" role="img" aria-label=${`Activity rising over ${v.day} days`}>
          ${bars.map((b) => html`<span style=${`height:${Math.max(6, b.h)}%;background:${b.h === 0 ? 'transparent' : b.today ? 'var(--teal-text)' : 'var(--teal)'};box-shadow:${b.today ? '0 0 14px rgba(79,240,228,.8)' : b.h === 0 ? 'inset 0 0 0 2px var(--line-strong)' : 'none'}`}></span>`)}
        </div>
      </div>
      <div class="slab tilt-l stack" style=${`gap:6px;background:rgb(${c.join(',')});box-shadow:0 0 30px rgba(${c.join(',')},.5)`}>
        <span class="kicker">Taste check</span>
        <span class="big-num" style="font-size:54px;line-height:.95">${tw.word}</span>
        <span style="font-weight:700">${tw.advice}</span>
        <label for="taste" class="row between kicker" style="font-size:11px;margin-top:6px"><span>Sweet</span><span>Vinegar</span></label>
        <input id="taste" type="range" min="0" max="100" value=${taste} onInput=${(e) => setTaste(Number(e.target.value))} style="accent-color:var(--ink)" />
        ${p.specs.measurePh && html`<input class="input" type="number" step="0.1" inputmode="decimal" aria-label="pH" placeholder="pH (optional)" value=${ph} onInput=${(e) => setPh(e.target.value)} style="background:#fff;color:var(--ink)" />`}
        <button class="btn solid-ink" style="color:var(--paper)" onClick=${async () => { await api.logTaste(p, taste, ph); setPh(''); toast('Taste logged'); }}>Log this taste</button>
      </div>
      <div class="card t stack">
        <span class="h2">Ready for F2? Pick flavours</span>
        <div class="row wrap">${['Ginger', 'Raspberry', 'Lemon', 'Blueberry', 'Mint', 'Apple juice', 'Mango', 'Hibiscus'].map((f) => html`<button type="button" class=${'chip t' + (flavors.includes(f) ? ' on' : '')} aria-pressed=${flavors.includes(f)} onClick=${() => toggle(f)}>${f}</button>`)}</div>
        <div class="field"><label for="f2d">F2 days in bottles</label><input id="f2d" class="input" type="number" min="1" max="7" value=${f2Days} onInput=${(e) => setF2Days(Number(e.target.value) || 3)} /></div>
        <button class="btn fill-t" onClick=${async () => { await api.bottleForF2(p, { flavors, days: f2Days }); toast('Bottled! Burp reminders are on.'); }}>Bottle for F2 · burp pings on</button>
      </div>`}

    ${p.stage !== 'f1' && html`
      <div class="card t stack" style="gap:6px">
        <span class="kicker">In the bottles</span>
        <span class="h2">${(p.specs.flavors || []).join(', ') || 'Plain'}</span>
        <span class="small muted">F1 took ${p.specs.f1Days || '?'} days · F2 planned for ${p.specs.f2Days || 3} days</span>
      </div>`}

    <div class="grid-auto" style="grid-template-columns:repeat(4,minmax(0,1fr))">
      ${[[recipe.sugar ? recipe.sugar + 'g' : '—', 'Sugar'], [recipe.teaG ? recipe.teaG + 'g' : '—', 'Tea'], [recipe.starterMl ? recipe.starterMl + 'ml' : '—', 'Starter'], [p.specs.temp + '°', 'Spot']].map(([a, b]) => html`
        <span class="card" style="padding:10px 6px;display:flex;flex-direction:column;align-items:center"><b class="big-num" style="font-size:20px">${a}</b><span class="kicker muted" style="font-size:9px">${b}</span></span>`)}
    </div>

    <${StepList} steps=${steps} now=${now} accent="t" />
    <${LogSection} project=${p} logs=${logs} accent="t" />
    <button class="btn fill-t block" onClick=${() => setFinish(true)}>Finish batch</button>
    <${FinishSheet} project=${p} open=${finish} onClose=${() => setFinish(false)} />`;
}

export function Record({ p, s }) {
  const tea = p.type === 'kombucha';
  const steps = s.reminders.filter((r) => r.project_id === p.id);
  const logs = s.logs.filter((l) => l.project_id === p.id);
  const at = (k) => { const r = steps.find((x) => x.kind === k && x.done_at && !x.skipped); return r ? new Date(r.done_at).getTime() : null; };
  const span = (a, b) => (a && b ? (b - a) / TIME.MIN : null);
  const res = p.result || {};
  const n = tea ? null : breadNumbers(p.specs);
  const bulk = res.bulkMinutes || span(at('add'), at('shape'));
  const retard = res.retardHours ? res.retardHours * 60 : span(at('fridge'), at('bake'));
  const accent = tea ? 't' : 'y';
  const [confirm, setConfirm] = useState(false);
  return html`
    <div class=${'slab tilt-l ' + accent} style="padding:0;overflow:hidden;position:relative">
      <svg role="img" aria-label=${tea ? 'Print-style drawing of a SCOBY' : 'Print-style drawing of a scored loaf'} width="100%" height="190" viewBox="0 0 358 190" preserveAspectRatio="xMidYMid slice" style="display:block">
        <circle cx="240" cy="90" r="80" fill=${tea ? '#FFE800' : '#FF2E9A'} opacity="0.6"></circle>
        ${tea ? html`<ellipse cx="170" cy="110" rx="110" ry="60" fill="none" stroke="#15173D" stroke-width="5"></ellipse><ellipse cx="170" cy="100" rx="70" ry="34" fill="none" stroke="#15173D" stroke-width="4"></ellipse>`
          : html`<path d="M44 178c0-62 60-112 136-112s136 50 136 112c0 8-8 14-18 14H62c-10 0-18-6-18-14z" fill="none" stroke="#15173D" stroke-width="5"></path><path d="M108 114c36-20 90-26 136 2M120 142c30-12 72-14 108 2" fill="none" stroke="#15173D" stroke-width="6" stroke-linecap="round"></path>`}
      </svg>
      ${p.rating && html`<span class="big-num" style="position:absolute;right:14px;top:10px;font-size:64px;text-shadow:3px 2px 0 ${tea ? 'var(--pink)' : 'var(--teal)'}">${p.rating}<span style="font-size:26px">/5</span></span>`}
      <div style="padding:0 14px 14px;gap:0" class="stack">
        <span class="kicker">${tea ? 'Kombucha' : 'Sourdough'} · ${shortDate(p.started_at)}</span>
        <h1 class="big-num" style="margin:0;font-size:44px;line-height:.95">${p.name}</h1>
      </div>
    </div>

    ${tea ? html`
      <div class="card stack" style="gap:6px">
        <span class="kicker" style="color:var(--teal-text)">Recipe</span>
        ${[['Volume', p.specs.volume + ' L'], ['Tea', p.specs.tea], ['Sugar', (p.specs.recipe || {}).sugar + ' g'], ['Tea leaves', (p.specs.recipe || {}).teaG + ' g'], ['Starter liquid', (p.specs.recipe || {}).starterMl + ' ml'], ['Flavours', (p.specs.flavors || []).join(', ') || 'Plain']].map(([a, b]) => html`<div class="row between list-row" style="padding:6px 0"><span>${a}</span><b style="font-family:var(--mono)">${b}</b></div>`)}
        <div class="grid-3" style="margin-top:6px">
          <span class="card t" style="padding:8px"><b class="big-num" style="font-size:24px;color:var(--teal-text)">${p.specs.f1Days || '?'} d</b><br/><span class="kicker" style="font-size:10px">F1</span></span>
          <span class="card p" style="padding:8px"><b class="big-num" style="font-size:24px;color:var(--pink-text)">${p.specs.f2Days || '?'} d</b><br/><span class="kicker" style="font-size:10px">F2</span></span>
          <span class="card y" style="padding:8px"><b class="big-num" style="font-size:24px;color:var(--yellow)">${res.fizz || '?'}/5</b><br/><span class="kicker" style="font-size:10px">Fizz</span></span>
        </div>
      </div>` : html`
      <div class="card stack" style="gap:6px">
        <span class="kicker" style="color:var(--yellow)">Recipe</span>
        ${p.specs.flours.map((f) => html`<div class="row between list-row" style="padding:6px 0"><span>${f.name}</span><b style="font-family:var(--mono)">${f.g} g</b></div>`)}
        ${[['Water', p.specs.water + ' g'], ['Starter', p.specs.starter + ' g'], ['Salt', p.specs.salt + ' g']].map(([a, b]) => html`<div class="row between list-row" style="padding:6px 0"><span>${a}</span><b style="font-family:var(--mono)">${b}</b></div>`)}
        <div class="grid-3" style="margin-top:6px">
          <span class="card y" style="padding:8px"><b class="big-num" style="font-size:24px;color:var(--yellow)">${n.hydration}%</b><br/><span class="kicker" style="font-size:10px">Hydration</span></span>
          <span class="card p" style="padding:8px"><b class="big-num" style="font-size:24px;color:var(--pink-text)">${n.saltPct}%</b><br/><span class="kicker" style="font-size:10px">Salt</span></span>
          <span class="card t" style="padding:8px"><b class="big-num" style="font-size:24px;color:var(--teal-text)">${p.specs.temp}°</b><br/><span class="kicker" style="font-size:10px">Kitchen</span></span>
        </div>
      </div>
      <div class="card stack" style="gap:6px">
        <span class="kicker" style="color:var(--yellow)">How long it took</span>
        <div class="grid-2 small">
          <span>Bulk · <b>${bulk ? duration(bulk) : '—'}</b></span>
          <span>Cold retard · <b>${retard ? duration(retard) : '—'}</b></span>
          <span>Folds · <b>${p.specs.folds}</b></span>
          <span>Rise at shaping · <b>${res.measuredRise ? '+' + res.measuredRise + '%' : '—'}</b></span>
        </div>
      </div>`}

    ${p.notes && html`<div class="card stack" style="gap:6px"><span class="kicker" style=${tea ? 'color:var(--teal-text)' : 'color:var(--yellow)'}>Notes</span><span>${p.notes}</span></div>`}
    <${LogSection} project=${p} logs=${logs} accent=${accent} />
    <a class=${'btn block ' + (tea ? 'fill-t' : 'fill-y')} href=${(tea ? '#/new/kombucha?from=' : '#/new/bread?from=') + p.id}>${tea ? 'Brew this again →' : 'Bake this again →'}</a>
    <button class="btn p" onClick=${() => setConfirm(true)}>Delete</button>
    <${Sheet} open=${confirm} onClose=${() => setConfirm(false)} title="Delete this for good?">
      <span class="muted">${p.name} and its log will be removed. This can't be undone.</span>
      <button class="btn fill-p" onClick=${async () => { await api.deleteProject(p); setConfirm(false); toast('Deleted'); go('/history'); }}>Delete</button>
    <//>`;
}

export function ProjectDetail({ id, back = '#/' }) {
  const s = useApp();
  const now = useNow(1000);
  const p = s.projects.find((x) => x.id === id);
  if (!p) return html`<div class="main"><div class="topbar"><a href=${back}>← BACK</a></div><div class="empty"><span class="h2">Not found</span><span class="muted">It may have been deleted.</span></div></div>`;
  const tea = p.type === 'kombucha';
  const done = p.status !== 'active';
  return html`
    <div class=${'main' + (tea ? ' k' : '')}>
      <${Blobs} items=${tea ? [{ c: 'teal', x: '-80px', y: '70px', s: 290 }, { c: 'pink', x: '60%', y: '760px', s: 240 }] : [{ c: 'pink', x: '-70px', y: '80px', s: 280 }, { c: 'dots', x: '55%', y: '400px', s: 240 }]} />
      <div class="topbar">
        <a href=${done ? '#/history' : back}>← ${done ? 'JOURNAL' : 'HOME'}</a>
        ${!done && html`<a href=${'#/p/' + p.id + '/edit'} style=${'border:2px solid currentColor;border-radius:4px;padding:6px 12px;color:' + (tea ? 'var(--teal-text)' : 'var(--yellow)')}>EDIT</a>`}
      </div>
      ${done ? html`<${Record} p=${p} s=${s} />` : tea ? html`<${KombuchaActive} p=${p} s=${s} now=${now} />` : html`<${BreadActive} p=${p} s=${s} now=${now} />`}
    </div>`;
}
