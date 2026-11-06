import { html, useState, useApp, go, toast } from '../html.js';
import { Blobs } from '../components.js';
import { createBread, createKombucha, updateSpecs } from '../lib/api.js';
import { BREAD_DEFAULTS, KOMBUCHA_DEFAULTS, breadNumbers, bulkHours, breadSchedule, kombuchaRecipe, kombuchaSchedule, f1Days, planBackwards, starterPeakHours, TIME } from '../lib/schedule.js';
import { cultureStats } from '../lib/culturestats.js';
import { hhmm, dayLabel, toLocalInput } from '../lib/format.js';

export function NewChooser() {
  const s = useApp();
  const lastBread = s.projects.find((p) => p.type === 'bread');
  const lastTea = s.projects.find((p) => p.type === 'kombucha');
  return html`
    <div class="main">
      <${Blobs} items=${[{ c: 'pink', x: '50%', y: '60px', s: 260 }]} />
      <div class="topbar"><a href="#/">× CANCEL</a><span>STEP 1/2</span></div>
      <h1 class="h-display">What are we<br/><i>starting?</i></h1>
      <a href="#/new/bread" class="slab y tilt-l row between" style="text-decoration:none;min-height:150px">
        <span class="stack" style="gap:6px;max-width:220px"><span class="big-num" style="font-size:34px;line-height:.95">Sourdough loaf</span><span style="font-size:14px;font-weight:500">Mix, folds, bulk, cold retard, bake. We build the schedule.</span></span>
        <svg aria-hidden="true" width="110" height="86" viewBox="0 0 120 90"><circle cx="70" cy="44" r="40" fill="#FF2E9A" opacity="0.5"></circle><path d="M8 72c0-34 24-60 52-60s52 26 52 60c0 6-4 9-10 9H18c-6 0-10-3-10-9z" fill="none" stroke="#15173D" stroke-width="4"></path><path d="M34 40c16-10 38-12 56 2M40 56c12-6 28-6 42 2" fill="none" stroke="#15173D" stroke-width="4" stroke-linecap="round"></path></svg>
      </a>
      <a href="#/new/kombucha" class="slab t tilt-r row between" style="text-decoration:none;min-height:150px">
        <span class="stack" style="gap:6px;max-width:220px"><span class="big-num" style="font-size:34px;line-height:.95">Kombucha batch</span><span style="font-size:14px;font-weight:500">Sweet tea, F1, then bottles and fizz in F2.</span></span>
        <svg aria-hidden="true" width="84" height="104" viewBox="0 0 90 110"><circle cx="50" cy="60" r="36" fill="#FFE800" opacity="0.55"></circle><path d="M14 14h62v80a12 12 0 0 1-12 12H26a12 12 0 0 1-12-12z" fill="none" stroke="#15173D" stroke-width="4"></path><path d="M16 42h58" stroke="#15173D" stroke-width="6"></path><circle cx="32" cy="70" r="4" fill="none" stroke="#15173D" stroke-width="3"></circle><circle cx="56" cy="84" r="5" fill="none" stroke="#15173D" stroke-width="3"></circle></svg>
      </a>
      <a href="#/cultures?add=1" class="card p row between" style="text-decoration:none;color:inherit">
        <span class="stack" style="gap:2px"><span style="font-weight:700;font-size:17px">New starter or SCOBY</span><span class="small muted">A culture you keep alive between projects</span></span>
        <span aria-hidden="true" style="font-size:22px;color:var(--pink-text)">→</span>
      </a>
      ${(lastBread || lastTea) && html`<span class="kicker" style="padding-top:6px">Or go again</span>`}
      ${lastBread && html`<a href=${'#/new/bread?from=' + lastBread.id} class="card row between" style="text-decoration:none;color:inherit">
        <span class="stack" style="gap:2px"><span style="font-weight:700">${lastBread.name}</span><span class="kicker muted" style="font-size:11px">${breadNumbers(lastBread.specs).hydration}% HYDRATION${lastBread.rating ? ' · ' + lastBread.rating + '/5' : ''}</span></span>
        <span class="kicker" style="color:var(--yellow)">Reuse</span></a>`}
      ${lastTea && html`<a href=${'#/new/kombucha?from=' + lastTea.id} class="card row between" style="text-decoration:none;color:inherit">
        <span class="stack" style="gap:2px"><span style="font-weight:700">${lastTea.name}</span><span class="kicker muted" style="font-size:11px">${lastTea.specs.volume} L · ${(lastTea.specs.recipe || kombuchaRecipe(lastTea.specs.volume)).sugar} G SUGAR</span></span>
        <span class="kicker" style="color:var(--teal-text)">Reuse</span></a>`}
    </div>`;
}

