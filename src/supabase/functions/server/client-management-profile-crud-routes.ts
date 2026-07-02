import { Hono } from 'npm:hono';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import * as kv from './kv_store.tsx';
import { isSuperAdminEmail } from './constants.ts';
import { asyncHandler } from './error.middleware.ts';
import {
  PersonalInfoQuerySchema,
  PersonalInfoUpdateSchema,
  AlternativeProfileUpdateSchema,
  CreateDefaultProfileSchema,
} from './client-management-validation.ts';
import {
  syncProfileToApplication,
  extractUserIdFromProfileKey,
} from './profile-application-sync.ts';
import { syncClientProfileNamesToNewsletter } from './newsletter-service.ts';
import { deepSanitize } from './client-management-utils.ts';

const app = new Hono();
const log = createModuleLogger('client-management-profile-crud');

/**
 * GET /personal-info
 * Retrieve user profile from KV store
 */
app.get(
  '/personal-info',
  asyncHandler(async (c) => {
    const query = c.req.query();

    // Validate query parameters
    const { key, email } = PersonalInfoQuerySchema.parse(query);

    log.info('Fetching profile', { key, email });

    // Get profile from KV store
    const profile = await kv.get(key);

    // Check if super admin by email (durable allowlist + env override)
    const isSuperAdmin = isSuperAdminEmail(email);

    // If profile exists, ensure super admin has correct role
    if (profile) {
      if (isSuperAdmin && profile.role !== 'super_admin') {
        log.info('Upgrading super admin role', { email });
        profile.role = 'super_admin';
        profile.accountStatus = 'approved';
        profile.adviserAssigned = true;
        await kv.set(key, profile);
      }

      log.success('Profile retrieved', {
        role: profile.role,
        email,
        isSuperAdmin,
      });

      return c.json({
        success: true,
        data: profile,
      });
    }

    // Profile not found
    log.warn('Profile not found', { key });
    return c.json({ error: 'Profile not found' }, 404);
  }),
);

/**
 * POST /personal-info
 * Update user profile in KV store
 */
app.post(
  '/personal-info',
  asyncHandler(async (c) => {
    let body;
    try {
      log.info('=== POST /personal-info START ===');

      // Safety: Catch body parsing errors
      try {
        body = await c.req.json();
      } catch (parseError) {
        log.error('Failed to parse request body', parseError);
        return c.json(
          {
            error: 'Request Payload Too Large',
            message: 'The data being saved is too large for the server to process.',
            code: 'PAYLOAD_TOO_LARGE',
          },
          413,
        );
      }

      // Validate input
      let validated;
      try {
        validated = PersonalInfoUpdateSchema.parse(body);
      } catch (zodError: unknown) {
        const ze = zodError as { errors?: Array<{ message?: string }> };
        log.error('Validation Error', zodError);
        return c.json(
          {
            error: `VALIDATION_ERROR: ${ze.errors?.[0]?.message || 'Invalid Request Data'}`,
            details: ze.errors,
          },
          400,
        );
      }
      const { key, data } = validated;

      if (!key || !key.includes('user_profile')) {
        log.warn('Suspicious Key Format', { key });
      }

      const incomingData = data as Record<string, unknown>;

      // SECURITY: privileged fields are server-controlled — role comes from the
      // super-admin allowlist, accountStatus from the status endpoint. A client
      // must not be able to escalate by writing them through a profile update.
      // Strip them unless the caller is an admin. (incomingData is the same
      // object reference spread into finalProfile below, so this is effective
      // for both the full-replacement and partial-patch paths.)
      const callerRole = c.get('userRole');
      const callerIsAdmin =
        callerRole === 'admin' || callerRole === 'super_admin' || callerRole === 'super-admin';
      if (!callerIsAdmin) {
        for (const privileged of ['role', 'accountStatus', 'adviserAssigned', 'suspended']) {
          delete incomingData[privileged];
        }
      }

      const keys = Object.keys(incomingData);

      // Heuristic: Is this a full replacement?
      const hasCoreFields =
        keys.includes('firstName') && keys.includes('lastName') && keys.includes('email');
      const isBigPayload = keys.length > 5;
      const isFullProfileReplacement = hasCoreFields || isBigPayload;

      log.info('Analyzing update type', {
        isFullProfileReplacement,
        keyCount: keys.length,
      });

      let finalProfile = {};

      if (isFullProfileReplacement) {
        log.info('Full profile replacement detected. Deleting existing record first.', { key });

        // Delete the old record first (clean slate)
        try {
          await kv.del(key);
        } catch (delError) {
          log.error('Failed to delete existing record (non-fatal)', delError);
        }

        finalProfile = {
          ...(data as Record<string, unknown>),
          updatedAt: new Date().toISOString(),
        };
      } else {
        // Partial Patch Logic
        log.info('Partial patch detected. Merging...');
        try {
          const existing = (await kv.get(key)) || {};
          finalProfile = {
            ...existing,
            ...(data as Record<string, unknown>),
            updatedAt: new Date().toISOString(),
          };
        } catch (readError) {
          log.error('Failed to read profile for PATCH.', readError);
          throw new Error('Database error. Please refresh the page.', { cause: readError });
        }
      }

      // Sanitize
      try {
        const sanitized = deepSanitize(finalProfile);
        if (sanitized) {
          finalProfile = sanitized;
        }
      } catch (sanitizationError) {
        log.error('Deep sanitize failed on server', sanitizationError);
        throw new Error('Sanitization failed', { cause: sanitizationError });
      }

      // Save to KV store
      try {
        await kv.set(key, finalProfile);
      } catch (setError) {
        log.error('KV Write Failed', setError);
        throw new Error(
          `KV Write Failed: ${setError instanceof Error ? setError.message : String(setError)}`,
          { cause: setError },
        );
      }

      log.success('Profile updated successfully', { key });

      // ── Phase 1: Profile → Application sync ──────────────────────────────
      const userId = extractUserIdFromProfileKey(key);
      if (userId) {
        syncProfileToApplication(userId, finalProfile as Record<string, unknown>)
          .then((result) => {
            if (result.synced) {
              log.info('Profile → Application sync triggered', {
                userId,
                fieldsUpdated: result.fieldsUpdated,
              });
            }
          })
          .catch((syncErr) => {
            log.error('Profile → Application background sync error', syncErr);
          });
      }

      // ── Profile → Newsletter name sync (fire-and-forget) ─────────────────
      // Keep transactional-email recipient names current after a rename.
      syncClientProfileNamesToNewsletter(finalProfile as Record<string, unknown>).catch(
        (syncErr) => {
          log.error('Profile → Newsletter background sync error', syncErr);
        },
      );

      return c.json({
        success: true,
        data: finalProfile,
      });
    } catch (error) {
      log.error('Error in POST /personal-info', error);

      return c.json(
        {
          error: 'Server Error',
          message: `BACKEND_ERROR: ${getErrMsg(error)}`,
          code: 'INTERNAL_ERROR',
          details: error instanceof Error ? error.stack : undefined,
        },
        500,
      );
    }
  }),
);

