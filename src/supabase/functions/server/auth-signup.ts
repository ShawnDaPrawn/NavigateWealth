/**
 * Auth Signup Handler
 * Handles user signup with automatic application creation
 */

import { Hono } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import * as kv from './kv_store.tsx';
import { sendAdminSignupNotification } from './email-service.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { recalculateAllGroupMemberships } from './communication-repo.ts';
import { generateApplicationNumber } from './application-number-utils.ts';
import { submissionsService } from './submissions-service.ts';

const app = new Hono();
const log = createModuleLogger('auth-signup');

// Initialize Supabase client with service role key
const getSupabaseClient = () => {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
};

/**
 * POST /signup
 * Create user account and automatically generate application
 */
app.post('/signup', async (c) => {
  try {
    log.info('🔐 User signup request received');
    
    const body = await c.req.json();
    const { email, password, firstName, surname, countryCode, phoneNumber } = body;
    
    // Validate required fields
    if (!email || !password || !firstName || !surname) {
      log.error('❌ Missing required fields');
      return c.json({ error: 'Missing required fields' }, 400);
    }
    
    const supabase = getSupabaseClient();
    
    // Create user in Supabase Auth with email verification required
    log.info('👤 Creating user account:', email);
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email,
      password,
      // Automatically confirm the user's email since an email server hasn't been configured.
      // Without this, Supabase returns "Invalid login credentials" on signInWithPassword
      // for unconfirmed users, preventing all logins after signup.
      email_confirm: true,
      user_metadata: {
        firstName,
        surname,
        fullName: `${firstName} ${surname}`,
        countryCode: countryCode || '+27',
        phoneNumber: phoneNumber || '',
        accountType: 'Personal Client', // Default for public signups
        accountStatus: 'no_application', // NEW: Initial status - user hasn't selected account type yet
      }
    });
    
    if (userError || !userData.user) {
      // Check for existing user error
      if (userError?.status === 422 && (userError as Error & { code?: string }).code === 'email_exists' || userError?.message?.includes('already been registered')) {
        log.warn('⚠️ User already exists:', email);
        return c.json({ 
          error: 'An account with this email already exists. Please sign in.',
          code: 'EMAIL_EXISTS'
        }, 409);
      }

      log.error('❌ Failed to create user:', userError);
      return c.json({ error: userError?.message || 'Failed to create user account' }, 400);
    }
    
    const userId = userData.user.id;
    log.info('✅ User created:', userId);

    // Send verification email explicitly
    // We need to do this because admin.createUser with email_confirm: false doesn't send the email automatically
    try {
      const origin = c.req.header('origin') || 'https://www.navigatewealth.co';
      const redirectTo = `${origin}/auth/callback`;
      
      log.info('📧 Sending verification email to:', email);
      log.info('🔗 Redirect URL:', redirectTo);
      
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: redirectTo
        }
      });
      
      if (resendError) {
        log.warn('⚠️ Failed to send verification email:', resendError);
        // We don't fail the request here, as the user is created. 
        // They can request a new verification email from the frontend.
      } else {
        log.info('✅ Verification email sent successfully');
      }
    } catch (emailErr) {
      log.warn('⚠️ Exception sending verification email:', emailErr);
    }
    
    // Generate Application Number
    const applicationNumber = await generateApplicationNumber();
    log.info('📋 Generated application number:', applicationNumber);
    
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
      }
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
      
      const cellphone = `${countryCode || '+27'}${phoneNumber || ''}`;
      
      await sendAdminSignupNotification({
        userEmail: email,
        userName: `${firstName} ${surname}`,
        timestamp: now
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
      }
    });
    
  } catch (error: unknown) {
    log.error('❌ Signup error:', error);
    return c.json({ 
      error: error instanceof Error ? error.message : 'Internal server error during signup' 
    }, 500);
  }
});

export default app;