'use strict';
// Apex Learn engine: renders every module through one shared loop
// (Learn -> Try -> Results -> Explain -> Reflect -> Retry). Content lives in modules.js.
const app = document.getElementById('app');
let ME = null, CFG = {}, cur = null, step = 0, tryState = null, lastResult = null;
const STEPS = ['Learn', 'Try', 'Results', 'Explain', 'Reflect'];
const DISCLAIMER = '<p class="disclaimer">Educational simulation only. Apex Learn uses no real money and gives no personalized financial advice. All scenarios are hypothetical and illustrate ideas; they do not predict markets.</p>';

async function api(path, opts = {}) {
  const r = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Something went wrong. Please try again.');
  return d;
}
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const bar = n => `<div class="steps">${STEPS.map((_, i) => `<i class="${i < n ? 'on' : i === n ? 'cur' : ''}"></i>`).join('')}</div><div class="eyebrow">${STEPS[n]} · step ${n + 1} of 5</div>`;

// ───────── AUTH
function renderAuth(msg) {
  app.innerHTML = `<div id="auth"><div class="logo" style="margin-bottom:6px">APEX LEARN<small>Financial literacy, by doing</small></div>
    <p class="muted" style="margin:10px 0 18px">Make decisions in safe simulations and see what happens. No real money.</p>
    <div class="card">
      <div id="g-slot"></div>
      <button class="btn" id="guest" style="width:100%">Start now as a guest</button>
      <div class="divider">or save your progress</div>
      <h3 id="at">Sign in</h3>
      <input id="em" type="email" placeholder="Email" autocomplete="email">
      <input id="pw" type="password" placeholder="Password (8+ characters)" autocomplete="current-password">
      <input id="nm" type="text" placeholder="First name (optional)" class="hidden">
      <div class="err" id="err">${msg ? esc(msg) : ''}</div>
      <button class="btn ghost" id="go" style="width:100%">Sign in</button>
      <p class="muted" style="text-align:center;margin:12px 0 0"><a class="link" id="tg">Create an account instead</a></p>
    </div>${DISCLAIMER}</div>`;
  let mode = 'login';
  $('tg').onclick = () => { mode = mode === 'login' ? 'signup' : 'login'; $('at').textContent = mode === 'login' ? 'Sign in' : 'Create your account'; $('go').textContent = mode === 'login' ? 'Sign in' : 'Create account'; $('tg').textContent = mode === 'login' ? 'Create an account instead' : 'Sign in instead'; $('nm').classList.toggle('hidden', mode === 'login'); };
  const enter = async fn => { try { const d = await fn(); ME = d.user; renderDash(); } catch (e) { $('err').textContent = e.message; } };
  $('guest').onclick = () => enter(() => api('/api/auth/guest', { method: 'POST' }));
  $('go').onclick = () => enter(() => api(mode === 'login' ? '/api/auth/login' : '/api/auth/signup', { method: 'POST', body: JSON.stringify({ email: $('em').value.trim(), password: $('pw').value, displayName: $('nm').value.trim() }) }));
  if (CFG.googleClientId) loadGoogle(enter);
}
function loadGoogle(enter) {
  const init = () => {
    google.accounts.id.initialize({ client_id: CFG.googleClientId, callback: resp => enter(() => api('/api/auth/google', { method: 'POST', body: JSON.stringify({ credential: resp.credential }) })) });
    google.accounts.id.renderButton($('g-slot'), { theme: 'filled_black', size: 'large', width: 330, text: 'continue_with' });
    $('g-slot').style.cssText = 'display:flex;justify-content:center;margin-bottom:12px';
  };
  if (window.google && google.accounts) return init();
  const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = init; document.head.appendChild(s);
}

