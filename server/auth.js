'use strict';

const {
  createHash,
  randomBytes,
  scrypt: scryptCallback,
  scryptSync,
  timingSafeEqual,
} = require('node:crypto');
const { promisify } = require('node:util');
const { listStores, withUser } = require('./db');

const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = 'slink_session';
const CSRF_COOKIE = 'slink_csrf';
const SESSION_DAYS = 14;
const VERIFY_HOURS = 24;
const PASSWORD_RESET_HOURS = 1;
const PASSWORD_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

class ApiError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function digest(value) {
  return createHash('sha256').update(value).digest();
}

function newToken() {
  return randomBytes(32).toString('base64url');
}

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64, PASSWORD_OPTIONS);
  return `scrypt$${PASSWORD_OPTIONS.N}$${PASSWORD_OPTIONS.r}$${PASSWORD_OPTIONS.p}$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}

const dummySalt = Buffer.from('slink-dummy-salt');
const DUMMY_PASSWORD_HASH = `scrypt$${PASSWORD_OPTIONS.N}$${PASSWORD_OPTIONS.r}$${PASSWORD_OPTIONS.p}$${dummySalt.toString('base64url')}$${scryptSync('slink-invalid-account-password', dummySalt, 64, PASSWORD_OPTIONS).toString('base64url')}`;

async function verifyPassword(password, encoded) {
  const parts = String(encoded || '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, saltText, hashText] = parts;
  const N = Number(n);
  const costR = Number(r);
  const costP = Number(p);
  if (N !== PASSWORD_OPTIONS.N || costR !== PASSWORD_OPTIONS.r || costP !== PASSWORD_OPTIONS.p) return false;
  let salt;
  let expected;
  try {
    salt = Buffer.from(saltText, 'base64url');
    expected = Buffer.from(hashText, 'base64url');
  } catch {
    return false;
  }
  if (salt.length !== 16 || expected.length !== 64) return false;
  const actual = await scrypt(password, salt, expected.length, PASSWORD_OPTIONS);
  return timingSafeEqual(actual, expected);
}

function cookieOptions(env, maxAge) {
  return {
    path: '/',
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    maxAge,
  };
}

function setSessionCookies(reply, env, sessionToken, csrfToken) {
  const options = cookieOptions(env, SESSION_DAYS * 24 * 60 * 60);
  reply.setCookie(SESSION_COOKIE, sessionToken, { ...options, httpOnly: true });
  reply.setCookie(CSRF_COOKIE, csrfToken, { ...options, httpOnly: false });
}

function clearSessionCookies(reply, env) {
  const options = { ...cookieOptions(env, 0), expires: new Date(0) };
  reply.clearCookie(SESSION_COOKIE, { ...options, httpOnly: true });
  reply.clearCookie(CSRF_COOKIE, { ...options, httpOnly: false });
}

async function authenticate(pool, request) {
  const token = request.cookies?.[SESSION_COOKIE];
  if (!token || token.length > 128) throw new ApiError(401, 'unauthorized', 'Vui lòng đăng nhập để tiếp tục.');
  const tokenDigest = digest(token);
  const result = await pool.query(
    `SELECT s.user_id, s.csrf_digest, u.email, u.display_name
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_digest = $1 AND s.revoked_at IS NULL AND s.expires_at > now()
       AND u.status = 'active' AND u.email_verified_at IS NOT NULL`,
    [tokenDigest]
  );
  if (!result.rowCount) throw new ApiError(401, 'unauthorized', 'Vui lòng đăng nhập để tiếp tục.');
  request.auth = {
    userId: result.rows[0].user_id,
    email: result.rows[0].email,
    displayName: result.rows[0].display_name,
    tokenDigest,
    csrfDigest: result.rows[0].csrf_digest,
  };
  return request.auth;
}

function assertSameOrigin(request, env) {
  const expectedOrigin = env.PUBLIC_ORIGIN ? new URL(env.PUBLIC_ORIGIN).origin : null;
  const origin = request.headers.origin;
  if (expectedOrigin && origin !== expectedOrigin) {
    throw new ApiError(403, 'origin_rejected', 'Nguồn yêu cầu không được chấp nhận.');
  }
}

function requireCsrf(request, env) {
  assertSameOrigin(request, env);
  const cookieToken = request.cookies?.[CSRF_COOKIE];
  const headerToken = request.headers['x-csrf-token'];
  if (typeof cookieToken !== 'string' || typeof headerToken !== 'string' || cookieToken !== headerToken || cookieToken.length > 128) {
    throw new ApiError(403, 'csrf_rejected', 'Phiên bảo mật đã hết hạn. Vui lòng tải lại trang.');
  }
  const actual = digest(cookieToken);
  if (!timingSafeEqual(actual, request.auth.csrfDigest)) {
    throw new ApiError(403, 'csrf_rejected', 'Phiên bảo mật đã hết hạn. Vui lòng tải lại trang.');
  }
}

async function deliverEmail(env, email, subject, text, developmentUrl) {
  if (!env.EMAIL_DELIVERY_URL) {
    if (env.NODE_ENV === 'production') throw new ApiError(503, 'email_unavailable', 'Dịch vụ gửi thư chưa được cấu hình.');
    return { delivered: false, developmentUrl };
  }
  const deliveryUrl = new URL(env.EMAIL_DELIVERY_URL);
  if (env.NODE_ENV === 'production' && (deliveryUrl.protocol !== 'https:' || !env.EMAIL_DELIVERY_TOKEN)) {
    throw new ApiError(503, 'email_unavailable', 'Dịch vụ gửi thư chưa được cấu hình an toàn.');
  }
  let response;
  try {
    response = await fetch(deliveryUrl, {
      method: 'POST',
      redirect: 'error',
      headers: {
        'content-type': 'application/json',
        ...(env.EMAIL_DELIVERY_TOKEN ? { authorization: `Bearer ${env.EMAIL_DELIVERY_TOKEN}` } : {}),
      },
      body: JSON.stringify({
        to: email,
        subject,
        text,
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new ApiError(503, 'email_unavailable', 'Chưa thể gửi thư xác nhận. Vui lòng thử lại sau.');
  }
  if (!response.ok) throw new ApiError(503, 'email_unavailable', 'Chưa thể gửi thư xác nhận. Vui lòng thử lại sau.');
  return { delivered: true };
}

async function sendVerification(env, email, verificationUrl) {
  return deliverEmail(env, email, 'Xác nhận tài khoản Slink', `Mở liên kết này để xác nhận email của bạn: ${verificationUrl}`, verificationUrl);
}

async function sendPasswordReset(env, email, resetUrl) {
  return deliverEmail(env, email, 'Đặt lại mật khẩu Slink', `Mở liên kết này để đặt lại mật khẩu Slink của bạn: ${resetUrl}`, resetUrl);
}

async function recordVerificationToken(client, userId) {
  const token = newToken();
  await client.query('DELETE FROM email_verification_tokens WHERE user_id = $1 AND consumed_at IS NULL', [userId]);
  await client.query(
    `INSERT INTO email_verification_tokens (user_id, token_digest, expires_at)
     VALUES ($1, $2, now() + ($3::text || ' hours')::interval)`,
    [userId, digest(token), VERIFY_HOURS]
  );
  return token;
}

function registerAuthRoutes(app, { pool, env }) {
  app.post('/api/auth/register', {
    config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    assertSameOrigin(request, env);
    const body = request.body || {};
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const emailNormalized = email.toLowerCase();
    const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
    const storeName = typeof body.storeName === 'string' ? body.storeName.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || displayName.length < 2 || displayName.length > 120 || storeName.length < 2 || storeName.length > 160 || password.length < 12 || password.length > 128) {
      throw new ApiError(400, 'validation_error', 'Hãy kiểm tra email, tên, tên cửa hàng và mật khẩu (tối thiểu 12 ký tự).');
    }
    const { randomUUID } = require('node:crypto');
    const userId = randomUUID();
    const storeId = randomUUID();
    const passwordHash = await hashPassword(password);
    let verificationToken;
    try {
      verificationToken = await withUser(pool, userId, async (client) => {
        await client.query("SELECT set_config('app.store_id', $1, true)", [storeId]);
        await client.query(
          `INSERT INTO users (id, email, email_normalized, display_name, password_hash, status)
           VALUES ($1, $2, $3, $4, $5, 'pending')`,
          [userId, email, emailNormalized, displayName, passwordHash]
        );
        await client.query('INSERT INTO stores (id, name) VALUES ($1, $2)', [storeId, storeName]);
        await client.query(
          `INSERT INTO memberships (store_id, user_id, role, status, joined_at)
           VALUES ($1, $2, 'owner', 'active', now())`,
          [storeId, userId]
        );
        await client.query('INSERT INTO store_sequences (store_id) VALUES ($1)', [storeId]);
        return recordVerificationToken(client, userId);
      });
    } catch (error) {
      if (error.code === '23505') throw new ApiError(409, 'account_exists', 'Email này đã được sử dụng.');
      throw error;
    }
    const publicOrigin = env.PUBLIC_ORIGIN || 'http://127.0.0.1:3000';
    const verificationUrl = new URL('/verify', publicOrigin);
    verificationUrl.hash = new URLSearchParams({ token: verificationToken }).toString();
    const delivery = await sendVerification(env, email, verificationUrl.toString());
    reply.code(201);
    return {
      status: 'verification_required',
      message: 'Tài khoản đã được tạo. Hãy mở liên kết xác nhận trong email để tiếp tục.',
      ...(delivery.developmentUrl ? { developmentVerificationUrl: delivery.developmentUrl } : {}),
    };
  });

  app.post('/api/auth/verify-email', async (request) => {
    assertSameOrigin(request, env);
    const token = request.body?.token;
    if (typeof token !== 'string' || token.length > 128) throw new ApiError(400, 'invalid_token', 'Liên kết xác nhận không hợp lệ hoặc đã hết hạn.');
    const tokenDigest = digest(token);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const found = await client.query(
        `SELECT id, user_id FROM email_verification_tokens
         WHERE token_digest = $1 AND consumed_at IS NULL AND expires_at > now() FOR UPDATE`,
        [tokenDigest]
      );
      if (!found.rowCount) throw new ApiError(400, 'invalid_token', 'Liên kết xác nhận không hợp lệ hoặc đã hết hạn.');
      await client.query("SELECT set_config('app.user_id', $1, true)", [found.rows[0].user_id]);
      await client.query('UPDATE email_verification_tokens SET consumed_at = now() WHERE id = $1', [found.rows[0].id]);
      await client.query("UPDATE users SET email_verified_at = now(), status = 'active', updated_at = now() WHERE id = $1 AND status = 'pending'", [found.rows[0].user_id]);
      const claimed = await client.query(
        `SELECT id, store_id, role, invited_by FROM store_invitations
         WHERE claimed_user_id = $1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()
         ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, [found.rows[0].user_id]
      );
      let joinedStore = false;
      if (claimed.rowCount) {
        const invitation = claimed.rows[0];
        await client.query("SELECT set_config('app.store_id', $1, true)", [invitation.store_id]);
        const activeStore = await client.query("SELECT id FROM stores WHERE id = $1 AND status = 'active'", [invitation.store_id]);
        if (activeStore.rowCount) {
          await client.query(
            `INSERT INTO memberships (store_id, user_id, role, status, invited_by, joined_at)
             VALUES ($1, $2, $3, 'active', $4, now())`,
            [invitation.store_id, found.rows[0].user_id, invitation.role, invitation.invited_by]
          );
          await client.query('UPDATE store_invitations SET accepted_at = now(), updated_at = now() WHERE id = $1', [invitation.id]);
          await client.query(
            `INSERT INTO audit_events (store_id, actor_user_id, action, entity_type, entity_id, metadata)
             VALUES ($1, $2, 'staff.joined', 'store_invitation', $3, $4::jsonb)`,
            [invitation.store_id, found.rows[0].user_id, invitation.id, JSON.stringify({ role: invitation.role, acceptedDuring: 'email_verification' })]
          );
          joinedStore = true;
        }
      }
      await client.query('COMMIT');
      return { status: 'verified', message: joinedStore ? 'Email đã xác nhận. Bạn đã được thêm vào cửa hàng; hãy đăng nhập để tiếp tục.' : 'Email đã được xác nhận. Bạn có thể đăng nhập.' };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.post('/api/auth/resend-verification', {
    config: { rateLimit: { max: 3, timeWindow: '1 hour' } },
  }, async (request) => {
    assertSameOrigin(request, env);
    const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : '';
    if (!email || email.length > 254) throw new ApiError(400, 'validation_error', 'Email không hợp lệ.');
    const found = await pool.query(
      `SELECT id, email FROM users WHERE email_normalized = $1 AND status = 'pending' AND email_verified_at IS NULL`,
      [email]
    );
    let delivery;
    if (found.rowCount) {
      const token = await withUser(pool, found.rows[0].id, (client) => recordVerificationToken(client, found.rows[0].id));
      const verificationUrl = new URL('/verify', env.PUBLIC_ORIGIN || 'http://127.0.0.1:3000');
      verificationUrl.hash = new URLSearchParams({ token }).toString();
      try {
        delivery = await sendVerification(env, found.rows[0].email, verificationUrl.toString());
      } catch (error) {
        request.log.warn({ code: error.code || 'email_unavailable' }, 'Verification email delivery failed');
      }
    }
    return {
      status: 'verification_requested',
      message: 'Nếu tài khoản cần xác nhận tồn tại, Slink sẽ gửi liên kết mới.',
      ...(delivery?.developmentUrl ? { developmentVerificationUrl: delivery.developmentUrl } : {}),
    };
  });

  app.post('/api/auth/password-reset', {
    config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
  }, async (request) => {
    assertSameOrigin(request, env);
    const email = typeof request.body?.email === 'string' ? request.body.email.trim() : '';
    const emailNormalized = email.toLowerCase();
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, 'validation_error', 'Email không hợp lệ.');
    const found = await pool.query(
      `SELECT id, email FROM users WHERE email_normalized = $1 AND status = 'active' AND email_verified_at IS NOT NULL`,
      [emailNormalized]
    );
    let delivery;
    if (found.rowCount) {
      const userId = found.rows[0].id;
      const token = newToken();
      await withUser(pool, userId, async (client) => {
        await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
        await client.query('DELETE FROM password_reset_tokens WHERE user_id = $1 AND consumed_at IS NULL', [userId]);
        await client.query(
          `INSERT INTO password_reset_tokens (user_id, token_digest, expires_at)
           VALUES ($1, $2, now() + ($3::text || ' hours')::interval)`,
          [userId, digest(token), PASSWORD_RESET_HOURS]
        );
      });
      const resetUrl = new URL('/', env.PUBLIC_ORIGIN || 'http://127.0.0.1:3000');
      resetUrl.hash = new URLSearchParams({ reset: token }).toString();
      try {
        delivery = await sendPasswordReset(env, found.rows[0].email, resetUrl.toString());
      } catch (error) {
        request.log.warn({ code: error.code || 'email_unavailable' }, 'Password reset email delivery failed');
      }
    }
    return {
      status: 'password_reset_requested',
      message: 'Nếu tài khoản đã xác nhận email tồn tại, Slink sẽ gửi liên kết đặt lại mật khẩu.',
      ...(delivery?.developmentUrl ? { developmentResetUrl: delivery.developmentUrl } : {}),
    };
  });

  app.post('/api/auth/password-reset/complete', {
    config: { rateLimit: { max: 8, timeWindow: '1 hour' } },
  }, async (request) => {
    assertSameOrigin(request, env);
    const token = request.body?.token;
    const password = typeof request.body?.password === 'string' ? request.body.password : '';
    if (typeof token !== 'string' || token.length < 32 || token.length > 128) throw new ApiError(400, 'invalid_token', 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
    if (password.length < 12 || password.length > 128) throw new ApiError(400, 'validation_error', 'Mật khẩu mới cần từ 12 đến 128 ký tự.');
    const tokenDigest = digest(token);
    const validToken = await pool.query(
      `SELECT id FROM password_reset_tokens WHERE token_digest = $1 AND consumed_at IS NULL AND expires_at > now()`,
      [tokenDigest]
    );
    if (!validToken.rowCount) throw new ApiError(400, 'invalid_token', 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
    const passwordHash = await hashPassword(password);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const found = await client.query(
        `SELECT id, user_id FROM password_reset_tokens
         WHERE token_digest = $1 AND consumed_at IS NULL AND expires_at > now() FOR UPDATE`,
        [tokenDigest]
      );
      if (!found.rowCount) throw new ApiError(400, 'invalid_token', 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
      const userId = found.rows[0].user_id;
      await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
      await client.query('UPDATE password_reset_tokens SET consumed_at = now() WHERE id = $1', [found.rows[0].id]);
      const updated = await client.query(
        `UPDATE users SET password_hash = $2, password_changed_at = now(), updated_at = now()
         WHERE id = $1 AND status = 'active' AND email_verified_at IS NOT NULL RETURNING id`,
        [userId, passwordHash]
      );
      if (!updated.rowCount) throw new ApiError(400, 'invalid_token', 'Tài khoản không còn hoạt động. Hãy liên hệ quản lý.');
      await client.query('UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [userId]);
      await client.query('COMMIT');
      return { status: 'password_changed', message: 'Mật khẩu đã được cập nhật. Đăng nhập lại bằng mật khẩu mới.' };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.post('/api/auth/login', {
    config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
  }, async (request, reply) => {
    assertSameOrigin(request, env);
    const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : '';
    const password = typeof request.body?.password === 'string' ? request.body.password : '';
    if (!email || email.length > 254 || !password || password.length > 128) throw new ApiError(401, 'invalid_credentials', 'Email hoặc mật khẩu không đúng.');
    const found = await pool.query(
      `SELECT id, email, display_name, password_hash FROM users
       WHERE email_normalized = $1 AND status = 'active' AND email_verified_at IS NOT NULL`,
      [email]
    );
    const encoded = found.rowCount ? found.rows[0].password_hash : DUMMY_PASSWORD_HASH;
    const passwordMatches = await verifyPassword(password, encoded);
    if (!found.rowCount || !passwordMatches) {
      throw new ApiError(401, 'invalid_credentials', 'Email hoặc mật khẩu không đúng.');
    }
    const user = found.rows[0];
    const sessionToken = newToken();
    const csrfToken = newToken();
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    await withUser(pool, user.id, (client) => client.query(
      'INSERT INTO sessions (user_id, token_digest, csrf_digest, expires_at) VALUES ($1, $2, $3, $4)',
      [user.id, digest(sessionToken), digest(csrfToken), expiresAt]
    ));
    const stores = await listStores(pool, user.id);
    setSessionCookies(reply, env, sessionToken, csrfToken);
    return { user: { id: user.id, email: user.email, displayName: user.display_name }, stores };
  });

  app.get('/api/auth/me', async (request) => {
    const auth = await authenticate(pool, request);
    const stores = await listStores(pool, auth.userId);
    return { user: { id: auth.userId, email: auth.email, displayName: auth.displayName }, stores };
  });

  app.post('/api/auth/logout', async (request, reply) => {
    const auth = await authenticate(pool, request);
    requireCsrf(request, env);
    await withUser(pool, auth.userId, (client) => client.query(
      'UPDATE sessions SET revoked_at = now() WHERE token_digest = $1 AND user_id = $2 AND revoked_at IS NULL',
      [auth.tokenDigest, auth.userId]
    ));
    clearSessionCookies(reply, env);
    return { status: 'signed_out' };
  });

  app.get('/api/stores', async (request) => {
    const auth = await authenticate(pool, request);
    return { stores: await listStores(pool, auth.userId) };
  });
}

module.exports = {
  ApiError,
  authenticate,
  assertSameOrigin,
  digest,
  deliverEmail,
  hashPassword,
  newToken,
  registerAuthRoutes,
  requireCsrf,
  setSessionCookies,
  sendVerification,
  verifyPassword,
};
