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
import {
  sendAdminSignupNotification,
  sendEmail,
  createEmailTemplate,
  getFooterSettings,
} from './email-service.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { recalculateAllGroupMemberships } from './communication-repo.ts';
import { generateApplicationNumber } from './application-number-utils.ts';
import { isTrustedRedirectOrigin } from './cors-origin.ts';
import { submissionsService } from './submissions-service.ts';
import { autoSubscribeClient } from './newsletter-service.ts';
import {
  extractClientIp,
  getBlockedClientIp,
  getBlockedIpAddressWarning,
} from '../../../shared/submissions/blockedIpAddresses.ts';
import { checkRateLimit, RATE_LIMITS } from './rateLimiter.ts';
import { escapeHtml } from './shared-validation-utils.ts';

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
 * Tell the owner of an already-registered address that someone tried to sign
 * up with it.
 *
 * This is the other half of the non-enumerating signup response: the page can
 * no longer say "you already have an account", so the information goes to the
 * one place that proves the reader is entitled to it. It carries a recovery
 * link rather than only a sign-in prompt, because the overwhelmingly common
 * cause is a real user who forgot they had registered and cannot get in.
 *
 * Never throws to the caller — see the call site. Whether this email succeeds
 * must not be observable from the signup response, or it becomes the same
 * oracle by a slower route.
 */
async function sendExistingAccountSignupNotice(
  email: string,
  origin: string,
  firstName?: string,
): Promise<void> {
  const supabase = getSupabaseClient();
  const redirectBase = origin.replace(/\/+$/, '');

  const { data: linkData } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: `${redirectBase}/reset-password` },
  });

  const actionLink = linkData?.properties?.action_link;
  const footerSettings = await getFooterSettings();

  const body = `
    <p>Someone just tried to create a Navigate Wealth account using this email address — and you already have one.</p>
    <p>If that was you, there is no need to sign up again. ${
      actionLink
        ? 'Use the button below to set a new password and sign in.'
        : `You can sign in at <a href="${redirectBase}/login">${redirectBase}/login</a>, or use "Forgot password" if you need to reset it.`
    }</p>
    <p style="color: #d97706; background-color: #fffbeb; padding: 12px; border-radius: 6px; border: 1px solid #fcd34d;">
      <strong>If it wasn't you</strong>, you can safely ignore this message — no changes have been made to your account, and nobody was told whether this address is registered.
    </p>
  `;

  // `firstName` is whatever the UNAUTHENTICATED signup payload said, and this
  // message is delivered to somebody else — the address's real owner. Left
  // raw, an attacker could inject markup into a branded Navigate Wealth email
  // and turn the notice into a phishing page addressed to a real client.
  const safeFirstName = firstName ? escapeHtml(firstName) : '';

  const html = createEmailTemplate(body, {
    title: 'You already have an account',
    subtitle: 'A sign-up was attempted with your email address',
    greeting: safeFirstName ? `Hello ${safeFirstName},` : 'Hello,',
    ...(actionLink ? { buttonUrl: actionLink, buttonLabel: 'Set a new password' } : {}),
    footerSettings,
  });

  await sendEmail({
    to: email,
    subject: 'You already have a Navigate Wealth account',
    html,
    text: [
      'Someone just tried to create a Navigate Wealth account using this email address.',
      'You already have one.',
      '',
      actionLink
        ? `Set a new password and sign in: ${actionLink}`
        : `Sign in at ${redirectBase}/login`,
      '',
      "If it wasn't you, you can safely ignore this message — nothing has changed on your account.",
    ].join('\n'),
  });
}

/**
 * POST /signup
 * Create user account and automatically generate application
 */
