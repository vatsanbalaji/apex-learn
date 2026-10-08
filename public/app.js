'use strict';
// Apex Learn — single-file client app (same low-dependency approach as the
// research platform's frontend, but entirely new code: no consent/survey UI).
const app = document.getElementById('app');
let ME = null;

async function api(path, opts) {
  const r = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function h(html) { const d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; }

// ───────────────────────────────────────────── AUTH SCREENS
function renderAuth() {
  app.innerHTML = `
    <h1>Apex Learn</h1>
    <p class="muted">Learn financial concepts by making decisions and seeing what happens — not by reading about them.</p>
    <div class="card" id="auth-card">
      <h3 id="auth-title">Sign in</h3>
      <input id="auth-email" type="email" placeholder="Email">
      <input id="auth-password" type="password" placeholder="Password (8+ characters)">
      <input id="auth-name" type="text" placeholder="Display name (sign up only)" class="hidden">
      <div id="auth-error" class="muted" style="color:var(--danger)"></div>
      <button class="btn" id="auth-submit">Sign in</button>
      <p class="muted">No account? <a class="link" id="auth-toggle">Create one</a></p>
    </div>
    <p class="disclaimer">Educational simulation only. Apex Learn does not provide real financial advice and does not use real money. All market scenarios are simulated for teaching purposes.</p>
  `;
  let mode = 'login';
  const toggle = document.getElementById('auth-toggle');
  const title = document.getElementById('auth-title');
  const nameInput = document.getElementById('auth-name');
  const submit = document.getElementById('auth-submit');
  toggle.onclick = () => {
    mode = mode === 'login' ? 'signup' : 'login';
    title.textContent = mode === 'login' ? 'Sign in' : 'Create your account';
    submit.textContent = mode === 'login' ? 'Sign in' : 'Create account';
    toggle.textContent = mode === 'login' ? 'Create one' : 'Sign in instead';
    nameInput.classList.toggle('hidden', mode === 'login');
  };
  submit.onclick = async () => {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const displayName = document.getElementById('auth-name').value.trim();
    const errEl = document.getElementById('auth-error');
    errEl.textContent = '';
    try {
      const path = mode === 'login' ? '/api/auth/login' : '/api/auth/signup';
      const data = await api(path, { method: 'POST', body: JSON.stringify({ email, password, displayName }) });
      ME = data.user;
      renderDashboard();
    } catch (e) { errEl.textContent = e.message; }
  };
}

// ───────────────────────────────────────────── DASHBOARD
async function renderDashboard() {
  app.innerHTML = `<p class="muted">Loading your dashboard…</p>`;
  const data = await api('/api/dashboard');
  const pct = data.modulesTotal ? Math.round((data.modulesCompleted / data.modulesTotal) * 100) : 0;
  app.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:baseline">
      <h1>Apex Learn</h1>
      <a class="link muted" id="logout-link">Sign out</a>
    </div>
    <p class="muted">Welcome back${ME.displayName ? ', ' + ME.displayName : ''}.</p>
    <div class="card">
      <h3>Progress: ${data.modulesCompleted} / ${data.modulesTotal} modules</h3>
      <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
      <div class="module-list">
        ${data.modules.map(m => `
          <div class="module-row">
            <div>
              <div><strong>${m.title}</strong></div>
            </div>
            <div style="display:flex;align-items:center;gap:10px">
              <span class="badge ${m.status === 'coming_soon' ? 'coming_soon' : m.userStatus}">
                ${m.status === 'coming_soon' ? 'coming soon' : m.userStatus.replace('_',' ')}
              </span>
              ${m.status === 'available' ? `<button class="btn secondary" data-module="${m.id}">${m.userStatus === 'completed' ? 'Retry' : 'Open'}</button>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
      <p class="muted" style="margin-top:14px">Simulations completed: ${data.simulationsCompleted}</p>
    </div>
    <p class="disclaimer">All amounts and portfolios on this platform are simulated for learning purposes. Nothing here is personalized financial advice.</p>
  `;
  document.getElementById('logout-link').onclick = async () => { await api('/api/auth/logout', { method: 'POST' }); ME = null; renderAuth(); };
  document.querySelectorAll('[data-module]').forEach(btn => {
    btn.onclick = () => openModule(btn.getAttribute('data-module'));
  });
}

// ───────────────────────────────────────────── MODULE FLOW (Learn -> Try -> Results -> Explain -> Reflect -> Retry)
const MODULE_CONTENT = {
  diversification: {
    title: 'Diversification',
    learn: `Diversification means spreading your money across multiple, different investments rather than putting it all into one. The idea isn't to avoid risk entirely — it's to avoid being wiped out by any single bad outcome. When one holding drops sharply, a diversified portfolio feels it as a bruise; a concentrated one feels it as a break.`,
    scenarios: [
      { id: 'tech_selloff', label: 'A sharp tech sector selloff' },
      { id: 'energy_shock', label: 'An energy price shock' },
      { id: 'broad_rally', label: 'A broad market rally' },
    ],
  },
};

let currentModule = null, currentStep = 'learn', lastResult = null;

function stepDots(active) {
  const steps = ['learn','try','results','explain','reflect'];
  return steps.map(s => `<span class="step-dot ${s===active?'active':''}"></span>`).join('');
}

async function openModule(moduleId) {
  currentModule = moduleId; currentStep = 'learn';
  await api(`/api/modules/${moduleId}/start`, { method: 'POST' });
  renderLearn();
}

function renderLearn() {
  const content = MODULE_CONTENT[currentModule];
  app.innerHTML = `
    <div class="card">
      ${stepDots('learn')}
      <h2>${content.title}</h2>
      <p>${content.learn}</p>
      <button class="btn" id="to-try">Try it →</button>
      <button class="btn secondary" id="back-dash">Back to dashboard</button>
    </div>
  `;
  document.getElementById('to-try').onclick = renderTry;
  document.getElementById('back-dash').onclick = renderDashboard;
}

async function renderTry() {
  currentStep = 'try';
  const { prices, tickers } = await api('/api/prices');
  const content = MODULE_CONTENT[currentModule];
  app.innerHTML = `
    <div class="card">
      ${stepDots('try')}
      <h2>Build your portfolio</h2>
      <p class="muted">You have a simulated $10,000. Allocate it across these assets (must total 100%).</p>
      <div id="alloc-rows"></div>
      <p class="muted">Total allocated: <span id="alloc-total">0</span>%</p>
      <label class="muted">Scenario to test against:</label>
      <select id="scenario-select" style="width:100%;padding:10px;margin:8px 0;border-radius:8px;background:var(--panel2);color:var(--text);border:1px solid var(--border)">
        ${content.scenarios.map(s => `<option value="${s.id}">${s.label}</option>`).join('')}
      </select>
      <button class="btn" id="run-sim" disabled>Run simulation</button>
      <button class="btn secondary" id="back-learn">Back</button>
    </div>
  `;
  const rows = document.getElementById('alloc-rows');
  tickers.forEach(t => {
    const row = h(`<div class="alloc-row">
      <label>${t}</label>
      <input type="range" min="0" max="100" value="0" data-ticker="${t}">
      <span class="pct" data-pct-for="${t}">0%</span>
    </div>`);
    rows.appendChild(row);
  });
  const totalEl = document.getElementById('alloc-total');
  const runBtn = document.getElementById('run-sim');
  function recompute() {
    let total = 0;
    rows.querySelectorAll('input[type=range]').forEach(inp => {
      const v = Number(inp.value);
      document.querySelector(`[data-pct-for="${inp.getAttribute('data-ticker')}"]`).textContent = v + '%';
      total += v;
    });
    totalEl.textContent = total;
    runBtn.disabled = total !== 100;
  }
  rows.querySelectorAll('input[type=range]').forEach(inp => inp.oninput = recompute);
  recompute();
  document.getElementById('back-learn').onclick = renderLearn;
  runBtn.onclick = async () => {
    const allocations = {};
    rows.querySelectorAll('input[type=range]').forEach(inp => { allocations[inp.getAttribute('data-ticker')] = Number(inp.value); });
    const scenario = document.getElementById('scenario-select').value;
    lastResult = await api('/api/simulate/diversification', { method: 'POST', body: JSON.stringify({ allocations, scenario }) });
    renderResults();
  };
}

function renderResults() {
  currentStep = 'results';
  const r = lastResult;
  const better = r.portfolioChangePct > r.benchmarkChangePct;
  app.innerHTML = `
    <div class="card">
      ${stepDots('results')}
      <h2>What happened</h2>
      <p>Your portfolio moved <strong style="color:${r.portfolioChangePct>=0?'var(--accent)':'var(--danger)'}">${r.portfolioChangePct}%</strong> during this scenario.</p>
      <p class="muted">An equally-spread benchmark across the same assets moved ${r.benchmarkChangePct}%.</p>
      <p class="muted">Your largest single position was <strong>${r.largestPositionPct}%</strong> of your portfolio (concentration score: ${r.hhi}, where 1.0 = everything in one asset).</p>
      <button class="btn" id="to-explain">Explain why →</button>
    </div>
  `;
  document.getElementById('to-explain').onclick = renderExplain;
}

function renderExplain() {
  currentStep = 'explain';
  const r = lastResult;
  const concentrationNote = r.largestPositionPct >= 50
    ? `${r.largestPositionPct}% of your portfolio was concentrated in one asset. When that scenario hit, your result was pulled much more heavily toward that single position's outcome than a spread-out portfolio would have been.`
    : `You kept your largest position under half your portfolio, which is why your result tracked closer to the broader benchmark instead of swinging on one asset's outcome.`;
  app.innerHTML = `
    <div class="card">
      ${stepDots('explain')}
      <h2>Why this happened</h2>
      <p>${concentrationNote}</p>
      <p>This is the core idea of diversification: concentration amplifies whatever happens to the thing you're concentrated in — good or bad. Spreading allocation across assets that don't all move together smooths out the ride, at the cost of also smoothing out your biggest potential wins.</p>
      <button class="btn" id="to-reflect">Reflect →</button>
    </div>
  `;
  document.getElementById('to-reflect').onclick = renderReflect;
}

function renderReflect() {
  currentStep = 'reflect';
  app.innerHTML = `
    <div class="card">
      ${stepDots('reflect')}
      <h2>Quick reflection</h2>
      <p class="muted">A sentence or two is plenty.</p>
      <label>What would you change about your allocation next time, and why?</label>
      <input id="reflect-1" type="text" placeholder="Type your answer…">
      <label>Was there a moment you wanted to put more into one asset? What held you back or pushed you toward it?</label>
      <input id="reflect-2" type="text" placeholder="Type your answer…">
      <button class="btn" id="submit-reflect">Finish module</button>
    </div>
  `;
  document.getElementById('submit-reflect').onclick = async () => {
    const answers = { q1: document.getElementById('reflect-1').value, q2: document.getElementById('reflect-2').value };
    await api(`/api/modules/${currentModule}/reflect`, { method: 'POST', body: JSON.stringify({ answers }) });
    renderDone();
  };
}

function renderDone() {
  app.innerHTML = `
    <div class="card">
      <h2>Module complete 🎉</h2>
      <p>Nice work. You can retry this module with a different allocation and scenario, or head back to your dashboard.</p>
      <button class="btn" id="retry-module">Retry this module</button>
      <button class="btn secondary" id="back-dash2">Back to dashboard</button>
    </div>
  `;
  document.getElementById('retry-module').onclick = () => openModule(currentModule);
  document.getElementById('back-dash2').onclick = renderDashboard;
}

// ───────────────────────────────────────────── BOOT
(async function boot() {
  try {
    const data = await api('/api/auth/me');
    if (data.user) { ME = data.user; renderDashboard(); }
    else renderAuth();
  } catch (e) { renderAuth(); }
})();
