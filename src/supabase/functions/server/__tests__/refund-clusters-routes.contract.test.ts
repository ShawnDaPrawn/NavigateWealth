/**
 * locked/refund-clusters-routes.ts — Authorization & Audit Contract
 * ================================================================
 *
 * 25 routes over the most sensitive data the platform stores: a refund cluster
 * holds a client's tax number, eFiling password, bank account numbers and
 * online-banking password. This file pins the two protections that are
 * invisible when they break; `refund-clusters-storage.contract.test.ts` covers
 * the storage half.
 *
 *   1. `app.use('*', requireSuperAdmin)` — a SINGLE line gating all 25 routes.
 *      Delete it, or register a route above it, and every admin, adviser and
 *      paraplanner in the business can read decrypted banking credentials. No
 *      test that only walks the happy path would notice. So the gate is
 *      asserted per route, per role, from a table built from the route list
 *      itself (`helpers/refund-clusters-harness.ts`).
 *   2. The audit trail — every mutation and every sensitive read is written to
 *      the admin audit log, password reveals at `critical` severity. Dropping
 *      an `audit(...)` call breaks nothing a user can see; it just means the
 *      FAIS record of who read a client's banking password no longer exists.
 *      Severity and action name are pinned per route.
 *
 * WHAT IS MOCKED, AND WHY
 * -----------------------
 * The service layer, the Supabase storage client and the audit service are
 * stubbed; the real Hono app, the real `asyncHandler` error envelope and the
 * module's own inline validation run as they ship. `requireSuperAdmin` is
 * replaced with a role-aware stand-in that mirrors the real predicate
 * (including the legacy `super-admin` spelling) — the point is to prove this
 * module APPLIES the gate to every route, not to re-test auth-mw, which has
 * its own suite.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import {
  alignFileGlobal,
  request,
  routeRegistrations,
  type RequestOptions,
} from './helpers/contract-harness.ts';
import {
  CLUSTER,
  ENTITY,
  FORBIDDEN_ROLES,
  ROUTES,
  SUPER_ADMIN_SPELLINGS,
  auditRecord,
  lastAudit,
  pdfUpload,
  resetRefundClusterMocks,
  storage,
  svc,
  type Route,
} from './helpers/refund-clusters-harness.ts';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});

vi.mock('../locked/refund-clusters-service.ts', async () => ({
  RefundClustersService: (await import('./helpers/refund-clusters-harness.ts')).svc,
}));

vi.mock('../admin-audit-service.ts', async () => ({
  AdminAuditService: {
    record: (await import('./helpers/refund-clusters-harness.ts')).auditRecord,
  },
}));

vi.mock('jsr:@supabase/supabase-js@2.49.8', async () =>
  (await import('./helpers/refund-clusters-harness.ts')).makeSupabaseMock(),
);

vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);

vi.mock('../quality-issues-runtime-server.ts', () => ({ scheduleRuntimeServerIssue: vi.fn() }));

/**
 * Role-aware stand-in for the real `requireSuperAdmin`, mirroring its two
 * decisions exactly: no credential → 401, wrong role → 403 with the shipped
 * code, and BOTH accepted spellings of super admin pass. Anything looser here
 * would make the authorization table vacuous.
 */
vi.mock('../auth-mw.ts', async () => ({
  requireSuperAdmin: (await import('./helpers/contract-harness.ts')).makeRoleGate(
    ['super_admin', 'super-admin'],
    'FORBIDDEN_SUPER_ADMIN',
  ),
}));

const app = (await import('../locked/refund-clusters-routes.ts')).default;

/** See `contract-harness.ts` for why the `File` global has to be realigned. */
beforeAll(async () => {
  await alignFileGlobal();
});

const req = (path: string, opts: RequestOptions = {}) =>
  request(app, path, { as: 'super_admin', ...opts });

const call = (r: Route, opts: RequestOptions = {}) =>
  req(r.path, {
    method: r.method,
    ...(r.form ? { form: pdfUpload() } : r.body !== undefined ? { body: r.body } : {}),
    ...opts,
  });

beforeEach(() => {
  vi.clearAllMocks();
  resetRefundClusterMocks();
});

// ============================================================================
// THE GATE — super admin, on every route, without exception
// ============================================================================

