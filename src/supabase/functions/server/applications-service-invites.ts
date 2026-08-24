/**
 * Inviting applicants and re-sending invitations.
 * One slice of the admin applications service — the AdminApplicationsService
 * facade in applications-service.ts binds these as its static methods.
 */
import * as kv from './kv_store.tsx';
import { sendApplicationInviteEmail } from './email-service.ts';
import { AdminClientOnboardingService } from './admin-client-onboarding-service.ts';
import { generateApplicationNumber } from './application-number-utils.ts';
import type { ApplicationData } from './types.ts';

import { createModuleLogger } from './stderr-logger.ts';
import type { KvApplication } from './applications-types.ts';
import { createServiceClient } from './applications-service-helpers.ts';

const log = createModuleLogger('admin-applications-service');

/**
 * Invite a prospective client to create a Navigate Wealth account.
 *
 * 1. Create Supabase Auth user (email confirmed, random temp password)
 * 2. Generate a password-recovery link for the invitee to set their password
 * 3. Create a KV application record with status `invited`
 * 4. Send the invitation email via the `application_invite` template
 */
export async function inviteApplicant(
  input: { email: string; firstName: string; lastName: string; cellphoneNumber?: string },
  adminUserId: string,
  origin?: string,
): Promise<{
  success: boolean;
  applicationId?: string;
  applicationNumber?: string;
  error?: string;
  errorCode?: string;
}> {
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
      return {
        success: false,
        error: `A user with email ${email} already exists`,
        errorCode: 'EMAIL_EXISTS',
      };
    }
    return {
      success: false,
      error: userError?.message || 'Failed to create user account',
      errorCode: 'AUTH_ERROR',
    };
  }

  const userId = userData.user.id;
  log.info('Auth user created for invited applicant');

  // 2. Create application record
  const applicationNumber = await generateApplicationNumber();
  const applicationId = crypto.randomUUID();
  const now = new Date().toISOString();

  const applicationData = {
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
  } as unknown as ApplicationData;

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
export async function resendInvite(
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
    return {
      success: false,
      error: 'Failed to generate a new setup link. The recovery token could not be created.',
    };
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
    return {
      success: false,
      error:
        'Setup link generated but the email could not be sent. Check email service configuration.',
    };
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
