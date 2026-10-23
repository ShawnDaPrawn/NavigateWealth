/**
 * The JSON error response an e-sign route returns from its catch block.
 *
 * The status is the AuthError's own (401, 403, 404, ...) or 500 for anything
 * else, and the body is `{ error }` with the error's message, or `fallback`
 * when the thrown value is not an Error.
 *
 * It is a plain `Response` rather than `c.json()` because an AuthError can
 * carry any numeric status, which `c.json` does not accept untyped. This is
 * byte-for-byte the response the e-sign routes used to build inline.
 */

import { AuthError } from './auth-mw.ts';

export function authErrorResponse(err: unknown, fallback: string): Response {
  const status = err instanceof AuthError ? err.statusCode : 500;
  return new Response(JSON.stringify({ error: err instanceof Error ? err.message : fallback }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