// ───────── DASHBOARD
async function renderDash() {
  const d = await api('/api/dashboard');
  const pct = Math.round(d.modulesCompleted / d.modulesTotal * 100);
  const next = d.modules.find(m => m.userStatus !== 'completed');
  app.innerHTML = `<div class="topbar"><div class="logo">APEX LEARN</div><a class="link" id="out">${ME && ME.guest ? 'Leave guest session' : 'Sign out'}</a></div>
    <h1>${ME && ME.displayName && !ME.guest ? 'Welcome back, ' + esc(ME.displayName) : 'Your learning path'}</h1>
    <p class="muted">Six short modules. Each one: learn it, try it, see what happened, understand why.</p>
    <div class="card hl"><div style="display:flex;justify-content:space-between"><b>${d.modulesCompleted} of ${d.modulesTotal} modules complete</b><span class="mono pos">${pct}%</span></div>
      <div class="track"><div class="fill" style="width:${pct}%"></div></div>
      <p class="muted" style="margin:6px 0 0">${d.simulationsCompleted} simulation${d.simulationsCompleted === 1 ? '' : 's'} completed</p>
      ${next ? `<div class="row"><button class="btn" id="cont">${next.userStatus === 'in_progress' ? 'Continue' : 'Start'}: ${esc(next.title)}</button></div>` : '<p class="pos" style="margin:10px 0 0"><b>You finished every module. Nicely done.</b></p>'}</div>
    ${d.modules.map((m, i) => `<div class="mod" data-m="${m.id}" tabindex="0" role="button"><span class="n">${String(i + 1).padStart(2, '0')}</span><div class="t"><b>${esc(m.title)}</b><span>${esc(m.summary || '')}</span></div><span class="badge ${m.userStatus}">${m.userStatus === 'completed' ? '✓ done' : m.userStatus === 'in_progress' ? 'in progress' : 'start'}</span></div>`).join('')}
    ${ME && ME.guest ? '<p class="muted" style="text-align:center;margin-top:14px">Guest progress is tied to this browser. Sign out and create an account to keep it anywhere.</p>' : ''}${DISCLAIMER}`;
  $('out').onclick = async () => { await api('/api/auth/logout', { method: 'POST' }); ME = null; renderAuth(); };
  document.querySelectorAll('[data-m]').forEach(el => { const go = () => openModule(el.dataset.m); el.onclick = go; el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }; });
  if ($('cont')) $('cont').onclick = () => openModule(next.id);
}

// ───────── MODULE LOOP
async function openModule(id) { cur = id; tryState = null; lastResult = null; await api(`/api/modules/${id}/start`, { method: 'POST' }); step = 0; render(); }
function render() { window.scrollTo(0, 0); [renderLearn, renderTry, renderResults, renderExplain, renderReflect][step](); }
const M = () => MODULES[cur];
const nav = (back, label, enabled = true) => `<div class="row" style="margin-top:16px">${back ? '<button class="btn ghost" id="bk">Back</button>' : '<button class="btn ghost" id="bk">Dashboard</button>'}<button class="btn" id="nx" ${enabled ? '' : 'disabled'}>${label}</button></div>`;
function wire(onBack, onNext) { $('bk').onclick = onBack; $('nx').onclick = onNext; }

function renderLearn() {
  const m = M();
  app.innerHTML = `${bar(0)}<h2>${m.title}</h2>${m.learn.map(c => `<div class="card"><h3>${c.h}</h3><p style="margin:0">${c.p}</p></div>`).join('')}${nav(false, 'Try it →')}`;
  wire(renderDash, () => { step = 1; render(); });
}

function renderTry() {
  const t = M().try; api('/api/simulations', { method: 'POST', body: JSON.stringify({ moduleId: cur, started: true }) }).catch(() => {});
  ({ sliders: tSliders, allocation: tAlloc, dip: tDip, choices: tChoices })[t.type](t);
}
function finish(result) { lastResult = result; api('/api/simulations', { method: 'POST', body: JSON.stringify({ moduleId: cur, result: slim(result) }) }).catch(() => {}); step = 2; render(); }
const slim = r => JSON.parse(JSON.stringify(r, (k, v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v)));

