// Authentication Security Routes
// Implements secure authentication endpoints with rate limiting, logging, and validation

import { Hono } from "npm:hono";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import * as kv from "./kv_store.tsx";
import { checkRateLimit, clearRateLimit, RATE_LIMITS } from "./rateLimiter.ts";
import { logAuthEvent } from "./authLogger.ts";
import { validatePassword, validateEmail, validatePhoneNumber, sanitizeInput } from "./passwordValidator.ts";
import { createModuleLogger } from "./stderr-logger.ts";
import { SUPER_ADMIN_EMAIL } from "./constants.ts";
import type { Context } from 'npm:hono';
import {
  extractClientIp,
  getBlockedIpAddress,
  getBlockedIpAddressWarning,
} from '../../../shared/submissions/blockedIpAddresses.ts';

const authRoutes = new Hono();
const log = createModuleLogger('auth-routes');

// Lazy Supabase client — must NOT be top-level to avoid deployment crashes in edge functions.
const getSupabase = () => createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Helper function to get client IP
function getClientIP(c: Context): string {
  return extractClientIp((headerName) => c.req.header(headerName)) || 'unknown';
}

// Helper function to get user agent
function getUserAgent(c: Context): string {
  return c.req.header('User-Agent') || 'unknown';
}

/**
 * POST /auth/signup-validate
 * Server-side signup validation with rate limiting
 * Does NOT create the user - just validates the input
 */
authRoutes.post("/signup-validate", async (c) => {
  const ip = getClientIP(c);
  const userAgent = getUserAgent(c);
  const blockedIpAddress = getBlockedIpAddress(ip);

  if (blockedIpAddress) {
    await logAuthEvent('signup_attempt', undefined, false, {
      ip,
      userAgent,
      errorMessage: getBlockedIpAddressWarning(blockedIpAddress),
    });

    return c.json({
      error: getBlockedIpAddressWarning(blockedIpAddress),
      blocked: true,
      warning: true,
      blockedIpAddress,
    }, 403);
  }
  
  try {
    const { email, password, firstName, surname, phoneNumber, countryCode } = await c.req.json();
    
    // Rate limiting - check by IP and email
    const ipRateLimit = await checkRateLimit(ip, 'signup', RATE_LIMITS.SIGNUP);
    if (!ipRateLimit.allowed) {
      await logAuthEvent('signup_attempt', email, false, {
        ip,
        userAgent,
        errorMessage: ipRateLimit.reason,
      });
      
      return c.json({ 
        error: 'Too many signup attempts. Please try again later.',
        blocked: true,
        resetAt: ipRateLimit.resetAt,
      }, 429);
    }
    
    const emailRateLimit = await checkRateLimit(email, 'signup', RATE_LIMITS.SIGNUP);
    if (!emailRateLimit.allowed) {
      await logAuthEvent('signup_attempt', email, false, {
        ip,
        userAgent,
        errorMessage: emailRateLimit.reason,
      });
      
      return c.json({ 
        error: 'Too many signup attempts. Please try again later.',
        blocked: true,
        resetAt: emailRateLimit.resetAt,
      }, 429);
    }
    
    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      await logAuthEvent('signup_attempt', email, false, {
        ip,
        userAgent,
        errorMessage: emailValidation.error,
      });
      
      return c.json({ error: emailValidation.error, field: 'email' }, 400);
    }
    
    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      await logAuthEvent('signup_attempt', email, false, {
        ip,
        userAgent,
        errorMessage: 'Weak password: ' + passwordValidation.errors.join(', '),
      });
      
      return c.json({ 
        error: 'Password does not meet security requirements',
        errors: passwordValidation.errors,
        field: 'password',
        }, 400);
    }
    
    // Validate name fields
    if (!firstName || firstName.trim().length < 1) {
      return c.json({ error: 'First name is required', field: 'firstName' }, 400);
    }
    
    if (!surname || surname.trim().length < 1) {
      return c.json({ error: 'Surname is required', field: 'surname' }, 400);
    }
    
    // Validate phone number
    if (phoneNumber) {
      const phoneValidation = validatePhoneNumber(phoneNumber, countryCode || '+27');
      if (!phoneValidation.isValid) {
        return c.json({ error: phoneValidation.error, field: 'phoneNumber' }, 400);
      }
    }
    
    // Sanitize inputs
    const sanitizedFirstName = sanitizeInput(firstName);
    const sanitizedSurname = sanitizeInput(surname);
    
    // All validations passed
    await logAuthEvent('signup_attempt', email, true, {
      ip,
      userAgent,
      metadata: { validation: 'passed' },
    });
    
    return c.json({ 
      valid: true,
      message: 'Validation passed',
      sanitized: {
        firstName: sanitizedFirstName,
        surname: sanitizedSurname,
      },
    }, 200);
    
  } catch (error) {
    await logAuthEvent('signup_attempt', undefined, false, {
      ip,
      userAgent,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
    
    return c.json({ 
      error: 'Validation failed. Please try again.',
    }, 500);
  }
});

