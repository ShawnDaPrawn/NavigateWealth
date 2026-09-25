/**
 * Staff-only routers — a signed-in CLIENT is refused on every route.
 * ================================================================
 *
 * The compliance registers, the website-submissions inbox and the newsletter
 * subscriber admin were guarded with `requireAuth`, which any self-registered
 * client passes. Each is firm-wide data (every client's AML/FICA screening,
 * every lead the website collected, the whole subscriber list), and every
 * caller in the SPA is in the admin panel, which only admin and super_admin can
 * open. They are now `requireAdmin`.
 *
 * How this pins it: the routers are mounted for real, and the auth module is
 * replaced by a role-aware stand-in in which `requireAuth` admits ANY signed-in
 * role and `requireAdmin` admits only admins. Every registered route is then
 * requested as a client. A route that slips back to `requireAuth` — or a new
 * route added without a guard — lets the client through and fails here, with
 * no list of routes to keep in sync by hand: the list is the router's own.
 */
import { describe, it, expect, vi } from 'vitest';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);

vi.mock('../auth-mw.ts', async () => {
  const { makeRoleGate } = await import('./helpers/contract-harness.ts');
  const anyRole = ['client', 'adviser', 'admin', 'super_admin', 'super-admin'];
  return {
    requireAuth: makeRoleGate(anyRole, 'AUTH_REQUIRED', 'admin'),
    requireAdmin: makeRoleGate(['admin', 'super_admin', 'super-admin'], 'FORBIDDEN_ADMIN'),
  };
});

/** Any method on these services resolves to an empty result. */
const emptyService = () =>
  new Proxy({}, { get: (_t, prop) => (prop === 'then' ? undefined : async () => []) });

vi.mock('../compliance-service.ts', () => ({
  ComplianceService: class {
    constructor() {
      return emptyService();
    }
  },
}));
vi.mock('../submissions-service.ts', () => ({ submissionsService: emptyService() }));
vi.mock('../newsletter-service.ts', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, listSubscribers: async () => [] };
});
vi.mock('../newsletter-group-service.ts', () => ({
  addNewsletterSubscriber: vi.fn(async () => undefined),
  removeNewsletterSubscriber: vi.fn(async () => undefined),
  backfillLegacyNewsletterSubscribersToGroup: vi.fn(async () => undefined),
}));
vi.mock('../email-service.ts', () => ({
  sendEmail: vi.fn(async () => true),
  createEmailTemplate: vi.fn((c: string) => c),
  createPlainTextEmail: vi.fn((c: string) => c),
  getFooterSettings: vi.fn(async () => ({})),
}));
vi.mock('../admin-audit-service.ts', () => ({
  AdminAuditService: { record: vi.fn(async () => undefined) },
}));

const { request, routeRegistrations } = await import('./helpers/contract-harness.ts');
const compliance = (await import('../compliance-routes.ts')).default;
const submissions = (await import('../submissions-routes.ts')).default;
const newsletter = (await import('../newsletter.tsx')).default;

type App = Parameters<typeof request>[0] & { routes: unknown };

/** Every method+path the router registers (middleware entries excluded). */
function registered(app: App, include: (method: string, path: string) => boolean) {
  const seen = new Set<string>();
  const out: Array<[string, string]> = [];
  for (const { method, path } of routeRegistrations(app)) {
    if (method === 'ALL' || !include(method, path)) continue;
    const key = `${method} ${path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push([method, path]);
  }
  return out;
}

const concrete = (path: string) => path.replace(/:[A-Za-z_]+/g, 'x');

const ROUTERS: Array<{
  name: string;
  app: App;
  include: (method: string, path: string) => boolean;
  minRoutes: number;
}> = [
  { name: 'compliance', app: compliance, include: () => true, minRoutes: 60 },
  {
    name: 'submissions',
    app: submissions,
    // `POST /` is the public website-form endpoint, deliberately open.
    include: (method, path) => !(method === 'POST' && path === '/'),
    minRoutes: 6,
  },
  {
    name: 'newsletter admin',
    app: newsletter,
    include: (_method, path) => path.startsWith('/admin/'),
    minRoutes: 9,
  },
];

describe.each(ROUTERS)('$name — admin only', ({ app, include, minRoutes }) => {
  const routes = registered(app, include);

  it('the route table is what this test thinks it is', () => {
    // Guards against the walk silently covering nothing (a mount change, a
    // renamed prefix) and passing vacuously.
    expect(routes.length).toBeGreaterThanOrEqual(minRoutes);
  });

  it.each(routes)('refuses a signed-in client: %s %s', async (method, path) => {
    const res = await request(app, concrete(path), {
      as: 'client',
      method,
      ...(method === 'GET' || method === 'DELETE' ? {} : { body: {} }),
    });
    expect(res.status).toBe(403);
  });

  it.each(routes)('refuses no session at all: %s %s', async (method, path) => {
    const res = await request(app, concrete(path), { auth: false, method });
    expect(res.status).toBe(401);
  });
});

describe('an admin still gets through', () => {
  it.each([
    ['compliance', compliance, '/aml-fica'],
    ['submissions', submissions, '/'],
    ['newsletter', newsletter, '/admin/subscribers'],
  ] as const)('%s GET %s', async (_name, app, path) => {
    const res = await request(app, path, { as: 'admin' });
    expect(res.status).toBe(200);
  });
});