const fmtStep = (iso) => `${dayLabel(iso).toUpperCase()}\n${hhmm(iso)}`;
const num = (v) => (v === '' ? '' : Number(v));

export function BreadForm({ from, edit, culture }) {
  const s = useApp();
  const base = edit || from;
  const starters = s.cultures.filter((c) => c.kind === 'starter');
  const [spec, setSpec] = useState(() => ({ ...BREAD_DEFAULTS, cultureId: starters[0] ? starters[0].id : null, notify: true, ...(base ? base.specs : {}), ...(from && !edit ? { name: base.specs.name } : {}), ...(culture ? { cultureId: culture } : {}) }));
  const [start, setStart] = useState(() => toLocalInput(edit ? edit.started_at : new Date()));
  const [mode, setMode] = useState('start'); // 'start' = start mixing at…, 'ready' = bread ready by…
  const [ready, setReady] = useState(() => { const d = new Date(Date.now() + TIME.DAY); d.setHours(10, 0, 0, 0); if (d - Date.now() < 30 * TIME.HOUR) d.setDate(d.getDate() + 1); return toLocalInput(d); });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setSpec({ ...spec, [k]: e.target.type === 'number' ? num(e.target.value) : e.target.value });
  const setFlour = (i, k) => (e) => { const flours = spec.flours.map((f, j) => (j === i ? { ...f, [k]: k === 'g' ? num(e.target.value) : e.target.value } : f)); setSpec({ ...spec, flours }); };
  const n = breadNumbers(spec);
  const filled = (v) => v !== '' && v != null && !Number.isNaN(Number(v));
  const valid = spec.flours.every((f) => filled(f.g)) && ['water', 'starter', 'salt', 'temp', 'autolyseMin', 'folds', 'foldEveryMin', 'retardHours', 'targetRise'].every((k) => filled(spec[k]));

  // Plan backwards from "ready by". The starter's own logged peaks win over the formula.
  const starter = s.cultures.find((c) => c.id === spec.cultureId && c.kind === 'starter');
  let peak = null, peakFrom = '';
  if (starter) {
    const st = cultureStats(starter, s.cultureEvents, s.projects);
    if (st.avgPeak) { peak = st.avgPeak; peakFrom = `${starter.name}'s logged peaks`; }
    else { peak = starterPeakHours(spec.temp, st.avgRatio || 2); peakFrom = `a ${spec.temp} °C kitchen`; }
  }
  const readyOk = ready && !isNaN(new Date(ready).getTime());
  const plan = !edit && mode === 'ready' && valid && readyOk ? planBackwards(spec, new Date(ready), { peakHours: starter && starter.location !== 'fridge' ? peak : starter ? peak + 12 : null }) : null;
  const late = plan && plan.warnings.some((w) => w.kind === 'late');
  const steps = valid ? (plan ? plan.steps : breadSchedule(spec, new Date(start))) : [];
  const shown = plan && plan.feedAt ? [{ kind: 'prefeed', title: `Feed ${starter.name}`, detail: starter.location === 'fridge' ? `Take ${starter.name} out of the fridge and feed. Should peak in about ${Math.round(peak + 12)} h, waking up included.` : `Should peak in about ${peak.toFixed(1)} h (from ${peakFrom}), right when you add it.`, at: new Date(plan.feedAt).toISOString() }, ...steps] : steps;

  const save = async () => {
    setBusy(true);
    try {
      if (edit) { const done = edit.status !== 'active'; await updateSpecs(edit, spec, !done); toast('Saved'); go((done ? '/history/' : '/p/') + edit.id); }
      else if (plan) {
        const p = await createBread({ ...spec, readyBy: new Date(ready).toISOString() }, new Date(plan.start), plan.feedAt ? { at: plan.feedAt, title: `Feed ${starter.name} for this bake`, detail: `So it peaks when you add it at ${hhmm(plan.steps[1].at)}` } : null);
        toast('Planned! We\'ll ping you when it\'s time.'); go('/p/' + p.id);
      }
      else { const p = await createBread(spec, new Date(start)); toast('Bake started. We\'ll ping you!'); go('/p/' + p.id); }
    } catch (e) { toast('Could not save: ' + e.message); } finally { setBusy(false); }
  };

  return html`
    <div class="main">
      <${Blobs} items=${[{ c: 'dots', x: '55%', y: '-40px', s: 240 }, { c: 'pink', x: '-100px', y: '900px', s: 280 }]} />
      <div class="topbar"><a href=${edit ? (edit.status !== 'active' ? '#/history/' : '#/p/') + edit.id : '#/new'}>← BACK</a><span>${edit ? 'EDIT' : 'STEP 2/2'}</span></div>
      <h1 class="h-display">${edit ? 'Edit' : 'New'}<br/><i>sourdough</i></h1>

      <div class="field"><label for="bname">Name</label><input id="bname" class="input" value=${spec.name} onInput=${set('name')} /></div>

      ${starters.length > 0 && html`<div class="field"><span class="label">Starter</span><div class="row wrap">
        ${starters.map((c) => html`<button type="button" class=${'chip' + (spec.cultureId === c.id ? ' on' : '')} aria-pressed=${spec.cultureId === c.id} onClick=${() => setSpec({ ...spec, cultureId: c.id })}>${c.name}</button>`)}
      </div></div>`}

      <div class="card stack">
        <span class="kicker">Ingredients (g)</span>
        <div class="grid-2">
          ${spec.flours.map((f, i) => html`
            <div class="field">
              <input class="input" aria-label=${'Flour ' + (i + 1) + ' name'} value=${f.name} onInput=${setFlour(i, 'name')} style="min-height:36px;font-size:13px;border-width:1px" />
              <input class="input" type="number" inputmode="decimal" aria-label=${f.name + ' grams'} value=${f.g} onInput=${setFlour(i, 'g')} />
            </div>`)}
          <div class="field"><label for="wa">Water</label><input id="wa" class="input" type="number" inputmode="decimal" value=${spec.water} onInput=${set('water')} /></div>
          <div class="field"><label for="st">Starter</label><input id="st" class="input" type="number" inputmode="decimal" value=${spec.starter} onInput=${set('starter')} /></div>
          <div class="field"><label for="sa">Salt</label><input id="sa" class="input" type="number" inputmode="decimal" value=${spec.salt} onInput=${set('salt')} /></div>
          <div class="field"><label for="sh">Starter hydration %</label><input id="sh" class="input" type="number" inputmode="decimal" value=${spec.starterHydration} onInput=${set('starterHydration')} /></div>
        </div>
        <div class="row wrap">
          <button type="button" class="btn sm" style="color:var(--muted);border-style:dashed" onClick=${() => setSpec({ ...spec, flours: spec.flours.concat({ name: 'Rye flour', g: 0 }) })}>+ Flour</button>
          ${spec.flours.length > 1 && html`<button type="button" class="btn sm" style="color:var(--muted);border-style:dashed" onClick=${() => setSpec({ ...spec, flours: spec.flours.slice(0, -1) })}>− Remove last</button>`}
        </div>
        <div class="slab y tilt-l grid-3">
          <span class="stack" style="gap:0"><b class="big-num" style="font-size:32px">${n.hydration}%</b><span class="kicker" style="font-size:11px">Hydration</span></span>
          <span class="stack" style="gap:0"><b class="big-num" style="font-size:32px">${n.saltPct}%</b><span class="kicker" style="font-size:11px">Salt</span></span>
          <span class="stack" style="gap:0"><b class="big-num" style="font-size:32px">${n.dough}</b><span class="kicker" style="font-size:11px">g dough</span></span>
        </div>
      </div>

      <div class="card stack" style="gap:6px">
        <label for="temp" class="row between kicker"><span>Kitchen temp</span><span style="color:var(--yellow)">${spec.temp} °C</span></label>
        <input id="temp" type="range" min="16" max="30" step="0.5" value=${spec.temp} onInput=${set('temp')} />
        <span class="small muted">Estimated bulk: about ${bulkHours(spec.temp).toFixed(1)} h at ${spec.temp} °C. Warmer kitchens ferment faster.</span>
      </div>

      <details class="card">
        <summary class="kicker" style="cursor:pointer;min-height:32px">Timing details</summary>
        <div class="grid-2" style="margin-top:12px">
          <div class="field"><label for="au">Autolyse (min)</label><input id="au" class="input" type="number" value=${spec.autolyseMin} onInput=${set('autolyseMin')} /></div>
          <div class="field"><label for="fo">Folds</label><input id="fo" class="input" type="number" min="0" max="8" value=${spec.folds} onInput=${set('folds')} /></div>
          <div class="field"><label for="fe">Fold every (min)</label><input id="fe" class="input" type="number" value=${spec.foldEveryMin} onInput=${set('foldEveryMin')} /></div>
          <div class="field"><label for="rt">Cold retard (h)</label><input id="rt" class="input" type="number" value=${spec.retardHours} onInput=${set('retardHours')} /></div>
          <div class="field"><label for="tr">Target rise %</label><input id="tr" class="input" type="number" value=${spec.targetRise} onInput=${set('targetRise')} /></div>
        </div>
      </details>

      ${!edit && html`
        <div class="row wrap" role="group" aria-label="Plan from">
          <button type="button" class=${'chip' + (mode === 'start' ? ' on' : '')} aria-pressed=${mode === 'start'} onClick=${() => setMode('start')}>Start now or at…</button>
          <button type="button" class=${'chip' + (mode === 'ready' ? ' on' : '')} aria-pressed=${mode === 'ready'} onClick=${() => setMode('ready')}>Bread ready by…</button>
        </div>
        ${mode === 'start' ? html`<div class="field"><label for="start">Start mixing at</label><input id="start" class="input" type="datetime-local" value=${start} onInput=${(e) => setStart(e.target.value)} /></div>` : html`
          <div class="field"><label for="ready">Out of the oven at</label><input id="ready" class="input" type="datetime-local" value=${ready} onInput=${(e) => setReady(e.target.value)} style="font-size:20px" /></div>
          ${plan && html`
            <div class=${'slab tilt-l stack ' + (late ? 'p' : 'y')} style="gap:4px">
              <span class="kicker">${late ? 'Too tight' : 'Your plan'}</span>
              ${plan.feedAt && html`<span class="big-num" style="font-size:26px">Feed ${starter.name} ${dayLabel(plan.feedAt).toLowerCase()} ${hhmm(plan.feedAt)}</span>`}
              <span class="big-num" style=${'font-size:' + (plan.feedAt ? '22px' : '30px')}>Mix ${dayLabel(plan.start).toLowerCase()} ${hhmm(plan.start)}</span>
              <span style="font-size:14px;font-weight:500">Bake goes in at ${hhmm(plan.bakeAt)}, out at ${hhmm(plan.ready)}. ${plan.retardHours} h in the fridge.</span>
            </div>
            ${plan.warnings.map((w) => html`<div class="banner">${w.text}</div>`)}
            ${plan.better && html`
              <button class="btn y" onClick=${() => setSpec({ ...spec, retardHours: plan.better.retardHours })}>Use ${plan.better.retardHours} h in the fridge instead (mix ${dayLabel(plan.better.start).toLowerCase()} ${hhmm(plan.better.start)})</button>`}
            ${!starter && html`<span class="small muted">Pick a starter above and we'll tell you when to feed it too.</span>`}`}
          ${!valid && html`<span class="small muted">Fill in every number and the plan appears.</span>`}`}`}

      <div class="stack" style="gap:8px">
        <div class="row between"><span class="kicker">Your schedule</span><span class="small muted">You can move any step later</span></div>
        ${shown.map((st) => html`<div class="step" style=${'border-color:' + (st.kind === 'fold' ? 'rgba(255,46,154,.55)' : st.kind === 'fridge' ? 'rgba(0,194,184,.55)' : 'rgba(255,232,0,.45)')}>
          <span class="when" style=${'color:' + (st.kind === 'fold' ? 'var(--pink-text)' : st.kind === 'fridge' ? 'var(--teal-text)' : 'var(--yellow)')}>${fmtStep(st.at)}</span>
          <span class="stack" style="gap:2px"><span class="title" style="font-weight:700">${st.title}</span><span class="small muted">${st.detail}</span></span>
        </div>`)}
      </div>

      <label class="card p toggle-row">
        <input type="checkbox" checked=${spec.notify !== false} onChange=${(e) => setSpec({ ...spec, notify: e.target.checked })} />
        <span class="stack" style="gap:0"><b>Ping me at every step</b><span class="small muted">Push notification, even when the app is closed</span></span>
      </label>

      ${!valid && html`<span class="small" style="color:var(--pink-text)">Fill in every number to continue.</span>`}
      <button class="btn fill-y block" disabled=${busy || !valid || late || (mode === 'ready' && !edit && !plan)} onClick=${save}>${busy ? 'Saving…' : edit ? 'Save changes' : plan ? 'Plan this bake →' : 'Start bake →'}</button>
    </div>`;
}

