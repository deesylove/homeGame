const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'homegame.db');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

let db;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    chip_balance INTEGER NOT NULL DEFAULT 1000,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS hand_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_id TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    players_json TEXT NOT NULL,
    result_json TEXT NOT NULL
  );
`;

// Persist DB to disk after writes
function save() {
  try {
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  } catch (e) {
    console.error('DB save error:', e);
  }
}

// Thin wrapper: run a query that returns rows
function query(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

// Run a statement that doesn't return rows, return lastInsertRowid & changes
function run(sql, params = []) {
  db.run(sql, params);
  return {
    lastInsertRowid: db.exec('SELECT last_insert_rowid()')[0]?.values[0][0],
    changes: db.getRowsModified(),
  };
}

function get(sql, params = []) {
  return query(sql, params)[0] || null;
}

async function init() {
  const SQL = await initSqlJs();
  if (fs.existsSync(dbPath)) {
    db = new SQL.Database(fs.readFileSync(dbPath));
  } else {
    db = new SQL.Database();
  }
  db.run(SCHEMA);
  save();
  return module.exports;
}

module.exports = {
  init,
  save,
  getUserByUsername: (username) => get('SELECT * FROM users WHERE username = ?', [username]),
  getUserById: (id) => get('SELECT * FROM users WHERE id = ?', [id]),
  createUser: (username, hash) => {
    const r = run('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, hash]);
    save();
    return r;
  },
  updateChips: (chips, id) => { run('UPDATE users SET chip_balance = ? WHERE id = ?', [chips, id]); save(); },
  adjustChips: (amount, id) => { run('UPDATE users SET chip_balance = chip_balance + ? WHERE id = ?', [amount, id]); save(); },
  saveHandHistory: (tableId, playersJson, resultJson) => {
    run('INSERT INTO hand_history (table_id, players_json, result_json) VALUES (?, ?, ?)', [tableId, playersJson, resultJson]);
    save();
  },
  getAllUsers: () => query('SELECT id, username, chip_balance FROM users ORDER BY chip_balance DESC'),
};
