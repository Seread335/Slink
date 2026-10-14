'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');

class RuntimeClosedError extends Error {
  constructor() {
    super('The local database runtime has been closed.');
    this.name = 'RuntimeClosedError';
  }
}

async function acquireProcessLock(dataDirectory) {
  const lockPath = path.join(dataDirectory, '.slink-dev.lock');
  const token = randomUUID();
  let handle;

  try {
    handle = await fs.open(lockPath, 'wx');
    await handle.writeFile(JSON.stringify({ pid: process.pid, token, startedAt: new Date().toISOString() }));
    await handle.sync();
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    if (error.code !== 'EEXIST') throw error;

    let owner;
    try {
      owner = JSON.parse(await fs.readFile(lockPath, 'utf8'));
    } catch {
      throw new Error(`The local database lock at ${lockPath} cannot be read. Confirm no Slink development server is using this data before removing the lock.`);
    }
    const ownerPid = Number(owner.pid);
    let ownerIsRunning = !Number.isSafeInteger(ownerPid) || ownerPid < 1;
    if (!ownerIsRunning) {
      try {
        process.kill(ownerPid, 0);
        ownerIsRunning = true;
      } catch (processError) {
        ownerIsRunning = processError.code !== 'ESRCH';
      }
    }
    if (ownerIsRunning) {
      throw new Error(`The local database is already in use by process ${ownerPid || 'unknown'}. Stop that Slink development server before opening this data directory again.`);
    }

    await fs.unlink(lockPath).catch((unlinkError) => {
      if (unlinkError.code !== 'ENOENT') throw unlinkError;
    });
    return acquireProcessLock(dataDirectory);
  }

  return async () => {
    await handle.close().catch(() => {});
    let owner;
    try { owner = JSON.parse(await fs.readFile(lockPath, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return; throw error; }
    if (owner.token === token) await fs.unlink(lockPath).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
  };
}

function createPGlitePool(db, { releaseLock = async () => {} } = {}) {
  let queue = Promise.resolve();
  let closed = false;

  async function acquire() {
    if (closed) throw new RuntimeClosedError();
    let releaseTurn;
    const turn = new Promise((resolve) => { releaseTurn = resolve; });
    const previous = queue;
    queue = previous.then(() => turn);
    await previous;
    if (closed) {
      releaseTurn();
      throw new RuntimeClosedError();
    }
    return releaseTurn;
  }

  return {
    async query(sql, params = []) {
      const release = await acquire();
      try { return await db.query(sql, params); }
      finally { release(); }
    },
    async connect() {
      let release = null;
      let activeTransaction = null;
      let transactionPromise = null;
      let finishTransaction = null;
      let clientReleased = false;

      async function finish(commit) {
        if (!activeTransaction || !finishTransaction) throw new Error('No active local database transaction.');
        const active = transactionPromise;
        finishTransaction(commit);
        try {
          await active;
        } catch (error) {
          if (commit || error?.message !== 'local transaction rollback') throw error;
        } finally {
          activeTransaction = null;
          transactionPromise = null;
          finishTransaction = null;
          release?.();
          release = null;
        }
        return { rows: [], rowCount: null };
      }

      return {
        async query(sql, params = []) {
          const command = String(sql).trim().replace(/;$/, '').toUpperCase();
          if (command === 'BEGIN') {
            if (activeTransaction) throw new Error('A local database transaction is already active.');
            release = await acquire();
            let announceReady;
            const ready = new Promise((resolve) => { announceReady = resolve; });
            const finished = new Promise((resolve) => { finishTransaction = resolve; });
            transactionPromise = db.transaction(async (transaction) => {
              await transaction.query('SET ROLE slink_app');
              activeTransaction = transaction;
              announceReady();
              const commit = await finished;
              if (!commit) throw new Error('local transaction rollback');
            });
            transactionPromise.catch(() => {});
            try {
              await ready;
            } catch (error) {
              release?.();
              release = null;
              throw error;
            }
            return { rows: [], rowCount: null };
          }
          if (command === 'COMMIT') return finish(true);
          if (command === 'ROLLBACK') return finish(false);
          if (!activeTransaction) throw new Error('A local database query requires an active transaction.');
          return activeTransaction.query(sql, params);
        },
        release() {
          if (clientReleased) return;
          clientReleased = true;
          if (activeTransaction) void finish(false).catch(() => {});
        },
      };
    },
    async end() {
      if (closed) return;
      const release = await acquire();
      closed = true;
      release();
      try { await db.close(); }
      finally { await releaseLock(); }
    },
  };
}

async function applyMigrations(db, migrationsDirectory) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      version text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const files = (await fs.readdir(migrationsDirectory)).filter((name) => name.endsWith('.sql')).sort();
  for (const version of files) {
    const sql = await fs.readFile(path.join(migrationsDirectory, version), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const applied = await db.query('SELECT checksum FROM public.schema_migrations WHERE version = $1', [version]);
    if (applied.rowCount) {
      if (applied.rows[0].checksum !== checksum) throw new Error(`Applied migration was edited: ${version}`);
      continue;
    }

    await db.transaction(async (transaction) => {
      await transaction.exec(sql);
      await transaction.query(
        'INSERT INTO public.schema_migrations (version, checksum) VALUES ($1, $2)',
        [version, checksum]
      );
    });
    process.stdout.write(`Applied local migration ${version}\n`);
  }

  const role = await db.query("SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'slink_app'");
  if (!role.rowCount) await db.exec('CREATE ROLE slink_app NOLOGIN');
  await db.exec(`
    GRANT USAGE ON SCHEMA public TO slink_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO slink_app;
    REVOKE ALL ON public.schema_migrations FROM slink_app;
    GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO slink_app;
  `);
}

async function openPGliteRuntime({ dataDirectory, migrationsDirectory }) {
  const absoluteDirectory = path.resolve(dataDirectory);
  await fs.mkdir(absoluteDirectory, { recursive: true });
  const releaseLock = await acquireProcessLock(absoluteDirectory);
  let db;
  try {
    const { PGlite } = await import('@electric-sql/pglite');
    db = new PGlite(absoluteDirectory);
    await db.waitReady;
    await applyMigrations(db, migrationsDirectory);
    const pool = createPGlitePool(db, { releaseLock });
    const applied = await db.query('SELECT version FROM public.schema_migrations ORDER BY version');
    return { db, pool, migrations: applied.rows.map((row) => row.version) };
  } catch (error) {
    if (db) await db.close().catch(() => {});
    await releaseLock();
    throw error;
  }
}

module.exports = { acquireProcessLock, applyMigrations, createPGlitePool, openPGliteRuntime };
