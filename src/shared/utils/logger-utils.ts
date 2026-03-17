import { SENSITIVE_KEYS } from '../types/logger';

/**
 * Deeply sanitizes an object by redacting sensitive keys.
 * Handles circular references by breaking them.
 */
export function sanitizeLogData(data: unknown, seen = new WeakSet<object>()): unknown {
  if (data === null || data === undefined) return data;
  
  if (typeof data !== 'object') return data;
  
  if (data instanceof Date) return data.toISOString();
  if (data instanceof Error) {
    return {
      name: data.name,
      message: data.message,
      stack: data.stack,
      code: (data as Error & { code?: string }).code,
    };
  }

  if (seen.has(data)) return '[Circular]';
  seen.add(data);

  if (Array.isArray(data)) {
    return data.map(item => sanitizeLogData(item, seen));
  }

  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.some(k => key.toLowerCase().includes(k))) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = sanitizeLogData(value, seen);
    }
  }

  return sanitized;
}