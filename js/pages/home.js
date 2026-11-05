import { html, useState, useApp, useNow, toast } from '../html.js';
import { Jar, Blobs, Owner } from '../components.js';
import { completeReminder, snoozeReminder } from '../lib/api.js';
import { estimateRise, breadStage, kombuchaDay, f1Days, kombuchaActivity, TIME } from '../lib/schedule.js';
import { whenLabel, greeting, compactDuration } from '../lib/format.js';
import { pushSupport } from '../lib/push.js';

const isBread = (p) => p.type === 'bread';

function reminderStyle(r, projects, cultures) {
  const p = r.project_id ? projects.find((x) => x.id === r.project_id) : null;
  const c = r.culture_id ? cultures.find((x) => x.id === r.culture_id) : null;
  const tea = (p && p.type === 'kombucha') || (c && c.kind === 'scoby');
  return { tea, kicker: p ? p.name : c ? c.name : '', href: p ? '#/p/' + p.id : '#/cultures' };
}

export function upcoming(reminders, now, hours = 48) {
  return reminders
    .filter((r) => !r.done_at && r.kind !== 'test' && new Date(r.due_at).getTime() < now + hours * TIME.HOUR)
    .sort((a, b) => new Date(a.due_at) - new Date(b.due_at));
}

export function projectView(p, reminders, now) {
  const steps = reminders.filter((r) => r.project_id === p.id);
  if (isBread(p)) {
    const stage = breadStage(steps);
    const est = estimateRise(p, steps, now);
    const inBulk = stage === 'folds' || stage === 'bulk';
    const fill = stage === 'mix' ? 30 : inBulk ? 28 + Math.min(est.rise, 100) * 0.55 : stage === 'fridge' || stage === 'shape' ? 66 : 72;
    const next = steps.filter((s) => !s.done_at).sort((a, b) => a.idx - b.idx)[0];
    const label = { mix: 'MIXING', folds: 'FOLDS', bulk: 'BULK', shape: 'SHAPING', fridge: 'COLD RETARD', done: 'BAKED' }[stage] || stage.toUpperCase();
    return { steps, stage, est, inBulk, fill, next, label, activity: inBulk ? 40 + est.rise * 0.6 : stage === 'fridge' ? 12 : 30 };
  }
  const day = kombuchaDay(p, now);
  const total = p.stage === 'f2' ? (p.specs.f2Days || 3) : f1Days(p.specs.temp);
  const activity = p.stage === 'f2' ? 70 + Math.min(day, 3) * 10 : kombuchaActivity(day, total);
  const next = steps.filter((s) => !s.done_at).sort((a, b) => new Date(a.due_at) - new Date(b.due_at))[0];
  const label = p.stage === 'f2' ? `F2 · DAY ${day}` : p.stage === 'chilling' ? 'IN THE FRIDGE' : `F1 · DAY ${day}`;
  return { steps, day, total, activity, fill: p.stage === 'f2' ? 80 : 74, next, label };
}

