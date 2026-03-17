/**
 * Shared Logging & Error Types
 * 
 * Ensures consistent observability across Frontend and Backend.
 */

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogContext {
  module?: string;
  action?: string;
  userId?: string;
  requestId?: string;
  [key: string]: unknown;
}

export interface AppError {
  message: string;        // User-facing message
  code?: string;          // Machine-readable error code
  context?: unknown;      // Contextual information (no PII)
  timestamp: string;      // ISO Date string
  statusCode?: number;    // HTTP status code (optional, mainly for backend)
}

export interface ILogger {
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: unknown, context?: LogContext): void;
  debug(message: string, context?: LogContext): void;
}

/**
 * sensitiveKeys - List of keys that should be redacted from logs
 */
export const SENSITIVE_KEYS = [
  'password',
  'token',
  'secret',
  'authorization',
  'cookie',
  'credit_card',
  'cvv',
  'ssn',
  'id_number',
  'account_number'
];
