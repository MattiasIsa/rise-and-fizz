import { html, useState, useApp, toast } from '../html.js';
import { Blobs } from '../components.js';
import { newFact } from '../lib/api.js';
import { breadNumbers } from '../lib/schedule.js';
import { shortDate } from '../lib/format.js';

function Scatter({ points, xLabel, yLabel, xFmt = (x) => x, yFmt = (y) => y, color = '#FFE800', band, aria }) {
  if (points.length < 2) return html`<span class="small muted">Log a few more to see a chart here.</span>`;
  const W = 326, H = 190, L = 36, R = 10, T = 12, B = 30;
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys, 0), y1 = Math.max(...ys);
  const sx = (x) => L + ((x - x0) / Math.max(1e-6, x1 - x0)) * (W - L - R);
  const sy = (y) => H - B - ((y - y0) / Math.max(1e-6, y1 - y0)) * (H - T - B);
  const yt = [y0, (y0 + y1) / 2, y1];
  const xt = [x0, (x0 + x1) / 2, x1];
  return html`<svg role="img" aria-label=${aria} width="100%" viewBox=${`0 0 ${W} ${H}`} style="max-width:520px">
    ${yt.map((y) => html`<path d=${`M${L} ${sy(y)}H${W - R}`} stroke="rgba(245,240,255,0.15)" stroke-dasharray="2 4"></path><text x=${L - 6} y=${sy(y) + 4} text-anchor="end" font-family="Space Mono, monospace" font-size="10" fill="#C9C6EE">${yFmt(y)}</text>`)}
    <path d=${`M${L} ${H - B}H${W - R}`} stroke="#F5F0FF" stroke-width="1.5"></path>
    ${xt.map((x) => html`<text x=${sx(x)} y=${H - B + 16} text-anchor="middle" font-family="Space Mono, monospace" font-size="10" fill="#C9C6EE">${xFmt(x)}</text>`)}
    ${band && html`<rect x=${sx(band[0])} y=${T} width=${Math.max(4, sx(band[1]) - sx(band[0]))} height=${H - T - B} fill="#FF2E9A" opacity="0.3"></rect>`}
    ${points.map((p) => html`<circle cx=${sx(p.x)} cy=${sy(p.y)} r="6" fill=${color}><title>${p.title || ''}</title></circle>`)}
    <text x=${W - R} y=${H - 2} text-anchor="end" font-family="Space Mono, monospace" font-size="9" fill="#C9C6EE">${xLabel}</text>
    <text x="2" y="10" font-family="Space Mono, monospace" font-size="9" fill="#C9C6EE">${yLabel}</text>
  </svg>`;
}

