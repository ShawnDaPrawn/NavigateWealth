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
import { listAllAuthUsers } from './auth-admin-list-users.ts';
import {
  buildSignInAlias,
  normalizeEmail,
  readSharedEmailLink,
  type SharedEmailLink,
} from './client-email-identity.ts';
import { isSuperAdminEmail } from './constants.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import { isPersonnelAuthUser } from './client-management-visibility.ts';

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

  // ── Shared mailbox (household) ────────────────────────────────────────────
  /**
   * The admin has confirmed this client legitimately shares another person's
   * inbox — a minor on a parent's address, a spouse without their own. The
   * client is created against a derived sign-in alias so the mailbox stays
   * free for the person who owns it, and all mail still routes to
   * `emailAddress`.
   */
  emailIsShared?: boolean;
  /** The client who owns the mailbox, when the admin identified one. */
  sharedEmailOwnerUserId?: string;
  /** "Child", "Spouse", "Dependant", … — free text, shown on the profile. */
  relationshipToEmailOwner?: string;
}

export interface AddClientResult {
  success: boolean;
  userId?: string;
  applicationId?: string;
  applicationNumber?: string;
  error?: string;
  errorCode?: string;
  /** Set when the client was created against a derived sign-in alias. */
  signInEmail?: string;
  /** Set when the client shares another person's inbox. */
  contactEmail?: string;
  /**
   * On EMAIL_EXISTS: who already holds the address. The admin needs this to
   * decide between "same person, already onboarded" and "different person,
   * shared household mailbox" — the two cases are indistinguishable from the
   * error alone, and guessing wrong either duplicates a client or blocks one.
   */
  conflictingClient?: { id: string; name: string; email: string; isClient: boolean };
}

/** Outcome of re-keying an existing client onto a derived sign-in alias. */
export interface LinkSharedMailboxResult {
  success: boolean;
  userId?: string;
  /** The inbox the client stays reachable at. */
  contactEmail?: string;
  /** The derived address the client would now sign in with. */
  signInEmail?: string;
  /** The address released for its owner — the point of the operation. */
  freedEmail?: string;
  /** True when the client was already linked and nothing changed. */
  alreadyLinked?: boolean;
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
    /** Present when the row was created against a derived sign-in alias. */
    signInEmail?: string;
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
  if (input.emailAddress?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.emailAddress.trim())) {
    errors.push('Invalid email address format');
  }
  if (!input.cellphoneNumber?.trim()) errors.push('Cellphone number is required');

  // SA ID validation if provided
  if (
    input.idType === 'sa_id' &&
    input.idNumber?.trim() &&
    !/^\d{13}$/.test(input.idNumber.trim())
  ) {
    errors.push('SA ID number must be exactly 13 digits');
  }

  return errors;
}

/** Is this Supabase Auth failure the "that address is taken" one? */
function isDuplicateEmailError(err: unknown): boolean {
  const e = err as (Error & { status?: number; code?: string }) | null;
  if (!e) return false;
  return (
    e.status === 422 ||
    e.code === 'email_exists' ||
    (typeof e.message === 'string' && e.message.includes('already been registered'))
  );
}

/**
 * Look up who already holds an address.
 *
 * Only ever called on the duplicate-email error path, so the full-table scan
 * costs nothing on the happy path. Supabase Auth has no server-side filter on
 * email for `admin.listUsers`, which is why this pages the whole list rather
 * than issuing a query.
 */
async function findAuthUserByEmail(
  supabase: ReturnType<typeof createServiceClient>,
  email: string,
): Promise<{ id: string; name: string; email: string; isClient: boolean } | null> {
  try {
    const users = (await listAllAuthUsers(supabase)) as Array<{
      id?: string;
      email?: string;
      user_metadata?: Record<string, unknown>;
    }>;

    const match = users.find((u) => normalizeEmail(u?.email) === normalizeEmail(email));
    if (!match?.id) return null;

    const meta = match.user_metadata ?? {};
    const name =
      (typeof meta.fullName === 'string' && meta.fullName.trim()) ||
      [meta.firstName, meta.surname]
        .filter((v) => typeof v === 'string' && v)
        .join(' ')
        .trim() ||
      match.email ||
      'an existing client';

    return {
      id: match.id,
      name,
      email: normalizeEmail(match.email),
      // Whether the caller may offer to re-key this holder. Staff and the super
      // admin hold their addresses for authorization reasons, so the UI must not
      // present "free this address" against them.
      isClient: await isRekeyableClient({ id: match.id, email: match.email, user_metadata: meta }),
    };
  } catch (err) {
    log.error('Failed to resolve the holder of a duplicate email', err as Error);
    return null;
  }
}

