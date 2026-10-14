'use strict';

const path = require('node:path');
const { existsSync } = require('node:fs');
const { buildServer } = require('./index');
const { openPGliteRuntime } = require('./pglite-runtime');

const APP_ROOT = path.resolve(__dirname, '..');

async function main() {
  const envFile = path.join(APP_ROOT, '.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  if (process.env.NODE_ENV === 'production') {
    throw new Error('The PGlite runtime is development-only and cannot run with NODE_ENV=production.');
  }

  const dataDirectory = process.env.SLINK_LOCAL_DATA_DIR
    ? path.resolve(process.env.SLINK_LOCAL_DATA_DIR)
    : path.join(APP_ROOT, '.local-data', 'pglite');
  const runtime = await openPGliteRuntime({
    dataDirectory,
    migrationsDirectory: path.join(__dirname, 'migrations'),
  });
  const env = {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || 'development',
    PUBLIC_ORIGIN: process.env.PUBLIC_ORIGIN || 'http://127.0.0.1:3000',
  };
  const port = Number(env.PORT || 3000);
  const host = env.HOST || '127.0.0.1';
  let app;
  try {
    app = await buildServer({ pool: runtime.pool, env });
    await app.listen({ port, host });
  } catch (error) {
    if (app) await app.close();
    else await runtime.pool.end();
    throw error;
  }

  app.log.info({ address: `http://${host}:${port}`, dataDirectory, migrations: runtime.migrations }, 'Slink local development runtime ready');
  const shutdown = async () => {
    await app.close();
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`Slink local runtime failed to start: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { main };
