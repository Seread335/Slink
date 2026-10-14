const Fastify = require('fastify');
const { LogController } = Fastify;
const cookie = require('@fastify/cookie');
const helmet = require('@fastify/helmet');
const rateLimit = require('@fastify/rate-limit');
const staticFiles = require('@fastify/static');
const { existsSync } = require('node:fs');
const path = require('node:path');
const { ApiError, registerAuthRoutes } = require('./auth');
const { createPool } = require('./db');
const { registerProductRoutes } = require('./products');
const { registerSalesRoutes } = require('./sales');
const { registerReturnRoutes } = require('./returns');
const { registerRecordRoutes } = require('./records');
const { registerStockRoutes } = require('./stock');
const { registerPaymentRoutes } = require('./payments');
const { registerPurchaseRoutes } = require('./purchases');
const { registerFinanceRoutes } = require('./finance');
const { registerAnalyticsRoutes } = require('./analytics');
const { registerStoreSettingsRoutes } = require('./settings');
const { registerExportRoutes } = require('./exports');
const { registerStaffRoutes } = require('./staff');
const { registerCashRegisterRoutes } = require('./cash-register');

const APP_ROOT = path.resolve(__dirname, '..');
const ASSETS = new Map([
  ['/', 'index.html'],
  ['/index.html', 'index.html'],
  ['/verify', 'index.html'],
  ['/invite', 'index.html'],
  ['/styles.css', 'styles.css'],
  ['/app.js', 'app.js'],
  ['/register-sw.js', 'register-sw.js'],
  ['/manifest.webmanifest', 'manifest.webmanifest'],
  ['/sw.js', 'sw.js'],
  ['/assets/slink-icon.svg', 'assets/slink-icon.svg'],
  ['/assets/slink-icon-180.png', 'assets/slink-icon-180.png'],
  ['/assets/slink-icon-192.png', 'assets/slink-icon-192.png'],
  ['/assets/slink-icon-512.png', 'assets/slink-icon-512.png'],
  ['/assets/slink-icon-maskable-512.png', 'assets/slink-icon-maskable-512.png'],
]);

