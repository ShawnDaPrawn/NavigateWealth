/**
 * Security Middleware
 * 
 * Centralized security checks for all protected routes:
 * - Account suspension enforcement
 * - Rate limiting (placeholder for future implementation)
 * - Security audit logging
 */

import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';

const log = createModuleLogger('security-middleware');

export class SecurityError extends Error {
  constructor(message: string, public statusCode: number = 403) {
    super(message);
    this.name = 'SecurityError';
  }
}

/**
 * Check if user account is suspended
 * CRITICAL: This is now the authoritative suspension check
 * Frontend should only display status, not enforce security
 */
export async function checkAccountSuspension(userId: string): Promise<void> {
  try {
    const securityData = await kv.get(`security:${userId}`);
    
    if (securityData?.suspended === true) {
      // Log suspension attempt for audit trail
      log.warn(`Suspended user attempted access`, { userId });
      
      // Record suspension access attempt
      await kv.set(`audit:suspension_attempt:${userId}:${Date.now()}`, {
        userId,
        timestamp: new Date().toISOString(),
        action: 'access_denied',
        reason: 'account_suspended',
      });
      
      throw new SecurityError('Account suspended. Please contact support.', 403);
    }
  } catch (error) {
    if (error instanceof SecurityError) {
      throw error;
    }
    // If we can't check suspension status, log but don't block
    // (fail open for availability, but log for investigation)
    log.error('Error checking suspension status', error);
  }
}

/**
 * Comprehensive security check
 * Runs all security validations for a user
 */
export async function performSecurityCheck(userId: string): Promise<void> {
  if (!userId) {
    throw new SecurityError('User ID required for security check', 401);
  }
  
  // Check account suspension
  await checkAccountSuspension(userId);
  
  // Future: Add rate limiting
  // await checkRateLimit(userId);
  
  // Future: Add IP blocking
  // await checkIPBlacklist(request);
  
  // Future: Add concurrent session limits
  // await checkConcurrentSessions(userId);
}

/**
 * Log security event for audit trail
 */
export async function logSecurityEvent(
  userId: string,
  event: string,
  details: Record<string, unknown>
): Promise<void> {
  const logKey = `audit:${event}:${userId}:${Date.now()}`;
  
  await kv.set(logKey, {
    userId,
    event,
    timestamp: new Date().toISOString(),
    ...details,
  });
  
  log.info(`Security Event: ${event}`, { userId, ...details });
}

/**
 * Get security status for a user
 * Used by frontend to display status (not enforce security)
 */
export async function getSecurityStatus(userId: string) {
  const securityData = await kv.get(`security:${userId}`);
  
  return {
    suspended: securityData?.suspended || false,
    suspensionReason: securityData?.reason || null,
    twoFactorEnabled: securityData?.twoFactorEnabled || false,
    lastSecurityCheck: new Date().toISOString(),
  };
}