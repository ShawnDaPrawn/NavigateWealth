/**
 * Profile ↔ Application Data Sync Service
 *
 * Bidirectional synchronisation between:
 *   - `user_profile:{userId}:personal_info`  (the client profile)
 *   - `application:{id}.application_data`     (the onboarding application)
 *
 * Sync only applies while the application is in a pre-approval status
 * (`submitted` or `under_review`).  Once approved or declined the
 * application becomes a frozen audit record and is never mutated.
 *
 * Guidelines §5.4 — Multi-entry consistency is non-negotiable.
 */

import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';

const log = createModuleLogger('profile-app-sync');

// ---------------------------------------------------------------------------
// Statuses for which sync is active — once outside this set the application
// is frozen and must not be modified.
// ---------------------------------------------------------------------------
const SYNCABLE_STATUSES = new Set(['submitted', 'under_review']);

// ---------------------------------------------------------------------------
// Field Map
//
// Maps profile field paths to their corresponding application_data keys.
// The profile is a flat-ish object (some nested under personalInformation
// in the skeleton, but the full profile built by buildClientProfileFromApplication
// uses top-level keys).  The application_data is always flat.
//
// Direction labels:
//   profile key  →  application_data key
//   application_data key  →  profile key
//
// Only simple 1:1 scalar fields are mapped.  Complex structures (employers,
// identityDocuments, familyMembers) are NOT sync'd because they require
// non-trivial transformation that would risk data corruption.
// ---------------------------------------------------------------------------

interface FieldMapping {
  /** Key in the profile object */
  profileKey: string;
  /** Key in application_data */
  appKey: string;
}

export const FIELD_MAP: FieldMapping[] = [
  // Personal
  { profileKey: 'title',             appKey: 'title' },
  { profileKey: 'firstName',         appKey: 'firstName' },
  { profileKey: 'middleName',        appKey: 'middleName' },
  { profileKey: 'preferredName',     appKey: 'preferredName' },
  { profileKey: 'lastName',          appKey: 'lastName' },
  { profileKey: 'dateOfBirth',       appKey: 'dateOfBirth' },
  { profileKey: 'gender',            appKey: 'gender' },
  { profileKey: 'nationality',       appKey: 'nationality' },
  { profileKey: 'taxNumber',         appKey: 'taxNumber' },
  { profileKey: 'maritalStatus',     appKey: 'maritalStatus' },
  { profileKey: 'maritalRegime',     appKey: 'maritalRegime' },

  // Contact
  { profileKey: 'email',             appKey: 'emailAddress' },
  { profileKey: 'secondaryEmail',    appKey: 'alternativeEmail' },
  { profileKey: 'phoneNumber',       appKey: 'cellphoneNumber' },
  { profileKey: 'alternativePhone',  appKey: 'alternativeCellphone' },
  { profileKey: 'preferredContactMethod', appKey: 'preferredContactMethod' },

  // Address
  { profileKey: 'residentialAddressLine1', appKey: 'residentialAddressLine1' },
  { profileKey: 'residentialAddressLine2', appKey: 'residentialAddressLine2' },
  { profileKey: 'residentialSuburb',       appKey: 'residentialSuburb' },
  { profileKey: 'residentialCity',         appKey: 'residentialCity' },
  { profileKey: 'residentialProvince',     appKey: 'residentialProvince' },
  { profileKey: 'residentialPostalCode',   appKey: 'residentialPostalCode' },
  { profileKey: 'residentialCountry',      appKey: 'residentialCountry' },

  // Employment (scalar fields only — employers array is NOT sync'd)
  { profileKey: 'employmentStatus',          appKey: 'employmentStatus' },
  { profileKey: 'selfEmployedCompanyName',   appKey: 'selfEmployedCompanyName' },
  { profileKey: 'selfEmployedIndustry',      appKey: 'selfEmployedIndustry' },
  { profileKey: 'selfEmployedDescription',   appKey: 'selfEmployedDescription' },
];

