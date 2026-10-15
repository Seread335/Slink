const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const { Pool } = require('pg');

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function dependencyOrder(tables, dependencies) {
  const remaining = new Set(tables);
  const ordered = [];
  while (remaining.size) {
    const ready = [...remaining].filter((table) =>
      dependencies.every(({ child, parent }) => child !== table || child === parent || !remaining.has(parent))
    );
    if (!ready.length) {
      throw new Error('The source schema contains a circular table dependency; import was not started.');
    }
    for (const table of ready.sort()) {
      remaining.delete(table);
      ordered.push(table);
    }
  }
  return ordered;
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('PGlite import is disabled in production.');
  }

  const sourceDirectory = path.resolve(process.argv[2] || '');
  const originalDirectory = path.resolve('.local-data', 'pglite');
  if (!process.argv[2] || sourceDirectory === originalDirectory || !sourceDirectory.includes('pglite-readonly-copy')) {
    throw new Error('Pass an isolated PGlite snapshot copy; the original local database is never opened for import.');
  }

  const targetUrl = process.env.SLINK_IMPORT_TARGET_URL;
  if (!targetUrl) throw new Error('SLINK_IMPORT_TARGET_URL is required for the one-time local import.');
  const expectedEmail = process.env.SLINK_IMPORT_VERIFY_EMAIL?.trim().toLowerCase();
  if (!expectedEmail) throw new Error('SLINK_IMPORT_VERIFY_EMAIL is required to verify the intended local account.');
  const parsedTarget = new URL(targetUrl);
  if (!['127.0.0.1', 'localhost', '::1'].includes(parsedTarget.hostname)) {
    throw new Error('This import utility accepts a local PostgreSQL target only.');
  }

  const source = new PGlite(sourceDirectory);
  const targetPool = new Pool({ connectionString: targetUrl, max: 1, connectionTimeoutMillis: 10000 });
  try {
    await source.waitReady;
    await source.exec("SET TIME ZONE 'UTC'");

    const sourceTableResult = await source.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> 'schema_migrations'
       ORDER BY table_name`
    );
    const sourceTables = sourceTableResult.rows.map((row) => row.table_name);
    if (!sourceTables.length) throw new Error('The PGlite snapshot contains no business tables.');

    const destinationResult = await targetPool.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       ORDER BY table_name`
    );
    const destinationTables = new Set(destinationResult.rows.map((row) => row.table_name));
    const missingTables = sourceTables.filter((table) => !destinationTables.has(table));
    if (missingTables.length) throw new Error(`Destination is missing source tables: ${missingTables.join(', ')}.`);

    for (const table of destinationTables) {
      if (table === 'schema_migrations') continue;
      const count = await targetPool.query(`SELECT count(*)::bigint AS count FROM public.${quoteIdentifier(table)}`);
      if (BigInt(count.rows[0].count) !== 0n) {
        throw new Error('The PostgreSQL destination already has business rows; import was not started.');
      }
    }

    const dependencyResult = await source.query(
      `SELECT DISTINCT child.relname AS child, parent.relname AS parent
       FROM pg_constraint fk
       JOIN pg_class child ON child.oid = fk.conrelid
       JOIN pg_namespace child_ns ON child_ns.oid = child.relnamespace
       JOIN pg_class parent ON parent.oid = fk.confrelid
       WHERE fk.contype = 'f' AND child_ns.nspname = 'public'`
    );
    const dependencies = dependencyResult.rows.filter(({ child, parent }) => child !== parent);
    const orderedTables = dependencyOrder(sourceTables, dependencies);

    const client = await targetPool.connect();
    let committed = false;
    const imported = [];
    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL TIME ZONE 'UTC'");

      for (const table of orderedTables) {
        const [sourceColumnsResult, destinationColumnsResult] = await Promise.all([
          source.query(
            `SELECT column_name
             FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = $1 AND is_generated = 'NEVER'
             ORDER BY ordinal_position`,
            [table]
          ),
          client.query(
            `SELECT column_name, is_identity
             FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = $1 AND is_generated = 'NEVER'
             ORDER BY ordinal_position`,
            [table]
          ),
        ]);
        const sourceColumns = sourceColumnsResult.rows.map((row) => row.column_name);
        const destinationColumns = new Map(destinationColumnsResult.rows.map((row) => [row.column_name, row.is_identity]));
        const columns = sourceColumns.filter((column) => destinationColumns.has(column));
        if (!columns.length) throw new Error(`No compatible columns were found for ${table}.`);

        const selectColumns = columns.map((column) => `${quoteIdentifier(column)}::text AS ${quoteIdentifier(column)}`).join(', ');
        const rows = await source.query(`SELECT ${selectColumns} FROM public.${quoteIdentifier(table)}`);
        if (!rows.rows.length) continue;

        const insertColumns = columns.map(quoteIdentifier).join(', ');
        const values = `(${columns.map((_, index) => `$${index + 1}`).join(', ')})`;
        const hasIdentity = columns.some((column) => destinationColumns.get(column) === 'YES');
        const identityClause = hasIdentity ? ' OVERRIDING SYSTEM VALUE' : '';
        const insertSql = `INSERT INTO public.${quoteIdentifier(table)} (${insertColumns})${identityClause} VALUES ${values}`;
        for (const row of rows.rows) {
          const params = columns.map((column) => row[column]);
          await client.query(insertSql, params);
        }

        imported.push({ table, rows: rows.rows.length, identity: hasIdentity });
      }

      for (const { table, identity } of imported.filter((entry) => entry.identity)) {
        const columnsResult = await client.query(
          `SELECT column_name
           FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = $1 AND is_identity = 'YES'`,
          [table]
        );
        for (const { column_name: column } of columnsResult.rows) {
          const sequence = await client.query('SELECT pg_get_serial_sequence($1, $2) AS name', [`public.${table}`, column]);
          if (!sequence.rows[0].name) continue;
          const maximum = await client.query(
            `SELECT max(${quoteIdentifier(column)})::text AS value FROM public.${quoteIdentifier(table)}`
          );
          const value = maximum.rows[0].value;
          await client.query('SELECT setval($1::regclass, $2, $3)', [sequence.rows[0].name, value || '1', value !== null]);
        }
      }

      const account = await client.query(
        `SELECT count(*)::int AS matching_account,
                bool_or(email_verified_at IS NOT NULL) AS email_verified
         FROM public.users WHERE email_normalized = $1`,
        [expectedEmail]
      );
      if (account.rows[0].matching_account !== 1) {
        throw new Error('The expected local Slink account was not found in the copied snapshot.');
      }

      await client.query('COMMIT');
      committed = true;
      const totalRows = imported.reduce((total, entry) => total + entry.rows, 0);
      process.stdout.write(JSON.stringify({
        importedTables: imported.length,
        importedRows: totalRows,
        accountPresent: true,
        accountEmailVerified: account.rows[0].email_verified === true,
      }) + '\n');
    } catch (error) {
      if (!committed) await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await source.close();
    await targetPool.end();
  }
}

main().catch((error) => {
  process.stderr.write(`Local PostgreSQL import failed: ${error.message}\n`);
  process.exitCode = 1;
});