/**
 * PUT /
 * Alternative update endpoint (for backward compatibility)
 */
app.put(
  '/',
  asyncHandler(async (c) => {
    const body = await c.req.json();

    // Validate input
    const validated = AlternativeProfileUpdateSchema.parse(body);
    const { userId, ...updates } = validated;

    const key = `user_profile:${userId}:personal_info`;

    log.info('Updating profile (PUT)', { key });

    // Get existing profile
    const existingProfile = (await kv.get(key)) || {};

    // Merge updates (handle legacy 'surname' field)
    let updatedProfile = {
      ...existingProfile,
      ...updates,
      lastName:
        updates.lastName ||
        (updates as Record<string, unknown>).surname ||
        existingProfile.lastName,
      updatedAt: new Date().toISOString(),
    };

    // Sanitize potentially large fields
    try {
      const sanitized = deepSanitize(updatedProfile);
      if (sanitized) updatedProfile = sanitized;
    } catch (e) {
      log.error('Sanitization failed for legacy update', e);
    }

    await kv.set(key, updatedProfile);

    log.success('Profile updated (PUT)', { key });

    // ── Profile → Newsletter name sync (fire-and-forget) ───────────────────
    syncClientProfileNamesToNewsletter(updatedProfile as Record<string, unknown>).catch(
      (syncErr) => {
        log.error('Profile → Newsletter background sync error (PUT)', syncErr);
      },
    );

    return c.json({
      success: true,
      data: updatedProfile,
    });
  }),
);

/**
 * POST /create-default
 * Create a default profile for a new user
 */
app.post(
  '/create-default',
  asyncHandler(async (c) => {
    const body = await c.req.json();

    // Validate input
    const { userId, email, displayName } = CreateDefaultProfileSchema.parse(body);

    const key = `user_profile:${userId}:personal_info`;

    log.info('Creating default profile', { userId, email });

    // Check if profile already exists
    const existingProfile = await kv.get(key);

    if (existingProfile) {
      log.info('Profile already exists', { userId });
      return c.json({
        success: true,
        message: 'Profile already exists',
        data: existingProfile,
      });
    }

    // ── Personnel guard ──────────────────────────────────────────────────────
    const isSuperAdmin = isSuperAdminEmail(email);
    const personnelProfile = await kv.get(`personnel:profile:${userId}`);
    if (personnelProfile && !isSuperAdmin) {
      log.info('User is personnel — skipping client profile creation', { userId });
      return c.json({
        success: true,
        message: 'Personnel account — no client profile created',
        data: {
          userId,
          email,
          role: personnelProfile.role || 'admin',
          accountStatus: 'approved',
          isPersonnel: true,
        },
      });
    }

    const role = isSuperAdmin ? 'super_admin' : 'client';

    // Parse display name
    const nameParts = displayName.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const surname = nameParts.slice(1).join(' ') || '';

    // Create default profile
    const defaultProfile = {
      profileType: 'personal',
      userId,
      email,
      role,
      accountStatus: isSuperAdmin ? 'approved' : 'no_application',
      accountType: undefined,
      applicationStatus: 'incomplete',
      adviserAssigned: isSuperAdmin,
      personalInformation: {
        firstName,
        lastName: surname,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save to KV store
    await kv.set(key, defaultProfile);

    log.success('Default profile created', {
      userId,
      role,
      isSuperAdmin,
    });

    return c.json({
      success: true,
      message: 'Profile created',
      data: defaultProfile,
    });
  }),
);

export default app;