/**
 * May this account be moved onto a derived sign-in alias?
 *
 * Only clients. Re-keying an adviser or admin would change the login of a staff
 * member the admin never meant to touch, and the super admin's address is the
 * allowlist that `isSuperAdminEmail` checks — moving it would revoke their own
 * access. Personnel are identified the same way Client Management identifies
 * them, from the `personnel:profile:` rows rather than from client-editable
 * `user_metadata` alone.
 */
async function isRekeyableClient(user: {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}): Promise<boolean> {
  if (isSuperAdminEmail(user.email)) return false;

  const personnelProfiles = (await kv.getByPrefix('personnel:profile:')) as Array<
    Record<string, unknown>
  >;
  const personnelIds = new Set<string>(
    personnelProfiles.map((p) => p?.id as string).filter(Boolean),
  );

  return !isPersonnelAuthUser(user, personnelIds);
}

/**
 * How many alias candidates to try before giving up.
 *
 * Each attempt is one round trip, and a collision only happens when two clients
 * on the same mailbox slugify identically (two "Charlotte Wood"s). Five is far
 * past any real household and still bounds the failure case.
 */
const MAX_ALIAS_ATTEMPTS = 5;

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
    const email = normalizeEmail(input.emailAddress);
    const firstName = input.firstName.trim();
    const lastName = input.lastName.trim();

    // The address the admin typed is always the CONTACT address. It is only
    // also the sign-in identity when this client owns the mailbox; a shared
    // household mailbox gets a derived alias so the owner keeps the real one.
    const isShared = input.emailIsShared === true;
    const sharedLink: SharedEmailLink | null = isShared
      ? {
          contactEmail: email,
          signInEmail: '', // filled in once an alias is accepted
          ownerUserId: input.sharedEmailOwnerUserId || undefined,
          relationship: input.relationshipToEmailOwner?.trim() || undefined,
          linkedAt: new Date().toISOString(),
          linkedBy: adminUserId,
        }
      : null;

    // 1. Create user in Supabase Auth
    log.info('Creating user account for admin-onboarded client', { sharedMailbox: isShared });

    const metadata = {
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
      // Descriptive only. `user_metadata` is editable by the account holder, so
      // nothing may branch on these — `resolveContactEmail` reads the KV profile
      // instead. They are here so the auth table stays readable to a human
      // debugging why an account signs in with an alias. (See AGENTS.md on the
      // route gate that trusted `user_metadata.role` and let any signed-in user
      // through an admin-only check.)
      contactEmail: email,
      emailIsShared: isShared,
      ...(isShared && input.sharedEmailOwnerUserId
        ? { sharedEmailOwnerUserId: input.sharedEmailOwnerUserId }
        : {}),
    };

    let userId = '';
    let signInEmail = email;
    let lastError: (Error & { status?: number; code?: string }) | null = null;

    // One attempt when the client owns the mailbox; up to MAX_ALIAS_ATTEMPTS
    // when it is shared, because a second Charlotte on the same address would
    // slugify onto the first one's alias.
    const attempts = isShared ? MAX_ALIAS_ATTEMPTS : 1;

    for (let attempt = 0; attempt < attempts; attempt++) {
      const candidate = isShared ? buildSignInAlias(email, firstName, lastName, attempt) : email;

      if (!candidate) {
        return {
          success: false,
          error: `Could not derive a sign-in address from ${email}`,
          errorCode: 'ALIAS_ERROR',
        };
      }

      const { data: userData, error: userError } = await supabase.auth.admin.createUser({
        email: candidate,
        password: generateTempPassword(),
        email_confirm: true, // Admin vouches for the email — skip verification
        user_metadata: metadata,
      });

      if (!userError && userData?.user) {
        userId = userData.user.id;
        signInEmail = candidate;
        break;
      }

      lastError = (userError as Error & { status?: number; code?: string }) ?? null;

      // Only a duplicate is worth another candidate — any other auth failure
      // will repeat identically, and retrying it just burns round trips.
      if (!isDuplicateEmailError(userError)) break;
    }

    if (!userId) {
      if (isDuplicateEmailError(lastError)) {
        if (isShared) {
          return {
            success: false,
            error: `Could not derive a free sign-in address from ${email} after ${MAX_ALIAS_ATTEMPTS} attempts`,
            errorCode: 'EMAIL_EXISTS',
          };
        }

        const holder = await findAuthUserByEmail(supabase, email);
        return {
          success: false,
          error: `A user with email ${email} already exists`,
          errorCode: 'EMAIL_EXISTS',
          ...(holder ? { conflictingClient: holder } : {}),
        };
      }

      return {
        success: false,
        error: lastError?.message || 'Failed to create user account',
        errorCode: 'AUTH_ERROR',
      };
    }

    if (sharedLink) sharedLink.signInEmail = signInEmail;

    log.info('Auth user created for admin-onboarded client', {
      derivedSignInAlias: signInEmail !== email,
    });

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

      // Household mailbox — absent for the ordinary case
      ...(sharedLink ? { sharedEmail: sharedLink } : {}),
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
      // `resolveContactEmail` reads this to route every client message to the
      // real inbox rather than to the derived sign-in alias.
      ...(sharedLink ? { sharedEmail: sharedLink } : {}),
    };

    await kv.set(`user_profile:${userId}:personal_info`, defaultProfile);
    log.info('Profile skeleton created for admin-onboarded client');

    return {
      success: true,
      userId,
      applicationId,
      applicationNumber,
      signInEmail,
      contactEmail: email,
    };
  }

  /**
   * Bulk add clients. Processes sequentially to avoid rate limits
   * and ensure sequential application numbers.
   */
  static async bulkAddClients(
    clients: AdminAddClientInput[],
    adminUserId: string,
    options?: { linkDuplicateEmails?: boolean },
  ): Promise<BulkAddResult> {
    const MAX_BATCH_SIZE = 10_000;

    if (clients.length > MAX_BATCH_SIZE) {
      return {
        total: clients.length,
        succeeded: 0,
        failed: clients.length,
        results: [
          {
            row: 0,
            email: '',
            name: '',
            status: 'failed',
            error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE}. Please split your upload.`,
          },
        ],
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
        let result = await AdminClientOnboardingService.addClient(client, adminUserId);

        // A household book routinely lists two people on one address. When the
        // admin has opted in, retry the row as a shared mailbox rather than
        // dropping the second person from the import.
        if (
          !result.success &&
          result.errorCode === 'EMAIL_EXISTS' &&
          options?.linkDuplicateEmails &&
          !client.emailIsShared
        ) {
          result = await AdminClientOnboardingService.addClient(
            {
              ...client,
              emailIsShared: true,
              sharedEmailOwnerUserId: result.conflictingClient?.id,
            },
            adminUserId,
          );
        }

        if (result.success) {
          succeeded++;
          results.push({
            row: rowNum,
            email,
            name,
            status: 'success',
            userId: result.userId,
            applicationNumber: result.applicationNumber,
            ...(result.signInEmail && result.signInEmail !== normalizeEmail(email)
              ? { signInEmail: result.signInEmail }
              : {}),
          });
        } else {
          // Duplicate email → mark as skipped rather than failed
          const status =
            result.errorCode === 'EMAIL_EXISTS' ? ('skipped' as const) : ('failed' as const);
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
   * Move an existing client onto a derived sign-in alias, freeing the mailbox.
   *
   * This is the repair for records created before the split existed: a minor
   * enrolled on a parent's address holds that address in Supabase Auth, so the
   * parent can never be onboarded. Re-keying the minor to
   * `parent+minor@example.com` releases `parent@example.com` for its owner
   * while leaving the minor reachable at the same inbox — her contact address
   * does not change, only the identity she would sign in with.
   *
   * Deliberately NOT the dual-verification flow used by
   * `security-email-change-routes.ts`: that flow mails a code to the current
   * address and to the new one, and here BOTH resolve to the guardian's inbox,
   * so the codes would prove nothing about the account being changed. The admin
   * is the authority for this operation, and the audit trail is the
   * `sharedEmail` block written to the profile.
   */
  static async linkExistingClientToSharedMailbox(
    userId: string,
    adminUserId: string,
    options?: { relationship?: string; ownerUserId?: string },
  ): Promise<LinkSharedMailboxResult> {
    const supabase = createServiceClient();

    const { data: userData, error: fetchError } = await supabase.auth.admin.getUserById(userId);
    if (fetchError || !userData?.user) {
      return { success: false, error: 'Client not found', errorCode: 'NOT_FOUND' };
    }

    const user = userData.user;
    const currentEmail = normalizeEmail(user.email);
    if (!currentEmail) {
      return { success: false, error: 'Client has no sign-in email', errorCode: 'NO_EMAIL' };
    }

    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;

    // Clients only. Re-keying an adviser or admin would silently change a staff
    // member's login, and the super admin's address IS the authorization
    // allowlist — moving it would revoke their own access. The route takes a
    // raw user id, so this gate is the only thing standing between a mistyped
    // id and either outcome.
    if (!(await isRekeyableClient({ id: userId, email: user.email, user_metadata: meta }))) {
      return {
        success: false,
        error: 'That address belongs to a staff account and cannot be re-keyed',
        errorCode: 'NOT_A_CLIENT',
      };
    }

    const profileKey = `user_profile:${userId}:personal_info`;
    const profile = (await kv.get(profileKey)) as Record<string, unknown> | null;
    const existingLink = readSharedEmailLink(profile);

    // The mailbox to preserve. When an earlier attempt re-keyed Auth but failed
    // before finishing, `currentEmail` is already the alias and the real address
    // survives only on the link — reading it back is what stops a retry from
    // recording the alias as the contact address and losing the mailbox for good.
    const contactEmail = existingLink?.contactEmail || currentEmail;

    // Fully linked: Auth agrees with the link and the mailbox is already free.
    if (existingLink && normalizeEmail(existingLink.signInEmail) === currentEmail) {
      return {
        success: true,
        alreadyLinked: true,
        userId,
        contactEmail,
        signInEmail: currentEmail,
        freedEmail: contactEmail,
      };
    }

    const pi = (profile?.personalInformation ?? {}) as Record<string, unknown>;
    const firstName =
      (typeof meta.firstName === 'string' && meta.firstName) ||
      (typeof pi.firstName === 'string' && pi.firstName) ||
      '';
    const lastName =
      (typeof meta.surname === 'string' && meta.surname) ||
      (typeof pi.lastName === 'string' && pi.lastName) ||
      '';

    const writeProfile = (link: SharedEmailLink | null) =>
      kv.set(profileKey, {
        ...(profile ?? { userId, role: 'client' }),
        personalInformation: { ...pi, email: contactEmail },
        ...(link ? { sharedEmail: link } : {}),
      });

    const baseLink: SharedEmailLink = {
      contactEmail,
      signInEmail: '',
      ownerUserId: options?.ownerUserId || undefined,
      relationship: options?.relationship?.trim() || undefined,
      linkedAt: new Date().toISOString(),
      linkedBy: adminUserId,
    };

    // Record the mailbox BEFORE touching Auth. Two writes cannot be made atomic
    // here, so the order is chosen for what survives a failure between them: a
    // link written but never used is harmless (its contact address equals the
    // unchanged sign-in address, so nothing resolves differently), whereas an
    // Auth email changed but never recorded loses the only copy of the real
    // inbox.
    try {
      await writeProfile(baseLink);
    } catch (err) {
      log.error('Failed to record the shared-mailbox link', err as Error);
      return {
        success: false,
        error: 'Could not record the mailbox link; the sign-in email was left unchanged',
        errorCode: 'PROFILE_WRITE_FAILED',
      };
    }

    // Try successive candidates: the obvious alias may itself be taken if a
    // sibling was linked first.
    let signInEmail = '';
    let lastError: (Error & { status?: number; code?: string }) | null = null;

    for (let attempt = 0; attempt < MAX_ALIAS_ATTEMPTS; attempt++) {
      const candidate = buildSignInAlias(contactEmail, firstName, lastName, attempt);
      if (!candidate) {
        lastError = Object.assign(
          new Error(`Could not derive a sign-in address from ${contactEmail}`),
          { code: 'alias_error' },
        );
        break;
      }

      const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
        email: candidate,
        email_confirm: true,
        user_metadata: {
          ...meta,
          contactEmail,
          emailIsShared: true,
          ...(options?.ownerUserId ? { sharedEmailOwnerUserId: options.ownerUserId } : {}),
        },
      });

      if (!updateError) {
        signInEmail = candidate;
        break;
      }

      lastError = updateError as Error & { status?: number; code?: string };
      if (!isDuplicateEmailError(updateError)) break;
    }

    if (!signInEmail) {
      // Auth is unchanged, so undo the marker rather than leaving a link that
      // describes a re-key that never happened.
      try {
        await writeProfile(null);
      } catch (err) {
        // Harmless if it fails: the link's contact address still equals the
        // unchanged sign-in address, so resolution is unaffected either way.
        log.warn(`Could not roll back the shared-mailbox marker: ${getErrMsg(err)}`);
      }

      const aliasFailure = (lastError as { code?: string })?.code === 'alias_error';
      return {
        success: false,
        error: lastError?.message || 'Failed to update the sign-in email',
        errorCode: aliasFailure
          ? 'ALIAS_ERROR'
          : isDuplicateEmailError(lastError)
            ? 'EMAIL_EXISTS'
            : 'AUTH_ERROR',
      };
    }

    // Finalise: the link now names the address the client actually signs in
    // with. A failure here leaves the marker in place, and the next call picks
    // the mailbox back up from it rather than from the alias.
    await writeProfile({ ...baseLink, signInEmail });

    log.info('Client re-keyed onto a shared-mailbox alias', { userId });

    return {
      success: true,
      userId,
      contactEmail,
      signInEmail,
      freedEmail: contactEmail,
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

      const redirectBase = origin?.replace(/\/+$/, '') || 'https://www.navigatewealth.co';
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