// Pre-built lookup maps for O(1) access
const PROFILE_TO_APP = new Map(FIELD_MAP.map(m => [m.profileKey, m.appKey]));
const APP_TO_PROFILE = new Map(FIELD_MAP.map(m => [m.appKey, m.profileKey]));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Find the application for a given userId that is still in a syncable status.
 * Returns null if no syncable application exists.
 */
async function findSyncableApplication(
  userId: string,
): Promise<{ key: string; application: Record<string, unknown> } | null> {
  // The profile stores applicationId when created by admin onboarding
  const profile = await kv.get(`user_profile:${userId}:personal_info`);
  const applicationId = (profile as Record<string, unknown>)?.applicationId as string | undefined;

  if (applicationId) {
    const application = await kv.get(`application:${applicationId}`) as Record<string, unknown> | null;
    if (application && SYNCABLE_STATUSES.has(application.status as string)) {
      return { key: `application:${applicationId}`, application };
    }
    return null;
  }

  // Fallback: scan applications by prefix (slower, but covers edge cases)
  // This is acceptable because it only runs when applicationId is missing
  // from the profile — a rare case for non-admin-onboarded clients.
  const allApps = await kv.getByPrefix('application:') as Array<{ key: string; value: Record<string, unknown> }>;
  for (const entry of allApps) {
    const app = entry.value;
    if (
      app?.user_id === userId &&
      SYNCABLE_STATUSES.has(app.status as string)
    ) {
      return { key: entry.key, application: app };
    }
  }

  return null;
}

/**
 * Extract the userId from a profile KV key.
 * Expected format: `user_profile:{userId}:personal_info`
 */
export function extractUserIdFromProfileKey(key: string): string | null {
  const match = key.match(/^user_profile:([^:]+):personal_info$/);
  return match ? match[1] : null;
}

// ---------------------------------------------------------------------------
// Sync: Profile → Application
// ---------------------------------------------------------------------------

/**
 * After a profile save, push changed fields into the linked application_data.
 *
 * @param userId       The client's user ID
 * @param profileData  The full saved profile object
 * @param adminUserId  (optional) Admin who triggered the save — for audit trail
 */
export async function syncProfileToApplication(
  userId: string,
  profileData: Record<string, unknown>,
  adminUserId?: string,
): Promise<{ synced: boolean; fieldsUpdated: string[] }> {
  try {
    const found = await findSyncableApplication(userId);
    if (!found) {
      return { synced: false, fieldsUpdated: [] };
    }

    const { key: appKvKey, application } = found;
    const appData = (application.application_data || {}) as Record<string, unknown>;

    // Determine which mapped fields differ
    const updates: Record<string, unknown> = {};
    const changedFields: string[] = [];

    for (const { profileKey, appKey } of FIELD_MAP) {
      const profileVal = profileData[profileKey];
      // Skip undefined — the profile may not contain every mapped field
      if (profileVal === undefined) continue;

      const appVal = appData[appKey];
      if (JSON.stringify(profileVal) !== JSON.stringify(appVal)) {
        updates[appKey] = profileVal;
        changedFields.push(appKey);
      }
    }

    // Also check the nested personalInformation object (skeleton profiles use this)
    const personalInfo = profileData.personalInformation as Record<string, unknown> | undefined;
    if (personalInfo) {
      // Map skeleton personalInformation fields to their profile-level equivalents
      const skeletonMap: Record<string, string> = {
        title: 'title',
        firstName: 'firstName',
        middleName: 'middleName',
        lastName: 'lastName',
        dateOfBirth: 'dateOfBirth',
        gender: 'gender',
        nationality: 'nationality',
        taxNumber: 'taxNumber',
        maritalStatus: 'maritalStatus',
        maritalRegime: 'maritalRegime',
        email: 'email',
        cellphone: 'phoneNumber',
      };

      for (const [skeletonKey, profileEquiv] of Object.entries(skeletonMap)) {
        const val = personalInfo[skeletonKey];
        if (val === undefined) continue;

        const appKey = PROFILE_TO_APP.get(profileEquiv);
        if (!appKey) continue;

        // Don't overwrite if we already have a value from the top-level profile
        if (updates[appKey] !== undefined) continue;

        const appVal = appData[appKey];
        if (JSON.stringify(val) !== JSON.stringify(appVal)) {
          updates[appKey] = val;
          changedFields.push(appKey);
        }
      }
    }

    if (changedFields.length === 0) {
      return { synced: false, fieldsUpdated: [] };
    }

    // Merge and save
    const mergedAppData = { ...appData, ...updates };
    const updatedApplication = {
      ...application,
      application_data: mergedAppData,
      updated_at: new Date().toISOString(),
      amendments: [
        ...((application.amendments as unknown[]) || []),
        {
          amended_by: adminUserId || 'profile-sync',
          amended_at: new Date().toISOString(),
          fields_changed: changedFields,
          notes: 'Auto-synced from profile update',
          source: 'profile_to_app_sync',
        },
      ],
    };

    await kv.set(appKvKey, updatedApplication);
    log.info('Profile → Application sync complete', {
      userId,
      fieldsUpdated: changedFields.length,
      fields: changedFields,
    });

    return { synced: true, fieldsUpdated: changedFields };
  } catch (err) {
    // Non-blocking: sync failure must not break the profile save
    log.error('Profile → Application sync failed (non-blocking)', err);
    return { synced: false, fieldsUpdated: [] };
  }
}