function tSliders(t) {
  const vals = Object.fromEntries(t.controls.map(c => [c.k, (tryState && tryState[c.k]) ?? c.val]));
  app.innerHTML = `${bar(1)}<h2>${t.title}</h2><p>${t.intro}</p><div class="card">${t.controls.map(c => `<div class="slider-row"><b>${c.label}</b><input type="range" id="s_${c.k}" min="${c.min}" max="${c.max}" step="${c.step}" value="${vals[c.k]}" aria-label="${c.label}"><span class="val" id="v_${c.k}">${c.f(vals[c.k])}</span></div>`).join('')}</div>${nav(true, 'Run it →')}`;
  t.controls.forEach(c => $('s_' + c.k).oninput = e => { vals[c.k] = Number(e.target.value); $('v_' + c.k).textContent = c.f(vals[c.k]); });
  wire(() => { step = 0; render(); }, () => { tryState = vals; finish(t.run(vals)); });
}

function tAlloc(t) {
  const w = Object.assign({}, (tryState && tryState.w) || t.start), pick = t.scenarios.some(s => s.pick) ? ((tryState && tryState.pick) || t.scenarios[0].id) : null;
  app.innerHTML = `${bar(1)}<h2>${t.title}</h2><p>${t.intro}</p>${t.note ? `<p class="muted">${t.note}</p>` : ''}
    <div class="card">${t.assets.map(a => `<div class="slider-row"><b style="${a.c ? 'color:' + a.c : ''}">${a.k}</b><input type="range" id="a_${a.k}" min="0" max="100" step="5" value="${w[a.k] || 0}" aria-label="${a.k} percent"><span class="val" id="p_${a.k}">${w[a.k] || 0}%</span></div>`).join('')}
    <p class="muted" style="margin:6px 0 0">Total: <b id="tot" class="mono"></b> (needs to be 100%)</p></div>
    ${pick ? `<label class="q">Test it against:</label><select id="pick">${t.scenarios.map(s => `<option value="${s.id}" ${s.id === pick ? 'selected' : ''}>${s.label}</option>`).join('')}</select>` : ''}${nav(true, 'Run it →', false)}`;
  const calc = () => { const tot = t.assets.reduce((a, x) => a + (w[x.k] || 0), 0); $('tot').textContent = tot + '%'; $('tot').style.color = tot === 100 ? 'var(--green)' : 'var(--red)'; $('nx').disabled = tot !== 100; };
  t.assets.forEach(a => $('a_' + a.k).oninput = e => { w[a.k] = Number(e.target.value); $('p_' + a.k).textContent = w[a.k] + '%'; calc(); });
  calc();
  wire(() => { step = 0; render(); }, () => { const p = pick ? $('pick').value : null; tryState = { w, pick: p }; finish(t.runAll(w, t.scenarios, p)); });
}

function tDip(t) {
  const pts = t.path, W = 600, H = 170, all = pts.concat(t.future), lo = Math.min(...all) - 4, hi = Math.max(...all) + 4;
  const xy = (v, i, n) => `${(i / (n - 1) * (W - 20) + 10).toFixed(1)},${(H - 12 - (v - lo) / (hi - lo) * (H - 24)).toFixed(1)}`;
  const n = all.length, line = pts.map((v, i) => xy(v, i, n)).join(' ');
  app.innerHTML = `${bar(1)}<h2>${t.title}</h2><p>${t.intro}</p>
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Hypothetical index price rising then falling about 23 percent"><polyline fill="none" stroke="#ff5252" stroke-width="2.5" points="${line}"/><circle cx="${xy(pts[pts.length - 1], pts.length - 1, n).split(',')[0]}" cy="${xy(pts[pts.length - 1], pts.length - 1, n).split(',')[1]}" r="5" fill="#ff5252"/></svg>
    <p class="muted">Your holding: 100 shares at $100 = $10,000 at the start. It is now ${pts[pts.length - 1]}.</p>
    ${t.choices.map(c => `<button class="opt ${tryState && tryState.c === c.id ? 'sel' : ''}" data-c="${c.id}"><b>${c.label}</b><br><span class="muted">${c.note}</span></button>`).join('')}${nav(true, 'See what happens →', !!(tryState && tryState.c))}`;
  document.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { tryState = { c: b.dataset.c }; document.querySelectorAll('[data-c]').forEach(x => x.classList.toggle('sel', x === b)); $('nx').disabled = false; });
  wire(() => { step = 0; render(); }, () => { const r = t.run(tryState.c, t.path, t.future); r._path = all; finish(r); });
}

