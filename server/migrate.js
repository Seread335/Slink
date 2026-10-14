const fs = require('node:fs/promises');
const path = require('node:path');
const { existsSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { Pool } = require('pg');

const envFile = path.resolve(__dirname, '..', '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

if (process.env.NODE_ENV === 'production' && process.env.PG_SSL !== 'true') {
  throw new Error('Production database migrations require verified TLS. Set PG_SSL=true.');
}

const connectionString = process.env.MIGRATION_DATABASE_URL;
if (!connectionString) throw new Error('MIGRATION_DATABASE_URL is required.');

const pool = new Pool({
  connectionString,
  max: 1,
  connectionTimeoutMillis: 10000,
  ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
});

async function main() {
  const client = await pool.connect();
  let locked = false;
  try {
    await client.query('SELECT pg_advisory_lock($1)', [741293847]);
    locked = true;
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        version text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const directory = path.join(__dirname, 'migrations');
    const files = (await fs.readdir(directory)).filter((name) => name.endsWith('.sql')).sort();
    for (const version of files) {
      const sql = await fs.readFile(path.join(directory, version), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const applied = await client.query('SELECT checksum FROM public.schema_migrations WHERE version = $1', [version]);
      if (applied.rowCount) {
        if (applied.rows[0].checksum !== checksum) throw new Error(`Applied migration was edited: ${version}`);
        continue;
      }

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO public.schema_migrations (version, checksum) VALUES ($1, $2)', [version, checksum]);
        await client.query('COMMIT');
        process.stdout.write(`Applied ${version}\n`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    if (locked) await client.query('SELECT pg_advisory_unlock($1)', [741293847]);
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  process.stderr.write(`Migration failed: ${error.message}\n`);
  process.exitCode = 1;
});
