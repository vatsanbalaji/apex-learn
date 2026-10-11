'use strict';
// Apex Learn — financial literacy education platform.
// Derived from the Apex Markets research platform's trading/market-data
// engine, but this is a SEPARATE codebase and a SEPARATE database.
// No research consent flow, no experimental group assignment, no IRB
// language, no participant surveys -- those stay in the research repo.
const express = require('express');
const session = require('express-session');
const compression = require('compression');
const path = require('path');

const db = require('./src/db');
const { createUser, verifyUser, requireAuth } = require('./src/auth');
const { getPrices, getTickers } = require('./src/market-data');
const events = require('./src/events');
const SqliteStore = require('./src/session-store');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
let googleClient = null;
if (GOOGLE_CLIENT_ID) { const { OAuth2Client } = require('google-auth-library'); googleClient = new OAuth2Client(GOOGLE_CLIENT_ID); }

const app = express();
const PORT = parseInt(process.env.PORT || '8081');

const IS_PROD = process.env.NODE_ENV === 'production';
if (IS_PROD) app.set('trust proxy', 1); // behind Render's proxy so secure cookies work
app.use(compression());
app.use(express.json({ limit: '256kb' }));
app.use(session({
  store: new SqliteStore(),
  secret: (() => { if (IS_PROD && !process.env.SESSION_SECRET) { console.error('SESSION_SECRET must be set in production'); process.exit(1); } return process.env.SESSION_SECRET || 'dev-only-secret-change-me'; })(),
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 30, httpOnly: true, sameSite: 'lax', secure: IS_PROD }, // 30 days
}));
app.use(express.static(path.join(__dirname, 'public')));

// ─────────────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────────────
app.post('/api/auth/signup', (req, res) => {
  const { email, password, displayName } = req.body || {};
  if (!email || !password || password.length < 8) {
    return res.status(400).json({ error: 'Email and an 8+ character password are required.' });
  }
  try {
    const userId = createUser(email, password, displayName);
    req.session.userId = userId;
    events.log(userId, 'account_created', {});
    res.json({ ok: true, user: { id: userId, email, displayName: displayName || null } });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: 'An account with that email already exists.' });
    console.error('[signup]', e); res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = verifyUser(email || '', password || '');
  if (!user) return res.status(401).json({ error: 'Invalid email or password.' });
  req.session.userId = user.id;
  events.log(user.id, 'user_returned', {});
  res.json({ ok: true, user: { id: user.id, email: user.email, displayName: user.display_name } });
});

app.post('/api/auth/logout', (req, res) => { req.session.destroy(() => res.json({ ok: true })); });

app.get('/api/auth/me', (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  const user = db.prepare('SELECT id, email, display_name, is_guest FROM users WHERE id = ?').get(req.session.userId);
  res.json({ user: user ? { id: user.id, email: user.is_guest ? null : user.email, displayName: user.display_name, guest: !!user.is_guest } : null });
});

// ─────────────────────────────────────────────────────────────────────────
// MODULES + DASHBOARD
// ─────────────────────────────────────────────────────────────────────────
app.get('/api/modules', requireAuth, (req, res) => {
  const modules = db.prepare('SELECT * FROM modules ORDER BY sort_order').all();
  const progress = db.prepare('SELECT module_id, status FROM user_progress WHERE user_id = ?').all(req.session.userId);
  const progressMap = Object.fromEntries(progress.map(p => [p.module_id, p.status]));
  res.json(modules.map(m => ({ ...m, userStatus: progressMap[m.id] || 'not_started' })));
});

app.get('/api/dashboard', requireAuth, (req, res) => {
  const userId = req.session.userId;
  const modules = db.prepare('SELECT * FROM modules ORDER BY sort_order').all();
  const progress = db.prepare('SELECT module_id, status FROM user_progress WHERE user_id = ?').all(userId);
  const progressMap = Object.fromEntries(progress.map(p => [p.module_id, p.status]));
  const completedCount = progress.filter(p => p.status === 'completed').length;
  const simCount = db.prepare('SELECT COUNT(*) c FROM simulations WHERE user_id = ?').get(userId).c;
  res.json({
    modules: modules.map(m => ({ id: m.id, title: m.title, summary: m.summary, status: m.status, userStatus: progressMap[m.id] || 'not_started' })),
    modulesCompleted: completedCount,
    modulesTotal: modules.length,
    simulationsCompleted: simCount,
  });
});

