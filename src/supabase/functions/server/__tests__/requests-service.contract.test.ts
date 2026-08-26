/**
 * requests-service.ts — Self-Healing Data Layer Contract
 * ======================================================
 *
 * 206 statements, 0% coverage before this file. It is the workflow engine behind
 * compliance requests: templates, lifecycle stages, compliance sign-off, and an
 * append-only audit log.
 *
 * The thing that makes it worth testing rather than trusting is its own design
 * choice. Every stored record goes through `validateAndHealRequest`, and the zod
 * schema behind it is deliberately lenient — `.default()` on nearly every field,
 * `.catch()` on the enums, `.passthrough()` at the top. The comment in the
 * source explains why: strict parsing meant malformed KV rows crashed the
 * frontend, so the layer repairs instead of rejecting.
 *
 * That is a reasonable trade and it has a cost: **the layer silently rewrites
 * data.** A record with an unrecognised status comes back with a different one,
 * and nothing in the response says so. So the tests here are mostly about what
 * the healing does and does not change:
 *
 *   - It must never lose the `id`. A healed record an operator cannot find is
 *     worse than a rejected one.
 *   - Every fallback value is pinned by name, because each is a silent data
 *     correction and the CHOICE of fallback is the decision.
 *   - The salvage path (used when even the lenient parse fails) must produce a
 *     shape the frontend can render, which is the only reason it exists.
 *
 * Beyond healing: the finalisation gate (a request whose sign-off is required
 * but not approved must not finalise), the immutability of a finalised request,
 * and the audit entry that accompanies every mutation.
 *
 * WHAT IS REAL: everything except KV. The zod schemas, the healing, `APIError`
 * and the enums all run as they ship.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { kvStore } from './helpers/contract-harness.ts';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);

vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);

vi.mock('../quality-issues-runtime-server.ts', () => ({ scheduleRuntimeServerIssue: vi.fn() }));

const { RequestsService } = await import('../requests-service.ts');
const types = await import('../requests-types.ts');
const { RequestStatus, RequestPriority, TemplateStatus, ApprovalOutcome, AssignmentRule } = types;

const service = new RequestsService();

const USER = 'user-1';
const USER_NAME = 'Thabo Mokoena';
const TEMPLATE = 'tmpl-1';
const REQUEST = 'req-1';

/** A template stored the way `createTemplate` would have stored it. */
function seedTemplate(id = TEMPLATE, over: Record<string, unknown> = {}) {
  const template = {
    id,
    version: 1,
    name: 'Section 14 Transfer',
    category: 'Retirement',
    requestType: 'Transfer',
    clientAssociationRule: 'required',
    defaultPriority: RequestPriority.MEDIUM,
    defaultQueue: 'New Requests',
    status: TemplateStatus.ACTIVE,
    requestDetailsSchema: [],
    assigneeConfiguration: {
      defaultRoles: [],
      assignmentRule: AssignmentRule.MANUAL_REQUIRED,
      allowExternalAssignees: false,
      reminderConfig: {
        enabled: false,
        intervalHours: 48,
        sendToInternal: true,
        sendToExternal: false,
      },
    },
    complianceApprovalConfig: { enabled: false, checklistItems: [] },
    lifecycleConfiguration: { stages: [] },
    complianceSignOffConfig: {
      enabled: false,
      approverRole: 'Super Admin',
      deficiencyWorkflow: {
        allowDeficiencies: true,
        requireRemedialDocuments: false,
        requireRemedialComments: false,
      },
    },
    finalisationConfig: { completionStateLabel: 'Completed' },
    createdBy: USER,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedBy: USER,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
  kvStore.set(`requests:template:${id}`, template);
  return template;
}

/** Writes a raw request record straight to KV, bypassing the service. */
function seedRaw(id: string, raw: Record<string, unknown>) {
  kvStore.set(`requests:request:${id}`, { id, ...raw });
}

/** A minimally complete, schema-valid request. */
function seedRequest(id = REQUEST, over: Record<string, unknown> = {}) {
  seedRaw(id, {
    templateId: TEMPLATE,
    templateVersion: 1,
    status: RequestStatus.NEW,
    priority: RequestPriority.MEDIUM,
    requestDetails: {},
    assignees: [],
    complianceApproval: { required: false, checklistStatus: [] },
    lifecycle: { stageHistory: [] },
    complianceSignOff: { required: false, deficiencies: [] },
    finalised: false,
    documentIds: [],
    createdBy: USER,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedBy: USER,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  });
}

const auditEntries = () => {
  const out: Record<string, unknown>[] = [];
  kvStore.forEach((v, k) => {
    if (k.startsWith('requests:audit:')) out.push(v as Record<string, unknown>);
  });
  return out;
};

beforeEach(() => {
  kvStore.clear();
  vi.clearAllMocks();
});

// ============================================================================
// HEALING — what the layer silently rewrites
// ============================================================================

describe('healing a partial record', () => {
  it('fills the collection fields so the frontend never maps over undefined', async () => {
    // This is the whole reason the layer exists: a record written before a field
    // was added must still render.
    seedRaw(REQUEST, { templateId: TEMPLATE });
    const healed = await service.getRequestById(REQUEST);
    expect(healed).toMatchObject({
      id: REQUEST,
      assignees: [],
      documentIds: [],
      requestDetails: {},
      lifecycle: { stageHistory: [] },
      complianceApproval: { required: false, checklistStatus: [] },
      complianceSignOff: { required: false, deficiencies: [] },
      finalised: false,
    });
  });

  it('keeps the id it was given', async () => {
    // A healed record whose id changed is unfindable. Asserted on its own
    // because every other repair is recoverable and this one is not.
    seedRaw('req-weird-id', { status: 'nonsense', priority: 42, assignees: 'not-an-array' });
    expect((await service.getRequestById('req-weird-id'))!.id).toBe('req-weird-id');
  });

  it('defaults the actor fields to system rather than leaving them blank', async () => {
    seedRaw(REQUEST, { templateId: TEMPLATE });
    const healed = await service.getRequestById(REQUEST);
    expect(healed).toMatchObject({ createdBy: 'system', updatedBy: 'system' });
  });

  it('stamps timestamps when the record has none', async () => {
    seedRaw(REQUEST, { templateId: TEMPLATE });
    const healed = await service.getRequestById(REQUEST);
    expect(Date.parse(healed!.createdAt)).not.toBeNaN();
    expect(Date.parse(healed!.updatedAt)).not.toBeNaN();
  });

  it('preserves fields the schema does not know about', async () => {
    // `.passthrough()` — a field added by a newer writer must survive a read by
    // an older reader, or a deploy skew silently deletes data.
    seedRaw(REQUEST, { templateId: TEMPLATE, someFutureField: 'keep me' });
    const healed = (await service.getRequestById(REQUEST)) as unknown as Record<string, unknown>;
    expect(healed.someFutureField).toBe('keep me');
  });

  it('returns null for a request that does not exist, rather than a healed blank', async () => {
    // The difference matters: a healed blank would appear in the UI as a real
    // request with an id nobody recognises.
    expect(await service.getRequestById('nope')).toBeNull();
  });
});

describe('enum fallbacks — each one is a silent data correction', () => {
  it.each([
    ['an unknown status', { status: 'Blocked' }, 'status', RequestStatus.NEW],
    ['a numeric status', { status: 7 }, 'status', RequestStatus.NEW],
    ['an unknown priority', { priority: 'Critical' }, 'priority', RequestPriority.MEDIUM],
    ['a null priority', { priority: null }, 'priority', RequestPriority.MEDIUM],
  ])('rewrites %s to the safe default', async (_label, over, field, expected) => {
    // `.catch()` on the enum. The record comes back with a DIFFERENT value than
    // was stored and nothing in the response says so — which is the trade this
    // layer makes on purpose. Pinned per field so the choice of fallback is a
    // decision on the record rather than an accident.
    seedRaw(REQUEST, { templateId: TEMPLATE, ...over });
    const healed = (await service.getRequestById(REQUEST)) as unknown as Record<string, unknown>;
    expect(healed[field]).toBe(expected);
  });

  it.each(Object.values(RequestStatus))('leaves the valid status %s alone', async (status) => {
    seedRaw(REQUEST, { templateId: TEMPLATE, status });
    expect((await service.getRequestById(REQUEST))!.status).toBe(status);
  });

  it.each(Object.values(RequestPriority))(
    'leaves the valid priority %s alone',
    async (priority) => {
      seedRaw(REQUEST, { templateId: TEMPLATE, priority });
      expect((await service.getRequestById(REQUEST))!.priority).toBe(priority);
    },
  );

  it('rewrites an unrecognised assignee role to Admin', async () => {
    /**
     * `role: z.enum([...]).catch('Admin')`.
     *
     * Worth flagging rather than just recording: of the four accepted values
     * (Admin, Adviser, Compliance Officer, External), `Admin` is the most
     * privileged-sounding and `External` the least, so the fallback errs toward
     * the wrong end. Verified before writing this that it is NOT a security
     * issue — nothing in the codebase reads `assignees[].role` for an access
     * decision (auth comes from `resolveTrustedRole`), so this is a workflow and
     * display label. Still a questionable default if a future change ever does
     * gate on it.
     */
    seedRaw(REQUEST, {
      templateId: TEMPLATE,
      assignees: [
        { userId: 'u1', userName: 'A', role: 'Overlord', assignedAt: 'now', assignedBy: 'x' },
      ],
    });
    const healed = await service.getRequestById(REQUEST);
    expect(healed!.assignees[0].role).toBe('Admin');
  });

  it.each(['Admin', 'Adviser', 'Compliance Officer', 'External'])(
    'leaves the valid assignee role %s alone',
    async (role) => {
      seedRaw(REQUEST, {
        templateId: TEMPLATE,
        assignees: [{ userId: 'u1', userName: 'A', role, assignedAt: 'now', assignedBy: 'x' }],
      });
      expect((await service.getRequestById(REQUEST))!.assignees[0].role).toBe(role);
    },
  );
});

describe('the salvage path', () => {
  it.each([
    ['assignees as a string', { assignees: 'u1,u2' }],
    ['lifecycle as an array', { lifecycle: [] }],
    ['complianceApproval as a string', { complianceApproval: 'yes' }],
    ['documentIds as an object', { documentIds: { 0: 'doc-1' } }],
  ])('produces a renderable record when the parse cannot coerce %s', async (_label, over) => {
    // The hand-rolled salvage in `validateAndHealRequest`. It exists for exactly
    // these shapes — an array where an object belongs, and vice versa, which
    // zod's defaults cannot repair.
    seedRaw(REQUEST, { templateId: TEMPLATE, ...over });
    const healed = await service.getRequestById(REQUEST);
    expect(healed!.id).toBe(REQUEST);
    expect(Array.isArray(healed!.assignees)).toBe(true);
    expect(Array.isArray(healed!.documentIds)).toBe(true);
    expect(Array.isArray(healed!.lifecycle.stageHistory)).toBe(true);
    expect(Array.isArray(healed!.complianceSignOff.deficiencies)).toBe(true);
    expect(Array.isArray(healed!.complianceApproval.checklistStatus)).toBe(true);
  });

  it('falls back to "unknown" for a record with no id or template', async () => {
    // The one place the id is not preserved, because there was none. "unknown"
    // is at least a searchable marker.
    kvStore.set('requests:request:orphan', { status: 'New', assignees: 'broken' });
    const healed = await service.getRequestById('orphan');
    expect(healed).toMatchObject({ id: 'unknown', templateId: 'unknown', templateVersion: 1 });
  });

  it('heals every record in a list, not just the readable ones', async () => {
    // One malformed row must not take the whole list down — this is the failure
    // mode the layer was written for.
    seedRequest('good-1');
    seedRaw('broken-1', { templateId: TEMPLATE, assignees: 'not-an-array' });
    seedRequest('good-2');
    const all = await service.getAllRequests();
    expect(all).toHaveLength(3);
    expect(all.every((r) => Array.isArray(r.assignees))).toBe(true);
  });
});

// ============================================================================
// FILTERS
// ============================================================================

describe('request filters', () => {
  beforeEach(() => {
    seedRequest('r-new', { status: RequestStatus.NEW, clientId: 'client-a' });
    seedRequest('r-lifecycle', { status: RequestStatus.IN_LIFECYCLE, clientId: 'client-b' });
    seedRequest('r-done', {
      status: RequestStatus.COMPLETED,
      clientId: 'client-a',
      templateId: 'tmpl-other',
      assignees: [
        { userId: 'u-9', userName: 'N', role: 'Adviser', assignedAt: 'now', assignedBy: 'x' },
      ],
    });
  });

  it('returns everything when no filter is given', async () => {
    expect(await service.getAllRequests()).toHaveLength(3);
  });

  it('filters by a set of statuses, not a single one', async () => {
    const some = await service.getAllRequests({
      status: [RequestStatus.NEW, RequestStatus.COMPLETED],
    });
    expect(some.map((r) => r.id).sort()).toEqual(['r-done', 'r-new']);
  });

  it('returns nothing for a status no request holds', async () => {
    expect(await service.getAllRequests({ status: [RequestStatus.CANCELLED] })).toEqual([]);
  });

  it('filters by template', async () => {
    const some = await service.getAllRequests({ templateId: 'tmpl-other' });
    expect(some.map((r) => r.id)).toEqual(['r-done']);
  });

  it('filters by client', async () => {
    const some = await service.getAllRequests({ clientId: 'client-a' });
    expect(some.map((r) => r.id).sort()).toEqual(['r-done', 'r-new']);
  });

  it('filters by assignee, matching inside the assignee list', async () => {
    const some = await service.getAllRequests({ assigneeId: 'u-9' });
    expect(some.map((r) => r.id)).toEqual(['r-done']);
  });

  it('returns nothing for an assignee on no request', async () => {
    expect(await service.getAllRequests({ assigneeId: 'nobody' })).toEqual([]);
  });

  it('applies every filter given, not just the first', async () => {
    // AND, not OR. A filter set that matched on any one clause would show an
    // adviser requests belonging to a client they are not on.
    expect(
      await service.getAllRequests({ clientId: 'client-a', status: [RequestStatus.IN_LIFECYCLE] }),
    ).toEqual([]);
    const both = await service.getAllRequests({
      clientId: 'client-a',
      status: [RequestStatus.NEW],
    });
    expect(both.map((r) => r.id)).toEqual(['r-new']);
  });

  it('wraps a store failure as an APIError rather than leaking it', async () => {
    const kv = await import('../kv_store.tsx');
    vi.mocked(kv.getByPrefix).mockRejectedValueOnce(new Error('kv unavailable'));
    await expect(service.getAllRequests()).rejects.toThrow(/Failed to retrieve requests/);
  });
});

// ============================================================================
// CREATION FROM A TEMPLATE
// ============================================================================

describe('creating a request', () => {
  it('copies the template version onto the request', async () => {
    // The request records WHICH version of the template it was raised under, so
    // a later template edit cannot retroactively change what was asked for.
    seedTemplate(TEMPLATE, { version: 4 });
    const created = await service.createRequest(
      TEMPLATE,
      { requestDetails: { amount: 100 } },
      USER,
      USER_NAME,
    );
    expect(created).toMatchObject({ templateId: TEMPLATE, templateVersion: 4 });
  });

  it('refuses a template that does not exist', async () => {
    await expect(
      service.createRequest('ghost', { requestDetails: {} }, USER, USER_NAME),
    ).rejects.toThrow(/Template not found/);
  });

  it.each([TemplateStatus.DRAFT, TemplateStatus.ARCHIVED])(
    'refuses a %s template',
    async (status) => {
      // A draft is unfinished and an archived one is withdrawn; raising work
      // against either produces a request nobody can process.
      seedTemplate(TEMPLATE, { status });
      await expect(
        service.createRequest(TEMPLATE, { requestDetails: {} }, USER, USER_NAME),
      ).rejects.toThrow(/inactive template/);
    },
  );

  it('takes the priority from the template when the caller gives none', async () => {
    seedTemplate(TEMPLATE, { defaultPriority: RequestPriority.URGENT });
    const created = await service.createRequest(TEMPLATE, { requestDetails: {} }, USER, USER_NAME);
    expect(created.priority).toBe(RequestPriority.URGENT);
  });

  it('lets the caller override the template priority', async () => {
    seedTemplate(TEMPLATE, { defaultPriority: RequestPriority.LOW });
    const created = await service.createRequest(
      TEMPLATE,
      { requestDetails: {}, priority: RequestPriority.HIGH },
      USER,
      USER_NAME,
    );
    expect(created.priority).toBe(RequestPriority.HIGH);
  });

  it('seeds the compliance checklist from the template, all items incomplete', async () => {
    seedTemplate(TEMPLATE, {
      complianceApprovalConfig: {
        enabled: true,
        checklistItems: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }],
      },
    });
    const created = await service.createRequest(TEMPLATE, { requestDetails: {} }, USER, USER_NAME);
    expect(created.complianceApproval.required).toBe(true);
    expect(created.complianceApproval.checklistStatus).toEqual([
      { itemId: 'c1', completed: false, evidenceDocumentIds: [] },
      { itemId: 'c2', completed: false, evidenceDocumentIds: [] },
      { itemId: 'c3', completed: false, evidenceDocumentIds: [] },
    ]);
  });

  it('carries the sign-off requirement across from the template', async () => {
    seedTemplate(TEMPLATE, {
      complianceSignOffConfig: { enabled: true, approverRole: 'Super Admin' },
    });
    const created = await service.createRequest(TEMPLATE, { requestDetails: {} }, USER, USER_NAME);
    expect(created.complianceSignOff.required).toBe(true);
  });

  it('starts New, unfinalised, and attributed to the creator', async () => {
    seedTemplate();
    const created = await service.createRequest(TEMPLATE, { requestDetails: {} }, USER, USER_NAME);
    expect(created).toMatchObject({
      status: RequestStatus.NEW,
      finalised: false,
      createdBy: USER,
      updatedBy: USER,
    });
    expect(created.createdAt).toBe(created.updatedAt);
  });

  it('persists the request and an audit entry naming the template', async () => {
    seedTemplate(TEMPLATE, { name: 'Section 14 Transfer' });
    const created = await service.createRequest(TEMPLATE, { requestDetails: {} }, USER, USER_NAME);
    expect(kvStore.has(`requests:request:${created.id}`)).toBe(true);
    expect(auditEntries()).toHaveLength(1);
    expect(auditEntries()[0]).toMatchObject({
      requestId: created.id,
      performedBy: USER,
      details: { templateId: TEMPLATE, templateName: 'Section 14 Transfer' },
    });
  });

  it('gives concurrent requests distinct ids', async () => {
    seedTemplate();
    const [a, b, c] = await Promise.all([
      service.createRequest(TEMPLATE, { requestDetails: {} }, USER, USER_NAME),
      service.createRequest(TEMPLATE, { requestDetails: {} }, USER, USER_NAME),
      service.createRequest(TEMPLATE, { requestDetails: {} }, USER, USER_NAME),
    ]);
    expect(new Set([a.id, b.id, c.id]).size).toBe(3);
  });
});

