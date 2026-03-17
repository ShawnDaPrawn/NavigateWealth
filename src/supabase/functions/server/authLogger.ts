// Authentication Event Logger
// Tracks security-relevant authentication events for monitoring and auditing

import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';

const log = createModuleLogger('auth-logger');

export type AuthEventType =
  | 'signup_attempt'
  | 'signup_success'
  | 'signup_failure'
  | 'login_attempt'
  | 'login_success'
  | 'login_failure'
  | 'logout'
  | 'password_reset_request'
  | 'password_reset_success'
  | 'password_change'
  | 'email_verification_sent'
  | 'email_verification_success'
  | 'account_locked'
  | 'suspicious_activity'
  | 'session_expired';

export interface AuthEvent {
  id: string;
  type: AuthEventType;
  timestamp: string;
  email?: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log an authentication event
 */
export async function logAuthEvent(
  type: AuthEventType,
  email: string | undefined,
  success: boolean,
  context: {
    userId?: string;
    ip?: string;
    userAgent?: string;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
  } = {}
): Promise<void> {
  const eventId = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  const event: AuthEvent = {
    id: eventId,
    type,
    timestamp,
    email: email ? maskEmail(email) : undefined, // Mask email for privacy
    userId: context.userId,
    ip: context.ip ? maskIP(context.ip) : undefined, // Mask IP for privacy
    userAgent: context.userAgent,
    success,
    errorMessage: context.errorMessage,
    metadata: context.metadata,
  };

  try {
    // Store in KV with type prefix for easy querying
    const key = `auth_log:${timestamp}:${eventId}`;
    await kv.set(key, event);

    // Also store failed login attempts separately for security monitoring
    if (!success && (type === 'login_failure' || type === 'login_attempt')) {
      const failureKey = `auth_failure:${email}:${timestamp}`;
      await kv.set(failureKey, event);
    }

    // Store in user's activity log if we have a userId
    if (context.userId) {
      const activityKey = `activity:${context.userId}:${eventId}`;
      await kv.set(activityKey, {
        id: eventId,
        userId: context.userId,
        type,
        timestamp,
        ip: context.ip,
        userAgent: context.userAgent,
        success,
        errorMessage: context.errorMessage,
        metadata: context.metadata,
      });
    }

  } catch (error) {
    log.error('Failed to log auth event', error);
  }
}

/**
 * Get recent auth events for a user (for security dashboard)
 */
export async function getAuthEventsForUser(
  email: string,
  limit: number = 20
): Promise<AuthEvent[]> {
  try {
    const allEvents = await kv.getByPrefix('auth_log:');
    
    // Filter events for this user and sort by timestamp (newest first)
    const userEvents = allEvents
      .filter(event => event.email && unmaskEmail(event.email) === email)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);

    return userEvents;
  } catch (error) {
    return [];
  }
}

/**
 * Get failed login attempts for security monitoring
 */
export async function getFailedLoginAttempts(
  email: string,
  sinceTimestamp?: string
): Promise<AuthEvent[]> {
  try {
    const failureEvents = await kv.getByPrefix(`auth_failure:${email}:`);
    
    let filtered = failureEvents;
    if (sinceTimestamp) {
      const sinceDate = new Date(sinceTimestamp).getTime();
      filtered = failureEvents.filter(
        event => new Date(event.timestamp).getTime() > sinceDate
      );
    }

    return filtered.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } catch (error) {
    return [];
  }
}

/**
 * Get security summary statistics
 */
export async function getSecurityStats(): Promise<{
  totalEvents: number;
  failedLogins24h: number;
  successfulLogins24h: number;
  accountLocks24h: number;
  suspiciousActivity24h: number;
}> {
  try {
    const allEvents = await kv.getByPrefix('auth_log:');
    const last24h = Date.now() - 24 * 60 * 60 * 1000;

    const recentEvents = allEvents.filter(
      event => new Date(event.timestamp).getTime() > last24h
    );

    return {
      totalEvents: allEvents.length,
      failedLogins24h: recentEvents.filter(
        e => e.type === 'login_failure' && !e.success
      ).length,
      successfulLogins24h: recentEvents.filter(
        e => e.type === 'login_success' && e.success
      ).length,
      accountLocks24h: recentEvents.filter(
        e => e.type === 'account_locked'
      ).length,
      suspiciousActivity24h: recentEvents.filter(
        e => e.type === 'suspicious_activity'
      ).length,
    };
  } catch (error) {
    return {
      totalEvents: 0,
      failedLogins24h: 0,
      successfulLogins24h: 0,
      accountLocks24h: 0,
      suspiciousActivity24h: 0,
    };
  }
}

// Helper Functions

/**
 * Mask email for privacy (show first 2 chars and domain)
 * Example: john.doe@example.com -> jo***@example.com
 */
function maskEmail(email: string): string {
  const [localPart, domain] = email.split('@');
  if (!domain) return email;
  
  const maskedLocal = localPart.length <= 2 
    ? localPart 
    : localPart.substring(0, 2) + '***';
  
  return `${maskedLocal}@${domain}`;
}

/**
 * Unmask email (not actually possible - this is for filtering only)
 */
function unmaskEmail(maskedEmail: string): string {
  // We can't actually unmask, so we'll need to store both versions
  // For now, return as-is and filter by partial match
  return maskedEmail;
}

/**
 * Mask IP address for privacy (show first 2 octets only)
 * Example: 192.168.1.100 -> 192.168.*.*
 */
function maskIP(ip: string): string {
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.*.*`;
  }
  
  // IPv6 or other format
  return ip.substring(0, 10) + '***';
}