/**
 * Stderr Logger Utility
 * 
 * CRITICAL: Supabase Edge Functions parse stdout as JSON response.
 * ALL logging MUST go to stderr to avoid "Unexpected token" errors.
 */

import { ILogger, LogContext, LogLevel } from './shared-logger-types.ts';
import { sanitizeLogData } from './shared-logger-utils.ts';

class StderrLogger implements ILogger {
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = true; // Default to true for stderr visibility in Supabase logs
  }

  private writeToStderr(message: string): void {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(message + '\n');
      Deno.stderr.writeSync(data);
    } catch {
      // Fail silently
    }
  }

  private formatMessage(level: LogLevel | 'success', message: string, context?: LogContext, error?: unknown): string {
    const timestamp = new Date().toISOString();
    const emoji = this.getEmoji(level);
    
    // Sanitize context and error
    const safeContext = context ? sanitizeLogData(context) : undefined;
    const safeError = error ? sanitizeLogData(error) : undefined;

    let formattedMsg = `${emoji} [${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    if (safeContext) {
      try {
        formattedMsg += ` | ${JSON.stringify(safeContext)}`;
      } catch {
        formattedMsg += ` | [Context Error]`;
      }
    }

    if (safeError) {
      try {
        formattedMsg += ` | ERROR: ${JSON.stringify(safeError)}`;
      } catch {
        formattedMsg += ` | [Error Serialization Failed]`;
      }
    }
    
    return formattedMsg;
  }

  private getEmoji(level: LogLevel | 'success'): string {
    switch (level) {
      case 'info': return 'ℹ️';
      case 'warn': return '⚠️';
      case 'error': return '❌';
      case 'debug': return '🔍';
      case 'success': return '✅';
      default: return '📝';
    }
  }

  info(message: string, context?: LogContext): void {
    this.writeToStderr(this.formatMessage('info', message, context));
  }

  warn(message: string, context?: LogContext): void {
    this.writeToStderr(this.formatMessage('warn', message, context));
  }

  error(message: string, error?: unknown, context?: LogContext): void {
    this.writeToStderr(this.formatMessage('error', message, context, error));
  }

  debug(message: string, context?: LogContext): void {
    this.writeToStderr(this.formatMessage('debug', message, context));
  }

  success(message: string, context?: LogContext): void {
    this.writeToStderr(this.formatMessage('success', message, context));
  }

  /**
   * Create module-scoped logger
   */
  module(moduleName: string) {
    return {
      info: (message: string, context?: LogContext) => 
        this.info(message, { ...context, module: moduleName }),
      warn: (message: string, context?: LogContext) => 
        this.warn(message, { ...context, module: moduleName }),
      error: (message: string, error?: unknown, context?: LogContext) => 
        this.error(message, error, { ...context, module: moduleName }),
      debug: (message: string, context?: LogContext) => 
        this.debug(message, { ...context, module: moduleName }),
      success: (message: string, context?: LogContext) => 
        this.success(message, { ...context, module: moduleName }),
    };
  }
}

export const logger = new StderrLogger();

export function createModuleLogger(moduleName: string) {
  return logger.module(moduleName);
}
