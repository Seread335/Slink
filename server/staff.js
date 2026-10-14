'use strict';

const { ApiError, authenticate, assertSameOrigin, deliverEmail, digest, hashPassword, newToken, requireCsrf, sendVerification } = require('./auth');
const { UUID_PATTERN, withStore, withUser } = require('./db');

const STAFF_ROLES = new Set(['manager', 'cashier', 'stockkeeper', 'accountant']);
const STAFF_STATUSES = new Set(['active', 'suspended']);
const INVITE_HOURS = 168;

function assertOwner(membership) {
  if (membership.role !== 'owner') throw new ApiError(403, 'forbidden', 'Chỉ chủ cửa hàng mới được quản lý nhân viên.');
}

function validToken(token) {
  return typeof token === 'string' && token.length >= 32 && token.length <= 128;
}

function pending(invitation) {
  return !invitation.accepted_at && !invitation.revoked_at && new Date(invitation.expires_at).getTime() > Date.now();
}

async function withInvitation(pool, rawToken, operation) {
  if (!validToken(rawToken)) throw new ApiError(404, 'invitation_unavailable', 'Lời mời không hợp lệ hoặc đã hết hạn.');
  const tokenDigest = digest(rawToken);
  return withUser(pool, '00000000-0000-4000-8000-000000000000', async (client) => {
    await client.query("SELECT set_config('app.invitation_digest', $1, true)", [tokenDigest.toString('hex')]);
    const found = await client.query(
      `SELECT id, store_id, email, email_normalized, role, claimed_user_id, expires_at, accepted_at, revoked_at
       FROM store_invitations WHERE token_digest = $1 FOR UPDATE`,
      [tokenDigest]
    );
    if (!found.rowCount) throw new ApiError(404, 'invitation_unavailable', 'Lời mời không hợp lệ hoặc đã hết hạn.');
    await client.query("SELECT set_config('app.store_id', $1, true)", [found.rows[0].store_id]);
    return operation(client, found.rows[0]);
  });
}

function inviteUrl(env, token) {
  const url = new URL('/invite', env.PUBLIC_ORIGIN || 'http://127.0.0.1:3000');
  url.hash = new URLSearchParams({ invite: token }).toString();
  return url.toString();
}

async function sendInvitation(env, invitation, token) {
  const url = inviteUrl(env, token);
  const roleNames = { manager: 'Quản lý', cashier: 'Thu ngân', stockkeeper: 'Nhân viên kho', accountant: 'Kế toán' };
  const text = `Bạn được mời tham gia cửa hàng ${invitation.store_name} trên Slink với vai trò ${roleNames[invitation.role]}. Lời mời có hiệu lực trong 7 ngày. Mở liên kết để tạo tài khoản hoặc đăng nhập và chấp nhận: ${url}`;
  return deliverEmail(env, invitation.email, `Lời mời tham gia ${invitation.store_name} trên Slink`, text, url);
}

async function createInvite(pool, auth, storeId, email, role) {
  const token = newToken();
  const tokenDigest = digest(token);
  let result;
  try {
    result = await withStore(pool, auth.userId, storeId, async (client, membership) => {
    assertOwner(membership);
    const normalized = email.toLowerCase();
    const existingMember = await client.query(
      `SELECT m.status FROM memberships m JOIN users u ON u.id = m.user_id
       WHERE m.store_id = $1 AND u.email_normalized = $2`, [storeId, normalized]
    );
    if (existingMember.rowCount) throw new ApiError(409, 'already_member', 'Email này đã là thành viên của cửa hàng.');
    await client.query(
      `UPDATE store_invitations SET revoked_at = now(), updated_at = now()
       WHERE store_id = $1 AND email_normalized = $2 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at <= now()`,
      [storeId, normalized]
    );
    const inserted = await client.query(
      `INSERT INTO store_invitations (store_id, email, email_normalized, role, token_digest, invited_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, now() + ($7::text || ' hours')::interval)
       RETURNING id, email, role, expires_at`,
      [storeId, email, normalized, role, tokenDigest, auth.userId, INVITE_HOURS]
    );
    const invitation = inserted.rows[0];
    await client.query(
      `INSERT INTO audit_events (store_id, actor_user_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, 'staff.invited', 'store_invitation', $3, $4::jsonb)`,
      [storeId, auth.userId, invitation.id, JSON.stringify({ email: normalized, role })]
    );
    const store = await client.query('SELECT name FROM stores WHERE id = $1', [storeId]);
    return { ...invitation, store_name: store.rows[0].name };
    });
  } catch (error) {
    if (error.code === '23505') throw new ApiError(409, 'invitation_exists', 'Đang có lời mời cho email này. Hãy gửi lại lời mời hiện có.');
    throw error;
  }
  return { invitation: result, token };
}

