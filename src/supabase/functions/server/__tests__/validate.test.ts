/**
 * Request validation middleware + adoption ratchet (Stage B / B2)
 * ==============================================================
 *
 * Two things are pinned here:
 *   1. the middleware behaves like the hand-rolled checks it replaces, and
 *      rejects exactly what those checks rejected — no more, no less;
 *   2. the number of body-accepting auth/esign routes with NO validation can
 *      only go DOWN, so the remaining backlog cannot quietly grow while it is
 *      being burned down.
 *
 * Run: npx vitest run src/supabase/functions/server/__tests__/validate.test.ts
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { z } from 'zod';

beforeAll(() => {
  vi.stubGlobal('Deno', { env: { get: () => 'test' } });
});

const SERVER_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(SERVER_DIR, '../../../..');
const BASELINE_FILE = join(REPO_ROOT, '.route-validation-baseline');

const { validateBody, validateQuery, body } = await import('../validate.ts');

const Schema = z.object({ email: z.string().min(1), count: z.number().optional() }).passthrough();

function appWith(mw: ReturnType<typeof validateBody>) {
  const app = new Hono();
  app.post('/x', mw, async (c) => c.json({ seen: await c.req.json() }));
  return app;
}

const post = (app: Hono, payload: string) =>
  app.fetch(
    new Request('http://x/x', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
    }),
  );

describe('validateBody', () => {
  it('passes a valid body through to the handler', async () => {
    const res = await post(appWith(validateBody(Schema)), '{"email":"a@b.c"}');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ seen: { email: 'a@b.c' } });
  });

  it('rejects a missing required field with the shape the codebase already returns', async () => {
    // Copied from esign-envelopes-routes.ts, which hand-rolled this check long
    // before the middleware existed. Matching it is what makes adopting the
    // middleware on an already-validating route observably a no-op.
    const res = await post(appWith(validateBody(Schema)), '{}');
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error: 'Validation failed',
      message: 'Validation failed',
      errors: { email: expect.any(Array) },
    });
  });

  it('rejects a wrong-typed field', async () => {
    const res = await post(appWith(validateBody(Schema)), '{"email":"a@b.c","count":"seven"}');
    expect(res.status).toBe(400);
  });

  it('rejects an unparseable body as 400, not as a 500', async () => {
    // An unparseable body is the caller's error. Letting c.req.json() throw
    // would reach the shared error handler and be recorded as an unexpected
    // server fault in the quality-issues feed, which is both wrong and noisy.
    const res = await post(appWith(validateBody(Schema)), 'not json at all');
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ message: 'Request body is not valid JSON' });
  });

  it('NEVER rejects an unknown extra field', async () => {
    // Load-bearing for retrofitting live routes: a caller sending a field the
    // schema does not mention must keep working exactly as before.
    const res = await post(appWith(validateBody(Schema)), '{"email":"a@b.c","surprise":true}');
    expect(res.status).toBe(200);
  });

  it('leaves the raw body readable by the handler, unknown keys included', async () => {
    // The middleware is a GATE, not a rewrite. Hono caches the parsed body, so
    // handlers keep their existing `await c.req.json()` and see the ORIGINAL
    // object — which is why 81 routes can be gated without touching one
    // handler body, and why zod's key-stripping cannot silently drop a field.
    const res = await post(appWith(validateBody(Schema)), '{"email":"a@b.c","extra":"kept"}');
    expect(await res.json()).toEqual({ seen: { email: 'a@b.c', extra: 'kept' } });
  });

  it('exposes the validated value under body() for new code that wants it typed', async () => {
    const app = new Hono();
    app.post('/x', validateBody(Schema), (c) => c.json({ email: body(c, Schema).email }));
    const res = await post(app, '{"email":"typed@example.com"}');
    expect(await res.json()).toEqual({ email: 'typed@example.com' });
  });
});

describe('validateQuery', () => {
  const QuerySchema = z.object({ limit: z.coerce.number().max(100) });

  it('coerces and accepts a valid query string', async () => {
    const app = new Hono();
    app.get('/q', validateQuery(QuerySchema), (c) => c.json({ ok: true }));
    expect((await app.fetch(new Request('http://x/q?limit=25'))).status).toBe(200);
  });

  it('rejects a query value outside the schema', async () => {
    const app = new Hono();
    app.get('/q', validateQuery(QuerySchema), (c) => c.json({ ok: true }));
    expect((await app.fetch(new Request('http://x/q?limit=9999'))).status).toBe(400);
  });
});

describe('adoption ratchet: unvalidated body routes in auth + esign', () => {
  /**
   * Counts routes that accept a body in the `auth-*` / `esign-*` families and
   * have no visible validation — neither a `validateBody(...)` at registration
   * nor a `safeParse` inside the handler.
   *
   * Like the other ratchets in this repo this is a REVIEW LIST, not a bug
   * count: a route whose body is genuinely free-form is legitimately here. Its
   * value is the delta — route #N+1 cannot land unvalidated without a
   * deliberate re-baseline.
   */
  const ROUTE_RE = /\b(\w+)\.(post|put|patch)\(\s*(['"`])(\/[^'"`]*)\3([\s\S]{0,240}?)=>/g;

  /**
   * Skip registrations that live inside a comment — JSDoc usage examples and
   * commented-out routes are not routes. Same guard, same reason, as
   * route-auth-granular.test.ts: this file's own docblock example would
   * otherwise be counted as an unvalidated route.
   */
  const onCommentLine = (src: string, index: number) => {
    const line = src.slice(src.lastIndexOf('\n', index) + 1, index).trimStart();
    return line.startsWith('*') || line.startsWith('//') || line.startsWith('/*');
  };

  const files = readdirSync(SERVER_DIR).filter(
    (f) => /^(auth|esign)-.*\.tsx?$/.test(f) && !/\.test\./.test(f) && f !== 'auth-mw.ts',
  );

  const unvalidated: string[] = [];
  let bodyRoutes = 0;

  for (const file of files) {
    const src = readFileSync(join(SERVER_DIR, file), 'utf8');
    const matches = [...src.matchAll(ROUTE_RE)].filter((m) => !onCommentLine(src, m.index!));
    for (let i = 0; i < matches.length; i += 1) {
      bodyRoutes += 1;
      const start = matches[i].index!;
      const end = i + 1 < matches.length ? matches[i + 1].index! : src.length;
      const registration = matches[i][5];
      const handler = src.slice(start, end);
      if (/validateBody\s*\(/.test(registration)) continue;
      if (/safeParse|validateBody\s*\(/.test(handler)) continue;
      unvalidated.push(`${file} ${matches[i][2].toUpperCase()} ${matches[i][4]}`);
    }
  }

  it('discovers a sane number of body routes', () => {
    // Guards against the regex silently breaking and reporting a vacuous 0 —
    // the failure mode that made the dependency-cruiser gate useless.
    expect(bodyRoutes).toBeGreaterThan(50);
  });

  it('confirms the routes wired in this change are counted as validated', () => {
    // A true negative: if these show up as unvalidated, the detection is wrong
    // and the floor below means nothing.
    for (const wired of [
      'auth-routes.ts POST /login-validate',
      'auth-routes.ts POST /password-change',
      'esign-signer-submit-routes.ts POST /signer/submit',
      'esign-signer-otp-routes.ts POST /signer/resend-otp',
    ]) {
      expect(unvalidated, `${wired} should now count as validated`).not.toContain(wired);
    }
  });

  it('does not add unvalidated body routes beyond the committed floor', () => {
    const raw = existsSync(BASELINE_FILE) ? readFileSync(BASELINE_FILE, 'utf8') : '';
    const floor = Number.parseInt(raw.trim(), 10);
    expect(
      Number.isFinite(floor),
      `.route-validation-baseline missing or unparseable (got "${raw}")`,
    ).toBe(true);

    if (unvalidated.length > floor) {
      expect.fail(
        `Unvalidated body routes rose to ${unvalidated.length} (floor ${floor}).\n` +
          `Add validateBody(<schema>) at the route registration — schemas live in\n` +
          `<module>-validation.ts. Derive the schema from what the handler actually\n` +
          `destructures, and keep it .passthrough(): a schema written against an\n` +
          `imagined API shape rejects real traffic (see SignerSubmitSchema / A19).\n` +
          `If the body is genuinely free-form, say why in the PR and re-baseline to\n` +
          `${unvalidated.length}.\n\nFirst 20 of ${unvalidated.length}:\n  ` +
          unvalidated.slice(0, 20).join('\n  '),
      );
    }

    if (unvalidated.length < floor) {
      console.warn(
        `[route-validation] ${unvalidated.length} unvalidated body routes, below floor ` +
          `${floor} — tighten the ratchet by setting .route-validation-baseline to ${unvalidated.length}.`,
      );
    }
  });
});