/**
 * POST /auth/signup
 * Create a new user with admin privileges (auto-confirm email)
 * Use this for manual signup/seeding when email service is not available
 */
authRoutes.post("/signup", async (c) => {
  const ip = getClientIP(c);
  const userAgent = getUserAgent(c);
  const blockedIpAddress = getBlockedIpAddress(ip);

  if (blockedIpAddress) {
    await logAuthEvent('signup_attempt', undefined, false, {
      ip,
      userAgent,
      errorMessage: getBlockedIpAddressWarning(blockedIpAddress),
    });

    return c.json({
      error: getBlockedIpAddressWarning(blockedIpAddress),
      blocked: true,
      warning: true,
      blockedIpAddress,
    }, 403);
  }

  try {
    const { email, password, metadata } = await c.req.json();
    
    // Create user with admin client (bypasses email verification if email_confirm is true)
    const { data, error } = await getSupabase().auth.admin.createUser({
      email,
      password,
      user_metadata: metadata || {},
      email_confirm: true
    });

    if (error) {
      return c.json({ error: error.message }, 400);
    }

    if (!data.user) {
      return c.json({ error: 'Failed to create user' }, 500);
    }

    await logAuthEvent('signup_success', email, true, {
      userId: data.user.id,
      ip,
      userAgent,
      method: 'admin_create_user'
    });

    return c.json({ 
      success: true, 
      user: data.user,
      message: 'User created and verified successfully' 
    }, 200);

  } catch (error) {
    log.error('Signup error', error);
    return c.json({ error: 'Internal server error during signup' }, 500);
  }
});

/**
 * POST /auth/login-validate
 * Server-side login validation with rate limiting
 * Returns whether credentials are valid and logs the attempt
 */
