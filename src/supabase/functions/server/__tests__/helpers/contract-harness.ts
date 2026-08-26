/**
 * Shared harness for Edge Function route contract tests.
 * ======================================================
 *
 * Holds the pieces every route-contract suite needs and none of them should
 * re-derive: an in-memory KV, a quiet logger, a multipart request builder, and
 * the two jsdom workarounds that would otherwise make upload tests assert on
 * the harness instead of the code.
 *
 * `vi.mock` factories are hoisted above imports, so a suite reaches the
 * factories here with the async form:
 *
 *   vi.mock('../kv_store.tsx', async () => {
 *     const { makeKvMock } = await import('./helpers/contract-harness.ts');
 *     return makeKvMock();
 *   });
 *
 * The store itself is a module singleton, so the suite can import `kvStore`
 * directly to seed and assert against the same map the mock reads.
 *
 * @module __tests__/helpers/contract-harness
 */
import { vi } from 'vitest';
import { Hono } from 'npm:hono';

/**
 * The user id `makeRoleGate` puts on the context when a request does not name
 * one. Assert against this rather than a literal: routes that stamp "who did
 * this" read it off the context, and a suite that hard-codes the string breaks
 * for the wrong reason when the default moves.
 */
export const DEFAULT_TEST_USER = 'test-user';

/** The KV backing store. Cleared per test by the suite's `beforeEach`. */
export const kvStore = new Map<string, unknown>();

export const clone = <T>(v: T): T => (v == null ? v : JSON.parse(JSON.stringify(v)));

/**
 * An in-memory stand-in for `kv_store.tsx`. Values are cloned on the way in and
 * out so a test that mutates a returned object cannot corrupt the store — the
 * real KV round-trips through JSON and would not carry the mutation either.
 */
export function makeKvMock() {
  return {
    get: vi.fn(async (key: string) => clone(kvStore.get(key) ?? null)),
    set: vi.fn(async (key: string, value: unknown) => {
      kvStore.set(key, clone(value));
    }),
    del: vi.fn(async (key: string) => {
      kvStore.delete(key);
    }),
    mget: vi.fn(async (keys: string[]) => keys.map((k) => clone(kvStore.get(k) ?? null))),
    mset: vi.fn(async (keys: string[], values: unknown[]) => {
      keys.forEach((k, i) => kvStore.set(k, clone(values[i])));
    }),
    mdel: vi.fn(async (keys: string[]) => {
      keys.forEach((k) => kvStore.delete(k));
    }),
    getByPrefix: vi.fn(async (prefix: string) => {
      const out: unknown[] = [];
      kvStore.forEach((v, k) => {
        if (k.startsWith(prefix)) out.push(clone(v));
      });
      return out;
    }),
    listByPrefix: vi.fn(async (prefix: string) => {
      const out: { key: string; value: unknown }[] = [];
      kvStore.forEach((v, k) => {
        if (k.startsWith(prefix)) out.push({ key: k, value: clone(v) });
      });
      return out;
    }),
  };
}

const quiet = () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
  debug: vi.fn(),
});

/** Module shape for `vi.mock('../stderr-logger.ts', …)`. */
export function makeLoggerMock() {
  return { logger: quiet(), createModuleLogger: quiet };
}

/**
 * Points the global `File` at the class the platform actually hands a Hono
 * handler, and returns it.
 *
 * WHY THIS IS NEEDED: under jsdom the `File` a handler receives from
 * `c.req.parseBody()` comes from undici and is NOT `instanceof` the jsdom
 * `File` global, so every route guarded by `file instanceof File` refuses a
 * perfectly valid upload. Under Deno there is one `File` class and the guard
 * behaves; this only realigns the harness with production. The class is
 * captured by round-tripping a request rather than imported from `undici`, so
 * it stays correct if the runtime's implementation moves.
 *
 * Call it once from `beforeAll`.
 */