async function sendOrRevoke(pool, auth, env, storeId, invitation, token) {
  try {
    const delivery = await sendInvitation(env, invitation, token);
    return { delivery, developmentInviteUrl: delivery.developmentUrl, invitation: { id: invitation.id, email: invitation.email, role: invitation.role, expires_at: invitation.expires_at } };
  } catch (error) {
    try {
      await withStore(pool, auth.userId, storeId, async (client, membership) => {
        assertOwner(membership);
        await client.query('UPDATE store_invitations SET revoked_at = now(), updated_at = now() WHERE id = $1 AND store_id = $2 AND accepted_at IS NULL AND revoked_at IS NULL', [invitation.id, storeId]);
        await client.query(
          `INSERT INTO audit_events (store_id, actor_user_id, action, entity_type, entity_id, reason)
           VALUES ($1, $2, 'staff.invitation_delivery_failed', 'store_invitation', $3, 'Không gửi được thư mời; lời mời đã bị thu hồi.')`,
          [storeId, auth.userId, invitation.id]
        );
      });
    } catch { /* Keep the original delivery error; the invitation token itself is never returned. */ }
    throw error;
  }
}

function registerStaffRoutes(app, { pool, env }) {
  app.get('/api/invitations/:token', async (request) => {
    const result = await withInvitation(pool, request.params.token, async (client, invitation) => {
      const store = await client.query('SELECT name FROM stores WHERE id = $1 AND status = \'active\'', [invitation.store_id]);
      if (!store.rowCount) throw new ApiError(404, 'invitation_unavailable', 'Lời mời không còn hiệu lực.');
      const status = invitation.accepted_at ? 'accepted' : invitation.revoked_at ? 'revoked' : new Date(invitation.expires_at).getTime() <= Date.now() ? 'expired' : 'pending';
      return { id: invitation.id, email: invitation.email, role: invitation.role, storeName: store.rows[0].name, expiresAt: invitation.expires_at, status };
    });
    return { invitation: result };
  });

  app.post('/api/invitations/:token/register', {
    config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    assertSameOrigin(request, env);
    const displayName = typeof request.body?.displayName === 'string' ? request.body.displayName.trim() : '';
    const password = typeof request.body?.password === 'string' ? request.body.password : '';
    if (displayName.length < 2 || displayName.length > 120 || password.length < 12 || password.length > 128) {
      throw new ApiError(400, 'validation_error', 'Tên cần từ 2 ký tự và mật khẩu từ 12 đến 128 ký tự.');
    }
    const passwordHash = await hashPassword(password);
    const { verificationToken, invitation } = await withInvitation(pool, request.params.token, async (client, current) => {
      if (!pending(current) || current.claimed_user_id) throw new ApiError(409, 'invitation_unavailable', 'Lời mời đã được sử dụng, thu hồi hoặc hết hạn.');
      const userId = require('node:crypto').randomUUID();
      try {
        await client.query(
          `INSERT INTO users (id, email, email_normalized, display_name, password_hash, status)
           VALUES ($1, $2, $3, $4, $5, 'pending')`,
          [userId, current.email, current.email_normalized, displayName, passwordHash]
        );
      } catch (error) {
        if (error.code === '23505') throw new ApiError(409, 'account_exists', 'Email này đã có tài khoản. Hãy đăng nhập để chấp nhận lời mời.');
        throw error;
      }
      await client.query('UPDATE store_invitations SET claimed_user_id = $2, updated_at = now() WHERE id = $1', [current.id, userId]);
      const token = newToken();
      await client.query('INSERT INTO email_verification_tokens (user_id, token_digest, expires_at) VALUES ($1, $2, now() + interval \'24 hours\')', [userId, digest(token)]);
      return { verificationToken: token, invitation: { email: current.email, role: current.role, store_id: current.store_id } };
    });
    const verificationUrl = new URL('/verify', env.PUBLIC_ORIGIN || 'http://127.0.0.1:3000');
    verificationUrl.hash = new URLSearchParams({ token: verificationToken }).toString();
    const delivery = await sendVerification(env, invitation.email, verificationUrl.toString());
    reply.code(201);
    return {
      status: 'verification_required',
      message: 'Tài khoản đã được tạo. Xác nhận email để kích hoạt quyền truy cập cửa hàng.',
      ...(delivery.developmentUrl ? { developmentVerificationUrl: delivery.developmentUrl } : {}),
    };
  });

  app.post('/api/invitations/:token/accept', async (request) => {
    const auth = await authenticate(pool, request);
    requireCsrf(request, env);
    const result = await withUser(pool, auth.userId, async (client) => {
      const token = request.params.token;
      if (!validToken(token)) throw new ApiError(404, 'invitation_unavailable', 'Lời mời không hợp lệ hoặc đã hết hạn.');
      const tokenDigest = digest(token);
      await client.query("SELECT set_config('app.invitation_digest', $1, true)", [tokenDigest.toString('hex')]);
      const found = await client.query('SELECT * FROM store_invitations WHERE token_digest = $1 FOR UPDATE', [tokenDigest]);
      if (!found.rowCount) throw new ApiError(404, 'invitation_unavailable', 'Lời mời không hợp lệ hoặc đã hết hạn.');
      const invitation = found.rows[0];
      if (!pending(invitation)) throw new ApiError(409, 'invitation_unavailable', 'Lời mời đã được sử dụng, thu hồi hoặc hết hạn.');
      if (invitation.email_normalized !== auth.email.toLowerCase()) throw new ApiError(403, 'invitation_email_mismatch', 'Hãy đăng nhập bằng đúng email được mời.');
      if (invitation.claimed_user_id && invitation.claimed_user_id !== auth.userId) throw new ApiError(409, 'invitation_claimed', 'Lời mời này đã được dùng để tạo tài khoản khác.');
      await client.query("SELECT set_config('app.store_id', $1, true)", [invitation.store_id]);
      const store = await client.query("SELECT id FROM stores WHERE id = $1 AND status = 'active'", [invitation.store_id]);
      if (!store.rowCount) throw new ApiError(409, 'store_unavailable', 'Cửa hàng này hiện không hoạt động.');
      const existing = await client.query('SELECT status FROM memberships WHERE store_id = $1 AND user_id = $2 FOR UPDATE', [invitation.store_id, auth.userId]);
      if (existing.rowCount) throw new ApiError(409, 'already_member', 'Tài khoản đã là thành viên của cửa hàng.');
      await client.query(
        `INSERT INTO memberships (store_id, user_id, role, status, invited_by, joined_at)
         VALUES ($1, $2, $3, 'active', $4, now())`,
        [invitation.store_id, auth.userId, invitation.role, invitation.invited_by]
      );
      await client.query('UPDATE store_invitations SET claimed_user_id = $2, accepted_at = now(), updated_at = now() WHERE id = $1', [invitation.id, auth.userId]);
      await client.query(
        `INSERT INTO audit_events (store_id, actor_user_id, action, entity_type, entity_id, metadata)
         VALUES ($1, $2, 'staff.joined', 'store_invitation', $3, $4::jsonb)`,
        [invitation.store_id, auth.userId, invitation.id, JSON.stringify({ role: invitation.role })]
      );
      return { storeId: invitation.store_id };
    });
    return { status: 'accepted', storeId: result.storeId };
  });

  app.get('/api/stores/:storeId/staff', async (request) => {
    const auth = await authenticate(pool, request);
    const storeId = request.params.storeId;
    if (!UUID_PATTERN.test(storeId)) throw new ApiError(400, 'validation_error', 'Cửa hàng không hợp lệ.');
    return withStore(pool, auth.userId, storeId, async (client, membership) => {
      assertOwner(membership);
      const members = await client.query(
        `SELECT m.user_id, u.display_name, u.email, m.role, m.status, m.joined_at
         FROM memberships m JOIN users u ON u.id = m.user_id
         WHERE m.store_id = $1 AND m.role <> 'owner' ORDER BY m.created_at, u.display_name LIMIT 200`, [storeId]
      );
      const invitations = await client.query(
        `SELECT id, email, role, expires_at, created_at, accepted_at, revoked_at,
           CASE WHEN accepted_at IS NOT NULL THEN 'accepted' WHEN revoked_at IS NOT NULL THEN 'revoked' WHEN expires_at <= now() THEN 'expired' ELSE 'pending' END AS status
         FROM store_invitations WHERE store_id = $1 ORDER BY created_at DESC LIMIT 100`, [storeId]
      );
      return { members: members.rows, invitations: invitations.rows };
    });
  });

  app.post('/api/stores/:storeId/staff/invitations', async (request, reply) => {
    const auth = await authenticate(pool, request);
    requireCsrf(request, env);
    const storeId = request.params.storeId;
    const email = typeof request.body?.email === 'string' ? request.body.email.trim() : '';
    const role = request.body?.role;
    if (!UUID_PATTERN.test(storeId) || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !STAFF_ROLES.has(role)) {
      throw new ApiError(400, 'validation_error', 'Hãy nhập email hợp lệ và chọn một vai trò nhân viên.');
    }
    const created = await createInvite(pool, auth, storeId, email, role);
    const delivery = await sendOrRevoke(pool, auth, env, storeId, created.invitation, created.token);
    reply.code(201);
    return { status: 'invited', message: delivery.delivery.delivered ? 'Đã gửi lời mời qua email.' : 'Đã tạo lời mời. Hãy chia sẻ liên kết trong môi trường phát triển.', ...delivery };
  });

  app.post('/api/stores/:storeId/staff/invitations/:invitationId/resend', async (request) => {
    const auth = await authenticate(pool, request);
    requireCsrf(request, env);
    const { storeId, invitationId } = request.params;
    if (!UUID_PATTERN.test(storeId) || !UUID_PATTERN.test(invitationId)) throw new ApiError(400, 'validation_error', 'Lời mời không hợp lệ.');
    const token = newToken();
    const result = await withStore(pool, auth.userId, storeId, async (client, membership) => {
      assertOwner(membership);
      const found = await client.query('SELECT id, email, role, accepted_at, revoked_at FROM store_invitations WHERE id = $1 AND store_id = $2 FOR UPDATE', [invitationId, storeId]);
      if (!found.rowCount) throw new ApiError(404, 'not_found', 'Không tìm thấy lời mời.');
      const row = found.rows[0];
      if (row.accepted_at || row.revoked_at) throw new ApiError(409, 'invitation_unavailable', 'Lời mời này không còn chờ xử lý.');
      const refreshed = await client.query('UPDATE store_invitations SET token_digest = $2, expires_at = now() + interval \'7 days\', updated_at = now() WHERE id = $1 RETURNING expires_at', [invitationId, digest(token)]);
      await client.query(
        `INSERT INTO audit_events (store_id, actor_user_id, action, entity_type, entity_id)
         VALUES ($1, $2, 'staff.invitation_resent', 'store_invitation', $3)`, [storeId, auth.userId, invitationId]
      );
      return { ...row, store_name: membership.store_name, expires_at: refreshed.rows[0].expires_at };
    });
    return sendOrRevoke(pool, auth, env, storeId, result, token);
  });

  app.post('/api/stores/:storeId/staff/invitations/:invitationId/revoke', async (request) => {
    const auth = await authenticate(pool, request);
    requireCsrf(request, env);
    const { storeId, invitationId } = request.params;
    if (!UUID_PATTERN.test(storeId) || !UUID_PATTERN.test(invitationId)) throw new ApiError(400, 'validation_error', 'Lời mời không hợp lệ.');
    return withStore(pool, auth.userId, storeId, async (client, membership) => {
      assertOwner(membership);
      const found = await client.query('SELECT id, accepted_at, revoked_at FROM store_invitations WHERE id = $1 AND store_id = $2 FOR UPDATE', [invitationId, storeId]);
      if (!found.rowCount) throw new ApiError(404, 'not_found', 'Không tìm thấy lời mời.');
      if (!found.rows[0].accepted_at && !found.rows[0].revoked_at) {
        await client.query('UPDATE store_invitations SET revoked_at = now(), updated_at = now() WHERE id = $1', [invitationId]);
        await client.query(
          `INSERT INTO audit_events (store_id, actor_user_id, action, entity_type, entity_id)
           VALUES ($1, $2, 'staff.invitation_revoked', 'store_invitation', $3)`, [storeId, auth.userId, invitationId]
        );
      }
      return { status: 'revoked' };
    });
  });

  app.patch('/api/stores/:storeId/staff/members/:userId', async (request) => {
    const auth = await authenticate(pool, request);
    requireCsrf(request, env);
    const { storeId, userId } = request.params;
    const role = request.body?.role;
    const status = request.body?.status;
    if (!UUID_PATTERN.test(storeId) || !UUID_PATTERN.test(userId) || !STAFF_ROLES.has(role) || !STAFF_STATUSES.has(status)) {
      throw new ApiError(400, 'validation_error', 'Vai trò hoặc trạng thái nhân viên không hợp lệ.');
    }
    if (userId === auth.userId) throw new ApiError(409, 'self_change_forbidden', 'Chủ cửa hàng không thể tự thay đổi quyền của mình tại đây.');
    return withStore(pool, auth.userId, storeId, async (client, membership) => {
      assertOwner(membership);
      const found = await client.query(
        `SELECT m.user_id, m.role, m.status, u.email FROM memberships m JOIN users u ON u.id = m.user_id
         WHERE m.store_id = $1 AND m.user_id = $2 FOR UPDATE OF m`, [storeId, userId]
      );
      if (!found.rowCount) throw new ApiError(404, 'not_found', 'Không tìm thấy nhân viên.');
      if (found.rows[0].role === 'owner') throw new ApiError(409, 'owner_protected', 'Quyền chủ cửa hàng không thể thay đổi bằng màn hình nhân viên.');
      await client.query('UPDATE memberships SET role = $3, status = $4 WHERE store_id = $1 AND user_id = $2', [storeId, userId, role, status]);
      await client.query(
        `INSERT INTO audit_events (store_id, actor_user_id, action, entity_type, entity_id, metadata)
         VALUES ($1, $2, 'staff.access_changed', 'membership', $3, $4::jsonb)`,
        [storeId, auth.userId, userId, JSON.stringify({ email: found.rows[0].email, previousRole: found.rows[0].role, previousStatus: found.rows[0].status, role, status })]
      );
      return { status: 'updated' };
    });
  });
}

module.exports = { registerStaffRoutes };