// ============================================================================
// FINALISATION — the gate, and what it locks
// ============================================================================

describe('finalisation', () => {
  it('refuses to finalise while a required sign-off is not approved', async () => {
    // The one hard gate in the module. A finalised request is the firm's record
    // that the work was completed and signed off; finalising without the
    // sign-off makes that record false.
    seedTemplate();
    seedRequest(REQUEST, {
      complianceSignOff: { required: true, deficiencies: [] },
    });
    await expect(service.finaliseRequest(REQUEST, USER, USER_NAME)).rejects.toThrow(
      /Compliance sign-off must be approved/,
    );
    expect((await service.getRequestById(REQUEST))!.finalised).toBe(false);
  });

  it.each([ApprovalOutcome.REJECTED, ApprovalOutcome.DEFICIENT, ApprovalOutcome.PENDING])(
    'refuses to finalise on a %s outcome',
    async (outcome) => {
      seedTemplate();
      seedRequest(REQUEST, {
        complianceSignOff: { required: true, outcome, deficiencies: [] },
      });
      await expect(service.finaliseRequest(REQUEST, USER, USER_NAME)).rejects.toThrow(
        /Compliance sign-off must be approved/,
      );
    },
  );

  it('finalises once the sign-off is approved', async () => {
    seedTemplate();
    seedRequest(REQUEST, {
      complianceSignOff: { required: true, outcome: ApprovalOutcome.APPROVED, deficiencies: [] },
    });
    const done = await service.finaliseRequest(REQUEST, USER, USER_NAME);
    expect(done).toMatchObject({
      finalised: true,
      finalisedBy: USER,
      status: RequestStatus.COMPLETED,
    });
    expect(Date.parse(done.finalisedAt!)).not.toBeNaN();
  });

  it('finalises without a sign-off when the template never required one', async () => {
    seedTemplate();
    seedRequest(REQUEST, { complianceSignOff: { required: false, deficiencies: [] } });
    expect((await service.finaliseRequest(REQUEST, USER, USER_NAME)).finalised).toBe(true);
  });

  it('locks the request against further updates', async () => {
    // Immutability after finalisation is what makes the record evidential.
    seedTemplate();
    seedRequest(REQUEST, { complianceSignOff: { required: false, deficiencies: [] } });
    await service.finaliseRequest(REQUEST, USER, USER_NAME);
    await expect(
      service.updateRequest(REQUEST, { priority: RequestPriority.LOW }, USER, USER_NAME),
    ).rejects.toThrow(/Cannot update finalised request/);
  });

  it('refuses to finalise a request that does not exist', async () => {
    await expect(service.finaliseRequest('nope', USER, USER_NAME)).rejects.toThrow(
      /Request not found/,
    );
  });

  it('refuses to finalise when the template has since been deleted', async () => {
    seedRequest(REQUEST, { complianceSignOff: { required: false, deficiencies: [] } });
    await expect(service.finaliseRequest(REQUEST, USER, USER_NAME)).rejects.toThrow(
      /Template not found/,
    );
  });
});

