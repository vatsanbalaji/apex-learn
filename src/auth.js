'use strict';
const bcrypt = require('bcryptjs');
const db = require('./db');

function createUser(email, password, displayName) {
  const hash = bcrypt.hashSync(password, 10);
  const stmt = db.prepare('INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)');
  const info = stmt.run(email.toLowerCase().trim(), hash, displayName || null);
  return info.lastInsertRowid;
}

function verifyUser(email, password) {
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (!user) return null;
  if (!bcrypt.compareSync(password, user.password_hash)) return null;
  return user;
}

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) return res.status(401).json({ error: 'Not signed in' });
  next();
}

module.exports = { createUser, verifyUser, requireAuth };