app.post('/signup', validateBody(PublicSignupSchema), async (c) => {
  const blockedIpAddress = getBlockedClientIp((headerName) => c.req.header(headerName));
  const ip = extractClientIp((headerName) => c.req.header(headerName)) || 'unknown';

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

    // Rate limit, on the route that is actually reachable.
    //
    // `POST /auth/signup-validate` has applied this for a long time, but it is
    // a pre-flight the SPA calls and a direct caller can simply skip — the same
    // shape of hole that `/auth/login` exists to close. It mattered less while
    // the worst outcome was an unwanted account; it matters now, because this
    // handler sends mail: an address that already exists gets a notice with a
    // freshly minted recovery link, so an unlimited caller could email-bomb a
    // known client and churn their recovery links at will. The static blocked-IP
    // list above is a denylist of known abusers, not a bound on ordinary abuse.
    //
    // Both dimensions, IP first, so spraying one address from many hosts cannot
    // exhaust that address's budget for its real owner.
    for (const [identifier, dimension] of [
      [ip, 'ip'],
      [email, 'email'],
    ] as const) {
      const limit = await checkRateLimit(identifier, 'signup', RATE_LIMITS.SIGNUP);
      if (!limit.allowed) {
        log.warn('Signup rejected: rate limit exceeded', { dimension });
        const retryAfter = Math.max(1, Math.ceil((limit.resetAt.getTime() - Date.now()) / 1000));
        c.header('Retry-After', String(retryAfter));
        return c.json(
          {
            error: 'Too many signup attempts. Please try again later.',
            blocked: true,
            resetAt: limit.resetAt,
          },
          429,
        );
      }
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
      // Address already has an account.
      //
      // WHY THIS NO LONGER SAYS SO
      // --------------------------
      // It used to answer 409 "An account with this email already exists",
      // which turns signup into an oracle: submit an address, read the status
      // code, learn whether that person banks with us. For an advisory firm
      // that is not a trivial leak — the client list IS confidential, and
      // anyone can query it from a form with no account of their own.
      //
      // The response is now byte-identical to a successful signup, and the
      // person who actually owns the address is told out-of-band, through the
      // one channel that proves ownership: their inbox. If it was them, they
      // get a useful "you already have an account, here is how to get in". If
      // it was someone probing, they learn nothing and the real owner finds
      // out that somebody tried.
      //
      // The cost is real and accepted: a user who genuinely forgot they had
      // signed up now waits for an email instead of reading it on the page.
      // That is the standard trade for this class of endpoint, and the email
      // says exactly what happened.
      if (
        (userError?.status === 422 &&
          (userError as Error & { code?: string }).code === 'email_exists') ||
        userError?.message?.includes('already been registered')
      ) {
        log.warn('⚠️ Signup attempted for an existing account', { email });

        try {
          // Same rule as the confirmation link above: this notice carries a
          // RECOVERY link, so its destination cannot come from the caller's
          // `Origin` header. Untrusted origins fall back to the canonical site.
          const requestOrigin = c.req.header('origin');
          const origin = isTrustedRedirectOrigin(requestOrigin)
            ? requestOrigin!
            : siteUrlFallback();
          await sendExistingAccountSignupNotice(email, origin, firstName);
        } catch (noticeError) {
          // Never surface this: whether the notice sent is another signal
          // about whether the account exists.
          log.warn('Could not send existing-account notice', { error: String(noticeError) });
        }

        // Byte-identical to the success path below. Any divergence here —
        // an extra field, a different message — is the oracle coming back.
        return c.json({
          success: true,
          verificationRequired: true,
          message: 'Thanks — check your email to continue.',
        });
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

    // The ONE response this endpoint gives, for a new account and for an
    // address that already had one alike.
    //
    // It used to return the new `user` and `application` here and a different
    // shape on the duplicate path. Both were 200, which looked like enough —
    // it was not: a caller could tell the two apart by whether `user` was
    // present, so the enumeration oracle survived the fix that was supposed to
    // remove it. For an advisory firm the client list is itself confidential,
    // and a "fix" that only defeats someone reading status codes is worse than
    // none, because it stops anyone looking again.
    //
    // The application number is still generated and stored; it is shown in the
    // portal once the user verifies and signs in. It is not worth a channel
    // that tells a stranger who banks here.
    return c.json({
      success: true,
      verificationRequired: true,
      message: 'Thanks — check your email to continue.',
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
