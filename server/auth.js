const express = require('express');
const bcrypt = require('bcrypt');
const db = require('./db');

const router = express.Router();
const SALT_ROUNDS = 10;

router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  if (username.length < 2 || username.length > 20) return res.status(400).json({ error: 'Username must be 2-20 characters' });
  if (password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });

  try {
    const existing = db.getUserByUsername(username);
    if (existing) return res.status(409).json({ error: 'Username already taken' });

    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = db.createUser(username, hash);
    const user = db.getUserById(result.lastInsertRowid);

    req.session.userId = user.id;
    req.session.username = user.username;
    res.json({ id: user.id, username: user.username, chips: user.chip_balance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  try {
    const user = db.getUserByUsername(username);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    req.session.userId = user.id;
    req.session.username = user.username;
    res.json({ id: user.id, username: user.username, chips: user.chip_balance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
  const user = db.getUserById(req.session.userId);
  if (!user) return res.status(401).json({ error: 'User not found' });
  res.json({ id: user.id, username: user.username, chips: user.chip_balance });
});

router.post('/admin/adjust-chips', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
  const { userId, amount } = req.body;
  db.adjustChips(amount, userId);
  res.json({ ok: true });
});

router.get('/leaderboard', (req, res) => {
  res.json(db.getAllUsers());
});

module.exports = router;