app.post('/api/modules/:id/start', requireAuth, (req, res) => {
  const moduleId = req.params.id;
  const mod = db.prepare('SELECT * FROM modules WHERE id = ?').get(moduleId);
  if (!mod) return res.status(404).json({ error: 'Module not found' });
  if (mod.status !== 'available') return res.status(400).json({ error: 'This module is not available yet.' });
  const existing = db.prepare('SELECT * FROM user_progress WHERE user_id = ? AND module_id = ?').get(req.session.userId, moduleId);
  if (!existing) {
    db.prepare('INSERT INTO user_progress (user_id, module_id, status, started_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)').run(req.session.userId, moduleId, 'in_progress');
  } else if (existing.status === 'not_started') {
    db.prepare('UPDATE user_progress SET status = ?, started_at = CURRENT_TIMESTAMP WHERE id = ?').run('in_progress', existing.id);
  }
  events.log(req.session.userId, 'module_started', { moduleId });
  res.json({ ok: true });
});

app.post('/api/modules/:id/reflect', requireAuth, (req, res) => {
  const moduleId = req.params.id;
  const { answers } = req.body || {};
  const existing = db.prepare('SELECT * FROM user_progress WHERE user_id = ? AND module_id = ?').get(req.session.userId, moduleId);
  if (!existing) return res.status(400).json({ error: 'Start the module first.' });
  db.prepare('UPDATE user_progress SET status = ?, reflection_answers = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run('completed', JSON.stringify(answers || {}), existing.id);
  events.log(req.session.userId, 'quiz_completed', { moduleId });
  events.log(req.session.userId, 'module_completed', { moduleId });
  res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────────────
// MARKET DATA (reused logic from the research platform, trimmed universe)
// ─────────────────────────────────────────────────────────────────────────
app.get('/api/prices', requireAuth, (req, res) => {
  res.json({ prices: getPrices(), tickers: getTickers() });
});

// ─────────────────────────────────────────────────────────────────────────
// SIMULATIONS: the client engine runs each module's (deterministic,
// labeled-illustrative) simulation; the server records a small summary.
// ─────────────────────────────────────────────────────────────────────────
app.post('/api/simulations', requireAuth, (req, res) => {
  const { moduleId, result, started } = req.body || {};
  const mod = db.prepare('SELECT id FROM modules WHERE id = ?').get(moduleId);
  if (!mod) return res.status(404).json({ error: 'Module not found' });
  if (started) { events.log(req.session.userId, 'simulation_started', { moduleId }); return res.json({ ok: true }); }
  const json = JSON.stringify(result || {});
  if (json.length > 4096) return res.status(413).json({ error: 'Result too large' });
  db.prepare('INSERT INTO simulations (user_id, module_id, result_json) VALUES (?, ?, ?)').run(req.session.userId, moduleId, json);
  events.log(req.session.userId, 'simulation_completed', { moduleId });
  res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────────────
// GOOGLE SIGN-IN + GUEST MODE
// ─────────────────────────────────────────────────────────────────────────
app.get('/api/config', (req, res) => res.json({ googleClientId: GOOGLE_CLIENT_ID || null }));

app.post('/api/auth/google', async (req, res) => {
  if (!googleClient) return res.status(503).json({ error: 'Google sign-in is not configured.' });
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: String((req.body || {}).credential || ''), audience: GOOGLE_CLIENT_ID });
    const p = ticket.getPayload();
    if (!p || !p.sub || !p.email_verified) return res.status(401).json({ error: 'Google account not verified.' });
    let user = db.prepare('SELECT * FROM users WHERE google_sub = ?').get(p.sub);
    if (!user) {
      user = db.prepare('SELECT * FROM users WHERE email = ?').get(p.email.toLowerCase());
      if (user) db.prepare('UPDATE users SET google_sub = ? WHERE id = ?').run(p.sub, user.id);
      else {
        const hash = bcrypt.hashSync(crypto.randomBytes(24).toString('hex'), 8);
        const info = db.prepare('INSERT INTO users (email, password_hash, display_name, google_sub) VALUES (?, ?, ?, ?)').run(p.email.toLowerCase(), hash, p.given_name || p.name || null, p.sub);
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
        events.log(user.id, 'account_created', { via: 'google' });
      }
    }
    req.session.userId = user.id;
    events.log(user.id, 'user_returned', { via: 'google' });
    res.json({ ok: true, user: { id: user.id, email: user.email, displayName: user.display_name } });
  } catch (e) { console.warn('[google auth]', e.message); res.status(401).json({ error: 'Google sign-in failed.' }); }
});

app.post('/api/auth/guest', (req, res) => {
  const tag = crypto.randomBytes(6).toString('hex');
  const hash = bcrypt.hashSync(crypto.randomBytes(24).toString('hex'), 8);
  const info = db.prepare('INSERT INTO users (email, password_hash, display_name, is_guest) VALUES (?, ?, ?, 1)').run(`guest-${tag}@guest.local`, hash, 'Guest');
  req.session.userId = info.lastInsertRowid;
  events.log(info.lastInsertRowid, 'account_created', { via: 'guest' });
  res.json({ ok: true, user: { id: info.lastInsertRowid, email: null, displayName: 'Guest' } });
});

// ─────────────────────────────────────────────────────────────────────────
// COHORT ARCHITECTURE (minimal, for future nonprofit/instructor integration)
// ─────────────────────────────────────────────────────────────────────────
app.post('/api/cohorts/join', requireAuth, (req, res) => {
  const { joinCode } = req.body || {};
  const cohort = db.prepare('SELECT * FROM cohorts WHERE join_code = ?').get(String(joinCode || '').trim().toUpperCase());
  if (!cohort) return res.status(404).json({ error: 'Invalid join code' });
  db.prepare('INSERT OR IGNORE INTO cohort_members (cohort_id, user_id, role) VALUES (?, ?, ?)').run(cohort.id, req.session.userId, 'student');
  res.json({ ok: true, cohort: { id: cohort.id, name: cohort.name } });
});

// Minimal instructor aggregate view -- architecture placeholder for the
// nonprofit/instructor dashboard described in the product brief.
app.get('/api/cohorts/:id/report', requireAuth, (req, res) => {
  const cohortId = req.params.id;
  const isInstructor = db.prepare('SELECT 1 FROM cohort_members WHERE cohort_id = ? AND user_id = ? AND role = ?').get(cohortId, req.session.userId, 'instructor');
  if (!isInstructor) return res.status(403).json({ error: 'Instructor access only' });
  const students = db.prepare('SELECT COUNT(*) c FROM cohort_members WHERE cohort_id = ? AND role = ?').get(cohortId, 'student').c;
  const memberIds = db.prepare('SELECT user_id FROM cohort_members WHERE cohort_id = ? AND role = ?').all(cohortId, 'student').map(r => r.user_id);
  let completions = {};
  if (memberIds.length) {
    const placeholders = memberIds.map(() => '?').join(',');
    const rows = db.prepare(`SELECT module_id, COUNT(*) c FROM user_progress WHERE status='completed' AND user_id IN (${placeholders}) GROUP BY module_id`).all(...memberIds);
    completions = Object.fromEntries(rows.map(r => [r.module_id, r.c]));
  }
  res.json({ students, completionsByModule: completions });
});

app.get('/api/health', (req, res) => res.json({ ok: true, product: 'apex-learn', uptime: Math.round(process.uptime()) }));

app.listen(PORT, () => {
  console.log(`Apex Learn server on port ${PORT}`);
  console.log('  This is the EDUCATION product -- separate codebase, separate database from the Apex research platform.');
});
