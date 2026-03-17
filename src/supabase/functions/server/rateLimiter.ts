// Rate Limiting Middleware for Authentication Security
// Protects against brute force attacks and abuse

import * as kv from './kv_store.tsx';
import { createModuleLogger } from "./stderr-logger.ts";

const log = createModuleLogger('rate-limiter');

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
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const key = `ratelimit:${action}:${identifier}`;
  const blockKey = `ratelimit:block:${action}:${identifier}`;
  const now = Date.now();

  try {
    // Check if identifier is currently blocked
    const blockData = await kv.get(blockKey);
    if (blockData && blockData.blockedUntil > now) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(blockData.blockedUntil),
        blocked: true,
        reason: `Too many attempts. Please try again after ${new Date(blockData.blockedUntil).toLocaleTimeString()}.`,
      };
    }

    // Get current attempt data
    const attemptData = await kv.get(key);
    
    if (!attemptData) {
      // First attempt - initialize
      await kv.set(key, {
        attempts: 1,
        firstAttempt: now,
        lastAttempt: now,
      });
      
      return {
        allowed: true,
        remaining: config.maxAttempts - 1,
        resetAt: new Date(now + config.windowMs),
        blocked: false,
      };
    }

    // Check if window has expired
    const windowExpired = now - attemptData.firstAttempt > config.windowMs;
    
    if (windowExpired) {
      // Reset counter - window has expired
      await kv.set(key, {
        attempts: 1,
        firstAttempt: now,
        lastAttempt: now,
      });
      
      return {
        allowed: true,
        remaining: config.maxAttempts - 1,
        resetAt: new Date(now + config.windowMs),
        blocked: false,
      };
    }

    // Increment attempt counter
    const newAttempts = attemptData.attempts + 1;
    await kv.set(key, {
      attempts: newAttempts,
      firstAttempt: attemptData.firstAttempt,
      lastAttempt: now,
    });

    // Check if limit exceeded
    if (newAttempts > config.maxAttempts) {
      // Block the identifier
      const blockedUntil = now + config.blockDurationMs;
      await kv.set(blockKey, {
        blockedAt: now,
        blockedUntil,
        attempts: newAttempts,
      });
      
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(blockedUntil),
        blocked: true,
        reason: `Too many attempts. Account temporarily locked. Please try again after ${new Date(blockedUntil).toLocaleTimeString()}.`,
      };
    }

    // Still within limits
    const remaining = config.maxAttempts - newAttempts;
    return {
      allowed: true,
      remaining,
      resetAt: new Date(attemptData.firstAttempt + config.windowMs),
      blocked: false,
    };
  } catch (error) {
    log.error('Rate limit check failed (failing open)', error);
    // Fail open - allow request if rate limiting fails
    return {
      allowed: true,
      remaining: config.maxAttempts,
      resetAt: new Date(now + config.windowMs),
      blocked: false,
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
    log.warn('Failed to clear rate limit', error);
  }
}

/**
 * Get rate limit status without incrementing
 */
export async function getRateLimitStatus(
  identifier: string,
  action: string,
  config: RateLimitConfig
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
      allowed: true,
      remaining: config.maxAttempts,
      resetAt: new Date(now + config.windowMs),
      blocked: false,
    };
  }
}