export async function alignFileGlobal(): Promise<unknown> {
  const probe = new Hono();
  let captured: unknown;
  probe.post('/', async (c) => {
    captured = (await c.req.parseBody())['file'];
    return c.json({});
  });
  await probe.request('/', {
    method: 'POST',
    headers: { 'Content-Type': 'multipart/form-data; boundary=b' },
    body: '--b\r\nContent-Disposition: form-data; name="file"; filename="p.bin"\r\n\r\nx\r\n--b--\r\n',
  });
  const ctor = (captured as { constructor: unknown } | undefined)?.constructor;
  if (typeof ctor !== 'function') {
    throw new Error('alignFileGlobal: could not capture the runtime File class');
  }
  (globalThis as unknown as { File: unknown }).File = ctor;
  return ctor;
}

export type MultipartPart = { name: string; value: string; filename?: string; type?: string };

/**
 * Builds a real `multipart/form-data` body and its Content-Type.
 *
 * WHY NOT `FormData`: appending a `File` to a `FormData` object and posting it
 * through `app.request` loses the filename — it arrives as the literal string
 * `"blob"`, whatever was appended — which silently defeats every
 * extension-allowlist and stored-path assertion. Serialising the parts by hand
 * preserves the filename, so those assertions test the route.
 */
export function multipart(
  parts: MultipartPart[],
  boundary = '----contracttest',
): { body: string; contentType: string } {
  let body = '';
  for (const p of parts) {
    body += `--${boundary}\r\nContent-Disposition: form-data; name="${p.name}"`;
    if (p.filename !== undefined) body += `; filename="${p.filename}"`;
    body += '\r\n';
    if (p.type) body += `Content-Type: ${p.type}\r\n`;
    body += `\r\n${p.value}\r\n`;
  }
  return {
    body: `${body}--${boundary}--\r\n`,
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

export type RequestOptions = {
  as?: string | null;
  user?: string;
  method?: string;
  body?: unknown;
  form?: { body: string; contentType: string };
  auth?: boolean;
  /** Raw request body, sent as application/json without serialising. */
  raw?: string;
};

/**
 * Issues a request against a mounted Hono app. `as` and `user` drive the
 * role-aware auth mocks each suite installs, so one mount can be exercised as
 * any role — without that, every authorization assertion is vacuous.
 */
export function request(
  app: { request: (path: string, init: RequestInit) => Promise<Response> },
  path: string,
  { as, user, method = 'GET', body, form, auth = true, raw }: RequestOptions = {},
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (auth) headers.Authorization = 'Bearer t';
  if (as) headers['x-test-role'] = as;
  if (user) headers['x-test-user'] = user;
  if (form) headers['Content-Type'] = form.contentType;
  else if (body !== undefined || raw !== undefined) headers['Content-Type'] = 'application/json';
  return app.request(path, {
    method,
    headers,
    ...(form
      ? { body: form.body }
      : raw !== undefined
        ? { body: raw }
        : body !== undefined
          ? { body: JSON.stringify(body) }
          : {}),
  });
}

/**
 * Role-aware stand-in for an auth middleware: no credential → 401, a role
 * outside `allowed` → 403 with `code`, otherwise the context is populated the
 * way the real middleware populates it.
 */
export function makeRoleGate(allowed: string[], code: string, defaultRole = allowed[0]) {
  return async (c: any, next: any) => {
    if (!c.req.header('Authorization')) {
      return c.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, 401);
    }
    const role = c.req.header('x-test-role') ?? defaultRole;
    if (!allowed.includes(role)) {
      return c.json({ error: 'Forbidden', code }, 403);
    }
    const userId = c.req.header('x-test-user') ?? DEFAULT_TEST_USER;
    c.set('userRole', role);
    c.set('userId', userId);
    c.set('user', { id: userId, email: `${userId}@test.co` });
    await next();
  };
}

/** Distinct method+path registrations on a mounted app, for gate coverage checks. */
export function routeRegistrations(app: unknown): { method: string; path: string }[] {
  return (app as { routes: { method: string; path: string }[] }).routes;
}
