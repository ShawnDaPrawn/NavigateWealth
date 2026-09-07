/**
 * Auth Signup Handler
 * Handles user signup with automatic application creation
 */

import { Hono } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import * as kv from './kv_store.tsx';
import { validateBody } from './validate.ts';
import { PublicSignupSchema } from './auth-validation.ts';
import { validatePassword } from './passwordValidator.ts';
import { sendAdminSignupNotification } from './email-service.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { recalculateAllGroupMemberships } from './communication-repo.ts';
import { generateApplicationNumber } from './application-number-utils.ts';
import { isTrustedRedirectOrigin } from './cors-origin.ts';
import { submissionsService } from './submissions-service.ts';
import { autoSubscribeClient } from './newsletter-service.ts';
import {
  getBlockedClientIp,
  getBlockedIpAddressWarning,
} from '../../../shared/submissions/blockedIpAddresses.ts';

const app = new Hono();
const log = createModuleLogger('auth-signup');

/**
 * Where a confirmation link points when the request's `Origin` is not one we
 * recognise. Overridable so a staging deploy confirms into staging.
 *
 * Read per call rather than once at module load, for the same reason
 * create-app.ts reads its allow-list per `createApp()`: a module-level read is
 * captured before a test can stub the environment, which makes the fallback
 * branch untestable.
 */
function siteUrlFallback(): string {
  return Deno.env.get('SITE_URL') || 'https://www.navigatewealth.co';
}

// Initialize Supabase client with service role key
const getSupabaseClient = () => {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
};

/**
 * POST /signup
 * Create user account and automatically generate application
 */
