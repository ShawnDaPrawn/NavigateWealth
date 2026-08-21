// Rate Limiting Middleware for Authentication Security
// Protects against brute force attacks and abuse

import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';

const log = createModuleLogger('rate-limiter');

const getSupabase = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

export interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  blockDurationMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  blocked: boolean;
  reason?: string;
}

// Predefined rate limit configurations
export const RATE_LIMITS = {
  LOGIN: {
    maxAttempts: 5, // 5 attempts
    windowMs: 15 * 60 * 1000, // per 15 minutes
    blockDurationMs: 30 * 60 * 1000, // block for 30 minutes after exceeding
  },
  SIGNUP: {
    maxAttempts: 3, // 3 attempts
    windowMs: 60 * 60 * 1000, // per hour
    blockDurationMs: 60 * 60 * 1000, // block for 1 hour
  },
  PASSWORD_RESET: {
    maxAttempts: 3, // 3 attempts
    windowMs: 60 * 60 * 1000, // per hour
    blockDurationMs: 60 * 60 * 1000, // block for 1 hour
  },
  EMAIL_VERIFICATION: {
    maxAttempts: 5, // 5 attempts
    windowMs: 60 * 60 * 1000, // per hour
    blockDurationMs: 30 * 60 * 1000, // block for 30 minutes
  },
} as const;

/**
 * Check rate limit for a specific identifier (email or IP)
 * Returns whether the request is allowed and remaining attempts
 */
export async function checkRateLimit(
  identifier: string,
  action: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const now = Date.now();

  try {
    const { data, error } = await getSupabase().rpc('check_auth_rate_limit_91ed8379', {
      p_identifier: identifier,
      p_action: action,
      p_max_attempts: config.maxAttempts,
      p_window_ms: config.windowMs,
      p_block_duration_ms: config.blockDurationMs,
    });
    if (error || !data) throw error || new Error('Empty rate-limit decision');

    const decision = data as {
      allowed: boolean;
      remaining: number;
      resetAt: number;
      blocked: boolean;
    };
    return {
      allowed: decision.allowed,
      remaining: decision.remaining,
      resetAt: new Date(decision.resetAt),
      blocked: decision.blocked,
      reason: decision.blocked
        ? `Too many attempts. Account temporarily locked. Please try again after ${new Date(decision.resetAt).toLocaleTimeString()}.`
        : undefined,
    };
  } catch (error) {
    log.error('Rate limit check failed (failing closed)', error);
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(now + config.windowMs),
      blocked: true,
      reason: 'Unable to validate request rate. Please try again later.',
    };
  }
}

/**
 * Record a successful authentication (clears rate limit)
 */
export async function clearRateLimit(identifier: string, action: string): Promise<void> {
  const key = `ratelimit:${action}:${identifier}`;
  const blockKey = `ratelimit:block:${action}:${identifier}`;

  try {
    await kv.del(key);
    await kv.del(blockKey);
  } catch (error) {
    log.warn('Failed to clear rate limit', { error: String(error) });
  }
}

/**
 * Get rate limit status without incrementing
 */
export async function getRateLimitStatus(
  identifier: string,
  action: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const key = `ratelimit:${action}:${identifier}`;
  const blockKey = `ratelimit:block:${action}:${identifier}`;
  const now = Date.now();

  try {
    // Check if blocked
    const blockData = await kv.get(blockKey);
    if (blockData && blockData.blockedUntil > now) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(blockData.blockedUntil),
        blocked: true,
        reason: 'Account temporarily locked due to too many attempts.',
      };
    }

    // Get attempt data
    const attemptData = await kv.get(key);

    if (!attemptData) {
      return {
        allowed: true,
        remaining: config.maxAttempts,
        resetAt: new Date(now + config.windowMs),
        blocked: false,
      };
    }

    const windowExpired = now - attemptData.firstAttempt > config.windowMs;

    if (windowExpired) {
      return {
        allowed: true,
        remaining: config.maxAttempts,
        resetAt: new Date(now + config.windowMs),
        blocked: false,
      };
    }

    const remaining = Math.max(0, config.maxAttempts - attemptData.attempts);
    return {
      allowed: remaining > 0,
      remaining,
      resetAt: new Date(attemptData.firstAttempt + config.windowMs),
      blocked: false,
    };
  } catch (error) {
    log.error('Rate limit status check failed', error);
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(now + config.windowMs),
      blocked: true,
      reason: 'Unable to validate request rate. Please try again later.',
    };
  }
}