function tChoices(t) {
  const ans = (tryState && tryState.a) ? tryState.a.slice() : new Array(t.qs.length).fill(undefined);
  app.innerHTML = `${bar(1)}<h2>${t.title}</h2><p>${t.intro}</p>${t.qs.map((q, i) => `<div class="card"><h3>${i + 1}. ${q.q}</h3>${q.o.map((o, j) => `<button class="opt ${ans[i] === j ? 'sel' : ''}" data-q="${i}" data-o="${j}">${o.t}</button>`).join('')}</div>`).join('')}${nav(true, 'See my results →', ans.every(a => a !== undefined))}`;
  document.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { const i = +b.dataset.q; ans[i] = +b.dataset.o; document.querySelectorAll(`[data-q="${i}"]`).forEach(x => x.classList.toggle('sel', x === b)); $('nx').disabled = !ans.every(a => a !== undefined); });
  wire(() => { step = 0; render(); }, () => { tryState = { a: ans }; finish(t.run(ans.map((a, i) => t.qs[i].o[a].b), t)); });
}

function renderResults() {
  const m = M();
  app.innerHTML = `${bar(2)}<h2>What happened</h2><div class="card">${m.results(lastResult)}</div>${nav(true, 'Why did that happen? →')}`;
  wire(() => { step = 1; render(); }, () => { step = 3; render(); });
}
function renderExplain() {
  const m = M();
  app.innerHTML = `${bar(3)}<h2>Why this happened</h2><div class="card">${m.explain(lastResult).map(p => `<p>${p}</p>`).join('')}
    <div class="cite"><b>Sources &amp; further reading</b><br>${m.sources.map(s => `<a href="${s.u}" target="_blank" rel="noopener noreferrer">${esc(s.t)}</a>`).join('<br>')}<br>Scenarios here are hypothetical and rounded for learning; they are not forecasts.</div></div>${nav(true, 'Reflect →')}`;
  wire(() => { step = 2; render(); }, () => { step = 4; render(); });
}
function renderReflect() {
  const m = M();
  app.innerHTML = `${bar(4)}<h2>Quick reflection</h2><p class="muted">A sentence or two is plenty. This is just for you.</p><div class="card">${m.reflect.map((q, i) => `<label class="q" for="r${i}">${q}</label><textarea id="r${i}" maxlength="600"></textarea>`).join('')}</div>${nav(true, 'Finish module ✓')}`;
  wire(() => { step = 3; render(); }, async () => { $('nx').disabled = true; try { await api(`/api/modules/${cur}/reflect`, { method: 'POST', body: JSON.stringify({ answers: Object.fromEntries(m.reflect.map((_, i) => ['q' + (i + 1), $('r' + i).value.slice(0, 600)])) }) }); renderDone(); } catch (e) { $('nx').disabled = false; alert(e.message); } });
}
async function renderDone() {
  const d = await api('/api/dashboard'), left = d.modules.filter(x => x.userStatus !== 'completed'), nxt = left.find(x => x.id !== cur);
  app.innerHTML = `<div class="card hl" style="text-align:center;margin-top:30px"><div class="eyebrow">Module complete</div><h2>${M().title} ✓</h2><p class="muted">${d.modulesCompleted} of ${d.modulesTotal} modules done</p><div class="track"><div class="fill" style="width:${d.modulesCompleted / d.modulesTotal * 100}%"></div></div>
    <div class="row" style="justify-content:center;margin-top:16px">${nxt ? `<button class="btn" id="nm">Next: ${esc(nxt.title)} →</button>` : ''}<button class="btn ghost" id="rt">Try it again</button><button class="btn ghost" id="db">Dashboard</button></div></div>${DISCLAIMER}`;
  if ($('nm')) $('nm').onclick = () => openModule(nxt.id);
  $('rt').onclick = () => { step = 1; tryState = null; render(); }; $('db').onclick = renderDash;
}

// ───────── BOOT
(async function () {
  try { CFG = await api('/api/config'); } catch (e) {}
  try { const d = await api('/api/auth/me'); if (d.user) { ME = d.user; return renderDash(); } } catch (e) {}
  renderAuth();
})();