// ============================================================================
// LIFECYCLE AND SIGN-OFF
// ============================================================================

describe('lifecycle stages', () => {
  beforeEach(() => {
    seedTemplate();
    seedRequest();
  });

  it('records entering the first stage and starts the lifecycle', async () => {
    const moved = await service.moveLifecycleStage(REQUEST, 'stage-1', USER, USER_NAME);
    expect(moved.status).toBe(RequestStatus.IN_LIFECYCLE);
    expect(moved.lifecycle.currentStageId).toBe('stage-1');
    expect(moved.lifecycle.stageHistory).toHaveLength(1);
    expect(Date.parse(moved.lifecycle.startedAt!)).not.toBeNaN();
  });

  it('closes the previous stage when moving on', async () => {
    // Without the exit stamp the history reads as two stages open at once, and
    // time-in-stage reporting becomes meaningless.
    await service.moveLifecycleStage(REQUEST, 'stage-1', USER, USER_NAME);
    const moved = await service.moveLifecycleStage(REQUEST, 'stage-2', USER, USER_NAME);
    expect(moved.lifecycle.stageHistory).toHaveLength(2);
    expect(moved.lifecycle.stageHistory[0].exitedAt).toBeTruthy();
    expect(moved.lifecycle.stageHistory[1].exitedAt).toBeUndefined();
    expect(moved.lifecycle.currentStageId).toBe('stage-2');
  });

  it('sets startedAt only once, on the first move', async () => {
    const first = await service.moveLifecycleStage(REQUEST, 'stage-1', USER, USER_NAME);
    const second = await service.moveLifecycleStage(REQUEST, 'stage-2', USER, USER_NAME);
    expect(second.lifecycle.startedAt).toBe(first.lifecycle.startedAt);
  });

  it('audits every move with the target stage and any note', async () => {
    await service.moveLifecycleStage(
      REQUEST,
      'stage-1',
      USER,
      USER_NAME,
      'waiting on the provider',
    );
    const stageAudits = auditEntries().filter(
      (e) => (e.details as Record<string, unknown>)?.targetStageId === 'stage-1',
    );
    expect(stageAudits).toHaveLength(1);
    expect(stageAudits[0].details).toMatchObject({ notes: 'waiting on the provider' });
  });

  it('refuses to move a request that does not exist', async () => {
    await expect(service.moveLifecycleStage('nope', 's1', USER, USER_NAME)).rejects.toThrow(
      /Request not found/,
    );
  });
});