// ---------------------------------------------------------------------------
// Sync: Application → Profile
// ---------------------------------------------------------------------------

/**
 * After an application_data amendment, push changed fields into the profile.
 *
 * @param applicationId  The application ID
 * @param updatedAppData The updated application_data object
 * @param adminUserId    Admin who triggered the amendment
 */
export async function syncApplicationToProfile(
  applicationId: string,
  updatedAppData: Record<string, unknown>,
  adminUserId?: string,
): Promise<{ synced: boolean; fieldsUpdated: string[] }> {
  try {
    const application = await kv.get(`application:${applicationId}`) as Record<string, unknown> | null;
    if (!application) {
      return { synced: false, fieldsUpdated: [] };
    }

    // Only sync for syncable statuses
    if (!SYNCABLE_STATUSES.has(application.status as string)) {
      return { synced: false, fieldsUpdated: [] };
    }

    const userId = application.user_id as string;
    if (!userId) {
      return { synced: false, fieldsUpdated: [] };
    }

    const profileKey = `user_profile:${userId}:personal_info`;
    const profile = (await kv.get(profileKey) || {}) as Record<string, unknown>;

    // Determine which mapped fields changed
    const profileUpdates: Record<string, unknown> = {};
    const changedFields: string[] = [];

    for (const { profileKey: pKey, appKey } of FIELD_MAP) {
      const appVal = updatedAppData[appKey];
      if (appVal === undefined) continue;

      const profileVal = profile[pKey];
      if (JSON.stringify(appVal) !== JSON.stringify(profileVal)) {
        profileUpdates[pKey] = appVal;
        changedFields.push(pKey);
      }
    }

    if (changedFields.length === 0) {
      return { synced: false, fieldsUpdated: [] };
    }

    // Merge and save — preserve all existing profile data (policies, FNA, etc.)
    const updatedProfile = {
      ...profile,
      ...profileUpdates,
      updatedAt: new Date().toISOString(),
      _lastSyncedFrom: 'application_amendment',
      _lastSyncedAt: new Date().toISOString(),
    };

    // Also update nested personalInformation if it exists (skeleton profiles)
    if (profile.personalInformation) {
      const personalInfo = { ...(profile.personalInformation as Record<string, unknown>) };
      const reverseSkeletonMap: Record<string, string> = {
        firstName: 'firstName',
        lastName: 'lastName',
        title: 'title',
        middleName: 'middleName',
        dateOfBirth: 'dateOfBirth',
        gender: 'gender',
        nationality: 'nationality',
        taxNumber: 'taxNumber',
        maritalStatus: 'maritalStatus',
        maritalRegime: 'maritalRegime',
        email: 'email',
        phoneNumber: 'cellphone',
      };

      for (const [profileField, skeletonField] of Object.entries(reverseSkeletonMap)) {
        if (profileUpdates[profileField] !== undefined) {
          personalInfo[skeletonField] = profileUpdates[profileField];
        }
      }

      updatedProfile.personalInformation = personalInfo;
    }

    await kv.set(profileKey, updatedProfile);
    log.info('Application → Profile sync complete', {
      applicationId,
      userId,
      fieldsUpdated: changedFields.length,
      fields: changedFields,
    });

    return { synced: true, fieldsUpdated: changedFields };
  } catch (err) {
    // Non-blocking: sync failure must not break the application amendment
    log.error('Application → Profile sync failed (non-blocking)', err);
    return { synced: false, fieldsUpdated: [] };
  }
}