authRoutes.post("/login-validate", async (c) => {
  const ip = getClientIP(c);
  const userAgent = getUserAgent(c);
  
  try {
    const { email } = await c.req.json();
    
    // Super admin email - exempt from rate limiting
    const isSuperAdmin = email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
    
    if (isSuperAdmin) {
      // Skip rate limiting for super admin
      await logAuthEvent('login_attempt', email, true, {
        ip,
        userAgent,
        metadata: { validation: 'passed', superAdmin: true },
      });
      
      return c.json({ success: true, superAdmin: true }, 200);
    }
    
    // Rate limiting - check by IP and email (only for non-super-admin users)
    const ipRateLimit = await checkRateLimit(ip, 'login', RATE_LIMITS.LOGIN);
    if (!ipRateLimit.allowed) {
      await logAuthEvent('login_attempt', email, false, {
        ip,
        userAgent,
        errorMessage: 'Rate limit exceeded',
      });
      
      // Log account locked event
      if (ipRateLimit.blocked) {
        await logAuthEvent('account_locked', email, false, {
          ip,
          userAgent,
          errorMessage: ipRateLimit.reason,
        });
      }
      
      // Generic message to prevent account enumeration
      return c.json({ 
        error: 'Too many login attempts. Please try again later.',
        blocked: true,
        resetAt: ipRateLimit.resetAt,
      }, 429);
    }
    
    const emailRateLimit = await checkRateLimit(email, 'login', RATE_LIMITS.LOGIN);
    if (!emailRateLimit.allowed) {
      await logAuthEvent('login_attempt', email, false, {
        ip,
        userAgent,
        errorMessage: 'Rate limit exceeded for email',
      });
      
      if (emailRateLimit.blocked) {
        await logAuthEvent('account_locked', email, false, {
          ip,
          userAgent,
          errorMessage: emailRateLimit.reason,
        });
      }
      
      return c.json({ 
        error: 'Too many login attempts. Please try again later.',
        blocked: true,
        resetAt: emailRateLimit.resetAt,
      }, 429);
    }
    
    // Validate email format
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      await logAuthEvent('login_attempt', email, false, {
        ip,
        userAgent,
        errorMessage: 'Invalid email format',
      });
      
      // Generic error message (no account enumeration)
      return c.json({ error: 'Invalid credentials' }, 401);
    }
    
    await logAuthEvent('login_attempt', email, true, {
      ip,
      userAgent,
      metadata: { validation: 'passed' },
    });
    
    return c.json({ valid: true }, 200);
    
  } catch (error) {
    await logAuthEvent('login_attempt', undefined, false, {
      ip,
      userAgent,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
    
    // Generic error message
    return c.json({ error: 'Invalid credentials' }, 401);
  }
});

/**
 * POST /auth/login-success
 * Called after successful login to clear rate limits and log success
 */
authRoutes.post("/login-success", async (c) => {
  const ip = getClientIP(c);
  const userAgent = getUserAgent(c);
  
  try {
    const { email, userId } = await c.req.json();
    
    // Clear rate limits for successful login
    await clearRateLimit(ip, 'login');
    await clearRateLimit(email, 'login');
    
    // Log successful login
    await logAuthEvent('login_success', email, true, {
      userId,
      ip,
      userAgent,
    });
    
    return c.json({ success: true }, 200);
    
  } catch (error) {
    log.error('Login success log error', error);
    return c.json({ error: 'Failed to log login success' }, 500);
  }
});

/**
 * POST /auth/login-failure
 * Called after failed login to log the failure
 */
authRoutes.post("/login-failure", async (c) => {
  const ip = getClientIP(c);
  const userAgent = getUserAgent(c);
  
  try {
    const { email, reason } = await c.req.json();
    
    // Log failed login
    await logAuthEvent('login_failure', email, false, {
      ip,
      userAgent,
      errorMessage: reason || 'Invalid credentials',
    });
    
    // Generic response (no account enumeration)
    return c.json({ error: 'Invalid credentials' }, 401);
    
  } catch (error) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }
});

/**
 * POST /auth/logout
 * Log user logout event
 */
authRoutes.post("/logout", async (c) => {
  const ip = getClientIP(c);
  const userAgent = getUserAgent(c);
  
  try {
    const { email, userId } = await c.req.json();
    
    await logAuthEvent('logout', email, true, {
      userId,
      ip,
      userAgent,
    });
    
    return c.json({ success: true }, 200);
    
  } catch (error) {
    log.error('Logout error', error);
    return c.json({ success: true }, 200); // Don't fail logout on logging error
  }
});

/**
 * POST /auth/password-reset-request
 * Handle password reset request with rate limiting
 */
authRoutes.post("/password-reset-request", async (c) => {
  const ip = getClientIP(c);
  const userAgent = getUserAgent(c);
  
  try {
    const { email } = await c.req.json();
    
    // Rate limiting
    const ipRateLimit = await checkRateLimit(ip, 'password_reset', RATE_LIMITS.PASSWORD_RESET);
    if (!ipRateLimit.allowed) {
      await logAuthEvent('password_reset_request', email, false, {
        ip,
        userAgent,
        errorMessage: 'Rate limit exceeded',
      });
      
      // Generic message (no account enumeration)
      return c.json({ 
        message: 'If an account exists with this email, a password reset link has been sent.',
      }, 200);
    }
    
    const emailRateLimit = await checkRateLimit(email, 'password_reset', RATE_LIMITS.PASSWORD_RESET);
    if (!emailRateLimit.allowed) {
      await logAuthEvent('password_reset_request', email, false, {
        ip,
        userAgent,
        errorMessage: 'Rate limit exceeded for email',
      });
      
      // Generic message (no account enumeration)
      return c.json({ 
        message: 'If an account exists with this email, a password reset link has been sent.',
      }, 200);
    }
    
    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      await logAuthEvent('password_reset_request', email, false, {
        ip,
        userAgent,
        errorMessage: 'Invalid email format',
      });
      
      // Generic message (no account enumeration)
      return c.json({ 
        message: 'If an account exists with this email, a password reset link has been sent.',
      }, 200);
    }
    
    // Log the request (success, but we don't reveal if account exists)
    await logAuthEvent('password_reset_request', email, true, {
      ip,
      userAgent,
    });
    
    // Generic success message (no account enumeration)
    return c.json({ 
      message: 'If an account exists with this email, a password reset link has been sent.',
      success: true,
    }, 200);
    
  } catch (error) {
    // Generic message even on error (no account enumeration)
    return c.json({ 
      message: 'If an account exists with this email, a password reset link has been sent.',
    }, 200);
  }
});

