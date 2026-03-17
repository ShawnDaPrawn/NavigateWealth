/**
 * Admin Client Onboarding Service
 * Handles business logic for admin-initiated client creation (single & bulk).
 *
 * The flow mirrors the self-service signup, creating identical data structures
 * so the existing approval pipeline works without modification.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import * as kv from './kv_store.tsx';
import { generateApplicationNumber } from './application-number-utils.ts';
import { createModuleLogger } from './stderr-logger.ts';

const log = createModuleLogger('admin-onboarding');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AdminAddClientInput {
  // Required
  firstName: string;
  lastName: string;
  emailAddress: string;
  cellphoneNumber: string;

  // Optional — mirrors ApplicationData
  title?: string;
  middleName?: string;
  preferredName?: string;
  dateOfBirth?: string;
  gender?: string;
  nationality?: string;
  idType?: 'sa_id' | 'passport' | '';
  idNumber?: string;
  taxNumber?: string;
  isSATaxResident?: boolean | null;
  maritalStatus?: string;
  maritalRegime?: string;
  numberOfDependants?: string;

  spouseFirstName?: string;
  spouseLastName?: string;
  spouseDateOfBirth?: string;
  spouseEmployed?: string;

  alternativeEmail?: string;
  alternativeCellphone?: string;
  whatsappNumber?: string;
  preferredContactMethod?: string;
  bestTimeToContact?: string;
  residentialAddressLine1?: string;
  residentialAddressLine2?: string;
  residentialSuburb?: string;
  residentialCity?: string;
  residentialProvince?: string;
  residentialPostalCode?: string;
  residentialCountry?: string;

  employmentStatus?: string;
  jobTitle?: string;
  employerName?: string;
  industry?: string;
  selfEmployedCompanyName?: string;
  selfEmployedIndustry?: string;
  selfEmployedDescription?: string;
  grossMonthlyIncome?: string;
  monthlyExpensesEstimate?: string;

  accountReasons?: string[];
  otherReason?: string;
  financialGoals?: string;
  urgency?: string;
  existingProducts?: string[];

  // Admin consent confirmation
  adminConsentConfirmed?: boolean;
}

export interface AddClientResult {
  success: boolean;
  userId?: string;
  applicationId?: string;
  applicationNumber?: string;
  error?: string;
  errorCode?: string;
}

export interface BulkAddResult {
  total: number;
  succeeded: number;
  failed: number;
  results: Array<{
    row: number;
    email: string;
    name: string;
    status: 'success' | 'failed' | 'skipped';
    userId?: string;
    applicationNumber?: string;
    error?: string;
  }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
}

function generateTempPassword(): string {
  // 24-char random password — the client never sees this; they set their own via the recovery link
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*';
  let pw = '';
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  for (const byte of arr) {
    pw += chars[byte % chars.length];
  }
  return pw;
}

/**
 * Validate a single client input. Returns an array of error messages (empty = valid).
 */
