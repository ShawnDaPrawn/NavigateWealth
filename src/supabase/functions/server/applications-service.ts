/**
 * Admin Applications Service
 * Handles business logic for admin operations on applications
 */

import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import * as kv from './kv_store.tsx';
import {
  sendClientApprovalEmail,
  sendClientDeclineEmail,
  sendAdminApprovalNotification,
  sendAdminOnboardedWelcomeEmail,
  sendApplicationInviteEmail,
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
import { generateApplicationNumber } from './application-number-utils.ts';
import type {
  ApplicationStats,
  ApplicationListResponse,
  ApplicationDetailResponse,
  ApplicationData,
} from './types.ts';
import {
  DATABASE_SCHEMA,
  ERROR_MESSAGES,
  SUPER_ADMIN_EMAIL,
} from './constants.ts';

import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import {
  syncApplicationToProfile,
  mergeProfileOnApproval,
} from './profile-application-sync.ts';
import type {
  SupabaseAdminClient,
  SupabaseAuthUser,
  KvApplication,
  KvTask,
  KvRequest,
  KvEsignEnvelope,
  AmendmentRecord,
  MigrationResult,
} from './applications-types.ts';

const log = createModuleLogger('admin-applications-service');

/**
 * Root application documents live at `application:{uuid}`.
 * Per-step entries use `application:{uuid}:step_N` and lack top-level `application_data`.
 */
function isRootApplicationRecord(a: unknown): a is KvApplication {
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
async function excludeApplicationsForDeletedClients(
  applications: KvApplication[],
  cascadeDeprecate: boolean,
): Promise<KvApplication[]> {
  const uniqueUserIds = [...new Set(
    applications
      .map((app: KvApplication) => app.user_id)
      .filter((uid: string | undefined): uid is string => !!uid && isValidUUID(uid))
  )];
  if (uniqueUserIds.length === 0) return applications;

  const securityKeys = uniqueUserIds.map(uid => `security:${uid}`);
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
      (app: KvApplication) => app.user_id && deletedUserIds.has(app.user_id)
    );
    for (const app of staleApps) {
      kv.set(`application:${app.id}`, {
        ...app,
        deprecated: true,
        deprecated_at: new Date().toISOString(),
        deprecated_reason: 'Client account deleted — cascade cleanup',
      }).catch(err => log.error('Failed to cascade-deprecate stale application', { appId: app.id, err }));
    }
  } else {
    log.info(`getStats: Excluding ${deletedUserIds.size} application(s) for deleted clients from counts`);
  }

  return applications.filter(
    (app: KvApplication) => !app.user_id || !deletedUserIds.has(app.user_id)
  );
}

// Helper to create Supabase client with service role
function createServiceClient(): SupabaseAdminClient {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    {
      db: {
        schema: DATABASE_SCHEMA,
      },
    }
  );
}

// Helper to validate UUID
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// Helper for safe email sending
async function sendEmailSafely(
  emailFunction: () => Promise<void>,
  emailType: string
): Promise<void> {
  try {
    await emailFunction();
  } catch (error) {
    // Silent fail
  }
}

