'use strict';

const assert = require('node:assert/strict');
const { readFile, readdir } = require('node:fs/promises');
const path = require('node:path');
const { test } = require('node:test');
const { buildServer } = require('../index');
const { createPGlitePool } = require('../pglite-test-pool');

const migrationsDirectory = path.join(__dirname, '..', 'migrations');
const origin = 'http://slink.test';

async function testApp(t) {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  const migrations = (await readdir(migrationsDirectory)).filter((name) => name.endsWith('.sql')).sort();
  for (const migration of migrations) {
    await db.exec(await readFile(path.join(migrationsDirectory, migration), 'utf8'));
  }
  await db.exec(`
    CREATE ROLE slink_app NOLOGIN;
    GRANT USAGE ON SCHEMA public TO slink_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO slink_app;
  `);
  const pool = createPGlitePool(db);
  const app = await buildServer({ pool, logger: false, env: { NODE_ENV: 'test', PUBLIC_ORIGIN: origin } });
  t.after(() => app.close());
  return app;
}

function cookiesFrom(response) {
  const setCookies = Array.isArray(response.headers['set-cookie']) ? response.headers['set-cookie'] : [response.headers['set-cookie']];
  return Object.fromEntries(setCookies.map((value) => {
    const [pair] = value.split(';');
    const separator = pair.indexOf('=');
    return [pair.slice(0, separator), pair.slice(separator + 1)];
  }));
}

function cookieHeader(cookies) {
  return Object.entries(cookies).map(([name, value]) => `${name}=${value}`).join('; ');
}

async function registerAndLogin(app, { email, displayName, storeName }) {
  const registration = await app.inject({
    method: 'POST', url: '/api/auth/register', headers: { origin },
    payload: { email, displayName, storeName, password: 'correct horse battery staple 47' },
  });
  assert.equal(registration.statusCode, 201, registration.body);
  const verificationUrl = registration.json().developmentVerificationUrl;
  assert.ok(verificationUrl, 'development mode provides an email verification link');
  const token = new URLSearchParams(new URL(verificationUrl).hash.slice(1)).get('token');
  const verify = await app.inject({
    method: 'POST', url: '/api/auth/verify-email', headers: { origin }, payload: { token },
  });
  assert.equal(verify.statusCode, 200, verify.body);

  const login = await app.inject({
    method: 'POST', url: '/api/auth/login', headers: { origin },
    payload: { email, password: 'correct horse battery staple 47' },
  });
  assert.equal(login.statusCode, 200, login.body);
  return { cookies: cookiesFrom(login), user: login.json().user, store: login.json().stores[0] };
}

test('account verification, session security, and tenant-scoped product workflow', async (t) => {
  const app = await testApp(t);

  const pending = await app.inject({
    method: 'POST', url: '/api/auth/register', headers: { origin },
    payload: { email: 'owner@example.com', displayName: 'Chủ cửa hàng', storeName: 'Slink Test', password: 'correct horse battery staple 47' },
  });
  assert.equal(pending.statusCode, 201, pending.body);
  const unverifiedLogin = await app.inject({
    method: 'POST', url: '/api/auth/login', headers: { origin },
    payload: { email: 'owner@example.com', password: 'correct horse battery staple 47' },
  });
  assert.equal(unverifiedLogin.statusCode, 401);

  const first = await registerAndLogin(app, {
    email: 'owner2@example.com', displayName: 'Chủ cửa hàng', storeName: 'Slink Test 2',
  });
  assert.equal(first.store.role, 'owner');
  assert.match(first.cookies.slink_session, /^[A-Za-z0-9_-]{40,}$/);
  assert.match(first.cookies.slink_csrf, /^[A-Za-z0-9_-]{40,}$/);
  const headers = { cookie: cookieHeader(first.cookies) };

  const created = await app.inject({
    method: 'POST', url: `/api/stores/${first.store.id}/products`,
    headers: { ...headers, origin, 'x-csrf-token': first.cookies.slink_csrf },
    payload: { sku: 'CÀ-PHÊ-01', name: 'Cà phê rang xay', salePriceVnd: 85000, costVnd: 52000, lowStockThreshold: 2.5 },
  });
  assert.equal(created.statusCode, 200, created.body);
  const product = created.json().product;
  assert.equal(product.on_hand, '0');
  assert.equal(product.sale_price_vnd, '85000');

  const listed = await app.inject({ method: 'GET', url: `/api/stores/${first.store.id}/products?q=phê`, headers });
  assert.equal(listed.statusCode, 200, listed.body);
  assert.equal(listed.json().products.length, 1);
  assert.equal(listed.json().products[0].id, product.id);

  const duplicate = await app.inject({
    method: 'POST', url: `/api/stores/${first.store.id}/products`,
    headers: { ...headers, origin, 'x-csrf-token': first.cookies.slink_csrf },
    payload: { sku: 'cà-phê-01', name: 'Mã trùng', salePriceVnd: 0 },
  });
  assert.equal(duplicate.statusCode, 409, duplicate.body);

  const updated = await app.inject({
    method: 'PUT', url: `/api/stores/${first.store.id}/products/${product.id}`,
    headers: { ...headers, origin, 'x-csrf-token': first.cookies.slink_csrf },
    payload: { version: 1, salePriceVnd: 90000 },
  });
  assert.equal(updated.statusCode, 200, updated.body);
  assert.equal(updated.json().product.version, 2);
  const stale = await app.inject({
    method: 'PUT', url: `/api/stores/${first.store.id}/products/${product.id}`,
    headers: { ...headers, origin, 'x-csrf-token': first.cookies.slink_csrf },
    payload: { version: 1, salePriceVnd: 91000 },
  });
  assert.equal(stale.statusCode, 409);

  const second = await registerAndLogin(app, {
    email: 'owner3@example.com', displayName: 'Chủ khác', storeName: 'Cửa hàng khác',
  });
  const crossTenant = await app.inject({
    method: 'GET', url: `/api/stores/${first.store.id}/products`, headers: { cookie: cookieHeader(second.cookies) },
  });
  assert.equal(crossTenant.statusCode, 403);

  const badCsrf = await app.inject({
    method: 'POST', url: `/api/stores/${first.store.id}/products`,
    headers: { ...headers, origin, 'x-csrf-token': 'wrong-token' },
    payload: { sku: 'X', name: 'Sai', salePriceVnd: 10 },
  });
  assert.equal(badCsrf.statusCode, 403);

  const logout = await app.inject({
    method: 'POST', url: '/api/auth/logout', headers: { ...headers, origin, 'x-csrf-token': first.cookies.slink_csrf },
  });
  assert.equal(logout.statusCode, 200, logout.body);
  const afterLogout = await app.inject({ method: 'GET', url: '/api/auth/me', headers });
  assert.equal(afterLogout.statusCode, 401);
});
