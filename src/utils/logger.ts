import { ILogger, LogContext, LogLevel } from '../shared/types/logger';
import { sanitizeLogData } from '../shared/utils/logger-utils';

/**
 * Frontend Logger Implementation
 * 
 * - Environment aware (Dev vs Prod)
 * - Safe sanitization of PII
 * - Structured JSON logging in Production
 * - Pretty printing in Development
 */
class Logger implements ILogger {
  private isDevelopment = false;

  constructor() {
    this.isDevelopment = this.detectEnvironment();
  }

  private detectEnvironment(): boolean {
    try {
      // @ts-ignore
      if (typeof import.meta !== 'undefined' && import.meta.env && typeof import.meta.env.DEV !== 'undefined') {
        // @ts-ignore
        return !!import.meta.env.DEV;
      }
      if (typeof window !== 'undefined' && window.location) {
        return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      }
    } catch {
      return false;
    }
    return false;
  }

  private log(level: LogLevel, message: string, context?: LogContext, error?: unknown) {
    const timestamp = new Date().toISOString();
    const safeContext = context ? sanitizeLogData(context) : undefined;
    const safeError = error ? sanitizeLogData(error) : undefined;

    const entry = {
      timestamp,
      level,
      message,
      context: safeContext,
      error: safeError,
    };

    if (this.isDevelopment) {
      this.prettyPrint(level, message, safeContext, safeError);
    } else {
      this.jsonPrint(level, entry);
    }
  }

  private prettyPrint(level: LogLevel, message: string, context?: unknown, error?: unknown) {
    const styles = {
      info: 'color: #3b82f6; font-weight: bold',
      warn: 'color: #f59e0b; font-weight: bold',
      error: 'color: #ef4444; font-weight: bold',
      debug: 'color: #6b7280; font-weight: bold',
    };

    console.groupCollapsed(`%c[${level.toUpperCase()}] ${message}`, styles[level]);
    if (context) console.log('Context:', context);
    if (error) console.error('Error:', error);
    console.groupEnd();
  }

  private jsonPrint(level: LogLevel, entry: Record<string, unknown>) {
    const str = JSON.stringify(entry);
    switch (level) {
      case 'error': console.error(str); break;
      case 'warn': console.warn(str); break;
      default: console.log(str); break;
    }
  }

  info(message: string, context?: LogContext) {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log('warn', message, context);
  }

  error(message: string, error?: unknown, context?: LogContext) {
    this.log('error', message, context, error);
  }

  debug(message: string, context?: LogContext) {
    if (this.isDevelopment) {
      this.log('debug', message, context);
    }
  }
}

export const logger = new Logger();