export function KombuchaForm({ from, edit, culture }) {
  const s = useApp();
  const base = edit || from;
  const scobys = s.cultures.filter((c) => c.kind === 'scoby');
  const count = s.projects.filter((p) => p.type === 'kombucha').length;
  const [spec, setSpec] = useState(() => ({ ...KOMBUCHA_DEFAULTS, name: 'Batch #' + (count + 1), cultureId: scobys[0] ? scobys[0].id : null, notify: true, ...(base ? base.specs : {}), ...(from && !edit ? { name: 'Batch #' + (count + 1) } : {}), ...(culture ? { cultureId: culture } : {}) }));
  const [recipe, setRecipe] = useState(() => (base && base.specs.recipe) || kombuchaRecipe(spec.volume));
  const [start, setStart] = useState(() => toLocalInput(edit ? edit.started_at : new Date()));
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setSpec({ ...spec, [k]: e.target.type === 'number' || e.target.type === 'range' ? num(e.target.value) : e.target.value });
  const setVol = (e) => { const v = Number(e.target.value); setSpec({ ...spec, volume: v }); setRecipe(kombuchaRecipe(v)); };
  const setR = (k) => (e) => setRecipe({ ...recipe, [k]: num(e.target.value) });
  const days = f1Days(spec.temp);
  const kValid = ['sugar', 'teaG', 'starterMl', 'waterL'].every((k) => recipe[k] !== '' && !Number.isNaN(Number(recipe[k])));
  const steps = kombuchaSchedule(spec, new Date(start));
  const note = spec.temp < 21 ? 'A bit cool. Expect a slower brew.' : spec.temp > 28 ? 'Warm. Check it often, it can turn sour fast.' : 'A good range is roughly 21–28 °C.';

  const save = async () => {
    setBusy(true);
    try {
      const full = { ...spec, recipe };
      if (edit) { await updateSpecs(edit, full, false); toast('Saved'); go((edit.status !== 'active' ? '/history/' : '/p/') + edit.id); }
      else { const p = await createKombucha(full, new Date(start)); toast('Batch started!'); go('/p/' + p.id); }
    } catch (e) { toast('Could not save: ' + e.message); } finally { setBusy(false); }
  };

  return html`
    <div class="main k">
      <${Blobs} items=${[{ c: 'teal', x: '55%', y: '-50px', s: 260 }, { c: 'dots', x: '-60px', y: '720px', s: 220 }]} />
      <div class="topbar"><a href=${edit ? (edit.status !== 'active' ? '#/history/' : '#/p/') + edit.id : '#/new'}>← BACK</a><span>${edit ? 'EDIT' : 'STEP 2/2'}</span></div>
      <h1 class="h-display teal">${edit ? 'Edit' : 'New'}<br/><i>kombucha</i></h1>

      <div class="field"><label for="kname">Name</label><input id="kname" class="input" value=${spec.name} onInput=${set('name')} /></div>
      ${scobys.length > 0 && html`<div class="field"><span class="label">SCOBY</span><div class="row wrap">
        ${scobys.map((c) => html`<button type="button" class=${'chip t' + (spec.cultureId === c.id ? ' on' : '')} aria-pressed=${spec.cultureId === c.id} onClick=${() => setSpec({ ...spec, cultureId: c.id })}>${c.name}</button>`)}
      </div></div>`}

      <div class="card stack" style="gap:6px">
        <label for="vol" class="row between kicker"><span>Batch size</span><span style="color:var(--teal-text)">${Number(spec.volume).toFixed(1)} L</span></label>
        <input id="vol" type="range" min="0.5" max="12" step="0.1" value=${spec.volume} onInput=${setVol} />
        <span class="kicker" style="margin-top:6px">Tea</span>
        <div class="row wrap">
          ${[['black', 'Black'], ['green', 'Green'], ['mix', 'Black + green'], ['other', 'Other']].map(([id, label]) => html`<button type="button" class=${'chip t' + (spec.tea === id ? ' on' : '')} aria-pressed=${spec.tea === id} onClick=${() => setSpec({ ...spec, tea: id })}>${label}</button>`)}
        </div>
      </div>

      <div class="slab t tilt-r stack">
        <span class="kicker">Recipe · edit any number</span>
        <div class="grid-2">
          <div class="field"><label for="ks">Sugar (g)</label><input id="ks" class="input" type="number" value=${recipe.sugar} onInput=${setR('sugar')} style="background:#fff;color:var(--ink);border-color:var(--ink)" /></div>
          <div class="field"><label for="kt">Tea (g)</label><input id="kt" class="input" type="number" value=${recipe.teaG} onInput=${setR('teaG')} style="background:#fff;color:var(--ink);border-color:var(--ink)" /></div>
          <div class="field"><label for="kst">Starter liquid (ml)</label><input id="kst" class="input" type="number" value=${recipe.starterMl} onInput=${setR('starterMl')} style="background:#fff;color:var(--ink);border-color:var(--ink)" /></div>
          <div class="field"><label for="kw">Water (L)</label><input id="kw" class="input" type="number" step="0.1" value=${recipe.waterL} onInput=${setR('waterL')} style="background:#fff;color:var(--ink);border-color:var(--ink)" /></div>
        </div>
        <span class="small" style="font-weight:500">Starting point: about 55 g sugar, 4 g tea (2 bags) and 10% starter liquid per litre.</span>
      </div>

      <div class="card stack" style="gap:6px">
        <label for="ktemp" class="row between kicker"><span>Brewing spot</span><span style="color:var(--teal-text)">${spec.temp} °C</span></label>
        <input id="ktemp" type="range" min="18" max="30" step="0.5" value=${spec.temp} onInput=${set('temp')} />
        <span class="small muted">${note} Expect F1 to take about ${days} days.</span>
      </div>

      ${!edit && html`<div class="field"><label for="kstart">Brewed at</label><input id="kstart" class="input" type="datetime-local" value=${start} onInput=${(e) => setStart(e.target.value)} /></div>`}

      <div class="stack" style="gap:8px">
        <span class="kicker">The plan</span>
        ${steps.map((st) => html`<div class="step" style="border-color:rgba(0,194,184,.5)"><span class="when" style="color:var(--teal-text)">${fmtStep(st.at)}</span><span class="stack" style="gap:2px"><span style="font-weight:700">${st.title}</span><span class="small muted">${st.detail}</span></span></div>`)}
        <div class="step" style="border-color:rgba(0,194,184,.5);border-style:dashed"><span class="when" style="color:var(--teal-text)">WHEN READY</span><span class="stack" style="gap:2px"><span style="font-weight:700">Bottle for F2, burp daily</span><span class="small muted">You'll pick flavours when it tastes balanced</span></span></div>
      </div>

      <label class="card p toggle-row">
        <input type="checkbox" checked=${spec.measurePh} onChange=${(e) => setSpec({ ...spec, measurePh: e.target.checked })} />
        <span class="stack" style="gap:0"><b>I'll measure pH</b><span class="small muted">${spec.measurePh ? 'We ask for pH at each taste. Ready is usually about 2.5–3.5.' : 'Optional. Taste works fine on its own.'}</span></span>
      </label>
      <label class="card t toggle-row">
        <input type="checkbox" checked=${spec.notify !== false} onChange=${(e) => setSpec({ ...spec, notify: e.target.checked })} />
        <span class="stack" style="gap:0"><b>Ping me for tastes and burps</b><span class="small muted">Push notification, even when the app is closed</span></span>
      </label>

      ${!kValid && html`<span class="small" style="color:var(--pink-text)">Fill in every recipe number to continue.</span>`}
      <button class="btn fill-t block" disabled=${busy || !kValid} onClick=${save}>${busy ? 'Saving…' : edit ? 'Save changes' : 'Start batch →'}</button>
    </div>`;
}
