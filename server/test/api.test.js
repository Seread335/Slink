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

async function inviteAndLogin(app, { storeId, ownerHeaders, email, role }) {
  const invitation = await app.inject({
    method: 'POST', url: `/api/stores/${storeId}/staff/invitations`,
    headers: ownerHeaders, payload: { email, role },
  });
  assert.equal(invitation.statusCode, 201, invitation.body);
  const inviteUrl = invitation.json().developmentInviteUrl;
  assert.ok(inviteUrl, 'test mode exposes an invite link without sending external email');
  const inviteToken = new URLSearchParams(new URL(inviteUrl).hash.slice(1)).get('invite');
  assert.ok(inviteToken);

  const password = 'staff-password-for-test-47';
  const registration = await app.inject({
    method: 'POST', url: `/api/invitations/${inviteToken}/register`, headers: { origin },
    payload: { displayName: `${role} kiểm tra`, password },
  });
  assert.equal(registration.statusCode, 201, registration.body);
  const verificationUrl = registration.json().developmentVerificationUrl;
  assert.ok(verificationUrl, 'test mode exposes a verification link without sending external email');
  const verificationToken = new URLSearchParams(new URL(verificationUrl).hash.slice(1)).get('token');
  const verified = await app.inject({
    method: 'POST', url: '/api/auth/verify-email', headers: { origin }, payload: { token: verificationToken },
  });
  assert.equal(verified.statusCode, 200, verified.body);

  const login = await app.inject({
    method: 'POST', url: '/api/auth/login', headers: { origin }, payload: { email, password },
  });
  assert.equal(login.statusCode, 200, login.body);
  const store = login.json().stores.find((item) => item.id === storeId);
  assert.equal(store?.role, role);
  const cookies = cookiesFrom(login);
  return {
    cookies,
    store,
    headers: { cookie: cookieHeader(cookies), origin, 'x-csrf-token': cookies.slink_csrf },
  };
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

test('cash outflow cannot exceed the drawer balance and a rejected request can be retried safely', async (t) => {
  const app = await testApp(t);
  const owner = await registerAndLogin(app, {
    email: 'cash-owner@example.com', displayName: 'Chủ cửa hàng', storeName: 'Cửa hàng quỹ tiền mặt',
  });
  const storeId = owner.store.id;
  const headers = {
    cookie: cookieHeader(owner.cookies),
    origin,
    'x-csrf-token': owner.cookies.slink_csrf,
  };

  const opened = await app.inject({
    method: 'POST', url: `/api/stores/${storeId}/cash-register/open`,
    headers: { ...headers, 'idempotency-key': 'cash-session-open-0001' },
    payload: { openingFloatVnd: '10000' },
  });
  assert.equal(opened.statusCode, 201, opened.body);
  const sessionId = opened.json().session.id;

  const outflow = {
    direction: 'out',
    amountVnd: '10001',
    method: 'cash',
    category: 'Chi phí vận hành',
    note: 'Khoản chi cần được quỹ hỗ trợ',
  };
  const outflowHeaders = { ...headers, 'idempotency-key': 'cash-manual-out-0001' };
  const rejected = await app.inject({
    method: 'POST', url: `/api/stores/${storeId}/cash-movements`,
    headers: outflowHeaders, payload: outflow,
  });
  assert.equal(rejected.statusCode, 409, rejected.body);
  assert.equal(rejected.json().error.code, 'cash_balance_insufficient');

  const afterRejection = await app.inject({ method: 'GET', url: `/api/stores/${storeId}/cash-register`, headers });
  assert.equal(afterRejection.statusCode, 200, afterRejection.body);
  assert.equal(afterRejection.json().session.id, sessionId);
  assert.equal(afterRejection.json().session.cashOutVnd, '0');
  assert.equal(afterRejection.json().session.expectedCashVnd, '10000');

  const inflow = await app.inject({
    method: 'POST', url: `/api/stores/${storeId}/cash-movements`,
    headers: { ...headers, 'idempotency-key': 'cash-manual-in-0001' },
    payload: {
      direction: 'in', amountVnd: '1', method: 'cash', category: 'Bổ sung quỹ', note: 'Tiền quỹ được bổ sung',
    },
  });
  assert.equal(inflow.statusCode, 201, inflow.body);

  const accepted = await app.inject({
    method: 'POST', url: `/api/stores/${storeId}/cash-movements`,
    headers: outflowHeaders, payload: outflow,
  });
  assert.equal(accepted.statusCode, 201, accepted.body);

  const replay = await app.inject({
    method: 'POST', url: `/api/stores/${storeId}/cash-movements`,
    headers: outflowHeaders, payload: outflow,
  });
  assert.equal(replay.statusCode, 201, replay.body);
  assert.equal(replay.headers['idempotent-replayed'], 'true');
  assert.equal(replay.json().movement.id, accepted.json().movement.id);

  const finalState = await app.inject({ method: 'GET', url: `/api/stores/${storeId}/cash-register`, headers });
  assert.equal(finalState.statusCode, 200, finalState.body);
  assert.equal(finalState.json().session.cashInVnd, '1');
  assert.equal(finalState.json().session.cashOutVnd, '10001');
  assert.equal(finalState.json().session.expectedCashVnd, '0');
});

test('supplier payments, cash purchases, and return refunds preserve ledgers when the drawer is short', async (t) => {
  const app = await testApp(t);
  const owner = await registerAndLogin(app, {
    email: 'cash-workflows@example.com', displayName: 'Chủ cửa hàng', storeName: 'Cửa hàng kiểm tra giao dịch tiền mặt',
  });
  const storeId = owner.store.id;
  const headers = {
    cookie: cookieHeader(owner.cookies),
    origin,
    'x-csrf-token': owner.cookies.slink_csrf,
  };

  const supplierResponse = await app.inject({
    method: 'POST', url: `/api/stores/${storeId}/suppliers`,
    headers: { ...headers, 'idempotency-key': 'cash-supplier-create-001' },
    payload: { name: 'Nhà cung cấp kiểm tra', openingPayableVnd: '1' },
  });
  assert.equal(supplierResponse.statusCode, 201, supplierResponse.body);
  const supplierId = supplierResponse.json().supplier.id;

  const productImport = await app.inject({
    method: 'POST', url: `/api/stores/${storeId}/products/import`,
    headers: { ...headers, 'idempotency-key': 'cash-product-import-0001' },
    payload: { items: [{ sku: 'CASH-TEST-1', name: 'Sản phẩm kiểm tra quỹ', salePriceVnd: 1, costVnd: 0, openingQuantity: '1' }] },
  });
  assert.equal(productImport.statusCode, 201, productImport.body);
  const productId = productImport.json().products[0].id;

  const opened = await app.inject({
    method: 'POST', url: `/api/stores/${storeId}/cash-register/open`,
    headers: { ...headers, 'idempotency-key': 'cash-session-open-0002' },
    payload: { openingFloatVnd: '0' },
  });
  assert.equal(opened.statusCode, 201, opened.body);

  const supplierPayment = {
    amountVnd: '1', method: 'cash', note: 'Thanh toán thử',
  };
  const supplierPaymentHeaders = { ...headers, 'idempotency-key': 'cash-supplier-payment-01' };
  const rejectedSupplierPayment = await app.inject({
    method: 'POST', url: `/api/stores/${storeId}/suppliers/${supplierId}/payments`,
    headers: supplierPaymentHeaders, payload: supplierPayment,
  });
  assert.equal(rejectedSupplierPayment.statusCode, 409, rejectedSupplierPayment.body);
  assert.equal(rejectedSupplierPayment.json().error.code, 'cash_balance_insufficient');

  const openedAfterReject = await app.inject({ method: 'GET', url: `/api/stores/${storeId}/cash-register`, headers });
  assert.equal(openedAfterReject.json().session.expectedCashVnd, '0');
  const supplierBeforeRetry = await app.inject({ method: 'GET', url: `/api/stores/${storeId}/finance`, headers });
  assert.equal(supplierBeforeRetry.json().suppliers.find((item) => item.id === supplierId).balance_vnd, '1');

  const supplierPaymentCashIn = await app.inject({
    method: 'POST', url: `/api/stores/${storeId}/cash-movements`,
    headers: { ...headers, 'idempotency-key': 'cash-supplier-inflow-001' },
    payload: { direction: 'in', amountVnd: '1', method: 'cash', category: 'Bổ sung quỹ', note: 'Nạp quỹ' },
  });
  assert.equal(supplierPaymentCashIn.statusCode, 201, supplierPaymentCashIn.body);
  const acceptedSupplierPayment = await app.inject({
    method: 'POST', url: `/api/stores/${storeId}/suppliers/${supplierId}/payments`,
    headers: supplierPaymentHeaders, payload: supplierPayment,
  });
  assert.equal(acceptedSupplierPayment.statusCode, 201, acceptedSupplierPayment.body);
  const supplierAfterRetry = await app.inject({ method: 'GET', url: `/api/stores/${storeId}/finance`, headers });
  assert.equal(supplierAfterRetry.json().suppliers.find((item) => item.id === supplierId).balance_vnd, '0');

  const purchase = {
    productId, quantity: '1', unitCostVnd: '1', amountPaidVnd: '1', method: 'cash',
  };
  const purchaseHeaders = { ...headers, 'idempotency-key': 'cash-paid-purchase-001' };
  const rejectedPurchase = await app.inject({
    method: 'POST', url: `/api/stores/${storeId}/purchases`, headers: purchaseHeaders, payload: purchase,
  });
  assert.equal(rejectedPurchase.statusCode, 409, rejectedPurchase.body);
  assert.equal(rejectedPurchase.json().error.code, 'cash_balance_insufficient');
  const productBeforeRetry = await app.inject({ method: 'GET', url: `/api/stores/${storeId}/products`, headers });
  assert.equal(productBeforeRetry.json().products.find((item) => item.id === productId).on_hand, '1.000');
  const purchasesBeforeRetry = await app.inject({ method: 'GET', url: `/api/stores/${storeId}/finance`, headers });
  assert.equal(purchasesBeforeRetry.json().purchases.length, 0);

  const purchaseCashIn = await app.inject({
    method: 'POST', url: `/api/stores/${storeId}/cash-movements`,
    headers: { ...headers, 'idempotency-key': 'cash-purchase-inflow-001' },
    payload: { direction: 'in', amountVnd: '1', method: 'cash', category: 'Bổ sung quỹ', note: 'Nạp quỹ' },
  });
  assert.equal(purchaseCashIn.statusCode, 201, purchaseCashIn.body);
  const acceptedPurchase = await app.inject({
    method: 'POST', url: `/api/stores/${storeId}/purchases`, headers: purchaseHeaders, payload: purchase,
  });
  assert.equal(acceptedPurchase.statusCode, 201, acceptedPurchase.body);

  const sale = await app.inject({
    method: 'POST', url: `/api/stores/${storeId}/sales`,
    headers: { ...headers, 'idempotency-key': 'cash-return-sale-0001' },
    payload: { items: [{ productId, quantity: 1 }], amountReceivedVnd: '1', method: 'cash' },
  });
  assert.equal(sale.statusCode, 201, sale.body);
  const orderId = sale.json().order.id;
  const orderDetails = await app.inject({ method: 'GET', url: `/api/stores/${storeId}/orders/${orderId}`, headers });
  const orderLineId = orderDetails.json().order.items[0].id;

  const emptyTheDrawer = await app.inject({
    method: 'POST', url: `/api/stores/${storeId}/cash-movements`,
    headers: { ...headers, 'idempotency-key': 'cash-drain-before-return' },
    payload: { direction: 'out', amountVnd: '1', method: 'cash', category: 'Chi phí vận hành', note: 'Chi hết tiền lẻ' },
  });
  assert.equal(emptyTheDrawer.statusCode, 201, emptyTheDrawer.body);

  const returnPayload = {
    items: [{ orderLineId, quantity: 1 }],
    reason: 'Khách trả sản phẩm', refundMethod: 'cash', restockPolicy: 'restock',
  };
  const returnHeaders = { ...headers, 'idempotency-key': 'cash-return-refund-001' };
  const rejectedRefund = await app.inject({
    method: 'POST', url: `/api/stores/${storeId}/orders/${orderId}/returns`,
    headers: returnHeaders, payload: returnPayload,
  });
  assert.equal(rejectedRefund.statusCode, 409, rejectedRefund.body);
  assert.equal(rejectedRefund.json().error.code, 'cash_balance_insufficient');

  const stateAfterRefundReject = await app.inject({ method: 'GET', url: `/api/stores/${storeId}/orders/${orderId}`, headers });
  assert.equal(stateAfterRefundReject.json().order.status, 'completed');
  assert.equal(stateAfterRefundReject.json().order.items[0].returned_quantity, '0');
  const stockAfterRefundReject = await app.inject({ method: 'GET', url: `/api/stores/${storeId}/products`, headers });
  assert.equal(stockAfterRefundReject.json().products.find((item) => item.id === productId).on_hand, '1.000');

  const refundCashIn = await app.inject({
    method: 'POST', url: `/api/stores/${storeId}/cash-movements`,
    headers: { ...headers, 'idempotency-key': 'cash-refund-inflow-001' },
    payload: { direction: 'in', amountVnd: '1', method: 'cash', category: 'Bổ sung quỹ', note: 'Nạp quỹ' },
  });
  assert.equal(refundCashIn.statusCode, 201, refundCashIn.body);
  const acceptedRefund = await app.inject({
    method: 'POST', url: `/api/stores/${storeId}/orders/${orderId}/returns`,
    headers: returnHeaders, payload: returnPayload,
  });
  assert.equal(acceptedRefund.statusCode, 201, acceptedRefund.body);
  const returnedOrder = await app.inject({ method: 'GET', url: `/api/stores/${storeId}/orders/${orderId}`, headers });
  assert.equal(returnedOrder.json().order.status, 'returned');
  assert.equal(returnedOrder.json().order.items[0].returned_quantity, '1.000');
  const finalRegister = await app.inject({ method: 'GET', url: `/api/stores/${storeId}/cash-register`, headers });
  assert.equal(finalRegister.json().session.expectedCashVnd, '0');
});

test('cashier finance access is limited to the active shift and cannot change owner-only cash records', async (t) => {
  const app = await testApp(t);
  const owner = await registerAndLogin(app, {
    email: 'role-owner@example.com', displayName: 'Chủ cửa hàng', storeName: 'Cửa hàng kiểm tra quyền',
  });
  const storeId = owner.store.id;
  const ownerHeaders = {
    cookie: cookieHeader(owner.cookies),
    origin,
    'x-csrf-token': owner.cookies.slink_csrf,
  };

  const productImport = await app.inject({
    method: 'POST', url: `/api/stores/${storeId}/products/import`,
    headers: { ...ownerHeaders, 'idempotency-key': 'role-product-import-0001' },
    payload: { items: [{ sku: 'ROLE-1', name: 'Sản phẩm phân quyền', salePriceVnd: 1000, costVnd: 250, openingQuantity: '2' }] },
  });
  assert.equal(productImport.statusCode, 201, productImport.body);

  const supplierResponse = await app.inject({
    method: 'POST', url: `/api/stores/${storeId}/suppliers`,
    headers: { ...ownerHeaders, 'idempotency-key': 'role-supplier-create-001' },
    payload: { name: 'Nhà cung cấp riêng', openingPayableVnd: '1000' },
  });
  assert.equal(supplierResponse.statusCode, 201, supplierResponse.body);
  const supplierId = supplierResponse.json().supplier.id;

  const opened = await app.inject({
    method: 'POST', url: `/api/stores/${storeId}/cash-register/open`,
    headers: { ...ownerHeaders, 'idempotency-key': 'role-cash-session-open-1' },
    payload: { openingFloatVnd: '5000' },
  });
  assert.equal(opened.statusCode, 201, opened.body);
  const sessionId = opened.json().session.id;
  const cashIn = await app.inject({
    method: 'POST', url: `/api/stores/${storeId}/cash-movements`,
    headers: { ...ownerHeaders, 'idempotency-key': 'role-cashbook-in-0001' },
    payload: { direction: 'in', amountVnd: '100', method: 'cash', category: 'Thu bổ sung', note: 'Nghiệm thu quyền xem' },
  });
  assert.equal(cashIn.statusCode, 201, cashIn.body);

  const cashier = await inviteAndLogin(app, {
    storeId, ownerHeaders, email: 'cashier-role@example.com', role: 'cashier',
  });
  const cashierHeaders = cashier.headers;

  const finance = await app.inject({ method: 'GET', url: `/api/stores/${storeId}/finance`, headers: cashierHeaders });
  assert.equal(finance.statusCode, 200, finance.body);
  assert.deepEqual(finance.json().financeAccess, { full: false, cashbook: true, purchases: false });
  assert.equal(finance.json().summary, null);
  assert.equal(finance.json().suppliers.length, 0);
  assert.equal(finance.json().customerDebtors.length, 0);
  assert.equal(finance.json().purchases.length, 0);
  assert.equal(finance.json().movements.length, 1);
  assert.equal(finance.json().movements[0].amount_vnd, '100');

  const products = await app.inject({ method: 'GET', url: `/api/stores/${storeId}/products`, headers: cashierHeaders });
  assert.equal(products.statusCode, 200, products.body);
  assert.equal(products.json().products[0].cost_vnd, null);

  const register = await app.inject({ method: 'GET', url: `/api/stores/${storeId}/cash-register`, headers: cashierHeaders });
  assert.equal(register.statusCode, 200, register.body);
  assert.equal(register.json().session.expectedCashVnd, '5100');
  assert.equal(register.json().canClose, false);

  const closeAttempt = await app.inject({
    method: 'POST', url: `/api/stores/${storeId}/cash-register/${sessionId}/close`,
    headers: { ...cashierHeaders, 'idempotency-key': 'role-cash-session-close-1' },
    payload: { countedCashVnd: '5100', note: '' },
  });
  assert.equal(closeAttempt.statusCode, 403, closeAttempt.body);

  const cashbookAttempt = await app.inject({
    method: 'POST', url: `/api/stores/${storeId}/cash-movements`,
    headers: { ...cashierHeaders, 'idempotency-key': 'role-cashbook-out-0001' },
    payload: { direction: 'out', amountVnd: '1', method: 'cash', category: 'Chi phí', note: 'Không được phép' },
  });
  assert.equal(cashbookAttempt.statusCode, 403, cashbookAttempt.body);

  const supplierPaymentAttempt = await app.inject({
    method: 'POST', url: `/api/stores/${storeId}/suppliers/${supplierId}/payments`,
    headers: { ...cashierHeaders, 'idempotency-key': 'role-supplier-payment-01' },
    payload: { amountVnd: '1', method: 'cash', note: 'Không được phép' },
  });
  assert.equal(supplierPaymentAttempt.statusCode, 403, supplierPaymentAttempt.body);

  const analytics = await app.inject({ method: 'GET', url: `/api/stores/${storeId}/analytics?days=7`, headers: cashierHeaders });
  assert.equal(analytics.statusCode, 403, analytics.body);
});

test('manager, accountant, and stockkeeper receive different finance and record access', async (t) => {
  const app = await testApp(t);
  const owner = await registerAndLogin(app, {
    email: 'role-matrix-owner@example.com', displayName: 'Chủ cửa hàng', storeName: 'Cửa hàng ma trận quyền',
  });
  const storeId = owner.store.id;
  const ownerHeaders = {
    cookie: cookieHeader(owner.cookies),
    origin,
    'x-csrf-token': owner.cookies.slink_csrf,
  };

  const productImport = await app.inject({
    method: 'POST', url: `/api/stores/${storeId}/products/import`,
    headers: { ...ownerHeaders, 'idempotency-key': 'matrix-product-import-01' },
    payload: { items: [{ sku: 'MATRIX-1', name: 'Sản phẩm quyền hạn', salePriceVnd: 500, costVnd: 250, openingQuantity: '2' }] },
  });
  assert.equal(productImport.statusCode, 201, productImport.body);
  const productId = productImport.json().products[0].id;

  const supplierResponse = await app.inject({
    method: 'POST', url: `/api/stores/${storeId}/suppliers`,
    headers: { ...ownerHeaders, 'idempotency-key': 'matrix-supplier-create-01' },
    payload: { name: 'Nhà cung cấp quyền hạn', openingPayableVnd: '1000' },
  });
  assert.equal(supplierResponse.statusCode, 201, supplierResponse.body);

  const customerResponse = await app.inject({
    method: 'POST', url: `/api/stores/${storeId}/customers`,
    headers: { ...ownerHeaders, 'idempotency-key': 'matrix-customer-create-01' },
    payload: { name: 'Khách hàng quyền hạn', openingBalanceVnd: '300' },
  });
  assert.equal(customerResponse.statusCode, 201, customerResponse.body);

  const opened = await app.inject({
    method: 'POST', url: `/api/stores/${storeId}/cash-register/open`,
    headers: { ...ownerHeaders, 'idempotency-key': 'matrix-cash-session-open-01' },
    payload: { openingFloatVnd: '5000' },
  });
  assert.equal(opened.statusCode, 201, opened.body);

  const cashIn = await app.inject({
    method: 'POST', url: `/api/stores/${storeId}/cash-movements`,
    headers: { ...ownerHeaders, 'idempotency-key': 'matrix-cashbook-in-01' },
    payload: { direction: 'in', amountVnd: '100', method: 'cash', category: 'Thu bổ sung', note: 'Số liệu phân quyền' },
  });
  assert.equal(cashIn.statusCode, 201, cashIn.body);

  const purchase = await app.inject({
    method: 'POST', url: `/api/stores/${storeId}/purchases`,
    headers: { ...ownerHeaders, 'idempotency-key': 'matrix-purchase-create-01' },
    payload: {
      productId, quantity: 1, unitCostVnd: '250', amountPaidVnd: '0',
      method: 'cash', supplierName: 'Nhà cung cấp quyền hạn', note: 'Phiếu nhập để xem theo vai trò',
    },
  });
  assert.equal(purchase.statusCode, 201, purchase.body);

  const manager = await inviteAndLogin(app, {
    storeId, ownerHeaders, email: 'matrix-manager@example.com', role: 'manager',
  });
  const accountant = await inviteAndLogin(app, {
    storeId, ownerHeaders, email: 'matrix-accountant@example.com', role: 'accountant',
  });
  const stockkeeper = await inviteAndLogin(app, {
    storeId, ownerHeaders, email: 'matrix-stockkeeper@example.com', role: 'stockkeeper',
  });

  for (const staff of [manager, accountant]) {
    const finance = await app.inject({ method: 'GET', url: `/api/stores/${storeId}/finance`, headers: staff.headers });
    assert.equal(finance.statusCode, 200, finance.body);
    assert.deepEqual(finance.json().financeAccess, { full: true, cashbook: true, purchases: true });
    assert.equal(finance.json().summary.supplierPayableVnd, '1250');
    assert.equal(finance.json().summary.customerDebtVnd, '300');
    assert.equal(finance.json().suppliers[0].balance_vnd, '1250');
    assert.equal(finance.json().customerDebtors[0].balance_vnd, '300');
    assert.equal(finance.json().movements.length, 1);
    assert.equal(finance.json().purchases.length, 1);

    const analytics = await app.inject({ method: 'GET', url: `/api/stores/${storeId}/analytics?days=7`, headers: staff.headers });
    assert.equal(analytics.statusCode, 200, analytics.body);
    const productList = await app.inject({ method: 'GET', url: `/api/stores/${storeId}/products`, headers: staff.headers });
    assert.equal(productList.json().products.find((item) => item.id === productId).cost_vnd, '250');
    const customers = await app.inject({ method: 'GET', url: `/api/stores/${storeId}/customers`, headers: staff.headers });
    assert.equal(customers.statusCode, 200, customers.body);
    const orders = await app.inject({ method: 'GET', url: `/api/stores/${storeId}/orders`, headers: staff.headers });
    assert.equal(orders.statusCode, 200, orders.body);

    const register = await app.inject({ method: 'GET', url: `/api/stores/${storeId}/cash-register`, headers: staff.headers });
    assert.equal(register.statusCode, 200, register.body);
    assert.equal(register.json().canClose, staff === manager);
  }

  const stockFinance = await app.inject({ method: 'GET', url: `/api/stores/${storeId}/finance`, headers: stockkeeper.headers });
  assert.equal(stockFinance.statusCode, 200, stockFinance.body);
  assert.deepEqual(stockFinance.json().financeAccess, { full: false, cashbook: false, purchases: true });
  assert.equal(stockFinance.json().summary, null);
  assert.equal(stockFinance.json().movements.length, 0);
  assert.equal(stockFinance.json().customerDebtors.length, 0);
  assert.equal(stockFinance.json().suppliers.length, 1);
  assert.equal(stockFinance.json().suppliers[0].name, 'Nhà cung cấp quyền hạn');
  assert.equal(Object.hasOwn(stockFinance.json().suppliers[0], 'balance_vnd'), false);
  assert.equal(stockFinance.json().purchases.length, 1);
  assert.equal(stockFinance.json().purchases[0].supplier_name, 'Nhà cung cấp quyền hạn');

  const stockkeeperProducts = await app.inject({ method: 'GET', url: `/api/stores/${storeId}/products`, headers: stockkeeper.headers });
  assert.equal(stockkeeperProducts.json().products.find((item) => item.id === productId).cost_vnd, '250');
  const stockkeeperCustomers = await app.inject({ method: 'GET', url: `/api/stores/${storeId}/customers`, headers: stockkeeper.headers });
  assert.equal(stockkeeperCustomers.statusCode, 403, stockkeeperCustomers.body);
  const stockkeeperOrders = await app.inject({ method: 'GET', url: `/api/stores/${storeId}/orders`, headers: stockkeeper.headers });
  assert.equal(stockkeeperOrders.statusCode, 403, stockkeeperOrders.body);
  const stockkeeperAnalytics = await app.inject({ method: 'GET', url: `/api/stores/${storeId}/analytics?days=7`, headers: stockkeeper.headers });
  assert.equal(stockkeeperAnalytics.statusCode, 403, stockkeeperAnalytics.body);
  const stockkeeperRegister = await app.inject({ method: 'GET', url: `/api/stores/${storeId}/cash-register`, headers: stockkeeper.headers });
  assert.equal(stockkeeperRegister.statusCode, 403, stockkeeperRegister.body);
});
