'use strict';
// Minimal product-analytics logging. Deliberately avoids any sensitive
// personal/financial data -- just event type + small, non-identifying payloads.
const db = require('./db');
const insert = db.prepare('INSERT INTO events (user_id, event_type, payload) VALUES (?, ?, ?)');

function log(userId, eventType, payload) {
  try { insert.run(userId || null, eventType, payload ? JSON.stringify(payload) : null); }
  catch (e) { console.warn('[events] failed to log', eventType, e.message); }
}

module.exports = { log };
