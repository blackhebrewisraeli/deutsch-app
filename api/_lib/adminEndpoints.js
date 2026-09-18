import { createAccountHandler } from './accountHandler.js';
import { sendError } from './respond.js';
import { classifyAuthUser } from './roles.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const FEEDBACK_STATUSES = Object.freeze(['open', 'handled']);
const FEEDBACK_LIMIT = 100;

const ACCOUNT_RATES = {
  ipRate: { windowMs: 60 * 60 * 1000, max: 60 },
  userRate: { windowMs: 60 * 60 * 1000, max: 30 },
};

function readJson(body) {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  }
  return body && typeof body === 'object' ? body : null;
}

function readId(req) {
  const fromQuery = req.query?.id;
  if (typeof fromQuery === 'string' && UUID.test(fromQuery)) return fromQuery;
  const body = readJson(req.body);
  const fromBody = body?.id;
  if (typeof fromBody === 'string' && UUID.test(fromBody)) return fromBody;
  return null;
}

async function listAllUsers(db) {
  const users = [];
  const perPage = 200;
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const batch = data?.users ?? [];
    users.push(...batch);
    if (batch.length < perPage) break;
  }
  return users;
}

function providersOf(user) {
  const identities = Array.isArray(user?.identities) ? user.identities : [];
  const set = new Set();
  for (const identity of identities) {
    if (typeof identity?.provider === 'string' && identity.provider) {
      set.add(identity.provider);
    }
  }
  return [...set];
}

export const meHandler = createAccountHandler({
  method: 'GET',
  ...ACCOUNT_RATES,
  name: 'admin.me',
  failureMessage: 'Failed to load account flags.',
  allowBlocked: true,
  run: async ({ res, auth, db }) => {
    const { data, error } = await db
      .from('profiles')
      .select('blocked_at')
      .eq('user_id', auth.userId)
      .maybeSingle();
    if (error) throw error;
    return res.status(200).json({
      isAdmin: Boolean(auth.isAdmin),
      isSystemAccount: Boolean(auth.isSystemAccount),
      blocked: Boolean(data?.blocked_at),
    });
  },
});

export const feedbackGetHandler = createAccountHandler({
  method: 'GET',
  ...ACCOUNT_RATES,
  name: 'admin.feedback.list',
  failureMessage: 'Failed to load feedback.',
  requireAdmin: true,
  run: async ({ req, res, db }) => {
    const status = req.query?.status;
    if (status != null && status !== '' && !FEEDBACK_STATUSES.includes(status)) {
      return sendError(res, 'bad_request', 'status must be open or handled.');
    }

    let query = db
      .from('feedback')
      .select(
        'id, user_id, surface, cefr_level, deck_id, item_id, item_label, category, message, created_at, status, handled_at, handled_by'
      )
      .order('created_at', { ascending: false })
      .limit(FEEDBACK_LIMIT);
    if (FEEDBACK_STATUSES.includes(status)) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;
    return res.status(200).json({ items: data ?? [] });
  },
});

export const feedbackPatchHandler = createAccountHandler({
  method: 'PATCH',
  ...ACCOUNT_RATES,
  name: 'admin.feedback.patch',
  failureMessage: 'Failed to update feedback.',
  requireAdmin: true,
  run: async ({ req, res, auth, db }) => {
    const body = readJson(req.body) ?? {};
    const id = readId(req);
    if (!id) return sendError(res, 'bad_request', 'A feedback id is required.');
    if (!FEEDBACK_STATUSES.includes(body.status)) {
      return sendError(res, 'bad_request', 'status must be open or handled.');
    }

    const patch =
      body.status === 'handled'
        ? {
            status: 'handled',
            handled_at: new Date().toISOString(),
            handled_by: auth.userId,
          }
        : { status: 'open', handled_at: null, handled_by: null };

    const { data, error } = await db
      .from('feedback')
      .update(patch)
      .eq('id', id)
      .select(
        'id, user_id, surface, cefr_level, deck_id, item_id, item_label, category, message, created_at, status, handled_at, handled_by'
      )
      .maybeSingle();
    if (error) throw error;
    if (!data) return sendError(res, 'bad_request', 'Feedback not found.');
    return res.status(200).json(data);
  },
});

export const feedbackDeleteHandler = createAccountHandler({
  method: 'DELETE',
  ...ACCOUNT_RATES,
  name: 'admin.feedback.delete',
  failureMessage: 'Failed to delete feedback.',
  requireAdmin: true,
  run: async ({ req, res, db }) => {
    const id = readId(req);
    if (!id) return sendError(res, 'bad_request', 'A feedback id is required.');

    const { data, error } = await db
      .from('feedback')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) return sendError(res, 'bad_request', 'Feedback not found.');
    return res.status(204).end();
  },
});

export const usersHandler = createAccountHandler({
  method: 'GET',
  ...ACCOUNT_RATES,
  name: 'admin.users',
  failureMessage: 'Failed to load users.',
  requireAdmin: true,
  run: async ({ res, db }) => {
    const [authUsers, profilesResult] = await Promise.all([
      listAllUsers(db),
      db.from('profiles').select('user_id, handle, blocked_at, created_at'),
    ]);
    if (profilesResult.error) throw profilesResult.error;
    const profiles = Object.fromEntries(
      (profilesResult.data ?? []).map((row) => [row.user_id, row])
    );

    const items = authUsers.map((user) => {
      const flags = classifyAuthUser(user);
      const profile = profiles[user.id] ?? {};
      return {
        userId: user.id,
        email: user.email ?? null,
        handle: profile.handle ?? null,
        createdAt: profile.created_at ?? user.created_at ?? null,
        blockedAt: profile.blocked_at ?? null,
        isAdmin: flags.isAdmin,
        isSystemAccount: flags.isSystemAccount,
        providers: providersOf(user),
      };
    });

    return res.status(200).json({ items });
  },
});

export const blockHandler = createAccountHandler({
  method: 'POST',
  ...ACCOUNT_RATES,
  name: 'admin.block',
  failureMessage: 'Failed to update block state.',
  requireAdmin: true,
  run: async ({ req, res, db }) => {
    const body = readJson(req.body) ?? {};
    const userId = body.userId;
    if (typeof userId !== 'string' || !UUID.test(userId)) {
      return sendError(res, 'bad_request', 'A user id is required.');
    }
    const blocked = body.blocked !== false;

    const { data: fetched, error: fetchError } = await db.auth.admin.getUserById(userId);
    if (fetchError || !fetched?.user) {
      return sendError(res, 'bad_request', 'User not found.');
    }
    if (classifyAuthUser(fetched.user).isAdmin) {
      return sendError(res, 'bad_request', 'Admin accounts cannot be blocked.');
    }

    const blockedAt = blocked ? new Date().toISOString() : null;
    const { data, error } = await db
      .from('profiles')
      .update({ blocked_at: blockedAt })
      .eq('user_id', userId)
      .select('user_id, blocked_at')
      .maybeSingle();
    if (error) throw error;
    if (!data) return sendError(res, 'bad_request', 'Profile not found.');
    return res.status(200).json({ userId: data.user_id, blockedAt: data.blocked_at });
  },
});
