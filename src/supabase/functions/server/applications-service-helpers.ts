/**
 * Shared plumbing for the admin applications service slices: record guards,
 * deleted-client filtering, the service-role client, and the safe wrappers
 * around email sends and auth-user metadata updates.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import * as kv from './kv_store.tsx';
import { DATABASE_SCHEMA, ERROR_MESSAGES } from './constants.ts';

import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import type { SupabaseAdminClient, KvApplication } from './applications-types.ts';

const log = createModuleLogger('admin-applications-service');

/**
 * Root application documents live at `application:{uuid}`.
 * Per-step entries use `application:{uuid}:step_N` and lack top-level `application_data`.
 */
export function isRootApplicationRecord(a: unknown): a is KvApplication {
  if (!a || typeof a !== 'object' || Array.isArray(a)) return false;
  const o = a as Record<string, unknown>;
  const id = o.id;
  const uid = o.user_id ?? o.userId;
  const appData = o.application_data;
  if (typeof id !== 'string' || !id) return false;
  if (typeof uid !== 'string' || !uid) return false;
  if (appData === undefined || appData === null) return false;
  if (typeof appData !== 'object' || Array.isArray(appData)) return false;
  return true;
}

/**
 * Exclude applications for deleted clients (security:* KV). Matches getApplications
 * filtering so /admin/stats counts align with the Incomplete tab.
 * @param cascadeDeprecate When true, mark stale application KV rows deprecated (listing path).
 */
export async function excludeApplicationsForDeletedClients(
  applications: KvApplication[],
  cascadeDeprecate: boolean,
): Promise<KvApplication[]> {
  const uniqueUserIds = [
    ...new Set(
      applications
        .map((app: KvApplication) => app.user_id)
        .filter((uid: string | undefined): uid is string => !!uid && isValidUUID(uid)),
    ),
  ];
  if (uniqueUserIds.length === 0) return applications;

  const securityKeys = uniqueUserIds.map((uid) => `security:${uid}`);
  const securityEntries = await kv.mget(securityKeys);
  const deletedUserIds = new Set<string>();
  uniqueUserIds.forEach((uid, idx) => {
    const sec = securityEntries[idx];
    if (sec?.deleted === true) {
      deletedUserIds.add(uid);
    }
  });
  if (deletedUserIds.size === 0) return applications;

  if (cascadeDeprecate) {
    log.info(`Excluding ${deletedUserIds.size} application(s) for deleted clients from listing`);
    const staleApps = applications.filter(
      (app: KvApplication) => app.user_id && deletedUserIds.has(app.user_id),
    );
    for (const app of staleApps) {
      kv.set(`application:${app.id}`, {
        ...app,
        deprecated: true,
        deprecated_at: new Date().toISOString(),
        deprecated_reason: 'Client account deleted — cascade cleanup',
      }).catch((err) =>
        log.error('Failed to cascade-deprecate stale application', { appId: app.id, err }),
      );
    }
  } else {
    log.info(
      `getStats: Excluding ${deletedUserIds.size} application(s) for deleted clients from counts`,
    );
  }

  return applications.filter(
    (app: KvApplication) => !app.user_id || !deletedUserIds.has(app.user_id),
  );
}

// Helper to create Supabase client with service role
export function createServiceClient(): SupabaseAdminClient {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    {
      db: {
        schema: DATABASE_SCHEMA,
      },
    },
  );
}

// Helper to validate UUID
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// Helper for safe email sending
export async function sendEmailSafely(
  emailFunction: () => Promise<boolean | void>,
  _emailType: string,
): Promise<void> {
  try {
    await emailFunction();
  } catch (_error) {
    // Silent fail
  }
}

// Helper for safe user metadata update
export async function updateUserMetadataSafely(
  supabase: SupabaseAdminClient,
  userId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  try {
    await supabase.auth.admin.updateUserById(userId, {
      user_metadata: metadata,
    });
  } catch (error) {
    log.warn('Failed to update user metadata', { userId, error: getErrMsg(error) });
  }
}

/**
 * Verify that a user exists in Supabase Auth before processing their application.
 * This is a Non-Negotiable guard (Tier 1) — approving or declining an application
 * for a non-existent user creates orphaned KV data and violates data integrity.
 */
export async function verifyUserExists(
  supabase: SupabaseAdminClient,
  userId: string,
  applicationId: string,
): Promise<void> {
  const { data, error } = await supabase.auth.admin.getUserById(userId);

  if (error || !data?.user) {
    log.error('Application references non-existent user', {
      applicationId,
      userId,
      authError: error?.message || 'User not found',
    });
    throw new Error(ERROR_MESSAGES.APPLICATION.USER_NOT_FOUND);
  }
}
