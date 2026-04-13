const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');
const session = require('express-session');

// We test auth routes in isolation with an in-memory DB setup
let app, server, baseUrl;
// Use a unique suffix per test run so re-runs don't collide with persisted data
const RUN = Date.now().toString(36);

before(async () => {
  const db = require('../server/db');
  await db.init();

  const authRouter = require('../server/auth');
  app = express();
  app.use(express.json());
  app.use(session({ secret: 'test', resave: false, saveUninitialized: false }));
  app.use('/api/auth', authRouter);

  server = http.createServer(app);
  await new Promise(r => server.listen(0, r));
  baseUrl = `http://localhost:${server.address().port}`;
});

after(() => {
  server.close();
});

async function post(path, body, cookie = '') {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json, headers: res.headers };
}

async function get(path, cookie = '') {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: cookie ? { Cookie: cookie } : {},
  });
  return { status: res.status, body: await res.json(), headers: res.headers };
}

function getCookie(headers) {
  return headers.get('set-cookie') || '';
}

describe('Auth — register', () => {
  test('registers a new user', async () => {
    const username = `reg1_${RUN}`;
    const r = await post('/api/auth/register', { username, password: 'pass1' });
    assert.equal(r.status, 200);
    assert.ok(r.body.id);
    assert.equal(r.body.username, username);
    assert.equal(r.body.chips, 1000);
  });

  test('rejects duplicate username', async () => {
    const username = `dup_${RUN}`;
    await post('/api/auth/register', { username, password: 'pass1' });
    const r = await post('/api/auth/register', { username, password: 'pass2' });
    assert.equal(r.status, 409);
    assert.ok(r.body.error);
  });

  test('rejects short username', async () => {
    const r = await post('/api/auth/register', { username: 'x', password: 'pass1' });
    assert.equal(r.status, 400);
  });

  test('rejects short password', async () => {
    const r = await post('/api/auth/register', { username: 'validname', password: '12' });
    assert.equal(r.status, 400);
  });

  test('rejects missing fields', async () => {
    const r = await post('/api/auth/register', { username: 'somebody' });
    assert.equal(r.status, 400);
  });
});

describe('Auth — login', () => {
  before(async () => {
    await post('/api/auth/register', { username: `login_${RUN}`, password: 'mypassword' });
  });

  test('logs in with correct credentials', async () => {
    const r = await post('/api/auth/login', { username: `login_${RUN}`, password: 'mypassword' });
    assert.equal(r.status, 200);
    assert.equal(r.body.username, `login_${RUN}`);
  });

  test('rejects wrong password', async () => {
    const r = await post('/api/auth/login', { username: `login_${RUN}`, password: 'wrongpass' });
    assert.equal(r.status, 401);
  });

  test('rejects non-existent user', async () => {
    const r = await post('/api/auth/login', { username: 'nobody_xyz', password: 'pass' });
    assert.equal(r.status, 401);
  });
});

describe('Auth — session (/me)', () => {
  test('/me returns 401 when not logged in', async () => {
    const r = await get('/api/auth/me');
    assert.equal(r.status, 401);
  });

  test('/me returns user after login', async () => {
    const username = `sess_${RUN}`;
    await post('/api/auth/register', { username, password: 'testpass' });
    const loginRes = await post('/api/auth/login', { username, password: 'testpass' });
    const cookie = getCookie(loginRes.headers);

    const r = await get('/api/auth/me', cookie);
    assert.equal(r.status, 200);
    assert.equal(r.body.username, username);
  });
});

describe('Auth — leaderboard', () => {
  test('returns array of users', async () => {
    const r = await get('/api/auth/leaderboard');
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.body));
    assert.ok(r.body.length > 0);
    assert.ok('username' in r.body[0]);
    assert.ok('chip_balance' in r.body[0]);
  });
});
