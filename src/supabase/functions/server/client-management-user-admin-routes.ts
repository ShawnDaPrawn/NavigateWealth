import { Hono } from 'npm:hono';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import * as kv from './kv_store.tsx';
import { asyncHandler } from './error.middleware.ts';
import {
  shouldIncludeInClientManagement,
  shouldLoadClientManagementProfile,
} from './client-management-visibility.ts';
import { listAllAuthUsers } from './auth-admin-list-users.ts';
import { createServiceClient } from './client-management-utils.ts';
import { requireAdmin, requireSuperAdmin } from './auth-mw.ts';

const app = new Hono();
const log = createModuleLogger('client-management-user-admin');

type AuthUserBrief = {
  id: string;
  email?: string;
  created_at?: string;
  user_metadata?: Record<string, unknown>;
};

type ClientRecordKv = {
  profile: Record<string, unknown> | null;
  security: Record<string, unknown> | null;
};

/** Personnel ids. Client Management never lists a member of staff as a client. */
async function loadPersonnelIds(): Promise<Set<string>> {
  const personnelProfiles = await kv.getByPrefix('personnel:profile:');
  return new Set<string>(
    personnelProfiles.map((p: Record<string, unknown>) => p.id as string).filter(Boolean),
  );
}

/** The two KV rows a Client Management entry is built from. */
async function readClientRecordKv(userId: string): Promise<ClientRecordKv> {
  const [profile, security] = await Promise.all([
    kv.get(`user_profile:${userId}:personal_info`),
    kv.get(`security:${userId}`),
  ]);
  return { profile: profile || null, security: security || null };
}

/**
 * One user's Client Management entry. GET /all-users returns a list of these
 * and GET /client-record/:userId returns one, so the client list and an open
 * client profile can never disagree about the shape.
 */
function toClientDirectoryEntry(user: AuthUserBrief, { profile, security }: ClientRecordKv) {
  return {
    id: user.id,
    email: user.email,
    created_at: user.created_at,
    user_metadata: user.user_metadata,
    profile,
    name:
      user.user_metadata?.name ||
      (profile?.firstName && profile?.lastName ? `${profile.firstName} ${profile.lastName}` : ''),
    application_number: profile?.applicationNumber || null,
    application_status: profile?.applicationStatus || 'not_started',
    account_type: profile?.accountType || null,
    deleted: security?.deleted || false,
    suspended: security?.suspended || false,
    account_status: profile?.accountStatus || null,
  };
}

// SECURITY: these routes expose/administer the full user directory (every
// user's id, email, phone, status). They are admin-only. NOTE: requireAdmin is
// applied PER-ROUTE below — not via app.use('*'), because this router is mounted
// with `.route('/', userAdmin)` alongside sibling profile routers, and a
// wildcard middleware would leak onto those siblings (Hono merges them at '/').

/**
 * GET /all-users
 * Get all users with their profiles (for admin use)
 * Includes deleted, suspended, and accountStatus fields for admin filtering.
 */
app.get('/all-users', requireAdmin, async (c) => {
  try {
    log.info('Fetching all users');

    const supabase = createServiceClient();

    // Pagination query params (optional — omit for full list)
    const pageParam = c.req.query('page');
    const perPageParam = c.req.query('perPage');
    const page = pageParam ? Math.max(1, parseInt(pageParam, 10) || 1) : null;
    const perPage = perPageParam
      ? Math.min(100, Math.max(1, parseInt(perPageParam, 10) || 50))
      : null;

    let users: Awaited<ReturnType<typeof listAllAuthUsers>>;
    try {
      users = await listAllAuthUsers(supabase);
    } catch (authErr) {
      log.error('Error fetching users from Supabase Auth', authErr);
      return c.json({ error: 'Failed to fetch users' }, 500);
    }

    if (!users || users.length === 0) {
      log.info('No users found');
      return c.json({ success: true, users: [] });
    }

    // ── Personnel exclusion ────────────────────────────────────────────
    const personnelIds = await loadPersonnelIds();

    // Get profiles AND security entries for all users from KV store
    const usersWithProfiles = await Promise.all(
      (users as AuthUserBrief[])
        .filter((user) => shouldLoadClientManagementProfile(user, personnelIds))
        .map(async (user) => ({
          response: toClientDirectoryEntry(user, await readClientRecordKv(user.id)),
          user,
        })),
    );

    const visibleUsers = usersWithProfiles
      .filter(({ response, user }) =>
        shouldIncludeInClientManagement({
          user,
          personnelIds,
          profile: response.profile,
          applicationStatus: response.application_status,
        }),
      )
      .map(({ response }) => response);

    log.success('Clients retrieved (personnel excluded)', {
      totalAuthUsers: users.length,
      personnelExcluded: users.length - usersWithProfiles.length,
      clientsReturned: visibleUsers.length,
    });

    // Apply server-side pagination if params provided
    if (page !== null && perPage !== null) {
      const total = visibleUsers.length;
      const totalPages = Math.ceil(total / perPage);
      const offset = (page - 1) * perPage;
      const paginatedUsers = visibleUsers.slice(offset, offset + perPage);

      return c.json({
        success: true,
        users: paginatedUsers,
        total,
        page,
        perPage,
        totalPages,
      });
    }

    // Unpaginated (backward compat)
    return c.json({
      success: true,
      users: visibleUsers,
    });
  } catch (error) {
    log.error('Error fetching all users', error);
    return c.json(
      {
        error: 'Failed to fetch users',
        details: getErrMsg(error),
      },
      500,
    );
  }
});

