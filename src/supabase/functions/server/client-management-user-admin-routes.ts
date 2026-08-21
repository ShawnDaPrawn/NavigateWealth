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
    const personnelProfiles = await kv.getByPrefix('personnel:profile:');
    const personnelIds = new Set<string>(
      personnelProfiles.map((p: Record<string, unknown>) => p.id as string).filter(Boolean),
    );

    type AuthUserBrief = {
      id: string;
      email?: string;
      created_at?: string;
      user_metadata?: Record<string, unknown>;
    };

    // Get profiles AND security entries for all users from KV store
    const usersWithProfiles = await Promise.all(
      (users as AuthUserBrief[])
        .filter((user) => shouldLoadClientManagementProfile(user, personnelIds))
        .map(async (user) => {
          const profileKey = `user_profile:${user.id}:personal_info`;
          const [profile, security] = await Promise.all([
            kv.get(profileKey),
            kv.get(`security:${user.id}`),
          ]);

          const response = {
            id: user.id,
            email: user.email,
            created_at: user.created_at,
            user_metadata: user.user_metadata,
            profile: profile || null,
            name:
              user.user_metadata?.name ||
              (profile?.firstName && profile?.lastName
                ? `${profile.firstName} ${profile.lastName}`
                : ''),
            application_number: profile?.applicationNumber || null,
            application_status: profile?.applicationStatus || 'not_started',
            account_type: profile?.accountType || null,
            deleted: security?.deleted || false,
            suspended: security?.suspended || false,
            account_status: profile?.accountStatus || null,
          };

          return { response, user };
        }),
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
