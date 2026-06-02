/**
 * auth-admin-routes.ts — super-admin / dev-only auth utilities (Phase 7 max-lines).
 * ============================================================================
 *
 * create-superadmin, clear-rate-limit, ensure-dev-user — extracted verbatim from
 * auth-routes.ts; mounted via `authRoutes.route('/', adminAuthRoutes)`. Defines
 * its own lazy Supabase client + client-IP helper (the repo's per-module
 * pattern). Behaviour-preserving; deno check guards the move.
 */
import { Hono } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import type { Context } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { clearRateLimit } from './rateLimiter.ts';
import { validatePassword, validateEmail } from './passwordValidator.ts';
import { extractClientIp } from '../../../shared/submissions/blockedIpAddresses.ts';

const getSupabase = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

function getClientIP(c: Context): string {
  return extractClientIp((headerName) => c.req.header(headerName)) || 'unknown';
}

const adminAuthRoutes = new Hono();

adminAuthRoutes.post('/create-superadmin', async (c) => {
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
      return c.json(
        {
          error: 'Password does not meet security requirements',
          errors: passwordValidation.errors,
        },
        400,
      );
    }

    // Check if user already exists
    const { data: existingUsers } = await getSupabase().auth.admin.listUsers();
    const userExists = existingUsers?.users?.some((u) => u.email === email);

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
      },
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
      createdAt: new Date().toISOString(),
    });

    return c.json(
      {
        success: true,
        message: 'Super admin created successfully',
        user: {
          id: data.user.id,
          email: data.user.email,
        },
      },
      201,
    );
  } catch (error) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST /auth/clear-rate-limit
 * Clear rate limits for a specific email (admin utility)
 * Requires secret key for access
 */
adminAuthRoutes.post('/clear-rate-limit', async (c) => {
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

    return c.json(
      {
        success: true,
        message: 'Rate limits cleared successfully',
        email,
      },
      200,
    );
  } catch (error) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST /auth/ensure-dev-user
 * Development helper: Ensures a user exists and has the correct password
 * This allows "auto-fixing" of login issues in development
 */
adminAuthRoutes.post('/ensure-dev-user', async (c) => {
  try {
    const { email, password } = await c.req.json();

    // Only allow for specific domains or emails if needed, but for now allow all for dev fix
    // Verify secret key matches environment variable to prevent abuse
    // const expectedSecretKey = Deno.env.get('SUPER_ADMIN_PASSWORD');

    // Check if user exists
    const {
      data: { users },
      error: listError,
    } = await getSupabase().auth.admin.listUsers();

    if (listError) {
      return c.json({ error: listError.message }, 500);
    }

    const existingUser = users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

    if (existingUser) {
      // User exists, update password
      const { error: updateError } = await getSupabase().auth.admin.updateUserById(
        existingUser.id,
        {
          password: password,
          email_confirm: true,
        },
      );

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
          role: 'admin', // Default to admin for dev
        },
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
          createdAt: new Date().toISOString(),
        });
      }

      return c.json({ success: true, message: 'User created', userId: data.user?.id });
    }
  } catch (error) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default adminAuthRoutes;