app.post('/signup', validateBody(PublicSignupSchema), async (c) => {
  const blockedIpAddress = getBlockedClientIp((headerName) => c.req.header(headerName));
  if (blockedIpAddress) {
    log.warn('Blocked auth signup from abusive IP address', { blockedIpAddress });
    return c.json(
      {
        error: getBlockedIpAddressWarning(blockedIpAddress),
        warning: true,
        blockedIpAddress,
      },
      403,
    );
  }

  try {
    log.info('🔐 User signup request received');

    const body = await c.req.json();
    const { email, password, firstName, surname, countryCode, phoneNumber } = body;

    // Validate required fields
    if (!email || !password || !firstName || !surname) {
      log.error('❌ Missing required fields');
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Password strength, on the route that is actually reachable.
    //
    // `POST /auth/signup` in auth-routes.ts has run `validatePassword` for a
    // long time — but nothing calls it. The SPA posts here, and here the
    // password went straight to `admin.createUser`: `PublicSignupSchema` asks
    // only for `.min(1)`. So the 12-character, 3-of-4-character-class rule that
    // SignupPage.tsx shows in its live strength meter, and blocks its own submit
    // button on, was enforced by the browser alone. Anything speaking to this
    // endpoint directly — curl, a stale build, a script — could set a
    // one-character password on a real client account.
    //
    // SignupPage.tsx cannot import this module — `no-spa-edge-source` forbids
    // SPA code from importing Edge Function source — so it keeps its own copy of
    // the rules in src/utils/auth/passwordValidation.ts. When this check was
    // added the two had already drifted: 4 of 14 realistic passwords were shown
    // "✓ Very strong password" by the meter and refused here. Both were fixed to
    // the same rule set, and passwordValidator.agreement.test.ts fails the build
    // if they part again.
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      // Do not log the password or any part of it — only why it was refused.
      log.warn('Signup rejected: password does not meet requirements', {
        failures: passwordValidation.errors.length,
      });
      return c.json(
        {
          // Both callers (SignupPage.tsx, authService.ts) surface `error` as the
          // message the person reads, so the specifics belong in it. `errors`
          // stays separately available for anything wanting them structured.
          error: `Password does not meet security requirements: ${passwordValidation.errors.join('; ')}`,
          errors: passwordValidation.errors,
          field: 'password',
        },
        400,
      );
    }

    const supabase = getSupabaseClient();

    // Create user in Supabase Auth with email verification required
    log.info('👤 Creating user account:', email);
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email,
      password,
      // Email ownership must be PROVEN before the account can sign in.
      //
      // This was `true` — the account was created already-confirmed and the
      // verification email sent immediately below was decorative: anyone could
      // sign up with an address they do not own and log straight in. (Worse,
      // `auth.resend({ type: 'signup' })` has nothing to send for an
      // already-confirmed user, so that call was failing into the warn-only
      // catch below and no verification mail was going out at all.)
      //
      // The comment this replaces said "an email server hasn't been
      // configured". That has not been true for a long time — this function
      // sends 2FA codes, e-sign notifications and admin alerts through
      // email-service.ts, and the resend call below is what now delivers the
      // confirmation link.
      //
      // The SPA already expects this: authService.ts returns
      // `session: null, // No session until email is verified` and
      // SignupPage.tsx routes to /verify-email rather than logging the user in.
      // Only this flag disagreed with that contract.
      //
      // Escape hatch for a client who genuinely cannot receive the mail:
      // POST /auth/confirm-email (super-admin only, writes an admin audit
      // record). Existing users are unaffected — they already carry
      // `email_confirmed_at` and keep signing in exactly as before.
      email_confirm: false,
      user_metadata: {
        firstName,
        surname,
        fullName: `${firstName} ${surname}`,
        countryCode: countryCode || '+27',
        phoneNumber: phoneNumber || '',
        accountType: 'Personal Client', // Default for public signups
        accountStatus: 'no_application', // NEW: Initial status - user hasn't selected account type yet
      },
    });

    if (userError || !userData.user) {
      // Check for existing user error
      if (
        (userError?.status === 422 &&
          (userError as Error & { code?: string }).code === 'email_exists') ||
        userError?.message?.includes('already been registered')
      ) {
        log.warn('⚠️ User already exists:', { email });
        return c.json(
          {
            error: 'An account with this email already exists. Please sign in.',
            code: 'EMAIL_EXISTS',
          },
          409,
        );
      }

      log.error('❌ Failed to create user:', userError);
      return c.json({ error: userError?.message || 'Failed to create user account' }, 400);
    }

    const userId = userData.user.id;
    log.info('✅ User created:', { userId });

    // Send the verification email explicitly: the admin API never sends one,
    // whatever `email_confirm` is set to.
    //
    // This send is now load-bearing rather than decorative. With
    // `email_confirm: false` above, this link is the ONLY thing that turns the
    // new account into one that can sign in, so a failure here is a person who
    // cannot get in — hence error-level logging rather than a warning nobody
    // reads. It is still non-fatal: the account and its application record are
    // real, and LoginPage.tsx offers "Resend verification email" against the
    // sign-in error, so the person recovers without support involvement.
    try {
      // `Origin` is attacker-controlled, and this URL is where the
      // confirmation link lands — with the session token in its fragment. An
      // unrecognised origin is therefore replaced with the canonical site URL
      // rather than trusted, so a signup POSTed with `Origin: evil.example`
      // cannot redirect a real client's confirmation into someone else's page.
      // (Supabase also allow-lists redirect URLs project-side; this is the
      // half we control and can test.) See isTrustedRedirectOrigin.
      const requestOrigin = c.req.header('origin');
      const origin = isTrustedRedirectOrigin(requestOrigin) ? requestOrigin! : siteUrlFallback();
      if (requestOrigin && origin !== requestOrigin) {
        log.warn('Signup Origin is not allow-listed — using canonical site URL', {
          requestOrigin,
        });
      }
      const redirectTo = `${origin}/auth/callback`;

      log.info('📧 Sending verification email to:', { email });
      log.info('🔗 Redirect URL:', { redirectTo });

      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: redirectTo,
        },
      });

      if (resendError) {
        log.error('❌ Failed to send verification email — user cannot sign in until resent:', {
          error: String(resendError),
        });
      } else {
        log.info('✅ Verification email sent successfully');
      }
    } catch (emailErr) {
      log.error('❌ Exception sending verification email — user cannot sign in until resent:', {
        error: String(emailErr),
      });
    }

    // Generate Application Number
    const applicationNumber = await generateApplicationNumber();
    log.info('📋 Generated application number:', { applicationNumber });

    // Create application record
    const applicationId = crypto.randomUUID();
    const now = new Date().toISOString();

    const application = {
      id: applicationId,
      application_number: applicationNumber,
      user_id: userId,
      status: 'draft', // Draft status - user hasn't started application yet
      currentStep: 1,
      stepsCompleted: [],
      origin: 'self_service',
      created_at: now,
      updated_at: now,
      submitted_at: null, // Not submitted yet
      reviewed_at: null,
      reviewed_by: null,
      review_notes: null,
      application_data: {
        firstName,
        lastName: surname,
        emailAddress: email,
        cellphoneNumber: `${countryCode || '+27'}${phoneNumber || ''}`,
        accountType: 'Personal Client',
        // Other fields will be filled by user during application process
      },
    };

    // Save application to KV store
    await kv.set(`application:${applicationId}`, application);
    log.info('✅ Application created with status: draft');

    // Save application number to user profile (for "Other" tab)
    // Create default user profile with proper structure
    const defaultProfile = {
      profileType: 'personal',
      userId: userId,
      role: 'client', // Default role for new signups
      accountType: 'personal',
      accountStatus: 'no_application', // NEW: User must verify email, login, then select account type
      applicationStatus: 'draft', // DEPRECATED: Linked to application status
      applicationNumber: applicationNumber, // Store in "Other" tab
      applicationId: applicationId, // Link to application
      adviserAssigned: false, // Will be assigned by admin
      personalInformation: {
        title: '',
        firstName: firstName,
        middleName: '',
        lastName: surname,
        dateOfBirth: '',
        gender: '',
        nationality: 'South Africa',
        taxNumber: '',
        maritalStatus: 'single',
        maritalRegime: '',
        grossIncome: 0,
        netIncome: 0,
        email: email,
        cellphone: `${countryCode || '+27'}${phoneNumber || ''}`,
        identityDocuments: [],
      },
      metadata: {
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    };

    // Save to the profile key used by the system
    await kv.set(`user_profile:${userId}:personal_info`, defaultProfile);
    log.info('✅ User profile created with application number in Other tab');

    // Auto-subscribe client to newsletter (fire-and-forget, §12.3)
    autoSubscribeClient(email, firstName, surname).catch((err) => {
      log.warn('Auto-subscribe newsletter failed (non-blocking)', { error: String(err) });
    });

    // Create a submission to notify admin of the new signup (appears in Submissions inbox)
    try {
      await submissionsService.create({
        type: 'client_signup',
        sourceChannel: 'client_portal',
        payload: {
          userId,
          applicationId,
          applicationNumber,
          accountType: 'Personal Client',
          applicationStatus: 'draft',
          cellphone: `${countryCode || '+27'}${phoneNumber || ''}`,
          signupTimestamp: now,
        },
        submitterName: `${firstName} ${surname}`,
        submitterEmail: email,
      });
      log.info('✅ Client signup submission created for admin inbox');
    } catch (submissionError) {
      log.error('Failed to create signup submission (non-blocking):', submissionError);
      // Non-blocking — signup should not fail if submission creation fails
    }

    // Send admin notification email
    try {
      log.info('📧 Sending signup notification email to admin...');

      const _cellphone = `${countryCode || '+27'}${phoneNumber || ''}`;

      await sendAdminSignupNotification({
        userEmail: email,
        userName: `${firstName} ${surname}`,
        timestamp: now,
      });
    } catch (emailError) {
      log.error('❌ Error sending admin notification email:', emailError);
      // Don't fail the signup if notification fails
    }

    // Recalculate group memberships in background
    // Fire and forget - don't wait for it
    (async () => {
      try {
        log.info('👥 Triggering group membership recalculation in background...');
        await recalculateAllGroupMemberships();
      } catch (groupError) {
        log.error('❌ Error recalculating group memberships:', groupError);
        // Don't fail the signup if group membership recalculation fails
      }
    })();

    // Return success with user and application data
    return c.json({
      success: true,
      user: {
        id: userId,
        email: userData.user.email,
      },
      application: {
        id: applicationId,
        application_number: applicationNumber,
        status: 'draft',
      },
    });
  } catch (error: unknown) {
    log.error('❌ Signup error:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error during signup',
      },
      500,
    );
  }
});

export default app;
