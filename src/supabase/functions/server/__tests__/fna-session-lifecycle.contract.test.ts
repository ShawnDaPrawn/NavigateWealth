/**
 * Publish, unpublish and delete for the FNAs stored under their client.
 * =====================================================================
 *
 * Investment INA, Estate Planning and Tax Planning keep each session at
 * `<prefix>:client:<clientId>:<id>`. Before this, the SPA called publish and
 * unpublish routes that did not exist (Investment, Estate), stubbed all three
 * as no-ops (Tax, so "Delete" reported success and deleted nothing), and the
 * delete routes answered success for any id — including an intake draft,
 * whose UUID id does not name its client, which was never found or deleted.
 *
 * Medical keeps wizard FNAs at `medical-fna:<id>` and intake drafts under the
 * client; every lifecycle route now finds both.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = {
    env: { get: (key: string) => `test-${key}` },
  };
});

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);
vi.mock('jsr:@supabase/supabase-js@2.49.8', async () =>
  (await import('./helpers/fna-routes-harness.ts')).makeFnaSupabaseMock(),
);
vi.mock('../fna-intake-adviser-resolver.ts', async () =>
  (await import('./helpers/fna-routes-harness.ts')).makeAdviserResolverMock(),
);
vi.mock('../auth-mw.ts', async () =>
  (await import('./helpers/fna-routes-harness.ts')).makeAuthMwMockForFna(),
);

import { kvStore } from './helpers/contract-harness.ts';
import { resetFnaHarness, seedFnaUser, fnaAssignments } from './helpers/fna-routes-harness.ts';

const investment = (await import('../investment-ina-routes.ts')).default;
const estate = (await import('../estate-planning-fna-session-routes.ts')).default;
const tax = (await import('../tax-planning-fna-routes.ts')).default;
const medical = (await import('../medical-fna-routes.ts')).default;

const CLIENT_A = '11111111-2222-4333-8444-555555555555';
const CLIENT_B = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const INTAKE_ID = '99999999-8888-4777-8666-555555555555';
const WIZARD_ID = `${CLIENT_A}-v2-abc`;

function req(
  app: { request: (path: string, init?: RequestInit) => Response | Promise<Response> },
  method: string,
  path: string,
  as = 'admin',
) {
  return app.request(path, { method, headers: { Authorization: `Bearer ${as}` } });
}

beforeEach(() => {
  kvStore.clear();
  resetFnaHarness();
  seedFnaUser('admin', { id: 'admin-1', role: 'admin' });
  seedFnaUser('adviserB', { id: 'adviser-of-b', role: 'adviser' });
  fnaAssignments.set(CLIENT_A, 'adviser-of-a');
  fnaAssignments.set(CLIENT_B, 'adviser-of-b');
});

type Status = {
  status?: string;
  publishedAt?: string;
  publishedBy?: string;
  inputs?: { currentAge?: number };
};

// [label, app, KV prefix, path for one session, publish/unpublish verb]
const CASES = [
  ['Investment INA', investment, 'investment-ina', (id: string) => `/session/${id}`],
  ['Estate Planning', estate, 'estate-planning-fna', (id: string) => `/session/${id}`],
  ['Tax Planning', tax, 'tax-planning-fna', (id: string) => `/${id}`],
] as const;

describe.each(CASES)('%s', (_label, app, prefix, at) => {
  const key = (id: string) => `${prefix}:client:${CLIENT_A}:${id}`;
  const stored = (id: string) => kvStore.get(key(id)) as Status | undefined;

  it('publishes a wizard session and stamps who published it', async () => {
    kvStore.set(key(WIZARD_ID), { id: WIZARD_ID, clientId: CLIENT_A, status: 'draft' });
    const res = await req(app, 'PUT', `${at(WIZARD_ID)}/publish`);
    expect(res.status).toBe(200);
    expect(stored(WIZARD_ID)).toMatchObject({ status: 'published', publishedBy: 'admin-1' });
  });

  it('unpublishes a published session back to a draft and clears the publication stamp', async () => {
    // The FNA list and the client overview both treat any `publishedAt` as
    // "Published on …", including on a draft. Unpublish has to remove the
    // stamp, not only flip the status, and it must keep the answers.
    kvStore.set(key(WIZARD_ID), {
      id: WIZARD_ID,
      clientId: CLIENT_A,
      status: 'published',
      publishedAt: '2020-01-01T00:00:00.000Z',
      publishedBy: 'someone-else',
      inputs: { currentAge: 45 },
    });
    expect((await req(app, 'PUT', `${at(WIZARD_ID)}/unpublish`)).status).toBe(200);
    const after = stored(WIZARD_ID);
    expect(after?.status).toBe('draft');
    expect(after?.publishedAt).toBeUndefined();
    expect(after?.publishedBy).toBeUndefined();
    expect(after?.inputs).toEqual({ currentAge: 45 });
  });

  it('refuses to unpublish a session that is not published', async () => {
    kvStore.set(key(WIZARD_ID), { id: WIZARD_ID, clientId: CLIENT_A, status: 'draft' });
    expect((await req(app, 'PUT', `${at(WIZARD_ID)}/unpublish`)).status).toBe(400);
  });

  it('deletes a session', async () => {
    kvStore.set(key(WIZARD_ID), { id: WIZARD_ID, clientId: CLIENT_A, status: 'published' });
    expect((await req(app, 'DELETE', at(WIZARD_ID))).status).toBe(200);
    expect(stored(WIZARD_ID)).toBeUndefined();
  });

  it('answers 404 when there is nothing to delete, instead of a false success', async () => {
    expect((await req(app, 'DELETE', at(WIZARD_ID))).status).toBe(404);
  });

  it('answers 404 when publishing a session that is not stored, and writes nothing', async () => {
    expect((await req(app, 'PUT', `${at(WIZARD_ID)}/publish`)).status).toBe(404);
    expect(stored(WIZARD_ID)).toBeUndefined();
  });

  it('a blank clientId still uses the client encoded in the wizard id', async () => {
    // `?clientId=` is an empty string. Treating that as the owner would build
    // `prefix:client::id` and refuse the real session (admins are not allowed
    // an empty client id).
    kvStore.set(key(WIZARD_ID), { id: WIZARD_ID, clientId: CLIENT_A, status: 'draft' });
    expect((await req(app, 'PUT', `${at(WIZARD_ID)}/publish?clientId=`)).status).toBe(200);
    expect(stored(WIZARD_ID)?.status).toBe('published');
    expect(kvStore.has(`${prefix}:client::${WIZARD_ID}`)).toBe(false);
  });

  it("naming another client does not publish or delete this client's session", async () => {
    // The wizard id encodes client A. An admin may act for client B too, so a
    // hint must select B's key and miss — not fall back to the client in the
    // id and publish A's record.
    kvStore.set(key(WIZARD_ID), {
      id: WIZARD_ID,
      clientId: CLIENT_A,
      status: 'published',
      publishedAt: '2020-01-01T00:00:00.000Z',
      publishedBy: 'admin-1',
    });
    const q = `?clientId=${CLIENT_B}`;

    expect((await req(app, 'PUT', `${at(WIZARD_ID)}/publish${q}`)).status).toBe(404);
    expect((await req(app, 'DELETE', `${at(WIZARD_ID)}${q}`)).status).toBe(404);
    expect(stored(WIZARD_ID)).toMatchObject({
      status: 'published',
      publishedAt: '2020-01-01T00:00:00.000Z',
      publishedBy: 'admin-1',
    });
    expect(kvStore.has(`${prefix}:client:${CLIENT_B}:${WIZARD_ID}`)).toBe(false);
  });

  it('an intake id without its client is not deleted', async () => {
    // A UUID does not encode a client. Deleting it with no hint used to report
    // success and delete nothing; it must not now succeed by scanning.
    kvStore.set(key(INTAKE_ID), { id: INTAKE_ID, clientId: CLIENT_A, status: 'draft' });
    expect((await req(app, 'DELETE', at(INTAKE_ID))).status).toBe(404);
    expect(stored(INTAKE_ID)?.status).toBe('draft');
  });

  it('publishes and deletes an intake draft when the client is named', async () => {
    kvStore.set(key(INTAKE_ID), { id: INTAKE_ID, clientId: CLIENT_A, status: 'draft' });
    const q = `?clientId=${CLIENT_A}`;

    expect((await req(app, 'PUT', `${at(INTAKE_ID)}/publish${q}`)).status).toBe(200);
    expect(stored(INTAKE_ID)?.status).toBe('published');

    expect((await req(app, 'DELETE', `${at(INTAKE_ID)}${q}`)).status).toBe(200);
    expect(stored(INTAKE_ID)).toBeUndefined();
  });

  it.each([
    ['PUT', '/publish'],
    ['PUT', '/unpublish'],
    ['DELETE', ''],
  ])("%s %s refuses another client's adviser", async (method, suffix) => {
    kvStore.set(key(WIZARD_ID), { id: WIZARD_ID, clientId: CLIENT_A, status: 'published' });
    const res = await req(app, method, `${at(WIZARD_ID)}${suffix}`, 'adviserB');
    expect(res.status).toBe(403);
    expect(stored(WIZARD_ID)?.status).toBe('published');
  });
});

describe('Medical FNA created from a client intake', () => {
  const key = `medical-fna:client:${CLIENT_A}:${INTAKE_ID}`;
  const q = `?clientId=${CLIENT_A}`;
  const stored = () => kvStore.get(key) as Status | undefined;

  beforeEach(() => {
    kvStore.set(key, { id: INTAKE_ID, clientId: CLIENT_A, status: 'draft' });
  });

  it('publishes, unpublishes, archives and drafts at the key it is stored under', async () => {
    expect((await req(medical, 'POST', `/publish/${INTAKE_ID}${q}`)).status).toBe(200);
    expect(stored()?.status).toBe('published');
    expect((await req(medical, 'POST', `/unpublish/${INTAKE_ID}${q}`)).status).toBe(200);
    expect(stored()?.status).toBe('draft');
    expect((await req(medical, 'PUT', `/archive/${INTAKE_ID}${q}`)).status).toBe(200);
    expect(stored()?.status).toBe('archived');
    expect((await req(medical, 'PUT', `/draft/${INTAKE_ID}${q}`)).status).toBe(200);
    expect(stored()?.status).toBe('draft');
    expect(kvStore.has(`medical-fna:${INTAKE_ID}`)).toBe(false);
  });

  it('deletes it', async () => {
    expect((await req(medical, 'DELETE', `/delete/${INTAKE_ID}${q}`)).status).toBe(200);
    expect(stored()).toBeUndefined();
  });

  it('is not found without the client named', async () => {
    expect((await req(medical, 'DELETE', `/delete/${INTAKE_ID}`)).status).toBe(404);
  });

  it('does not publish an intake FNA onto the wizard key when the client is omitted', async () => {
    expect((await req(medical, 'POST', `/publish/${INTAKE_ID}`)).status).toBe(404);
    expect(stored()?.status).toBe('draft');
    expect(kvStore.has(`medical-fna:${INTAKE_ID}`)).toBe(false);
  });

  it("a client hint does not publish another client's wizard FNA", async () => {
    // The wizard key is tried before the client key. The hint must not retarget
    // that record: adviser B is refused on client A's FNA, and nothing is
    // written under B.
    const wizardKey = `medical-fna:${WIZARD_ID}`;
    kvStore.set(wizardKey, { id: WIZARD_ID, clientId: CLIENT_A, status: 'draft' });
    const res = await req(
      medical,
      'POST',
      `/publish/${WIZARD_ID}?clientId=${CLIENT_B}`,
      'adviserB',
    );
    expect(res.status).toBe(403);
    expect((kvStore.get(wizardKey) as Status).status).toBe('draft');
    expect(kvStore.has(`medical-fna:client:${CLIENT_B}:${WIZARD_ID}`)).toBe(false);
  });

  it("still authorizes the record's own client", async () => {
    const res = await req(medical, 'DELETE', `/delete/${INTAKE_ID}${q}`, 'adviserB');
    expect(res.status).toBe(403);
    expect(stored()).toBeDefined();
  });
});
