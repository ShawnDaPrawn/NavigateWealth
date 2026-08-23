/**
 * Maintenance and dangerous admin operations: clearing, deleting, migrating, deprecating, raw key access.
 * One slice of the admin applications service — the AdminApplicationsService
 * facade in applications-service.ts binds these as its static methods.
 */
import * as kv from './kv_store.tsx';

import type { KvApplication, MigrationResult } from './applications-types.ts';

/**
 * Clear all applications
 */
export async function clearApplications(): Promise<number> {
  const applications = await kv.getByPrefix('application:');

  if (!applications || applications.length === 0) {
    return 0;
  }

  const keys = applications.map((app: KvApplication) => `application:${app.id}`);
  await kv.mdel(keys);
  return applications.length;
}

/**
 * Delete a specific application
 */
export async function deleteApplication(key: string): Promise<void> {
  await kv.del(key);
}

/**
 * Migrate old applications
 */
export async function migrateApplications(): Promise<MigrationResult> {
  const allApplications = await kv.getByPrefix('application:');

  if (!allApplications || allApplications.length === 0) {
    return { migrated: 0, deleted: 0, applications: [] };
  }

  let migratedCount = 0;
  let deletedCount = 0;
  const migratedApps = [];

  for (const app of allApplications) {
    try {
      const isOldFormat =
        !app.id ||
        typeof app.id !== 'string' ||
        app.id.length < 20 ||
        !app.user_id ||
        !app.created_at;

      if (isOldFormat) {
        const newId = crypto.randomUUID();

        const newApplication: KvApplication = {
          id: newId,
          user_id: app.user_id || 'unknown',
          status: app.status || 'submitted',
          created_at: app.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
          submitted_at: app.submitted_at || app.created_at || new Date().toISOString(),
          application_data: app.application_data || {
            firstName: app.firstName || 'Unknown',
            lastName: app.lastName || 'User',
            emailAddress: app.emailAddress || app.email || 'unknown@example.com',
            cellphoneNumber: app.cellphoneNumber || app.phone || 'N/A',
            dateOfBirth: app.dateOfBirth || '',
            gender: app.gender || '',
            nationality: app.nationality || '',
            taxNumber: app.taxNumber || '',
            maritalStatus: app.maritalStatus || '',
            residentialAddressLine1: app.residentialAddressLine1 || '',
            residentialCity: app.residentialCity || '',
            residentialProvince: app.residentialProvince || '',
            residentialCountry: app.residentialCountry || 'South Africa',
            employmentStatus: app.employmentStatus || '',
            financialGoals: app.financialGoals || '',
            accountReasons: app.accountReasons || [],
          },
          reviewed_at: app.reviewed_at,
          reviewed_by: app.reviewed_by,
          review_notes: app.review_notes,
        };

        await kv.set(`application:${newId}`, newApplication);

        migratedCount++;
        migratedApps.push({
          oldId: app.id,
          newId: newId,
          status: newApplication.status,
        });

        if (app.id && app.id !== newId) {
          try {
            await kv.del(`application:${app.id}`);
            deletedCount++;
          } catch (_delError) {
            // Silent fail
          }
        }
      }
    } catch (_appError) {
      // Silent fail
    }
  }

  return { migrated: migratedCount, deleted: deletedCount, applications: migratedApps };
}

/**
 * Deprecate applications
 */
export async function deprecateApplications(applicationIds: string[]): Promise<number> {
  let deprecatedCount = 0;

  for (const appId of applicationIds) {
    try {
      const application = await kv.get(`application:${appId}`);

      if (application) {
        const deprecatedApp = {
          ...application,
          deprecated: true,
          deprecated_at: new Date().toISOString(),
          deprecated_reason: 'Manual deprecation by admin',
        };

        await kv.set(`application:${appId}`, deprecatedApp);
        deprecatedCount++;
      }
    } catch (_error) {
      // Silent fail
    }
  }

  return deprecatedCount;
}

/**
 * Get deprecated applications
 */
export async function getDeprecatedApplications(): Promise<KvApplication[]> {
  const allApplications = (await kv.getByPrefix('application:')) as KvApplication[];
  return allApplications?.filter((app) => app.deprecated === true) || [];
}

/**
 * Un-deprecate applications
 */
export async function undeprecateApplications(applicationIds: string[]): Promise<number> {
  let undeprecatedCount = 0;

  for (const appId of applicationIds) {
    try {
      const application = await kv.get(`application:${appId}`);

      if (application) {
        const {
          deprecated: _deprecated,
          deprecated_at: _deprecated_at,
          deprecated_reason: _deprecated_reason,
          ...restoredApp
        } = application;
        await kv.set(`application:${appId}`, restoredApp);
        undeprecatedCount++;
      }
    } catch (_error) {
      // Silent fail
    }
  }

  return undeprecatedCount;
}

/**
 * Get all keys in KV store (Debug)
 */
export async function getAllKeys(prefix: string = ''): Promise<unknown[]> {
  return await kv.getByPrefix(prefix);
}

/**
 * Delete specific key (Debug)
 */
export async function deleteKey(key: string): Promise<void> {
  await kv.del(key);
}

/**
 * Nuclear clear (Debug)
 */
export async function nuclearClear(): Promise<number> {
  const prefixes = ['application:', 'application-', 'applications:', 'app:'];
  let totalDeleted = 0;

  for (const prefix of prefixes) {
    try {
      const items = await kv.getByPrefix(prefix);
      if (items && items.length > 0) {
        for (const item of items) {
          try {
            const possibleKeys = [`${prefix}${item.id}`, item.id, item.key];

            for (const possibleKey of possibleKeys) {
              if (possibleKey) {
                await kv.del(possibleKey);
                totalDeleted++;
              }
            }
          } catch (_delError) {
            // Silent fail
          }
        }
      }
    } catch (_prefixError) {
      // Silent fail
    }
  }

  return totalDeleted;
}