// ---------------------------------------------------------------------------
// Merge: Approval-time profile merge (instead of overwrite)
// ---------------------------------------------------------------------------

/**
 * Merge application data into the existing profile at approval time.
 *
 * Unlike a full overwrite, this preserves any profile fields that were
 * enriched by the admin (policies, FNA results, adviser notes, bank accounts,
 * assets, liabilities, etc.) while updating the core personal/contact/address
 * fields from the (now-authoritative) application data.
 *
 * @param existingProfile  The current profile from KV (may be skeleton or enriched)
 * @param appProfile       The profile built by buildClientProfileFromApplication()
 * @returns                The merged profile
 */
export function mergeProfileOnApproval(
  existingProfile: Record<string, unknown>,
  appProfile: Record<string, unknown>,
): Record<string, unknown> {
  // Start from the existing profile to preserve all enriched data
  const merged = { ...existingProfile };

  // Fields from the application that should ALWAYS overwrite the profile
  // (these are the fields the admin would have edited via the application form)
  const alwaysOverwriteKeys = FIELD_MAP.map(m => m.profileKey);

  // Additional non-mapped fields from buildClientProfileFromApplication
  // that should also be applied
  const additionalOverwriteKeys = [
    'idNumber', 'idCountry', 'passportNumber', 'passportCountry',
    'identityDocuments',  // Rebuilt from application ID data
  ];

  const allOverwriteKeys = new Set([...alwaysOverwriteKeys, ...additionalOverwriteKeys]);

  for (const key of allOverwriteKeys) {
    const appVal = appProfile[key];
    // Only overwrite if the application has a non-empty value
    if (appVal !== undefined && appVal !== null && appVal !== '') {
      merged[key] = appVal;
    }
  }

  // For array fields, prefer application data if non-empty, otherwise keep existing
  const arrayFields = ['familyMembers', 'employers'];
  for (const field of arrayFields) {
    const appArr = appProfile[field] as unknown[] | undefined;
    if (appArr && appArr.length > 0) {
      merged[field] = appArr;
    }
    // else: keep existing (admin may have added entries)
  }

  // Preserve fields that ONLY exist in the profile (never in application)
  // These are automatically preserved because we started from existingProfile.
  // Examples: bankAccounts, assets, liabilities, chronicConditions, FNA data,
  //           adviser notes, policy data, risk assessment, etc.

  // Update metadata timestamp
  if (merged.metadata && typeof merged.metadata === 'object') {
    merged.metadata = {
      ...(merged.metadata as Record<string, unknown>),
      updatedAt: new Date().toISOString(),
      lastMergedFromApplication: new Date().toISOString(),
    };
  }

  // Carry over _applicationMeta from the app profile
  if (appProfile._applicationMeta) {
    merged._applicationMeta = appProfile._applicationMeta;
  }

  return merged;
}
