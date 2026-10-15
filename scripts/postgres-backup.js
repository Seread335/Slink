'use strict';

const { spawn } = require('node:child_process');
const { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } = require('node:crypto');
const { createReadStream, createWriteStream } = require('node:fs');
const fs = require('node:fs/promises');
const path = require('node:path');
const { Transform, Writable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { Pool } = require('pg');

const MAGIC = Buffer.from('SLINKPGBAK1', 'ascii');
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const PREFIX_BYTES = MAGIC.length + NONCE_BYTES;
const ARCHIVE_MAGIC = Buffer.from('PGDMP', 'ascii');
const MAX_ERROR_BYTES = 8192;

function fail(message) {
  throw new Error(message);
}

function backupKey(env = process.env) {
  const encoded = env.SLINK_BACKUP_ENCRYPTION_KEY;
  if (!encoded || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
    fail('SLINK_BACKUP_ENCRYPTION_KEY must be a base64-encoded 32-byte key from the secret manager.');
  }
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32 || key.toString('base64') !== encoded) {
    fail('SLINK_BACKUP_ENCRYPTION_KEY must be a base64-encoded 32-byte key from the secret manager.');
  }
  if (!env.SLINK_BACKUP_KEY_ID || !/^[A-Za-z0-9._-]{1,80}$/.test(env.SLINK_BACKUP_KEY_ID)) {
    fail('SLINK_BACKUP_KEY_ID must identify the active backup key version.');
  }
  return { key, keyId: env.SLINK_BACKUP_KEY_ID };
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function manifestSignature(manifest, key) {
  const unsigned = { ...manifest };
  delete unsigned.manifestHmac;
  return createHmac('sha256', key).update(canonicalJson(unsigned)).digest('hex');
}

function parseDatabaseUrl(value, variableName) {
  if (!value) fail(`${variableName} is required.`);
  let url;
  try {
    url = new URL(value);
  } catch {
    fail(`${variableName} must be a valid PostgreSQL connection URL.`);
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    fail(`${variableName} must use the postgres:// or postgresql:// scheme.`);
  }
  const databaseName = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!hostname || !databaseName || !url.username) {
    fail(`${variableName} must include a host, database name and username.`);
  }
  const localHost = ['localhost', '127.0.0.1', '::1'].includes(hostname);
  const sslMode = url.searchParams.get('sslmode');
  if (!localHost && sslMode !== 'verify-full') {
    fail(`${variableName} must use sslmode=verify-full for a non-local database.`);
  }
  return { url, hostname, localHost, databaseName, sslMode };
}

function baseProcessEnvironment() {
  const allowed = new Set(['PATH', 'PATHEXT', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'COMSPEC']);
  return Object.fromEntries(Object.entries(process.env).filter(([name]) => allowed.has(name.toUpperCase())));
}

function postgresEnvironment(connection, additions = {}) {
  const env = baseProcessEnvironment();
  env.PGHOST = connection.hostname;
  env.PGPORT = connection.url.port || '5432';
  env.PGUSER = decodeURIComponent(connection.url.username);
  env.PGDATABASE = connection.databaseName;
  const password = decodeURIComponent(connection.url.password);
  if (password) env.PGPASSWORD = password;
  if (connection.sslMode) env.PGSSLMODE = connection.sslMode;
  const rootCert = connection.url.searchParams.get('sslrootcert');
  if (rootCert) env.PGSSLROOTCERT = rootCert;
  env.PGAPPNAME = 'slink-backup-tool';
  env.PGCONNECT_TIMEOUT = '10';
  return { ...env, ...additions };
}

function captureProcess(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout = (stdout + chunk).slice(-MAX_ERROR_BYTES); });
    child.stderr.on('data', (chunk) => { stderr = (stderr + chunk).slice(-MAX_ERROR_BYTES); });
    child.once('error', reject);
    child.once('close', (code, signal) => {
      if (code === 0) resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
      else reject(new Error(`${path.basename(command)} exited with ${signal || `code ${code}`}${stderr ? `: ${stderr}` : '.'}`));
    });
  });
}