describe('super-admin gate', () => {
  it('covers every route the module registers', () => {
    // Guards the table above. `app.routes` includes the `app.use('*', …)`
    // middleware entry, so filter to handler registrations.
    const registered = routeRegistrations(app)
      .filter((r) => r.method !== 'ALL')
      .map((r) => `${r.method} ${r.path}`);
    expect(new Set(registered).size).toBe(ROUTES.length);
  });

  it('applies the gate as middleware, not per route', () => {
    // One `ALL /*` entry is what makes the gate un-bypassable by a new route.
    // If someone converts it to per-route middleware, a route added later can
    // quietly ship ungated — so the shape itself is pinned.
    const all = routeRegistrations(app).filter((r) => r.method === 'ALL');
    expect(all).toHaveLength(1);
    expect(all[0].path).toBe('/*');
  });

  it.each(ROUTES)('$method $path ($name) rejects an unauthenticated caller', async (r) => {
    const res = await call(r, { auth: false });
    expect(res.status).toBe(401);
    expect(auditRecord).not.toHaveBeenCalled();
  });

  describe.each(FORBIDDEN_ROLES)('as %s', (role) => {
    it.each(ROUTES)('$method $path ($name) is forbidden', async (r) => {
      const res = await call(r, { as: role });
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ code: 'FORBIDDEN_SUPER_ADMIN' });
      // The refusal must be total: no service call, no storage touch, and — for
      // the reveal routes — no decryption of a password on the way to the 403.
      expect(svc.revealEfilingPassword).not.toHaveBeenCalled();
      expect(svc.revealBankPassword).not.toHaveBeenCalled();
      expect(storage.createSignedUrl).not.toHaveBeenCalled();
      expect(storage.remove).not.toHaveBeenCalled();
      expect(auditRecord).not.toHaveBeenCalled();
    });
  });

  describe.each(SUPER_ADMIN_SPELLINGS)('as %s', (role) => {
    it.each(ROUTES)('$method $path ($name) is allowed', async (r) => {
      const res = await call(r, { as: role });
      expect(res.status).toBe(r.ok);
    });
  });
});

// ============================================================================
// THE AUDIT TRAIL — the FAIS record of who touched what
// ============================================================================

type AuditCase = Route & { action: string; severity: 'info' | 'warning' | 'critical' };

/**
 * The 21 routes that MUST leave an audit entry, and the entry each one leaves.
 *
 * Severity is pinned per row rather than spot-checked because it is what the
 * compliance review filters on: a password reveal downgraded from `critical`
 * to `info` still writes a row, still returns the password, and disappears
 * from the report that exists to catch exactly that access.
 */
const AUDITED: AuditCase[] = [
  { action: 'refund_cluster_created', severity: 'info', ...ROUTES[1] },
  { action: 'refund_cluster_updated', severity: 'info', ...ROUTES[2] },
  { action: 'refund_cluster_deleted', severity: 'warning', ...ROUTES[3] },
  { action: 'refund_cluster_viewed', severity: 'info', ...ROUTES[4] },
  { action: 'refund_entity_created', severity: 'info', ...ROUTES[5] },
  { action: 'refund_entity_updated', severity: 'info', ...ROUTES[6] },
  { action: 'refund_entity_deleted', severity: 'warning', ...ROUTES[7] },
  { action: 'refund_entity_password_revealed', severity: 'critical', ...ROUTES[8] },
  { action: 'refund_entity_bank_password_revealed', severity: 'critical', ...ROUTES[9] },
  { action: 'refund_entity_document_uploaded', severity: 'info', ...ROUTES[11] },
  { action: 'refund_entity_document_viewed', severity: 'info', ...ROUTES[12] },
  { action: 'refund_entity_document_deleted', severity: 'warning', ...ROUTES[13] },
  { action: 'refund_transaction_created', severity: 'info', ...ROUTES[15] },
  { action: 'refund_transaction_updated', severity: 'info', ...ROUTES[16] },
  { action: 'refund_transaction_deleted', severity: 'warning', ...ROUTES[17] },
  { action: 'refund_transaction_invoice_uploaded', severity: 'info', ...ROUTES[18] },
  { action: 'refund_transaction_invoice_viewed', severity: 'info', ...ROUTES[19] },
  { action: 'refund_transaction_invoice_deleted', severity: 'warning', ...ROUTES[20] },
  { action: 'refund_manager_created', severity: 'info', ...ROUTES[22] },
  { action: 'refund_manager_updated', severity: 'info', ...ROUTES[23] },
  { action: 'refund_manager_deleted', severity: 'warning', ...ROUTES[24] },
];

