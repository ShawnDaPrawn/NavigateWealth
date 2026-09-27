/**
 * Browser runtime issue ingest — POST /runtime-client and /runtime-client/public
 * ===========================================================================
 *
 * WHAT MATTERS HERE
 *
 * 1. **Labels an admin can read.** A report arrives as `{kind, errorName,
 *    message, …}`; what is stored must be a sentence-level title and summary,
 *    with the technical context kept out of `message`.
 *
 * 2. **One bug, one issue.** The same failure hit on different records, or on
 *    a new deploy (new line/column in the minified bundle), must collapse into
 *    one issue with a rising occurrence count and a users-affected count.
 *
 * 3. **Signed-out reports are accepted, and bounded.** The login page, public
 *    site and signer flow run without a session; their errors used to be
 *    dropped. The public route is IP rate-limited, always answers 204, and is
 *    stored apart from signed-in reports.
 *
 * 4. **No credential is stored.** The e-sign signer URL carries its token in
 *    the query string. Every URL is reduced to origin + path before storage.
 *
 * Run: npx vitest run src/supabase/functions/server/__tests__/quality-issues-runtime-client.contract.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Context, Next } from 'hono';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = {
    env: { get: (k: string) => (k === 'SUPABASE_URL' ? 'https://test.supabase.co' : 'test') },
  };
});

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);
vi.mock('../auth-mw.ts', () => ({
  requireAuth: async (c: Context, next: Next) => {
    if (!c.req.header('Authorization')) {
      return c.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, 401);
    }
    const userId = c.req.header('x-test-user') ?? 'user-1';
    c.set('user', { id: userId, email: `${userId}@test.co` });
    await next();
  },
  requireAdmin: async (c: Context) => c.json({ error: 'Forbidden' }, 403),
}));

const { kvStore } = await import('./helpers/contract-harness.ts');
const app = (await import('../quality-issues-routes.ts')).default;
const { RUNTIME_CLIENT_ISSUES_KEY, RUNTIME_CLIENT_PUBLIC_KEY_PREFIX } =
  await import('../quality-issues-normalize.ts');
const { RUNTIME_CLIENT_PUBLIC_IP_LIMIT_PER_HOUR } = await import('../public-form-rate-limit.ts');
const { stripSensitiveUrl } = await import('../quality-issues-runtime-client.ts');

type StoredIssue = {
  title: string;
  message: string;
  summary?: string;
  details?: string;
  occurrences: number;
  affectedUsers?: number;
  severity: string;
  anonymous?: boolean;
  breadcrumbs?: string[];
};

const SIGNER_TOKEN = 'a1b2c3d4-dead-4beef-8000-feedfacecafe';

const crash = (overrides: Record<string, unknown> = {}) => ({
  kind: 'react-error-boundary',
  title: 'TypeError',
  message: "Cannot read properties of undefined (reading 'map')",
  href: 'https://app.example/admin?module=clients&clientId=77',
  stack: 'TypeError: x\n at a (https://app.example/assets/ClientsModule-3fa2b1c4.js:1:2345)',
  line: 1,
  column: 2345,
  breadcrumbs: ['10:00:00 navigate /admin?module=clients', '10:00:02 click button "Open"'],
  ...overrides,
});

function postSignedIn(body: unknown, user = 'user-1') {
  return app.request('/runtime-client', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t', 'x-test-user': user },
    body: JSON.stringify(body),
  });
}

function postPublic(body: unknown, ip = '203.0.113.9') {
  return app.request('/runtime-client/public', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
    body: JSON.stringify(body),
  });
}

const signedInIssues = () => (kvStore.get(RUNTIME_CLIENT_ISSUES_KEY) as StoredIssue[]) ?? [];
const publicIssues = () =>
  [...kvStore.entries()]
    .filter(([key]) => key.startsWith(RUNTIME_CLIENT_PUBLIC_KEY_PREFIX))
    .map(([, value]) => value as StoredIssue);

beforeEach(() => {
  kvStore.clear();
});

describe('signed-in ingest', () => {
  it('stores a readable title, summary and the context outside the message', async () => {
    const res = await postSignedIn(crash());
    expect(res.status).toBe(200);

    const [issue] = signedInIssues();
    expect(issue.title).toBe(
      "Screen crashed: Read 'map' of undefined · Admin · Clients (Clients Module)",
    );
    expect(issue.message).toBe("Cannot read properties of undefined (reading 'map')");
    expect(issue.summary).toContain('Where: Admin · Clients');
    expect(issue.details).toContain('Last reported by: user-1@test.co');
    expect(issue.breadcrumbs).toHaveLength(2);
  });

  it('groups the same crash across users and deploys, counting who was affected', async () => {
    await postSignedIn(crash(), 'user-1');
    await postSignedIn(crash({ line: 1, column: 9999 }), 'user-2');
    await postSignedIn(
      crash({ href: 'https://app.example/admin?module=clients&clientId=5' }),
      'user-1',
    );

    const issues = signedInIssues();
    expect(issues).toHaveLength(1);
    expect(issues[0].occurrences).toBe(3);
    expect(issues[0].affectedUsers).toBe(2);
  });

  it('files handled errors as warnings headlined by the developer’s words', async () => {
    await postSignedIn({
      kind: 'handled-error',
      title: 'APIError',
      message: 'Server returned 500: Internal Server Error',
      context: 'Failed to load client policies',
      href: 'https://app.example/admin?module=policies',
    });
    const [issue] = signedInIssues();
    expect(issue.severity).toBe('warning');
    expect(issue.title).toContain('Failed to load client policies');
  });

  it('still requires a session', async () => {
    const res = await app.request('/runtime-client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(crash()),
    });
    expect(res.status).toBe(401);
  });
});

describe('public (signed-out) ingest', () => {
  it('accepts a report without a session and stores it apart, marked anonymous', async () => {
    const res = await postPublic(crash({ href: 'https://app.example/login' }));
    expect(res.status).toBe(204);

    expect(signedInIssues()).toHaveLength(0);
    const [issue] = publicIssues();
    expect(issue.anonymous).toBe(true);
    expect(issue.details).toContain('signed-out visitor');
  });

  it('never stores the signer token from the URL, stack or breadcrumbs', async () => {
    await postPublic(
      crash({
        href: `https://app.example/sign?token=${SIGNER_TOKEN}`,
        filePath: `https://app.example/sign?token=${SIGNER_TOKEN}`,
        stack: `Error: x\n at https://app.example/sign?token=${SIGNER_TOKEN}:1:1`,
        breadcrumbs: [`navigate https://app.example/sign?token=${SIGNER_TOKEN}`],
      }),
    );
    expect(JSON.stringify([...kvStore.entries()])).not.toContain(SIGNER_TOKEN);
  });

  it('answers 204 and stores nothing once an IP is over its hourly limit', async () => {
    for (let i = 0; i < RUNTIME_CLIENT_PUBLIC_IP_LIMIT_PER_HOUR; i += 1) {
      await postPublic(crash({ message: `distinct failure ${'x'.repeat(i + 1)}` }), '198.51.100.1');
    }
    const before = publicIssues().length;
    const res = await postPublic(crash({ message: 'one too many' }), '198.51.100.1');
    expect(res.status).toBe(204);
    expect(publicIssues()).toHaveLength(before);
  });

  it('ignores a body with no message', async () => {
    const res = await postPublic({ kind: 'window-error' });
    expect(res.status).toBe(204);
    expect(publicIssues()).toHaveLength(0);
  });
});

describe('stripSensitiveUrl', () => {
  it('keeps origin, path and the screen-naming params only', () => {
    expect(stripSensitiveUrl('https://h/admin?module=tasks&token=abc#x')).toBe(
      'https://h/admin?module=tasks',
    );
    expect(stripSensitiveUrl('/relative/path?token=abc')).toBe('/relative/path');
  });
});
