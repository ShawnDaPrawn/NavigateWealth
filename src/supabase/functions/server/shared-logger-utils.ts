import { SENSITIVE_KEYS } from './shared-logger-types.ts';

/**
 * Deeply sanitizes an object by redacting sensitive keys.
 * Handles circular references by breaking them.
 */
export function sanitizeLogData(data: unknown, seen = new WeakSet()): unknown {
  if (data === null || data === undefined) return data;
  
  if (typeof data !== 'object') return data;
  
  if (data instanceof Date) return data.toISOString();
  if (data instanceof Error) {
    return {
      name: data.name,
      message: data.message,
      stack: data.stack,
      // @ts-ignore
      code: data.code,
    };
  }

  if (seen.has(data)) return '[Circular]';
  seen.add(data);

  if (Array.isArray(data)) {
    return data.map(item => sanitizeLogData(item, seen));
  }

  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEYS.some(k => key.toLowerCase().includes(k))) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = sanitizeLogData(value, seen);
    }
  }

  return sanitized;
}

/**
 * Extract error message from unknown catch value.
 * Canonical utility for consistent error message extraction across all route handlers.
 */
export function getErrMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}