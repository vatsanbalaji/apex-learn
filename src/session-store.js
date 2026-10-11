'use strict';
// Tiny SQLite-backed express-session store so logins survive restarts
// (as long as the SQLite file itself is on persistent disk).
const session = require('express-session');
const db = require('./db');
class SqliteStore extends session.Store {
  get(sid, cb) {
    try { const r = db.prepare('SELECT sess, expires FROM sessions_store WHERE sid = ?').get(sid);
      if (!r || r.expires < Date.now()) return cb(null, null); cb(null, JSON.parse(r.sess)); } catch (e) { cb(e); }
  }
  set(sid, sess, cb) {
    try { const exp = sess.cookie && sess.cookie.expires ? new Date(sess.cookie.expires).getTime() : Date.now() + 86400000;
      db.prepare('INSERT INTO sessions_store (sid, sess, expires) VALUES (?, ?, ?) ON CONFLICT(sid) DO UPDATE SET sess=excluded.sess, expires=excluded.expires').run(sid, JSON.stringify(sess), exp); cb && cb(null); } catch (e) { cb && cb(e); }
  }
  destroy(sid, cb) { try { db.prepare('DELETE FROM sessions_store WHERE sid = ?').run(sid); cb && cb(null); } catch (e) { cb && cb(e); } }
  touch(sid, sess, cb) { this.set(sid, sess, cb); }
}
setInterval(() => { try { db.prepare('DELETE FROM sessions_store WHERE expires < ?').run(Date.now()); } catch (e) {} }, 3600000).unref();
module.exports = SqliteStore;