/**
 * POST /auth/password-change
 * Log password change event
 */
authRoutes.post("/password-change", async (c) => {
  const ip = getClientIP(c);
  const userAgent = getUserAgent(c);
  
  try {
    const { email, userId } = await c.req.json();
    
    await logAuthEvent('password_change', email, true, {
      userId,
      ip,
      userAgent,
    });
    
    return c.json({ success: true }, 200);
    
  } catch (error) {
    return c.json({ error: 'Failed to log password change' }, 500);
  }
});

/**
 * GET /auth/security-status
 * Get security status for admin dashboard
 * Requires admin authentication
 */
authRoutes.get("/security-status", async (c) => {
  try {
    // Check authorization
    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await getSupabase().auth.getUser(token);
    
    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    // Check if user is admin
    const userProfile = await kv.get(`user_profile:${user.id}:personal_info`);
    if (!userProfile || (userProfile.role !== 'admin' && userProfile.role !== 'super_admin' && userProfile.role !== 'super-admin')) {
      return c.json({ error: 'Forbidden - Admin access required' }, 403);
    }
    
    // Get security statistics
    const authLogger = await import('./authLogger.ts');
    const stats = await authLogger.getSecurityStats();
    
    return c.json({
      success: true,
      stats,
      timestamp: new Date().toISOString(),
    }, 200);
    
  } catch (error) {
    return c.json({ error: 'Failed to fetch security status' }, 500);
  }
});

/**
 * POST /auth/create-superadmin
 * Creates super admin account using secret key
 * This endpoint is protected by a secret key that must match SUPER_ADMIN_PASSWORD
 */
authRoutes.post("/create-superadmin", async (c) => {
  try {
    const { secretKey, email, password } = await c.req.json();
    
    // Verify secret key matches environment variable
    const expectedSecretKey = Deno.env.get('SUPER_ADMIN_PASSWORD');
    if (!expectedSecretKey) {
      return c.json({ error: 'Server configuration error' }, 500);
    }
    
    if (secretKey !== expectedSecretKey) {
      return c.json({ error: 'Invalid secret key' }, 403);
    }
    
    // Validate email and password
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      return c.json({ error: emailValidation.error }, 400);
    }
    
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return c.json({ 
        error: 'Password does not meet security requirements',
        errors: passwordValidation.errors
      }, 400);
    }
    
    // Check if user already exists
    const { data: existingUsers } = await getSupabase().auth.admin.listUsers();
    const userExists = existingUsers?.users?.some(u => u.email === email);
    
    if (userExists) {
      return c.json({ error: 'User already exists' }, 409);
    }
    
    // Create the super admin user
    const { data, error } = await getSupabase().auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        firstName: 'Shawn',
        surname: 'Admin',
        role: 'super_admin', // Changed from 'admin' to 'super_admin'
        display_name: 'Shawn Admin',
        first_name: 'Shawn',
      }
    });
    
    if (error) {
      return c.json({ error: error.message }, 400);
    }
    
    // Store admin profile in KV store
    await kv.set(`user_profile:${data.user.id}:personal_info`, {
      firstName: 'Shawn',
      surname: 'Admin',
      role: 'super_admin', // Changed from 'admin' to 'super_admin'
      email,
      createdAt: new Date().toISOString()
    });
    
    return c.json({
      success: true,
      message: 'Super admin created successfully',
      user: {
        id: data.user.id,
        email: data.user.email
      }
    }, 201);
    
  } catch (error) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST /auth/clear-rate-limit
 * Clear rate limits for a specific email (admin utility)
 * Requires secret key for access
 */