export function Home() {
  const s = useApp();
  const now = useNow(20000);
  const [peek, setPeek] = useState(0);
  const active = s.projects.filter((p) => p.status === 'active');
  const list = upcoming(s.reminders, now);
  const top = list[0];
  const rest = list.slice(1, 5);
  const hero = active.filter(isBread).map((p) => ({ p, v: projectView(p, s.reminders, now) })).find((x) => x.v.inBulk);
  const others = active.filter((p) => !hero || p.id !== hero.p.id);
  const push = pushSupport();

  const done = async (r) => { await completeReminder(r); toast('Nice. Logged it.'); };
  const snooze = async (r) => { await snoozeReminder(r, 10); toast('Snoozed 10 min'); };

  let heroRise = 0, heroEta = '', heroFill = 30;
  if (hero) {
    const extra = peek * 60 * TIME.MIN;
    const est = estimateRise(hero.p, hero.v.steps, now + extra);
    heroRise = est.rise;
    heroEta = est.minutesLeft === 0 ? 'SHAPE IT NOW!' : compactDuration(est.minutesLeft) + ' TO GO';
    heroFill = Math.round(28 + Math.min(heroRise, 100) * 0.55);
  }

  return html`
    <div class="main wide">
      <${Blobs} items=${[{ c: 'dots', x: '55%', y: '-60px', s: 220 }, { c: 'pink', x: '45%', y: '480px', s: 300 }, { c: 'teal', x: '-90px', y: '880px', s: 260 }]} />
      <div class="topbar"><span>${greeting(new Date(now))}</span><span class="row" style="gap:14px"><a href="#/setup">STARTER PACK</a><a href="#/settings" aria-label="Settings">⚙</a></span></div>
      <h1 class="h-display">Your<br/><i>kitchen</i></h1>
      ${s.mode === 'local' && html`<div class="banner">DEMO MODE · DATA STAYS ON THIS DEVICE. <a href="#/settings">CONNECT</a></div>`}
      ${s.mode === 'supabase' && push.permission === 'default' && html`<a class="banner" href="#/settings" style="text-decoration:none">TURN ON NOTIFICATIONS SO WE CAN PING YOU →</a>`}

      <div class="home-grid">
        <section class="stack" aria-label="Up next">
          <span class="kicker">Up next · ${list.length}</span>
          ${top ? (() => { const st = reminderStyle(top, s.projects, s.cultures); return html`
            <div class=${'slab tilt-l stack ' + (st.tea ? 't pulse-t' : 'y pulse-y')} style="gap:8px">
              <div class="row between kicker"><span class="row" style="gap:8px"><a href=${st.href} style="color:inherit;text-decoration:none">${st.kicker}</a><${Owner} id=${top.user_id} style="box-shadow:none;background:var(--ink);color:var(--paper)" /></span><span>${whenLabel(top.due_at, now)}</span></div>
              <span class="big-num" style="font-size:38px;line-height:.95">${top.title}</span>
              ${top.detail && html`<span style="font-size:14px;font-weight:500">${top.detail}</span>`}
              <div class="row">
                <button class="btn solid-ink" style=${'flex:1;color:' + (st.tea ? 'var(--teal)' : 'var(--yellow)')} onClick=${() => done(top)}>Done</button>
                <button class="btn" style="color:var(--ink)" onClick=${() => snooze(top)}>+10 min</button>
              </div>
            </div>`; })() : html`
            <div class="empty"><span class="h2">All caught up</span><span class="muted small">Nothing needs you in the next two days. We'll ping you.</span></div>`}
          ${rest.map((r) => { const st = reminderStyle(r, s.projects, s.cultures); return html`
            <div class=${'card row ' + (st.tea ? 't' : 'y')} style="padding:8px 8px 8px 14px;gap:12px">
              <a href=${st.href} style="flex:1;min-width:0;color:inherit;text-decoration:none;display:flex;flex-direction:column;gap:2px">
                <span style="font-weight:700">${r.title}</span>
                <span class="row" style="gap:6px"><${Owner} id=${r.user_id} /><span class="small muted" style="font-family:var(--mono)">${st.kicker} · ${whenLabel(r.due_at, now)}</span></span>
              </a>
              <button class=${'btn sm ' + (st.tea ? 't' : 'y')} onClick=${() => done(r)}>Done</button>
            </div>`; })}
          ${list.length > 5 && html`<span class="small muted">+ ${list.length - 5} more later</span>`}
        </section>

        <section class="stack" aria-label="On the go">
          <span class="kicker">On the go · ${active.length}</span>
          ${active.length === 0 && html`
            <a class="empty" href="#/new" style="text-decoration:none;color:inherit">
              <span class="h2">Nothing fermenting</span><span class="muted small">Start a loaf or a kombucha batch →</span>
            </a>`}
          ${hero && html`
            <a href=${'#/p/' + hero.p.id} class="row" style="gap:16px;align-items:flex-end;text-decoration:none;color:inherit">
              <${Jar} type="bread" fill=${heroFill} activity=${40 + heroRise * 0.6} peak=${28 + hero.v.est.target * 0.55} w=${124} h=${180} label=${`${hero.p.name}, risen ${heroRise} percent`} />
              <div class="stack" style="gap:6px;padding-bottom:6px">
                <${Owner} id=${hero.p.user_id} /><span class="kicker">${hero.p.name} / ${hero.v.label}</span>
                <span class="big-num" style="font-size:84px;text-shadow:3px 2px 0 var(--teal)">${heroRise}<span style="font-size:38px">%</span></span>
                <span class="badge">${heroEta}</span>
                <span class="small muted">Target +${hero.v.est.target}%</span>
              </div>
            </a>
            <div class="card" style="padding:8px 12px 2px">
              <label for="peek" class="row between kicker"><span>Peek ahead</span><span style="color:var(--yellow)">${peek === 0 ? 'NOW' : '+' + peek + ' H'}</span></label>
              <input id="peek" type="range" min="0" max="5" step="0.5" value=${peek} onInput=${(e) => setPeek(Number(e.target.value))} />
            </div>`}
          ${others.length > 0 && html`
            <div class="grid-auto">
              ${others.map((p) => { const v = projectView(p, s.reminders, now); const tea = p.type === 'kombucha'; return html`
                <a href=${'#/p/' + p.id} class=${'card ' + (tea ? 't' : 'y')} style="display:flex;flex-direction:column;align-items:center;gap:6px;text-decoration:none;color:inherit;padding:12px 8px">
                  <${Jar} type=${tea ? 'tea' : 'bread'} fill=${v.fill} activity=${v.activity} w=${58} h=${76} />
                  <span style="font-family:var(--display);font-weight:900;font-size:18px;text-align:center">${p.name}</span><${Owner} id=${p.user_id} style="align-self:center" />
                  <span class="kicker" style=${'font-size:10px;color:' + (tea ? 'var(--teal-text)' : 'var(--yellow)')}>${v.label}</span>
                  <span class="small muted" style="text-align:center">${v.next ? v.next.title.replace(/ \(F2 day \d\)/, '') + ' · ' + whenLabel(v.next.due_at, now) : 'Nothing scheduled'}</span>
                </a>`; })}
            </div>`}
        </section>
      </div>
    </div>`;
}