function processOutcome(child, command, getStderr) {
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => {
      if (code === 0) resolve();
      else {
        const detail = getStderr();
        reject(new Error(`${path.basename(command)} exited with ${signal || `code ${code}`}${detail ? `: ${detail}` : '.'}`));
      }
    });
  });
}

function collectStderr(stream) {
  let result = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => { result = (result + chunk).slice(-MAX_ERROR_BYTES); });
  return () => result.trim();
}

function encryptTransform(key, nonce) {
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  return new Transform({
    transform(chunk, _encoding, callback) {
      try { callback(null, cipher.update(chunk)); } catch (error) { callback(error); }
    },
    flush(callback) {
      try {
        this.push(cipher.final());
        this.push(cipher.getAuthTag());
        callback();
      } catch (error) { callback(error); }
    },
  });
}

function decryptTransform(key, nonce, tag, { checkArchiveMagic = false } = {}) {
  const decipher = createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAuthTag(tag);
  let prefix = Buffer.alloc(0);
  let checked = false;

  const pushPlaintext = (chunk, stream) => {
    if (!chunk.length) return;
    if (checkArchiveMagic && !checked) {
      const needed = ARCHIVE_MAGIC.length - prefix.length;
      const take = Math.min(needed, chunk.length);
      prefix = Buffer.concat([prefix, chunk.subarray(0, take)]);
      if (prefix.length === ARCHIVE_MAGIC.length) {
        checked = prefix.equals(ARCHIVE_MAGIC);
        if (!checked) throw new Error('Decrypted file is not a PostgreSQL custom-format archive.');
      }
    }
    stream.push(chunk);
  };

  return new Transform({
    transform(chunk, _encoding, callback) {
      try { pushPlaintext(decipher.update(chunk), this); callback(); } catch (error) { callback(error); }
    },
    flush(callback) {
      try {
        pushPlaintext(decipher.final(), this);
        if (checkArchiveMagic && !checked) throw new Error('Backup archive is incomplete.');
        callback();
      } catch (error) { callback(error); }
    },
  });
}

async function hashFile(filePath) {
  const digest = createHash('sha256');
  let bytes = 0;
  for await (const chunk of createReadStream(filePath)) {
    digest.update(chunk);
    bytes += chunk.length;
  }
  return { sha256: digest.digest('hex'), bytes };
}

async function readEncryptedHeader(filePath) {
  const stat = await fs.stat(filePath);
  if (stat.size <= PREFIX_BYTES + TAG_BYTES) fail('Encrypted backup is too small or incomplete.');
  const handle = await fs.open(filePath, 'r');
  try {
    const prefix = Buffer.alloc(PREFIX_BYTES);
    const tag = Buffer.alloc(TAG_BYTES);
    await handle.read(prefix, 0, prefix.length, 0);
    await handle.read(tag, 0, tag.length, stat.size - TAG_BYTES);
    if (!prefix.subarray(0, MAGIC.length).equals(MAGIC)) fail('Backup file format is not recognized.');
    return { stat, nonce: prefix.subarray(MAGIC.length), tag };
  } finally {
    await handle.close();
  }
}

function encryptedBodyStream(filePath, size) {
  return createReadStream(filePath, { start: PREFIX_BYTES, end: size - TAG_BYTES - 1 });
}