authRoutes.post("/clear-rate-limit", async (c) => {
  try {
    const { email, secretKey } = await c.req.json();
    
    // Verify secret key matches environment variable
    const expectedSecretKey = Deno.env.get('SUPER_ADMIN_PASSWORD');
    if (!expectedSecretKey) {
      return c.json({ error: 'Server configuration error' }, 500);
    }
    
    if (secretKey !== expectedSecretKey) {
      return c.json({ error: 'Invalid secret key' }, 403);
    }
    
    // Clear rate limits for this email
    await clearRateLimit(email, 'login');
    
    // Get IP address if available and clear that too
    const ip = getClientIP(c);
    if (ip && ip !== 'unknown') {
      await clearRateLimit(ip, 'login');
    }
    
    return c.json({
      success: true,
      message: 'Rate limits cleared successfully',
      email
    }, 200);
    
  } catch (error) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST /auth/ensure-dev-user
 * Development helper: Ensures a user exists and has the correct password
 * This allows "auto-fixing" of login issues in development
 */
authRoutes.post("/ensure-dev-user", async (c) => {
  try {
    const { email, password } = await c.req.json();
    
    // Only allow for specific domains or emails if needed, but for now allow all for dev fix
    // Verify secret key matches environment variable to prevent abuse
    // const expectedSecretKey = Deno.env.get('SUPER_ADMIN_PASSWORD');
    
    // Check if user exists
    const { data: { users }, error: listError } = await getSupabase().auth.admin.listUsers();
    
    if (listError) {
      return c.json({ error: listError.message }, 500);
    }
    
    const existingUser = users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
    
    if (existingUser) {
      // User exists, update password
      const { error: updateError } = await getSupabase().auth.admin.updateUserById(existingUser.id, {
        password: password,
        email_confirm: true
      });
      
      if (updateError) {
        return c.json({ error: updateError.message }, 400);
      }
      
      return c.json({ success: true, message: 'User password updated', userId: existingUser.id });
    } else {
      // User does not exist, create new user
      const { data, error: createError } = await getSupabase().auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
            firstName: 'Dev',
            surname: 'User',
            role: 'admin' // Default to admin for dev
        }
      });
      
      if (createError) {
        return c.json({ error: createError.message }, 400);
      }
      
      // Create profile
      if (data.user) {
         await kv.set(`user_profile:${data.user.id}:personal_info`, {
            firstName: 'Dev',
            surname: 'User',
            role: 'admin',
            email,
            createdAt: new Date().toISOString()
         });
      }
      
      return c.json({ success: true, message: 'User created', userId: data.user?.id });
    }
    
  } catch (error) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST /auth/confirm-email
 * WORKAROUND: Legacy users created with email_confirm:false cannot sign in
 * because Supabase returns "Invalid login credentials" for unconfirmed emails.
 * This endpoint auto-confirms the email so the frontend can retry signInWithPassword.
 * Proper fix: all new signups now use email_confirm:true (see auth-signup.ts).
 * Searchable tag: // WORKAROUND: unconfirmed-email-login-fix
 */
authRoutes.post("/confirm-email", async (c) => {
  try {
    const { email } = await c.req.json();

    if (!email) {
      return c.json({ error: 'Email is required' }, 400);
    }

    const supabase = getSupabase();

    // Find the user by email
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      log.error('Error listing users for email confirmation:', listError);
      return c.json({ error: 'Internal error' }, 500);
    }

    const user = users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (!user) {
      // Don't reveal whether the account exists (anti-enumeration)
      return c.json({ confirmed: false }, 200);
    }

    // If already confirmed, nothing to do
    if (user.email_confirmed_at) {
      return c.json({ confirmed: true, alreadyConfirmed: true }, 200);
    }

    // Confirm the email
    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      email_confirm: true,
    });

    if (updateError) {
      log.error('Error confirming email for user:', updateError);
      return c.json({ confirmed: false }, 200);
    }

    log.info('Auto-confirmed email for legacy user:', email);
    return c.json({ confirmed: true }, 200);
  } catch (error) {
    log.error('confirm-email error:', error);
    return c.json({ confirmed: false }, 200);
  }
});

export default authRoutes;
