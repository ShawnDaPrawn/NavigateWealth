/**
 * Opening an FNA by id — every FNA in a client's list must open.
 * ==============================================================
 *
 * The FNA list on a policy category shows every FNA of that type for the
 * client, and "View" opens one by id. Two kinds of id did not open:
 *
 *   - Investment INA and Estate sessions created from a client intake have a
 *     plain UUID id. The by-id routes derived the client from the id
 *     (`clientId-vN-…`), built the wrong key and answered 404. The SPA now
 *     names the client (`?clientId=`), and that client is what is authorized.
 *   - Medical FNAs created from a client intake are stored under the client
 *     (`medical-fna:client:<clientId>:<id>`), not at `medical-fna:<id>`.
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
const medical = (await import('../medical-fna-routes.ts')).default;

const CLIENT_A = '11111111-2222-4333-8444-555555555555';
const CLIENT_B = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const INTAKE_ID = '99999999-8888-4777-8666-555555555555';

const as = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } });

beforeEach(() => {
  kvStore.clear();
  resetFnaHarness();
  seedFnaUser('admin', { id: 'admin-1', role: 'admin' });
  seedFnaUser('adviserB', { id: 'adviser-of-b', role: 'adviser' });
  fnaAssignments.set(CLIENT_A, 'adviser-of-a');
  fnaAssignments.set(CLIENT_B, 'adviser-of-b');
});

describe.each([
  ['Investment INA', investment, 'investment-ina'],
  ['Estate Planning', estate, 'estate-planning-fna'],
] as const)('%s session by id', (_label, app, prefix) => {
  it('opens a wizard session, whose id names the client', async () => {
    const id = `${CLIENT_A}-v2-abc`;
    kvStore.set(`${prefix}:client:${CLIENT_A}:${id}`, { id, clientId: CLIENT_A });
    const res = await app.request(`/session/${id}`, as('admin'));
    expect(res.status).toBe(200);
  });

  it('opens an intake session (a plain UUID id) when the client is named', async () => {
    kvStore.set(`${prefix}:client:${CLIENT_A}:${INTAKE_ID}`, { id: INTAKE_ID, clientId: CLIENT_A });

    expect((await app.request(`/session/${INTAKE_ID}`, as('admin'))).status).toBe(404);
    const res = await app.request(`/session/${INTAKE_ID}?clientId=${CLIENT_A}`, as('admin'));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { data: { id: string } }).data.id).toBe(INTAKE_ID);
  });

  it("authorizes the named client, so another client's adviser is refused", async () => {
    kvStore.set(`${prefix}:client:${CLIENT_A}:${INTAKE_ID}`, { id: INTAKE_ID, clientId: CLIENT_A });
    const res = await app.request(`/session/${INTAKE_ID}?clientId=${CLIENT_A}`, as('adviserB'));
    expect(res.status).toBe(403);
  });

  it('does not open a session stored under a different client than the hint', async () => {
    const id = `${CLIENT_A}-v2-abc`;
    kvStore.set(`${prefix}:client:${CLIENT_A}:${id}`, { id, clientId: CLIENT_A });
    kvStore.set(`${prefix}:client:${CLIENT_A}:${INTAKE_ID}`, { id: INTAKE_ID, clientId: CLIENT_A });

    // The hint is the client that gets authorized AND the client the key is
    // built from. Naming B must not read A's wizard session or A's intake.
    expect((await app.request(`/session/${id}?clientId=${CLIENT_B}`, as('adviserB'))).status).toBe(
      404,
    );
    expect(
      (await app.request(`/session/${INTAKE_ID}?clientId=${CLIENT_B}`, as('adviserB'))).status,
    ).toBe(404);
  });
});

describe('Medical FNA by id', () => {
  it('opens a wizard FNA', async () => {
    kvStore.set('medical-fna:client_x_v1_ab', { id: 'client_x_v1_ab', clientId: CLIENT_A });
    expect((await medical.request('/client_x_v1_ab', as('admin'))).status).toBe(200);
  });

  it('opens an intake FNA, stored under the client, when the client is named', async () => {
    kvStore.set(`medical-fna:client:${CLIENT_A}:${INTAKE_ID}`, {
      id: INTAKE_ID,
      clientId: CLIENT_A,
    });

    expect((await medical.request(`/${INTAKE_ID}`, as('admin'))).status).toBe(404);
    const res = await medical.request(`/${INTAKE_ID}?clientId=${CLIENT_A}`, as('admin'));
    expect(res.status).toBe(200);
  });

  it("still authorizes the record's own client", async () => {
    kvStore.set(`medical-fna:client:${CLIENT_A}:${INTAKE_ID}`, {
      id: INTAKE_ID,
      clientId: CLIENT_A,
    });
    const res = await medical.request(`/${INTAKE_ID}?clientId=${CLIENT_A}`, as('adviserB'));
    expect(res.status).toBe(403);
  });

  it('does not open an intake stored under a different client than the hint', async () => {
    kvStore.set(`medical-fna:client:${CLIENT_A}:${INTAKE_ID}`, {
      id: INTAKE_ID,
      clientId: CLIENT_A,
    });
    const res = await medical.request(`/${INTAKE_ID}?clientId=${CLIENT_B}`, as('adviserB'));
    expect(res.status).toBe(404);
  });
});
