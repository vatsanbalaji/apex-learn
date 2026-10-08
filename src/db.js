'use strict';
// Apex Learn's own database. Deliberately separate from the research
// project's Firestore instance -- no shared data store, per product requirements.
const Database = require('better-sqlite3');
const path = require('path');
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'apex-learn.db'); // set DB_PATH to a persistent disk in production
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS organizations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cohorts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER REFERENCES organizations(id),
  name TEXT NOT NULL,
  join_code TEXT UNIQUE NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cohort_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cohort_id INTEGER REFERENCES cohorts(id),
  user_id INTEGER REFERENCES users(id),
  role TEXT DEFAULT 'student', -- 'student' | 'instructor'
  joined_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(cohort_id, user_id)
);

CREATE TABLE IF NOT EXISTS modules (
  id TEXT PRIMARY KEY,          -- slug, e.g. 'diversification'
  title TEXT NOT NULL,
  summary TEXT,
  sort_order INTEGER DEFAULT 0,
  status TEXT DEFAULT 'coming_soon' -- 'available' | 'coming_soon'
);

CREATE TABLE IF NOT EXISTS user_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  module_id TEXT REFERENCES modules(id),
  status TEXT DEFAULT 'not_started', -- not_started | in_progress | completed
  reflection_answers TEXT,            -- JSON
  started_at TEXT,
  completed_at TEXT,
  UNIQUE(user_id, module_id)
);

CREATE TABLE IF NOT EXISTS simulations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  module_id TEXT REFERENCES modules(id),
  result_json TEXT,           -- portfolio composition + outcome, no PII
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  event_type TEXT NOT NULL,   -- account_created | module_started | module_completed | simulation_started | simulation_completed | quiz_completed | user_returned
  payload TEXT,               -- JSON, small
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

// Seed the 6 MVP modules if not already present
const seedModules = db.prepare(`INSERT OR IGNORE INTO modules (id, title, summary, sort_order, status) VALUES (?, ?, ?, ?, ?)`);
const MODULES = [
  ['investing-basics', 'Investing Basics', 'What investing actually is, and the core vocabulary you need before anything else.', 1, 'coming_soon'],
  ['risk-and-return', 'Risk and Return', 'Why higher potential return almost always comes with higher potential loss.', 2, 'coming_soon'],
  ['diversification', 'Diversification', 'Spreading investments across assets instead of concentrating in one place.', 3, 'available'],
  ['market-volatility', 'Market Volatility', 'Why prices swing, and how to tell normal noise from a real trend.', 4, 'coming_soon'],
  ['behavioral-biases', 'Behavioral Biases', 'Loss aversion, overconfidence, anchoring, and herd behavior in real decisions.', 5, 'coming_soon'],
  ['long-term-investing', 'Long-Term Investing', 'Why time horizon changes what a "good" decision looks like.', 6, 'coming_soon'],
];
const seedTx = db.transaction((rows) => { for (const r of rows) seedModules.run(...r); });
seedTx(MODULES);

module.exports = db;