async function verifyManifest(manifestPath, keyInfo) {
  const manifestFile = path.resolve(manifestPath);
  let manifest;
  try {
    manifest = JSON.parse(await fs.readFile(manifestFile, 'utf8'));
  } catch {
    fail(`Could not read backup manifest: ${manifestFile}`);
  }
  if (manifest.formatVersion !== 1 || manifest.encryption !== 'aes-256-gcm') {
    fail('Backup manifest version or encryption algorithm is unsupported.');
  }
  if (manifest.keyId !== keyInfo.keyId) {
    fail(`Backup requires key ID '${manifest.keyId}'. Set SLINK_BACKUP_KEY_ID and its key from the secret manager before continuing.`);
  }
  if (!/^[a-f0-9]{64}$/.test(manifest.manifestHmac || '')) fail('Backup manifest authentication is missing or invalid.');
  const expectedHmac = Buffer.from(manifestSignature(manifest, keyInfo.key), 'hex');
  const actualHmac = Buffer.from(manifest.manifestHmac, 'hex');
  if (actualHmac.length !== expectedHmac.length || !timingSafeEqual(actualHmac, expectedHmac)) {
    fail('Backup manifest authentication failed.');
  }
  if (typeof manifest.fileName !== 'string' || path.basename(manifest.fileName) !== manifest.fileName) {
    fail('Backup manifest contains an invalid archive filename.');
  }
  if (!/^[a-f0-9]{64}$/.test(manifest.archiveSha256 || '') || !Number.isSafeInteger(manifest.archiveBytes)) {
    fail('Backup manifest checksum or size is invalid.');
  }
  if (!Number.isSafeInteger(manifest.serverVersionNum) || manifest.serverVersionNum < 10000) {
    fail('Backup manifest does not contain a supported PostgreSQL version.');
  }
  const archivePath = path.join(path.dirname(manifestFile), manifest.fileName);
  const fileInfo = await hashFile(archivePath);
  if (fileInfo.bytes !== manifest.archiveBytes || fileInfo.sha256 !== manifest.archiveSha256) {
    fail('Backup checksum does not match its manifest.');
  }
  const header = await readEncryptedHeader(archivePath);
  const sink = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
  await pipeline(
    encryptedBodyStream(archivePath, header.stat.size),
    decryptTransform(keyInfo.key, header.nonce, header.tag, { checkArchiveMagic: true }),
    sink,
  );
  return { manifest, archivePath, header };
}

async function backupMetadata(connection) {
  const pool = new Pool({ connectionString: connection.url.toString(), max: 1, connectionTimeoutMillis: 10000, application_name: 'slink-backup-tool' });
  try {
    const role = await pool.query(
      `SELECT r.rolsuper, r.rolbypassrls, current_database() AS database_name,
              current_setting('server_version_num')::integer AS server_version_num,
              current_setting('server_version') AS server_version
       FROM pg_catalog.pg_roles r WHERE r.rolname = current_user`,
    );
    if (!role.rowCount) fail('Could not inspect the backup database role.');
    if (role.rows[0].rolsuper) fail('Use a dedicated non-superuser backup role, not a PostgreSQL superuser.');
    if (!role.rows[0].rolbypassrls) fail('The backup role must have BYPASSRLS so the dump cannot silently omit another store’s rows.');
    return role.rows[0];
  } finally {
    await pool.end();
  }
}