// Helper for safe user metadata update
async function updateUserMetadataSafely(
  supabase: SupabaseAdminClient,
  userId: string,
  metadata: Record<string, unknown>
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
async function verifyUserExists(
  supabase: SupabaseAdminClient,
  userId: string,
  applicationId: string
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

export class AdminApplicationsService {
  
  /**
   * Get all applications with filtering and sorting
   */
  static async getApplications(
    status?: string,
    sortBy: string = 'created_at',
    sortOrder: string = 'desc'
  ): Promise<ApplicationListResponse> {

    const allApplications = await kv.getByPrefix('application:');
    
    if (!allApplications || allApplications.length === 0) {
      return { applications: [], total: 0 };
    }

    // Filter deprecated, root documents only (same as getStats — excludes step KV rows)
    let applications = allApplications
      .filter((app: KvApplication) => app.deprecated !== true)
      .filter(isRootApplicationRecord);

    applications = await excludeApplicationsForDeletedClients(applications, true);

    // Filter by status
    if (status) {
      applications = applications.filter((app: KvApplication) => app.status === status);
    }

    // Sort
    applications.sort((a: KvApplication, b: KvApplication) => {
      let aVal, bVal;
      switch (sortBy) {
        case 'created_at':
          aVal = new Date(a.created_at || 0).getTime();
          bVal = new Date(b.created_at || 0).getTime();
          break;
        case 'updated_at':
          aVal = new Date(a.updated_at || 0).getTime();
          bVal = new Date(b.updated_at || 0).getTime();
          break;
        case 'status':
          aVal = a.status || '';
          bVal = b.status || '';
          break;
        default:
          aVal = new Date(a.created_at || 0).getTime();
          bVal = new Date(b.created_at || 0).getTime();
      }
      return sortOrder === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
    });

    const supabase = createServiceClient();

    // Enrich with user data
    const enrichedApplications = await Promise.all(
      applications.map(async (app: KvApplication) => {
        // Common fields included in all enrichment paths
        const baseFields = {
          id: app.id,
          user_id: app.user_id,
          status: app.status,
          created_at: app.created_at,
          updated_at: app.updated_at,
          submitted_at: app.submitted_at || null,
          reviewed_at: app.reviewed_at || null,
          reviewed_by: app.reviewed_by || null,
          review_notes: app.review_notes || null,
          application_number: app.application_number || null,
          origin: app.origin || null,
          onboarded_by: app.onboarded_by || null,
          application_data: app.application_data || {},
        };

        try {
          if (!app.user_id || !isValidUUID(app.user_id)) {
            return {
              ...baseFields,
              user_email: null,
              user_name: app.application_data?.personalInfo?.firstName + ' ' + app.application_data?.personalInfo?.lastName || 'Unknown',
            };
          }

          const { data, error: authError } = await supabase.auth.admin.getUserById(app.user_id);
          
          if (authError || !data?.user) {
             return {
              ...baseFields,
              user_email: null,
              user_name: app.application_data?.personalInfo?.firstName + ' ' + app.application_data?.personalInfo?.lastName || 'Unknown',
            };
          }
          
          const user = data.user;
          return {
            ...baseFields,
            user_email: user?.email || null,
            user_name: user?.user_metadata?.name || app.application_data?.personalInfo?.firstName + ' ' + app.application_data?.personalInfo?.lastName || null,
          };
        } catch (error) {
          return {
            ...baseFields,
            user_email: null,
            user_name: app.application_data?.personalInfo?.firstName + ' ' + app.application_data?.personalInfo?.lastName || 'Unknown',
          };
        }
      })
    );

    return {
      applications: enrichedApplications,
      total: enrichedApplications.length,
    };
  }

  /**
   * Get single application details
   */
  static async getApplicationById(applicationId: string): Promise<ApplicationDetailResponse> {
    const application = await kv.get(`application:${applicationId}`);

    if (!application) {
      throw new Error(ERROR_MESSAGES.APPLICATION.NOT_FOUND);
    }

    const supabase = createServiceClient();

    try {
      const { data: { user } } = await supabase.auth.admin.getUserById(application.user_id);
      
      const detailedApplication = {
        id: application.id,
        user_id: application.user_id,
        status: application.status,
        created_at: application.created_at,
        updated_at: application.updated_at,
        reviewed_at: application.reviewed_at || null,
        reviewed_by: application.reviewed_by || null,
        review_notes: application.review_notes || null,
        application_data: application.application_data || {},
        user_email: user?.email || null,
        user_name: user?.user_metadata?.name || application.application_data?.personalInfo?.firstName + ' ' + application.application_data?.personalInfo?.lastName || null,
        user_metadata: user?.user_metadata || {},
      };

      return { application: detailedApplication };
    } catch (error) {
      
      return {
        application: {
          ...application,
          user_email: null,
          user_name: null,
          user_metadata: {},
        },
      };
    }
  }

  /**
   * Approve an application
   */
  static async approveApplication(applicationId: string, adminUserId: string): Promise<void> {
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

    await updateUserMetadataSafely(
      supabase,
      userId,
      buildApprovalMetadata(appData)
    );

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
    const { data: { user } } = await supabase.auth.admin.getUserById(userId);

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
              () => sendAdminOnboardedWelcomeEmail({
                to: user.email!,
                clientName,
                applicationNumber: appNumber,
                passwordResetLink: resetLink,
              }),
              'admin-onboarded welcome'
            );
          }
        } catch (linkError) {
          log.warn(`Failed to generate password reset link for admin-onboarded user: ${linkError}`);
        }
      } else {
        // Self-service client: send normal approval email
        await sendEmailSafely(
          () => sendClientApprovalEmail(extractApprovalEmailData(user.email!, appData, applicationId)),
          'client approval'
        );
      }

      // Always send admin notification
      await sendEmailSafely(
        () => sendAdminApprovalNotification(
          extractAdminNotificationData(user.email!, appData, applicationId, adminUserId)
        ),
        'admin notification'
      );
    }
  }

  /**
   * Decline an application
   */
  static async declineApplication(applicationId: string, adminUserId: string, reason?: string): Promise<void> {
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

    await updateUserMetadataSafely(
      supabase,
      userId,
      buildDeclineMetadata(appData)
    );

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
      log.warn(`Failed to update profile accountStatus on decline for user ${userId}: ${profileError}`);
    }

    // User was already verified above — fetch again for email details
    const { data: { user } } = await supabase.auth.admin.getUserById(userId);

    if (user?.email) {
      await sendEmailSafely(
        () => sendClientDeclineEmail(
          extractDeclineEmailData(user.email!, appData, reason || '', applicationId)
        ),
        'client decline'
      );
    }
  }

  /**
   * Update application data (admin amendment)
   */
  static async updateApplicationData(
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
      .then(result => {
        if (result.synced) {
          log.info('Application → Profile sync triggered after amendment', {
            applicationId,
            fieldsUpdated: result.fieldsUpdated,
          });
        }
      })
      .catch(syncErr => {
        log.error('Application → Profile background sync error', syncErr);
      });

    return { amendments_count: amendments.length };
  }

  /**
   * Invite a prospective client to create a Navigate Wealth account.
   *
   * 1. Create Supabase Auth user (email confirmed, random temp password)
   * 2. Generate a password-recovery link for the invitee to set their password
   * 3. Create a KV application record with status `invited`
   * 4. Send the invitation email via the `application_invite` template
   */
  static async inviteApplicant(
    input: { email: string; firstName: string; lastName: string; cellphoneNumber?: string },
    adminUserId: string,
    origin?: string,
  ): Promise<{ success: boolean; applicationId?: string; applicationNumber?: string; error?: string; errorCode?: string }> {
    const supabase = createServiceClient();
    const email = input.email.trim().toLowerCase();
    const firstName = input.firstName.trim();
    const lastName = input.lastName.trim();
    const cellphone = input.cellphoneNumber?.trim() || '';

    // 1. Create Supabase Auth user with temp password
    const tempChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*';
    let tempPw = '';
    const rng = new Uint8Array(24);
    crypto.getRandomValues(rng);
    for (const byte of rng) tempPw += tempChars[byte % tempChars.length];

    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email,
      password: tempPw,
      email_confirm: true,
      user_metadata: {
        firstName,
        surname: lastName,
        fullName: `${firstName} ${lastName}`,
        countryCode: '+27',
        phoneNumber: cellphone,
        accountType: 'Personal Client',
        accountStatus: 'invited',
        origin: 'admin_invite',
        mustSetPassword: true,
        mustAcceptTerms: true,
        invitedBy: adminUserId,
        invitedAt: new Date().toISOString(),
      },
    });

    if (userError || !userData?.user) {
      if (
        userError?.status === 422 ||
        userError?.message?.includes('already been registered') ||
        userError?.code === 'email_exists'
      ) {
        return { success: false, error: `A user with email ${email} already exists`, errorCode: 'EMAIL_EXISTS' };
      }
      return { success: false, error: userError?.message || 'Failed to create user account', errorCode: 'AUTH_ERROR' };
    }

    const userId = userData.user.id;
    log.info('Auth user created for invited applicant');

    // 2. Create application record
    const applicationNumber = await generateApplicationNumber();
    const applicationId = crypto.randomUUID();
    const now = new Date().toISOString();

    const applicationData: ApplicationData = {
      firstName,
      lastName,
      emailAddress: email,
      cellphoneNumber: cellphone,
      nationality: 'South Africa',
      residentialCountry: 'South Africa',
      accountReasons: [],
      existingProducts: [],
      termsAccepted: false,
      popiaConsent: false,
      disclosureAcknowledged: false,
      accountType: 'Personal Client',
    };

    const application: KvApplication = {
      id: applicationId,
      application_number: applicationNumber,
      user_id: userId,
      status: 'invited',
      origin: 'admin_invite',
      invited_by: adminUserId,
      created_at: now,
      updated_at: now,
      submitted_at: null,
      reviewed_at: null,
      reviewed_by: null,
      review_notes: null,
      application_data: applicationData,
    };

    await kv.set(`application:${applicationId}`, application);
    log.info('Application created for invited applicant');

    // 3. Create profile skeleton
    const defaultProfile = {
      profileType: 'personal',
      userId,
      role: 'client',
      accountType: 'personal',
      accountStatus: 'invited',
      applicationStatus: 'invited',
      applicationNumber,
      applicationId,
      adviserAssigned: false,
      origin: 'admin_invite',
      personalInformation: {
        firstName,
        lastName,
        email,
        cellphone,
        nationality: 'South Africa',
        identityDocuments: [],
      },
      metadata: {
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        invitedBy: adminUserId,
      },
    };

    await kv.set(`user_profile:${userId}:personal_info`, defaultProfile);
    log.info('Profile skeleton created for invited applicant');

    // 4. Generate password-setup link and send invitation email
    try {
      const setupLink = await AdminClientOnboardingService.generatePasswordResetLink(email, origin);
      if (setupLink) {
        const clientName = `${firstName} ${lastName}`;
        await sendApplicationInviteEmail({
          to: email,
          clientName,
          setupLink,
          applicationNumber,
        });
        log.info('Invitation email sent to applicant');
      } else {
        log.warn('Could not generate setup link for invited applicant — email not sent');
      }
    } catch (emailError) {
      // Non-blocking: email failure should not prevent the invite from being recorded
      log.error('Failed to send invitation email', emailError as Error);
    }

    return {
      success: true,
      applicationId,
      applicationNumber,
    };
  }

  /**
   * Resend the invitation email for an existing `invited` application.
   *
   * Generates a fresh password-recovery link and re-sends the
   * `application_invite` email template. Does not create a new user or
   * application — everything stays in place.
   */
  static async resendInvite(
    applicationId: string,
    adminUserId: string,
    origin?: string,
  ): Promise<{ success: boolean; error?: string }> {
    const application = await kv.get(`application:${applicationId}`);
    if (!application) {
      return { success: false, error: 'Application not found' };
    }

    if (application.status !== 'invited') {
      return { success: false, error: 'Only invited applications can be resent' };
    }

    const appData = application.application_data || {};
    const email = appData.emailAddress;
    if (!email) {
      return { success: false, error: 'Application has no email address on record' };
    }

    const firstName = appData.firstName || '';
    const lastName = appData.lastName || '';
    const clientName = `${firstName} ${lastName}`.trim() || 'Client';
    const applicationNumber = application.application_number || '';

    // Generate a fresh password-setup link
    const setupLink = await AdminClientOnboardingService.generatePasswordResetLink(email, origin);
    if (!setupLink) {
      return { success: false, error: 'Failed to generate a new setup link. The recovery token could not be created.' };
    }

    // Re-send the invitation email
    try {
      await sendApplicationInviteEmail({
        to: email,
        clientName,
        setupLink,
        applicationNumber,
      });
    } catch (emailError) {
      log.error('Failed to resend invitation email', emailError as Error);
      return { success: false, error: 'Setup link generated but the email could not be sent. Check email service configuration.' };
    }

    // Update the application's updated_at timestamp for audit
    await kv.set(`application:${applicationId}`, {
      ...application,
      updated_at: new Date().toISOString(),
      last_invite_resent_at: new Date().toISOString(),
      last_invite_resent_by: adminUserId,
    });

    log.info('Invitation re-sent for application', { applicationId });
    return { success: true };
  }

  /**
   * Get application statistics
   */
  static async getStats(): Promise<ApplicationStats> {
    // Wrap entire method in top-level try/catch so a crash here never
    // kills the Edge Function response
    let applications: KvApplication[] = [];
    try {
      const raw = ((await kv.getByPrefix('application:')) || []) as KvApplication[];
      // Exclude deprecated applications and per-step KV rows (not root application documents)
      applications = raw
        .filter((a: KvApplication) => a.deprecated !== true)
        .filter(isRootApplicationRecord);
      applications = await excludeApplicationsForDeletedClients(applications, false);
    } catch (kvError) {
      log.error('getStats: Failed to fetch applications from KV', kvError as Error);
      // Return safe defaults so the endpoint still responds
    }

    const draftCount = applications.filter((a) => a.status === 'draft').length;
    const inProgressCount = applications.filter((a) => a.status === 'in_progress').length;
    // incomplete = draft + in_progress (same as filtering for either status)
    const incompleteCount = draftCount + inProgressCount;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    // Calculate monthly stats
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const newThisMonth = applications.filter((a: KvApplication) => {
        const d = new Date(a.created_at);
        return d >= startOfMonth;
    }).length;

    const newLastMonth = applications.filter((a: KvApplication) => {
        const d = new Date(a.created_at);
        return d >= startOfLastMonth && d <= endOfLastMonth;
    }).length;

    let taskStats = { new_tasks: 0, pending_tasks: 0 };
    try {
      // Tasks are stored in KV store (not a Postgres table)
      const kvTasks = (await kv.getByPrefix('task:')) as KvTask[];
      if (Array.isArray(kvTasks)) {
        taskStats.new_tasks = kvTasks.filter((t) => t && t.status === 'new').length;
        taskStats.pending_tasks = kvTasks.filter((t) =>
          t && (t.status === 'new' || t.status === 'in_progress')
        ).length;
      }
    } catch (taskError) {
      log.error('getStats: Failed to fetch task stats', taskError as Error);
    }

    // Simplified user count - just count unique user_ids from applications
    let activeUsers = 0;
    
    try {
      // Get real user count from Auth to match Client Management
      const supabase = createServiceClient();
      const listResult = await supabase.auth.admin.listUsers({ perPage: 1000 });
      const users = listResult?.data?.users;
      const usersError = listResult?.error;

      if (!usersError && Array.isArray(users)) {
        // Filter out admin users (except super admin)
        const clients = users.filter((user: SupabaseAuthUser) => {
          const email = user.email?.toLowerCase();
          const isSuperAdmin = email === SUPER_ADMIN_EMAIL.toLowerCase();
          const role = (user.user_metadata as Record<string, unknown> | undefined)?.role;
          
          if (role === 'admin' && !isSuperAdmin) {
            return false;
          }
          return true;
        });
        
        activeUsers = clients.length;
      } else {
        // If Auth fetch fails, fall back to application data
        log.error('getStats: listUsers returned error, falling back to application count', usersError);
        const uniqueUserIds = new Set(applications.map((a) => a.user_id).filter(Boolean));
        activeUsers = uniqueUserIds.size;
      }

    } catch (criticalError) {
      log.error('getStats: listUsers threw, falling back to application count', criticalError as Error);
      // Fallback to application count
      const uniqueUserIds = new Set(applications.map((a) => a.user_id).filter(Boolean));
      activeUsers = uniqueUserIds.size;
    }

    let pendingRequests = 0;
    let totalRequests = 0;
    let pendingEsignatures = 0;
    try {
      // Get request stats
      const requests = (await kv.getByPrefix('requests:request:')) as KvRequest[];
      if (requests) {
        totalRequests = requests.length;
        pendingRequests = requests.filter((r) => 
          r.status === 'New' || 
          r.status === 'In Compliance Review' || 
          r.status === 'In Lifecycle' || 
          r.status === 'In Sign-Off'
        ).length;
      }

      // Get pending e-signatures
      const esignItems = (await kv.getByPrefix('esign:envelope:')) as KvEsignEnvelope[];
      pendingEsignatures = esignItems ? esignItems.filter((item) => 
        item && 
        typeof item === 'object' &&
        !Array.isArray(item) && 
        item.status && 
        (item.status === 'sent' || item.status === 'in_progress')
      ).length : 0;

    } catch (requestError) {
      log.error('getStats: Failed to fetch request/esign stats', requestError as Error);
    }

    return {
      total: applications.length,
      submitted_for_review: applications.filter((a) => a.status === 'submitted' || a.status === 'pending' as string).length,
      approved: applications.filter((a) => a.status === 'approved').length,
      declined: applications.filter((a) => a.status === 'declined').length,
      application_in_progress: inProgressCount,
      invited: applications.filter((a) => a.status === 'invited').length,
      draft: draftCount,
      incomplete: incompleteCount,
      no_application: 0,
      new_applications_7d: applications.filter((a) => a.status === 'submitted' && a.created_at && new Date(a.created_at) >= sevenDaysAgo).length,
      new_this_month: newThisMonth,
      new_last_month: newLastMonth,
      new_tasks: taskStats.new_tasks,
      pending_tasks: taskStats.pending_tasks,
      pending_requests: pendingRequests,
      total_requests: totalRequests,
      pending_esignatures: pendingEsignatures,
      active_users: activeUsers,
      total_clients: activeUsers,
    };
  }

  /**
   * Clear all applications
   */
  static async clearApplications(): Promise<number> {
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
  static async deleteApplication(key: string): Promise<void> {
    await kv.del(key);
  }

  /**
   * Migrate old applications
   */
  static async migrateApplications(): Promise<MigrationResult> {
    const allApplications = await kv.getByPrefix('application:');
    
    if (!allApplications || allApplications.length === 0) {
      return { migrated: 0, deleted: 0, applications: [] };
    }

    let migratedCount = 0;
    let deletedCount = 0;
    const migratedApps = [];

    for (const app of allApplications) {
      try {
        const isOldFormat = !app.id || 
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
            } catch (delError) {
              // Silent fail
            }
          }
        }
      } catch (appError) {
        // Silent fail
      }
    }

    return { migrated: migratedCount, deleted: deletedCount, applications: migratedApps };
  }

  /**
   * Deprecate applications
   */
  static async deprecateApplications(applicationIds: string[]): Promise<number> {
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
      } catch (error) {
        // Silent fail
      }
    }

    return deprecatedCount;
  }

  /**
   * Get deprecated applications
   */
  static async getDeprecatedApplications(): Promise<KvApplication[]> {
    const allApplications = (await kv.getByPrefix('application:')) as KvApplication[];
    return allApplications?.filter((app) => app.deprecated === true) || [];
  }

  /**
   * Un-deprecate applications
   */
  static async undeprecateApplications(applicationIds: string[]): Promise<number> {
    let undeprecatedCount = 0;

    for (const appId of applicationIds) {
      try {
        const application = await kv.get(`application:${appId}`);
        
        if (application) {
          const { deprecated, deprecated_at, deprecated_reason, ...restoredApp } = application;
          await kv.set(`application:${appId}`, restoredApp);
          undeprecatedCount++;
        }
      } catch (error) {
        // Silent fail
      }
    }

    return undeprecatedCount;
  }

  /**
   * Get all keys in KV store (Debug)
   */
  static async getAllKeys(prefix: string = ''): Promise<unknown[]> {
    return await kv.getByPrefix(prefix);
  }

  /**
   * Delete specific key (Debug)
   */
  static async deleteKey(key: string): Promise<void> {
    await kv.del(key);
  }

  /**
   * Nuclear clear (Debug)
   */
  static async nuclearClear(): Promise<number> {
    const prefixes = ['application:', 'application-', 'applications:', 'app:'];
    let totalDeleted = 0;

    for (const prefix of prefixes) {
      try {
        const items = await kv.getByPrefix(prefix);
        if (items && items.length > 0) {
          for (const item of items) {
            try {
              const possibleKeys = [
                `${prefix}${item.id}`,
                item.id,
                item.key,
              ];

              for (const possibleKey of possibleKeys) {
                if (possibleKey) {
                  await kv.del(possibleKey);
                  totalDeleted++;
                }
              }
            } catch (delError) {
              // Silent fail
            }
          }
        }
      } catch (prefixError) {
        // Silent fail
      }
    }

    return totalDeleted;
  }
}