describe('compliance sign-off', () => {
  beforeEach(() => {
    seedTemplate();
    seedRequest();
  });

  it('records the approver and the moment on approval', async () => {
    const signed = await service.updateComplianceSignOff(
      REQUEST,
      ApprovalOutcome.APPROVED,
      USER,
      USER_NAME,
    );
    expect(signed.complianceSignOff).toMatchObject({
      outcome: ApprovalOutcome.APPROVED,
      approvedBy: USER,
    });
    expect(signed.status).toBe(RequestStatus.IN_SIGN_OFF);
  });

  it.each([ApprovalOutcome.REJECTED, ApprovalOutcome.DEFICIENT])(
    'does not advance the status on a %s outcome',
    async (outcome) => {
      const signed = await service.updateComplianceSignOff(REQUEST, outcome, USER, USER_NAME);
      expect(signed.complianceSignOff.outcome).toBe(outcome);
      expect(signed.status).toBe(RequestStatus.NEW);
    },
  );

  it('stores deficiencies with their own ids and the raiser', async () => {
    const signed = await service.updateComplianceSignOff(
      REQUEST,
      ApprovalOutcome.DEFICIENT,
      USER,
      USER_NAME,
      [
        { description: 'FICA document missing', requiresDocument: true, requiresComment: false },
        { description: 'Signature illegible', requiresDocument: false, requiresComment: true },
      ],
    );
    const defs = signed.complianceSignOff.deficiencies;
    expect(defs).toHaveLength(2);
    expect(new Set(defs.map((d) => d.id)).size).toBe(2);
    expect(defs[0]).toMatchObject({
      description: 'FICA document missing',
      requiresDocument: true,
      createdBy: USER,
      remedialDocumentIds: [],
    });
  });

  it('ignores deficiencies supplied alongside an approval', async () => {
    // Only the DEFICIENT outcome writes them, which keeps an approved request
    // from carrying open deficiencies.
    const signed = await service.updateComplianceSignOff(
      REQUEST,
      ApprovalOutcome.APPROVED,
      USER,
      USER_NAME,
      [{ description: 'ignored', requiresDocument: false, requiresComment: false }],
    );
    expect(signed.complianceSignOff.deficiencies).toEqual([]);
  });

  it('records approval and rejection as different audit actions', async () => {
    await service.updateComplianceSignOff(REQUEST, ApprovalOutcome.APPROVED, USER, USER_NAME);
    const approvedActions = auditEntries().map((e) => e.action);
    kvStore.forEach((_v, k) => {
      if (k.startsWith('requests:audit:')) kvStore.delete(k);
    });
    seedRequest('r2');
    await service.updateComplianceSignOff('r2', ApprovalOutcome.REJECTED, USER, USER_NAME);
    const rejectedActions = auditEntries().map((e) => e.action);
    // The compliance report distinguishes the two; one shared action would make
    // the approval rate unmeasurable.
    expect(approvedActions).not.toEqual(rejectedActions);
  });
});