function downloadCsv(rows) {
  const head = ['type', 'name', 'started', 'rating', 'hydration_pct', 'kitchen_c', 'bulk_min', 'retard_h', 'rise_pct', 'f1_days', 'f2_days', 'fizz', 'notes'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [head.join(',')].concat(rows.map((r) => head.map((h) => esc(r[h])).join(',')));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'rise-and-fizz.csv'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function Stats() {
  const s = useApp();
  const [view, setView] = useState('charts');
  const [busy, setBusy] = useState(false);
  const done = s.projects.filter((p) => p.status === 'done');
  const breads = done.filter((p) => p.type === 'bread');
  const teas = s.projects.filter((p) => p.type === 'kombucha');
  const rated = breads.filter((b) => b.rating);
  const avg = rated.length ? (rated.reduce((a, b) => a + b.rating, 0) / rated.length).toFixed(1) : '—';
  const f1s = teas.map((t) => t.specs.f1Days).filter(Boolean);
  const avgF1 = f1s.length ? Math.round(f1s.reduce((a, b) => a + b, 0) / f1s.length) + ' d' : '—';
  const fact = s.facts[0];

  const hydPts = rated.map((b) => ({ x: breadNumbers(b.specs).hydration, y: b.rating, title: `${b.name}: ${breadNumbers(b.specs).hydration}%, ${b.rating}/5` }));
  const best = rated.filter((b) => b.rating >= 5);
  const band = best.length ? [Math.min(...best.map((b) => breadNumbers(b.specs).hydration)), Math.max(...best.map((b) => breadNumbers(b.specs).hydration))] : null;
  const bulkPts = breads.filter((b) => b.result && b.result.bulkMinutes).map((b) => ({ x: b.specs.temp, y: b.result.bulkMinutes / 60, title: `${b.specs.temp} °C: ${(b.result.bulkMinutes / 60).toFixed(1)} h` }));

  const insights = [];
  if (best.length >= 2) {
    const r = best.map((b) => (b.result && b.result.retardHours) || b.specs.retardHours);
    insights.push(`Your ${best.length} five-star loaves had ${band[0]}–${band[1]}% hydration and ${Math.min(...r)}–${Math.max(...r)} h of cold retard.`);
  }
  const long = rated.filter((b) => ((b.result && b.result.retardHours) || b.specs.retardHours) > 15);
  if (long.length && rated.length > long.length) {
    const la = long.reduce((a, b) => a + b.rating, 0) / long.length;
    const rest = rated.filter((b) => !long.includes(b));
    const ra = rest.reduce((a, b) => a + b.rating, 0) / rest.length;
    if (ra - la >= 0.5) insights.push(`Loaves retarded over 15 h averaged ${(ra - la).toFixed(1)} stars lower than the rest.`);
  }
  if (!insights.length) insights.push('Finish and rate a few more bakes and patterns will show up here.');

  const rows = done.map((p) => ({
    type: p.type, name: p.name, started: p.started_at.slice(0, 10), rating: p.rating,
    hydration_pct: p.type === 'bread' ? breadNumbers(p.specs).hydration : '', kitchen_c: p.specs.temp,
    bulk_min: p.result && p.result.bulkMinutes, retard_h: p.type === 'bread' ? ((p.result && p.result.retardHours) || p.specs.retardHours) : '',
    rise_pct: p.result && p.result.measuredRise, f1_days: p.specs.f1Days, f2_days: p.specs.f2Days, fizz: p.result && p.result.fizz, notes: p.notes
  }));

  const ask = async (kind) => { setBusy(true); try { await newFact(kind); } catch (e) { toast('Could not get a fact right now'); } finally { setBusy(false); } };

  return html`
    <div class="main wide">
      <${Blobs} items=${[{ c: 'dots', x: '55%', y: '-60px', s: 240 }]} />
      <h1 class="h-display">The <i>numbers</i></h1>
      <div class="home-grid">
        <div class="stack">
          <div class="slab p tilt-l pulse-p stack" style="gap:10px">
            <div class="row between kicker" style="font-size:11px"><span>Fact of the day${s.mode === 'supabase' ? ' · from Claude' : ''}</span><span>${fact ? shortDate(fact.created_at) : ''}</span></div>
            <span class="big-num" style="font-size:24px;line-height:1.12;letter-spacing:-0.01em">${fact ? fact.text : 'Tap New fact for your first one.'}</span>
            <div class="row">
              <button class="btn solid-ink" style="color:var(--pink-text)" disabled=${busy} onClick=${() => ask('fact')}>${busy ? 'Thinking…' : 'New fact'}</button>
              <button class="btn" style="color:#fff" disabled=${busy} onClick=${() => ask('quiz')}>Quiz me</button>
            </div>
          </div>
          <div class="grid-2">
            ${[[breads.length, 'Loaves baked', 'y'], [avg, 'Avg rating', 'y'], [teas.length, 'Kombucha batches', 't'], [avgF1, 'Avg F1', 't']].map(([v, l, c]) => html`
              <span class=${'card ' + c} style="display:flex;flex-direction:column"><b class="big-num" style=${'font-size:44px;line-height:1;color:' + (c === 't' ? 'var(--teal-text)' : 'var(--yellow)')}>${v}</b><span class="kicker" style="font-size:10px">${l}</span></span>`)}
          </div>
          <div class="card y stack" style="gap:8px">
            <span class="h2" style="color:var(--yellow)">What made your best loaves</span>
            ${insights.map((t) => html`<span style="line-height:1.45">${t}</span>`)}
          </div>
        </div>
        <div class="stack">
          <div class="row" role="group" aria-label="View" style="border:2px solid var(--paper);border-radius:4px;gap:0">
            ${[['charts', 'Charts'], ['raw', 'Raw data']].map(([id, l]) => html`<button class="btn" aria-pressed=${view === id} style=${'flex:1;border:0;border-radius:0;' + (view === id ? 'background:var(--paper);color:var(--ink)' : 'color:var(--paper)')} onClick=${() => setView(id)}>${l}</button>`)}
          </div>
          ${view === 'charts' ? html`
            <div class="card stack" style="gap:8px"><span class="h2" style="font-size:22px">Rating vs hydration</span>
              <${Scatter} points=${hydPts} xLabel="HYDRATION %" yLabel="RATING" xFmt=${(x) => Math.round(x) + '%'} yFmt=${(y) => y.toFixed(0)} band=${band} aria="Scatter plot of loaf ratings against hydration" />
              ${band && html`<span class="small muted">Your sweet spot so far: ${band[0]}–${band[1]}% hydration.</span>`}
            </div>
            <div class="card stack" style="gap:8px"><span class="h2" style="font-size:22px">Bulk time vs kitchen temp</span>
              <${Scatter} points=${bulkPts} xLabel="KITCHEN °C" yLabel="BULK HOURS" color="#4FF0E4" xFmt=${(x) => x.toFixed(0) + '°'} yFmt=${(y) => y.toFixed(1) + 'h'} aria="Scatter plot of bulk fermentation hours against kitchen temperature" />
            </div>` : html`
            <div class="card scroll-x" style="padding:6px 10px">
              <table class="data">
                <thead><tr><th>Name</th><th>Date</th><th>Hydr</th><th>Bulk</th><th>Fridge</th><th>★</th></tr></thead>
                <tbody>${rows.map((r) => html`<tr><td>${r.name}</td><td>${r.started.slice(5)}</td><td>${r.hydration_pct ? r.hydration_pct + '%' : '—'}</td><td>${r.bulk_min ? (r.bulk_min / 60).toFixed(1) + 'h' : '—'}</td><td>${r.retard_h ? r.retard_h + 'h' : r.f1_days ? 'F1 ' + r.f1_days + 'd' : '—'}</td><td style="color:var(--yellow);font-weight:700">${r.rating || '—'}</td></tr>`)}</tbody>
              </table>
            </div>
            <button class="btn y" onClick=${() => downloadCsv(rows)}>Download CSV</button>`}
        </div>
      </div>
    </div>`;
}
