/**
 * Request validation middleware (Stage B / B2)
 * ============================================
 *
 * THE GAP THIS CLOSES
 * -------------------
 * Across the `auth-*` and `esign-*` route families there are 81 routes that
 * accept a request body and, between them, 7 zod parses. Everything else reads
 * `await c.req.json()` and indexes straight into whatever arrived — on the two
 * families that handle credentials and legally-binding signatures.
 *
 * WHY HAND-ROLLED RATHER THAN @hono/zod-validator
 * -----------------------------------------------
 * `deno.json` pins the edge import map to `hono`, `zod`, `@supabase/supabase-js`,
 * `pdf-lib` and `xlsx`. Adding `@hono/zod-validator` means a new third-party
 * package in the request path of a financial backend, for roughly twenty lines
 * of behaviour that the existing `zod` + `formatZodError` already support. The
 * ergonomics below deliberately mirror `zValidator` so the swap stays cheap if
 * that trade ever changes.
 *
 * THE ERROR SHAPE IS NOT NEW
 * --------------------------
 * `{ error: 'Validation failed', ...formatZodError(err) }` at 400 is copied
 * verbatim from the seven routes that already validate (e.g.
 * `esign-envelopes-routes.ts:554`). Adopting this middleware on a route that
 * already hand-rolled the same check is therefore observably a no-op, which is
 * what makes incremental adoption safe.
 *
 * USAGE
 * -----
 *   import { validateBody, body } from './validate.ts';
 *
 *   routes.post('/login', validateBody(LoginSchema), async (c) => {
 *     const { email, password } = body(c, LoginSchema);   // fully typed
 *     …
 *   });
 *
 * `body()` takes the schema again purely to recover the inferred type; it does
 * NOT re-parse. Passing a different schema than the middleware used is a
 * type-level lie the compiler cannot catch, so keep them the same symbol —
 * `validate.test.ts` covers the honest path.
 */

import type { Context, Next } from 'npm:hono';
import type { z } from 'npm:zod';
import { formatZodError } from './shared-validation-utils.ts';

declare module 'npm:hono' {
  interface ContextVariableMap {
    validatedBody: unknown;
    validatedQuery: unknown;
  }
}

/** Minimal structural shape of a zod schema — avoids depending on zod's generics. */
type Schema<T> = {
  safeParse: (input: unknown) => { success: true; data: T } | { success: false; error: never };
};

/** The 400 body every validating route in this codebase already returns. */
function rejection(c: Context, error: Parameters<typeof formatZodError>[0]) {
  return c.json({ error: 'Validation failed', ...formatZodError(error) }, 400);
}

/**
 * Validate the JSON request body against `schema` before the handler runs.
 *
 * A body that is not valid JSON is rejected with 400 rather than being allowed
 * to throw — an unparseable body is the caller's error, not a server fault, and
 * letting it reach the shared error handler would record it as an unexpected
 * 500 in the quality-issues feed.
 */
export function validateBody<S extends { safeParse: (i: unknown) => unknown }>(schema: S) {
  return async (c: Context, next: Next) => {
    let raw: unknown;
    try {
      raw = await c.req.json();
    } catch {
      return c.json({ error: 'Validation failed', message: 'Request body is not valid JSON' }, 400);
    }
    const parsed = (schema as unknown as Schema<unknown>).safeParse(raw);
    if (!parsed.success) return rejection(c, parsed.error);
    c.set('validatedBody', parsed.data);
    await next();
  };
}

/**
 * Validate the JSON body against `schema`, treating an ABSENT or unparseable
 * body as `{}` instead of rejecting it.
 *
 * WHY THIS EXISTS AS A SEPARATE ENTRY POINT
 * -----------------------------------------
 * A large share of the e-sign routes read their body as
 * `await c.req.json().catch(() => ({}))` — a deliberate tolerance, because
 * these are PATCH-style routes where sending nothing means "change nothing".
 * `validateBody` would turn every one of those callers into a 400.
 *
 * So adopting validation on them needs a variant that preserves the tolerance
 * exactly: no body behaves as before, and a body that IS sent gets checked.
 * Without this the only way to satisfy the adoption ratchet on those routes
 * would be to break them, which is a gate inviting an outage rather than
 * preventing one.
 *
 * Use `validateBody` wherever the handler does a bare `await c.req.json()` —
 * there, an unparseable body is already a failure and should stay one.
 */
export function validateOptionalBody<S extends { safeParse: (i: unknown) => unknown }>(schema: S) {
  return async (c: Context, next: Next) => {
    let raw: unknown;
    try {
      raw = await c.req.json();
    } catch {
      raw = {};
    }
    // `null` is valid JSON and would otherwise reach the schema as a non-object.
    if (raw === null || raw === undefined) raw = {};
    const parsed = (schema as unknown as Schema<unknown>).safeParse(raw);
    if (!parsed.success) return rejection(c, parsed.error);
    c.set('validatedBody', parsed.data);
    await next();
  };
}

/**
 * Validate the query string against `schema`. Every value arrives as a string,
 * so schemas here want `z.coerce.number()` / explicit enums rather than
 * `z.number()`.
 */
export function validateQuery<S extends { safeParse: (i: unknown) => unknown }>(schema: S) {
  return async (c: Context, next: Next) => {
    const parsed = (schema as unknown as Schema<unknown>).safeParse(
      Object.fromEntries(new URL(c.req.url).searchParams),
    );
    if (!parsed.success) return rejection(c, parsed.error);
    c.set('validatedQuery', parsed.data);
    await next();
  };
}

/** Typed read of what `validateBody(schema)` stored. Does not re-parse. */
export function body<S extends z.ZodTypeAny>(c: Context, _schema: S): z.infer<S> {
  return c.get('validatedBody') as z.infer<S>;
}

/** Typed read of what `validateQuery(schema)` stored. Does not re-parse. */
export function query<S extends z.ZodTypeAny>(c: Context, _schema: S): z.infer<S> {
  return c.get('validatedQuery') as z.infer<S>;
}