/** The four routes that return sanitized lists and deliberately do not audit. */
const UNAUDITED = [ROUTES[0], ROUTES[10], ROUTES[14], ROUTES[21]];

describe('audit trail', () => {
  it('accounts for every route — audited plus unaudited equals the module', () => {
    expect(AUDITED.length + UNAUDITED.length).toBe(ROUTES.length);
  });

  it.each(AUDITED)('$method $path ($name) records $action at $severity', async (r) => {
    const res = await call(r, { user: 'sa-42' });
    expect(res.status).toBe(r.ok);
    expect(auditRecord).toHaveBeenCalledTimes(1);
    expect(lastAudit()).toMatchObject({
      action: r.action,
      severity: r.severity,
      category: 'security',
      // The actor is read off the request context, not passed in by the caller
      // — an audit row attributable to the wrong person is worse than none.
      actorId: 'sa-42',
      actorRole: 'super_admin',
    });
  });

  it.each(UNAUDITED)('$method $path ($name) does not audit a plain list read', async (r) => {
    const res = await call(r);
    expect(res.status).toBe(r.ok);
    expect(auditRecord).not.toHaveBeenCalled();
  });

  it('distinguishes archive from unarchive from a plain update', async () => {
    // All three are PUT /:clusterId. The action name is the only thing that
    // separates "an admin archived this cluster" from "an admin renamed it" in
    // the audit report, and it is derived from the body, not the route.
    for (const [body, action] of [
      [{ archived: true }, 'refund_cluster_archived'],
      [{ archived: false }, 'refund_cluster_unarchived'],
      [{ name: 'renamed' }, 'refund_cluster_updated'],
    ] as const) {
      auditRecord.mockClear();
      const res = await req(`/${CLUSTER}`, { method: 'PUT', body });
      expect(res.status).toBe(200);
      expect(lastAudit()).toMatchObject({ action });
    }
  });

  it('records how many entities a cluster deletion took with it', async () => {
    svc.deleteCluster.mockResolvedValue({ entitiesDeleted: 7 });
    await req(`/${CLUSTER}`, { method: 'DELETE' });
    expect(lastAudit()).toMatchObject({ metadata: { entitiesDeleted: 7 } });
  });

  it('names the account whose banking password was revealed', async () => {
    // 'primary' vs 'secondary' is the difference between two different bank
    // accounts; an audit row that does not say which is not an audit row.
    await req(`/${CLUSTER}/entities/${ENTITY}/bank-password/reveal`, {
      method: 'POST',
      body: { account: 'secondary' },
    });
    expect(lastAudit()).toMatchObject({
      action: 'refund_entity_bank_password_revealed',
      severity: 'critical',
      metadata: { account: 'secondary' },
    });
  });

  it('never puts a revealed password in the audit metadata', async () => {
    await req(`/${CLUSTER}/entities/${ENTITY}/efiling-password/reveal`, { method: 'POST' });
    await req(`/${CLUSTER}/entities/${ENTITY}/bank-password/reveal`, {
      method: 'POST',
      body: { account: 'primary' },
    });
    // The audit log is read by more people than the reveal endpoint is; a
    // plaintext password copied into it defeats the encryption at rest.
    const serialised = JSON.stringify(auditRecord.mock.calls);
    expect(serialised).not.toContain('efiling-secret');
    expect(serialised).not.toContain('bank-secret');
  });

  it('records the entity id, not the cluster id, for entity-scoped actions', async () => {
    await req(`/${CLUSTER}/entities/${ENTITY}`, { method: 'DELETE' });
    expect(lastAudit()).toMatchObject({
      entityType: 'refund_entity',
      entityId: ENTITY,
      metadata: { clusterId: CLUSTER },
    });
  });

  it('audits before responding, so a slow write cannot be dropped by isolate teardown', async () => {
    // Every call site awaits `audit(...)`. If one stops awaiting, the Edge
    // isolate can suspend after the response and lose the entry — a class of
    // bug that never shows up in a status code.
    let settled = false;
    auditRecord.mockImplementation(
      () =>
        new Promise<undefined>((resolve) =>
          setTimeout(() => {
            settled = true;
            resolve(undefined);
          }, 5),
        ),
    );
    const res = await req(`/${CLUSTER}/entities/${ENTITY}/efiling-password/reveal`, {
      method: 'POST',
    });
    expect(res.status).toBe(200);
    expect(settled).toBe(true);
  });
});
