import { PostgrestError } from '@supabase/supabase-js';

/**
 * Type guard for PostgrestError from Supabase
 */
export function isPostgrestError(error: unknown): error is PostgrestError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    'details' in error
  );
}

/**
 * Standard API Error class matching Backend definition
 * (See supabase/functions/server/error.middleware.ts)
 */
export class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'API_ERROR'
  ) {
    super(message);
    this.name = 'APIError';
  }
}

/**
 * Type guard for APIError instances
 */
export function isAPIError(error: unknown): error is APIError {
  return error instanceof APIError;
}

/**
 * Type guard for standard Error object
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Type guard for Backend API Error response shape
 */
export function isBackendErrorResponse(error: unknown): error is { error: string; code?: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'error' in error &&
    typeof (error as Record<string, unknown>).error === 'string'
  );
}

/**
 * Type guard for AbortError (fetch cancellation)
 */
export function isAbortError(error: unknown): boolean {
  return isError(error) && error.name === 'AbortError';
}

/**
 * Safely extract error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (isBackendErrorResponse(error)) return error.error;
  if (isError(error)) return error.message;
  if (isPostgrestError(error)) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as Record<string, unknown>).message);
  }
  return 'An unknown error occurred';
}

/**
 * Safely extract error code if available
 */
export function getErrorCode(error: unknown): string | undefined {
  if (isBackendErrorResponse(error)) return (error as { code?: string }).code;
  if (isPostgrestError(error)) return error.code;
  if (error instanceof APIError) return error.code;
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return String((error as Record<string, unknown>).code);
  }
  return undefined;
}

/**
 * User-friendly error message formatter
 * Appropriate for displaying to end users in a financial services context
 */
export function getUserErrorMessage(error: unknown): string {
  const message = getErrorMessage(error);
  
  // Map technical errors to user-friendly messages
  if (message.toLowerCase().includes('network')) {
    return 'Network connection issue. Please check your internet connection and try again.';
  }
  
  if (message.toLowerCase().includes('unauthorized') || message.toLowerCase().includes('forbidden')) {
    return 'Your session has expired. Please sign in again.';
  }
  
  if (message.toLowerCase().includes('not found')) {
    return 'The requested information could not be found.';
  }
  
  if (message.toLowerCase().includes('timeout')) {
    return 'The request took too long. Please try again.';
  }
  
  // Return the original message if it's already user-friendly (doesn't contain technical jargon)
  const technicalTerms = ['stack', 'trace', 'undefined', 'null', 'function', 'object'];
  const hasTechnicalTerms = technicalTerms.some(term => message.toLowerCase().includes(term));
  
  if (hasTechnicalTerms) {
    return 'An unexpected error occurred. Please try again or contact support if the issue persists.';
  }
  
  return message;
}

/**
 * Development-only error logger
 * Logs errors to stderr in a structured format, only in development mode
 * Never logs in production to comply with Guidelines.md
 */
export function logError(error: unknown, context?: string): void {
  // Only log in development - production must be silent
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
    const message = getErrorMessage(error);
    const code = getErrorCode(error);
    const contextStr = context ? `[${context}] ` : '';
    
    // Log to stderr (not stdout) to avoid polluting response streams
    if (typeof console !== 'undefined' && console.error) {
      if (code) {
        console.error(`${contextStr}Error (${code}):`, message);
      } else {
        console.error(`${contextStr}Error:`, message);
      }
      
      // Include stack trace for debugging in development
      if (isError(error) && error.stack) {
        console.error('Stack:', error.stack);
      }
    }
  }
}