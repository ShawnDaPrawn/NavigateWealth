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
import { recordRuntimeServerIssue } from './quality-issues-runtime-server.ts';

// ============================================================================
// ERROR CLASSES
// ============================================================================

export class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'API_ERROR',
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export class ValidationError extends APIError {
  constructor(
    message: string,
    public field?: string,
  ) {
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

/**
 * The shape index.tsx accepts for a caller-supplied request id. Kept identical
 * on purpose: a value that policy would not accept at the edge must not become
 * acceptable further in.
 */
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

/** Context-set id first, then the forwarded header — never an unvalidated one. */
function resolveRequestId(c: Context): string | undefined {
  const fromContext = c.get('requestId') as string | undefined;
  if (typeof fromContext === 'string' && REQUEST_ID_PATTERN.test(fromContext)) return fromContext;
  const fromHeader = c.req.header('x-request-id');
  return typeof fromHeader === 'string' && REQUEST_ID_PATTERN.test(fromHeader)
    ? fromHeader
    : undefined;
}

export async function errorHandler(error: Error, c: Context) {
  logger.error('API Error occurred', error, { path: c.req.url });

  // Hono's built-in handler — the one lazy-router REPLACES on all 77 mounts —
  // honours an error that carries its own Response via `getResponse()`
  // (hono-base.js: `if ("getResponse" in err)`). That is how HTTPException, and
  // every Hono middleware that throws it (jwt, bearerAuth, bodyLimit, timeout,
  // the validator), communicates a deliberate status and body.
  //
  // Nothing in this codebase throws one today — verified: zero references to
  // HTTPException or hono/http-exception anywhere in src/, and the only Hono
  // submodules the server imports are `cors` and a type-only http-status. So
  // this is not a live bug. It is a TRAP: replacing a handler with one that
  // handles strictly less means the first person to add `bearerAuth` to a
  // sub-router would watch their 401 silently become a generic 500, on all 77
  // mounts at once, with no clue why. Handling it here makes the replacement a
  // superset of what it replaced, which is the only safe way to replace
  // something.
  //
  // Checked before the typed branches so a deliberate response is never
  // recorded as an unexpected 500.
  if (typeof (error as { getResponse?: unknown }).getResponse === 'function') {
    const carried = (error as unknown as { getResponse: () => Response }).getResponse();
    return c.newResponse(carried.body, carried);
  }

  if (error instanceof ZodError) {
    // Shared utility for consistent validation error formatting
    const formatted = formatZodError(error);
    return c.json(
      {
        error: formatted.message,
        code: 'VALIDATION_ERROR',
        errors: formatted.errors,
        timestamp: new Date().toISOString(),
      },
      400,
    );
  }

  if (error instanceof ValidationError) {
    return new Response(
      JSON.stringify({
        error: error.message,
        code: error.code,
        field: error.field,
        timestamp: new Date().toISOString(),
      }),
      { status: error.statusCode, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (error instanceof APIError) {
    return new Response(
      JSON.stringify({
        error: error.message,
        code: error.code,
        timestamp: new Date().toISOString(),
      }),
      { status: error.statusCode, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // For unexpected errors, include more details in development/logging.
  //
  // FAILS CLOSED. This used to read `!== 'production'`, which meant an UNSET
  // DENO_ENV counted as development — and DENO_ENV is set nowhere in this repo
  // or its deployment config, so the deployed edge function was returning
  // `details`, `errorName` and five frames of stack trace to callers on every
  // unexpected 500. Opting IN to disclosure is the only safe direction for a
  // backend holding client PII, ID documents and e-signatures. Nothing is lost
  // operationally: the full stack is still written to stderr just below, where
  // Supabase's logs keep it.
  const isDevelopment = Deno.env.get('DENO_ENV') === 'development';

  // Always log the full error stack to stderr for debugging
  logger.error('Unhandled error details', {
    message: error.message,
    name: error.name,
    stack: error.stack,
  });

  // Record unexpected 500s into the in-house quality-issues pipeline so backend
  // exceptions surface on the same dashboard as client runtime errors (source:
  // 'runtime-server'). Awaited so the KV write completes before the isolate may
  // suspend; recordRuntimeServerIssue never throws.
  await recordRuntimeServerIssue({
    error,
    path: new URL(c.req.url).pathname,
    method: c.req.method,
    statusCode: 500,
    // Lazily-mounted sub-routers are dispatched via `router.fetch()` into a
    // separate Hono instance, so index.tsx's `c.set('requestId')` is not
    // visible there — lazy-router forwards the id as a header instead.
    //
    // The header is re-validated rather than trusted. lazy-router already
    // overwrites it with the id index.tsx validated, but this function is also
    // reachable directly through `asyncHandler` in ~50 modules, and the value
    // lands unbounded and unsanitised in a KV-persisted issue message that the
    // admin dashboard renders. One validation at the point of use is cheaper
    // than trusting every future call path.
    requestId: resolveRequestId(c),
  });

  return c.json(
    {
      message: 'An unexpected error occurred',
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      endpoint: new URL(c.req.url).pathname,
      method: c.req.method,
      ...(isDevelopment && {
        details: error.message,
        errorName: error.name,
        stack: error.stack?.split('\n').slice(0, 5).join('\n'), // First 5 lines only
      }),
      timestamp: new Date().toISOString(),
    },
    500,
  );
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