async function createBackup() {
  const keyInfo = backupKey();
  const connection = parseDatabaseUrl(process.env.BACKUP_DATABASE_URL, 'BACKUP_DATABASE_URL');
  const metadata = await backupMetadata(connection);
  const pgDump = process.env.PG_DUMP_BIN || 'pg_dump';
  const version = await captureProcess(pgDump, ['--version'], baseProcessEnvironment());
  const outputDirectory = path.resolve(process.env.SLINK_BACKUP_DIR || path.join(__dirname, '..', '.local-data', 'backups'));
  await fs.mkdir(outputDirectory, { recursive: true, mode: 0o700 });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `${timestamp}-${randomUUID()}.slinkbackup`;
  const archivePath = path.join(outputDirectory, fileName);
  const partialPath = `${archivePath}.partial`;
  const manifestPath = `${archivePath}.manifest.json`;
  const nonce = randomBytes(NONCE_BYTES);
  const prefix = Buffer.concat([MAGIC, nonce]);

  try {
    await fs.writeFile(partialPath, prefix, { flag: 'wx', mode: 0o600 });
    const env = postgresEnvironment(connection, {
      PGOPTIONS: '-crow_security=off -cdefault_transaction_read_only=on',
    });
    const child = spawn(pgDump, ['--format=custom', '--compress=6'], {
      env,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stderr = collectStderr(child.stderr);
    const outcome = processOutcome(child, pgDump, stderr);
    const stream = pipeline(child.stdout, encryptTransform(keyInfo.key, nonce), createWriteStream(partialPath, { flags: 'a', mode: 0o600 }));
    try {
      await Promise.all([stream, outcome]);
    } catch (error) {
      child.kill();
      await Promise.allSettled([stream, outcome]);
      throw error;
    }

    const archiveInfo = await hashFile(partialPath);
    await fs.rename(partialPath, archivePath);
    const manifest = {
      formatVersion: 1,
      createdAt: new Date().toISOString(),
      fileName,
      archiveBytes: archiveInfo.bytes,
      archiveSha256: archiveInfo.sha256,
      encryption: 'aes-256-gcm',
      keyId: keyInfo.keyId,
      databaseName: metadata.database_name,
      serverVersion: metadata.server_version,
      serverVersionNum: metadata.server_version_num,
      pgDumpVersion: version.stdout,
    };
    manifest.manifestHmac = manifestSignature(manifest, keyInfo.key);
    const manifestTemp = `${manifestPath}.partial`;
    await fs.writeFile(manifestTemp, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    await fs.rename(manifestTemp, manifestPath);
    process.stdout.write(`Encrypted backup created: ${manifestPath}\n`);
    process.stdout.write(`Archive size: ${archiveInfo.bytes} bytes\n`);
  } catch (error) {
    await fs.rm(partialPath, { force: true });
    await fs.rm(archivePath, { force: true });
    await fs.rm(`${manifestPath}.partial`, { force: true });
    await fs.rm(manifestPath, { force: true });
    throw error;
  }
}

async function validateRestoreTarget(connection, manifest) {
  if (process.env.SLINK_RESTORE_CONFIRM_DATABASE !== connection.databaseName) {
    fail(`Set SLINK_RESTORE_CONFIRM_DATABASE to the exact target database name '${connection.databaseName}'.`);
  }
  if (process.env.SLINK_RESTORE_ALLOW_EMPTY_TARGET !== 'YES') {
    fail('Restore requires SLINK_RESTORE_ALLOW_EMPTY_TARGET=YES after confirming the target is disposable and empty.');
  }
  if (!connection.localHost && process.env.SLINK_RESTORE_ALLOW_REMOTE !== 'YES') {
    fail('Remote restore requires SLINK_RESTORE_ALLOW_REMOTE=YES after confirming this is an isolated recovery target.');
  }

  const pool = new Pool({ connectionString: connection.url.toString(), max: 1, connectionTimeoutMillis: 10000, application_name: 'slink-restore-tool' });
  try {
    const state = await pool.query(
      `SELECT current_database() AS database_name,
              current_setting('server_version_num')::integer AS server_version_num,
              has_database_privilege(current_user, current_database(), 'CREATE') AS can_create_schema,
              EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'slink_app') AS has_app_role,
              (SELECT count(*) FROM pg_catalog.pg_class c
                 JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
                  AND n.nspname NOT LIKE 'pg_toast%'
                  AND n.nspname NOT LIKE 'pg_temp_%'
                  AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')) AS relation_count,
              (SELECT count(*) FROM pg_catalog.pg_proc p
                 JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
                  AND n.nspname NOT LIKE 'pg_toast%'
                  AND n.nspname NOT LIKE 'pg_temp_%') AS routine_count,
              (SELECT count(*) FROM pg_catalog.pg_type t
                 JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
                WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
                  AND n.nspname NOT LIKE 'pg_toast%'
                  AND n.nspname NOT LIKE 'pg_temp_%'
                  AND t.typtype <> 'p') AS type_count,
              (SELECT count(*) FROM pg_catalog.pg_operator o
                 JOIN pg_catalog.pg_namespace n ON n.oid = o.oprnamespace
                WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
                  AND n.nspname NOT LIKE 'pg_toast%'
                  AND n.nspname NOT LIKE 'pg_temp_%') AS operator_count,
              (SELECT count(*) FROM pg_catalog.pg_collation c
                 JOIN pg_catalog.pg_namespace n ON n.oid = c.collnamespace
                WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
                  AND n.nspname NOT LIKE 'pg_toast%'
                  AND n.nspname NOT LIKE 'pg_temp_%') AS collation_count,
              (SELECT count(*) FROM pg_catalog.pg_namespace n
                WHERE n.nspname NOT IN ('pg_catalog', 'information_schema', 'public')
                  AND n.nspname NOT LIKE 'pg_toast%'
                  AND n.nspname NOT LIKE 'pg_temp_%') AS custom_schema_count,
              (SELECT count(*) FROM pg_catalog.pg_extension e WHERE e.extname <> 'plpgsql') AS extension_count`,
    );
    const target = state.rows[0];
    if (target.database_name !== connection.databaseName) fail('Connected database name does not match the target URL.');
    if (!target.can_create_schema) fail('The restore role needs CREATE privilege on the target database so it can restore the archived schema.');
    if (!target.has_app_role) fail('Create the slink_app role on the target cluster before restoring ACL grants.');
    if (target.relation_count || target.routine_count || target.type_count || target.operator_count
      || target.collation_count || target.custom_schema_count || target.extension_count) {
      fail('Restore target contains application objects or extensions; choose a new, empty disposable database.');
    }
    if (Math.floor(target.server_version_num / 10000) < Math.floor(manifest.serverVersionNum / 10000)) {
      fail('The target PostgreSQL major version is older than the backup source.');
    }
  } finally {
    await pool.end();
  }
}

async function restoreBackup(manifestPath) {
  if (!manifestPath) fail('Provide the path to a .manifest.json backup manifest.');
  const keyInfo = backupKey();
  const verified = await verifyManifest(manifestPath, keyInfo);
  const connection = parseDatabaseUrl(process.env.RESTORE_DATABASE_URL, 'RESTORE_DATABASE_URL');
  await validateRestoreTarget(connection, verified.manifest);

  const pgRestore = process.env.PG_RESTORE_BIN || 'pg_restore';
  const env = postgresEnvironment(connection);
  const child = spawn(pgRestore, [
    '--exit-on-error',
    '--single-transaction',
    '--no-owner',
    `--dbname=${connection.databaseName}`,
    '-',
  ], { env, windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] });
  const stderr = collectStderr(child.stderr);
  const outcome = processOutcome(child, pgRestore, stderr);
  const stream = pipeline(
    encryptedBodyStream(verified.archivePath, verified.header.stat.size),
    decryptTransform(keyInfo.key, verified.header.nonce, verified.header.tag, { checkArchiveMagic: true }),
    child.stdin,
  );
  try {
    await Promise.all([stream, outcome]);
  } catch (error) {
    child.kill();
    await Promise.allSettled([stream, outcome]);
    throw error;
  }
  process.stdout.write(`Backup restored into empty database '${connection.databaseName}'.\n`);
  process.stdout.write('Run the migration release step, verify /api/ready, and perform the documented recovery checks before routing traffic.\n');
}

async function main() {
  const [action, manifestPath] = process.argv.slice(2);
  if (action === 'create') return createBackup();
  if (action === 'verify') {
    if (!manifestPath) fail('Provide the path to a .manifest.json backup manifest.');
    const verified = await verifyManifest(manifestPath, backupKey());
    process.stdout.write(`Backup verified: ${verified.manifest.fileName}\n`);
    return;
  }
  if (action === 'restore') return restoreBackup(manifestPath);
  process.stdout.write([
    'Usage:',
    '  node scripts/postgres-backup.js create',
    '  node scripts/postgres-backup.js verify <backup.manifest.json>',
    '  node scripts/postgres-backup.js restore <backup.manifest.json>',
    '',
  ].join('\n'));
  if (action) fail(`Unknown action '${action}'.`);
}

main().catch((error) => {
  process.stderr.write(`Backup operation failed: ${error.message}\n`);
  process.exitCode = 1;
});