function trustedProxies(value) {
  if (!value) return false;
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function validateProductionConfig(env) {
  if (env.NODE_ENV !== 'production') return;
  if (env.PG_SSL !== 'true') {
    throw new Error('Production database connections require verified TLS. Set PG_SSL=true.');
  }
  let publicOrigin;
  let deliveryUrl;
  try {
    publicOrigin = new URL(env.PUBLIC_ORIGIN);
    deliveryUrl = new URL(env.EMAIL_DELIVERY_URL);
  } catch {
    throw new Error('Production requires valid PUBLIC_ORIGIN and EMAIL_DELIVERY_URL values.');
  }
  if (publicOrigin.protocol !== 'https:' || publicOrigin.pathname !== '/' || publicOrigin.search || publicOrigin.hash || publicOrigin.username || publicOrigin.password) {
    throw new Error('Production PUBLIC_ORIGIN must be an HTTPS origin without a path or credentials.');
  }
  if (deliveryUrl.protocol !== 'https:' || typeof env.EMAIL_DELIVERY_TOKEN !== 'string' || env.EMAIL_DELIVERY_TOKEN.length < 32) {
    throw new Error('Production requires an HTTPS email delivery endpoint and a token of at least 32 characters.');
  }
}

async function buildServer({ pool = null, env = process.env, logger = true } = {}) {
  const app = Fastify({
    logController: new LogController({
      disableRequestLogging: (request) => request.url.startsWith('/api/') || request.url.includes('?'),
    }),
    logger: logger ? {
      level: env.LOG_LEVEL || 'info',
      redact: {
        paths: ['req.headers.cookie', 'req.headers.authorization', 'req.headers["x-csrf-token"]', 'req.body.password', 'req.body.token'],
        censor: '[REDACTED]',
      },
    } : false,
    bodyLimit: 1024 * 1024,
    trustProxy: trustedProxies(env.TRUSTED_PROXY_IPS),
    routerOptions: { ignoreTrailingSlash: true },
  });

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
      },
    },
  });
  await app.register(cookie);
  await app.register(rateLimit, {
    global: true,
    max: 120,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({ error: { code: 'rate_limit', message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.' } }),
  });
  await app.register(staticFiles, { root: APP_ROOT, prefix: '/', serve: false });

  app.addHook('onSend', async (request, reply, payload) => {
    if (ASSETS.has(request.url.split('?')[0])) {
      const pathName = request.url.split('?')[0];
      reply.header('cache-control', ['/assets/slink-icon.svg', '/assets/slink-icon-180.png', '/assets/slink-icon-192.png', '/assets/slink-icon-512.png', '/assets/slink-icon-maskable-512.png'].includes(pathName)
        ? 'public, max-age=86400'
        : 'no-cache');
    }
    return payload;
  });

  app.addHook('onResponse', async (request, reply) => {
    if (!request.url.startsWith('/api/')) return;
    request.log.info({
      method: request.method,
      route: request.routeOptions.url || '/api/:unmatched',
      statusCode: reply.statusCode,
      responseTimeMs: Math.round(reply.elapsedTime),
    }, 'API request completed');
  });

  app.get('/api/health', async () => ({ status: 'ok' }));
  app.get('/api/ready', async (_request, reply) => {
    if (!pool) return reply.code(503).send({ status: 'unavailable' });
    try {
      await pool.query('SELECT 1');
      return { status: 'ready' };
    } catch {
      return reply.code(503).send({ status: 'unavailable' });
    }
  });

  if (pool) {
    registerAuthRoutes(app, { pool, env });
    registerProductRoutes(app, { pool, env });
    registerSalesRoutes(app, { pool, env });
    registerReturnRoutes(app, { pool, env });
    registerRecordRoutes(app, { pool, env });
    registerStockRoutes(app, { pool, env });
    registerPaymentRoutes(app, { pool, env });
    registerPurchaseRoutes(app, { pool, env });
    registerFinanceRoutes(app, { pool, env });
    registerAnalyticsRoutes(app, { pool, env });
    registerStoreSettingsRoutes(app, { pool, env });
    registerExportRoutes(app, { pool, env });
    registerStaffRoutes(app, { pool, env });
    registerCashRegisterRoutes(app, { pool, env });
  }

  for (const [route, fileName] of ASSETS) {
    app.get(route, async (_request, reply) => reply.sendFile(fileName));
  }

  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/')) {
      return reply.code(404).send({ error: { code: 'not_found', message: 'Không tìm thấy chức năng này.' } });
    }
    return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
  });

  app.setErrorHandler((error, request, reply) => {
    if (!(error instanceof ApiError)) request.log.error({ route: request.routeOptions.url || '/api/:unmatched', err: error }, 'Request failed');
    const statusCode = Number.isInteger(error.statusCode) && error.statusCode >= 400 && error.statusCode < 500 ? error.statusCode : 500;
    return reply.code(statusCode).send({
      error: {
        code: statusCode === 500 ? 'internal_error' : (error.code || 'request_error'),
        message: statusCode === 500 ? 'Đã xảy ra lỗi. Vui lòng thử lại.' : error.message,
      },
    });
  });

  if (pool) app.addHook('onClose', async () => pool.end());
  return app;
}

async function main() {
  const envFile = path.resolve(APP_ROOT, '.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  validateProductionConfig(process.env);
  const pool = createPool();
  const app = await buildServer({ pool });
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '127.0.0.1';
  await app.listen({ port, host });
  app.log.info({ address: `http://${host}:${port}` }, 'Slink API listening');
  const shutdown = async () => {
    await app.close();
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`Slink failed to start: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { buildServer, validateProductionConfig };