/**
 * GET /client-record/:userId
 * One client's current Client Management entry: the same shape and the same
 * visibility rules as one element of GET /all-users.
 *
 * An open client profile reads this rather than the client-list row it was
 * opened from, which can be minutes old, so the profile never shows an old
 * name, status or email (2026-10-12). One user costs a fraction of the list
 * (three reads instead of two per user plus the full auth directory).
 *
 * 404 when there is no such user, or Client Management would not list them
 * (personnel, declined or rejected).
 */
const AUTH_USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

app.get('/client-record/:userId', requireAdmin, async (c) => {
  const userId = c.req.param('userId') ?? '';
  // Every client is an auth user, whose id is a UUID. Anything else is not a
  // client (and the auth client throws on it rather than answering 404).
  if (!AUTH_USER_ID.test(userId)) {
    return c.json({ error: 'Client not found' }, 404);
  }
  try {
    const supabase = createServiceClient();
    const [authResult, personnelIds, recordKv] = await Promise.all([
      supabase.auth.admin.getUserById(userId),
      loadPersonnelIds(),
      readClientRecordKv(userId),
    ]);

    const { data, error } = authResult;
    if (error || !data?.user) {
      const status = (error as { status?: number } | null)?.status;
      if (!error || status === 404 || status === 400 || status === 422) {
        return c.json({ error: 'Client not found' }, 404);
      }
      log.error('Error fetching user from Supabase Auth', error);
      return c.json({ error: 'Failed to fetch client' }, 500);
    }

    const user = data.user as AuthUserBrief;
    if (!shouldLoadClientManagementProfile(user, personnelIds)) {
      return c.json({ error: 'Client not found' }, 404);
    }

    const entry = toClientDirectoryEntry(user, recordKv);
    if (
      !shouldIncludeInClientManagement({
        user,
        personnelIds,
        profile: entry.profile,
        applicationStatus: entry.application_status,
      })
    ) {
      return c.json({ error: 'Client not found' }, 404);
    }

    return c.json({ success: true, user: entry });
  } catch (error) {
    log.error('Error fetching client record', error);
    return c.json({ error: 'Failed to fetch client', details: getErrMsg(error) }, 500);
  }
});

/**
 * PUT /users/:userId/metadata
 * Update a client's Supabase Auth user_metadata.
 *
 * §4.2 — Route handler is a thin dispatcher; delegates to Supabase Admin API.
 * §12.2 — Only accessible by authenticated admins.
 *
 * Body: { metadata: Record<string, unknown> }
 * Merges the provided fields into the user's existing user_metadata.
 */
app.put(
  '/users/:userId/metadata',
  requireAdmin,
  async (c, next) => {
    const body = await c.req.json().catch(() => ({}));
    const requestedRole = body?.metadata?.role;
    if (requestedRole === 'super_admin' || requestedRole === 'super-admin') {
      return requireSuperAdmin(c, next);
    }
    await next();
  },
  asyncHandler(async (c) => {
    const { userId } = c.req.param();
    if (!userId) {
      return c.json({ error: 'Missing userId parameter' }, 400);
    }

    const body = await c.req.json();
    const metadata = body?.metadata;
    if (!metadata || typeof metadata !== 'object') {
      return c.json({ error: 'Request body must include a `metadata` object' }, 400);
    }

    log.info('Updating user metadata', { userId, fields: Object.keys(metadata) });

    const supabase = createServiceClient();

    const { data, error } = await supabase.auth.admin.updateUserById(userId, {
      user_metadata: metadata,
      // If the admin is changing the role, mirror it into app_metadata — the
      // auth middleware only trusts app_metadata for privileged roles
      // (user_metadata is client-editable). See resolveTrustedRole.
      ...(typeof metadata.role === 'string' ? { app_metadata: { role: metadata.role } } : {}),
    });

    if (error) {
      log.error('Failed to update user metadata', error, { userId });
      return c.json(
        {
          error: 'Failed to update user metadata',
          details: getErrMsg(error),
        },
        500,
      );
    }

    log.success('User metadata updated', { userId });

    return c.json({
      success: true,
      user: { id: data.user.id, user_metadata: data.user.user_metadata },
    });
  }),
);

export default app;
