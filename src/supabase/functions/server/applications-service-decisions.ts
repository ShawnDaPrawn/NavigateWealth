/**
 * Approving, declining, and amending applications.
 * One slice of the admin applications service — the AdminApplicationsService
 * facade in applications-service.ts binds these as its static methods.
 */
import * as kv from './kv_store.tsx';
import {
  sendClientApprovalEmail,
  sendClientDeclineEmail,
  sendAdminApprovalNotification,
  sendAdminOnboardedWelcomeEmail,
} from './email-service.ts';
import {
  canApproveApplication,
  canDeclineApplication,
  extractApprovalEmailData,
  extractDeclineEmailData,
  extractAdminNotificationData,
  buildApprovalMetadata,
  buildDeclineMetadata,
  buildClientProfileFromApplication,
} from './application-utils.ts';
import { AdminClientOnboardingService } from './admin-client-onboarding-service.ts';
import { ERROR_MESSAGES } from './constants.ts';

import { createModuleLogger } from './stderr-logger.ts';
import { syncApplicationToProfile, mergeProfileOnApproval } from './profile-application-sync.ts';
import type { AmendmentRecord } from './applications-types.ts';
import {
  createServiceClient,
  sendEmailSafely,
  updateUserMetadataSafely,
  verifyUserExists,
} from './applications-service-helpers.ts';

const log = createModuleLogger('admin-applications-service');

/**
 * Approve an application
 */
export async function approveApplication(
  applicationId: string,
  adminUserId: string,
): Promise<void> {
  const application = await kv.get(`application:${applicationId}`);

  if (!application) {
    throw new Error(ERROR_MESSAGES.APPLICATION.NOT_FOUND);
  }

  if (!canApproveApplication(application.status)) {
    throw new Error(ERROR_MESSAGES.APPLICATION.INVALID_STATUS);
  }

  const userId = application.user_id;
  const appData = application.application_data;

  // Non-Negotiable guard: verify the user exists in Supabase Auth BEFORE
  // committing any state changes. Approving an application for a non-existent
  // user creates orphaned KV data and violates data integrity (Tier 1).
  const supabase = createServiceClient();
  await verifyUserExists(supabase, userId, applicationId);

  const updatedApplication = {
    ...application,
    status: 'approved',
    reviewed_at: new Date().toISOString(),
    reviewed_by: adminUserId,
  };

  await kv.set(`application:${applicationId}`, updatedApplication);

  await updateUserMetadataSafely(supabase, userId, buildApprovalMetadata(appData));

  // Populate the client profile from application data.
  // For admin-onboarded clients, the skeleton was created during onboarding —
  // Phase 3: MERGE (not overwrite) so admin edits to the profile are preserved.
  // For self-service clients, only create if a profile does not already exist
  // (don't overwrite admin edits made post-approval).
  try {
    const profileKey = `user_profile:${userId}:personal_info`;
    const isAdminOnboardedProfile = application.origin === 'admin_import';
    const existingProfile = await kv.get(profileKey);

    if (!existingProfile) {
      // No profile exists — create from scratch using application data
      const profileData = buildClientProfileFromApplication(appData);
      // Non-Negotiable (§5.4): accountStatus MUST be set on the KV profile —
      // this is the source of truth consumed by loadUserProfile / mapProfileToAppUser.
      profileData.accountStatus = 'approved';
      profileData.role = 'client';
      await kv.set(profileKey, profileData);
    } else if (isAdminOnboardedProfile) {
      // Admin-onboarded: MERGE application data into existing profile
      // instead of overwriting, preserving any enriched fields (policies,
      // FNA results, bank accounts, adviser notes, etc.) that the admin
      // may have added while preparing the client's account.
      const appProfile = buildClientProfileFromApplication(appData);
      const mergedProfile = mergeProfileOnApproval(existingProfile, appProfile);

      // Preserve critical identifiers from the skeleton
      if (existingProfile.applicationNumber) {
        mergedProfile.applicationNumber = existingProfile.applicationNumber;
      }
      if (existingProfile.applicationId) {
        mergedProfile.applicationId = existingProfile.applicationId;
      }

      // Non-Negotiable (§5.4): accountStatus MUST be updated on approval
      mergedProfile.accountStatus = 'approved';
      mergedProfile.role = mergedProfile.role || 'client';

      await kv.set(profileKey, mergedProfile);
      log.info('Approval-time profile merge complete (admin-onboarded)', { userId });
    } else {
      // Self-service client with existing profile — update accountStatus and role
      // without overwriting other profile data (admin may have enriched it).
      // Non-Negotiable (§5.4, §12.3): Multi-entry consistency — the KV profile
      // accountStatus MUST match the application status to prevent routing bugs
      // where the client is stuck on the pending page after approval.
      const updatedProfile = {
        ...existingProfile,
        accountStatus: 'approved',
        role: existingProfile.role || 'client',
      };
      await kv.set(profileKey, updatedProfile);
      log.info('Approval-time profile accountStatus updated (self-service)', { userId });
    }
  } catch (profileError) {
    // Non-blocking: profile creation failure should not prevent approval
    log.warn(`Failed to create client profile for user ${userId} during approval: ${profileError}`);
  }

  // User was already verified above — fetch again for email details
  const {
    data: { user },
  } = await supabase.auth.admin.getUserById(userId);

  if (user?.email) {
    const isAdminOnboarded = application.origin === 'admin_import';
    const clientName = `${appData.firstName || ''} ${appData.lastName || ''}`.trim();
    const appNumber = application.application_number || applicationId;

    if (isAdminOnboarded) {
      // Admin-onboarded client: send welcome email with password-setup link
      try {
        const resetLink = await AdminClientOnboardingService.generatePasswordResetLink(user.email!);
        if (resetLink) {
          await sendEmailSafely(
            () =>
              sendAdminOnboardedWelcomeEmail({
                to: user.email!,
                clientName,
                applicationNumber: appNumber,
                passwordResetLink: resetLink,
              }),
            'admin-onboarded welcome',
          );
        }
      } catch (linkError) {
        log.warn(`Failed to generate password reset link for admin-onboarded user: ${linkError}`);
      }
    } else {
      // Self-service client: send normal approval email
      await sendEmailSafely(
        () =>
          sendClientApprovalEmail(extractApprovalEmailData(user.email!, appData, applicationId)),
        'client approval',
      );
    }

    // Always send admin notification
    await sendEmailSafely(
      () =>
        sendAdminApprovalNotification(
          extractAdminNotificationData(user.email!, appData, applicationId, adminUserId),
        ),
      'admin notification',
    );
  }
}

