(function () {
  'use strict';

  const root = document.getElementById('view');
  const authRoot = document.getElementById('auth-screen');
  const appShell = document.querySelector('.app-shell');
  const modal = document.getElementById('modal');
  const backdrop = document.getElementById('modal-backdrop');
  const toastStack = document.getElementById('toast-stack');
  const pendingCompatibilityWarning = document.getElementById('pending-compatibility-warning');
  const navItems = [
    { id: 'dashboard', label: 'Tổng quan', icon: 'home' },
    { id: 'pos', label: 'Bán hàng', icon: 'cart', accent: true },
    { id: 'products', label: 'Sản phẩm', icon: 'box' },
    { id: 'orders', label: 'Đơn hàng', icon: 'receipt' },
    { id: 'customers', label: 'Khách hàng', icon: 'users' },
    { id: 'inventory', label: 'Kho hàng', icon: 'layers' },
    { id: 'finance', label: 'Thu chi & công nợ', icon: 'wallet' },
    { id: 'reports', label: 'Báo cáo', icon: 'chart' },
    { id: 'settings', label: 'Cài đặt', icon: 'settings' },
    { id: 'staff', label: 'Nhân viên', icon: 'users' }
  ];
  const iconPaths = {
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/><path d="M9 21v-6h6v6"/>',
    cart: '<path d="M3 4h2l2.2 11.3a2 2 0 0 0 2 1.7h8.5a2 2 0 0 0 2-1.6L21 9H7"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/>',
    box: '<path d="m12 3 9 5-9 5-9-5z"/><path d="M3 8v9l9 5 9-5V8M12 13v9"/>',
    receipt: '<path d="M5 3h14v18l-3-2-4 2-4-2-3 2z"/><path d="M8 8h8M8 12h8M8 16h4"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.9M16 3.2a4 4 0 0 1 0 7.6"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
    wallet: '<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 9h18M16 14h2"/><path d="M7 5V3h11"/>',
    chart: '<path d="M3 3v18h18"/><path d="m7 14 4-4 3 3 6-7"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.5.9l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.5-.9l-1.7.7-1.4-2.4 1.4-1.1a7 7 0 0 1 0-1.8L6.9 12l1.4-2.4 1.7.7a8 8 0 0 1 1.5-.9l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.5.9l1.7-.7 1.4 2.4-1.4 1.1a7 7 0 0 1-.1 1.9z"/>',
    search: '<circle cx="10.8" cy="10.8" r="6.4"/><path d="m16 16 4.5 4.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    close: '<path d="m18 6-12 12M6 6l12 12"/>',
    download: '<path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M5 17v3h14v-3"/>',
    scan: '<path d="M4 7V4h3M17 4h3v3M20 17v3h-3M7 20H4v-3M4 12h1m3 0h1m3 0h1m3 0h1m3 0h1"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    tag: '<path d="M20 13 11 22l-9-9V2h11z"/><circle cx="7" cy="7" r="1"/>',
    alert: '<path d="m10.3 4.3-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-2.7l-8-14a2 2 0 0 0-3.4 0z"/><path d="M12 9v4m0 4h.01"/>',
    spark: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="m19 16 .9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9z"/>',
    edit: '<path d="m15 5 4 4M4 20l4-.8L19 8a2.8 2.8 0 0 0-4-4L4 15z"/>',
    trash: '<path d="M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3"/>',
    more: '<circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    receiptSmall: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6m-6 4h6m-6 4h3"/>',
    gift: '<path d="M20 12v9H4v-9m-1-5h18v5H3zM12 7v14"/><path d="M12 7H7.5a2.5 2.5 0 1 1 2.4-3.2L12 7zm0 0h4.5a2.5 2.5 0 1 0-2.4-3.2L12 7z"/>',
    card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18m-14 5h3"/>',
    phone: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>',
    truck: '<path d="M3 5h12v12H3zM15 9h4l3 4v4h-7z"/><circle cx="7.5" cy="18" r="1.8"/><circle cx="18.5" cy="18" r="1.8"/>',
    shop: '<path d="M4 10v10h16V10M3 10l2-6h14l2 6"/><path d="M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M9 20v-6h6v6"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4.5 1.5c-1.1 1.1-2 1.3-2 3m0 3h.01"/>'
  };

  let page = 'products';
  let store = emptyStore();
  let authSession = null;
  let authMode = 'login';
  let invitationToken = '';
  let invitationInfo = null;
  let staffState = { members: [], invitations: [], loading: false, error: '' };
  let productTotal = 0;
  let productOffset = 0;
  let productNextOffset = null;
  let productLoading = false;
  let productError = '';
  let productRequestNumber = 0;
  let productSearchTimer = null;
  let purchaseProductSearchTimer = null;
  let purchaseProductRequestNumber = 0;
  let inventoryTotal = 0;
  let inventoryOffset = 0;
  let inventoryNextOffset = null;
  let inventoryRequestNumber = 0;
  let inventoryLoading = false;
  let inventoryError = '';
  let inventorySummary = { total: 0, low: 0, out: 0, stockValueVnd: 0 };
  let financeLoading = false;
  let financeError = '';
  let financeMovementTotal = 0;
  let purchaseHistory = [];
  let financeSummary = { todayInVnd: '0', todayOutVnd: '0', customerDebtVnd: '0', customerDebtCount: 0, supplierPayableVnd: '0' };
  let cashRegisterState = { session: null, lastClosed: null, recentClosed: [], canOperate: false };
  let cashRegisterError = '';
  let financeTopCustomers = [];
  let analyticsData = null;
  let analyticsLoading = false;
  let analyticsError = '';
  let analyticsRequestNumber = 0;
  let customerTotal = 0;
  let customerOffset = 0;
  let customerNextOffset = null;
  let customerRequestNumber = 0;
  let customerDetailRequestNumber = 0;
  let modalGeneration = 0;
  let modalReturnFocus = null;
  let pickerCustomerRequestNumber = 0;
  let pickerCustomerSearchTimer = null;
  let orderTotal = 0;
  let orderOffset = 0;
  let orderNextOffset = null;
  let orderRequestNumber = 0;
  let cart = [];
  const productCache = new Map();
  const customerCache = new Map();
  let posProducts = [];
  let posSearchTerm = '';
  let posSearchRequestNumber = 0;
  let posSearchTimer = null;
  let cartCustomerId = '';
  let checkoutIdempotencyKey = '';
  let checkoutPendingPayload = null;
  let returnPending = null;
  let productImportReadNumber = 0;
  let productImportReading = false;
  let productImportRows = [];
  let productImportErrors = [];
  let pendingCompatibilityStoreId = '';
  let pendingCompatibilitySaveBlocked = false;
  let categoryFilter = 'Tất cả';
  let searchTerms = { products: '', orders: '', customers: '', inventory: '' };
  let orderFilter = 'Tất cả';
  let chartRange = '7 ngày';

  function emptyStore() {
    return {
      settings: { storeName: 'Slink', ownerName: '', phone: '', address: '', receiptFooter: '', version: 1 },
      products: [], customers: [], orders: [], cashbook: [], movements: [], suppliers: [], sequence: 1001,
    };
  }

  function csrfCookie() {
    const match = document.cookie.split(';').map(function (part) { return part.trim(); }).find(function (part) { return part.startsWith('slink_csrf='); });
    return match ? decodeURIComponent(match.slice('slink_csrf='.length)) : '';
  }

  function newIdempotencyKey() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
      try {
        const bytes = new Uint8Array(16);
        window.crypto.getRandomValues(bytes);
        return 'slink-' + Array.from(bytes, function (value) { return value.toString(16).padStart(2, '0'); }).join('');
      } catch (error) { /* Use the compatibility fallback when secure randomness is unavailable. */ }
    }
    return 'slink-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  }

  function pendingOutboxKey(kind, entityId) {
    const userId = authSession && authSession.user && authSession.user.id;
    if (!userId || !store.id) return '';
    return ['slink-pending-v2', encodeURIComponent(userId), encodeURIComponent(store.id), kind, encodeURIComponent(entityId || '_')].join(':');
  }

  function unscopedLegacyPendingKeys(storeId) {
    const keys = [];
    try {
      for (let index = 0; index < window.sessionStorage.length; index += 1) {
        const key = window.sessionStorage.key(index);
        if (!key || !key.startsWith('slink-pending-')) continue;
        try {
          const value = JSON.parse(window.sessionStorage.getItem(key) || 'null');
          if (value && value.storeId === storeId && !value.userId) keys.push(key);
        } catch (error) { /* Ignore unreadable legacy records; never submit them. */ }
      }
    } catch (error) { /* Session storage may be unavailable in a restricted browser. */ }
    return keys;
  }

  function updatePendingCompatibilityWarning(storeId) {
    pendingCompatibilityStoreId = storeId || '';
    if (!pendingCompatibilityWarning) return;
    pendingCompatibilityWarning.hidden = !storeId || unscopedLegacyPendingKeys(storeId).length === 0;
  }

  function clearReviewedLegacyPending() {
    const keys = unscopedLegacyPendingKeys(pendingCompatibilityStoreId);
    if (!keys.length) {
      updatePendingCompatibilityWarning(pendingCompatibilityStoreId);
      return;
    }
    const confirmed = window.confirm('Bạn đã đối soát các đơn hàng, khoản thu chi và tồn kho đang chờ trên máy chủ chưa? Slink chỉ xóa các bản lưu cũ trên thiết bị; dữ liệu trên máy chủ không thay đổi.');
    if (!confirmed) return;
    try { keys.forEach(function (key) { window.sessionStorage.removeItem(key); }); } catch (error) { /* Keep the warning visible when cleanup cannot be confirmed. */ }
    updatePendingCompatibilityWarning(pendingCompatibilityStoreId);
    if (!unscopedLegacyPendingKeys(pendingCompatibilityStoreId).length) toast('Đã xóa bản lưu cũ', 'Chỉ bản chờ trên thiết bị được xóa; dữ liệu cửa hàng trên máy chủ không thay đổi.');
  }

  function readPendingRecord(kind, entityId, legacyKey, isValid) {
    const key = pendingOutboxKey(kind, entityId);
    if (!key) return null;
    try {
      const value = JSON.parse(window.localStorage.getItem(key) || 'null');
      if (value && value.userId === authSession.user.id && value.storeId === store.id && isValid(value)) return value;
    } catch (error) { /* Treat an unreadable record as unavailable; never submit a partial payload. */ }
    try {
      const legacy = JSON.parse(window.sessionStorage.getItem(legacyKey) || 'null');
      if (legacy && legacy.userId === authSession.user.id && legacy.storeId === store.id && typeof legacy.key === 'string' && isValid(legacy)) return legacy;
    } catch (error) { /* Unscoped or unreadable legacy records must never be submitted. */ }
    return null;
  }

  function savePendingRecord(kind, entityId, value, legacyKey) {
    const key = pendingOutboxKey(kind, entityId);
    if (!key || !value) return false;
    try {
      const legacy = JSON.parse(window.sessionStorage.getItem(legacyKey) || 'null');
      if (legacy && legacy.storeId === store.id && !legacy.userId) {
        pendingCompatibilitySaveBlocked = true;
        updatePendingCompatibilityWarning(store.id);
        return false;
      }
    } catch (error) { /* Unreadable old records cannot be submitted or overwrite a new request. */ }
    try {
      const record = Object.assign({}, value, {
        userId: authSession.user.id,
        storeId: store.id,
        outboxVersion: 2,
        savedAt: new Date().toISOString(),
      });
      window.localStorage.setItem(key, JSON.stringify(record));
      const saved = JSON.parse(window.localStorage.getItem(key) || 'null');
      if (!saved || saved.userId !== authSession.user.id || saved.storeId !== store.id || saved.key !== value.key) return false;
      try { window.sessionStorage.removeItem(legacyKey); } catch (error) { /* Persistent copy is already saved. */ }
      return true;
    } catch (error) { return false; }
  }

  function removePendingRecord(kind, entityId, legacyKey) {
    const key = pendingOutboxKey(kind, entityId);
    try { if (key) window.localStorage.removeItem(key); } catch (error) { /* Keep UI recovery available if storage is unavailable. */ }
    try { window.sessionStorage.removeItem(legacyKey); } catch (error) { /* Older session storage may be unavailable. */ }
  }

  function pendingSaveFailed() {
    if (pendingCompatibilitySaveBlocked) {
      pendingCompatibilitySaveBlocked = false;
      toast('Cần đối soát giao dịch cũ', 'Yêu cầu mới chưa được gửi. Hãy kiểm tra dữ liệu trên máy chủ rồi xác nhận đã đối soát bản lưu cũ.', 'error');
      return false;
    }
    toast('Chưa gửi thao tác', 'Không thể lưu mã khôi phục trên thiết bị. Hãy kiểm tra quyền lưu dữ liệu hoặc dung lượng trình duyệt rồi thử lại; yêu cầu chưa được gửi.', 'error');
    return false;
  }

  function loadPendingSale() {
    return readPendingRecord('sale', '', 'slink-pending-sale-v1', function (value) {
      return typeof value.key === 'string' && value.payload && Array.isArray(value.payload.items);
    });
  }
  function savePendingSale() {
    if (!checkoutPendingPayload || !checkoutIdempotencyKey) return false;
    return savePendingRecord('sale', '', { key: checkoutIdempotencyKey, payload: checkoutPendingPayload }, 'slink-pending-sale-v1');
  }
  function clearPendingSale() {
    checkoutIdempotencyKey = '';
    checkoutPendingPayload = null;
    removePendingRecord('sale', '', 'slink-pending-sale-v1');
  }

  function loadPendingReturn(orderId) {
    return readPendingRecord('return', orderId, 'slink-pending-return-v1:' + orderId, function (value) {
      return value.orderId === orderId && typeof value.key === 'string' && value.payload;
    });
  }
  function savePendingReturn() {
    if (!returnPending) return false;
    return savePendingRecord('return', returnPending.orderId, returnPending, 'slink-pending-return-v1:' + returnPending.orderId);
  }
  function clearPendingReturn(orderId) {
    returnPending = null;
    removePendingRecord('return', orderId, 'slink-pending-return-v1:' + orderId);
  }

  function loadPendingStock(productId) {
    return readPendingRecord('stock', productId, 'slink-pending-stock-v1:' + store.id + ':' + productId, function (value) {
      return value.productId === productId && typeof value.key === 'string' && value.payload;
    });
  }
  function savePendingStock(value) {
    return savePendingRecord('stock', value.productId, value, 'slink-pending-stock-v1:' + value.storeId + ':' + value.productId);
  }
  function clearPendingStock(productId) {
    removePendingRecord('stock', productId, 'slink-pending-stock-v1:' + store.id + ':' + productId);
  }

  function loadPendingPayment(orderId) {
    return readPendingRecord('payment', orderId, 'slink-pending-payment-v1:' + orderId, function (value) {
      return value.orderId === orderId && typeof value.key === 'string' && value.payload;
    });
  }
  function savePendingPayment(value) {
    return savePendingRecord('payment', value.orderId, value, 'slink-pending-payment-v1:' + value.orderId);
  }
  function clearPendingPayment(orderId) {
    removePendingRecord('payment', orderId, 'slink-pending-payment-v1:' + orderId);
  }

  function loadPendingPurchase() {
    return readPendingRecord('purchase', '', 'slink-pending-purchase-v1', function (value) {
      return typeof value.key === 'string' && value.payload;
    });
  }
  function savePendingPurchase(value) {
    return savePendingRecord('purchase', '', value, 'slink-pending-purchase-v1');
  }
  function clearPendingPurchase() {
    removePendingRecord('purchase', '', 'slink-pending-purchase-v1');
  }

  function supplierPaymentKey(supplierId) { return 'slink-pending-supplier-payment-v1:' + supplierId; }
  function loadPendingSupplierPayment(supplierId) {
    return readPendingRecord('supplier-payment', supplierId, supplierPaymentKey(supplierId), function (value) {
      return value.supplierId === supplierId && typeof value.key === 'string' && value.payload;
    });
  }
  function savePendingSupplierPayment(value) {
    return savePendingRecord('supplier-payment', value.supplierId, value, supplierPaymentKey(value.supplierId));
  }
  function clearPendingSupplierPayment(supplierId) {
    removePendingRecord('supplier-payment', supplierId, supplierPaymentKey(supplierId));
  }

  function loadPendingCash() {
    return readPendingRecord('cash', '', 'slink-pending-cash-v1', function (value) {
      return typeof value.key === 'string' && value.payload;
    });
  }
  function savePendingCash(value) {
    return savePendingRecord('cash', '', value, 'slink-pending-cash-v1');
  }
  function clearPendingCash() {
    removePendingRecord('cash', '', 'slink-pending-cash-v1');
  }

  function loadPendingProductImport() {
    return readPendingRecord('product-import', '', 'slink-pending-product-import-v1', function (value) {
      return typeof value.key === 'string' && value.payload && Array.isArray(value.payload.items);
    });
  }
  function savePendingProductImport(value) {
    return savePendingRecord('product-import', '', value, 'slink-pending-product-import-v1');
  }
  function clearPendingProductImport() {
    removePendingRecord('product-import', '', 'slink-pending-product-import-v1');
  }

  function loadPendingCustomer() {
    return readPendingRecord('customer-create', '', 'slink-pending-customer-create-v1', function (value) {
      return typeof value.key === 'string' && value.payload && typeof value.payload.name === 'string';
    });
  }
  function savePendingCustomer(value) {
    return savePendingRecord('customer-create', '', value, 'slink-pending-customer-create-v1');
  }
  function clearPendingCustomer() {
    removePendingRecord('customer-create', '', 'slink-pending-customer-create-v1');
  }

  function loadPendingSupplier() {
    return readPendingRecord('supplier-create', '', 'slink-pending-supplier-create-v1', function (value) {
      return typeof value.key === 'string' && value.payload && typeof value.payload.name === 'string';
    });
  }
  function savePendingSupplier(value) {
    return savePendingRecord('supplier-create', '', value, 'slink-pending-supplier-create-v1');
  }
  function clearPendingSupplier() {
    removePendingRecord('supplier-create', '', 'slink-pending-supplier-create-v1');
  }

  function cashSessionCloseKey(sessionId) { return 'slink-pending-cash-session-close-v1:' + sessionId; }
  function loadPendingCashSessionOpen() {
    return readPendingRecord('cash-session-open', '', 'slink-pending-cash-session-open-v1', function (value) {
      return typeof value.key === 'string' && value.payload && typeof value.payload.openingFloatVnd === 'string';
    });
  }
  function savePendingCashSessionOpen(value) {
    return savePendingRecord('cash-session-open', '', value, 'slink-pending-cash-session-open-v1');
  }
  function clearPendingCashSessionOpen() {
    removePendingRecord('cash-session-open', '', 'slink-pending-cash-session-open-v1');
  }
  function loadPendingCashSessionClose(sessionId) {
    return readPendingRecord('cash-session-close', sessionId, cashSessionCloseKey(sessionId), function (value) {
      return value.sessionId === sessionId && typeof value.key === 'string' && value.payload;
    });
  }
  function savePendingCashSessionClose(value) {
    return savePendingRecord('cash-session-close', value.sessionId, value, cashSessionCloseKey(value.sessionId));
  }
  function clearPendingCashSessionClose(sessionId) {
    removePendingRecord('cash-session-close', sessionId, cashSessionCloseKey(sessionId));
  }

  async function apiRequest(url, options) {
    const config = options || {};
    const method = String(config.method || 'GET').toUpperCase();
    const headers = Object.assign({}, config.headers || {});
    if (config.body !== undefined) headers['content-type'] = 'application/json';
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      const token = csrfCookie();
      if (token) headers['x-csrf-token'] = token;
    }
    const response = await fetch(url, {
      method: method,
      credentials: 'same-origin',
      headers: headers,
      body: config.body === undefined ? undefined : JSON.stringify(config.body),
      signal: config.signal,
    });
    let result = {};
    try { result = await response.json(); } catch (e) { /* The server may return a non-JSON gateway error. */ }
    if (!response.ok) {
      const error = new Error(result.error && result.error.message ? result.error.message : 'Không thể kết nối Slink. Vui lòng thử lại.');
      error.status = response.status;
      error.code = result.error && result.error.code;
      throw error;
    }
    return result;
  }

  function mapProduct(row) {
    const product = {
      id: row.id,
      sku: row.sku,
      barcode: row.barcode || '',
      name: row.name,
      category: row.category,
      unit: row.unit,
      price: Number(row.sale_price_vnd),
      cost: Number(row.cost_vnd),
      stock: Number(row.on_hand),
      reserved: Number(row.reserved),
      minStock: Number(row.low_stock_threshold),
      inventoryTracked: row.inventory_tracked,
      inventoryVersion: Number(row.inventory_version) || 1,
      status: row.status,
      version: row.version,
      emoji: '📦',
      tone: 'product-sage',
    };
    productCache.set(product.id, product);
    return product;
  }

  function mapCustomer(row) {
    const balance = Number(row.balance_vnd) || 0;
    const customer = {
      id: row.id,
      name: row.name,
      phone: row.phone || '',
      email: row.email || '',
      note: row.note || '',
      tier: 'Khách hàng',
      points: null,
      debt: Math.max(0, balance),
      credit: Math.max(0, -balance),
      totalSpent: Number(row.total_spent_vnd) || 0,
      orders: Number(row.order_count) || 0,
      version: row.version,
      createdAt: row.created_at,
    };
    customerCache.set(customer.id, customer);
    return customer;
  }

  function statusText(status, due) {
    if (status === 'returned') return 'Đã trả hàng';
    if (status === 'partially_returned') return 'Trả một phần';
    if (status === 'partially_returned') return 'Trả một phần';
    if (status === 'voided') return 'Đã hủy';
    if (Number(due) > 0) return 'Còn nợ';
    return 'Hoàn tất';
  }

  function mapOrder(row) {
    const total = Number(row.total_vnd) || 0;
    const paid = Number(row.paid_vnd) || 0;
    const refunded = Number(row.refunded_vnd) || 0;
    const returned = Number(row.return_total_vnd) || 0;
    return {
      id: row.id,
      number: row.order_number,
      customerId: row.customer_id || '',
      customerName: row.customer_name || '',
      customerPhone: row.customer_phone || '',
      status: statusText(row.status, total - paid - returned + refunded),
      subtotal: Number(row.subtotal_vnd) || 0,
      discount: Number(row.discount_vnd) || 0,
      total: total,
      paid: paid,
      refunded: refunded,
      returned: returned,
      due: Math.max(0, total - paid - returned + refunded),
      itemCount: Number(row.line_count) || 0,
      items: [],
      method: '',
      createdAt: row.occurred_at,
      note: row.note || '',
    };
  }

  async function loadCustomersPage(query, offset) {
    if (!authSession || !store.id) return;
    if (store.role === 'stockkeeper') {
      customerRequestNumber += 1;
      store.customers = [];
      customerTotal = 0;
      customerOffset = 0;
      customerNextOffset = null;
      return;
    }
    const requestNumber = ++customerRequestNumber;
    try {
      const result = await apiRequest(`/api/stores/${encodeURIComponent(store.id)}/customers?limit=100&offset=${Math.max(0, offset || 0)}&q=${encodeURIComponent(query || '')}`);
      if (requestNumber !== customerRequestNumber) return;
      store.customers = result.customers.map(mapCustomer);
      customerTotal = result.total;
      customerOffset = offset || 0;
      customerNextOffset = result.nextOffset;
    } catch (error) {
      if (requestNumber !== customerRequestNumber) return;
      if (error.status === 401) showSignedOut('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.', 'error');
      else toast('Chưa tải được khách hàng', error.message, 'error');
    }
  }

  async function loadOrdersPage(query, offset) {
    if (!authSession || !store.id) return;
    if (store.role === 'stockkeeper') {
      orderRequestNumber += 1;
      store.orders = [];
      orderTotal = 0;
      orderOffset = 0;
      orderNextOffset = null;
      return;
    }
    const requestNumber = ++orderRequestNumber;
    try {
      const result = await apiRequest(`/api/stores/${encodeURIComponent(store.id)}/orders?limit=100&offset=${Math.max(0, offset || 0)}&q=${encodeURIComponent(query || '')}`);
      if (requestNumber !== orderRequestNumber) return;
      store.orders = result.orders.map(mapOrder);
      orderTotal = result.total;
      orderOffset = offset || 0;
      orderNextOffset = result.nextOffset;
    } catch (error) {
      if (requestNumber !== orderRequestNumber) return;
      if (error.status === 401) showSignedOut('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.', 'error');
      else toast('Chưa tải được đơn hàng', error.message, 'error');
    }
  }

  function authCard(title, subtitle, body, message, tone) {
    authRoot.innerHTML = `<section class='auth-card'><div class='auth-brand'><span class='brand-mark' aria-hidden='true'><svg viewBox='0 0 32 32'><path d='M8 8.5h16v5H13v2h11v8H8v-5h11v-2H8z' fill='currentColor'/><circle cx='24.5' cy='7.5' r='2.5' fill='#c8f36c'/></svg></span><span class='brand-name'>slink<span class='brand-period'>.</span></span></div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p>${message ? `<div class='auth-message ${tone === 'error' ? 'error' : ''}'>${message}</div>` : ''}${body}<div class='auth-footnote'>Thông tin bán hàng được lưu theo cửa hàng của bạn và chỉ thành viên được cấp quyền mới xem được.</div></section>`;
    appShell.hidden = true;
    authRoot.hidden = false;
  }

  function renderAuth(message, tone, verificationUrl) {
    let title = 'Đăng nhập Slink';
    let subtitle = 'Quản lý cửa hàng của bạn trên mọi thiết bị.';
    let body = '';
    if (authMode === 'invite-register') {
      title = 'Tham gia cửa hàng';
      subtitle = invitationInfo ? `Bạn được mời tham gia ${invitationInfo.storeName} với vai trò ${staffRoleName(invitationInfo.role)}.` : 'Hoàn tất đăng ký từ lời mời của cửa hàng.';
      body = `<form class='auth-form' data-auth-form='invite-register'><div class='form-field'><label class='input-label' for='auth-name'>Tên của bạn</label><input class='input' id='auth-name' name='displayName' autocomplete='name' required minlength='2' maxlength='120'/></div><div class='form-field'><label class='input-label' for='auth-email'>Email được mời</label><input class='input' id='auth-email' name='email' type='email' value='${esc(invitationInfo ? invitationInfo.email : '')}' readonly/></div><div class='form-field'><label class='input-label' for='auth-password'>Mật khẩu (tối thiểu 12 ký tự)</label><input class='input' id='auth-password' name='password' type='password' autocomplete='new-password' required minlength='12' maxlength='128'/></div><button class='btn btn-primary auth-submit' type='submit'>Tạo tài khoản và tham gia</button></form><button class='auth-switch' type='button' data-action='auth-mode' data-mode='invite-login'>Đã có tài khoản? Đăng nhập</button>`;
    } else if (authMode === 'register') {
      title = 'Tạo tài khoản cửa hàng';
      subtitle = 'Bắt đầu bằng email của bạn và thông tin cửa hàng.';
      body = `<form class='auth-form' data-auth-form='register'><div class='form-field'><label class='input-label' for='auth-name'>Tên của bạn</label><input class='input' id='auth-name' name='displayName' autocomplete='name' required minlength='2' maxlength='120'/></div><div class='form-field'><label class='input-label' for='auth-store'>Tên cửa hàng</label><input class='input' id='auth-store' name='storeName' autocomplete='organization' required minlength='2' maxlength='160'/></div><div class='form-field'><label class='input-label' for='auth-email'>Email</label><input class='input' id='auth-email' name='email' type='email' autocomplete='email' required maxlength='254'/></div><div class='form-field'><label class='input-label' for='auth-password'>Mật khẩu (tối thiểu 12 ký tự)</label><input class='input' id='auth-password' name='password' type='password' autocomplete='new-password' required minlength='12' maxlength='128'/></div><button class='btn btn-primary auth-submit' type='submit'>Tạo tài khoản</button></form><button class='auth-switch' type='button' data-action='auth-mode' data-mode='login'>Đã có tài khoản? Đăng nhập</button>`;
    } else if (authMode === 'resend') {
      title = 'Gửi lại email xác nhận';
      subtitle = 'Nhập email đã dùng khi đăng ký Slink.';
      body = `<form class='auth-form' data-auth-form='resend'><div class='form-field'><label class='input-label' for='auth-email'>Email</label><input class='input' id='auth-email' name='email' type='email' autocomplete='email' required maxlength='254'/></div><button class='btn btn-primary auth-submit' type='submit'>Gửi liên kết mới</button></form><button class='auth-switch' type='button' data-action='auth-mode' data-mode='login'>Quay lại đăng nhập</button>`;
    } else if (authMode === 'reset') {
      title = 'Đặt lại mật khẩu';
      subtitle = 'Nhập email đã đăng ký để nhận liên kết bảo mật.';
      body = `<form class='auth-form' data-auth-form='reset'><div class='form-field'><label class='input-label' for='auth-email'>Email</label><input class='input' id='auth-email' name='email' type='email' autocomplete='email' required maxlength='254'/></div><button class='btn btn-primary auth-submit' type='submit'>Gửi liên kết đặt lại</button></form><button class='auth-switch' type='button' data-action='auth-mode' data-mode='login'>Quay lại đăng nhập</button>`;
    } else if (authMode === 'reset-complete') {
      title = 'Tạo mật khẩu mới';
      subtitle = 'Liên kết có hiệu lực trong một giờ và chỉ dùng một lần.';
      const resetToken = new URLSearchParams(window.location.hash.slice(1)).get('reset') || '';
      body = resetToken ? `<form class='auth-form' data-auth-form='reset-complete'><input type='hidden' name='token' value='${esc(resetToken)}'/><div class='form-field'><label class='input-label' for='auth-password'>Mật khẩu mới (tối thiểu 12 ký tự)</label><input class='input' id='auth-password' name='password' type='password' autocomplete='new-password' required minlength='12' maxlength='128'/></div><div class='form-field'><label class='input-label' for='auth-password-confirm'>Nhập lại mật khẩu</label><input class='input' id='auth-password-confirm' name='passwordConfirm' type='password' autocomplete='new-password' required minlength='12' maxlength='128'/></div><button class='btn btn-primary auth-submit' type='submit'>Cập nhật mật khẩu</button></form>` : `<div class='auth-message error'>Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.</div>`;
      body += `<button class='auth-switch' type='button' data-action='auth-mode' data-mode='login'>Quay lại đăng nhập</button>`;
    } else {
      const invited = authMode === 'invite-login' && invitationInfo;
      if (invited) { title = 'Đăng nhập để tham gia'; subtitle = `Lời mời vào ${invitationInfo.storeName} · ${staffRoleName(invitationInfo.role)}.`; }
      body = `<form class='auth-form' data-auth-form='login'><div class='form-field'><label class='input-label' for='auth-email'>Email</label><input class='input' id='auth-email' name='email' type='email' autocomplete='username' value='${esc(invited ? invitationInfo.email : '')}' required maxlength='254'/></div><div class='form-field'><label class='input-label' for='auth-password'>Mật khẩu</label><input class='input' id='auth-password' name='password' type='password' autocomplete='current-password' required maxlength='128'/></div><button class='btn btn-primary auth-submit' type='submit'>${invited ? 'Đăng nhập và tham gia' : 'Đăng nhập'}</button></form>${invited ? `<button class='auth-switch' type='button' data-action='auth-mode' data-mode='invite-register'>Tạo tài khoản mới bằng lời mời</button><button class='auth-switch' type='button' data-action='auth-mode' data-mode='resend'>Gửi lại email xác nhận</button>` : `<button class='auth-switch' type='button' data-action='auth-mode' data-mode='reset'>Quên mật khẩu?</button><button class='auth-switch' type='button' data-action='auth-mode' data-mode='register'>Tạo tài khoản và cửa hàng</button><button class='auth-switch' type='button' data-action='auth-mode' data-mode='resend'>Gửi lại email xác nhận</button>`}`;
    }
    let htmlMessage = message ? esc(message) : '';
    if (verificationUrl) htmlMessage += `<br/><a href='${esc(verificationUrl)}'>${authMode === 'reset' ? 'Mở liên kết đặt lại mật khẩu' : 'Xác nhận email và kích hoạt cửa hàng'}</a>`;
    authCard(title, subtitle, body, htmlMessage, tone);
  }

  function showSignedOut(message, tone) {
    closeModal();
    authSession = null;
    store = emptyStore();
    page = 'products';
    authMode = 'login';
    pendingCompatibilityStoreId = '';
    pendingCompatibilitySaveBlocked = false;
    if (pendingCompatibilityWarning) pendingCompatibilityWarning.hidden = true;
    renderAuth(message, tone);
  }

  async function enterStore(session, preferredStoreId) {
    if (!session || !session.stores || !session.stores.length) {
      showSignedOut('Tài khoản chưa có cửa hàng đang hoạt động. Hãy tạo tài khoản cửa hàng mới hoặc liên hệ quản lý.', 'error');
      return;
    }
    authSession = { user: session.user, stores: session.stores };
    checkoutIdempotencyKey = '';
    checkoutPendingPayload = null;
    cart = [];
    cartCustomerId = '';
    const activeStore = session.stores.find(function (item) { return item.id === preferredStoreId; }) || session.stores[0];
    store = emptyStore();
    store.id = activeStore.id;
    store.role = activeStore.role;
    updatePendingCompatibilityWarning(store.id);
    const pendingSale = loadPendingSale();
    if (pendingSale && pendingSale.storeId === store.id) {
      checkoutIdempotencyKey = pendingSale.key;
      checkoutPendingPayload = pendingSale.payload;
    }
    store.settings.storeName = activeStore.name;
    store.settings.ownerName = session.user.displayName;
    store.settings.phone = activeStore.phone || '';
    store.settings.address = activeStore.address || '';
    store.settings.receiptFooter = activeStore.receipt_footer || '';
    store.settings.version = Number(activeStore.version) || 1;
    page = checkoutPendingPayload ? 'pos' : 'products';
    authRoot.hidden = true;
    appShell.hidden = false;
    productLoading = true;
    render();
    await Promise.all([loadProductsPage('', 0), loadCustomersPage('', 0), loadOrdersPage('', 0)]);
    if (checkoutPendingPayload) {
      cart = checkoutPendingPayload.items.map(function (item) { return { id: item.productId, qty: item.quantity }; });
      cartCustomerId = checkoutPendingPayload.customerId || '';
      cart.discount = checkoutPendingPayload.discountVnd || 0;
    }
    if (authSession) render();
  }

  async function loadProductsPage(query, offset) {
    if (!authSession || !store.id) return;
    const requestNumber = ++productRequestNumber;
    productLoading = true;
    productError = '';
    const url = `/api/stores/${encodeURIComponent(store.id)}/products?limit=100&offset=${Math.max(0, offset || 0)}&q=${encodeURIComponent(query || '')}`;
    try {
      const result = await apiRequest(url);
      if (requestNumber !== productRequestNumber) return;
      if (!result.products.length && offset > 0) return loadProductsPage(query, Math.max(0, offset - 100));
      store.products = result.products.map(mapProduct);
      productTotal = result.total;
      productOffset = offset || 0;
      productNextOffset = result.nextOffset;
      productLoading = false;
      productError = '';
      render();
    } catch (error) {
      if (requestNumber !== productRequestNumber) return;
      productLoading = false;
      productError = error.message;
      if (error.status === 401) return showSignedOut('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.', 'error');
      toast('Chưa tải được sản phẩm', error.message, 'error');
      render();
    }
  }

  async function loadInventoryPage(query, offset) {
    if (!authSession || !store.id) return;
    const requestNumber = ++inventoryRequestNumber;
    inventoryLoading = true;
    inventoryError = '';
    if (page === 'inventory') render();
    try {
      const result = await apiRequest(`/api/stores/${encodeURIComponent(store.id)}/inventory?limit=100&offset=${Math.max(0, offset || 0)}&q=${encodeURIComponent(query || '')}`);
      if (requestNumber !== inventoryRequestNumber) return;
      store.products = result.products.map(mapProduct);
      store.movements = result.movements.map(function (movement) { return { productId: movement.productId, type: movement.type, delta: Number(movement.delta), reason: movement.reason, createdAt: movement.createdAt }; });
      inventorySummary = result.summary;
      inventoryTotal = result.total;
      inventoryOffset = offset || 0;
      inventoryNextOffset = result.nextOffset;
      inventoryLoading = false;
      if (page === 'inventory') render();
    } catch (error) {
      if (requestNumber !== inventoryRequestNumber) return;
      inventoryLoading = false;
      inventoryError = error.message;
      if (error.status === 401) return showSignedOut('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.', 'error');
      toast('Chưa tải được tồn kho', error.message, 'error');
      if (page === 'inventory') render();
    }
  }

  async function loadFinancePage() {
    if (!authSession || !store.id) return;
    financeLoading = true;
    financeError = '';
    if (page === 'finance') render();
    try {
      const [result, register] = await Promise.all([
        apiRequest(`/api/stores/${encodeURIComponent(store.id)}/finance`),
        store.role === 'stockkeeper'
          ? Promise.resolve({ session: null, lastClosed: null, recentClosed: [], canOperate: false, canOpen: false, canClose: false })
          : apiRequest(`/api/stores/${encodeURIComponent(store.id)}/cash-register`),
      ]);
      store.cashbook = result.movements.map(function (row) {
        return { id: row.source_id, type: row.direction, category: row.category, amountVnd: row.amount_vnd, note: row.note, method: row.method, actorName: row.actor_name, cashSessionId: row.cash_session_id, cashSessionOpenedAt: row.cash_session_opened_at, createdAt: row.occurred_at };
      });
      store.suppliers = result.suppliers.map(function (row) { return { id: row.id, name: row.name, debt: Math.max(0, Number(row.balance_vnd) || 0), lastActivityAt: row.last_activity_at }; });
      purchaseHistory = (result.purchases || []).map(function (row) {
        return { id: row.id, number: row.purchase_number, status: row.status, note: row.note || '', total: Number(row.total_vnd) || 0, supplierName: row.supplier_name || '', receivedAt: row.received_at, items: Array.isArray(row.lines) ? row.lines : [] };
      });
      financeTopCustomers = result.customerDebtors.map(function (row) { return { id: row.id, name: row.name, phone: row.phone, debt: String(row.balance_vnd) }; });
      financeSummary = {
        todayInVnd: result.summary ? String(result.summary.todayInVnd) : '0', todayOutVnd: result.summary ? String(result.summary.todayOutVnd) : '0',
        customerDebtVnd: result.summary ? String(result.summary.customerDebtVnd) : '0', customerDebtCount: result.summary ? Number(result.summary.customerDebtCount) : 0,
        supplierPayableVnd: result.summary ? String(result.summary.supplierPayableVnd || '0') : '0',
      };
      financeMovementTotal = result.movementTotal;
      cashRegisterState = register;
      cashRegisterError = '';
      financeLoading = false;
      if (page === 'finance') render();
    } catch (error) {
      financeLoading = false;
      financeError = error.message;
      cashRegisterError = error.message;
      if (error.status === 401) return showSignedOut('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.', 'error');
      toast('Chưa tải được sổ thu chi', error.message, 'error');
      if (page === 'finance') render();
    }
  }

  function applyStoreProfile(settings) {
    store.settings.storeName = settings.name;
    store.settings.phone = settings.phone || '';
    store.settings.address = settings.address || '';
    store.settings.receiptFooter = settings.receipt_footer || '';
    store.settings.version = Number(settings.version) || 1;
    const activeStore = authSession && authSession.stores.find(function (item) { return item.id === store.id; });
    if (activeStore) Object.assign(activeStore, { name: settings.name, phone: settings.phone, address: settings.address, receipt_footer: settings.receipt_footer, version: settings.version });
  }

  async function loadStoreProfile() {
    try {
      const result = await apiRequest(`/api/stores/${encodeURIComponent(store.id)}/settings`);
      applyStoreProfile(result.settings);
      if (page === 'settings') render();
    } catch (error) {
      if (error.status === 401) showSignedOut('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.', 'error');
      else toast('Chưa tải được thông tin cửa hàng', error.message, 'error');
    }
  }

  async function loadStaffPage() {
    if (!authSession || !store.id || store.role !== 'owner') return;
    staffState.loading = true;
    staffState.error = '';
    if (page === 'staff') render();
    try {
      const result = await apiRequest(`/api/stores/${encodeURIComponent(store.id)}/staff`);
      staffState.members = result.members || [];
      staffState.invitations = result.invitations || [];
      staffState.loading = false;
    } catch (error) {
      staffState.loading = false;
      staffState.error = error.message;
      if (error.status === 401) return showSignedOut('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.', 'error');
    }
    if (page === 'staff') render();
  }

  async function loadAnalytics(days) {
    if (!authSession || !store.id) return;
    if (!['owner', 'manager', 'accountant'].includes(store.role)) {
      analyticsRequestNumber += 1;
      analyticsData = null;
      analyticsLoading = false;
      analyticsError = '';
      return;
    }
    const requestNumber = ++analyticsRequestNumber;
    analyticsLoading = true;
    analyticsError = '';
    if (page === 'dashboard' || page === 'reports') render();
    try {
      const result = await apiRequest(`/api/stores/${encodeURIComponent(store.id)}/analytics?days=${days === 30 ? 30 : 7}`);
      if (requestNumber !== analyticsRequestNumber) return;
      analyticsData = result;
      analyticsLoading = false;
      if (page === 'dashboard' || page === 'reports') render();
    } catch (error) {
      if (requestNumber !== analyticsRequestNumber) return;
      analyticsLoading = false;
      analyticsError = error.message;
      if (error.status === 401) return showSignedOut('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.', 'error');
      toast('Chưa tải được báo cáo', error.message, 'error');
      if (page === 'dashboard' || page === 'reports') render();
    }
  }

  function icon(name, size) { return `<svg width='${size || 18}' height='${size || 18}' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'>${iconPaths[name] || iconPaths.spark}</svg>`; }
  function localDate(date) { const d = date || new Date(); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-'); }
  function isoAgo(days, hour, minute) { const d = new Date(); d.setDate(d.getDate() - days); d.setHours(hour || 10, minute || 0, 0, 0); return d.toISOString(); }
  function money(amount) { return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Math.round(Number(amount) || 0)); }
  function moneyVndText(value) {
    try {
      const integer = BigInt(String(value == null || value === '' ? '0' : value));
      return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(integer);
    } catch (error) { return money(value); }
  }
  function number(value) { return new Intl.NumberFormat('vi-VN').format(Number(value) || 0); }
  function shortMoney(value) { const n = Number(value) || 0; if (n >= 1000000) return (n / 1000000).toFixed(n >= 10000000 ? 0 : 1).replace('.', ',') + ' tr'; if (n >= 1000) return (n / 1000).toFixed(0) + 'k'; return number(n); }
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function humanDate(value, withTime) { const d = new Date(value); if (Number.isNaN(d.getTime())) return ''; return d.toLocaleString('vi-VN', withTime ? { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  function timeOf(value) { return new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }); }
  function todayLabel() { return new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
  function initials(name) { return String(name || 'Slink').trim().split(/\s+/).slice(-2).map(function (x) { return x[0]; }).join('').toUpperCase(); }
  function productById(id) {
    const currentSearchResult = page === 'pos' && posProducts.find(function (p) { return p.id === id; });
    return currentSearchResult || store.products.find(function (p) { return p.id === id; }) || productCache.get(id);
  }
  function customerById(id) { return store.customers.find(function (c) { return c.id === id; }) || customerCache.get(id); }
  function toast(title, message, tone) {
    const node = document.createElement('div');
    node.className = 'toast' + (tone === 'error' ? ' error' : '');
    node.innerHTML = '<strong>' + esc(title) + '</strong>' + (message ? '<small>' + esc(message) + '</small>' : '');
    toastStack.appendChild(node);
    window.setTimeout(function () { node.remove(); }, 3700);
  }

  function statusBadge(status) {
    const cls = status === 'Hoàn tất' ? 'success' : status === 'Còn nợ' ? 'warning' : status === 'Đã trả hàng' ? 'neutral' : status === 'Đã hủy' ? 'danger' : 'info';
    return `<span class='badge badge-${cls}'><i class='badge-dot'></i>${esc(status)}</span>`;
  }

  function staffRoleName(role) {
    return ({ owner: 'Chủ cửa hàng', manager: 'Quản lý', cashier: 'Thu ngân', stockkeeper: 'Nhân viên kho', accountant: 'Kế toán' })[role] || 'Nhân viên';
  }

  function staffRoleDescription(role) {
    return ({
      manager: 'Điều phối bán hàng, trả hàng, kho, tài chính và cài đặt cửa hàng; không được quản lý nhân viên.',
      cashier: 'Tạo đơn bán, cập nhật hồ sơ khách và ghi nhận thu nợ; không được tự hủy đơn hoặc trả hàng.',
      stockkeeper: 'Cập nhật danh mục, kiểm kê tồn và nhận hàng nhập kho.',
      accountant: 'Theo dõi công nợ, thanh toán, thu chi và nghiệp vụ nhập hàng; không bán hàng hoặc sửa danh mục.',
    })[role] || '';
  }

  function navHtml(item, mobile) {
    const active = page === item.id || (item.id === 'products' && page === 'product-detail') || (item.id === 'orders' && page === 'order-detail');
    if (mobile) return `<button class='mobile-nav-link ${active ? 'active' : ''}' data-route='${item.id}' aria-label='${item.label}'><span class='nav-icon'>${icon(item.icon, 18)}</span><span>${item.id === 'dashboard' ? 'Tổng quan' : item.id === 'pos' ? 'Bán hàng' : item.id === 'orders' ? 'Đơn hàng' : 'Kho hàng'}</span></button>`;
    return `<button class='nav-link ${active ? 'active' : ''}' data-route='${item.id}'><span class='nav-icon'>${icon(item.icon, 18)}</span><span class='nav-label'>${item.label}</span>${item.id === 'inventory' && lowStockProducts().length ? `<span class='nav-count'>${lowStockProducts().length}</span>` : ''}</button>`;
  }

  function canAccessRoute(route) {
    if (route === 'staff' && store.role !== 'owner') return false;
    if (route === 'reports' && !['owner', 'manager', 'accountant'].includes(store.role)) return false;
    if (store.role === 'stockkeeper' && ['pos', 'orders', 'customers'].includes(route)) return false;
    if (store.role === 'accountant' && route === 'pos') return false;
    return true;
  }

  function renderShell() {
    document.getElementById('sidebar-store-name').textContent = store.settings.storeName;
    const storeAvatar = document.querySelector('.store-avatar');
    if (storeAvatar) storeAvatar.textContent = initials(store.settings.storeName).slice(0, 1);
    const userName = authSession && authSession.user ? authSession.user.displayName : 'Slink';
    const userEmail = authSession && authSession.user ? authSession.user.email : '';
    const profileName = document.querySelector('.profile-button strong');
    const profileEmail = document.querySelector('.profile-button small');
    if (profileName) profileName.textContent = userName;
    if (profileEmail) profileEmail.textContent = userEmail;
    const profileAvatar = document.querySelector('.profile-avatar');
    const topbarAvatar = document.querySelector('.topbar-avatar');
    if (profileAvatar) profileAvatar.textContent = initials(userName);
    if (topbarAvatar) topbarAvatar.textContent = initials(userName);
    const visibleNav = navItems.filter(function (item) { return canAccessRoute(item.id); });
    document.getElementById('primary-nav').innerHTML = visibleNav.map(function (n) { return navHtml(n, false); }).join('');
    document.getElementById('mobile-nav').innerHTML = ['dashboard', 'pos', 'orders', 'inventory'].filter(canAccessRoute).map(function (id) { return navHtml(navItems.find(function (n) { return n.id === id; }), true); }).join('') + `<button class='mobile-nav-link ${['customers', 'finance', 'reports', 'settings', 'products', 'staff'].includes(page) ? 'active' : ''}' data-action='more-menu'><span class='nav-icon'>${icon('more', 18)}</span><span>Khác</span></button>`;
    const names = { dashboard: ['Tổng quan', 'Hôm nay'], pos: ['Bán hàng', 'Tạo đơn'], products: ['Hàng hóa', 'Sản phẩm'], orders: ['Vận hành', 'Đơn hàng'], customers: ['Khách hàng', 'Danh sách'], inventory: ['Kho hàng', 'Tồn kho'], finance: ['Tài chính', 'Thu chi & công nợ'], reports: ['Phân tích', 'Báo cáo'], settings: ['Cửa hàng', 'Cài đặt'], staff: ['Cửa hàng', 'Nhân viên'], 'order-detail': ['Đơn hàng', 'Chi tiết đơn'], 'product-detail': ['Hàng hóa', 'Chi tiết sản phẩm'] };
    const meta = names[page] || ['Slink', 'Cửa hàng'];
    document.getElementById('crumb').textContent = meta[0];
    document.getElementById('crumb-current').textContent = meta[1];
    const online = navigator.onLine;
    document.getElementById('connection-status').innerHTML = `<i style='${online ? '' : 'background:#d58b55;box-shadow:0 0 0 3px #f9efe2'}'></i>${online ? 'Có kết nối mạng' : 'Ngoại tuyến · chưa thể lưu'}`;
  }

  function pageHeading(title, subtitle, actions) {
    return `<div class='page-heading'><div><h1>${esc(title)}</h1><p>${esc(subtitle || '')}</p></div><div class='heading-actions'>${actions || ''}</div></div>`;
  }

  function lowStockProducts() { return store.products.filter(function (p) { return p.stock <= p.minStock; }).sort(function (a, b) { return a.stock - b.stock; }); }
  function chartDays(days) {
    if (!analyticsData || !Array.isArray(analyticsData.days)) return [];
    return analyticsData.days.map(function (item) {
      const date = new Date(item.date + 'T12:00:00');
      return { date: item.date, label: days === 7 ? date.toLocaleDateString('vi-VN', { weekday: 'short' }) : String(date.getDate()), total: Number(item.salesVnd) || 0, orders: Number(item.orderCount) || 0 };
    });
  }

  function chartSvg(days) {
    const width = 620, height = 170, left = 34, right = 8, top = 12, bottom = 26;
    const data = chartDays(days); if (!data.length) return `<div class='empty-state'>${analyticsLoading ? 'Đang tải báo cáo…' : esc(analyticsError || 'Chưa có dữ liệu cho khoảng thời gian này.')}</div>`; const max = Math.max(100000, Math.ceil(Math.max.apply(null, data.map(function (x) { return x.total; })) / 100000) * 100000);
    const step = (width - left - right) / Math.max(1, data.length - 1);
    const points = data.map(function (d, i) { return { x: left + i * step, y: top + (height - top - bottom) * (1 - d.total / max), value: d.total, label: d.label }; });
    const line = points.map(function (p, i) { return (i ? 'L' : 'M') + p.x + ' ' + p.y; }).join(' ');
    const area = line + ` L ${points[points.length - 1].x} ${height - bottom} L ${points[0].x} ${height - bottom} Z`;
    const grid = [0, 1, 2, 3].map(function (i) { const y = top + (height - top - bottom) * i / 3; return `<line x1='${left}' x2='${width}' y1='${y}' y2='${y}' class='chart-grid-line'/><text x='0' y='${y + 3}'>${i === 0 ? shortMoney(max) : i === 3 ? '0' : shortMoney(max * (3 - i) / 3)}</text>`; }).join('');
    const labels = points.map(function (p) { return `<text text-anchor='middle' x='${p.x}' y='${height - 5}'>${esc(p.label)}</text>`; }).join('');
    const markers = points.map(function (p) { return `<circle class='chart-point' cx='${p.x}' cy='${p.y}' r='3.5'><title>${esc(p.label)}: ${money(p.value)}</title></circle>`; }).join('');
    return `<svg class='sales-chart' viewBox='0 0 ${width} ${height}' preserveAspectRatio='none' role='img' aria-label='Biểu đồ doanh thu ${days} ngày'><defs><linearGradient id='chartFill' x1='0' x2='0' y1='0' y2='1'><stop offset='0%' stop-color='#6aa982' stop-opacity='.24'/><stop offset='100%' stop-color='#6aa982' stop-opacity='0'/></linearGradient></defs>${grid}<path class='chart-area' d='${area}'/><path class='chart-line' d='${line}'/>${markers}${labels}</svg>`;
  }

  function topProducts() {
    return analyticsData && Array.isArray(analyticsData.topProducts) ? analyticsData.topProducts.slice(0, 4).map(function (item) {
      return { product: { id: item.id, name: item.name, sku: item.sku, unit: item.unit, tone: 'product-sage', emoji: '📦' }, count: Number(item.quantity_sold) || 0, revenue: Number(item.net_sales_vnd) || 0 };
    }) : [];
  }

  function filteredProducts(query, category, source) {
    const q = String(query || '').trim().toLowerCase();
    return (source || store.products).filter(function (p) {
      return (!category || category === 'Tất cả' || p.category === category) && (!q || [p.name, p.sku, p.category].some(function (value) { return String(value || '').toLowerCase().includes(q); }));
    });
  }

  function stockBadge(product) {
    if (product.stock <= 0) return `<span class='badge badge-danger'>Hết hàng</span>`;
    if (product.stock <= product.minStock) return `<span class='badge badge-warning'>Sắp hết</span>`;
    return `<span class='badge badge-success'>Đang bán</span>`;
  }

  function productRow(product) {
    const canEdit = ['owner', 'manager', 'stockkeeper'].includes(store.role);
    const showCost = store.role !== 'cashier';
    return `<tr><td><div class='product-cell'><span class='product-thumb ${product.tone || 'product-sage'}'>${esc(product.emoji || '📦')}</span><span class='product-name-stack'><strong>${esc(product.name)}</strong><small>${esc(product.sku)}</small></span></div></td><td>${esc(product.category)}</td><td class='text-right'>${money(product.price)}</td>${showCost ? `<td class='text-right'>${money(product.cost)}</td>` : ''}<td class='text-right'><span class='stock-number ${product.stock <= 0 ? 'out' : product.stock <= product.minStock ? 'low' : ''}'>${number(product.stock)} ${esc(product.unit)}</span></td><td>${stockBadge(product)}</td><td class='text-right'>${canEdit ? `<button class='row-action' data-action='edit-product' data-id='${product.id}' aria-label='Sửa ${esc(product.name)}'>•••</button>` : ''}</td></tr>`;
  }

  function productMobileCard(product) {
    const canEdit = ['owner', 'manager', 'stockkeeper'].includes(store.role);
    const tag = canEdit ? 'button' : 'div';
    return `<${tag} class='product-mobile-card' ${canEdit ? `data-action='edit-product' data-id='${product.id}'` : ''} style='width:100%;text-align:left'><span class='product-thumb ${product.tone || 'product-sage'}'>${esc(product.emoji || '📦')}</span><span class='product-mobile-info'><strong>${esc(product.name)}</strong><small>${esc(product.sku)} · ${esc(product.category)}</small></span><span class='product-mobile-side'><strong>${money(product.price)}</strong><small>${product.stock <= 0 ? 'Hết hàng' : `Còn ${number(product.stock)} ${esc(product.unit)}`}</small></span></${tag}>`;
  }

  function renderProducts() {
    const products = filteredProducts(searchTerms.products, 'Tất cả');
    const canEdit = ['owner', 'manager', 'stockkeeper'].includes(store.role);
    const showCost = store.role !== 'cashier';
    const empty = productLoading ? 'Đang tải danh mục…' : productError ? esc(productError) : searchTerms.products ? 'Không tìm thấy sản phẩm phù hợp.' : 'Thêm sản phẩm đầu tiên để bắt đầu quản lý danh mục.';
    return pageHeading('Sản phẩm', 'Quản lý mặt hàng, giá bán và số lượng hiện có.', (canEdit ? `<button class='btn btn-primary' data-action='new-product'><span class='btn-icon'>＋</span> Thêm sản phẩm</button><button class='btn btn-secondary' data-action='import-products'>Nhập CSV</button>` : '') + (canExportData() ? `<button class='btn btn-secondary' data-action='open-export'>Xuất CSV</button>` : '')) +
      `<div class='toolbar'><div class='toolbar-left'><div class='search-wrap'><span class='search-symbol'>⌕</span><input class='input' id='product-search' type='search' placeholder='Tìm tên hàng hoặc mã SKU…' value='${esc(searchTerms.products)}' aria-label='Tìm sản phẩm'></div><span class='result-count'>${productLoading ? 'Đang tải…' : `${number(productTotal)} sản phẩm`}</span></div></div><section class='panel'><div class='table-wrap desktop-table'><table class='data-table'><thead><tr><th>Sản phẩm</th><th>Danh mục</th><th class='text-right'>Giá bán</th>${showCost ? `<th class='text-right'>Giá vốn</th>` : ''}<th class='text-right'>Tồn kho</th><th>Trạng thái</th><th></th></tr></thead><tbody>${products.map(productRow).join('') || `<tr><td colspan='${showCost ? 7 : 6}'><div class='empty-state'><strong>${esc(empty)}</strong></div></td></tr>`}</tbody></table></div><div class='product-list-mobile'>${products.map(productMobileCard).join('') || `<div class='panel empty-state'><strong>${esc(empty)}</strong></div>`}</div><div class='pagination'><span>Hiển thị ${products.length} trên ${number(productTotal)} sản phẩm</span><span class='pagination-actions'>${productOffset > 0 ? `<button class='page-button' data-action='products-page' data-offset='${Math.max(0, productOffset - 100)}'>‹</button>` : ''}<span class='page-button current'>${Math.floor(productOffset / 100) + 1}</span>${productNextOffset !== null ? `<button class='page-button' data-action='products-page' data-offset='${productNextOffset}'>›</button>` : ''}</span></div></section>`;
  }

  function cartTotals() {
    const subtotal = cart.reduce(function (sum, item) { const product = productById(item.id); return sum + (product ? Math.round(product.price * item.qty) : 0); }, 0);
    const discount = Math.min(subtotal, Math.max(0, Number(cart.discount) || 0));
    return { subtotal: subtotal, discount: discount, total: subtotal - discount, count: cart.reduce(function (sum, item) { return sum + item.qty; }, 0) };
  }

  function cartPanel() {
    const totals = cartTotals();
    const customer = customerById(cartCustomerId);
    const pendingNote = checkoutPendingPayload ? `<div class='modal-note' style='margin:0 14px 10px'>Có đơn đang chờ xác nhận. <button class='link-button' data-action='retry-pending-sale'>Kiểm tra đơn →</button></div>` : '';
    const rows = cart.map(function (item) {
      const product = productById(item.id); if (!product) return '';
      return `<div class='cart-row'><div><div class='cart-item-name'>${esc(product.name)}</div><div class='cart-item-price'>${money(product.price)} / ${esc(product.unit)}</div></div><div class='qty-control'><button data-action='cart-qty' data-id='${product.id}' data-delta='-1' ${checkoutPendingPayload ? 'disabled' : ''} aria-label='Giảm'>−</button><button data-action='cart-qty-edit' data-id='${product.id}' ${checkoutPendingPayload ? 'disabled' : ''} aria-label='Sửa số lượng'>${number(item.qty)}</button><button data-action='cart-qty' data-id='${product.id}' data-delta='1' ${checkoutPendingPayload || item.qty >= product.stock ? 'disabled' : ''} aria-label='Tăng'>＋</button></div></div>`;
    }).join('');
    return `<section class='panel cart-panel'><div class='cart-heading'><h2>Đơn hàng mới</h2><span>${number(totals.count)} sản phẩm</span></div><div class='cart-customer'><button data-action='pick-customer' ${checkoutPendingPayload ? 'disabled' : ''}><span class='avatar' style='width:24px;height:24px;font-size:8px'>${customer ? initials(customer.name) : '+'}</span><span>${customer ? esc(customer.name) : 'Thêm khách hàng'}</span><strong>${customer ? esc(customer.phone) : '＋'}</strong></button></div>${pendingNote}<div class='cart-items'>${rows || `<div class='cart-empty'><div><span>🛍️</span>${checkoutPendingPayload ? 'Đơn đang chờ xác nhận.' : 'Chọn sản phẩm để bắt đầu đơn hàng'}</div></div>`}</div><div class='cart-totals'><div class='cart-total-line'><span>Tạm tính</span><strong>${money(totals.subtotal)}</strong></div><button class='cart-total-line' data-action='discount' ${checkoutPendingPayload ? 'disabled' : ''} style='border:0;background:transparent;padding:0;text-align:left'><span>Giảm giá <span style='color:#4a7b58'>＋</span></span><strong>${totals.discount ? '−' + money(totals.discount) : 'Thêm'}</strong></button><div class='cart-total-line total'><span>Khách cần trả</span><strong>${money(totals.total)}</strong></div></div><div class='cart-footer'><button class='btn btn-primary' data-action='checkout' ${cart.length || checkoutPendingPayload ? '' : 'disabled'}>${checkoutPendingPayload ? 'Kiểm tra đơn đang chờ' : 'Thanh toán'} <span style='margin-left:auto'>${money(checkoutPendingPayload ? checkoutPendingPayload.totalVnd : totals.total)} →</span></button><div class='cart-hint'>${checkoutPendingPayload ? 'Thử lại dùng đúng thông tin đã gửi trước đó.' : 'Có thể thêm khách hàng và giảm giá trước khi thu tiền'}</div></div></section>`;
  }

  function renderPOS() {
    const query = document.getElementById('pos-search') ? document.getElementById('pos-search').value : '';
    const sourceProducts = posSearchTerm ? posProducts : store.products;
    const products = filteredProducts(query, categoryFilter, sourceProducts).filter(function (product) { return product.stock > 0; });
    const categories = ['Tất cả'].concat(Array.from(new Set(store.products.map(function (product) { return product.category; }))));
    const totals = cartTotals();
    return pageHeading('Bán hàng', 'Chọn sản phẩm, thêm vào đơn và thu tiền ngay tại quầy.', `<button class='btn btn-secondary' data-action='scan'>${icon('scan', 14)} Nhập mã</button><button class='btn btn-secondary hide-on-mobile' data-route='orders'>Đơn gần đây</button>`) +
      `<div class='pos-layout'><div><div class='pos-tools'><div class='search-wrap pos-search'><span class='search-symbol'>⌕</span><input class='input' id='pos-search' type='search' placeholder='Tìm sản phẩm hoặc SKU…' value='${esc(query)}' aria-label='Tìm sản phẩm'></div><button class='btn btn-secondary' data-action='scan' aria-label='Nhập mã'>${icon('scan', 15)}</button></div><div class='category-scroll'>${categories.map(function (category) { return `<button class='pos-category ${categoryFilter === category ? 'active' : ''}' data-action='category' data-category='${esc(category)}'>${esc(category)}</button>`; }).join('')}</div><div class='pos-product-grid' id='pos-products'>${products.map(function (product) { return `<button class='pos-product' data-action='add-cart' data-id='${product.id}'><span class='product-thumb ${product.tone || 'product-sage'}'>${esc(product.emoji || '📦')}</span><span class='pos-stock'>Còn ${number(product.stock)}</span><strong>${esc(product.name)}</strong><small>${esc(product.sku)}</small><span class='pos-price'>${money(product.price)}</span></button>`; }).join('') || `<div class='panel empty-state' style='grid-column:1/-1'><strong>Không có sản phẩm còn hàng</strong><span>Kiểm tra danh mục hoặc nhập kho.</span></div>`}</div></div>${cartPanel()}</div><div class='pos-mobile-cart'><button class='btn' data-action='open-cart'><span class='mobile-cart-count'>${number(totals.count)}</span><span>${totals.count ? 'Xem giỏ hàng' : 'Giỏ hàng đang trống'}</span><strong>${money(totals.total)}　→</strong></button></div><div class='drawer-cart' id='drawer-cart'>${cartPanel()}</div>`;
  }

  function orderRows(orders) {
    return orders.map(function (order) {
      return `<tr><td><button class='link-button order-ref' data-action='order-detail' data-id='${order.id}'>${esc(order.number)}</button></td><td>${order.customerName ? `<div class='customer-cell'><span class='avatar'>${esc(initials(order.customerName))}</span><span class='product-name-stack'><strong>${esc(order.customerName)}</strong><small>${esc(order.customerPhone)}</small></span></div>` : `<span class='muted'>Khách lẻ</span>`}</td><td>${humanDate(order.createdAt, true)}</td><td>${number(order.itemCount)} dòng</td><td class='text-right'>${money(order.total)}</td><td>${statusBadge(order.status)}</td><td class='text-right'><button class='row-action' data-action='order-detail' data-id='${order.id}'>›</button></td></tr>`;
    }).join('');
  }

  function filteredOrders() {
    return store.orders.filter(function (order) { return orderFilter === 'Tất cả' || order.status === orderFilter; });
  }

  function renderOrders() {
    const orders = filteredOrders();
    return pageHeading('Đơn hàng', 'Theo dõi giao dịch, khoản đã thu và đơn còn phải thu.', `<button class='btn btn-primary' data-route='pos'><span class='btn-icon'>＋</span> Tạo đơn mới</button>${canExportData() ? `<button class='btn btn-secondary' data-action='open-export'>Xuất CSV</button>` : ''}`) +
      `<div class='toolbar'><div class='toolbar-left'><div class='search-wrap'><span class='search-symbol'>⌕</span><input class='input' id='order-search' type='search' placeholder='Tìm mã đơn, tên hoặc số điện thoại…' value='${esc(searchTerms.orders)}' aria-label='Tìm đơn hàng'></div></div><div class='toolbar-right'><div class='segmented'>${['Tất cả', 'Hoàn tất', 'Còn nợ', 'Trả một phần', 'Đã trả hàng'].map(function (status) { return `<button class='segment ${orderFilter === status ? 'active' : ''}' data-action='order-filter' data-filter='${status}'>${status}</button>`; }).join('')}</div></div></div><section class='panel'><div class='table-wrap'><table class='data-table'><thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Thời gian</th><th>Sản phẩm</th><th class='text-right'>Giá trị</th><th>Trạng thái</th><th></th></tr></thead><tbody>${orderRows(orders) || `<tr><td colspan='7'><div class='empty-state'><strong>${orderNextOffset === null && !orderOffset ? 'Chưa có đơn hàng' : 'Không tìm thấy đơn hàng'}</strong><span>Đơn bán mới sẽ xuất hiện ở đây.</span></div></td></tr>`}</tbody></table></div><div class='pagination'><span>Hiển thị ${orders.length} trên ${number(orderTotal)} đơn</span><span class='pagination-actions'>${orderOffset > 0 ? `<button class='page-button' data-action='orders-page' data-offset='${Math.max(0, orderOffset - 100)}'>‹</button>` : ''}<span class='page-button current'>${Math.floor(orderOffset / 100) + 1}</span>${orderNextOffset !== null ? `<button class='page-button' data-action='orders-page' data-offset='${orderNextOffset}'>›</button>` : ''}</span></div></section>`;
  }

  function customerRows(customers) {
    return customers.map(function (customer) { return `<tr><td><div class='customer-cell'><span class='avatar'>${esc(initials(customer.name))}</span><span class='product-name-stack'><strong>${esc(customer.name)}</strong><small>${esc(customer.phone)}</small></span></div></td><td>${number(customer.orders)} đơn</td><td class='text-right'>${money(customer.totalSpent)}</td><td class='text-right'>${customer.debt ? `<span class='stock-number low'>${money(customer.debt)}</span>` : customer.credit ? `<span class='stock-number' style='color:#47835a'>Dư ${money(customer.credit)}</span>` : `<span class='muted'>—</span>`}</td><td class='text-right'><button class='row-action' data-action='customer-detail' data-id='${customer.id}'>›</button></td></tr>`; }).join('');
  }

  function renderCustomers() {
    const customers = store.customers;
    const canEdit = ['owner', 'manager', 'cashier', 'accountant'].includes(store.role);
    return pageHeading('Khách hàng', 'Thông tin mua hàng, liên hệ và công nợ trên cùng một nơi.', (canEdit ? `<button class='btn btn-primary' data-action='new-customer'><span class='btn-icon'>＋</span> Thêm khách hàng</button>` : '') + (canExportData() ? `<button class='btn btn-secondary' data-action='open-export'>Xuất CSV</button>` : '')) +
      `<div class='toolbar'><div class='toolbar-left'><div class='search-wrap'><span class='search-symbol'>⌕</span><input class='input' id='customer-search' type='search' placeholder='Tìm tên hoặc số điện thoại…' value='${esc(searchTerms.customers)}' aria-label='Tìm khách hàng'></div><span class='result-count'>${number(customerTotal)} hồ sơ</span></div></div><section class='panel'><div class='table-wrap'><table class='data-table'><thead><tr><th>Khách hàng</th><th>Lượt mua</th><th class='text-right'>Tổng chi tiêu</th><th class='text-right'>Công nợ / dư</th><th></th></tr></thead><tbody>${customerRows(customers) || `<tr><td colspan='5'><div class='empty-state'><strong>${searchTerms.customers ? 'Không tìm thấy khách hàng phù hợp' : 'Chưa có khách hàng'}</strong><span>Thêm hồ sơ khách mới tại quầy hoặc từ đây.</span></div></td></tr>`}</tbody></table></div><div class='pagination'><span>Hiển thị ${customers.length} trên ${number(customerTotal)} khách</span><span class='pagination-actions'>${customerOffset > 0 ? `<button class='page-button' data-action='customers-page' data-offset='${Math.max(0, customerOffset - 100)}'>‹</button>` : ''}<span class='page-button current'>${Math.floor(customerOffset / 100) + 1}</span>${customerNextOffset !== null ? `<button class='page-button' data-action='customers-page' data-offset='${customerNextOffset}'>›</button>` : ''}</span></div></section>`;
  }

  function movementLabel(movement) {
    return movement.type === 'purchase_receipt' ? 'Nhập hàng' : movement.type === 'sale' ? 'Bán hàng' : movement.type === 'return' ? 'Trả hàng' : movement.type === 'reversal' ? 'Hoàn kho do hủy đơn' : movement.type === 'count' ? 'Kiểm kê' : 'Điều chỉnh';
  }

  function inventoryRows(products) {
    return products.map(function (product) {
      const movement = store.movements.find(function (item) { return item.productId === product.id; });
      return `<tr><td><div class='product-cell'><span class='product-thumb ${product.tone || 'product-sage'}'>📦</span><span class='product-name-stack'><strong>${esc(product.name)}</strong><small>${esc(product.sku)}</small></span></div></td><td>${esc(product.category)}</td><td class='text-right'><span class='stock-number ${product.stock <= 0 ? 'out' : product.stock <= product.minStock ? 'low' : ''}'>${number(product.stock)} ${esc(product.unit)}</span></td><td class='text-right'>${number(product.minStock)} ${esc(product.unit)}</td><td>${movement ? `<span class='product-name-stack'><strong>${movementLabel(movement)}</strong><small>${humanDate(movement.createdAt, true)} · ${esc(movement.reason)}</small></span>` : `<span class='muted'>Chưa có biến động</span>`}</td><td>${movement ? `<span class='stock-number ${movement.delta > 0 ? '' : 'low'}'>${movement.delta > 0 ? '+' : ''}${number(movement.delta)}</span>` : '—'}</td><td class='text-right'>${['owner', 'manager', 'stockkeeper'].includes(store.role) ? `<button class='row-action' data-action='adjust-stock' data-id='${product.id}' aria-label='Kiểm kê ${esc(product.name)}'>＋</button>` : ''}</td></tr>`;
    }).join('');
  }

  function renderInventory() {
    const products = store.products;
    const canCount = ['owner', 'manager', 'stockkeeper'].includes(store.role);
    const canReceive = ['owner', 'manager', 'stockkeeper', 'accountant'].includes(store.role);
    return pageHeading('Kho hàng', 'Theo dõi tồn kho, biến động và nhập hàng.', `${canCount ? `<button class='btn btn-secondary' data-action='adjust-stock-picker'>Kiểm kê</button>` : ''}${canReceive ? `<button class='btn btn-primary' data-action='receive-stock'><span class='btn-icon'>＋</span> Nhập hàng</button>` : ''}${canExportData() ? `<button class='btn btn-secondary' data-action='open-export' aria-label='Xuất dữ liệu CSV'>CSV</button>` : ''}`) +
      `<div class='stat-grid'><article class='stat-card'><div class='stat-top'><span class='stat-label'>Tổng mặt hàng</span><span class='stat-icon'>${icon('box', 15)}</span></div><div class='stat-value'>${number(inventorySummary.total)}</div><div class='stat-foot'>Sản phẩm đang theo dõi</div></article><article class='stat-card'><div class='stat-top'><span class='stat-label'>Tồn kho thấp</span><span class='stat-icon'>${icon('alert', 15)}</span></div><div class='stat-value'>${number(inventorySummary.low)}</div><div class='stat-foot'>Bằng hoặc dưới ngưỡng nhắc</div></article><article class='stat-card'><div class='stat-top'><span class='stat-label'>Hết hàng</span><span class='stat-icon'>${icon('layers', 15)}</span></div><div class='stat-value'>${number(inventorySummary.out)}</div><div class='stat-foot'>Cần bổ sung trước khi bán</div></article>${store.role !== 'cashier' ? `<article class='stat-card'><div class='stat-top'><span class='stat-label'>Giá trị tồn ước tính</span><span class='stat-icon'>${icon('wallet', 15)}</span></div><div class='stat-value' style='font-size:17px'>${money(inventorySummary.stockValueVnd)}</div><div class='stat-foot'>Theo giá vốn hiện tại</div></article>` : ''}</div>` +
      `<div class='toolbar'><div class='toolbar-left'><div class='search-wrap'><span class='search-symbol'>⌕</span><input class='input' id='inventory-search' type='search' placeholder='Tìm sản phẩm hoặc SKU…' value='${esc(searchTerms.inventory)}' aria-label='Tìm trong kho'></div><span class='result-count'>${inventoryLoading ? 'Đang tải…' : inventoryError ? esc(inventoryError) : `${number(inventoryTotal)} mặt hàng`}</span></div></div><section class='panel'><div class='panel-header'><div><h2>Tồn kho hiện tại</h2><p>Cập nhật sau đơn bán, phiếu nhập và kiểm kê</p></div></div><div class='table-wrap'><table class='data-table'><thead><tr><th>Sản phẩm</th><th>Danh mục</th><th class='text-right'>Tồn thực tế</th><th class='text-right'>Mức cảnh báo</th><th>Biến động gần nhất</th><th>Thay đổi</th><th></th></tr></thead><tbody>${inventoryRows(products) || `<tr><td colspan='7'><div class='empty-state'><strong>${inventoryLoading ? 'Đang tải tồn kho' : inventoryError ? 'Chưa tải được tồn kho' : 'Chưa có sản phẩm trong kho'}</strong><span>${esc(inventoryError || '')}</span></div></td></tr>`}</tbody></table></div><div class='pagination'><span>Hiển thị ${products.length} trên ${number(inventoryTotal)} mặt hàng</span><span class='pagination-actions'>${inventoryOffset > 0 ? `<button class='page-button' data-action='inventory-page' data-offset='${Math.max(0, inventoryOffset - 100)}'>‹</button>` : ''}<span class='page-button current'>${Math.floor(inventoryOffset / 100) + 1}</span>${inventoryNextOffset !== null ? `<button class='page-button' data-action='inventory-page' data-offset='${inventoryNextOffset}'>›</button>` : ''}</span></div></section>`;
  }

  function cashRows(rows) {
    const labels = { cash: 'Tiền mặt', bank_transfer: 'Chuyển khoản', bank_qr: 'QR ngân hàng', card: 'Thẻ', other: 'Khác' };
    return rows.map(function (movement) {
      const sessionLabel = movement.cashSessionOpenedAt ? `Ca mở ${humanDate(movement.cashSessionOpenedAt, true)}` : movement.cashSessionId ? 'Ca tiền mặt' : 'Ngoài ca';
      return `<tr><td><span class='product-name-stack'><strong>${esc(movement.category)}</strong><small>${esc(movement.note || '')}</small></span></td><td>${humanDate(movement.createdAt, true)}</td><td><span class='product-name-stack'><strong>${esc(movement.actorName || 'Nhân viên')}</strong><small>${esc(sessionLabel)}</small></span></td><td>${esc(labels[movement.method] || movement.method)}</td><td class='text-right'><strong style='color:${movement.type === 'in' ? '#3c825a' : '#b26450'}'>${movement.type === 'in' ? '+' : '−'}${moneyVndText(movement.amountVnd)}</strong></td></tr>`;
    }).join('');
  }

  function renderFinance() {
    const isStockkeeper = store.role === 'stockkeeper';
    const canViewFullFinance = ['owner', 'manager', 'accountant'].includes(store.role);
    const canViewCashbook = canViewFullFinance || store.role === 'cashier';
    const canRecord = ['owner', 'manager', 'accountant'].includes(store.role);
    const canManageSuppliers = canRecord || isStockkeeper;
    const canReceivePurchases = ['owner', 'manager', 'accountant', 'stockkeeper'].includes(store.role);
    const cashSession = cashRegisterState.session;
    const recentClosed = Array.isArray(cashRegisterState.recentClosed) ? cashRegisterState.recentClosed : [];
    const canOperateCash = Boolean(cashRegisterState.canOperate);
    const canOpenCash = cashRegisterState.canOpen === true || (!cashSession && canOperateCash);
    const canCloseCash = cashRegisterState.canClose === true || (cashRegisterState.canClose === undefined && Boolean(cashSession && canOperateCash));
    let cashSessionPanel = '';
    if (!isStockkeeper) {
      let cashSessionContent = '';
      if (cashRegisterError) {
        cashSessionContent = `<div class='notice-item'><span>⚠️</span><span><strong>Chưa tải được trạng thái ca</strong><small>${esc(cashRegisterError)}</small></span></div>`;
      } else if (cashSession) {
        const closePermissionNote = canCloseCash ? 'Chốt ca sẽ ghi nhận tiền đếm thực tế; nếu lệch, cần nhập lý do và Slink sẽ ghi một bút toán điều chỉnh.' : store.role === 'cashier' ? 'Thu ngân chỉ có thể chốt ca do mình mở. Hãy nhờ người mở ca hoặc quản lý thực hiện.' : 'Vai trò của bạn chỉ xem được ca. Hãy nhờ người mở ca hoặc chủ cửa hàng/quản lý chốt.';
        cashSessionContent = `<div class='cash-session-summary'><div><small>Trạng thái</small><strong>Đang mở · ${esc(cashSession.openedByName || 'Nhân viên')}</strong></div><div><small>Tiền đầu ca</small><strong>${moneyVndText(cashSession.openingFloatVnd)}</strong></div><div><small>Thu bằng tiền mặt</small><strong>${moneyVndText(cashSession.cashInVnd)}</strong></div><div><small>Chi bằng tiền mặt</small><strong>${moneyVndText(cashSession.cashOutVnd)}</strong></div><div><small>Dự kiến trong quầy</small><strong>${moneyVndText(cashSession.expectedCashVnd)}</strong></div></div><div class='modal-note'>Mở lúc ${humanDate(cashSession.openedAt, true)}. ${closePermissionNote}</div>`;
      } else {
        const message = canOpenCash ? 'Mở ca và nhập tiền đầu ca trước khi ghi giao dịch tiền mặt.' : 'Nhân viên có quyền mở ca sẽ cần bắt đầu trước khi phát sinh giao dịch tiền mặt.';
        cashSessionContent = `<div class='empty-state' style='padding:18px'><strong>Chưa có ca tiền mặt đang mở</strong><span>${message}</span></div>`;
      }
      const cashSessionAction = cashSession && canCloseCash
        ? `<button class='btn btn-primary' data-action='close-cash-session'>Chốt ca</button>`
        : !cashSession && canOpenCash ? `<button class='btn btn-primary' data-action='open-cash-session'>Mở ca</button>` : '';
      const cashSessionHistory = cashRegisterError ? '' : `<section class='cash-session-history' aria-labelledby='cash-session-history-title'><div class='cash-session-history-heading'><div><h3 id='cash-session-history-title'>Lịch sử ca đã chốt</h3><p>10 ca gần nhất${store.role === 'cashier' ? ' của bạn' : ''}</p></div></div>${recentClosed.length ? `<div class='cash-session-history-list'>${recentClosed.map(function (item) {
        const variance = BigInt(String(item.varianceVnd || '0'));
        const varianceLabel = variance === 0n ? 'Khớp số tiền' : variance > 0n ? `Thừa ${moneyVndText(variance)}` : `Thiếu ${moneyVndText(-variance)}`;
        return `<article class='cash-session-history-card'><div class='cash-session-history-top'><div><strong>Chốt ${humanDate(item.closedAt, true)}</strong><small>Mở ${humanDate(item.openedAt, true)} · ${esc(item.openedByName || 'Nhân viên')} → ${esc(item.closedByName || 'Nhân viên')}</small></div><span class='cash-session-variance ${variance === 0n ? 'matched' : 'mismatch'}'>${esc(varianceLabel)}</span></div><div class='cash-session-history-summary'><div><small>Đầu ca</small><strong>${moneyVndText(item.openingFloatVnd)}</strong></div><div><small>Thu tiền mặt</small><strong>${moneyVndText(item.cashInVnd)}</strong></div><div><small>Chi tiền mặt</small><strong>${moneyVndText(item.cashOutVnd)}</strong></div><div><small>Dự kiến</small><strong>${moneyVndText(item.expectedCashVnd)}</strong></div><div><small>Đã đếm</small><strong>${moneyVndText(item.countedCashVnd)}</strong></div><div><small>Chênh lệch</small><strong>${moneyVndText(variance)}</strong></div></div>${item.closeNote ? `<p class='cash-session-history-note'><strong>Lý do:</strong> ${esc(item.closeNote)}</p>` : ''}</article>`;
      }).join('')}</div>` : `<div class='empty-state cash-session-history-empty'><strong>Chưa có ca nào được chốt</strong><span>Lịch sử đối soát sẽ xuất hiện sau khi chốt ca đầu tiên.</span></div>`}</section>`;
      cashSessionPanel = `<section class='panel' style='margin-bottom:14px'><div class='panel-header'><div><h2>Ca tiền mặt</h2><p>Đối soát số dư quầy, giao dịch tiền mặt và chênh lệch khi bàn giao.</p></div>${cashSessionAction}</div>${cashSessionContent}${cashSessionHistory}</section>`;
    }
    const actions = isStockkeeper
      ? `${canManageSuppliers ? `<button class='btn btn-secondary' data-action='new-supplier'>＋ Nhà cung cấp</button>` : ''}${canReceivePurchases ? `<button class='btn btn-primary' data-action='receive-stock'>＋ Nhập hàng</button>` : ''}`
      : `${canRecord ? `<button class='btn btn-primary' data-action='new-expense'><span class='btn-icon'>＋</span> Ghi phiếu thu / chi</button>` : ''}${canExportData() ? `<button class='btn btn-secondary' data-action='open-export'>Xuất CSV</button>` : ''}`;
    const heading = pageHeading(isStockkeeper ? 'Nhập hàng' : 'Thu chi & công nợ', isStockkeeper ? 'Quản lý nhà cung cấp và theo dõi các phiếu hàng đã nhận.' : store.role === 'cashier' ? 'Theo dõi giao dịch trong ca tiền mặt của bạn.' : 'Theo dõi tiền đã thu, đã chi và các khoản còn phải thu.', actions);
    const metrics = canViewFullFinance ? `<div class='stat-grid'><article class='stat-card'><div class='stat-label'>Đã thu hôm nay</div><div class='stat-value'>${moneyVndText(financeSummary.todayInVnd)}</div></article><article class='stat-card'><div class='stat-label'>Đã chi hôm nay</div><div class='stat-value'>${moneyVndText(financeSummary.todayOutVnd)}</div></article><article class='stat-card'><div class='stat-label'>Khách còn nợ</div><div class='stat-value'>${moneyVndText(financeSummary.customerDebtVnd)}</div><div class='stat-foot'>${number(financeSummary.customerDebtCount)} khách hàng</div></article><article class='stat-card'><div class='stat-label'>Nợ nhà cung cấp</div><div class='stat-value'>${moneyVndText(financeSummary.supplierPayableVnd)}</div></article></div>` : '';
    const cashbookPanel = canViewCashbook ? `<section class='panel'><div class='panel-header'><div><h2>Sổ thu chi</h2><p>${store.role === 'cashier' ? 'Giao dịch thuộc ca đang mở hoặc ca do bạn mở' : '100 giao dịch gần nhất'}</p></div></div><div class='table-wrap'><table class='data-table'><thead><tr><th>Khoản mục</th><th>Thời gian</th><th>Người ghi nhận / ca</th><th>Phương thức</th><th class='text-right'>Số tiền</th></tr></thead><tbody>${cashRows(store.cashbook) || `<tr><td colspan='5'><div class='empty-state'><strong>${financeLoading ? 'Đang tải sổ thu chi' : 'Chưa có giao dịch'}</strong></div></td></tr>`}</tbody></table></div><div class='pagination'><span>Hiển thị ${store.cashbook.length} trên ${number(financeMovementTotal)} giao dịch</span></div></section>` : '';
    const customerPanel = canViewFullFinance ? `<section class='panel'><div class='panel-header'><h2>Khách hàng còn nợ</h2></div><div class='activity-list'>${financeTopCustomers.map(function (customer) { return `<div class='activity-item'><span class='avatar'>${esc(initials(customer.name))}</span><span class='activity-text'><strong>${esc(customer.name)}</strong><small>${esc(customer.phone)}</small></span><span class='activity-amount'>${moneyVndText(customer.debt)}</span></div>`; }).join('') || `<div class='empty-state'><strong>Không có công nợ khách hàng</strong></div>`}</div></section>` : '';
    const supplierPanel = store.role === 'cashier' ? '' : `<section class='panel'><div class='panel-header'><h2>Nhà cung cấp</h2><span>${canManageSuppliers ? `<button class='link-button' data-action='new-supplier'>＋ Thêm</button>` : ''}${canReceivePurchases ? `<button class='link-button' data-action='receive-stock'>＋ Nhập hàng</button>` : ''}</span></div><div class='activity-list'>${store.suppliers.map(function (supplier) { return `<div class='activity-item'><span class='activity-mark'>${icon('truck', 14)}</span><span class='activity-text'><strong>${esc(supplier.name)}</strong><small>${canViewFullFinance ? supplier.debt ? 'Còn phải trả' : 'Không còn nợ' : 'Dùng trong phiếu nhập hàng'}</small></span>${canViewFullFinance ? `<span class='activity-amount'>${money(supplier.debt)}</span>${canRecord && supplier.debt > 0 ? `<button class='link-button' data-action='supplier-payment' data-id='${supplier.id}'>Thanh toán</button>` : ''}` : ''}</div>`; }).join('') || `<div class='empty-state'><strong>Chưa có nhà cung cấp</strong><span>${isStockkeeper ? 'Tạo hồ sơ nhà cung cấp hoặc nhập hàng để bắt đầu.' : 'Nhập hàng để theo dõi công nợ.'}</span></div>`}</div></section>`;
    const sidePanels = [customerPanel, supplierPanel].filter(Boolean).join('');
    const layout = cashbookPanel || sidePanels ? `<div class='finance-layout'>${cashbookPanel}${sidePanels ? `<div class='stack'>${sidePanels}</div>` : ''}</div>` : '';
    return `${heading}${cashSessionPanel}${metrics}${financeError ? `<div class='notice-item'><span>⚠️</span><span><strong>Chưa tải đủ dữ liệu</strong><small>${esc(financeError)}</small></span></div>` : ''}${layout}`;
  }

  function purchaseHistoryPanel() {
    const rows = purchaseHistory.map(function (purchase) {
      return `<tr><td><button class='link-button order-ref' data-action='purchase-detail' data-id='${purchase.id}'>${esc(purchase.number)}</button></td><td>${esc(purchase.supplierName || 'Không chỉ định')}</td><td>${humanDate(purchase.receivedAt, true)}</td><td>${number(purchase.items.length)} dòng</td><td class='text-right'><strong>${money(purchase.total)}</strong></td></tr>`;
    }).join('');
    return `<section class='panel' style='margin-top:14px'><div class='panel-header'><div><h2>Phiếu nhập gần đây</h2><p>${purchaseHistory.length ? 'Tối đa 50 phiếu mới nhất' : 'Lịch sử nhận hàng của cửa hàng'}</p></div><button class='link-button' data-action='receive-stock'>＋ Nhập hàng</button></div><div class='table-wrap'><table class='data-table'><thead><tr><th>Mã phiếu</th><th>Nhà cung cấp</th><th>Ngày nhận</th><th>Số dòng</th><th class='text-right'>Tổng tiền</th></tr></thead><tbody>${rows || `<tr><td colspan='5'><div class='empty-state'><strong>${financeLoading ? 'Đang tải phiếu nhập' : 'Chưa có phiếu nhập'}</strong><span>Phiếu nhập mới sẽ hiện ở đây.</span></div></td></tr>`}</tbody></table></div></section>`;
  }

  function openPurchaseDetail(id) {
    const purchase = purchaseHistory.find(function (item) { return item.id === id; });
    if (!purchase) return;
    const rows = purchase.items.map(function (item) {
      return `<tr><td><span class='product-name-stack'><strong>${esc(item.productName)}</strong><small>${esc(item.sku)}</small></span></td><td>${number(Number(item.quantity))} ${esc(item.unit)}</td><td class='text-right'>${money(Number(item.unitCostVnd))}</td><td class='text-right'><strong>${money(Number(item.totalVnd))}</strong></td></tr>`;
    }).join('');
    const body = `<div class='summary-banner'><div><strong>${esc(purchase.supplierName || 'Không chỉ định nhà cung cấp')}</strong><small>${humanDate(purchase.receivedAt, true)} · ${esc(purchase.status === 'received' ? 'Đã nhận hàng' : purchase.status)}</small></div><strong>${money(purchase.total)}</strong></div><div class='table-wrap' style='margin-top:14px'><table class='data-table'><thead><tr><th>Sản phẩm</th><th>Số lượng</th><th class='text-right'>Giá nhập</th><th class='text-right'>Thành tiền</th></tr></thead><tbody>${rows}</tbody></table></div>${purchase.note ? `<div class='modal-note'>${esc(purchase.note)}</div>` : ''}`;
    showModal(`Phiếu nhập ${purchase.number}`, 'Chi tiết hàng đã nhận và giá nhập được ghi vào sổ.', body, `<button class='btn btn-secondary' data-action='close-modal'>Đóng</button>`, true);
  }

  function renderSettings() {
    const canEdit = ['owner', 'manager'].includes(store.role);
    const disabled = canEdit ? '' : 'disabled';
    return pageHeading('Cài đặt cửa hàng', 'Thông tin này xuất hiện trên khu vực quản lý và biên nhận bán hàng.', '') +
      `<section class='panel settings-panel'><h2>Thông tin cửa hàng</h2><p>Tên cửa hàng, số điện thoại, địa chỉ và lời chào trên biên nhận.</p><form id='entity-form' data-form='settings' data-version='${store.settings.version || 1}'><div class='form-grid'><div class='form-field full'><label class='input-label' for='setting-store-name'>Tên cửa hàng *</label><input class='input' id='setting-store-name' name='storeName' value='${esc(store.settings.storeName)}' required minlength='2' maxlength='160' ${disabled}/></div><div class='form-field'><label class='input-label' for='setting-phone'>Số điện thoại</label><input class='input' id='setting-phone' name='phone' value='${esc(store.settings.phone)}' inputmode='tel' maxlength='40' ${disabled}/></div><div class='form-field full'><label class='input-label' for='setting-address'>Địa chỉ</label><input class='input' id='setting-address' name='address' value='${esc(store.settings.address)}' maxlength='300' ${disabled}/></div><div class='form-field full'><label class='input-label' for='setting-footer'>Lời chào cuối biên nhận</label><input class='input' id='setting-footer' name='receiptFooter' value='${esc(store.settings.receiptFooter)}' maxlength='240' placeholder='Cảm ơn quý khách' ${disabled}/></div></div>${canEdit ? `<div class='modal-footer' style='padding:17px 0 0;margin-top:12px'><button class='btn btn-primary' type='submit'>Lưu thay đổi</button></div>` : `<div class='install-hint'>Chỉ chủ cửa hàng và quản lý mới được sửa thông tin.</div>`}</form><div class='install-hint' style='margin-top:18px'>Cài đặt này được lưu cùng dữ liệu cửa hàng và dùng trên các thiết bị đã đăng nhập. Sao lưu và khôi phục cần quy trình máy chủ riêng.</div></section>`;
  }

  function renderStaff() {
    if (store.role !== 'owner') return `<section class='panel locked-page'><div class='empty-icon'>${icon('users', 23)}</div><h2>Không có quyền quản lý nhân viên</h2><p>Chỉ chủ cửa hàng mới có thể mời, phân quyền hoặc tạm khóa thành viên.</p></section>`;
    const memberRows = staffState.members.map(function (member) {
      const joined = member.joined_at ? humanDate(member.joined_at) : 'Chưa có ngày tham gia';
      return `<article class='staff-row'><div class='staff-person'><span class='avatar'>${esc(initials(member.display_name))}</span><span><strong>${esc(member.display_name)}</strong><small>${esc(member.email)} · Tham gia ${esc(joined)}</small></span></div><div class='staff-controls'><label><span>Vai trò</span><select class='input' data-member-role='${member.user_id}'>${Array.from(['manager', 'cashier', 'stockkeeper', 'accountant']).map(function (role) { return `<option value='${role}' ${member.role === role ? 'selected' : ''}>${staffRoleName(role)}</option>`; }).join('')}</select></label><label><span>Trạng thái</span><select class='input' data-member-status='${member.user_id}'><option value='active' ${member.status === 'active' ? 'selected' : ''}>Đang hoạt động</option><option value='suspended' ${member.status === 'suspended' ? 'selected' : ''}>Tạm khóa</option></select></label><button class='btn btn-secondary' data-action='save-staff-member' data-id='${member.user_id}'>Lưu</button></div></article>`;
    }).join('');
    const inviteRows = staffState.invitations.map(function (invite) {
      const pendingInvite = invite.status === 'pending';
      const canResend = pendingInvite || invite.status === 'expired';
      const statusLabel = { pending: 'Đang chờ', accepted: 'Đã tham gia', revoked: 'Đã thu hồi', expired: 'Đã hết hạn' }[invite.status] || invite.status;
      return `<article class='staff-invite-row'><div><strong>${esc(invite.email)}</strong><small>${staffRoleName(invite.role)} · Hết hạn ${humanDate(invite.expires_at)}</small></div><span class='badge ${pendingInvite ? 'badge-warning' : invite.status === 'accepted' ? 'badge-success' : 'badge-neutral'}'><i class='badge-dot'></i>${statusLabel}</span>${canResend ? `<div class='staff-invite-actions'><button class='link-button' data-action='resend-staff-invite' data-id='${invite.id}'>Gửi lại</button>${pendingInvite ? `<button class='link-button danger-text' data-action='revoke-staff-invite' data-id='${invite.id}'>Thu hồi</button>` : ''}</div>` : ''}</article>`;
    }).join('');
    return pageHeading('Quản lý nhân viên', 'Mời thành viên bằng email và kiểm soát quyền truy cập cửa hàng.', `<button class='btn btn-primary' data-action='new-staff-invite'>${icon('plus', 15)} Mời nhân viên</button>`) +
      `${staffState.error ? `<div class='auth-message error'>${esc(staffState.error)} <button class='link-button' data-action='reload-staff'>Tải lại</button></div>` : ''}<section class='panel staff-panel'><div class='panel-header'><div><h2>Thành viên</h2><p>Chủ cửa hàng không thể bị tạm khóa hoặc hạ quyền tại đây.</p></div><span class='badge badge-info'><i class='badge-dot'></i>${staffState.members.length} nhân viên</span></div>${staffState.loading ? `<div class='empty-state'><strong>Đang tải thành viên…</strong></div>` : memberRows ? `<div class='staff-list'>${memberRows}</div>` : `<div class='empty-state'><strong>Chưa có nhân viên</strong><span>Mời người đầu tiên để phân chia công việc tại cửa hàng.</span></div>`}</section><section class='panel staff-panel'><div class='panel-header'><div><h2>Lời mời</h2><p>Liên kết chỉ dùng một lần, hết hạn sau 7 ngày và cần xác minh email.</p></div></div>${inviteRows ? `<div class='staff-list'>${inviteRows}</div>` : `<div class='empty-state'><strong>Chưa có lời mời</strong><span>Lời mời đang chờ sẽ xuất hiện ở đây.</span></div>`}</section><div class='staff-role-note'><strong>Vai trò không thể cấp quyền chủ cửa hàng.</strong><span>Quản lý nhân viên chỉ được thực hiện bởi chủ cửa hàng. Mọi thay đổi vai trò và trạng thái đều được ghi vào nhật ký cửa hàng.</span></div>`;
  }

  function render() {
    if (!authSession) { renderAuth(); return; }
    renderShell();
    const renderers = { dashboard: renderDashboard, products: renderProducts, pos: renderPOS, orders: renderOrders, customers: renderCustomers, inventory: renderInventory, finance: renderFinance, reports: renderReports, settings: renderSettings, staff: renderStaff };
    const pageHtml = renderers[page] ? renderers[page]() : `<section class='panel locked-page'><div class='empty-icon'>${icon('clock', 23)}</div><h2>Đang hoàn thiện</h2><p>Khu vực này đang được kết nối với dữ liệu cửa hàng và quy trình lưu sổ. Các thao tác mẫu đã được khóa để tránh tạo giao dịch không có thật.</p><button class='btn btn-primary' data-route='products'>Mở danh mục sản phẩm</button></section>`;
    root.innerHTML = page === 'finance' && store.role !== 'cashier' ? pageHtml + purchaseHistoryPanel() : pageHtml;
    if (page === 'pos') { const oldSearch = document.activeElement && document.activeElement.id === 'pos-search'; if (oldSearch) document.getElementById('pos-search').focus(); }
  }

  function showModal(title, subtitle, body, footer, wide) {
    if (modal.hidden) {
      const active = document.activeElement;
      modalReturnFocus = active && active !== document.body && !modal.contains(active) ? active : null;
    }
    modalGeneration += 1;
    modal.className = 'modal' + (wide ? ' wide' : '');
    modal.innerHTML = `<div class='modal-head'><div><h2 id='modal-title'>${esc(title)}</h2><p id='modal-description'>${esc(subtitle || '')}</p></div><button class='modal-close' data-action='close-modal' aria-label='Đóng'>×</button></div><div class='modal-body'>${body || ''}</div>${footer ? `<div class='modal-footer'>${footer}</div>` : ''}`;
    modal.hidden = false; backdrop.hidden = false; document.body.style.overflow = 'hidden';
    const first = modal.querySelector('input:not([type=hidden]),select,button'); if (first) window.setTimeout(function () { first.focus(); }, 40);
  }

  function closeModal() {
    const wasOpen = !modal.hidden;
    modal.hidden = true;
    backdrop.hidden = true;
    document.body.style.overflow = '';
    if (!wasOpen) return;
    const focusTarget = modalReturnFocus;
    modalReturnFocus = null;
    if (focusTarget && focusTarget.isConnected && !focusTarget.disabled) window.requestAnimationFrame(function () {
      if (modal.hidden) focusTarget.focus();
    });
  }

  function keepModalFocus(event) {
    if (modal.hidden || event.key !== 'Tab') return;
    const focusable = Array.from(modal.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'))
      .filter(function (element) { return !element.hidden && element.getAttribute('aria-hidden') !== 'true' && element.getClientRects().length > 0; });
    if (!focusable.length) {
      event.preventDefault();
      modal.setAttribute('tabindex', '-1');
      modal.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  }

  function modalForm(title, subtitle, form, submitLabel, wide) {
    showModal(title, subtitle, form + `<div class='modal-note'>Các thay đổi sẽ được lưu vào dữ liệu cửa hàng trên máy chủ.</div>`, `<button class='btn btn-secondary' type='button' data-action='close-modal'>Hủy</button><button class='btn btn-primary' type='submit' form='entity-form'>${submitLabel || 'Lưu thông tin'}</button>`, wide);
  }

  const productImportHeaders = ['Mã SKU', 'Mã vạch', 'Tên sản phẩm', 'Danh mục', 'Đơn vị', 'Giá bán (VND)', 'Giá vốn (VND)', 'Ngưỡng tồn tối thiểu', 'Theo dõi tồn kho (Có/Không)', 'Tồn đầu kỳ'];

  function formatImportQuantity(value) {
    const match = /^(\d{1,10})(?:\.(\d{1,3}))?$/.exec(String(value ?? '0'));
    if (!match) return '0';
    const whole = BigInt(match[1]).toLocaleString('vi-VN');
    const fraction = (match[2] || '').padEnd(3, '0').replace(/0+$/, '');
    return whole + (fraction ? `,${fraction}` : '');
  }

  function totalImportQuantity(rows) {
    const totalMilliUnits = rows.reduce(function (sum, item) {
      const match = /^(\d{1,10})(?:\.(\d{1,3}))?$/.exec(String(item.openingQuantity ?? '0'));
      if (!match) return sum;
      return sum + BigInt(match[1]) * 1000n + BigInt((match[2] || '').padEnd(3, '0') || '0');
    }, 0n);
    const whole = (totalMilliUnits / 1000n).toLocaleString('vi-VN');
    const fraction = String(totalMilliUnits % 1000n).padStart(3, '0').replace(/0+$/, '');
    return whole + (fraction ? `,${fraction}` : '');
  }

  function parseCsvDocument(text) {
    const source = String(text || '').replace(/^\uFEFF/, '');
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    let quoteClosed = false;
    let physicalLine = 1;
    let rowStartLine = 1;
    for (let index = 0; index < source.length; index += 1) {
      const character = source[index];
      if (quoted) {
        if (character === '"' && source[index + 1] === '"') { field += '"'; index += 1; }
        else if (character === '"') { quoted = false; quoteClosed = true; }
        else {
          field += character;
          if (character === '\r' || character === '\n') {
            if (character !== '\n' || source[index - 1] !== '\r') physicalLine += 1;
          }
        }
        continue;
      }
      if (character === '"') {
        if (field.length || quoteClosed) throw new Error('Dấu ngoặc kép trong tệp CSV chưa đúng định dạng.');
        quoted = true;
      } else if (character === ',') {
        row.push(field); field = ''; quoteClosed = false;
      } else if (character === '\n' || character === '\r') {
        if (character === '\r' && source[index + 1] === '\n') index += 1;
        row.push(field); rows.push({ cells: row, line: rowStartLine }); row = []; field = ''; quoteClosed = false;
        physicalLine += 1;
        rowStartLine = physicalLine;
      } else if (quoteClosed) {
        if (!/\s/.test(character)) throw new Error('Có ký tự thừa sau trường CSV được đặt trong dấu ngoặc kép.');
      } else field += character;
    }
    if (quoted) throw new Error('Tệp CSV có trường chưa đóng dấu ngoặc kép.');
    if (field.length || row.length || quoteClosed) { row.push(field); rows.push({ cells: row, line: rowStartLine }); }
    return rows;
  }

  function parseProductImportCsv(text) {
    let parsed;
    try { parsed = parseCsvDocument(text); }
    catch (error) { return { items: [], errors: [error.message] }; }
    const rows = parsed.filter(function (record, index) { return index === 0 || record.cells.some(function (cell) { return String(cell || '').trim() !== ''; }); });
    if (!rows.length) return { items: [], errors: ['Tệp CSV đang trống.'] };
    const headers = rows[0].cells.map(function (cell) { return String(cell || '').trim(); });
    if (headers.length !== productImportHeaders.length || productImportHeaders.some(function (header, index) { return headers[index] !== header; })) {
      return { items: [], errors: ['Tiêu đề cột không đúng mẫu Slink. Hãy tải mẫu CSV rồi điền dữ liệu vào.'] };
    }
    const dataRows = rows.slice(1);
    const errors = [];
    if (!dataRows.length) errors.push('Tệp chưa có dòng sản phẩm nào.');
    if (dataRows.length > 200) errors.push('Mỗi lần nhập tối đa 200 sản phẩm. Hãy chia tệp thành nhiều phần.');
    const seenSkus = new Map();
    const seenBarcodes = new Map();
    const items = [];
    dataRows.slice(0, 200).forEach(function (record) {
      const line = record.line;
      const cells = record.cells;
      const rowErrors = [];
      if (cells.length !== productImportHeaders.length) rowErrors.push(`Dòng ${line}: số cột không khớp mẫu.`);
      const values = productImportHeaders.map(function (_header, cellIndex) { return String(cells[cellIndex] || '').trim(); });
      const sku = values[0];
      const barcode = values[1] || null;
      const name = values[2];
      const category = values[3] || 'Chưa phân loại';
      const unit = values[4] || 'cái';
      if (!sku || sku.length > 80) rowErrors.push(`Dòng ${line}: mã SKU cần có từ 1 đến 80 ký tự.`);
      if (!name || name.length > 240) rowErrors.push(`Dòng ${line}: tên sản phẩm cần có từ 1 đến 240 ký tự.`);
      if (category.length > 120) rowErrors.push(`Dòng ${line}: danh mục tối đa 120 ký tự.`);
      if (unit.length > 40) rowErrors.push(`Dòng ${line}: đơn vị tối đa 40 ký tự.`);
      if (barcode && (barcode.length < 3 || barcode.length > 80)) rowErrors.push(`Dòng ${line}: mã vạch phải có từ 3 đến 80 ký tự.`);

      function integerVnd(value, label, required) {
        if (!value && !required) return 0;
        if (!/^\d+$/.test(value)) { rowErrors.push(`Dòng ${line}: ${label} phải là VND nguyên không âm, không dùng dấu phân cách.`); return 0; }
        const amount = Number(value);
        if (!Number.isSafeInteger(amount)) { rowErrors.push(`Dòng ${line}: ${label} vượt giới hạn số an toàn.`); return 0; }
        return amount;
      }
      function quantity(value, label) {
        if (!value) return 0;
        if (!/^\d{1,10}(?:\.\d{1,3})?$/.test(value)) { rowErrors.push(`Dòng ${line}: ${label} phải không âm và có tối đa 3 chữ số thập phân.`); return 0; }
        return value;
      }

      const salePriceVnd = integerVnd(values[5], 'Giá bán', true);
      const costVnd = integerVnd(values[6], 'Giá vốn', false);
      const lowStockThreshold = quantity(values[7], 'Ngưỡng tồn tối thiểu');
      const trackedText = values[8].toLocaleLowerCase('vi');
      let inventoryTracked = true;
      if (trackedText === 'không' || trackedText === 'khong') inventoryTracked = false;
      else if (trackedText && trackedText !== 'có' && trackedText !== 'co') rowErrors.push(`Dòng ${line}: cột theo dõi tồn kho chỉ nhận “Có” hoặc “Không”.`);
      const openingQuantity = quantity(values[9], 'Tồn đầu kỳ');
      if (!inventoryTracked && openingQuantity > 0) rowErrors.push(`Dòng ${line}: sản phẩm không theo dõi tồn kho phải có tồn đầu kỳ bằng 0.`);
      const normalizedSku = sku.toLocaleLowerCase('vi');
      if (sku && seenSkus.has(normalizedSku)) rowErrors.push(`Dòng ${line}: SKU trùng với dòng ${seenSkus.get(normalizedSku)} trong tệp.`);
      else if (sku) seenSkus.set(normalizedSku, line);
      if (barcode && seenBarcodes.has(barcode)) rowErrors.push(`Dòng ${line}: mã vạch trùng với dòng ${seenBarcodes.get(barcode)} trong tệp.`);
      else if (barcode) seenBarcodes.set(barcode, line);
      if (rowErrors.length) errors.push(...rowErrors);
      else items.push({ sku: sku, barcode: barcode, name: name, category: category, unit: unit, salePriceVnd: salePriceVnd, costVnd: costVnd, lowStockThreshold: lowStockThreshold, inventoryTracked: inventoryTracked, openingQuantity: openingQuantity, sourceLine: line });
    });
    return { items: errors.length ? [] : items, errors: errors };
  }

  function renderProductImportPreview() {
    const preview = modal.querySelector('#product-import-preview');
    const submit = modal.querySelector('button[type="submit"][form="entity-form"]');
    if (!preview) return;
    if (productImportReading) {
      preview.innerHTML = `<div class='notice-item' role='status'><span>…</span><span><strong>Đang đọc tệp CSV</strong><small>Đợi Slink kiểm tra tệp trước khi gửi.</small></span></div>`;
    } else if (productImportErrors.length) {
      preview.innerHTML = `<div class='auth-message error'><strong>Chưa thể nhập tệp.</strong><br/>${productImportErrors.slice(0, 8).map(esc).join('<br/>')}${productImportErrors.length > 8 ? `<br/>Còn ${productImportErrors.length - 8} lỗi khác.` : ''}</div>`;
    } else if (productImportRows.length) {
      preview.innerHTML = `<div class='notice-item'><span>✓</span><span><strong>${number(productImportRows.length)} sản phẩm sẵn sàng xem trước</strong><small>Tổng tồn đầu kỳ: ${totalImportQuantity(productImportRows)}. Cuộn trong bảng để rà soát toàn bộ; mọi dòng sẽ được ghi cùng nhau hoặc không dòng nào được ghi.</small></span></div><div class='table-wrap'><table class='data-table'><thead><tr><th>SKU / mã vạch</th><th>Sản phẩm</th><th class='text-right'>Giá bán / giá vốn</th><th class='text-right'>Tồn đầu kỳ / ngưỡng</th><th>Theo dõi tồn</th></tr></thead><tbody>${productImportRows.map(function (item) { return `<tr><td><span class='product-name-stack'><strong>${esc(item.sku)}</strong><small>Mã vạch: ${esc(item.barcode || 'Không có')}</small></span></td><td><span class='product-name-stack'><strong>${esc(item.name)}</strong><small>${esc(item.category)} · ${esc(item.unit)}</small></span></td><td class='text-right'><span class='product-name-stack'><strong>${money(Number(item.salePriceVnd))}</strong><small>Giá vốn ${money(Number(item.costVnd))}</small></span></td><td class='text-right'><span class='product-name-stack'><strong>${formatImportQuantity(item.openingQuantity)} ${esc(item.unit)}</strong><small>Nhắc khi còn ${formatImportQuantity(item.lowStockThreshold)}</small></span></td><td>${item.inventoryTracked ? 'Có' : 'Không'}</td></tr>`; }).join('')}</tbody></table></div>`;
    } else preview.innerHTML = `<div class='empty-state'><strong>Chưa chọn tệp</strong><span>Tải mẫu CSV, điền danh mục rồi chọn tệp để kiểm tra trước khi gửi.</span></div>`;
    if (submit) submit.disabled = productImportReading || productImportRows.length === 0 || productImportErrors.length > 0;
  }

  function openProductImport() {
    const pending = loadPendingProductImport();
    productImportReading = false;
    productImportRows = pending ? pending.payload.items : [];
    productImportErrors = [];
    const body = `<form id='entity-form' data-form='product-import'><div class='form-field full'><label class='input-label' for='product-import-file'>Chọn tệp danh mục CSV</label><input class='input' id='product-import-file' type='file' accept='.csv,text/csv' ${pending ? 'disabled' : ''}/></div><div class='modal-note'>Tối đa 200 sản phẩm mỗi lần. Giá bán và giá vốn nhập bằng VND nguyên, không dùng dấu phân cách hàng nghìn. Tồn đầu kỳ hỗ trợ tối đa 3 chữ số thập phân, dùng dấu chấm cho phần lẻ. SKU hoặc mã vạch trùng với dữ liệu cửa hàng sẽ làm hủy toàn bộ lần nhập.</div><button class='link-button' type='button' data-action='download-product-import-template'>Tải mẫu CSV</button><div id='product-import-preview' class='product-import-preview' aria-live='polite'></div></form>`;
    const footer = `<button class='btn btn-secondary' type='button' data-action='close-modal'>Đóng</button><button class='btn btn-primary' type='submit' form='entity-form'>${pending ? 'Gửi lại lần nhập đang chờ' : 'Nhập sản phẩm'}</button>`;
    showModal(pending ? 'Kiểm tra lần nhập đang chờ' : 'Nhập sản phẩm từ CSV', pending ? 'Gửi lại cùng nội dung để máy chủ xác nhận mà không tạo trùng.' : 'Xem trước tệp. Tồn đầu kỳ và danh mục sẽ được ghi nguyên tử trên máy chủ.', body, footer, true);
    renderProductImportPreview();
  }

  function downloadProductImportTemplate() {
    const csv = '\uFEFF' + productImportHeaders.map(function (header) { return '"' + header.replace(/"/g, '""') + '"'; }).join(',') + '\r\n';
    download('slink-mau-nhap-san-pham.csv', csv, 'text/csv;charset=utf-8');
  }

  function openProduct(id) {
    const p = id ? productById(id) : null;
    const form = `<form id='entity-form' data-form='product' data-id='${p ? p.id : ''}' data-version='${p ? p.version : ''}'><div class='form-grid'><div class='form-field full'><label class='input-label'>Tên sản phẩm *</label><input class='input' name='name' value='${esc(p ? p.name : '')}' placeholder='Ví dụ: Cà phê rang xay' required maxlength='240'/></div><div class='form-field'><label class='input-label'>Mã SKU *</label><input class='input' name='sku' value='${esc(p ? p.sku : '')}' placeholder='VD: CF-250' required maxlength='80'/></div><div class='form-field'><label class='input-label'>Mã vạch</label><input class='input' name='barcode' value='${esc(p ? p.barcode : '')}' placeholder='Nhập mã vạch nếu có' maxlength='80'/></div><div class='form-field'><label class='input-label'>Danh mục</label><input class='input' name='category' list='categories' value='${esc(p ? p.category : '')}' placeholder='Chọn hoặc nhập mới'/><datalist id='categories'>${Array.from(new Set(store.products.map(function (x) { return x.category; }))).map(function (x) { return `<option value='${esc(x)}'></option>`; }).join('')}</datalist></div><div class='form-field'><label class='input-label'>Đơn vị tính</label><input class='input' name='unit' value='${esc(p ? p.unit : 'cái')}' placeholder='cái, hộp, kg' maxlength='40'/></div><div class='form-field'><label class='input-label'>Giá bán (VND) *</label><input class='input' name='price' type='number' min='0' step='1' value='${p ? p.price : ''}' placeholder='0' required/></div><div class='form-field'><label class='input-label'>Giá vốn (VND)</label><input class='input' name='cost' type='number' min='0' step='1' value='${p ? p.cost : ''}' placeholder='0'/></div><div class='form-field'><label class='input-label'>Nhắc khi còn</label><input class='input' name='minStock' type='number' min='0' step='0.001' value='${p ? p.minStock : '5'}'/></div>${p ? `<div class='form-field'><label class='input-label'>Tồn kho hiện tại</label><div class='input' aria-readonly='true'>${number(p.stock)} ${esc(p.unit)}</div></div>` : `<div class='form-field full'><div class='modal-note'>Sản phẩm mới bắt đầu với tồn kho bằng 0. Số lượng chỉ thay đổi qua nghiệp vụ kho.</div></div>`}</div></form>`;
    const footer = `<button class='btn btn-secondary' type='button' data-action='close-modal'>Hủy</button>${p && ['owner', 'manager', 'stockkeeper'].includes(store.role) ? `<button class='btn btn-secondary' type='button' data-action='adjust-stock' data-id='${p.id}'>Kiểm kê tồn</button>` : ''}${p ? `<button class='btn btn-danger' type='button' data-action='archive-product' data-id='${p.id}'>Lưu trữ</button>` : ''}<button class='btn btn-primary' type='submit' form='entity-form'>${p ? 'Lưu thay đổi' : 'Thêm sản phẩm'}</button>`;
    showModal(p ? 'Cập nhật sản phẩm' : 'Thêm sản phẩm mới', p ? 'Chỉnh sửa thông tin sản phẩm. Tồn kho được theo dõi riêng.' : 'Thêm một mặt hàng vào danh mục cửa hàng.', form, footer, true);
  }

  function openCustomer(id) {
    const c = id ? customerById(id) : null;
    const pending = !c ? loadPendingCustomer() : null;
    const saved = pending ? pending.payload : c;
    const disabled = pending ? 'disabled' : '';
    const canSetOpeningBalance = ['owner', 'manager', 'accountant'].includes(store.role);
    const openingField = !c && canSetOpeningBalance ? `<div class='form-field full'><label class='input-label' for='customer-opening-balance'>Công nợ ban đầu (VND)</label><input class='input' id='customer-opening-balance' name='openingBalanceVnd' type='number' inputmode='numeric' min='0' step='1' value='${esc(saved ? saved.openingBalanceVnd : '0')}' ${disabled}/><small>Số khách còn nợ trước khi bắt đầu dùng Slink. Đây là bút toán công nợ, không ghi tiền vào sổ thu chi.</small></div>` : '';
    const form = `<form id='entity-form' data-form='customer' data-id='${c ? c.id : ''}' data-version='${c ? c.version : ''}'><div class='form-grid'><div class='form-field'><label class='input-label'>Tên khách hàng *</label><input class='input' name='name' value='${esc(saved ? saved.name : '')}' required maxlength='160' placeholder='Họ và tên' ${disabled}/></div><div class='form-field'><label class='input-label'>Số điện thoại</label><input class='input' name='phone' value='${esc(saved ? saved.phone : '')}' inputmode='tel' placeholder='09xx xxx xxx' ${disabled}/></div><div class='form-field full'><label class='input-label'>Email (không bắt buộc)</label><input class='input' type='email' name='email' value='${esc(saved ? saved.email : '')}' placeholder='ten@example.com' ${disabled}/></div>${openingField}<div class='form-field full'><label class='input-label'>Ghi chú</label><textarea class='input' name='note' rows='2' placeholder='Lưu ý khi chăm sóc' style='height:auto;padding:10px' ${disabled}>${esc(saved ? saved.note || '' : '')}</textarea></div></div></form>`;
    modalForm(pending ? 'Kiểm tra khách hàng đang chờ' : c ? 'Cập nhật khách hàng' : 'Thêm khách hàng', pending ? 'Gửi lại đúng nội dung đã lưu trên thiết bị để máy chủ xác nhận, tránh tạo trùng.' : 'Lưu thông tin để theo dõi lịch sử mua và công nợ.', form, pending ? 'Gửi lại khách hàng' : c ? 'Lưu thay đổi' : 'Lưu khách hàng');
  }

  function openSupplier() {
    const pending = loadPendingSupplier();
    const saved = pending ? pending.payload : null;
    const disabled = pending ? 'disabled' : '';
    const canSetOpeningBalance = ['owner', 'manager', 'accountant'].includes(store.role);
    const openingBalanceField = canSetOpeningBalance
      ? `<div class='form-field full'><label class='input-label' for='supplier-opening-payable'>Khoản phải trả ban đầu (VND)</label><input class='input' id='supplier-opening-payable' name='openingPayableVnd' type='number' inputmode='numeric' min='0' step='1' value='${esc(saved ? saved.openingPayableVnd : '0')}' ${disabled}/><small>Số còn nợ trước khi bắt đầu dùng Slink. Không ghi khoản này thành tiền chi. Nếu tên đã có, khoản nợ sẽ được cộng vào hồ sơ nhà cung cấp đó.</small></div>`
      : `<input type='hidden' name='openingPayableVnd' value='0'/><div class='form-field full'><small>Khoản phải trả ban đầu do chủ cửa hàng, quản lý hoặc kế toán ghi nhận.</small></div>`;
    const form = `<form id='entity-form' data-form='supplier'><div class='form-grid'><div class='form-field full'><label class='input-label' for='supplier-name'>Tên nhà cung cấp *</label><input class='input' id='supplier-name' name='name' value='${esc(saved ? saved.name : '')}' required maxlength='160' placeholder='Tên doanh nghiệp hoặc người bán' ${disabled}/></div>${openingBalanceField}</div></form>`;
    modalForm(pending ? 'Kiểm tra nhà cung cấp đang chờ' : 'Thêm nhà cung cấp', pending ? 'Gửi lại đúng nội dung đã lưu để máy chủ xác nhận, tránh ghi nợ hai lần.' : 'Tạo hồ sơ và ghi sổ phải trả ban đầu nếu có.', form, pending ? 'Gửi lại nhà cung cấp' : 'Lưu nhà cung cấp');
  }

  const checkoutMethods = [
    ['cash', 'Tiền mặt'], ['bank_qr', 'QR ngân hàng · xác nhận thủ công'],
    ['bank_transfer', 'Chuyển khoản · xác nhận thủ công'], ['card', 'Thẻ · xác nhận thủ công'], ['other', 'Khác'],
  ];

  function checkoutTenderRow(tender, index, count, disabled) {
    const options = checkoutMethods.map(function (method) { return `<option value='${method[0]}' ${tender.method === method[0] ? 'selected' : ''}>${method[1]}</option>`; }).join('');
    return `<div class='checkout-tender-row' data-tender-row><div class='form-field'><label class='input-label' for='tender-method-${index}'>Phương thức ${index + 1}</label><div class='select-wrap'><select class='input' id='tender-method-${index}' data-tender-method ${disabled}>${options}</select></div></div><div class='form-field'><label class='input-label' for='tender-amount-${index}'>Số tiền (VND)</label><input class='input' id='tender-amount-${index}' data-tender-amount type='number' inputmode='numeric' min='0' step='1' value='${esc(tender.amountReceivedVnd)}' required ${disabled}/></div>${count > 1 ? `<button class='row-action checkout-tender-remove' type='button' data-action='remove-tender' data-index='${index}' aria-label='Xóa khoản thanh toán ${index + 1}' ${disabled}>×</button>` : ''}</div>`;
  }

  function checkoutTenderValues(form) {
    return Array.from(form.querySelectorAll('[data-tender-row]')).map(function (row) {
      return {
        method: row.querySelector('[data-tender-method]').value,
        amountText: row.querySelector('[data-tender-amount]').value,
      };
    });
  }

  function updateCheckoutTenderSummary(form) {
    const summary = form && form.querySelector('#checkout-tender-summary');
    if (!summary) return;
    const total = Number(form.dataset.totalVnd || 0);
    let received = 0;
    let cash = 0;
    let nonCash = 0;
    for (const tender of checkoutTenderValues(form)) {
      const amountReceived = Number(tender.amountText);
      if (!Number.isSafeInteger(amountReceived) || amountReceived < 0) {
        summary.textContent = 'Nhập số tiền VND nguyên không âm cho từng phương thức.';
        summary.classList.add('error');
        return;
      }
      received += amountReceived;
      if (tender.method === 'cash') cash += amountReceived;
      else nonCash += amountReceived;
    }
    if (nonCash > total || (received > total && cash === 0)) {
      summary.textContent = nonCash > total ? 'Khoản không tiền mặt không được vượt tổng đơn.' : 'Chỉ tiền mặt mới có thể tạo tiền thối.';
      summary.classList.add('error');
      return;
    }
    const paid = nonCash + Math.min(cash, Math.max(0, total - nonCash));
    const change = received - paid;
    const due = Math.max(0, total - paid);
    summary.textContent = `Tổng nhận ${money(received)} · Đã thu ${money(paid)} · Còn nợ ${money(due)}${change ? ` · Tiền thối ${money(change)}` : ''}`;
    summary.classList.remove('error');
  }

  function renderCheckoutTenders(form, tenders) {
    const container = form.querySelector('#checkout-tenders');
    if (!container) return;
    container.innerHTML = tenders.map(function (tender, index) {
      return checkoutTenderRow(tender, index, tenders.length, checkoutPendingPayload ? 'disabled' : '');
    }).join('');
    const addButton = form.querySelector('[data-action="add-tender"]');
    if (addButton) addButton.disabled = tenders.length >= 5 || Boolean(checkoutPendingPayload);
    updateCheckoutTenderSummary(form);
  }

  function openCheckout() {
    if (!cart.length && !checkoutPendingPayload) return toast('Giỏ hàng đang trống', 'Chọn sản phẩm trước khi thanh toán.', 'error');
    const pending = checkoutPendingPayload;
    const totals = pending ? { total: Number(pending.totalVnd), count: pending.items.reduce(function (sum, item) { return sum + Number(item.quantity); }, 0) } : cartTotals();
    const selectedCustomer = pending ? pending.customerId || '' : cartCustomerId;
    const selectedTenders = pending
      ? (Array.isArray(pending.tenders) && pending.tenders.length ? pending.tenders : [{ method: pending.method || 'cash', amountReceivedVnd: pending.amountReceivedVnd || 0 }])
      : [{ method: 'cash', amountReceivedVnd: totals.total }];
    const selectedNote = pending ? pending.note || '' : '';
    const disabled = pending ? 'disabled' : '';
    const customers = `<option value=''>Khách lẻ</option>` + store.customers.map(function (c) { return `<option value='${c.id}' ${selectedCustomer === c.id ? 'selected' : ''}>${esc(c.name)} · ${esc(c.phone)}</option>`; }).join('');
    if (!checkoutIdempotencyKey) checkoutIdempotencyKey = newIdempotencyKey();
    const body = `<form id='entity-form' data-form='checkout' data-total-vnd='${totals.total}'><div class='checkout-total'><span>Khách cần thanh toán</span><strong>${money(totals.total)}</strong></div><div class='form-grid'><div class='form-field full'><label class='input-label'>Khách hàng</label><div class='select-wrap'><select class='input' name='customerId' ${disabled}>${customers}</select></div></div><div class='form-field full'><span class='input-label'>Các khoản thanh toán</span><div id='checkout-tenders'>${selectedTenders.map(function (tender, index) { return checkoutTenderRow(tender, index, selectedTenders.length, disabled); }).join('')}</div>${pending ? '' : `<button class='link-button' type='button' data-action='add-tender'>＋ Thêm phương thức thanh toán</button>`}<div id='checkout-tender-summary' class='checkout-tender-summary' aria-live='polite'></div></div><div class='form-field full'><label class='input-label'>Ghi chú đơn hàng</label><input class='input' name='note' value='${esc(pending ? pending.note : '')}' placeholder='Ghi chú không bắt buộc' ${disabled}/></div></div><div class='modal-note'>${pending ? 'Slink chưa nhận được xác nhận hoàn tất từ lần gửi trước. Hãy thử lại đúng yêu cầu đã gửi; hệ thống sẽ không tạo đơn trùng.' : 'Có thể chia số tiền giữa nhiều phương thức. Khoản không tiền mặt không được vượt tổng đơn; tiền mặt nhận dư sẽ được tính phần thối. Chuyển khoản, QR và thẻ hiện được nhân viên xác nhận thủ công.'}</div></form>`;
    showModal(pending ? 'Kiểm tra đơn hàng đang chờ' : 'Xác nhận thanh toán', `${totals.count} sản phẩm trong đơn · ${money(totals.total)}`, body, `<button class='btn btn-secondary' type='button' data-action='close-modal'>Để sau</button><button class='btn btn-primary' type='submit' form='entity-form'>${pending ? 'Thử lại đơn hàng' : 'Hoàn tất đơn hàng'}</button>`);
    updateCheckoutTenderSummary(modal.querySelector('[data-form="checkout"]'));
  }

  function openStockAdjust(id) {
    const p = productById(id);
    if (!p) return toast('Chọn sản phẩm cần kiểm kê', '', 'error');
    const pending = loadPendingStock(p.id);
    const disabled = pending ? 'disabled' : '';
    const form = `<form id='entity-form' data-form='adjust-stock' data-id='${p.id}' data-inventory-version='${p.inventoryVersion}'><div class='customer-header' style='padding:0 0 14px'><span class='product-thumb large ${p.tone}'>${esc(p.emoji)}</span><span><h2 style='font-size:12px;margin:0 0 4px'>${esc(p.name)}</h2><p>${esc(p.sku)} · Tồn hiện tại: ${p.stock} ${esc(p.unit)}</p></span></div><div class='form-grid'><div class='form-field'><label class='input-label'>Số lượng thực đếm *</label><input class='input' name='count' type='number' min='0' step='0.001' value='${pending ? esc(pending.payload.count) : p.stock}' required ${disabled}/></div><div class='form-field'><label class='input-label'>Lý do điều chỉnh</label><div class='select-wrap'><select class='input' name='reason' ${disabled}><option ${pending && pending.payload.reason === 'Kiểm kê thực tế' ? 'selected' : ''}>Kiểm kê thực tế</option><option ${pending && pending.payload.reason === 'Hàng hư hỏng' ? 'selected' : ''}>Hàng hư hỏng</option><option ${pending && pending.payload.reason === 'Hàng thất lạc' ? 'selected' : ''}>Hàng thất lạc</option><option ${pending && pending.payload.reason === 'Điều chỉnh nhập đầu kỳ' ? 'selected' : ''}>Điều chỉnh nhập đầu kỳ</option></select></div></div></div>${pending ? `<div class='modal-note'>Thay đổi này đang chờ xác nhận. Hãy gửi lại cùng nội dung để tránh ghi tồn hai lần.</div>` : ''}</form>`;
    showModal('Kiểm kê sản phẩm', 'Slink ghi lại phần chênh lệch và lý do vào sổ kho.', form, `<button class='btn btn-secondary' type='button' data-action='close-modal'>Hủy</button><button class='btn btn-primary' type='submit' form='entity-form'>${pending ? 'Thử lại cập nhật tồn' : 'Cập nhật tồn kho'}</button>`);
  }

  function openReceive() {
    const suppliers = store.suppliers.map(function (s) { return `<option value='${esc(s.name)}'>${esc(s.name)}</option>`; }).join('');
    const pending = loadPendingPurchase();
    const selectedProduct = pending ? pending.payload.productId : (store.products[0] && store.products[0].id || '');
    const selectedIsLoaded = store.products.some(function (p) { return p.id === selectedProduct; });
    const options = store.products.map(function (p) { return `<option value='${p.id}' ${p.id === selectedProduct ? 'selected' : ''}>${esc(p.name)} · ${esc(p.sku)}</option>`; }).join('');
    const selectedOption = selectedProduct && !selectedIsLoaded ? `<option value='${esc(selectedProduct)}' selected>Phiếu đang chờ · ${esc(pending && pending.productName || 'sản phẩm đã chọn')}</option>` : '';
    const selectedProductRecord = store.products.find(function (p) { return p.id === selectedProduct; });
    const selectedCost = pending ? pending.payload.unitCostVnd : selectedProductRecord ? selectedProductRecord.cost : '';
    const disabled = pending ? 'disabled' : '';
    const form = `<form id='entity-form' data-form='receive'><div class='form-grid'><div class='form-field full'><label class='input-label'>Tìm sản phẩm</label><input class='input' id='purchase-product-search' type='search' placeholder='Tên hoặc mã SKU…' ${disabled}/></div><div class='form-field full'><label class='input-label'>Sản phẩm *</label><div class='select-wrap'><select class='input' name='productId' data-purchase-product required ${disabled}>${selectedOption}${options}</select></div></div><div class='form-field'><label class='input-label'>Số lượng nhập *</label><input class='input' name='qty' type='number' min='0.001' step='0.001' value='${pending ? esc(pending.payload.quantity) : '1'}' required ${disabled}/></div><div class='form-field'><label class='input-label'>Giá nhập / đơn vị (VND) *</label><input class='input' name='cost' data-purchase-cost type='number' min='0' step='1' value='${esc(selectedCost)}' placeholder='Giá vốn hiện tại' required ${disabled}/></div><div class='form-field full'><label class='input-label'>Nhà cung cấp</label><input class='input' name='supplierName' list='suppliers' value='${pending ? esc(pending.payload.supplierName) : ''}' placeholder='Nhập tên để theo dõi công nợ' ${disabled}/><datalist id='suppliers'>${suppliers}</datalist></div><div class='form-field'><label class='input-label'>Đã thanh toán (VND)</label><input class='input' name='paid' type='number' min='0' step='1' value='${pending ? esc(pending.payload.amountPaidVnd) : '0'}' ${disabled}/></div><div class='form-field'><label class='input-label'>Phương thức</label><div class='select-wrap'><select class='input' name='method' ${disabled}><option value='cash' ${!pending || pending.payload.method === 'cash' ? 'selected' : ''}>Tiền mặt</option><option value='bank_transfer' ${pending && pending.payload.method === 'bank_transfer' ? 'selected' : ''}>Chuyển khoản</option><option value='bank_qr' ${pending && pending.payload.method === 'bank_qr' ? 'selected' : ''}>QR ngân hàng</option></select></div></div><div class='form-field full'><label class='input-label'>Ghi chú phiếu nhập</label><input class='input' name='note' maxlength='500' value='${pending ? esc(pending.payload.note) : ''}' placeholder='Số hóa đơn, lô hàng…' ${disabled}/></div></div>${pending ? `<div class='modal-note'>Phiếu nhập đang chờ xác nhận. Gửi lại cùng nội dung để tránh cộng tồn kho hai lần.</div>` : `<div class='modal-note'>Phiếu nhập sẽ tăng tồn, cập nhật giá vốn và ghi khoản thanh toán hoặc công nợ nhà cung cấp.</div>`}</form>`;
    showModal(pending ? 'Kiểm tra phiếu nhập đang chờ' : 'Tạo phiếu nhập hàng', 'Ghi nhận hàng đã nhận từ nhà cung cấp.', form, `<button class='btn btn-secondary' type='button' data-action='close-modal'>Hủy</button><button class='btn btn-primary' type='submit' form='entity-form'>${pending ? 'Thử lại phiếu nhập' : 'Xác nhận nhập kho'}</button>`, true);
  }

  function openSupplierPayment(supplierId) {
    const supplier = store.suppliers.find(function (item) { return item.id === supplierId; });
    if (!supplier) return toast('Không tìm thấy nhà cung cấp', 'Tải lại sổ công nợ rồi thử lại.', 'error');
    const pending = loadPendingSupplierPayment(supplierId);
    const disabled = pending ? 'disabled' : '';
    const amountVnd = pending ? pending.payload.amountVnd : supplier.debt;
    const form = `<form id='entity-form' data-form='supplier-payment' data-id='${supplier.id}'><div class='checkout-total'><span>Còn phải trả ${esc(supplier.name)}</span><strong>${money(supplier.debt)}</strong></div><div class='form-grid'><div class='form-field full'><label class='input-label'>Số tiền thanh toán (VND) *</label><input class='input' name='amount' type='number' min='1' max='${supplier.debt}' step='1' value='${esc(amountVnd)}' required ${disabled}/></div><div class='form-field'><label class='input-label'>Phương thức</label><div class='select-wrap'><select class='input' name='method' ${disabled}><option value='cash' ${!pending || pending.payload.method === 'cash' ? 'selected' : ''}>Tiền mặt</option><option value='bank_transfer' ${pending && pending.payload.method === 'bank_transfer' ? 'selected' : ''}>Chuyển khoản</option><option value='bank_qr' ${pending && pending.payload.method === 'bank_qr' ? 'selected' : ''}>QR ngân hàng</option><option value='card' ${pending && pending.payload.method === 'card' ? 'selected' : ''}>Thẻ</option><option value='other' ${pending && pending.payload.method === 'other' ? 'selected' : ''}>Khác</option></select></div></div><div class='form-field'><label class='input-label'>Ghi chú</label><input class='input' name='note' maxlength='300' value='${pending ? esc(pending.payload.note) : ''}' placeholder='Mã giao dịch hoặc nội dung chuyển tiền' ${disabled}/></div></div>${pending ? `<div class='modal-note'>Khoản thanh toán đang chờ xác nhận. Gửi lại cùng nội dung để tránh ghi sổ hai lần.</div>` : `<div class='modal-note'>Slink ghi khoản đã thanh toán vào công nợ nhà cung cấp và sổ chi. Chuyển khoản và QR hiện được nhân viên xác nhận thủ công.</div>`}</form>`;
    showModal(pending ? 'Kiểm tra khoản thanh toán đang chờ' : 'Thanh toán nhà cung cấp', `Số dư hiện tại · ${money(supplier.debt)}`, form, `<button class='btn btn-secondary' type='button' data-action='close-modal'>Để sau</button><button class='btn btn-primary' type='submit' form='entity-form'>${pending ? 'Thử lại khoản thanh toán' : 'Ghi nhận thanh toán'}</button>`);
  }

  function openExpense() {
    const pending = loadPendingCash();
    const disabled = pending ? 'disabled' : '';
    const payload = pending ? pending.payload : { direction: 'out', amountVnd: '', category: 'Vận hành', method: 'cash', note: '' };
    const form = `<form id='entity-form' data-form='cash'><div class='form-grid'><div class='form-field'><label class='input-label'>Loại giao dịch</label><div class='select-wrap'><select class='input' name='type' ${disabled}><option value='out' ${payload.direction === 'out' ? 'selected' : ''}>Phiếu chi</option><option value='in' ${payload.direction === 'in' ? 'selected' : ''}>Phiếu thu khác</option></select></div></div><div class='form-field'><label class='input-label'>Số tiền (VND) *</label><input class='input' name='amount' type='number' min='1' step='1' required value='${esc(payload.amountVnd)}' placeholder='0' ${disabled}/></div><div class='form-field'><label class='input-label'>Khoản mục</label><div class='select-wrap'><select class='input' name='category' ${disabled}>${['Vận hành', 'Điện nước', 'Thuê mặt bằng', 'Nhập hàng', 'Thu khác', 'Hoàn tiền'].map(function (name) { return `<option ${payload.category === name ? 'selected' : ''}>${name}</option>`; }).join('')}</select></div></div><div class='form-field'><label class='input-label'>Phương thức</label><div class='select-wrap'><select class='input' name='method' ${disabled}><option value='cash' ${payload.method === 'cash' ? 'selected' : ''}>Tiền mặt</option><option value='bank_transfer' ${payload.method === 'bank_transfer' ? 'selected' : ''}>Chuyển khoản</option><option value='bank_qr' ${payload.method === 'bank_qr' ? 'selected' : ''}>QR ngân hàng</option><option value='card' ${payload.method === 'card' ? 'selected' : ''}>Thẻ</option><option value='other' ${payload.method === 'other' ? 'selected' : ''}>Khác</option></select></div></div><div class='form-field full'><label class='input-label'>Nội dung</label><input class='input' name='note' maxlength='300' value='${esc(payload.note)}' placeholder='Ghi chú cho giao dịch này' ${disabled}/></div></div>${pending ? `<div class='modal-note'>Phiếu đang chờ xác nhận. Hãy gửi lại cùng nội dung để tránh ghi sổ hai lần.</div>` : ''}</form>`;
    showModal(pending ? 'Kiểm tra phiếu đang chờ' : 'Ghi phiếu thu / chi', 'Ghi lại giao dịch để đối soát sổ quỹ.', form, `<button class='btn btn-secondary' type='button' data-action='close-modal'>Hủy</button><button class='btn btn-primary' type='submit' form='entity-form'>${pending ? 'Thử lại phiếu' : 'Lưu giao dịch'}</button>`);
  }

  function openCashSessionForm() {
    const pending = loadPendingCashSessionOpen();
    const initial = pending ? pending.payload.openingFloatVnd : cashRegisterState.lastClosed ? cashRegisterState.lastClosed.countedCashVnd : '0';
    const disabled = pending ? 'disabled' : '';
    const form = `<form id='entity-form' data-form='cash-session-open'><div class='form-field'><label class='input-label' for='cash-session-opening'>Tiền mặt có sẵn trong quầy (VND) *</label><input class='input' id='cash-session-opening' name='openingFloatVnd' type='number' inputmode='numeric' min='0' step='1' value='${esc(initial)}' required ${disabled}/></div><div class='modal-note'>Nhập số tiền thực tế đã đếm trước khi bắt đầu bán. Giao dịch tiền mặt sẽ được gắn vào ca này cho đến khi chốt ca.</div></form>`;
    showModal(pending ? 'Kiểm tra yêu cầu mở ca' : 'Mở ca tiền mặt', pending ? 'Gửi lại đúng số tiền đầu ca để xác nhận trạng thái.' : 'Xác nhận số tiền ban đầu có trong quầy.', form, `<button class='btn btn-secondary' type='button' data-action='close-modal'>Hủy</button><button class='btn btn-primary' type='submit' form='entity-form'>${pending ? 'Kiểm tra yêu cầu' : 'Bắt đầu ca'}</button>`);
  }

  function openCashSessionCloseForm() {
    const session = cashRegisterState.session;
    if (!session) return toast('Không có ca đang mở', 'Tải lại trạng thái ca trước khi chốt.', 'error');
    const pending = loadPendingCashSessionClose(session.id);
    const expected = pending ? pending.payload.countedCashVnd : session.expectedCashVnd;
    const note = pending ? pending.payload.note : '';
    const disabled = pending ? 'disabled' : '';
    const form = `<form id='entity-form' data-form='cash-session-close' data-session-id='${session.id}'><div class='summary-banner'><div><strong>Số tiền Slink dự kiến</strong><small>Đầu ca ${moneyVndText(session.openingFloatVnd)} · thu ${moneyVndText(session.cashInVnd)} · chi ${moneyVndText(session.cashOutVnd)}</small></div><strong>${moneyVndText(session.expectedCashVnd)}</strong></div><div class='form-grid' style='margin-top:14px'><div class='form-field full'><label class='input-label' for='cash-session-counted'>Tiền mặt thực đếm (VND) *</label><input class='input' id='cash-session-counted' name='countedCashVnd' type='number' inputmode='numeric' min='0' step='1' value='${esc(expected)}' required ${disabled}/></div><div class='form-field full'><label class='input-label' for='cash-session-note'>Lý do khi có chênh lệch</label><textarea class='input' id='cash-session-note' name='note' rows='2' maxlength='500' placeholder='Bắt buộc nếu tiền đếm khác số dự kiến' style='height:auto;padding:10px' ${disabled}>${esc(note)}</textarea></div></div><div class='modal-note'>Nếu số đếm lệch, Slink sẽ ghi bút toán chênh lệch vào sổ thu chi và lưu lý do cùng người chốt.</div></form>`;
    showModal(pending ? 'Kiểm tra yêu cầu chốt ca' : 'Chốt ca tiền mặt', 'Đếm tiền mặt trong quầy rồi nhập tổng thực tế.', form, `<button class='btn btn-secondary' type='button' data-action='close-modal'>Để sau</button><button class='btn btn-primary' type='submit' form='entity-form'>${pending ? 'Kiểm tra yêu cầu' : 'Xác nhận chốt ca'}</button>`);
  }

  function validCashSessionAmount(value) {
    const text = String(value == null ? '' : value).trim();
    if (!/^(0|[1-9]\d{0,15})$/.test(text)) return null;
    const amount = BigInt(text);
    return amount <= 9007199254740991n ? text : null;
  }

  async function saveCashSessionOpen(form) {
    let pending = loadPendingCashSessionOpen();
    if (!pending) {
      const openingFloatVnd = validCashSessionAmount(new FormData(form).get('openingFloatVnd'));
      if (openingFloatVnd === null) return toast('Tiền đầu ca không hợp lệ', 'Nhập số VND nguyên không âm, tối đa 9.007.199.254.740.991.', 'error');
      pending = { storeId: store.id, key: newIdempotencyKey(), payload: { openingFloatVnd: openingFloatVnd } };
    }
    if (!savePendingCashSessionOpen(pending)) return pendingSaveFailed();
    const submitButton = modal.querySelector('button[type="submit"][form="entity-form"]');
    if (submitButton) submitButton.disabled = true;
    try {
      await apiRequest(`/api/stores/${encodeURIComponent(store.id)}/cash-register/open`, {
        method: 'POST', headers: { 'idempotency-key': pending.key }, body: pending.payload,
      });
      clearPendingCashSessionOpen();
      closeModal();
      await loadFinancePage();
      render();
      toast('Đã mở ca tiền mặt', 'Các giao dịch tiền mặt mới sẽ được đối soát trong ca này.');
    } catch (error) {
      if (error.status === 401) showSignedOut('Phiên đăng nhập đã hết hạn. Đăng nhập lại để kiểm tra yêu cầu mở ca.', 'error');
      else if (error.status >= 400 && error.status < 500 && !['idempotency_conflict', 'request_in_progress'].includes(error.code)) {
        clearPendingCashSessionOpen();
        if (!modal.hidden) form.querySelectorAll('input').forEach(function (field) { field.disabled = false; });
        if (error.code === 'cash_session_already_open') await loadFinancePage();
      }
      toast('Chưa mở được ca tiền mặt', error.message, 'error');
      if (submitButton && !modal.hidden) submitButton.disabled = false;
    }
  }

  async function saveCashSessionClose(form) {
    const sessionId = form.dataset.sessionId;
    let pending = loadPendingCashSessionClose(sessionId);
    if (!pending) {
      const data = new FormData(form);
      const countedCashVnd = validCashSessionAmount(data.get('countedCashVnd'));
      const note = String(data.get('note') || '').trim();
      if (countedCashVnd === null) return toast('Tiền thực đếm không hợp lệ', 'Nhập số VND nguyên không âm, tối đa 9.007.199.254.740.991.', 'error');
      pending = { storeId: store.id, sessionId: sessionId, key: newIdempotencyKey(), payload: { sessionId: sessionId, countedCashVnd: countedCashVnd, note: note } };
    }
    if (!savePendingCashSessionClose(pending)) return pendingSaveFailed();
    const submitButton = modal.querySelector('button[type="submit"][form="entity-form"]');
    if (submitButton) submitButton.disabled = true;
    try {
      const result = await apiRequest(`/api/stores/${encodeURIComponent(store.id)}/cash-register/${encodeURIComponent(sessionId)}/close`, {
        method: 'POST', headers: { 'idempotency-key': pending.key }, body: pending.payload,
      });
      clearPendingCashSessionClose(sessionId);
      closeModal();
      await loadFinancePage();
      render();
      const variance = result.session.varianceVnd;
      toast('Đã chốt ca tiền mặt', variance === '0' ? 'Tiền thực đếm khớp số dự kiến.' : `Chênh lệch đã ghi nhận: ${moneyVndText(variance)}.`);
    } catch (error) {
      if (error.status === 401) showSignedOut('Phiên đăng nhập đã hết hạn. Đăng nhập lại để kiểm tra yêu cầu chốt ca.', 'error');
      else if (error.status >= 400 && error.status < 500 && !['idempotency_conflict', 'request_in_progress'].includes(error.code)) {
        clearPendingCashSessionClose(sessionId);
        if (!modal.hidden) form.querySelectorAll('input,textarea').forEach(function (field) { field.disabled = false; });
        if (error.code === 'cash_session_not_open') await loadFinancePage();
      }
      toast('Chưa chốt được ca tiền mặt', error.message, 'error');
      if (submitButton && !modal.hidden) submitButton.disabled = false;
    }
  }

  async function openOrder(id) {
    if (!id) return;
    let o;
    try {
      const result = await apiRequest(`/api/stores/${encodeURIComponent(store.id)}/orders/${encodeURIComponent(id)}`);
      const row = result.order;
      const payments = row.payments.filter(function (p) { return p.status === 'succeeded'; });
      const paid = payments.reduce(function (sum, p) { return sum + Number(p.amount_vnd); }, 0);
      const refunded = row.returns.reduce(function (sum, r) { return sum + Number(r.refunded_vnd); }, 0);
      const returned = row.returns.reduce(function (sum, r) { return sum + Number(r.refund_total_vnd); }, 0);
      const total = Number(row.totalVnd);
      const methodLabels = { cash: 'Tiền mặt', bank_transfer: 'Chuyển khoản', bank_qr: 'QR ngân hàng', card: 'Thẻ', other: 'Khác' };
      o = {
        id: row.id,
        number: row.number,
        customerId: row.customerId || '',
        createdAt: row.occurredAt,
        subtotal: Number(row.subtotalVnd),
        discount: Number(row.discountVnd),
        total: total,
        paid: paid,
        cashReceived: Number(row.cashReceivedVnd || 0),
        cashChange: Number(row.cashChangeVnd || 0),
        paymentLines: payments.map(function (payment) { return { method: methodLabels[payment.method] || payment.method, amount: Number(payment.amount_vnd) }; }),
        refunded: refunded,
        returned: returned,
        due: row.status === 'voided' ? 0 : Math.max(0, total - paid - returned + refunded),
        status: statusText(row.status, total - paid - returned + refunded),
        rawStatus: row.status,
        method: Array.from(new Set(payments.map(function (p) { return methodLabels[p.method] || p.method; }))).join(' · ') || 'Chưa thu tiền',
        note: row.note || '',
        items: row.items.map(function (line) {
          return {
            orderLineId: line.id,
            productId: line.product_id,
            name: line.product_name_snapshot,
            sku: line.sku_snapshot,
            unit: line.unit_snapshot,
            qty: Number(line.quantity),
            returnedQty: Number(line.returned_quantity),
            price: Number(line.unit_price_vnd),
            cost: Number(line.unit_cost_vnd),
            discount: Number(line.discount_vnd),
            total: Number(line.line_total_vnd),
          };
        }),
        returns: row.returns,
      };
      const cached = store.orders.find(function (item) { return item.id === o.id; });
      if (cached) Object.assign(cached, o);
      else store.orders.unshift(o);
    } catch (error) {
      return toast('Chưa tải được đơn hàng', error.message, 'error');
    }
    const c = customerById(o.customerId);
    const items = o.items.map(function (i) { return `<div class='detail-line'><span>${esc(i.name)} <small>× ${number(i.qty)} ${esc(i.unit)}</small></span><strong>${money(i.total)}</strong></div>`; }).join('');
    const returnHistory = o.returns.map(function (r) { return `<div class='timeline-item'><span class='timeline-dot'></span><span><strong>Trả hàng ${esc(r.return_number)}</strong><small>${humanDate(r.occurred_at, true)} · ${money(Number(r.refund_total_vnd))}</small></span></div>`; }).join('');
    const body = `<div class='order-details'><section class='panel detail-card'><div class='detail-heading'><div><h2>${esc(o.number)}</h2><p>${humanDate(o.createdAt, true)}${c ? ' · ' + esc(c.name) : ' · Khách lẻ'}</p></div>${statusBadge(o.status)}</div><div class='detail-lines'>${items}<div class='detail-line'><span>Tạm tính</span><strong>${money(o.subtotal)}</strong></div>${o.discount ? `<div class='detail-line'><span>Giảm giá</span><strong>−${money(o.discount)}</strong></div>` : ''}<div class='detail-line'><span>Tổng đã thu</span><strong>${money(o.paid)}</strong></div>${o.paymentLines.map(function (payment) { return `<div class='detail-line'><span>· ${esc(payment.method)}</span><strong>${money(payment.amount)}</strong></div>`; }).join('')}${o.cashReceived ? `<div class='detail-line'><span>Tiền mặt khách đưa</span><strong>${money(o.cashReceived)}</strong></div>` : ''}${o.cashChange ? `<div class='detail-line'><span>Tiền thối</span><strong>−${money(o.cashChange)}</strong></div>` : ''}${o.refunded ? `<div class='detail-line'><span>Đã hoàn tiền</span><strong>−${money(o.refunded)}</strong></div>` : ''}${o.due ? `<div class='detail-line'><span>Còn phải thu</span><strong style='color:#aa762a'>${money(o.due)}</strong></div>` : ''}<div class='detail-total'><span>Tổng cộng</span><strong>${money(o.total)}</strong></div></div></section><section class='panel detail-card'><div class='section-title'><h2>Thông tin giao dịch</h2><p>Biên nhận và thay đổi được lưu trên máy chủ</p></div><div class='order-timeline'><div class='timeline-item'><span class='timeline-dot'></span><span><strong>Đơn hàng đã tạo</strong><small>${humanDate(o.createdAt, true)}</small></span></div><div class='timeline-item'><span class='timeline-dot'></span><span><strong>${o.due > 0 ? 'Còn khoản phải thu' : 'Đã đối soát khoản thu'}</strong><small>${money(o.paid)} · ${esc(o.method)}</small></span></div>${returnHistory}${c ? `<div class='timeline-item'><span class='timeline-dot'></span><span><strong>Khách hàng: ${esc(c.name)}</strong><small>${esc(c.phone)}</small></span></div>` : ''}</div>${o.note ? `<div class='modal-note'>${esc(o.note)}</div>` : ''}</section></div>`;
    const footer = `<button class='btn btn-secondary' data-action='close-modal'>Đóng</button><button class='btn btn-secondary' data-action='print-order' data-id='${o.id}'>In biên nhận</button>${o.due > 0 && o.customerId && ['owner', 'manager', 'cashier', 'accountant'].includes(store.role) ? `<button class='btn btn-secondary' data-action='collect-payment' data-id='${o.id}'>Ghi nhận thu tiền</button>` : ''}${['owner', 'manager'].includes(store.role) && o.rawStatus === 'completed' && o.paid === 0 && o.returned === 0 ? `<button class='btn btn-danger' data-action='void-order' data-id='${o.id}'>Hủy đơn</button>` : ''}${['owner', 'manager'].includes(store.role) && o.status !== 'Đã hủy' && o.items.some(function (item) { return item.returnedQty < item.qty; }) ? `<button class='btn btn-danger' data-action='return-order' data-id='${o.id}'>Trả hàng</button>` : ''}`;
    showModal('Chi tiết đơn hàng', 'Kiểm tra sản phẩm, khoản thu và lịch sử trả hàng.', body, footer, true);
  }

  function openVoidOrder(orderId) {
    const form = `<form id='entity-form' data-form='void-order' data-id='${esc(orderId)}'><div class='notice-item'><span>⚠️</span><span><strong>Hủy đơn sẽ hoàn lại tồn kho và xóa khoản nợ của đơn bằng bút toán đảo.</strong><small>Đơn đã thu tiền phải xử lý qua trả hàng/hoàn tiền. Lịch sử đơn và lý do hủy vẫn được giữ lại.</small></span></div><label class='install-hint' style='display:flex;align-items:flex-start;gap:9px;margin-top:14px'><input type='checkbox' name='stockConfirmed' required style='margin-top:2px;flex:none'/>Tôi xác nhận hàng chưa giao hoặc đã được đưa lại cửa hàng.</label><div class='form-field full' style='margin-top:14px'><label class='input-label' for='void-reason'>Lý do hủy *</label><textarea class='input' id='void-reason' name='reason' rows='3' required minlength='1' maxlength='450' placeholder='Ví dụ: tạo nhầm đơn trước khi thu tiền' style='height:auto;padding:10px'></textarea></div></form>`;
    modalForm('Hủy đơn hàng', 'Chỉ hủy được đơn chưa thu tiền và chưa trả hàng.', form, 'Xác nhận hủy đơn', true);
  }

  async function saveVoidOrder(form) {
    const orderId = form.dataset.id;
    const reason = String(new FormData(form).get('reason') || '').trim();
    if (!reason) return toast('Cần nhập lý do', 'Ghi lý do để cửa hàng có thể truy vết việc hủy.', 'error');
    const submit = modal.querySelector('button[type="submit"][form="entity-form"]');
    if (submit) submit.disabled = true;
    try {
      const result = await apiRequest(`/api/stores/${encodeURIComponent(store.id)}/orders/${encodeURIComponent(orderId)}/void`, {
        method: 'POST', body: { reason: reason, stockConfirmed: new FormData(form).get('stockConfirmed') === 'on' },
      });
      closeModal();
      await Promise.all([
        loadProductsPage('', 0), loadInventoryPage('', 0), loadCustomersPage('', 0),
        loadOrdersPage('', 0), loadFinancePage(),
      ]);
      render();
      toast(result.alreadyVoided ? 'Đơn đã được hủy trước đó' : 'Đã hủy đơn hàng', 'Tồn kho và công nợ đã được cập nhật bằng bút toán đảo.');
      await openOrder(orderId);
    } catch (error) {
      if (error.status === 401) showSignedOut('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.', 'error');
      else toast('Chưa hủy được đơn hàng', error.message, 'error');
      if (submit && submit.isConnected) submit.disabled = false;
    }
  }

  async function openCollectPayment(orderId) {
    let order;
    try {
      const result = await apiRequest(`/api/stores/${encodeURIComponent(store.id)}/orders/${encodeURIComponent(orderId)}`);
      order = result.order;
    } catch (error) { return toast('Chưa tải được đơn hàng', error.message, 'error'); }
    const pending = loadPendingPayment(orderId);
    const paid = order.payments.filter(function (p) { return p.status === 'succeeded'; }).reduce(function (sum, payment) { return sum + Number(payment.amount_vnd); }, 0);
    const refunded = order.returns.reduce(function (sum, row) { return sum + Number(row.refunded_vnd); }, 0);
    const returned = order.returns.reduce(function (sum, row) { return sum + Number(row.refund_total_vnd); }, 0);
    const due = Math.max(0, Number(order.totalVnd) - paid - returned + refunded);
    if (!due && !pending) return toast('Đơn hàng đã thanh toán đủ', 'Không còn khoản cần thu.');
    const payload = pending ? pending.payload : { amountVnd: due, method: 'cash', note: '' };
    const disabled = pending ? 'disabled' : '';
    const body = `<form id='entity-form' data-form='payment' data-order-id='${orderId}'><div class='checkout-total'><span>Còn phải thu · ${esc(order.number)}</span><strong>${money(due)}</strong></div><div class='form-grid'><div class='form-field'><label class='input-label'>Số tiền nhận (VND) *</label><input class='input' name='amountVnd' type='number' min='1' max='${due}' step='1' value='${esc(payload.amountVnd)}' required ${disabled}/></div><div class='form-field'><label class='input-label'>Phương thức nhận tiền</label><div class='select-wrap'><select class='input' name='method' ${disabled}><option value='cash' ${payload.method === 'cash' ? 'selected' : ''}>Tiền mặt</option><option value='bank_transfer' ${payload.method === 'bank_transfer' ? 'selected' : ''}>Chuyển khoản</option><option value='bank_qr' ${payload.method === 'bank_qr' ? 'selected' : ''}>QR ngân hàng</option><option value='card' ${payload.method === 'card' ? 'selected' : ''}>Thẻ</option><option value='other' ${payload.method === 'other' ? 'selected' : ''}>Khác</option></select></div></div><div class='form-field full'><label class='input-label'>Ghi chú</label><input class='input' name='note' maxlength='300' value='${esc(payload.note || '')}' placeholder='Ghi chú không bắt buộc' ${disabled}/></div></div><div class='modal-note'>Slink ghi khoản thu vào đơn hàng, công nợ khách và sổ quỹ. Chuyển khoản và QR được nhân viên xác nhận thủ công.</div>${pending ? `<div class='modal-note'>Yêu cầu thu tiền đang chờ xác nhận. Hãy gửi lại cùng nội dung để tránh ghi nhận hai lần.</div>` : ''}</form>`;
    showModal(pending ? 'Kiểm tra khoản thu đang chờ' : 'Ghi nhận khách thanh toán', 'Ghi lại số tiền khách vừa trả cho đơn hàng.', body, `<button class='btn btn-secondary' type='button' data-action='close-modal'>Quay lại đơn</button><button class='btn btn-primary' type='submit' form='entity-form'>${pending ? 'Thử lại khoản thu' : 'Lưu khoản thu'}</button>`);
  }

  async function savePayment(form) {
    const orderId = form.dataset.orderId;
    let pending = loadPendingPayment(orderId);
    if (!pending) {
      const data = new FormData(form);
      const amount = Number(data.get('amountVnd'));
      if (!Number.isSafeInteger(amount) || amount <= 0) return toast('Số tiền không hợp lệ', 'Nhập số tiền bằng VND nguyên dương.', 'error');
      pending = { storeId: store.id, orderId: orderId, key: newIdempotencyKey(), payload: { amountVnd: amount, method: String(data.get('method') || 'cash'), note: String(data.get('note') || '').trim() } };
    }
    if (!savePendingPayment(pending)) return pendingSaveFailed();
    const submitButton = modal.querySelector('button[type="submit"][form="entity-form"]');
    if (submitButton) submitButton.disabled = true;
    try {
      const result = await apiRequest(`/api/stores/${encodeURIComponent(store.id)}/orders/${encodeURIComponent(orderId)}/payments`, {
        method: 'POST', headers: { 'idempotency-key': pending.key }, body: pending.payload,
      });
      clearPendingPayment(orderId);
      closeModal();
      await Promise.all([loadCustomersPage(searchTerms.customers, customerOffset), loadOrdersPage(searchTerms.orders, orderOffset)]);
      toast('Đã ghi nhận khoản thu', money(Number(result.payment.amountVnd)));
      await openOrder(orderId);
    } catch (error) {
      if (error.status === 401) showSignedOut('Phiên đăng nhập đã hết hạn. Đăng nhập lại để kiểm tra khoản thu.', 'error');
      else if (error.status >= 400 && error.status < 500 && !['idempotency_conflict', 'request_in_progress'].includes(error.code)) {
        clearPendingPayment(orderId);
        if (!modal.hidden) openCollectPayment(orderId);
      }
      toast('Chưa lưu được khoản thu', error.message, 'error');
      if (submitButton && !modal.hidden) submitButton.disabled = false;
    }
  }

  async function openReturn(orderId) {
    let order;
    try {
      const result = await apiRequest(`/api/stores/${encodeURIComponent(store.id)}/orders/${encodeURIComponent(orderId)}`);
      order = result.order;
    } catch (error) {
      return toast('Chưa tải được đơn hàng', error.message, 'error');
    }
    const saved = loadPendingReturn(orderId);
    returnPending = saved;
    const returnMap = new Map((saved && saved.payload.items || []).map(function (item) { return [item.orderLineId, Number(item.quantity)]; }));
    const lines = order.items.filter(function (line) { return Number(line.returned_quantity) < Number(line.quantity); });
    if (!lines.length) return toast('Đơn hàng đã trả đủ', 'Không còn sản phẩm nào có thể trả.');
    const lineMarkup = lines.map(function (line) {
      const remaining = Number(line.quantity) - Number(line.returned_quantity);
      const quantity = returnMap.has(line.id) ? returnMap.get(line.id) : 0;
      const disabled = saved ? 'disabled' : '';
      return `<div class='detail-line' style='gap:12px'><span>${esc(line.product_name_snapshot)}<small> Còn trả ${number(remaining)} ${esc(line.unit_snapshot)}</small></span><input class='input' data-return-line='${line.id}' type='number' min='0' max='${remaining}' step='0.001' value='${quantity}' aria-label='Số lượng trả ${esc(line.product_name_snapshot)}' style='max-width:125px' ${disabled}/></div>`;
    }).join('');
    const disabled = saved ? 'disabled' : '';
    const reason = saved ? saved.payload.reason : '';
    const restock = saved ? saved.payload.restockPolicy : 'restock';
    const refundMethod = saved ? saved.payload.refundMethod : 'cash';
    const body = `<form id='entity-form' data-form='return' data-order-id='${orderId}'><div class='checkout-total'><span>Đơn hàng</span><strong>${esc(order.number)}</strong></div><div class='detail-lines'>${lineMarkup}</div><div class='form-grid' style='margin-top:14px'><div class='form-field full'><label class='input-label'>Lý do trả hàng *</label><input class='input' name='reason' required minlength='2' maxlength='500' value='${esc(reason)}' placeholder='Ví dụ: đổi size, sản phẩm lỗi' ${disabled}/></div><div class='form-field'><label class='input-label'>Tình trạng hàng</label><div class='select-wrap'><select class='input' name='restockPolicy' ${disabled}><option value='restock' ${restock === 'restock' ? 'selected' : ''}>Còn bán được · nhập lại kho</option><option value='damaged' ${restock === 'damaged' ? 'selected' : ''}>Hư hỏng · không nhập kho</option><option value='discarded' ${restock === 'discarded' ? 'selected' : ''}>Bỏ hàng · không nhập kho</option></select></div></div><div class='form-field'><label class='input-label'>Phương thức hoàn tiền</label><div class='select-wrap'><select class='input' name='refundMethod' ${disabled}><option value='cash' ${refundMethod === 'cash' ? 'selected' : ''}>Tiền mặt</option><option value='bank_transfer' ${refundMethod === 'bank_transfer' ? 'selected' : ''}>Chuyển khoản</option><option value='bank_qr' ${refundMethod === 'bank_qr' ? 'selected' : ''}>QR ngân hàng</option><option value='card' ${refundMethod === 'card' ? 'selected' : ''}>Thẻ</option><option value='other' ${refundMethod === 'other' ? 'selected' : ''}>Khác</option></select></div></div></div><div class='modal-note'>Slink tính tiền hoàn theo giá đã bán và mức giảm giá của từng sản phẩm. Phần đơn chưa thanh toán được chuyển thành số dư khách hàng nếu đơn có gắn hồ sơ khách.</div>${saved ? `<div class='modal-note'>Thao tác trả hàng đang chờ xác nhận. Gửi lại cùng nội dung để tránh ghi nhận hai lần.</div>` : ''}</form>`;
    showModal(saved ? 'Kiểm tra trả hàng đang chờ' : 'Trả một phần đơn hàng', 'Chọn số lượng khách trả lại và cách xử lý hàng.', body, `<button class='btn btn-secondary' type='button' data-action='close-modal'>Quay lại đơn</button><button class='btn btn-primary' type='submit' form='entity-form'>${saved ? 'Thử lại trả hàng' : 'Xác nhận trả hàng'}</button>`, true);
  }

  async function saveReturn(form) {
    const orderId = form.dataset.orderId;
    let pending = loadPendingReturn(orderId);
    if (!pending) {
      const data = new FormData(form);
      const items = Array.from(form.querySelectorAll('[data-return-line]')).map(function (input) {
        return { orderLineId: input.dataset.returnLine, quantity: Number(input.value) || 0 };
      }).filter(function (item) { return item.quantity > 0; });
      if (!items.length) return toast('Chưa chọn sản phẩm', 'Nhập số lượng lớn hơn 0 cho ít nhất một dòng.', 'error');
      for (const item of items) {
        if (!Number.isFinite(item.quantity) || item.quantity < 0 || Math.abs(item.quantity * 1000 - Math.round(item.quantity * 1000)) > 1e-6) return toast('Số lượng không hợp lệ', 'Số lượng trả tối đa có 3 chữ số thập phân.', 'error');
      }
      const reason = String(data.get('reason') || '').trim();
      if (reason.length < 2) return toast('Cần ghi lý do trả hàng', 'Nhập lý do từ 2 ký tự trở lên.', 'error');
      pending = {
        storeId: store.id,
        orderId: orderId,
        key: newIdempotencyKey(),
        payload: { items: items, reason: reason, restockPolicy: String(data.get('restockPolicy') || 'restock'), refundMethod: String(data.get('refundMethod') || 'cash') },
      };
      returnPending = pending;
    }
    if (!savePendingReturn()) return pendingSaveFailed();
    const submitButton = modal.querySelector('button[type="submit"][form="entity-form"]');
    if (submitButton) submitButton.disabled = true;
    try {
      const result = await apiRequest(`/api/stores/${encodeURIComponent(store.id)}/orders/${encodeURIComponent(orderId)}/returns`, {
        method: 'POST', headers: { 'idempotency-key': pending.key }, body: pending.payload,
      });
      clearPendingReturn(orderId);
      closeModal();
      await Promise.all([loadProductsPage('', 0), loadCustomersPage(searchTerms.customers, customerOffset), loadOrdersPage(searchTerms.orders, orderOffset)]);
      toast('Đã ghi nhận trả hàng', `${result.return.number} · ${money(Number(result.return.refundTotalVnd))}`);
      await openOrder(orderId);
    } catch (error) {
      if (error.status === 401) showSignedOut('Phiên đăng nhập đã hết hạn. Đăng nhập lại để kiểm tra yêu cầu trả hàng.', 'error');
      else if (error.status >= 400 && error.status < 500 && !['idempotency_conflict', 'request_in_progress'].includes(error.code)) {
        clearPendingReturn(orderId);
        if (!modal.hidden) openReturn(orderId);
      }
      toast('Chưa hoàn tất được trả hàng', error.message, 'error');
      if (submitButton && !modal.hidden) submitButton.disabled = false;
    }
  }

  async function openCustomerDetail(id) {
    const initial = customerById(id);
    if (!initial) return;
    const requestNumber = ++customerDetailRequestNumber;
    showModal('Hồ sơ khách hàng', 'Đang tải thông tin và lịch sử mua hàng…', `<div class='empty-state'><strong>Đang tải hồ sơ</strong></div>`, `<button class='btn btn-secondary' data-action='close-modal'>Đóng</button>`, true);
    const currentModalGeneration = modalGeneration;
    try {
      const result = await apiRequest(`/api/stores/${encodeURIComponent(store.id)}/customers/${encodeURIComponent(id)}`);
      if (requestNumber !== customerDetailRequestNumber || currentModalGeneration !== modalGeneration || modal.hidden) return;
      const c = mapCustomer(result.customer);
      const orders = result.recentOrders || [];
      const orderRows = orders.map(function (row) {
        const order = mapOrder(row);
        return `<tr><td><button class='link-button order-ref' data-action='order-detail' data-id='${order.id}'>${esc(order.number)}</button></td><td>${humanDate(order.createdAt)}</td><td class='text-right'>${money(order.total)}</td><td>${statusBadge(order.status)}</td></tr>`;
      }).join('');
      const body = `<section class='panel'><div class='customer-header'><span class='avatar'>${esc(initials(c.name))}</span><div><h2>${esc(c.name)}</h2><p>${esc(c.phone)}${c.email ? ' · ' + esc(c.email) : ''}</p></div><span class='badge badge-success' style='margin-left:auto'>${esc(c.tier)}</span></div><div class='customer-stats'><div class='customer-stat'><small>Tổng chi tiêu</small><strong>${money(c.totalSpent)}</strong></div><div class='customer-stat'><small>Số đơn</small><strong>${number(c.orders)}</strong></div><div class='customer-stat'><small>Công nợ</small><strong>${money(c.debt)}</strong></div></div></section><section style='margin-top:17px'><div class='panel-header' style='padding:0 0 10px'><div><h2>Lịch sử gần đây</h2><p>5 đơn hàng mới nhất</p></div></div><div class='table-wrap'><table class='data-table'><thead><tr><th>Mã đơn</th><th>Ngày</th><th class='text-right'>Tổng tiền</th><th>Trạng thái</th></tr></thead><tbody>${orderRows || `<tr><td colspan='4'><div class='empty-state'><strong>Chưa có đơn mua hàng</strong><span>Khách này chưa phát sinh giao dịch.</span></div></td></tr>`}</tbody></table></div></section>${c.debt ? `<div class='summary-banner' style='margin-top:14px'><div><strong>Công nợ hiện tại</strong><small>Khoản chưa thanh toán của khách hàng</small></div><strong>${money(c.debt)}</strong></div>` : ''}`;
      showModal('Hồ sơ khách hàng', 'Thông tin và lịch sử mua hàng.', body, `<button class='btn btn-secondary' data-action='close-modal'>Đóng</button>${['owner', 'manager', 'cashier'].includes(store.role) ? `<button class='btn btn-primary' data-action='edit-customer' data-id='${c.id}'>${icon('edit', 14)} Chỉnh sửa</button>` : ''}`, true);
    } catch (error) {
      if (requestNumber !== customerDetailRequestNumber || currentModalGeneration !== modalGeneration || modal.hidden) return;
      if (error.status === 401) return showSignedOut('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.', 'error');
      showModal('Chưa tải được hồ sơ', error.message, `<div class='auth-message error'>Tải lại hồ sơ khách hàng rồi thử lại.</div>`, `<button class='btn btn-secondary' data-action='close-modal'>Đóng</button>`, true);
    }
  }

  function pickCustomer() {
    const body = `<div class='search-wrap'><span class='search-symbol'>⌕</span><input id='pick-customer-search' class='input' type='search' placeholder='Tìm tên hoặc điện thoại…'/></div><div id='customer-options' class='customer-picker'>${store.customers.map(function (c) { return `<button class='customer-option' data-action='select-customer' data-id='${c.id}'><span class='avatar' style='width:26px;height:26px'>${esc(initials(c.name))}</span><span>${esc(c.name)}</span><small>${esc(c.phone)}</small></button>`; }).join('')}</div><button class='btn btn-secondary' style='margin-top:13px;width:100%' data-action='new-customer-from-pos'>＋ Tạo khách hàng mới</button>`;
    showModal('Chọn khách hàng', 'Gắn đơn hàng với hồ sơ khách hàng.', body, `<button class='btn btn-secondary' data-action='select-customer' data-id=''>Bán cho khách lẻ</button>`, true);
  }

  function showMoreMenu() {
    const links = navItems.filter(function (n) { return !['dashboard', 'pos', 'orders'].includes(n.id) && canAccessRoute(n.id); });
    const body = `<div class='notice-list'>${links.map(function (n) { return `<button class='notice-item' data-route='${n.id}' style='width:100%;text-align:left;background:#fff;cursor:pointer'><span class='activity-mark'>${icon(n.icon, 15)}</span><span><strong>${n.label}</strong><small>Mở khu vực ${n.label.toLowerCase()}</small></span></button>`; }).join('')}</div>`;
    showModal('Tất cả chức năng', 'Chọn khu vực bạn muốn mở.', body, `<button class='btn btn-secondary' data-action='close-modal'>Đóng</button>`, true);
  }

  function showScan() {
    const body = `<form id='entity-form' data-form='scan'><div class='form-field'><label class='input-label'>Mã sản phẩm hoặc mã vạch</label><input id='scan-code' class='input' name='code' autofocus placeholder='Nhập hoặc dán mã sản phẩm…' autocomplete='off'/></div><div class='modal-note'>Bạn có thể nhập SKU để thêm nhanh vào giỏ hàng. Máy ảnh chưa được kết nối trong bản này.</div></form>`;
    showModal('Tìm sản phẩm nhanh', 'Nhập mã SKU hoặc mã vạch trên sản phẩm.', body, `<button class='btn btn-secondary' data-action='close-modal'>Hủy</button><button class='btn btn-primary' type='submit' form='entity-form'>Tìm sản phẩm</button>`);
  }

  function showDiscount() {
    const current = cart.discount || 0;
    const form = `<form id='entity-form' data-form='discount'><div class='form-field'><label class='input-label'>Giảm giá đơn hàng (VND)</label><input class='input' name='discount' type='number' min='0' max='${cartTotals().subtotal}' step='1000' value='${current}' required/><small class='muted' style='display:block;margin-top:6px;font-size:9px'>Tạm tính hiện tại: ${money(cartTotals().subtotal)}</small></div></form>`;
    modalForm('Áp dụng giảm giá', 'Số tiền giảm sẽ được lưu cùng đơn hàng.', form, 'Áp dụng');
  }

  function showHelp() {
    showModal('Trợ giúp Slink', 'Thông tin về các chức năng đang hoạt động.', `<div class='notice-list'><div class='notice-item'><span>📦</span><span><strong>Sản phẩm và kho</strong><small>Quản lý danh mục, kiểm kê tồn, nhập hàng và xem biến động kho. Mỗi phiếu nhập cập nhật giá vốn và công nợ nhà cung cấp.</small></span></div><div class='notice-item'><span>🧾</span><span><strong>Bán hàng và đơn hàng</strong><small>Đơn bán cập nhật kho, khoản thu và công nợ trong cùng một giao dịch. Từ chi tiết đơn, có thể ghi nhận thu nợ hoặc trả một phần hàng.</small></span></div><div class='notice-item'><span>💳</span><span><strong>Phương thức thanh toán</strong><small>Tiền mặt, chuyển khoản, QR và thẻ hiện được nhân viên xác nhận thủ công. Slink chưa kết nối trực tiếp với ngân hàng hoặc cổng thanh toán.</small></span></div><div class='notice-item'><span>🔐</span><span><strong>Bảo vệ dữ liệu</strong><small>Dữ liệu được lưu theo cửa hàng trên máy chủ. Chỉ thành viên được cấp quyền mới xem hoặc thay đổi được thông tin tương ứng.</small></span></div></div>`, `<button class='btn btn-primary' data-action='close-modal'>Đã hiểu</button>`, true);
  }

  function addToCart(id) {
    if (checkoutPendingPayload) return toast('Đang chờ xác nhận đơn', 'Hãy kiểm tra hoặc gửi lại đơn trước khi tạo đơn mới.', 'error');
    const p = productById(id); if (!p || p.stock < 1) return toast('Sản phẩm đã hết hàng', 'Hãy nhập kho trước khi bán.', 'error');
    const current = cart.find(function (x) { return x.id === id; });
    if (current && current.qty >= p.stock) return toast('Không đủ số lượng tồn', 'Bạn không thể thêm quá số hàng đang có.', 'error');
    if (current) current.qty += 1; else cart.push({ id: id, qty: 1 });
    render();
  }

  function setCartQty(id, delta) {
    if (checkoutPendingPayload) return toast('Đang chờ xác nhận đơn', 'Hãy kiểm tra hoặc gửi lại đơn trước khi thay đổi giỏ hàng.', 'error');
    const item = cart.find(function (x) { return x.id === id; }); const p = productById(id); if (!item) return;
    item.qty += Number(delta);
    if (item.qty <= 0) cart = cart.filter(function (x) { return x.id !== id; });
    else if (p && item.qty > p.stock) { item.qty = p.stock; toast('Đã đạt số lượng tồn', 'Kho hiện còn ' + p.stock + ' ' + p.unit + '.', 'error'); }
    render();
  }

  function editCartQuantity(id) {
    if (checkoutPendingPayload) return toast('Đang chờ xác nhận đơn', 'Hãy kiểm tra đơn đang chờ trước khi thay đổi giỏ hàng.', 'error');
    const item = cart.find(function (row) { return row.id === id; });
    const product = productById(id);
    if (!item || !product) return;
    const form = `<form id='entity-form' data-form='cart-quantity' data-id='${product.id}'><div class='form-field'><label class='input-label'>Số lượng · ${esc(product.unit)}</label><input class='input' name='quantity' type='number' min='0.001' max='${product.stock}' step='0.001' value='${item.qty}' required/><small class='muted'>Còn ${number(product.stock)} ${esc(product.unit)} trong kho</small></div><div class='modal-note'>Số lượng được ghi vào đơn khi bạn hoàn tất thanh toán.</div></form>`;
    showModal('Thay đổi số lượng', product.name, form, `<button class='btn btn-secondary' type='button' data-action='close-modal'>Hủy</button><button class='btn btn-primary' type='submit' form='entity-form'>Cập nhật</button>`);
  }

  function saveCartQuantity(form) {
    const id = form.dataset.id;
    const item = cart.find(function (row) { return row.id === id; });
    const product = productById(id);
    const quantity = Number(new FormData(form).get('quantity'));
    if (!item || !product) return closeModal();
    if (!Number.isFinite(quantity) || quantity <= 0 || Math.abs(quantity * 1000 - Math.round(quantity * 1000)) > 1e-6) return toast('Số lượng không hợp lệ', 'Nhập số lượng lớn hơn 0, tối đa 3 chữ số thập phân.', 'error');
    if (quantity > product.stock) return toast('Không đủ hàng trong kho', `Hiện còn ${number(product.stock)} ${product.unit}.`, 'error');
    item.qty = quantity;
    closeModal();
    render();
  }

  async function createSale(form) {
    const data = new FormData(form);
    const totals = cartTotals();
    const customerId = String(data.get('customerId') || '') || null;
    if (!checkoutPendingPayload) {
      const tenderInputs = checkoutTenderValues(form);
      const tenders = [];
      const usedMethods = new Set();
      let amountReceivedVnd = 0;
      let nonCashReceived = 0;
      let cashReceived = 0;
      for (const input of tenderInputs) {
        const amountReceived = Number(input.amountText);
        if (!Number.isSafeInteger(amountReceived) || amountReceived < 0) return toast('Số tiền không hợp lệ', 'Mỗi khoản thanh toán phải là VND nguyên không âm.', 'error');
        if (usedMethods.has(input.method) && amountReceived > 0) return toast('Phương thức bị lặp', 'Mỗi phương thức chỉ được nhập một khoản.', 'error');
        if (amountReceived === 0) continue;
        usedMethods.add(input.method);
        amountReceivedVnd += amountReceived;
        if (!Number.isSafeInteger(amountReceivedVnd)) return toast('Tổng tiền vượt giới hạn', 'Hãy chia hoặc kiểm tra lại các khoản thanh toán.', 'error');
        if (input.method === 'cash') cashReceived += amountReceived;
        else nonCashReceived += amountReceived;
        tenders.push({ method: input.method, amountReceivedVnd: amountReceived });
      }
      if (nonCashReceived > totals.total) return toast('Khoản không tiền mặt quá lớn', 'Tiền chuyển khoản, QR hoặc thẻ không được vượt tổng đơn.', 'error');
      if (amountReceivedVnd > totals.total && cashReceived === 0) return toast('Không thể tính tiền thối', 'Chỉ khoản tiền mặt mới được nhận cao hơn số còn phải thanh toán.', 'error');
      if (amountReceivedVnd < totals.total && !customerId) return toast('Chọn khách hàng', 'Cần gắn khách hàng để lưu khoản còn nợ.', 'error');
      checkoutIdempotencyKey = checkoutIdempotencyKey || newIdempotencyKey();
      checkoutPendingPayload = {
        items: cart.map(function (item) { return { productId: item.id, quantity: item.qty }; }),
        customerId: customerId,
        discountVnd: totals.discount,
        method: tenders.length === 1 ? tenders[0].method : (tenderInputs[0]?.method || 'cash'),
        tenders: tenders,
        amountReceivedVnd: amountReceivedVnd,
        note: String(data.get('note') || '').trim(),
        totalVnd: totals.total,
      };
    }
    if (!savePendingSale()) return pendingSaveFailed();
    const key = checkoutIdempotencyKey;
    const payload = checkoutPendingPayload;
    const submitButton = modal.querySelector('button[type="submit"][form="entity-form"]');
    if (submitButton) submitButton.disabled = true;
    try {
      const result = await apiRequest(`/api/stores/${encodeURIComponent(store.id)}/sales`, {
        method: 'POST',
        headers: { 'idempotency-key': key },
        body: payload,
      });
      cart = [];
      cartCustomerId = '';
      clearPendingSale();
      closeModal();
      page = 'orders';
      await Promise.all([loadProductsPage('', 0), loadCustomersPage('', 0), loadOrdersPage('', 0)]);
      render();
      const order = result.order;
      toast('Đã lưu đơn hàng', `${order.number} · ${money(Number(order.totalVnd))}${Number(order.changeVnd) ? ` · tiền thối ${money(Number(order.changeVnd))}` : ''}`, 'success');
      await openOrder(order.id);
    } catch (error) {
      if (error.status === 401) showSignedOut('Phiên đăng nhập đã hết hạn. Đăng nhập lại để kiểm tra đơn đang chờ.', 'error');
      else if (error.status >= 400 && error.status < 500 && !['idempotency_conflict', 'request_in_progress'].includes(error.code)) {
        clearPendingSale();
        if (error.code === 'insufficient_stock' || error.code === 'product_unavailable' || error.code === 'inventory_unavailable') await loadProductsPage('', 0);
        if (!modal.hidden) openCheckout();
      }
      toast('Chưa hoàn tất được đơn hàng', error.message, 'error');
      if (submitButton && !modal.hidden) submitButton.disabled = false;
    }
  }

  async function saveProductImport(form) {
    let pending = loadPendingProductImport();
    if (!pending) {
      if (productImportErrors.length || !productImportRows.length) return toast('Chưa thể nhập sản phẩm', 'Chọn tệp CSV hợp lệ rồi kiểm tra bản xem trước.', 'error');
      pending = { storeId: store.id, key: newIdempotencyKey(), payload: { items: productImportRows } };
    }
    if (!savePendingProductImport(pending)) return pendingSaveFailed();
    const requestGeneration = modalGeneration;
    const submitButton = modal.querySelector('button[type="submit"][form="entity-form"]');
    const fileInput = modal.querySelector('#product-import-file');
    if (submitButton) submitButton.disabled = true;
    if (fileInput) fileInput.disabled = true;
    try {
      const result = await apiRequest(`/api/stores/${encodeURIComponent(store.id)}/products/import`, {
        method: 'POST', headers: { 'idempotency-key': pending.key }, body: pending.payload,
      });
      clearPendingProductImport();
      if (requestGeneration === modalGeneration && !modal.hidden) {
        closeModal();
        productImportRows = [];
        productImportErrors = [];
      }
      await loadProductsPage('', 0);
      toast('Đã nhập sản phẩm', `${number(Number(result.count))} sản phẩm · tồn đầu kỳ đã ghi vào sổ kho.`);
    } catch (error) {
      if (error.status === 401) showSignedOut('Phiên đăng nhập đã hết hạn. Đăng nhập lại để kiểm tra lần nhập.', 'error');
      else if (error.status >= 400 && error.status < 500 && !['idempotency_conflict', 'request_in_progress'].includes(error.code)) {
        clearPendingProductImport();
        if (requestGeneration === modalGeneration && !modal.hidden) {
          productImportRows = [];
          productImportErrors = [`Máy chủ chưa nhập dòng nào: ${error.message} Chọn tệp đã sửa để thử lại.`];
          if (fileInput && fileInput.isConnected) fileInput.disabled = false;
          renderProductImportPreview();
        }
      }
      toast('Chưa nhập được danh mục', error.message, 'error');
      if (submitButton && requestGeneration === modalGeneration && !modal.hidden && submitButton.isConnected && !productImportRows.length) submitButton.disabled = true;
      else if (submitButton && requestGeneration === modalGeneration && !modal.hidden && submitButton.isConnected) submitButton.disabled = false;
    }
  }

  async function saveProduct(form) {
    const data = new FormData(form); const id = form.dataset.id; const old = id ? productById(id) : null;
    const payload = {
      name: String(data.get('name')).trim(),
      sku: String(data.get('sku') || '').trim(),
      barcode: String(data.get('barcode') || '').trim() || null,
      category: String(data.get('category') || 'Chưa phân loại').trim(),
      unit: String(data.get('unit') || 'cái').trim(),
      salePriceVnd: Number(data.get('price')),
      costVnd: Number(data.get('cost') || 0),
      lowStockThreshold: Number(data.get('minStock') || 0),
      inventoryTracked: old ? old.inventoryTracked : true,
    };
    if (old) payload.version = Number(form.dataset.version);
    try {
      const result = await apiRequest(`/api/stores/${encodeURIComponent(store.id)}/products${old ? `/${encodeURIComponent(old.id)}` : ''}`, {
        method: old ? 'PUT' : 'POST', body: payload,
      });
      closeModal();
      toast(old ? 'Đã cập nhật sản phẩm' : 'Đã thêm sản phẩm', result.product.name);
      if (page === 'inventory') await loadInventoryPage(searchTerms.inventory, inventoryOffset);
      else await loadProductsPage(searchTerms.products, productOffset);
    } catch (error) {
      toast('Chưa lưu được sản phẩm', error.message, 'error');
    }
  }

  async function archiveProduct(id) {
    const product = productById(id);
    if (!product || !window.confirm('Lưu trữ sản phẩm này? Lịch sử bán hàng và tồn kho sẽ được giữ lại.')) return;
    try {
      await apiRequest(`/api/stores/${encodeURIComponent(store.id)}/products/${encodeURIComponent(id)}/archive`, { method: 'POST', body: {} });
      closeModal();
      toast('Đã lưu trữ sản phẩm', product.name);
      await loadProductsPage(searchTerms.products, Math.max(0, productOffset));
    } catch (error) {
      toast('Chưa lưu trữ được sản phẩm', error.message, 'error');
    }
  }

  async function saveCustomer(form) {
    const data = new FormData(form); const id = form.dataset.id; const old = id ? customerById(id) : null;
    let payload = {
      name: String(data.get('name') || '').trim(),
      phone: String(data.get('phone') || '').trim(),
      email: String(data.get('email') || '').trim(),
      note: String(data.get('note') || '').trim(),
    };
    let pending = null;
    if (old) payload.version = Number(form.dataset.version);
    else {
      pending = loadPendingCustomer();
      if (!pending) {
        const openingBalanceText = String(data.get('openingBalanceVnd') || '0').trim() || '0';
        const openingBalance = Number(openingBalanceText);
        if (!/^\d+$/.test(openingBalanceText) || !Number.isSafeInteger(openingBalance) || openingBalance < 0) return toast('Công nợ ban đầu không hợp lệ', 'Nhập số VND nguyên không âm.', 'error');
        payload.openingBalanceVnd = String(openingBalance);
        pending = { storeId: store.id, key: newIdempotencyKey(), payload: payload };
      }
      payload = pending.payload;
      if (!savePendingCustomer(pending)) return pendingSaveFailed();
      form.querySelectorAll('input,textarea').forEach(function (field) { field.disabled = true; });
    }
    const submitButton = modal.querySelector('button[type="submit"][form="entity-form"]');
    if (submitButton) submitButton.disabled = true;
    try {
      const result = await apiRequest(`/api/stores/${encodeURIComponent(store.id)}/customers${old ? `/${encodeURIComponent(old.id)}` : ''}`, {
        method: old ? 'PUT' : 'POST', headers: pending ? { 'idempotency-key': pending.key } : {}, body: payload,
      });
      if (pending) clearPendingCustomer();
      const customer = mapCustomer(result.customer);
      if (old) Object.assign(old, customer); else store.customers.unshift(customer);
      closeModal();
      toast(old ? 'Đã cập nhật khách hàng' : 'Đã thêm khách hàng', `${customer.name}${!old && Number(payload.openingBalanceVnd) > 0 ? ` · công nợ ban đầu ${money(Number(payload.openingBalanceVnd))}` : ''}`);
      if (page === 'pos') cartCustomerId = customer.id;
      await loadCustomersPage(searchTerms.customers, customerOffset);
      if (page === 'pos' && !store.customers.some(function (row) { return row.id === customer.id; })) store.customers.unshift(customer);
      render();
    } catch (error) {
      if (error.status === 401) showSignedOut('Phiên đăng nhập đã hết hạn. Đăng nhập lại để kiểm tra khách hàng đang chờ.', 'error');
      else if (pending && error.status >= 400 && error.status < 500 && !['idempotency_conflict', 'request_in_progress'].includes(error.code)) {
        clearPendingCustomer();
        form.querySelectorAll('input,textarea').forEach(function (field) { field.disabled = false; });
      }
      toast('Chưa lưu được khách hàng', error.message, 'error');
      if (submitButton && !modal.hidden) submitButton.disabled = false;
    }
  }

  async function saveSupplier(form) {
    let pending = loadPendingSupplier();
    if (!pending) {
      const data = new FormData(form);
      const name = String(data.get('name') || '').trim();
      const amountText = String(data.get('openingPayableVnd') || '0').trim() || '0';
      const openingPayableVnd = Number(amountText);
      if (!name || name.length > 160) return toast('Tên nhà cung cấp không hợp lệ', 'Tên cần từ 1 đến 160 ký tự.', 'error');
      if (!/^\d+$/.test(amountText) || !Number.isSafeInteger(openingPayableVnd) || openingPayableVnd < 0) return toast('Khoản phải trả ban đầu không hợp lệ', 'Nhập số VND nguyên không âm.', 'error');
      pending = { storeId: store.id, key: newIdempotencyKey(), payload: { name: name, openingPayableVnd: String(openingPayableVnd) } };
    }
    if (!savePendingSupplier(pending)) return pendingSaveFailed();
    form.querySelectorAll('input').forEach(function (field) { field.disabled = true; });
    const submitButton = modal.querySelector('button[type="submit"][form="entity-form"]');
    if (submitButton) submitButton.disabled = true;
    try {
      const result = await apiRequest(`/api/stores/${encodeURIComponent(store.id)}/suppliers`, {
        method: 'POST', headers: { 'idempotency-key': pending.key }, body: pending.payload,
      });
      clearPendingSupplier();
      closeModal();
      await loadFinancePage();
      render();
      toast(result.supplier.created ? 'Đã thêm nhà cung cấp' : 'Đã cập nhật công nợ nhà cung cấp', `${result.supplier.name}${Number(pending.payload.openingPayableVnd) > 0 ? ` · phải trả ${money(Number(result.supplier.balance_vnd))}` : ''}`);
    } catch (error) {
      if (error.status === 401) showSignedOut('Phiên đăng nhập đã hết hạn. Đăng nhập lại để kiểm tra nhà cung cấp đang chờ.', 'error');
      else if (error.status >= 400 && error.status < 500 && !['idempotency_conflict', 'request_in_progress'].includes(error.code)) {
        clearPendingSupplier();
        form.querySelectorAll('input').forEach(function (field) { field.disabled = false; });
      }
      toast('Chưa lưu được nhà cung cấp', error.message, 'error');
      if (submitButton && !modal.hidden) submitButton.disabled = false;
    }
  }

  async function adjustStock(form) {
    const p = productById(form.dataset.id); if (!p) return;
    let pending = loadPendingStock(p.id);
    if (!pending) {
      const data = new FormData(form);
      const count = Number(data.get('count'));
      if (!Number.isFinite(count) || count < 0 || count > 1_000_000_000 || Math.abs(count * 1000 - Math.round(count * 1000)) > 1e-6) return toast('Số lượng không hợp lệ', 'Nhập số lượng không âm, tối đa 3 chữ số thập phân.', 'error');
      if (count === p.stock) { closeModal(); return toast('Số lượng không đổi', 'Không có chênh lệch cần ghi nhận.'); }
      pending = { storeId: store.id, productId: p.id, key: newIdempotencyKey(), payload: { productId: p.id, count: count, expectedInventoryVersion: Number(form.dataset.inventoryVersion), reason: String(data.get('reason') || 'Kiểm kê thực tế') } };
    }
    if (!savePendingStock(pending)) return pendingSaveFailed();
    const submitButton = modal.querySelector('button[type="submit"][form="entity-form"]');
    if (submitButton) submitButton.disabled = true;
    try {
      await apiRequest(`/api/stores/${encodeURIComponent(store.id)}/stock-adjustments`, { method: 'POST', headers: { 'idempotency-key': pending.key }, body: pending.payload });
      clearPendingStock(p.id);
      closeModal();
      if (page === 'inventory') await loadInventoryPage(searchTerms.inventory, inventoryOffset);
      else await loadProductsPage(searchTerms.products, productOffset);
      render();
      toast('Đã cập nhật tồn kho', p.name + ' · ' + number(Number(pending.payload.count)) + ' ' + p.unit);
    } catch (error) {
      if (error.status === 401) showSignedOut('Phiên đăng nhập đã hết hạn. Đăng nhập lại để kiểm tra cập nhật tồn.', 'error');
      else if (error.status >= 400 && error.status < 500 && !['idempotency_conflict', 'request_in_progress'].includes(error.code)) {
        clearPendingStock(p.id);
        if (error.code === 'inventory_version_conflict') {
          if (page === 'inventory') await loadInventoryPage(searchTerms.inventory, inventoryOffset);
          else await loadProductsPage(searchTerms.products, productOffset);
        }
        if (!modal.hidden) openStockAdjust(p.id);
      }
      toast('Chưa cập nhật được tồn kho', error.message, 'error');
      if (submitButton && !modal.hidden) submitButton.disabled = false;
    }
  }

  async function receiveStock(form) {
    let pending = loadPendingPurchase();
    if (!pending) {
      const data = new FormData(form);
      const quantity = Number(data.get('qty'));
      const unitCostVnd = Number(data.get('cost'));
      const amountPaidVnd = Number(data.get('paid') || 0);
      if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000_000 || Math.abs(quantity * 1000 - Math.round(quantity * 1000)) > 1e-6) return toast('Số lượng không hợp lệ', 'Nhập số lượng lớn hơn 0, tối đa 3 chữ số thập phân.', 'error');
      if (!Number.isSafeInteger(unitCostVnd) || unitCostVnd < 0 || !Number.isSafeInteger(amountPaidVnd) || amountPaidVnd < 0) return toast('Số tiền không hợp lệ', 'Giá và số tiền thanh toán phải là VND nguyên.', 'error');
      pending = {
        storeId: store.id,
        key: newIdempotencyKey(),
        productName: productById(String(data.get('productId') || ''))?.name || '',
        payload: {
          productId: String(data.get('productId') || ''), quantity: quantity, unitCostVnd: unitCostVnd,
          amountPaidVnd: amountPaidVnd, supplierName: String(data.get('supplierName') || '').trim(),
          note: String(data.get('note') || '').trim(), method: String(data.get('method') || 'cash'),
        },
      };
    }
    if (!savePendingPurchase(pending)) return pendingSaveFailed();
    form.querySelectorAll('input,select').forEach(function (field) { field.disabled = true; });
    const submitButton = modal.querySelector('button[type="submit"][form="entity-form"]');
    if (submitButton) submitButton.disabled = true;
    try {
      const result = await apiRequest(`/api/stores/${encodeURIComponent(store.id)}/purchases`, {
        method: 'POST', headers: { 'idempotency-key': pending.key }, body: pending.payload,
      });
      clearPendingPurchase();
      closeModal();
      if (page === 'inventory') await loadInventoryPage(searchTerms.inventory, inventoryOffset);
      else await loadProductsPage('', 0);
      if (page === 'finance') await loadFinancePage();
      render();
      toast('Đã nhập kho', `${result.purchase.number} · ${number(Number(result.purchase.quantity))} sản phẩm · ${money(Number(result.purchase.totalVnd))}`);
    } catch (error) {
      if (error.status === 401) showSignedOut('Phiên đăng nhập đã hết hạn. Đăng nhập lại để kiểm tra phiếu nhập.', 'error');
      else if (error.status >= 400 && error.status < 500 && !['idempotency_conflict', 'request_in_progress'].includes(error.code)) {
        clearPendingPurchase();
        form.querySelectorAll('input,select').forEach(function (field) { field.disabled = false; });
      }
      toast('Chưa hoàn tất được phiếu nhập', error.message, 'error');
      if (submitButton && !modal.hidden) submitButton.disabled = false;
    }
  }

  async function saveSupplierPayment(form) {
    const supplierId = form.dataset.id;
    let pending = loadPendingSupplierPayment(supplierId);
    if (!pending) {
      const data = new FormData(form);
      const amountVnd = Number(data.get('amount'));
      if (!Number.isSafeInteger(amountVnd) || amountVnd <= 0) return toast('Số tiền không hợp lệ', 'Nhập số tiền thanh toán bằng VND nguyên dương.', 'error');
      pending = {
        storeId: store.id,
        supplierId: supplierId,
        key: newIdempotencyKey(),
        payload: { amountVnd: amountVnd, method: String(data.get('method') || 'cash'), note: String(data.get('note') || '').trim() },
      };
    }
    if (!savePendingSupplierPayment(pending)) return pendingSaveFailed();
    form.querySelectorAll('input,select').forEach(function (field) { field.disabled = true; });
    const submitButton = modal.querySelector('button[type="submit"][form="entity-form"]');
    if (submitButton) submitButton.disabled = true;
    try {
      const result = await apiRequest(`/api/stores/${encodeURIComponent(store.id)}/suppliers/${encodeURIComponent(supplierId)}/payments`, {
        method: 'POST', headers: { 'idempotency-key': pending.key }, body: pending.payload,
      });
      clearPendingSupplierPayment(supplierId);
      closeModal();
      await loadFinancePage();
      render();
      toast('Đã ghi nhận thanh toán nhà cung cấp', money(Number(result.payment.amountVnd)));
    } catch (error) {
      if (error.status === 401) showSignedOut('Phiên đăng nhập đã hết hạn. Đăng nhập lại để kiểm tra khoản thanh toán.', 'error');
      else if (error.status >= 400 && error.status < 500 && !['idempotency_conflict', 'request_in_progress'].includes(error.code)) {
        clearPendingSupplierPayment(supplierId);
        form.querySelectorAll('input,select').forEach(function (field) { field.disabled = false; });
      }
      toast('Chưa lưu được khoản thanh toán', error.message, 'error');
      if (submitButton && !modal.hidden) submitButton.disabled = false;
    }
  }

  async function saveCash(form) {
    let pending = loadPendingCash();
    if (!pending) {
      const data = new FormData(form);
      const amountVnd = Number(data.get('amount'));
      if (!Number.isSafeInteger(amountVnd) || amountVnd <= 0) return toast('Số tiền không hợp lệ', 'Nhập số tiền bằng VND nguyên dương.', 'error');
      pending = {
        storeId: store.id,
        key: newIdempotencyKey(),
        payload: {
          direction: data.get('type') === 'in' ? 'in' : 'out',
          amountVnd: amountVnd,
          category: String(data.get('category') || 'Vận hành'),
          method: String(data.get('method') || 'cash'),
          note: String(data.get('note') || '').trim(),
        },
      };
    }
    if (!savePendingCash(pending)) return pendingSaveFailed();
    form.querySelectorAll('input,select').forEach(function (field) { field.disabled = true; });
    const submitButton = modal.querySelector('button[type="submit"][form="entity-form"]');
    if (submitButton) submitButton.disabled = true;
    try {
      const result = await apiRequest(`/api/stores/${encodeURIComponent(store.id)}/cash-movements`, {
        method: 'POST', headers: { 'idempotency-key': pending.key }, body: pending.payload,
      });
      clearPendingCash();
      closeModal();
      await loadFinancePage();
      render();
      toast(pending.payload.direction === 'in' ? 'Đã ghi phiếu thu' : 'Đã ghi phiếu chi', money(Number(result.movement.amountVnd)));
    } catch (error) {
      if (error.status === 401) showSignedOut('Phiên đăng nhập đã hết hạn. Đăng nhập lại để kiểm tra phiếu thu chi.', 'error');
      else if (error.status >= 400 && error.status < 500 && !['idempotency_conflict', 'request_in_progress'].includes(error.code)) {
        clearPendingCash();
        form.querySelectorAll('input,select').forEach(function (field) { field.disabled = false; });
      }
      toast('Chưa lưu được phiếu thu chi', error.message, 'error');
      if (submitButton && !modal.hidden) submitButton.disabled = false;
    }
  }

  async function saveSettings(form) {
    const data = new FormData(form);
    const submitButton = form.querySelector('[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    try {
      const result = await apiRequest(`/api/stores/${encodeURIComponent(store.id)}/settings`, {
        method: 'PUT',
        body: {
          name: String(data.get('storeName') || '').trim(),
          phone: String(data.get('phone') || '').trim(),
          address: String(data.get('address') || '').trim(),
          receiptFooter: String(data.get('receiptFooter') || '').trim(),
          version: Number(form.dataset.version),
        },
      });
      const settings = result.settings;
      applyStoreProfile(settings);
      render();
      toast('Đã lưu cài đặt cửa hàng');
    } catch (error) {
      if (error.status === 401) showSignedOut('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.', 'error');
      else if (error.code === 'version_conflict') {
        try {
          const latest = await apiRequest(`/api/stores/${encodeURIComponent(store.id)}/settings`);
          applyStoreProfile(latest.settings);
          render();
          toast('Cài đặt đã được cập nhật ở thiết bị khác', 'Đã tải phiên bản mới. Kiểm tra lại trước khi lưu.', 'error');
        } catch (reloadError) { toast('Chưa lưu được cài đặt', reloadError.message, 'error'); }
      } else toast('Chưa lưu được cài đặt', error.message, 'error');
      if (submitButton) submitButton.disabled = false;
    }
  }

  function openStaffInvite() {
    if (store.role !== 'owner') return toast('Không đủ quyền', 'Chỉ chủ cửa hàng mới có thể mời nhân viên.', 'error');
    const form = `<form id='entity-form' data-form='staff-invite'><div class='form-grid'><div class='form-field full'><label class='input-label' for='staff-invite-email'>Email nhân viên *</label><input class='input' id='staff-invite-email' name='email' type='email' autocomplete='email' required maxlength='254' placeholder='nhanvien@example.com'/></div><div class='form-field full'><label class='input-label' for='staff-invite-role'>Vai trò *</label><div class='select-wrap'><select class='input' id='staff-invite-role' name='role' required><option value='cashier'>Thu ngân</option><option value='stockkeeper'>Nhân viên kho</option><option value='accountant'>Kế toán</option><option value='manager'>Quản lý</option></select></div><small class='staff-role-help'>${staffRoleDescription('cashier')}</small></div></div><div class='modal-note'>Lời mời có hiệu lực 7 ngày. Nhân viên cần dùng đúng email này và xác minh email trước khi được cấp quyền.</div></form>`;
    showModal('Mời nhân viên', 'Gửi liên kết tham gia cửa hàng qua email.', form, `<button class='btn btn-secondary' type='button' data-action='close-modal'>Hủy</button><button class='btn btn-primary' type='submit' form='entity-form'>Gửi lời mời</button>`);
  }

  function showInvitationResult(result, title) {
    closeModal();
    if (result.developmentInviteUrl) {
      showModal(title || 'Đã tạo lời mời', 'Môi trường phát triển chưa gửi email; dùng liên kết dưới đây để tiếp tục.', `<div class='notice-item'><span>${icon('users', 18)}</span><span><strong>${esc(result.invitation.email)}</strong><small>${staffRoleName(result.invitation.role)} · Liên kết sẽ hết hạn sau 7 ngày</small></span></div><a class='staff-invite-link' href='${esc(result.developmentInviteUrl)}' target='_blank' rel='noopener'>Mở trang nhận lời mời →</a>`, `<button class='btn btn-secondary' data-action='close-modal'>Đóng</button><button class='btn btn-primary' data-action='reload-staff'>Xong</button>`, true);
    } else {
      toast(title || 'Đã gửi lời mời', result.message || 'Email mời đã được chấp nhận để gửi.');
      closeModal();
      loadStaffPage();
    }
  }

  async function saveStaffInvitation(form) {
    const data = new FormData(form);
    const button = modal.querySelector('button[type="submit"][form="entity-form"]');
    if (button) button.disabled = true;
    try {
      const result = await apiRequest(`/api/stores/${encodeURIComponent(store.id)}/staff/invitations`, {
        method: 'POST', body: { email: String(data.get('email') || '').trim(), role: String(data.get('role') || '') },
      });
      showInvitationResult(result);
      await loadStaffPage();
    } catch (error) {
      if (error.status === 401) showSignedOut('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.', 'error');
      else toast('Chưa gửi được lời mời', error.message, 'error');
      if (button && !modal.hidden) button.disabled = false;
    }
  }

  async function saveStaffMember(userId) {
    const role = document.querySelector(`[data-member-role='${userId}']`)?.value;
    const status = document.querySelector(`[data-member-status='${userId}']`)?.value;
    try {
      await apiRequest(`/api/stores/${encodeURIComponent(store.id)}/staff/members/${encodeURIComponent(userId)}`, { method: 'PATCH', body: { role: role, status: status } });
      toast('Đã cập nhật quyền nhân viên', 'Nhân viên cần tải lại trang để nhận quyền mới.');
      await loadStaffPage();
    } catch (error) {
      if (error.status === 401) showSignedOut('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.', 'error');
      else toast('Chưa cập nhật được quyền', error.message, 'error');
    }
  }

  async function resendStaffInvite(invitationId) {
    try {
      const result = await apiRequest(`/api/stores/${encodeURIComponent(store.id)}/staff/invitations/${encodeURIComponent(invitationId)}/resend`, { method: 'POST', body: {} });
      showInvitationResult(result, 'Đã gửi lại lời mời');
      await loadStaffPage();
    } catch (error) {
      if (error.status === 401) showSignedOut('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.', 'error');
      else toast('Chưa gửi lại được lời mời', error.message, 'error');
    }
  }

  async function revokeStaffInvite(invitationId) {
    if (!window.confirm('Thu hồi lời mời này? Liên kết hiện tại sẽ không còn sử dụng được.')) return;
    try {
      await apiRequest(`/api/stores/${encodeURIComponent(store.id)}/staff/invitations/${encodeURIComponent(invitationId)}/revoke`, { method: 'POST', body: {} });
      toast('Đã thu hồi lời mời');
      await loadStaffPage();
    } catch (error) {
      if (error.status === 401) showSignedOut('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.', 'error');
      else toast('Chưa thu hồi được lời mời', error.message, 'error');
    }
  }

  async function addByCode(form) {
    const code = String(new FormData(form).get('code') || '').trim();
    if (!code) return toast('Nhập mã sản phẩm', 'Quét hoặc nhập SKU, mã vạch hoặc tên chính xác.', 'error');
    try {
      const result = await apiRequest(`/api/stores/${encodeURIComponent(store.id)}/products?limit=100&q=${encodeURIComponent(code)}`);
      const products = result.products.map(mapProduct);
      const normalized = code.toLocaleLowerCase('vi');
      const product = products.find(function (item) { return item.sku.toLocaleLowerCase('vi') === normalized || item.barcode === code || item.name.toLocaleLowerCase('vi') === normalized; });
      if (!product) return toast('Không tìm thấy sản phẩm', 'Kiểm tra lại mã SKU, mã vạch hoặc tên chính xác.', 'error');
      if (product.stock < 1) return toast('Sản phẩm đã hết hàng', 'Hãy nhập kho trước khi bán.', 'error');
      closeModal();
      page = 'pos';
      if (!cart.find(function (item) { return item.id === product.id; })) cart.push({ id: product.id, qty: 0 });
      const target = cart.find(function (item) { return item.id === product.id; });
      target.qty = Math.min(product.stock, target.qty + 1);
      render();
      toast('Đã thêm vào giỏ', product.name);
    } catch (error) {
      if (error.status === 401) showSignedOut('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.', 'error');
      else toast('Chưa tra cứu được mã hàng', error.message, 'error');
    }
  }

  function download(name, content, type) {
    const blob = new Blob([content], { type: type || 'text/plain;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  let exportInProgress = false;
  const exportFiles = {
    products: 'slink-san-pham.csv', inventory: 'slink-ton-kho.csv', 'inventory-movements': 'slink-bien-dong-kho.csv',
    customers: 'slink-khach-hang.csv', 'customer-ledger': 'slink-so-cong-no-khach-hang.csv', orders: 'slink-don-hang.csv',
    'order-lines': 'slink-chi-tiet-don-hang.csv', payments: 'slink-thanh-toan.csv', returns: 'slink-hang-tra.csv',
    refunds: 'slink-hoan-tien.csv', cashbook: 'slink-so-thu-chi.csv', suppliers: 'slink-nha-cung-cap.csv',
    'supplier-ledger': 'slink-so-cong-no-nha-cung-cap.csv', purchases: 'slink-phieu-nhap-hang.csv',
  };
  const exportGroups = [
    { label: 'Danh mục và kho', options: [
      ['products', 'Danh mục sản phẩm', ['owner', 'manager', 'accountant', 'stockkeeper']],
      ['inventory', 'Tồn kho hiện tại', ['owner', 'manager', 'accountant', 'stockkeeper']],
      ['inventory-movements', 'Lịch sử biến động kho', ['owner', 'manager', 'accountant', 'stockkeeper']],
    ] },
    { label: 'Khách hàng và bán hàng', options: [
      ['customers', 'Hồ sơ khách hàng', ['owner', 'manager', 'accountant']],
      ['customer-ledger', 'Sổ công nợ khách hàng', ['owner', 'manager', 'accountant']],
      ['orders', 'Đơn hàng', ['owner', 'manager', 'accountant']],
      ['order-lines', 'Chi tiết sản phẩm trong đơn', ['owner', 'manager', 'accountant']],
      ['payments', 'Giao dịch thanh toán', ['owner', 'manager', 'accountant']],
      ['returns', 'Chi tiết hàng trả', ['owner', 'manager', 'accountant']],
      ['refunds', 'Giao dịch hoàn tiền', ['owner', 'manager', 'accountant']],
    ] },
    { label: 'Thu chi và nhập hàng', options: [
      ['cashbook', 'Sổ thu chi', ['owner', 'manager', 'accountant']],
      ['suppliers', 'Nhà cung cấp', ['owner', 'manager', 'accountant', 'stockkeeper']],
      ['supplier-ledger', 'Sổ công nợ nhà cung cấp', ['owner', 'manager', 'accountant']],
      ['purchases', 'Phiếu nhập và mặt hàng', ['owner', 'manager', 'accountant', 'stockkeeper']],
    ] },
  ];

  function canExportData() {
    return ['owner', 'manager', 'accountant', 'stockkeeper'].includes(store.role);
  }

  function openExportDialog() {
    const groupsHtml = exportGroups.map(function (group) {
      const options = group.options.filter(function (option) { return option[2].includes(store.role); });
      return options.length ? `<optgroup label='${esc(group.label)}'>${options.map(function (option) { return `<option value='${option[0]}'>${esc(option[1])}</option>`; }).join('')}</optgroup>` : '';
    }).join('');
    if (!groupsHtml) return toast('Không có quyền xuất dữ liệu', 'Vai trò tài khoản hiện tại không được tải dữ liệu cửa hàng.', 'error');
    const body = `<div class='form-grid'><div class='form-field full'><label class='input-label' for='export-dataset'>Loại dữ liệu *</label><div class='select-wrap'><select class='input' id='export-dataset' required>${groupsHtml}</select></div></div><div class='form-field'><label class='input-label' for='export-from'>Từ ngày (tùy chọn)</label><input class='input' id='export-from' type='date'/></div><div class='form-field'><label class='input-label' for='export-to'>Đến ngày (tùy chọn)</label><input class='input' id='export-to' type='date'/></div></div><div class='modal-note'>Bỏ trống ngày để xuất toàn bộ. Khoảng ngày tính theo múi giờ cửa hàng; danh mục và hồ sơ lọc theo ngày tạo, tồn kho theo ngày cập nhật, các sổ theo ngày phát sinh. Mỗi tệp tối đa 50.000 dòng; nếu vượt giới hạn, hãy chia nhỏ khoảng ngày. Số tiền giữ nguyên bằng VND.</div>`;
    const footer = `<button class='btn btn-secondary' type='button' data-action='close-modal'>Hủy</button><button class='btn btn-primary' type='button' data-action='export-dataset'>Tải tệp CSV</button>`;
    showModal('Xuất dữ liệu cửa hàng', 'Tải dữ liệu đã ghi nhận trên máy chủ để lưu trữ hoặc làm báo cáo.', body, footer, true);
  }

  async function exportCsv(dataset, from, to, button) {
    if (exportInProgress) return;
    const filename = exportFiles[dataset];
    if (!filename) return toast('Chưa xuất được dữ liệu', 'Hãy chọn một loại dữ liệu trong danh sách.', 'error');
    exportInProgress = true;
    if (button) button.disabled = true;
    const query = new URLSearchParams();
    if (from) query.set('from', from);
    if (to) query.set('to', to);
    const suffix = query.toString();
    try {
      const response = await fetch(`/api/stores/${encodeURIComponent(store.id)}/exports/${encodeURIComponent(dataset)}${suffix ? '?' + suffix : ''}`, {
        credentials: 'same-origin', headers: { accept: 'text/csv' },
      });
      if (!response.ok) {
        let result = {};
        try { result = await response.json(); } catch (error) { /* Keep a clear fallback for proxy errors. */ }
        const error = new Error(result.error && result.error.message || 'Không thể tải dữ liệu. Vui lòng thử lại.');
        error.status = response.status;
        throw error;
      }
      const file = await response.blob();
      if (!file.size) throw new Error('Tệp xuất đang trống. Hãy thử lại sau.');
      download(filename, file, 'text/csv;charset=utf-8');
      toast('Đã xuất tệp CSV', `${filename} · ${from || to ? `${from || 'đầu kỳ'} đến ${to || 'hiện tại'}` : 'toàn bộ dữ liệu'}`);
    } catch (error) {
      if (error.status === 401) showSignedOut('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.', 'error');
      else toast('Chưa xuất được dữ liệu', error.message, 'error');
    } finally {
      exportInProgress = false;
      if (button && button.isConnected) button.disabled = false;
    }
  }

  function printOrder(id) {
    const o = store.orders.find(function (x) { return x.id === id; }); if (!o) return;
    const c = customerById(o.customerId);
    const html = `<html lang='vi'><head><meta charset='utf-8'><title>${esc(o.number)}</title><style>body{font:14px Arial,sans-serif;max-width:360px;margin:24px auto;color:#222}h1{font-size:20px;margin-bottom:5px}p{font-size:12px;margin:5px 0;color:#666}.line{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed #ddd;font-size:13px}.total{font-weight:bold;font-size:16px}.center{text-align:center}hr{border:0;border-top:1px dashed #aaa;margin:14px 0}</style></head><body><div class='center'><h1>${esc(store.settings.storeName)}</h1><p>${esc(store.settings.address || '')}</p><p>${esc(store.settings.phone || '')}</p><hr/><strong>BIÊN NHẬN BÁN HÀNG</strong><p>${esc(o.number)} · ${humanDate(o.createdAt, true)}</p><p>Khách hàng: ${esc(c ? c.name : 'Khách lẻ')}</p></div><hr/>${o.items.map(function (i) { return `<div class='line'><span>${esc(i.name)} × ${number(i.qty)}</span><strong>${money(i.price * i.qty)}</strong></div>`; }).join('')}<div class='line'><span>Tạm tính</span><strong>${money(o.subtotal)}</strong></div>${o.discount ? `<div class='line'><span>Giảm giá</span><strong>−${money(o.discount)}</strong></div>` : ''}<div class='line total'><span>Tổng cộng</span><strong>${money(o.total)}</strong></div><div class='line'><span>Đã thanh toán · ${esc(o.method || '—')}</span><strong>${money(o.paid)}</strong></div>${o.cashReceived ? `<div class='line'><span>Tiền mặt khách đưa</span><strong>${money(o.cashReceived)}</strong></div>` : ''}${o.cashChange ? `<div class='line'><span>Tiền thối</span><strong>${money(o.cashChange)}</strong></div>` : ''}${o.due > 0 ? `<div class='line'><span>Còn nợ</span><strong>${money(o.due)}</strong></div>` : ''}${o.refunded ? `<div class='line'><span>Đã hoàn</span><strong>${money(o.refunded)}</strong></div>` : ''}<p class='center' style='margin-top:22px'>${esc(store.settings.receiptFooter || 'Cảm ơn quý khách!')}</p><script>window.onload=function(){window.print()}<\/script></body></html>`;
    const win = window.open('', '_blank', 'width=430,height=680'); if (!win) return toast('Trình duyệt đã chặn cửa sổ in', 'Cho phép cửa sổ bật lên rồi thử lại.', 'error'); win.document.write(html); win.document.close();
  }

  function renderDashboard() {
    const canViewReports = ['owner', 'manager', 'accountant'].includes(store.role);
    if (!canViewReports) {
      const lowProducts = lowStockProducts().slice(0, 4);
      const operationalActions = store.role === 'cashier'
        ? `<button class='quick-action' data-route='pos'><span class='quick-icon'>＋</span><span class='quick-copy'><strong>Tạo đơn hàng</strong><small>Bán hàng tại quầy</small></span></button><button class='quick-action' data-route='orders'><span class='quick-icon'>▤</span><span class='quick-copy'><strong>Đơn hàng</strong><small>Tìm giao dịch gần đây</small></span></button>`
        : `<button class='quick-action' data-action='receive-stock'><span class='quick-icon'>↙</span><span class='quick-copy'><strong>Nhập hàng</strong><small>Cập nhật tồn kho</small></span></button><button class='quick-action' data-route='inventory'><span class='quick-icon'>▦</span><span class='quick-copy'><strong>Kiểm kê tồn</strong><small>Xem số lượng hiện tại</small></span></button>`;
      return pageHeading('Tổng quan', `Tình hình hoạt động của ${store.settings.storeName}.`, store.role === 'cashier' ? `<button class='btn btn-primary' data-route='pos'>＋ Tạo đơn mới</button>` : `<button class='btn btn-primary' data-action='receive-stock'>＋ Nhập hàng</button>`) +
        `<section class='dashboard-welcome'><div class='welcome-copy'><span class='welcome-overline'>Cửa hàng đang hoạt động</span><h2>Theo dõi hàng hóa<br/>và công việc hôm nay.</h2><p>Các mục hiển thị phù hợp với quyền ${esc(staffRoleName(store.role).toLowerCase())} của bạn.</p><button class='btn' data-route='inventory'>Mở kho hàng ${icon('arrow', 14)}</button></div></section>` +
        `<div class='stat-grid'><article class='stat-card'><div class='stat-label'>Mặt hàng đang quản lý</div><div class='stat-value'>${number(inventorySummary.total)}</div><div class='stat-foot'>Sản phẩm trong cửa hàng</div></article><article class='stat-card'><div class='stat-label'>Sắp hết hàng</div><div class='stat-value'>${number(inventorySummary.low)}</div><div class='stat-foot'>Bằng hoặc dưới mức cảnh báo</div></article><article class='stat-card'><div class='stat-label'>Hết hàng</div><div class='stat-value'>${number(inventorySummary.out)}</div><div class='stat-foot'>Cần bổ sung trước khi bán</div></article><article class='stat-card'><div class='stat-label'>${store.role === 'stockkeeper' ? 'Phiếu nhập gần đây' : 'Đơn hàng gần đây'}</div><div class='stat-value'>${number(store.role === 'stockkeeper' ? purchaseHistory.length : orderTotal)}</div><div class='stat-foot'>${store.role === 'stockkeeper' ? 'Phiếu mới nhất trong kho' : 'Tổng số đơn trong cửa hàng'}</div></article></div>` +
        `<div class='lower-grid operational-dashboard-grid'><section class='panel quick-panel'><div class='section-title'><h2>Thao tác nhanh</h2><p>Công việc thường ngày</p></div><div class='quick-grid'>${operationalActions}</div></section><section class='panel alert-panel'><div class='alert-title'><span class='alert-icon'>${icon('alert', 15)}</span><div><strong>${number(inventorySummary.low)} mặt hàng cần chú ý</strong><small>Kiểm tra số lượng và nhập bổ sung</small></div></div><div class='alert-list'>${lowProducts.map(function (product) { return `<div class='alert-row'><strong>${esc(product.name)}</strong><span class='alert-qty'>${product.stock === 0 ? 'Hết hàng' : `Còn ${number(product.stock)} ${esc(product.unit)}`}</span></div>`; }).join('') || `<div class='alert-row'><strong>Tồn kho đang ổn định</strong><span class='alert-qty'>Tốt</span></div>`}</div><button class='link-button' data-route='inventory'>Mở danh sách kho →</button></section></div>`;
    }
    const summary = analyticsData && analyticsData.summary || {};
    const day = analyticsData && analyticsData.days && analyticsData.days.find(function (item) { return item.date === analyticsData.range.to; });
    const todaySales = canViewReports ? String(day && day.salesVnd || '0') : '0';
    const todayOrderCount = canViewReports ? Number(day && day.orderCount) || 0 : 0;
    const recent = store.orders.slice(0, 5);
    const tops = topProducts();
    const lowCount = Number(inventorySummary.low) || 0;
    const actions = `${canViewReports ? `<button class='btn btn-secondary hide-on-mobile' data-route='reports'>Xem báo cáo</button>` : ''}<button class='btn btn-primary' data-route='pos'><span class='btn-icon'>＋</span> Tạo đơn mới</button>`;
    const welcomePanel = canViewReports
      ? `<section class='dashboard-welcome'><div class='welcome-copy'><span class='welcome-overline'>Cửa hàng đang hoạt động</span><h2>Bán hàng và theo dõi<br/>cửa hàng của bạn.</h2><p>Doanh thu được tính sau khi trừ các khoản trả hàng. Lãi gộp tính theo giá vốn sản phẩm.</p><button class='btn' data-route='orders'>Mở đơn hàng ${icon('arrow', 14)}</button></div><div class='welcome-total'><div><small>Doanh thu hôm nay</small><strong>${moneyVndText(todaySales)}</strong></div><span class='total-change'>${number(todayOrderCount)} đơn · ${analyticsData ? `7 ngày đến ${esc(analyticsData.range.to)}` : 'Đang tải dữ liệu'}</span></div></section>`
      : `<section class='dashboard-welcome'><div class='welcome-copy'><span class='welcome-overline'>Cửa hàng đang hoạt động</span><h2>Theo dõi hàng hóa<br/>và đơn đang xử lý.</h2><p>Chọn thao tác phù hợp với công việc của bạn để tiếp tục vận hành cửa hàng.</p><button class='btn' data-route='inventory'>Mở kho hàng ${icon('arrow', 14)}</button></div></section>`;
    const dashboardMetrics = canViewReports
      ? `<div class='stat-grid'><article class='stat-card'><div class='stat-top'><span class='stat-label'>Lãi gộp trong kỳ</span><span class='stat-icon'>${icon('chart', 16)}</span></div><div class='stat-value'>${money(summary.grossProfitVnd)}</div><div class='stat-foot'>Sau giá vốn và hàng trả · trước chi phí vận hành</div></article><article class='stat-card'><div class='stat-top'><span class='stat-label'>Khách còn nợ</span><span class='stat-icon'>${icon('users', 16)}</span></div><div class='stat-value'>${moneyVndText(financeSummary.customerDebtVnd)}</div><div class='stat-foot'>${number(financeSummary.customerDebtCount)} khách hàng</div></article><article class='stat-card'><div class='stat-top'><span class='stat-label'>Sắp hết hàng</span><span class='stat-icon'>${icon('alert', 16)}</span></div><div class='stat-value'>${number(lowCount)}</div><div class='stat-foot'>Mặt hàng bằng hoặc dưới mức cảnh báo</div></article><article class='stat-card'><div class='stat-top'><span class='stat-label'>Giá trị tồn kho</span><span class='stat-icon'>${icon('box', 16)}</span></div><div class='stat-value'>${money(inventorySummary.stockValueVnd)}</div><div class='stat-foot'>Ước tính theo giá vốn hiện tại</div></article></div>`
      : `<div class='stat-grid'><article class='stat-card'><div class='stat-label'>Mặt hàng đang quản lý</div><div class='stat-value'>${number(inventorySummary.total)}</div><div class='stat-foot'>Sản phẩm trong cửa hàng</div></article><article class='stat-card'><div class='stat-label'>Sắp hết hàng</div><div class='stat-value'>${number(lowCount)}</div><div class='stat-foot'>Bằng hoặc dưới mức cảnh báo</div></article><article class='stat-card'><div class='stat-label'>Đơn hàng gần đây</div><div class='stat-value'>${number(recent.length)}</div><div class='stat-foot'>Các giao dịch mới nhất</div></article><article class='stat-card'><div class='stat-label'>Vai trò của bạn</div><div class='stat-value' style='font-size:16px'>${staffRoleName(store.role)}</div><div class='stat-foot'>Quyền truy cập theo nhiệm vụ</div></article></div>`;
    return pageHeading('Tổng quan', `Tình hình hoạt động của ${store.settings.storeName}.`, actions) +
      `${analyticsError ? `<div class='notice-item'><span>⚠️</span><span><strong>Chưa tải được báo cáo</strong><small>${esc(analyticsError)}</small></span></div>` : ''}<section class='dashboard-welcome'><div class='welcome-copy'><span class='welcome-overline'>Cửa hàng đang hoạt động</span><h2>Bán hàng và theo dõi<br/>cửa hàng của bạn.</h2><p>Doanh thu được tính sau khi trừ các khoản trả hàng. Lãi gộp tính theo giá vốn sản phẩm.</p><button class='btn' data-route='orders'>Mở đơn hàng ${icon('arrow', 14)}</button></div><div class='welcome-total'><div><small>Doanh thu hôm nay</small><strong>${money(todaySales)}</strong></div><span class='total-change'>${number(todayOrderCount)} đơn · ${analyticsData ? `7 ngày đến ${esc(analyticsData.range.to)}` : 'Đang tải dữ liệu'}</span></div></section>` +
      `<div class='stat-grid'><article class='stat-card'><div class='stat-top'><span class='stat-label'>Lãi gộp trong kỳ</span><span class='stat-icon'>${icon('chart', 16)}</span></div><div class='stat-value'>${money(summary.grossProfitVnd)}</div><div class='stat-foot'>Sau giá vốn và hàng trả · trước chi phí vận hành</div></article><article class='stat-card'><div class='stat-top'><span class='stat-label'>Khách còn nợ</span><span class='stat-icon'>${icon('users', 16)}</span></div><div class='stat-value'>${money(financeSummary.customerDebtVnd)}</div><div class='stat-foot'>${number(financeSummary.customerDebtCount)} khách hàng</div></article><article class='stat-card'><div class='stat-top'><span class='stat-label'>Sắp hết hàng</span><span class='stat-icon'>${icon('alert', 16)}</span></div><div class='stat-value'>${number(lowCount)}</div><div class='stat-foot'>Mặt hàng bằng hoặc dưới mức cảnh báo</div></article><article class='stat-card'><div class='stat-top'><span class='stat-label'>Giá trị tồn kho</span><span class='stat-icon'>${icon('box', 16)}</span></div><div class='stat-value'>${money(inventorySummary.stockValueVnd)}</div><div class='stat-foot'>Ước tính theo giá vốn hiện tại</div></article></div>` +
      `<div class='dashboard-main-grid'><section class='panel chart-panel'><div class='panel-header'><div><h2>Doanh thu bán hàng</h2><p>Doanh thu thuần theo ngày · khoảng ${analyticsData ? esc(analyticsData.range.from) + ' đến ' + esc(analyticsData.range.to) : 'đang tải'}</p></div><div class='view-toggle'><div class='chart-legend'><span><i class='legend-dot'></i> Doanh thu</span></div><div class='segmented'><button class='segment ${chartRange === '7 ngày' ? 'active' : ''}' data-action='chart-range' data-range='7 ngày'>Tuần</button><button class='segment ${chartRange === '30 ngày' ? 'active' : ''}' data-action='chart-range' data-range='30 ngày'>Tháng</button></div></div></div><div class='chart-wrap'>${chartSvg(chartRange === '7 ngày' ? 7 : 30)}</div><div class='chart-foot'><i class='mini-dot'></i><strong>${money(todaySales)}</strong> doanh thu hôm nay <span>·</span> ${number(todayOrderCount)} đơn</div></section><div class='side-stack'><section class='panel quick-panel'><div class='section-title'><h2>Thao tác nhanh</h2><p>Quản lý giao dịch thường ngày</p></div><div class='quick-grid'><button class='quick-action' data-route='pos'><span class='quick-icon'>＋</span><span class='quick-copy'><strong>Tạo đơn hàng</strong><small>Thanh toán tại quầy</small></span></button><button class='quick-action' data-action='new-product'><span class='quick-icon'>⌕</span><span class='quick-copy'><strong>Thêm sản phẩm</strong><small>Tạo mã hàng mới</small></span></button>${['owner', 'manager', 'stockkeeper', 'accountant'].includes(store.role) ? `<button class='quick-action' data-action='receive-stock'><span class='quick-icon'>↙</span><span class='quick-copy'><strong>Nhập hàng</strong><small>Cập nhật tồn và giá vốn</small></span></button>` : ''}${['owner', 'manager', 'accountant'].includes(store.role) ? `<button class='quick-action' data-action='new-expense'><span class='quick-icon'>↗</span><span class='quick-copy'><strong>Ghi khoản thu / chi</strong><small>Đối soát sổ quỹ</small></span></button>` : ''}</div></section><section class='panel alert-panel'><div class='alert-title'><span class='alert-icon'>${icon('alert', 15)}</span><div><strong>${number(lowCount)} mặt hàng cần chú ý</strong><small>Kiểm tra số lượng và nhập bổ sung</small></div></div><div class='alert-list'>${lowStockProducts().slice(0, 3).map(function (p) { return `<div class='alert-row'><strong>${esc(p.name)}</strong><span class='alert-qty'>${p.stock === 0 ? 'Hết hàng' : `Còn ${number(p.stock)} ${esc(p.unit)}`}</span></div>`; }).join('') || `<div class='alert-row'><strong>${lowCount ? 'Mở kho để xem mặt hàng cần chú ý' : 'Tồn kho đang ổn định'}</strong><span class='alert-qty'>${lowCount ? 'Kho hàng' : 'Tốt'}</span></div>`}</div><button class='link-button' data-route='inventory'>Mở danh sách kho →</button></section></div></div>` +
      `<div class='lower-grid'><section class='panel'><div class='panel-header'><div><h2>Đơn hàng gần đây</h2><p>Các giao dịch mới nhất trong cửa hàng</p></div><button class='link-button' data-route='orders'>Xem tất cả →</button></div><div class='activity-list'>${recent.map(function (o) { return `<button class='activity-item' data-action='order-detail' data-id='${o.id}' style='width:100%;border:0;background:none;text-align:left'><span class='activity-mark'>${icon('receiptSmall', 15)}</span><span class='activity-text'><strong>${esc(o.number)}${o.customerName ? ' · ' + esc(o.customerName) : ''}</strong><small>${timeOf(o.createdAt)} · ${number(o.itemCount)} dòng</small></span><span class='activity-amount'>${money(o.total)}</span></button>`; }).join('') || `<div class='empty-state'><strong>Chưa có giao dịch</strong><span>Đơn bán mới sẽ hiện ở đây.</span></div>`}</div></section><section class='panel'><div class='panel-header'><div><h2>Sản phẩm nổi bật</h2><p>Tính theo doanh thu thuần trong kỳ</p></div><button class='link-button' data-route='products'>Danh mục →</button></div><div class='top-products'>${tops.map(function (item, index) { return `<div class='top-product-row'><span class='rank-number'>${String(index + 1).padStart(2, '0')}</span><span class='product-thumb ${item.product.tone}'>${esc(item.product.emoji)}</span><span class='top-product-copy'><strong>${esc(item.product.name)}</strong><small>${esc(item.product.sku)}</small></span><span class='top-product-value'>${number(item.count)}<small>đã bán</small></span></div>`; }).join('') || `<div class='empty-state'><strong>${analyticsLoading ? 'Đang tải báo cáo' : 'Chưa có dữ liệu'}</strong><span>${esc(analyticsError || 'Đơn hàng đã ghi nhận sẽ xuất hiện ở đây.')}</span></div>`}</div></section></div>`;
  }

  function renderReports() {
    if (!['owner', 'manager', 'accountant'].includes(store.role)) {
      return `<section class='panel locked-page'><div class='empty-icon'>${icon('chart', 23)}</div><h2>Không có quyền xem báo cáo</h2><p>Báo cáo doanh thu, lãi gộp và công nợ chỉ dành cho chủ cửa hàng, quản lý hoặc kế toán.</p></section>`;
    }
    const days = chartRange === '30 ngày' ? 30 : 7;
    const summary = analyticsData && analyticsData.summary || {};
    const daily = chartDays(days);
    const maximum = Math.max(1, ...daily.map(function (item) { return item.total; }));
    const bars = daily.map(function (item) { const height = Math.max(4, item.total / maximum * 135); return `<div class='bar-column'><div class='bar-pair'><div class='bar muted' style='height:${Math.max(4, height * .65)}px'></div><div class='bar' style='height:${height}px'><title>${esc(item.date)} · ${money(item.total)} · ${number(item.orders)} đơn</title></div></div><span class='bar-label'>${esc(item.label)}</span></div>`; }).join('');
    const tops = topProducts();
    const totalTopRevenue = tops.reduce(function (sum, item) { return sum + item.revenue; }, 0) || 1;
    return pageHeading('Báo cáo', 'Doanh thu, lãi gộp và sản phẩm bán chạy từ dữ liệu đã ghi sổ.', `<div class='segmented'><button class='segment ${days === 7 ? 'active' : ''}' data-action='chart-range' data-range='7 ngày'>7 ngày</button><button class='segment ${days === 30 ? 'active' : ''}' data-action='chart-range' data-range='30 ngày'>30 ngày</button></div>`) +
      `${analyticsError ? `<div class='notice-item'><span>⚠️</span><span><strong>Chưa tải được báo cáo</strong><small>${esc(analyticsError)}</small></span></div>` : ''}<div class='report-grid'><article class='panel report-card'><small>Doanh thu thuần</small><strong>${money(summary.netSalesVnd)}</strong><span>${number(summary.orderCount)} đơn trong kỳ</span></article><article class='panel report-card'><small>Lãi gộp ước tính</small><strong>${money(summary.grossProfitVnd)}</strong><span>Sau giá vốn và hàng trả, trước chi phí vận hành</span></article><article class='panel report-card'><small>Giá trị đơn trung bình</small><strong>${money(summary.averageTicketVnd)}</strong><span>Doanh thu thuần chia cho số đơn</span></article><article class='panel report-card'><small>Tiền đã thu ròng</small><strong>${money(summary.collectedVnd)}</strong><span>Còn phải thu: ${money(summary.receivableVnd)}</span></article></div><div class='report-main-grid'><section class='panel'><div class='panel-header'><div><h2>Doanh thu theo ngày</h2><p>${analyticsData ? esc(analyticsData.range.from) + ' đến ' + esc(analyticsData.range.to) : analyticsLoading ? 'Đang tải…' : 'Chưa có dữ liệu'}</p></div><div class='chart-legend'><span><i class='legend-dot'></i> Doanh thu thuần</span></div></div><div class='bar-chart'>${bars || `<div class='empty-state'>${analyticsLoading ? 'Đang tải báo cáo…' : esc(analyticsError || 'Chưa có dữ liệu trong khoảng này.')}</div>`}</div></section><section class='panel'><div class='panel-header'><div><h2>Sản phẩm nổi bật</h2><p>Doanh thu thuần trong kỳ</p></div></div><div class='report-breakdown'>${tops.map(function (item, index) { const share = Math.round(item.revenue / totalTopRevenue * 100); return `<div class='breakdown-row'><i class='breakdown-mark ${index === 1 ? 'alt' : index > 1 ? 'third' : ''}'></i><span>${esc(item.product.name)} · ${number(item.count)} ${esc(item.product.unit)}</span><strong>${share}%</strong></div>`; }).join('') || `<div class='empty-state'><strong>${analyticsLoading ? 'Đang tải dữ liệu' : 'Chưa có giao dịch'}</strong><span>${esc(analyticsError || 'Sản phẩm bán sẽ được xếp hạng tại đây.')}</span></div>`}</div></section></div><div class='install-hint' style='margin-top:15px'>Lãi gộp đã trừ giá vốn của hàng bán và tính hàng trả lại theo tình trạng nhập lại kho. Chỉ số chưa trừ tiền thuê, lương, thuế và các chi phí vận hành.</div>`;
  }

  function routeTo(next) {
    if (!next) return;
    if (!canAccessRoute(next)) return toast('Không có quyền truy cập', 'Vai trò của bạn không được mở khu vực này.', 'error');
    page = next; closeModal();
    if (page === 'products') loadProductsPage(searchTerms.products, 0);
    else if (page === 'dashboard') {
      const dashboardLoads = [loadInventoryPage('', 0)];
      if (['owner', 'manager', 'accountant'].includes(store.role)) {
        dashboardLoads.push(loadAnalytics(chartRange === '30 ngày' ? 30 : 7), loadOrdersPage('', 0), loadFinancePage());
      } else if (store.role === 'cashier') {
        dashboardLoads.push(loadOrdersPage('', 0));
      } else if (store.role === 'stockkeeper') {
        dashboardLoads.push(loadFinancePage());
      }
      Promise.all(dashboardLoads).then(render);
    }
    else if (page === 'inventory') loadInventoryPage(searchTerms.inventory, 0);
    else if (page === 'finance') loadFinancePage();
    else if (page === 'reports') loadAnalytics(chartRange === '30 ngày' ? 30 : 7);
    else if (page === 'settings') loadStoreProfile();
    else if (page === 'staff') loadStaffPage();
    else if (page === 'customers') loadCustomersPage(searchTerms.customers, 0).then(render);
    else if (page === 'orders') loadOrdersPage(searchTerms.orders, 0).then(render);
    else if (page === 'pos') { searchTerms.products = ''; searchTerms.customers = ''; posSearchTerm = ''; posProducts = []; Promise.all([loadProductsPage('', 0), loadCustomersPage('', 0)]).then(function () { posProducts = store.products.slice(); render(); }); }
    else render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function submitAuth(form) {
    const type = form.dataset.authForm;
    const data = new FormData(form);
    const submit = form.querySelector('[type=submit]');
    if (submit) submit.disabled = true;
    try {
      if (type === 'login') {
        const session = await apiRequest('/api/auth/login', {
          method: 'POST', body: { email: String(data.get('email') || '').trim(), password: String(data.get('password') || '') },
        });
        if (invitationToken && invitationInfo && invitationInfo.status === 'pending') {
          const accepted = await apiRequest(`/api/invitations/${encodeURIComponent(invitationToken)}/accept`, { method: 'POST', body: {} });
          const current = await apiRequest('/api/auth/me');
          invitationToken = '';
          invitationInfo = null;
          window.history.replaceState({}, '', '/');
          await enterStore(current, accepted.storeId);
        } else await enterStore(session);
      } else if (type === 'register') {
        const result = await apiRequest('/api/auth/register', {
          method: 'POST', body: {
            displayName: String(data.get('displayName') || '').trim(),
            storeName: String(data.get('storeName') || '').trim(),
            email: String(data.get('email') || '').trim(),
            password: String(data.get('password') || ''),
          },
        });
        authMode = 'login';
        renderAuth(result.message, 'success', result.developmentVerificationUrl);
      } else if (type === 'resend') {
        const result = await apiRequest('/api/auth/resend-verification', {
          method: 'POST', body: { email: String(data.get('email') || '').trim() },
        });
        authMode = 'login';
        renderAuth(result.message, 'success', result.developmentVerificationUrl);
      } else if (type === 'reset') {
        const result = await apiRequest('/api/auth/password-reset', {
          method: 'POST', body: { email: String(data.get('email') || '').trim() },
        });
        renderAuth(result.message, 'success', result.developmentResetUrl);
      } else if (type === 'reset-complete') {
        const password = String(data.get('password') || '');
        if (password !== String(data.get('passwordConfirm') || '')) throw new Error('Hai lần nhập mật khẩu chưa khớp.');
        const result = await apiRequest('/api/auth/password-reset/complete', {
          method: 'POST', body: { token: String(data.get('token') || ''), password: password },
        });
        window.history.replaceState({}, '', '/');
        authMode = 'login';
        renderAuth(result.message, 'success');
      } else if (type === 'invite-register') {
        if (!invitationToken || !invitationInfo || invitationInfo.status !== 'pending') throw new Error('Lời mời không còn hiệu lực. Hãy xin chủ cửa hàng gửi liên kết mới.');
        const result = await apiRequest(`/api/invitations/${encodeURIComponent(invitationToken)}/register`, {
          method: 'POST', body: { displayName: String(data.get('displayName') || '').trim(), password: String(data.get('password') || '') },
        });
        authMode = 'invite-login';
        renderAuth(result.message, 'success', result.developmentVerificationUrl);
      }
    } catch (error) {
      renderAuth(error.message, 'error');
    } finally {
      if (submit && submit.isConnected) submit.disabled = false;
    }
  }

  async function signOut() {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST', body: {} });
      showSignedOut('Phiên cửa hàng được lưu trên máy chủ. Bạn đã đăng xuất.');
    } catch (error) {
      if (error.status === 401) showSignedOut('Phiên đăng nhập đã hết hạn.');
      else toast('Chưa đăng xuất được', error.message, 'error');
    }
  }

  async function boot() {
    const resetToken = new URLSearchParams(window.location.hash.slice(1)).get('reset');
    if (resetToken) {
      authMode = 'reset-complete';
      renderAuth();
      return;
    }
    const verificationToken = new URLSearchParams(window.location.hash.slice(1)).get('token') || new URLSearchParams(window.location.search).get('token');
    if (window.location.pathname === '/verify' && verificationToken) {
      authMode = 'login';
      authCard('Đang xác nhận email', 'Đang kích hoạt cửa hàng của bạn.', '', 'Đang kiểm tra liên kết bảo mật…');
      try {
        const result = await apiRequest('/api/auth/verify-email', { method: 'POST', body: { token: verificationToken } });
        window.history.replaceState({}, '', '/');
        renderAuth(result.message, 'success');
      } catch (error) {
        window.history.replaceState({}, '', '/');
        renderAuth(error.message, 'error');
      }
      return;
    }
    invitationToken = new URLSearchParams(window.location.hash.slice(1)).get('invite') || '';
    if (window.location.pathname === '/invite' && invitationToken) {
      try {
        const result = await apiRequest(`/api/invitations/${encodeURIComponent(invitationToken)}`);
        invitationInfo = result.invitation;
        if (invitationInfo.status !== 'pending') {
          authMode = 'login';
          renderAuth('Lời mời đã được dùng, thu hồi hoặc hết hạn. Hãy liên hệ chủ cửa hàng để nhận lời mời mới.', 'error');
          return;
        }
      } catch (error) {
        authMode = 'login';
        renderAuth(error.message, 'error');
        return;
      }
      let session;
      try { session = await apiRequest('/api/auth/me'); }
      catch (error) {
        if (error.status === 401) { authMode = 'invite-login'; renderAuth(); return; }
        authMode = 'invite-login'; renderAuth('Chưa kết nối được máy chủ. Kiểm tra mạng rồi thử lại.', 'error'); return;
      }
      try {
        const accepted = await apiRequest(`/api/invitations/${encodeURIComponent(invitationToken)}/accept`, { method: 'POST', body: {} });
        const current = await apiRequest('/api/auth/me');
        invitationToken = '';
        invitationInfo = null;
        window.history.replaceState({}, '', '/');
        await enterStore(current, accepted.storeId);
      } catch (error) {
        authMode = 'invite-login';
        renderAuth(error.message, 'error');
      }
      return;
    }
    try {
      const session = await apiRequest('/api/auth/me');
      await enterStore(session);
    } catch (error) {
      if (error.status === 401) showSignedOut();
      else showSignedOut('Slink chưa kết nối được máy chủ. Kiểm tra mạng rồi thử đăng nhập lại.', 'error');
    }
  }

  document.addEventListener('click', function (event) {
    const route = event.target.closest('[data-route]');
    if (route) { routeTo(route.dataset.route); return; }
    const button = event.target.closest('[data-action]'); if (!button) return;
    const action = button.dataset.action; const id = button.dataset.id;
    if (action === 'auth-mode') { authMode = button.dataset.mode || 'login'; renderAuth(); }
    else if (action === 'logout') signOut();
    else if (action === 'products-page') loadProductsPage(searchTerms.products, Number(button.dataset.offset) || 0);
    else if (action === 'inventory-page') loadInventoryPage(searchTerms.inventory, Number(button.dataset.offset) || 0);
    else if (action === 'customers-page') loadCustomersPage(searchTerms.customers, Number(button.dataset.offset) || 0).then(render);
    else if (action === 'orders-page') loadOrdersPage(searchTerms.orders, Number(button.dataset.offset) || 0).then(render);
    else if (action === 'close-modal') closeModal();
    else if (action === 'review-legacy-pending') clearReviewedLegacyPending();
    else if (action === 'import-products') openProductImport();
    else if (action === 'download-product-import-template') downloadProductImportTemplate();
    else if (action === 'help') showHelp();
    else if (action === 'more-menu') showMoreMenu();
    else if (action === 'new-product') openProduct('');
    else if (action === 'edit-product') openProduct(id);
    else if (action === 'new-customer') openCustomer('');
    else if (action === 'new-supplier') openSupplier();
    else if (action === 'edit-customer') { closeModal(); openCustomer(id); }
    else if (action === 'customer-detail') openCustomerDetail(id);
    else if (action === 'order-detail') openOrder(id);
    else if (action === 'void-order') openVoidOrder(id);
    else if (action === 'purchase-detail') openPurchaseDetail(id);
    else if (action === 'return-order') openReturn(id);
    else if (action === 'collect-payment') openCollectPayment(id);
    else if (action === 'print-order') printOrder(id);
    else if (action === 'add-cart') addToCart(id);
    else if (action === 'cart-qty') setCartQty(id, Number(button.dataset.delta));
    else if (action === 'cart-qty-edit') editCartQuantity(id);
    else if (action === 'checkout') openCheckout();
    else if (action === 'add-tender') {
      if (checkoutPendingPayload) return toast('Đơn đang chờ xác nhận', 'Không thể đổi các khoản thanh toán của đơn đã gửi.', 'error');
      const form = modal.querySelector('[data-form="checkout"]');
      if (!form) return;
      const tenders = checkoutTenderValues(form);
      if (tenders.length >= 5) return toast('Đã đạt giới hạn', 'Mỗi đơn có thể chia tối đa 5 phương thức thanh toán.', 'error');
      const used = new Set(tenders.map(function (tender) { return tender.method; }));
      const nextMethod = checkoutMethods.find(function (method) { return !used.has(method[0]); });
      if (!nextMethod) return toast('Đã có đủ phương thức', 'Mỗi phương thức chỉ được thêm một lần.', 'error');
      tenders.push({ method: nextMethod[0], amountReceivedVnd: '0' });
      renderCheckoutTenders(form, tenders);
      const nextSelect = form.querySelector(`#tender-method-${tenders.length - 1}`);
      if (nextSelect) nextSelect.focus();
    }
    else if (action === 'remove-tender') {
      if (checkoutPendingPayload) return;
      const form = modal.querySelector('[data-form="checkout"]');
      if (!form) return;
      const tenders = checkoutTenderValues(form);
      tenders.splice(Number(button.dataset.index), 1);
      renderCheckoutTenders(form, tenders.map(function (tender) { return { method: tender.method, amountReceivedVnd: tender.amountText }; }));
    }
    else if (action === 'pick-customer') pickCustomer();
    else if (action === 'select-customer') { if (checkoutPendingPayload) return toast('Đang chờ xác nhận đơn', 'Hãy kiểm tra đơn đang chờ trước khi đổi khách hàng.', 'error'); cartCustomerId = id || ''; closeModal(); page = 'pos'; render(); }
    else if (action === 'retry-pending-sale') openCheckout();
    else if (action === 'new-customer-from-pos') { closeModal(); openCustomer(''); }
    else if (action === 'open-cart') { const drawer = document.getElementById('drawer-cart'); if (drawer) drawer.classList.add('open'); }
    else if (action === 'category') { categoryFilter = button.dataset.category; render(); }
    else if (action === 'chart-range') { chartRange = button.dataset.range; loadAnalytics(chartRange === '30 ngày' ? 30 : 7); }
    else if (action === 'order-filter') { orderFilter = button.dataset.filter; render(); }
    else if (action === 'new-expense') openExpense();
    else if (action === 'open-cash-session') openCashSessionForm();
    else if (action === 'close-cash-session') openCashSessionCloseForm();
    else if (action === 'supplier-payment') openSupplierPayment(id);
    else if (action === 'receive-stock') openReceive();
    else if (action === 'adjust-stock') openStockAdjust(id);
    else if (action === 'adjust-stock-picker') { const p = store.products[0]; if (p) openStockAdjust(p.id); }
    else if (action === 'inventory-low') { searchTerms.inventory = ''; render(); const first = lowStockProducts()[0]; if (first) openStockAdjust(first.id); }
    else if (action === 'discount') showDiscount();
    else if (action === 'scan') showScan();
    else if (action === 'open-export') openExportDialog();
    else if (action === 'export-dataset') {
      const dataset = modal.querySelector('#export-dataset')?.value || '';
      const from = modal.querySelector('#export-from')?.value || '';
      const to = modal.querySelector('#export-to')?.value || '';
      if (from && to && from > to) return toast('Khoảng ngày chưa hợp lệ', 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.', 'error');
      closeModal();
      exportCsv(dataset, from, to, button);
    }
    else if (action === 'export-csv') exportCsv(button.dataset.dataset || 'products', '', '', button);
    else if (action === 'export-customers') exportCsv('customers', '', '', button);
    else if (action === 'settings-tab') { modal.querySelectorAll('.settings-tab').forEach(function (el) { el.classList.toggle('active', el === button); }); }
    else if (action === 'archive-product') archiveProduct(id);
    else if (action === 'new-staff-invite') openStaffInvite();
    else if (action === 'save-staff-member') saveStaffMember(id);
    else if (action === 'resend-staff-invite') resendStaffInvite(id);
    else if (action === 'revoke-staff-invite') revokeStaffInvite(id);
    else if (action === 'reload-staff') { closeModal(); loadStaffPage(); }
    else if (action === 'finance-filter') { const type = button.dataset.filter; const rows = store.cashbook.filter(function (m) { return m.type === type; }); modalForm('Sổ quỹ đã lọc', type === 'in' ? 'Phiếu thu' : 'Phiếu chi', `<section class='panel'><div class='table-wrap'><table class='data-table'><thead><tr><th>Khoản mục</th><th>Thời gian</th><th class='text-right'>Số tiền</th></tr></thead><tbody>${rows.map(function (m) { return `<tr><td>${esc(m.category)}</td><td>${humanDate(m.createdAt, true)}</td><td class='text-right'>${moneyVndText(m.amountVnd)}</td></tr>`; }).join('')}</tbody></table></div></section>`, 'Đóng', true); }
    else if (action === 'open-upgrade') showModal('Slink Pro', 'Một số dịch vụ nâng cao cần được cấu hình trước khi sử dụng.', `<div class='notice-item'><span>✨</span><span><strong>Đang dùng bản trải nghiệm</strong><small>Đồng bộ khi mất mạng, kết nối thanh toán và sao lưu tự động cần máy chủ và nhà cung cấp tương ứng.</small></span></div>`, `<button class='btn btn-primary' data-action='close-modal'>Đã hiểu</button>`);
  });

  document.addEventListener('input', function (event) {
    if (event.target.matches('[data-tender-amount]')) { updateCheckoutTenderSummary(event.target.form); return; }
    const id = event.target.id;
    if (id === 'product-search') {
      searchTerms.products = event.target.value;
      const query = searchTerms.products;
      const start = event.target.selectionStart;
      window.clearTimeout(productSearchTimer);
      productSearchTimer = window.setTimeout(function () {
        loadProductsPage(query, 0).then(function () {
          const next = document.getElementById(id);
          if (next) { next.focus(); next.setSelectionRange(start, start); }
        });
      }, 250);
    }
    else if (id === 'order-search') {
      searchTerms.orders = event.target.value;
      const query = searchTerms.orders;
      const start = event.target.selectionStart;
      window.clearTimeout(productSearchTimer);
      productSearchTimer = window.setTimeout(function () {
        loadOrdersPage(query, 0).then(function () { if (page === 'orders') render(); const next = document.getElementById(id); if (next) { next.focus(); next.setSelectionRange(start, start); } });
      }, 250);
    }
    else if (id === 'customer-search') {
      searchTerms.customers = event.target.value;
      const query = searchTerms.customers;
      const start = event.target.selectionStart;
      window.clearTimeout(productSearchTimer);
      productSearchTimer = window.setTimeout(function () {
        loadCustomersPage(query, 0).then(function () { if (page === 'customers') render(); const next = document.getElementById(id); if (next) { next.focus(); next.setSelectionRange(start, start); } });
      }, 250);
    }
    else if (id === 'inventory-search') { searchTerms.inventory = event.target.value; const query = searchTerms.inventory; const start = event.target.selectionStart; window.clearTimeout(productSearchTimer); productSearchTimer = window.setTimeout(function () { loadInventoryPage(query, 0).then(function () { const next = document.getElementById(id); if (next) { next.focus(); next.setSelectionRange(start, start); } }); }, 250); }
    else if (id === 'purchase-product-search') {
      const query = event.target.value.trim();
      const requestNumber = ++purchaseProductRequestNumber;
      window.clearTimeout(purchaseProductSearchTimer);
      purchaseProductSearchTimer = window.setTimeout(async function () {
        try {
          const result = await apiRequest(`/api/stores/${encodeURIComponent(store.id)}/products?limit=100&q=${encodeURIComponent(query)}`);
          if (requestNumber !== purchaseProductRequestNumber || modal.hidden) return;
          const products = result.products.map(mapProduct);
          const select = modal.querySelector('[data-purchase-product]');
          if (!select) return;
          select.innerHTML = products.map(function (product, index) { return `<option value='${product.id}' ${index === 0 ? 'selected' : ''}>${esc(product.name)} · ${esc(product.sku)}</option>`; }).join('');
          const selected = products[0];
          const cost = modal.querySelector('[data-purchase-cost]');
          if (selected && cost) cost.value = String(selected.cost);
          if (!products.length) select.innerHTML = `<option value=''>Không tìm thấy sản phẩm</option>`;
        } catch (error) {
          if (error.status === 401) showSignedOut('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.', 'error');
          else toast('Chưa tìm được sản phẩm', error.message, 'error');
        }
      }, 250);
    }
    else if (id === 'pos-search') {
      const query = event.target.value.trim();
      const requestNumber = ++posSearchRequestNumber;
      window.clearTimeout(posSearchTimer);
      posSearchTerm = query;
      if (!query) { posProducts = store.products.slice(); const list = document.getElementById('pos-products'); if (list) list.innerHTML = filteredProducts('', categoryFilter, posProducts).filter(function (p) { return p.stock > 0; }).map(function (p) { return `<button class='pos-product' data-action='add-cart' data-id='${p.id}'><span class='product-thumb ${p.tone || 'product-sage'}'>${esc(p.emoji || '📦')}</span><span class='pos-stock'>Còn ${number(p.stock)}</span><strong>${esc(p.name)}</strong><small>${esc(p.sku)}</small><span class='pos-price'>${money(p.price)}</span></button>`; }).join('') || `<div class='panel empty-state' style='grid-column:1/-1'><strong>Không có sản phẩm còn hàng</strong><span>Kiểm tra danh mục hoặc nhập kho.</span></div>`; }
      else {
        const list = document.getElementById('pos-products');
        if (list) list.innerHTML = `<div class='panel empty-state' style='grid-column:1/-1'>Đang tìm trong danh mục…</div>`;
        posSearchTimer = window.setTimeout(async function () {
          try {
            const result = await apiRequest(`/api/stores/${encodeURIComponent(store.id)}/products?limit=100&q=${encodeURIComponent(query)}`);
            if (requestNumber !== posSearchRequestNumber || page !== 'pos') return;
            posProducts = result.products.map(mapProduct);
            const next = document.getElementById('pos-products');
            if (next) next.innerHTML = filteredProducts(query, categoryFilter, posProducts).filter(function (p) { return p.stock > 0; }).map(function (p) { return `<button class='pos-product' data-action='add-cart' data-id='${p.id}'><span class='product-thumb ${p.tone || 'product-sage'}'>${esc(p.emoji || '📦')}</span><span class='pos-stock'>Còn ${number(p.stock)}</span><strong>${esc(p.name)}</strong><small>${esc(p.sku)}</small><span class='pos-price'>${money(p.price)}</span></button>`; }).join('') || `<div class='panel empty-state' style='grid-column:1/-1'><strong>Không có sản phẩm phù hợp</strong><span>Thử từ khóa khác.</span></div>`;
          } catch (error) {
            if (requestNumber !== posSearchRequestNumber) return;
            if (error.status === 401) showSignedOut('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.', 'error');
            else if (document.getElementById('pos-products')) document.getElementById('pos-products').innerHTML = `<div class='panel empty-state' style='grid-column:1/-1'>${esc(error.message)}</div>`;
          }
        }, 180);
      }
    }
    else if (id === 'pick-customer-search') {
      const query = event.target.value.trim();
      const requestNumber = ++pickerCustomerRequestNumber;
      window.clearTimeout(pickerCustomerSearchTimer);
      pickerCustomerSearchTimer = window.setTimeout(async function () {
        try {
          const result = await apiRequest(`/api/stores/${encodeURIComponent(store.id)}/customers?limit=100&q=${encodeURIComponent(query)}`);
          if (requestNumber !== pickerCustomerRequestNumber || modal.hidden) return;
          const customers = result.customers.map(mapCustomer);
          const options = document.getElementById('customer-options');
          if (options) options.innerHTML = customers.map(function (customer) { return `<button class='customer-option' data-action='select-customer' data-id='${customer.id}'><span class='avatar' style='width:26px;height:26px'>${esc(initials(customer.name))}</span><span>${esc(customer.name)}</span><small>${esc(customer.phone)}</small></button>`; }).join('') || `<div class='empty-state'>Không tìm thấy khách hàng phù hợp.</div>`;
        } catch (error) {
          if (error.status === 401) showSignedOut('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.', 'error');
          else toast('Chưa tìm được khách hàng', error.message, 'error');
        }
      }, 180);
    }
  });

  document.addEventListener('change', function (event) {
    if (event.target.matches('[data-tender-method]')) { updateCheckoutTenderSummary(event.target.form); return; }
    if (event.target.id === 'product-import-file') {
      const readNumber = ++productImportReadNumber;
      productImportReading = false;
      productImportRows = [];
      productImportErrors = [];
      const file = event.target.files && event.target.files[0];
      if (!file) { renderProductImportPreview(); return; }
      if (file.size > 500000) {
        productImportErrors = ['Tệp CSV vượt quá 500 KB. Hãy chia tệp thành các phần nhỏ hơn.'];
        renderProductImportPreview();
        return;
      }
      productImportReading = true;
      renderProductImportPreview();
      const reader = new FileReader();
      const readGeneration = modalGeneration;
      reader.onload = function () {
        if (readGeneration !== modalGeneration || readNumber !== productImportReadNumber || modal.hidden) return;
        productImportReading = false;
        const parsed = parseProductImportCsv(String(reader.result || ''));
        productImportRows = parsed.items;
        productImportErrors = parsed.errors;
        renderProductImportPreview();
      };
      reader.onerror = function () {
        if (readGeneration !== modalGeneration || readNumber !== productImportReadNumber || modal.hidden) return;
        productImportReading = false;
        productImportErrors = ['Không đọc được tệp. Hãy chọn lại tệp CSV.'];
        renderProductImportPreview();
      };
      reader.readAsText(file, 'UTF-8');
      return;
    }
    if (event.target.id === 'staff-invite-role') {
      const help = modal.querySelector('.staff-role-help');
      if (help) help.textContent = staffRoleDescription(event.target.value);
    }
    if (event.target.matches('[data-purchase-product]')) {
      const product = productById(event.target.value);
      const cost = modal.querySelector('[data-purchase-cost]');
      if (product && cost && !loadPendingPurchase()) cost.value = String(product.cost);
    }
  });

  document.addEventListener('submit', function (event) {
    const authForm = event.target.closest('form[data-auth-form]');
    if (authForm) { event.preventDefault(); submitAuth(authForm); return; }
    const form = event.target.closest('form[data-form]'); if (!form) return; event.preventDefault(); const type = form.dataset.form;
    if (type === 'product') saveProduct(form);
    else if (type === 'customer') saveCustomer(form);
    else if (type === 'supplier') saveSupplier(form);
    else if (type === 'void-order') saveVoidOrder(form);
    else if (type === 'checkout') createSale(form);
    else if (type === 'return') saveReturn(form);
    else if (type === 'payment') savePayment(form);
    else if (type === 'product-import') saveProductImport(form);
    else if (type === 'cart-quantity') saveCartQuantity(form);
    else if (type === 'adjust-stock') adjustStock(form);
    else if (type === 'receive') receiveStock(form);
    else if (type === 'supplier-payment') saveSupplierPayment(form);
    else if (type === 'cash') saveCash(form);
    else if (type === 'cash-session-open') saveCashSessionOpen(form);
    else if (type === 'cash-session-close') saveCashSessionClose(form);
    else if (type === 'settings') saveSettings(form);
    else if (type === 'staff-invite') saveStaffInvitation(form);
    else if (type === 'scan') addByCode(form);
    else if (type === 'discount') { if (checkoutPendingPayload) return toast('Đang chờ xác nhận đơn', 'Hãy kiểm tra đơn đang chờ trước khi thay đổi giảm giá.', 'error'); cart.discount = Math.max(0, Math.min(cartTotals().subtotal, Number(new FormData(form).get('discount')) || 0)); closeModal(); render(); toast('Đã áp dụng giảm giá', money(cart.discount)); }
  });

  backdrop.addEventListener('click', closeModal);
  document.addEventListener('keydown', function (event) {
    keepModalFocus(event);
    if (event.key === 'Escape') { closeModal(); const drawer = document.getElementById('drawer-cart'); if (drawer) drawer.classList.remove('open'); }
  });
  document.addEventListener('click', function (event) { const drawer = document.getElementById('drawer-cart'); if (drawer && event.target === drawer) drawer.classList.remove('open'); });
  window.addEventListener('online', renderShell); window.addEventListener('offline', renderShell);
  boot();
})();
