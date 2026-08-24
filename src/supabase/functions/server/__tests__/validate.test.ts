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
import { announceRatchetSlack } from '../../../../test/ratchet-notice';

beforeAll(() => {
  vi.stubGlobal('Deno', { env: { get: () => 'test' } });
});

const SERVER_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(SERVER_DIR, '../../../..');
const BASELINE_FILE = join(REPO_ROOT, 'quality/baselines/route-validation-baseline');

const { validateBody, validateOptionalBody, validateQuery, body } = await import('../validate.ts');

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

describe('validateOptionalBody — the tolerance is the point', () => {
  /**
   * Roughly a third of the e-sign routes read their body as
   * `await c.req.json().catch(() => ({}))`, because sending nothing means
   * "change nothing". `validateBody` 400s those callers. If this variant does
   * not preserve the tolerance exactly, adopting it on a PATCH route would be a
   * production break dressed as a safety improvement.
   */
  const Patch = z.object({ name: z.string().optional(), active: z.boolean().optional() });

  function patchApp(mw: ReturnType<typeof validateOptionalBody>) {
    const app = new Hono();
    app.patch('/x', mw, (c) => c.json({ got: c.get('validatedBody') }));
    return app;
  }

  const send = (app: Hono, payload?: string) =>
    app.fetch(
      new Request('http://x/x', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        ...(payload === undefined ? {} : { body: payload }),
      }),
    );

  it('accepts a request with no body at all', async () => {
    const res = await send(patchApp(validateOptionalBody(Patch)));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ got: {} });
  });

  it('accepts a body that is not valid JSON, as the handlers already did', async () => {
    const res = await send(patchApp(validateOptionalBody(Patch)), 'not json');

    expect(res.status).toBe(200);
  });

  it('accepts a literal null body without handing null to the schema', async () => {
    // `null` is valid JSON, so it survives the try/catch and would otherwise
    // reach a z.object() as a non-object — a rejection the old handlers never
    // made.
    const res = await send(patchApp(validateOptionalBody(Patch)), 'null');

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ got: {} });
  });

  it('still validates a body that IS sent', async () => {
    const res = await send(patchApp(validateOptionalBody(Patch)), '{"active":"yes-please"}');

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: 'Validation failed' });
  });

  it('passes a valid body through to the handler', async () => {
    const res = await send(patchApp(validateOptionalBody(Patch)), '{"name":"renamed"}');

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ got: { name: 'renamed' } });
  });

  it('differs from validateBody exactly where it is supposed to', async () => {
    // The contrast that justifies two entry points rather than one.
    const strict = new Hono();
    strict.patch('/x', validateBody(Patch), (c) => c.json({ ok: true }));

    expect((await send(strict)).status).toBe(400);
    expect((await send(patchApp(validateOptionalBody(Patch)))).status).toBe(200);
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
   * A route only belongs in this count if it actually READS a body.
   *
   * This was wrong until 2026-08-22, and wrong in the direction that matters:
   * the count included every POST/PUT/PATCH registration, and 20 of the 59 it
   * was reporting never touch the body at all — cancel, activate, rotate,
   * sweep, mark-read, remind. `validateBody` calls `c.req.json()` and returns
   * 400 when it throws, so "fixing" any of those to satisfy the ratchet would
   * have 400'd every caller. A gate that invites an outage is worse than no
   * gate; this is the same shape as A19.
   *
   * The type parameter in `c.req.json<T>()` is the reason the first attempt at
   * this classification undercounted — `req.json()` with literal empty parens
   * does not match it, and `PUT /retention` reads its body exactly that way.
   */
  const READS_BODY =
    /req\s*\.\s*(json|formData|parseBody|text|arrayBuffer|blob)\s*(<[^>()]*>)?\s*\(/;

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
  const bodylessRoutes: string[] = [];
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
      const label = `${file} ${matches[i][2].toUpperCase()} ${matches[i][4]}`;
      if (!READS_BODY.test(handler)) {
        bodylessRoutes.push(label);
        continue;
      }
      if (/validate(Optional)?Body\s*\(/.test(registration)) continue;
      if (/safeParse|validate(Optional)?Body\s*\(/.test(handler)) continue;
      unvalidated.push(label);
    }
  }

  it('discovers a sane number of body routes', () => {
    // Guards against the regex silently breaking and reporting a vacuous 0 —
    // the failure mode that made the dependency-cruiser gate useless.
    expect(bodyRoutes).toBeGreaterThan(50);
  });

  it('excludes routes that read no body, and finds some (analysis sanity check)', () => {
    // The exclusion added on 2026-08-22 narrows what this ratchet counts, and a
    // narrowing is exactly where a floor can quietly stop meaning anything. Two
    // guards: the excluded set must be non-empty (or the classifier broke open
    // and the floor is being met by exclusion), and it must not have swallowed
    // the whole population.
    expect(bodylessRoutes.length).toBeGreaterThan(5);
    expect(bodylessRoutes.length).toBeLessThan(bodyRoutes / 2);
  });

  it('classifies a body-reading handler as counted, in every spelling', () => {
    // A true-positive check on the classifier itself. If READS_BODY stopped
    // matching, every route would be excluded and the ratchet would pass
    // vacuously at any floor.
    //
    // Deliberately uses the REAL regex rather than a copy. A duplicated pattern
    // here would keep passing after someone edited the original, which is the
    // decorative-test shape this repo keeps finding.
    for (const spelling of [
      'const b = await c.req.json();',
      'const b = await c.req.json<{ a?: string }>();',
      'const b = await c.req.json().catch(() => ({}));',
      'const f = await c.req.formData();',
      'const p = await c.req.parseBody();',
    ]) {
      expect(READS_BODY.test(spelling), spelling).toBe(true);
    }
    expect(READS_BODY.test("const id = c.req.param('id');")).toBe(false);
  });

  it('names the body-less routes so the exclusion stays reviewable', () => {
    // Not an assertion about which ones — an assertion that they are listed at
    // all. An exclusion nobody can see is indistinguishable from a silent cap.
    expect(bodylessRoutes.every((r) => /^[\w.-]+ (POST|PUT|PATCH) \//.test(r))).toBe(true);
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
      `quality/baselines/route-validation-baseline missing or unparseable (got "${raw}")`,
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
      announceRatchetSlack(
        'route-validation',
        unvalidated.length,
        floor,
        'quality/baselines/route-validation-baseline',
        'unvalidated body routes',
      );
    }
  });
});