// ============================================================================
// DELETION AND AUDIT
// ============================================================================

describe('deletion', () => {
  it('removes the request and records why it is gone', async () => {
    seedRequest();
    await service.deleteRequest(REQUEST, USER, USER_NAME);
    expect(kvStore.has(`requests:request:${REQUEST}`)).toBe(false);
    // The audit entry outlives the record, which is the point of an append-only
    // log: the request is gone, the fact that this person deleted it is not.
    expect(auditEntries()).toHaveLength(1);
    expect(auditEntries()[0]).toMatchObject({ requestId: REQUEST, performedBy: USER });
  });

  it('refuses to delete a request that does not exist', async () => {
    await expect(service.deleteRequest('nope', USER, USER_NAME)).rejects.toThrow(
      /Request not found/,
    );
    expect(auditEntries()).toEqual([]);
  });
});

describe('audit log', () => {
  it('records who, what and when for every entry', async () => {
    seedTemplate();
    const created = await service.createRequest(TEMPLATE, { requestDetails: {} }, USER, USER_NAME);
    const entry = auditEntries()[0];
    expect(entry).toMatchObject({
      requestId: created.id,
      performedBy: USER,
      performedByName: USER_NAME,
    });
    expect(Date.parse(entry.performedAt as string)).not.toBeNaN();
    expect(entry.id).toMatch(/^audit_/);
  });

  it('keeps every entry when several are written in the same millisecond', async () => {
    /**
     * The bug this guards. The key was `requests:audit:{requestId}:{now}` and
     * `now` is an ISO string with millisecond precision, so same-millisecond
     * entries overwrote each other. Not theoretical: every workflow method
     * writes TWO entries microseconds apart, because it calls `updateRequest`
     * (which audits UPDATED) and then audits its own specific action.
     * `moveLifecycleStage`, `updateComplianceSignOff` and `finaliseRequest` all
     * do it. Measured before the fix: five entries written in one tick left one
     * row — on an append-only compliance log.
     */
    const written = 20;
    await Promise.all(
      Array.from({ length: written }, (_, i) =>
        service.createAuditLogEntry(REQUEST, types.AuditAction.UPDATED, USER, USER_NAME, { i }),
      ),
    );
    expect(await service.getAuditLog(REQUEST)).toHaveLength(written);
  });

  it('still finds entries written under the older key shape', async () => {
    // Backward compatibility: `getAuditLog` prefix-scans
    // `requests:audit:{requestId}:`, so rows already in production under the
    // timestamp-only key must still appear.
    kvStore.set(`requests:audit:${REQUEST}:2020-01-01T00:00:00.000Z`, {
      id: 'legacy-entry',
      requestId: REQUEST,
      action: types.AuditAction.UPDATED,
      performedBy: USER,
      performedByName: USER_NAME,
      performedAt: '2020-01-01T00:00:00.000Z',
      details: {},
    });
    await service.createAuditLogEntry(REQUEST, types.AuditAction.UPDATED, USER, USER_NAME, {});
    const log = await service.getAuditLog(REQUEST);
    expect(log).toHaveLength(2);
    expect(log.some((e) => e.id === 'legacy-entry')).toBe(true);
  });

  it('accumulates a trace for every mutation across a request lifetime', async () => {
    seedTemplate();
    const created = await service.createRequest(TEMPLATE, { requestDetails: {} }, USER, USER_NAME);
    await service.moveLifecycleStage(created.id, 'stage-1', USER, USER_NAME);
    await service.updateComplianceSignOff(created.id, ApprovalOutcome.APPROVED, USER, USER_NAME);
    const log = await service.getAuditLog(created.id);
    // Created, the update behind the stage move, the stage move, the update
    // behind the sign-off, the sign-off. Before the key fix this collapsed to
    // two, because each pair shared a millisecond.
    expect(log.length).toBeGreaterThanOrEqual(5);
  });

  it('returns the newest entry first', async () => {
    kvStore.set(`requests:audit:${REQUEST}:2020-01-01T00:00:00.000Z:a`, {
      id: 'old',
      requestId: REQUEST,
      action: types.AuditAction.UPDATED,
      performedBy: USER,
      performedByName: USER_NAME,
      performedAt: '2020-01-01T00:00:00.000Z',
      details: {},
    });
    kvStore.set(`requests:audit:${REQUEST}:2026-01-01T00:00:00.000Z:b`, {
      id: 'new',
      requestId: REQUEST,
      action: types.AuditAction.UPDATED,
      performedBy: USER,
      performedByName: USER_NAME,
      performedAt: '2026-01-01T00:00:00.000Z',
      details: {},
    });
    expect((await service.getAuditLog(REQUEST)).map((e) => e.id)).toEqual(['new', 'old']);
  });

  it('returns only the entries for the request asked about', async () => {
    seedTemplate();
    const a = await service.createRequest(TEMPLATE, { requestDetails: {} }, USER, USER_NAME);
    const b = await service.createRequest(TEMPLATE, { requestDetails: {} }, USER, USER_NAME);
    const logA = await service.getAuditLog(a.id);
    expect(logA.length).toBeGreaterThan(0);
    expect(logA.every((e) => e.requestId === a.id)).toBe(true);
    expect(logA.some((e) => e.requestId === b.id)).toBe(false);
  });

  it('returns an empty log for a request with no history', async () => {
    expect(await service.getAuditLog('nope')).toEqual([]);
  });
});