/**
 * Decline an application
 */
export async function declineApplication(
  applicationId: string,
  adminUserId: string,
  reason?: string,
): Promise<void> {
  const application = await kv.get(`application:${applicationId}`);

  if (!application) {
    throw new Error(ERROR_MESSAGES.APPLICATION.NOT_FOUND);
  }

  if (!canDeclineApplication(application.status)) {
    throw new Error(ERROR_MESSAGES.APPLICATION.INVALID_STATUS);
  }

  const userId = application.user_id;
  const appData = application.application_data;

  // Non-Negotiable guard: verify the user exists in Supabase Auth BEFORE
  // committing any state changes (same rationale as approveApplication).
  const supabase = createServiceClient();
  await verifyUserExists(supabase, userId, applicationId);

  const updatedApplication = {
    ...application,
    status: 'declined',
    reviewed_at: new Date().toISOString(),
    reviewed_by: adminUserId,
    review_notes: reason || '',
  };

  await kv.set(`application:${applicationId}`, updatedApplication);

  await updateUserMetadataSafely(supabase, userId, buildDeclineMetadata(appData));

  // Non-Negotiable (§5.4, §12.3): Multi-entry consistency — update the KV profile's
  // accountStatus to 'declined' so the frontend routes the client correctly.
  // Without this, the KV profile retains 'submitted_for_review' and the client
  // continues to see the pending page instead of the declined page.
  try {
    const profileKey = `user_profile:${userId}:personal_info`;
    const existingProfile = await kv.get(profileKey);
    if (existingProfile) {
      await kv.set(profileKey, {
        ...existingProfile,
        accountStatus: 'declined',
        applicationStatus: 'declined',
      });
      log.info('Decline-time profile accountStatus updated', { userId });
    }
  } catch (profileError) {
    log.warn(
      `Failed to update profile accountStatus on decline for user ${userId}: ${profileError}`,
    );
  }

  // User was already verified above — fetch again for email details
  const {
    data: { user },
  } = await supabase.auth.admin.getUserById(userId);

  if (user?.email) {
    await sendEmailSafely(
      () =>
        sendClientDeclineEmail(
          extractDeclineEmailData(user.email!, appData, reason || '', applicationId),
        ),
      'client decline',
    );
  }
}

/**
 * Update application data (admin amendment)
 */
export async function updateApplicationData(
  applicationId: string,
  updatedData: Record<string, unknown>,
  adminUserId: string,
  amendmentNotes?: string,
): Promise<{ amendments_count: number }> {
  const application = await kv.get(`application:${applicationId}`);

  if (!application) {
    throw new Error(ERROR_MESSAGES.APPLICATION.NOT_FOUND);
  }

  const existingData = application.application_data || {};

  // Track which fields changed
  const amendments: string[] = [];
  for (const [key, value] of Object.entries(updatedData)) {
    const oldVal = JSON.stringify(existingData[key] ?? '');
    const newVal = JSON.stringify(value ?? '');
    if (oldVal !== newVal) {
      amendments.push(key);
    }
  }

  const mergedData = { ...existingData, ...updatedData };

  const amendmentRecord: AmendmentRecord = {
    amended_by: adminUserId,
    amended_at: new Date().toISOString(),
    fields_changed: amendments,
    notes: amendmentNotes || '',
  };

  const existingAmendments = application.amendments || [];

  const updatedApplication = {
    ...application,
    application_data: mergedData,
    updated_at: new Date().toISOString(),
    amendments: [...existingAmendments, amendmentRecord],
    last_amended_at: new Date().toISOString(),
    last_amended_by: adminUserId,
  };

  await kv.set(`application:${applicationId}`, updatedApplication);

  // ── Phase 2: Application → Profile sync ────────────────────────────
  // Push changed fields into the client profile so both records stay
  // consistent while the application is in a pre-approval status.
  // Non-blocking — sync failure must not break the amendment response.
  syncApplicationToProfile(applicationId, mergedData, adminUserId)
    .then((result) => {
      if (result.synced) {
        log.info('Application → Profile sync triggered after amendment', {
          applicationId,
          fieldsUpdated: result.fieldsUpdated,
        });
      }
    })
    .catch((syncErr) => {
      log.error('Application → Profile background sync error', syncErr);
    });

  return { amendments_count: amendments.length };
}
