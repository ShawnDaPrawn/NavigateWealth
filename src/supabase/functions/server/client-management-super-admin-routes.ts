import { Hono } from 'npm:hono';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import * as kv from './kv_store.tsx';
import { SUPER_ADMIN_EMAIL } from './constants.ts';
import { asyncHandler } from './error.middleware.ts';
import { UpdateSuperAdminProfileSchema } from './client-management-validation.ts';
import { requireSuperAdmin } from './auth-mw.ts';
import { generateApplicationNumber } from './application-number-utils.ts';
import { clientApplicationsService } from './client-applications-service.ts';
import { createServiceClient, deepSanitize } from './client-management-utils.ts';

const app = new Hono();
const log = createModuleLogger('client-management-super-admin');

/**
 * GET /super-admin
 * Get the super admin profile
 */
app.get('/super-admin', requireSuperAdmin, async (c) => {
  try {
    log.info('Fetching super admin profile');

    const supabase = createServiceClient();

    // Get all users and find super admin by email
    const {
      data: { users },
      error,
    } = await supabase.auth.admin.listUsers();

    if (error) {
      log.error('Error fetching users from Supabase Auth', error);
      return c.json({ error: 'Failed to fetch users' }, 500);
    }

    const superAdminUser = users?.find(
      (u) => u.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase(),
    );

    if (!superAdminUser) {
      log.warn('Super admin user not found', { email: SUPER_ADMIN_EMAIL });
      return c.json({ error: 'Super admin not found' }, 404);
    }

    // Get profile from KV store
    const profileKey = `user_profile:${superAdminUser.id}:personal_info`;
    let profile = await kv.get(profileKey);

    // If profile doesn't exist, create default super admin profile
    if (!profile) {
      log.info('Creating default super admin profile', { userId: superAdminUser.id });

      const nameParts = (superAdminUser.user_metadata?.name || '').split(/\s+/);
      profile = {
        userId: superAdminUser.id,
        email: superAdminUser.email,
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || '',
        phone: '',
        role: 'super_admin',
        applicationStatus: 'not_started',
        accountStatus: 'approved',
        adviserAssigned: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await kv.set(profileKey, profile);
    } else {
      // Ensure role is super_admin
      if (profile.role !== 'super_admin') {
        profile.role = 'super_admin';
        profile.accountStatus = 'approved';
        profile.adviserAssigned = true;
        await kv.set(profileKey, profile);
      }

      // Add userId and email if missing
      profile.userId = superAdminUser.id;
      profile.email = superAdminUser.email;
    }

    log.success('Super admin profile retrieved', { userId: superAdminUser.id });

    return c.json({
      success: true,
      profile,
    });
  } catch (error) {
    log.error('Error fetching super admin profile', error);
    return c.json(
      {
        error: 'Failed to fetch super admin profile',
        details: getErrMsg(error),
      },
      500,
    );
  }
});

/**
 * PUT /super-admin
 * Update the super admin profile
 */
app.put(
  '/super-admin',
  requireSuperAdmin,
  asyncHandler(async (c) => {
    const body = await c.req.json();

    // Validate input
    const updates = UpdateSuperAdminProfileSchema.parse(body);

    log.info('Updating super admin profile');

    const supabase = createServiceClient();

    // Get all users and find super admin by email
    const {
      data: { users },
      error,
    } = await supabase.auth.admin.listUsers();

    if (error) {
      log.error('Error fetching users from Supabase Auth', error);
      return c.json({ error: 'Failed to fetch users' }, 500);
    }

    const superAdminUser = users?.find(
      (u) => u.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase(),
    );

    if (!superAdminUser) {
      log.warn('Super admin user not found', { email: SUPER_ADMIN_EMAIL });
      return c.json({ error: 'Super admin not found' }, 404);
    }

    // Update profile in KV store
    const profileKey = `user_profile:${superAdminUser.id}:personal_info`;
    const existingProfile = (await kv.get(profileKey)) || {};

    let updatedProfile = {
      ...existingProfile,
      ...updates,
      userId: superAdminUser.id,
      email: superAdminUser.email,
      role: 'super_admin', // Always enforce super admin role
      updatedAt: new Date().toISOString(),
    };

    // Sanitize potentially large fields
    try {
      const sanitized = deepSanitize(updatedProfile);
      if (sanitized) updatedProfile = sanitized;
    } catch (e) {
      log.error('Sanitization failed for super admin update', e);
    }

    await kv.set(profileKey, updatedProfile);

    log.success('Super admin profile updated', { userId: superAdminUser.id });

    return c.json({
      success: true,
      profile: updatedProfile,
    });
  }),
);

/**
 * POST /super-admin/enable-personal-client
 * Bootstrap super admin as a test personal client (same auth UID, client KV domain).
 * Idempotent — safe to run multiple times.
 */
app.post(
  '/super-admin/enable-personal-client',
  requireSuperAdmin,
  asyncHandler(async (c) => {
    const authUser = c.get('user') as { id: string; email?: string } | undefined;
    const callerEmail = authUser?.email?.toLowerCase();

    if (callerEmail !== SUPER_ADMIN_EMAIL.toLowerCase()) {
      return c.json(
        { error: 'Forbidden: only the super admin account can enable personal client testing' },
        403,
      );
    }

    const supabase = createServiceClient();
    const {
      data: { users },
      error,
    } = await supabase.auth.admin.listUsers();

    if (error) {
      log.error('Error fetching users from Supabase Auth', error);
      return c.json({ error: 'Failed to fetch users' }, 500);
    }

    const superAdminUser = users?.find(
      (u) => u.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase(),
    );

    if (!superAdminUser) {
      log.warn('Super admin user not found', { email: SUPER_ADMIN_EMAIL });
      return c.json({ error: 'Super admin not found' }, 404);
    }

    const userId = superAdminUser.id;
    const profileKey = `user_profile:${userId}:personal_info`;
    const existingProfile = (await kv.get(profileKey)) as Record<string, unknown> | null;
    const now = new Date().toISOString();

    const metadataName = String(superAdminUser.user_metadata?.name || '').trim();
    const nameParts = metadataName.split(/\s+/).filter(Boolean);
    const defaultFirstName = nameParts[0] || 'Shawn';
    const defaultLastName = nameParts.slice(1).join(' ') || 'Francisco';
    const personalInfo = (existingProfile?.personalInformation || {}) as Record<string, unknown>;

    let existingApp = await clientApplicationsService.getByUserId(userId);
    let applicationId: string;
    let applicationNumber: string;

    if (existingApp?.id) {
      applicationId = String(existingApp.id);
      applicationNumber = String(
        existingApp.application_number || existingProfile?.applicationNumber || '',
      );
      existingApp = {
        ...existingApp,
        user_id: userId,
        status: 'approved',
        origin: existingApp.origin || 'super_admin_test',
        updated_at: now,
        reviewed_at: now,
        reviewed_by: userId,
        review_notes: 'Super admin personal client testing profile',
      };
      await kv.set(`application:${applicationId}`, existingApp);
    } else {
      applicationId = crypto.randomUUID();
      applicationNumber = await generateApplicationNumber();
      await kv.set(`application:${applicationId}`, {
        id: applicationId,
        application_number: applicationNumber,
        user_id: userId,
        status: 'approved',
        origin: 'super_admin_test',
        created_at: now,
        updated_at: now,
        submitted_at: now,
        reviewed_at: now,
        reviewed_by: userId,
        review_notes: 'Super admin personal client testing profile',
        application_data: {
          firstName: String(personalInfo.firstName || defaultFirstName),
          lastName: String(personalInfo.lastName || defaultLastName),
          emailAddress: superAdminUser.email,
          cellphoneNumber: String(personalInfo.cellphone || ''),
          nationality: 'South Africa',
          residentialCountry: 'South Africa',
          accountReasons: [],
          existingProducts: [],
          termsAccepted: true,
          popiaConsent: true,
          disclosureAcknowledged: true,
          accountType: 'Personal Client',
        },
      });
    }

    const updatedProfile = {
      ...(existingProfile || {}),
      profileType: 'personal',
      userId,
      email: superAdminUser.email,
      role: 'super_admin',
      accountStatus: 'approved',
      accountType: 'Personal Client',
      applicationStatus: 'approved',
      applicationId,
      applicationNumber,
      personalClientEnabled: true,
      adviserAssigned: true,
      personalInformation: {
        ...personalInfo,
        firstName: String(personalInfo.firstName || defaultFirstName),
        lastName: String(personalInfo.lastName || defaultLastName),
        email: superAdminUser.email,
        cellphone: String(personalInfo.cellphone || ''),
        nationality: String(personalInfo.nationality || 'South Africa'),
        identityDocuments: Array.isArray(personalInfo.identityDocuments)
          ? personalInfo.identityDocuments
          : [],
      },
      createdAt: existingProfile?.createdAt || now,
      updatedAt: now,
    };

    await kv.set(profileKey, updatedProfile);

    log.success('Super admin personal client profile enabled', { userId, applicationId });

    return c.json({
      success: true,
      enabled: true,
      userId,
      applicationId,
      applicationNumber,
      profile: updatedProfile,
    });
  }),
);

export default app;
