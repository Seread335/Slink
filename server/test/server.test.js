const assert = require('node:assert/strict');
const { test } = require('node:test');
const { buildServer } = require('../index');

test('server exposes the app shell and health routes without exposing source files', async (t) => {
  const pool = { query: async () => ({ rows: [{ '?column?': 1 }] }), end: async () => {} };
  const app = await buildServer({ pool, logger: false, env: {} });
  t.after(() => app.close());

  const health = await app.inject({ method: 'GET', url: '/api/health' });
  assert.equal(health.statusCode, 200);
  assert.deepEqual(health.json(), { status: 'ok' });

  const ready = await app.inject({ method: 'GET', url: '/api/ready' });
  assert.equal(ready.statusCode, 200);
  assert.deepEqual(ready.json(), { status: 'ready' });

  const html = await app.inject({ method: 'GET', url: '/' });
  assert.equal(html.statusCode, 200);
  assert.match(html.headers['content-type'], /text\/html/);
  assert.equal(html.headers['cache-control'], 'no-cache');
  assert.match(html.body, /Slink/);
  assert.match(html.headers['content-security-policy'], /default-src 'self'/);

  const privateFile = await app.inject({ method: 'GET', url: '/server/db.js' });
  assert.equal(privateFile.statusCode, 404);
  const missingApi = await app.inject({ method: 'GET', url: '/api/not-implemented' });
  assert.equal(missingApi.statusCode, 404);
  assert.equal(missingApi.json().error.code, 'not_found');
});

test('readiness fails closed if the database is not reachable', async (t) => {
  const pool = { query: async () => { throw new Error('connection unavailable'); }, end: async () => {} };
  const app = await buildServer({ pool, logger: false, env: {} });
  t.after(() => app.close());

  const response = await app.inject({ method: 'GET', url: '/api/ready' });
  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.json(), { status: 'unavailable' });
});