export function validateClientInput(input: AdminAddClientInput): string[] {
  const errors: string[] = [];

  if (!input.firstName?.trim()) errors.push('First name is required');
  if (!input.lastName?.trim()) errors.push('Last name is required');
  if (!input.emailAddress?.trim()) errors.push('Email address is required');
  if (
    input.emailAddress?.trim() &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.emailAddress.trim())
  ) {
    errors.push('Invalid email address format');
  }
  if (!input.cellphoneNumber?.trim()) errors.push('Cellphone number is required');

  // SA ID validation if provided
  if (input.idType === 'sa_id' && input.idNumber?.trim() && !/^\d{13}$/.test(input.idNumber.trim())) {
    errors.push('SA ID number must be exactly 13 digits');
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Core Service
// ---------------------------------------------------------------------------

export class AdminClientOnboardingService {
  /**
   * Add a single client.
   *
   * 1. Create Supabase Auth user (email pre-confirmed, random temp password)
   * 2. Create KV application record (status: submitted, origin: admin_import)
   * 3. Create KV profile skeleton
   */
  static async addClient(
    input: AdminAddClientInput,
    adminUserId: string,
  ): Promise<AddClientResult> {
    const supabase = createServiceClient();
    const email = input.emailAddress.trim().toLowerCase();
    const firstName = input.firstName.trim();
    const lastName = input.lastName.trim();

    // 1. Create user in Supabase Auth
    log.info('Creating user account for admin-onboarded client');

    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email,
      password: generateTempPassword(),
      email_confirm: true, // Admin vouches for the email — skip verification
      user_metadata: {
        firstName,
        surname: lastName,
        fullName: `${firstName} ${lastName}`,
        countryCode: '+27',
        phoneNumber: input.cellphoneNumber?.trim() || '',
        accountType: 'Personal Client',
        accountStatus: 'submitted_for_review',
        origin: 'admin_import',
        mustSetPassword: true,
        mustAcceptTerms: true,
        onboardedBy: adminUserId,
        onboardedAt: new Date().toISOString(),
      },
    });

    if (userError || !userData?.user) {
      // Duplicate email
      if (
        userError?.status === 422 ||
        userError?.message?.includes('already been registered') ||
        (userError as Error & { code?: string })?.code === 'email_exists'
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
    log.info('Auth user created for admin-onboarded client');

    // 2. Create application record
    const applicationNumber = await generateApplicationNumber();
    const applicationId = crypto.randomUUID();
    const now = new Date().toISOString();

    const applicationData: Record<string, unknown> = {
      // Personal
      title: input.title || '',
      firstName,
      middleName: input.middleName || '',
      preferredName: input.preferredName || '',
      lastName,
      dateOfBirth: input.dateOfBirth || '',
      gender: input.gender || '',
      nationality: input.nationality || 'South Africa',
      idType: input.idType || '',
      idNumber: input.idNumber || '',
      taxNumber: input.taxNumber || '',
      isSATaxResident: input.isSATaxResident ?? null,
      maritalStatus: input.maritalStatus || '',
      maritalRegime: input.maritalRegime || '',
      numberOfDependants: input.numberOfDependants || '',

      // Spouse
      spouseFirstName: input.spouseFirstName || '',
      spouseLastName: input.spouseLastName || '',
      spouseDateOfBirth: input.spouseDateOfBirth || '',
      spouseEmployed: input.spouseEmployed || '',

      // Contact
      emailAddress: email,
      alternativeEmail: input.alternativeEmail || '',
      cellphoneNumber: input.cellphoneNumber?.trim() || '',
      alternativeCellphone: input.alternativeCellphone || '',
      whatsappNumber: input.whatsappNumber || '',
      preferredContactMethod: input.preferredContactMethod || '',
      bestTimeToContact: input.bestTimeToContact || '',
      residentialAddressLine1: input.residentialAddressLine1 || '',
      residentialAddressLine2: input.residentialAddressLine2 || '',
      residentialSuburb: input.residentialSuburb || '',
      residentialCity: input.residentialCity || '',
      residentialProvince: input.residentialProvince || '',
      residentialPostalCode: input.residentialPostalCode || '',
      residentialCountry: input.residentialCountry || 'South Africa',

      // Employment
      employmentStatus: input.employmentStatus || '',
      jobTitle: input.jobTitle || '',
      employerName: input.employerName || '',
      industry: input.industry || '',
      selfEmployedCompanyName: input.selfEmployedCompanyName || '',
      selfEmployedIndustry: input.selfEmployedIndustry || '',
      selfEmployedDescription: input.selfEmployedDescription || '',
      grossMonthlyIncome: input.grossMonthlyIncome || '',
      monthlyExpensesEstimate: input.monthlyExpensesEstimate || '',

      // Services
      accountReasons: input.accountReasons || [],
      otherReason: input.otherReason || '',
      financialGoals: input.financialGoals || '',
      urgency: input.urgency || '',
      existingProducts: input.existingProducts || [],

      // Terms — NOT signed by admin; client must accept on first login
      termsAccepted: false,
      popiaConsent: false,
      disclosureAcknowledged: false,
      faisAcknowledged: false,
      electronicCommunicationConsent: false,
      communicationConsent: false,
      signatureFullName: '',

      // Account type
      accountType: 'Personal Client',
    };

    const application = {
      id: applicationId,
      application_number: applicationNumber,
      user_id: userId,
      status: 'submitted', // Immediately reviewable by admin
      origin: 'admin_import',
      onboarded_by: adminUserId,
      created_at: now,
      updated_at: now,
      submitted_at: now,
      reviewed_at: null,
      reviewed_by: null,
      review_notes: null,
      application_data: applicationData,
    };

    await kv.set(`application:${applicationId}`, application);
    log.info('Application created for admin-onboarded client');

    // 3. Create profile skeleton
    const defaultProfile = {
      profileType: 'personal',
      userId,
      role: 'client',
      accountType: 'personal',
      accountStatus: 'submitted_for_review',
      applicationStatus: 'submitted',
      applicationNumber,
      applicationId,
      adviserAssigned: false,
      origin: 'admin_import',
      personalInformation: {
        title: input.title || '',
        firstName,
        middleName: input.middleName || '',
        lastName,
        dateOfBirth: input.dateOfBirth || '',
        gender: input.gender || '',
        nationality: input.nationality || 'South Africa',
        taxNumber: input.taxNumber || '',
        maritalStatus: input.maritalStatus || '',
        maritalRegime: input.maritalRegime || '',
        grossIncome: 0,
        netIncome: 0,
        email,
        cellphone: input.cellphoneNumber?.trim() || '',
        identityDocuments: [],
      },
      metadata: {
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        onboardedBy: adminUserId,
      },
    };

    await kv.set(`user_profile:${userId}:personal_info`, defaultProfile);
    log.info('Profile skeleton created for admin-onboarded client');

    return {
      success: true,
      userId,
      applicationId,
      applicationNumber,
    };
  }

  /**
   * Bulk add clients. Processes sequentially to avoid rate limits
   * and ensure sequential application numbers.
   */
  static async bulkAddClients(
    clients: AdminAddClientInput[],
    adminUserId: string,
  ): Promise<BulkAddResult> {
    const MAX_BATCH_SIZE = 50;

    if (clients.length > MAX_BATCH_SIZE) {
      return {
        total: clients.length,
        succeeded: 0,
        failed: clients.length,
        results: [{
          row: 0,
          email: '',
          name: '',
          status: 'failed',
          error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE}. Please split your upload.`,
        }],
      };
    }

    const results: BulkAddResult['results'] = [];
    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < clients.length; i++) {
      const client = clients[i];
      const rowNum = i + 1;
      const email = client.emailAddress?.trim() || '';
      const name = `${client.firstName || ''} ${client.lastName || ''}`.trim();

      // Validate first
      const validationErrors = validateClientInput(client);
      if (validationErrors.length > 0) {
        failed++;
        results.push({
          row: rowNum,
          email,
          name,
          status: 'failed',
          error: validationErrors.join('; '),
        });
        continue;
      }

      try {
        const result = await AdminClientOnboardingService.addClient(client, adminUserId);

        if (result.success) {
          succeeded++;
          results.push({
            row: rowNum,
            email,
            name,
            status: 'success',
            userId: result.userId,
            applicationNumber: result.applicationNumber,
          });
        } else {
          // Duplicate email → mark as skipped rather than failed
          const status = result.errorCode === 'EMAIL_EXISTS' ? 'skipped' as const : 'failed' as const;
          if (status === 'skipped') {
            // Don't count skips as failures
          } else {
            failed++;
          }
          results.push({
            row: rowNum,
            email,
            name,
            status,
            error: result.error,
          });
        }
      } catch (err) {
        failed++;
        results.push({
          row: rowNum,
          email,
          name,
          status: 'failed',
          error: err instanceof Error ? err.message : 'Unexpected error',
        });
      }
    }

    return {
      total: clients.length,
      succeeded,
      failed,
      results,
    };
  }

  /**
   * Generate a password recovery link for a user.
   * Called during approval of admin-onboarded clients so they can
   * set their own password via email.
   *
   * @param email    The user's email address
   * @param origin   Optional origin URL (e.g. from the admin request's Origin header).
   *                 When provided the redirect goes to `${origin}/reset-password`;
   *                 otherwise falls back to the production domain.
   */
  static async generatePasswordResetLink(email: string, origin?: string): Promise<string | null> {
    try {
      const supabase = createServiceClient();

      const redirectBase = origin?.replace(/\/+$/, '') || 'https://navigatewealth.co';
      const redirectTo = `${redirectBase}/reset-password`;

      const { data, error } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: {
          redirectTo,
        },
      });

      if (error || !data?.properties?.action_link) {
        log.error('Failed to generate recovery link', error);
        return null;
      }

      return data.properties.action_link;
    } catch (err) {
      log.error('Exception generating recovery link', err as Error);
      return null;
    }
  }
}