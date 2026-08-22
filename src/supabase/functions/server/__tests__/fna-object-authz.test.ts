/**
 * Object-level authorization on the FNA family (P1.4 / S7).
 * =========================================================
 *
 * Before this, 33 handlers across risk, medical, retirement, tax, investment,
 * estate, wills and the two AI chat services did exactly this:
 *
 *     await authenticateUser(c.req.header('Authorization'));
 *     const clientId = c.req.param('clientId')!;
 *     const fna = await kv.get(`risk_planning_fna:${clientId}:latest`);
 *
 * The token proved the caller was *somebody*. Nothing proved they were allowed
 * near *this* client. Any signed-in account could read, publish, archive or
 * hard-delete any client's cover analysis, medical FNA, retirement plan, will
 * or tax documents by naming the id.
 *
 * The fix routes every one of them through the SAME policy the rest of the
 * client-scoped surface already used (`client-access.ts`), reached through a
 * caller-taking form because the FNA gateway returns a user object rather than
 * populating the Hono context. One policy, two adapters — a second copy is what
 * produced S12 and S14.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

const resolver = vi.hoisted(() => vi.fn());
vi.mock('../fna-intake-adviser-resolver.ts', () => ({ resolveClientAdviserUserId: resolver }));

import {
  canAccessClientAs,
  assertClientAccess,
  assertRecordClientAccess,
  ClientAccessError,
} from '../client-access.ts';
import { fnaErrorResponse } from '../fna-auth.ts';

const CLIENT = 'client-1';
const OTHER = 'client-2';

function caller(id: string | undefined, role: string | undefined) {
  return { id, role };
}

describe('the client-access policy, reached without a Hono context', () => {
  beforeEach(() => resolver.mockReset());

  it('allows a client to reach their own record', async () => {
    await expect(canAccessClientAs(caller(CLIENT, 'client'), CLIENT)).resolves.toBe(true);
    expect(resolver).not.toHaveBeenCalled();
  });

  it('allows platform administrators across clients', async () => {
    for (const role of ['admin', 'super_admin', 'super-admin']) {
      await expect(canAccessClientAs(caller('admin-1', role), CLIENT)).resolves.toBe(true);
    }
    expect(resolver).not.toHaveBeenCalled();
  });

  it('allows only the adviser the server says is assigned', async () => {
    resolver.mockResolvedValue('adviser-1');
    await expect(canAccessClientAs(caller('adviser-1', 'adviser'), CLIENT)).resolves.toBe(true);
    await expect(canAccessClientAs(caller('adviser-2', 'adviser'), CLIENT)).resolves.toBe(false);
  });

  it('denies an adviser when the client has no assignment on record', async () => {
    // Fail closed. An unassigned client is the case where "check the adviser"
    // would otherwise quietly become "check nothing".
    resolver.mockResolvedValue(null);
    await expect(canAccessClientAs(caller('adviser-1', 'adviser'), CLIENT)).resolves.toBe(false);
  });

  it('denies other personnel roles outright', async () => {
    for (const role of ['paraplanner', 'compliance', 'viewer', 'staff', undefined]) {
      await expect(canAccessClientAs(caller('someone', role), CLIENT)).resolves.toBe(false);
    }
    expect(resolver).not.toHaveBeenCalled();
  });

  it('denies a caller with no id rather than matching undefined against undefined', async () => {
    // `undefined === undefined` is true. Without the explicit guard, an
    // unidentified caller would authorize against an unowned record.
    await expect(canAccessClientAs(caller(undefined, undefined), '')).resolves.toBe(false);
    await expect(canAccessClientAs(caller(undefined, 'client'), CLIENT)).resolves.toBe(false);

    // The id guard runs BEFORE the admin branch, so a caller claiming to be an
    // administrator with no identity is denied too. Safe because auth-mw sets
    // `userId` and `userRole` together (auth-mw.ts:185-186) and the FNA gateway
    // returns both on one object — a role with no id means the gateway did not
    // run, not that an admin lost their id.
    await expect(canAccessClientAs(caller(undefined, 'admin'), CLIENT)).resolves.toBe(false);
  });
});

describe('assertClientAccess', () => {
  beforeEach(() => resolver.mockReset());

  it('returns quietly when access is allowed', async () => {
    await expect(
      assertClientAccess(caller(CLIENT, 'client'), CLIENT, 'test:read'),
    ).resolves.toBeUndefined();
  });

  it('throws a 403-carrying ClientAccessError when it is not', async () => {
    const error = await assertClientAccess(caller(OTHER, 'client'), CLIENT, 'test:read').catch(
      (e) => e,
    );
    expect(error).toBeInstanceOf(ClientAccessError);
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe('FORBIDDEN_CLIENT');
  });

  it('never names the resource in the thrown message', async () => {
    // Telling a stranger which record they just failed to open is itself a
    // disclosure; `resource` exists for the log line, not the response.
    const error = await assertClientAccess(
      caller(OTHER, 'client'),
      CLIENT,
      'risk-planning-fna:hard-delete',
    ).catch((e) => e);
    expect(error.message).not.toContain('risk-planning');
    expect(error.message).not.toContain(CLIENT);
  });

  it('denies a null or undefined client id', async () => {
    for (const missing of [null, undefined, '']) {
      await expect(
        assertClientAccess(caller('admin-1', 'admin'), missing, 'test:read'),
      ).rejects.toBeInstanceOf(ClientAccessError);
    }
  });
});

describe('assertRecordClientAccess', () => {
  beforeEach(() => resolver.mockReset());

  it('reads the owner off the record, in either casing', async () => {
    await expect(
      assertRecordClientAccess(caller(CLIENT, 'client'), { clientId: CLIENT }, 'test:read'),
    ).resolves.toBeUndefined();
    await expect(
      assertRecordClientAccess(caller(CLIENT, 'client'), { client_id: CLIENT }, 'test:read'),
    ).resolves.toBeUndefined();
  });

  it('denies when the record belongs to someone else', async () => {
    await expect(
      assertRecordClientAccess(caller(OTHER, 'client'), { clientId: CLIENT }, 'test:read'),
    ).rejects.toBeInstanceOf(ClientAccessError);
  });

  it('denies a record that carries no owner at all', async () => {
    // An unowned record is exactly where "check the owner" silently becomes
    // "check nothing" — so it is denied, even for an administrator.
    for (const record of [{}, { clientId: null }, null, undefined]) {
      await expect(
        assertRecordClientAccess(caller('admin-1', 'admin'), record, 'test:read'),
      ).rejects.toBeInstanceOf(ClientAccessError);
    }
  });
});

describe('fnaErrorResponse renders the denial', () => {
  function context() {
    return {
      json: (body: unknown, status: number) =>
        new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        }),
    } as never;
  }

  it('maps ClientAccessError to 403 with its code intact', async () => {
    const res = fnaErrorResponse(context(), new ClientAccessError());
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({ success: false, code: 'FORBIDDEN_CLIENT' });
  });

  it('does not flatten it into a 401', async () => {
    // A 401 would tell an adviser who is simply not assigned to this client to
    // log in again — a loop that cannot succeed and hides a real decision.
    const res = fnaErrorResponse(context(), new ClientAccessError());
    expect(res.status).not.toBe(401);
  });
});
