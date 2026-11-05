import { html, useState, useApp } from '../html.js';
import { Blobs, Owner } from '../components.js';
import { breadNumbers } from '../lib/schedule.js';
import { shortDate, compactDuration } from '../lib/format.js';

const tilt = (i) => ['-1deg', '1.2deg', '0.6deg', '-1.4deg', '-0.5deg'][i % 5];

export function History() {
  const s = useApp();
  const [f, setF] = useState('all');
  const [q, setQ] = useState('');
  const done = s.projects.filter((p) => p.status !== 'active');
  const breads = done.filter((p) => p.type === 'bread').length;
  const teas = done.length - breads;
  const list = done
    .filter((p) => f === 'all' || (f === 'bread' ? p.type === 'bread' : p.type === 'kombucha'))
    .filter((p) => !q || (p.name + ' ' + (p.notes || '')).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => new Date(b.started_at) - new Date(a.started_at));
  return html`
    <div class="main">
      <${Blobs} items=${[{ c: 'teal', x: '-60px', y: '260px', s: 260 }, { c: 'pink', x: '55%', y: '620px', s: 260 }]} />
      <div class="row between" style="align-items:flex-end">
        <h1 class="h-display">The<br/><i>Journal</i></h1>
        <div class="row" style="gap:14px;text-align:right">
          <span class="stack" style="gap:0"><b class="big-num" style="font-size:36px;color:var(--yellow);text-shadow:0 0 18px rgba(255,232,0,.6)">${breads}</b><span class="kicker" style="font-size:10px">Loaves</span></span>
          <span class="stack" style="gap:0"><b class="big-num" style="font-size:36px;color:var(--teal-text);text-shadow:0 0 18px rgba(0,194,184,.7)">${teas}</b><span class="kicker" style="font-size:10px">Batches</span></span>
        </div>
      </div>
      <div class="row wrap" role="group" aria-label="Filter">
        ${[['all', 'All'], ['bread', 'Bread'], ['tea', 'Kombucha']].map(([id, l]) => html`<button class=${'chip w' + (f === id ? ' on' : '')} aria-pressed=${f === id} onClick=${() => setF(id)}>${l}</button>`)}
        <input class="input" type="search" aria-label="Search the journal" placeholder="Search…" value=${q} onInput=${(e) => setQ(e.target.value)} style="flex:1;min-width:120px;min-height:44px" />
      </div>
      ${list.length === 0 && html`<div class="empty"><span class="h2">Nothing here yet</span><span class="muted small">Finished bakes and batches land here, with every number you logged.</span></div>`}
      <div class="grid-auto" style="grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px">
        ${list.map((p, i) => p.type === 'bread' ? html`
          <a href=${'#/history/' + p.id} class="slab y" style=${`padding:0;overflow:hidden;text-decoration:none;display:flex;flex-direction:column;transform:rotate(${tilt(i)})`}>
            <div class="row between" style="padding:12px 14px 0">
              <span class="stack" style="gap:2px"><span class="row" style="gap:6px"><span class="kicker" style="font-size:11px">${shortDate(p.started_at)}</span><${Owner} id=${p.user_id} style="box-shadow:none;background:var(--ink);color:var(--paper)" /></span><span class="big-num" style="font-size:26px;line-height:1">${p.name}</span></span>
              <span class="big-num" style="font-size:44px;text-shadow:2px 2px 0 var(--pink)">${p.rating ? p.rating + '/5' : '—'}</span>
            </div>
            <svg aria-hidden="true" width="100%" height="80" viewBox="0 0 358 86" preserveAspectRatio="xMidYMid meet" style="display:block"><circle cx="220" cy="50" r="40" fill="#FF2E9A" opacity="0.6"></circle><path d="M90 80c0-40 40-68 89-68s89 28 89 68c0 4-4 6-10 6H100c-6 0-10-2-10-6z" fill="none" stroke="#15173D" stroke-width="4"></path><path d="M136 44c26-14 62-16 90 2" fill="none" stroke="#15173D" stroke-width="5" stroke-linecap="round"></path></svg>
            <div class="grid-3" style="background:var(--ink);color:var(--paper);padding:10px 14px;font-family:var(--mono);font-size:10px">
              <span class="stack" style="gap:0"><b class="big-num" style="font-size:20px;color:var(--yellow)">${breadNumbers(p.specs).hydration}%</b>HYDRATION</span>
              <span class="stack" style="gap:0"><b class="big-num" style="font-size:20px;color:var(--yellow)">${p.result && p.result.bulkMinutes ? compactDuration(p.result.bulkMinutes) : '—'}</b>BULK</span>
              <span class="stack" style="gap:0"><b class="big-num" style="font-size:20px;color:var(--yellow)">${p.result && p.result.measuredRise ? '+' + p.result.measuredRise + '%' : '—'}</b>RISE</span>
            </div>
          </a>` : html`
          <a href=${'#/history/' + p.id} class="card t row" style=${`gap:14px;text-decoration:none;color:inherit;transform:rotate(${tilt(i)});align-items:stretch;padding:12px`}>
            <svg aria-hidden="true" width="88" height="98" viewBox="0 0 88 98" style="flex:none;background:var(--teal)"><circle cx="56" cy="40" r="30" fill="#FFE800" opacity="0.7"></circle><ellipse cx="44" cy="54" rx="30" ry="20" fill="none" stroke="#15173D" stroke-width="4"></ellipse><ellipse cx="44" cy="50" rx="18" ry="10" fill="none" stroke="#15173D" stroke-width="3"></ellipse></svg>
            <span class="stack" style="gap:4px">
              <span class="row" style="gap:6px"><span class="kicker" style="font-size:11px;color:var(--teal-text)">${shortDate(p.started_at)}</span><${Owner} id=${p.user_id} /></span>
              <span class="big-num" style="font-size:22px;line-height:1">${p.name}</span>
              <span class="small muted">${p.specs.f1Days || '?'} d F1 · ${p.specs.f2Days || '?'} d F2${p.specs.flavors && p.specs.flavors.length ? ' · ' + p.specs.flavors.join(', ') : ''}</span>
              <span class="kicker" style="color:var(--teal-text)">Fizz ${'●'.repeat((p.result && p.result.fizz) || 0)}${'○'.repeat(5 - ((p.result && p.result.fizz) || 0))}</span>
            </span>
          </a>`)}
      </div>
    </div>`;
}
