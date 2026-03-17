/**
 * ****************************************************************************
 * ERROR HANDLING MIDDLEWARE
 * ****************************************************************************
 * 
 * Centralized error handling for all routes.
 * Uses shared validation utilities.
 * 
 * ****************************************************************************
 */

import type { Context } from 'npm:hono';
import { ZodError } from 'npm:zod';
import { logger } from './stderr-logger.ts';
import { formatZodError } from './shared-validation-utils.ts';

// ============================================================================
// ERROR CLASSES
// ============================================================================

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

export class ValidationError extends APIError {
  constructor(message: string, public field?: string) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends APIError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

// ============================================================================
// ERROR HANDLER
// ============================================================================

export async function errorHandler(error: Error, c: Context) {
  logger.error('API Error occurred', error, { path: c.req.url });
  
  if (error instanceof ZodError) {
    // Shared utility for consistent validation error formatting
    const formatted = formatZodError(error);
    return c.json({
      error: formatted.message,
      code: 'VALIDATION_ERROR',
      errors: formatted.errors,
      timestamp: new Date().toISOString(),
    }, 400);
  }
  
  if (error instanceof ValidationError) {
    return c.json({
      error: error.message,
      code: error.code,
      field: error.field,
      timestamp: new Date().toISOString(),
    }, error.statusCode);
  }
  
  if (error instanceof APIError) {
    return c.json({
      error: error.message,
      code: error.code,
      timestamp: new Date().toISOString(),
    }, error.statusCode);
  }
  
  // For unexpected errors, include more details in development/logging
  const isDevelopment = Deno.env.get('DENO_ENV') !== 'production';
  
  // Always log the full error stack to stderr for debugging
  logger.error('Unhandled error details', { 
    message: error.message,
    name: error.name,
    stack: error.stack
  });
  
  return c.json({
    message: 'An unexpected error occurred',
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    endpoint: new URL(c.req.url).pathname,
    method: c.req.method,
    ...(isDevelopment && { 
      details: error.message,
      errorName: error.name,
      stack: error.stack?.split('\n').slice(0, 5).join('\n') // First 5 lines only
    }),
    timestamp: new Date().toISOString(),
  }, 500);
}

// ============================================================================
// ASYNC HANDLER WRAPPER
// ============================================================================

export function asyncHandler(fn: (c: Context) => Promise<Response | void>) {
  return async (c: Context) => {
    try {
      return await fn(c);
    } catch (error) {
      return errorHandler(error as Error, c);
    }
  };
}