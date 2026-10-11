/**
 * Where an accepted client intake puts the adviser draft.
 *
 * Risk and Retirement keep each FNA at `<prefix>:<id>` and the client's FNAs
 * in `<prefix>:<clientId>:list`. A draft that is not on that list never
 * appears. The other four are stored under the client. None of them may be
 * written to `:latest` — that pointer is what "latest published" serves, and
 * a draft there shows as the client's current FNA.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FnaIntakeDomain, FnaIntakeSession } from '../fna-intake-types.ts';

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);

import { kvStore } from './helpers/contract-harness.ts';
import { createFnaDraftFromIntake } from '../fna-intake-draft-factory.ts';

const CLIENT = '11111111-2222-4333-8444-555555555555';
const ADMIN = { id: 'admin-1', email: 'adviser@example.com' };
const FIXED_ID = '123e4567-e89b-42d3-a456-426614174000';

function intake(domain: FnaIntakeDomain): FnaIntakeSession {
  return {
    id: 'intake-session-1',
    clientId: CLIENT,
    domain,
    status: 'submitted',
    inputs: { currentAge: 45 },
    progressPercent: 100,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    intakeSource: 'client',
  };
}

beforeEach(() => {
  kvStore.clear();
  vi.restoreAllMocks();
});

describe('createFnaDraftFromIntake list entries', () => {
  it.each([
    ['risk', 'risk_planning_fna', 'inputData'],
    ['retirement', 'retirement_fna', 'inputs'],
  ] as const)(
    '%s appends to the client list, keeps what was already there, and does not touch :latest',
    async (domain, prefix, answersKey) => {
      const listKey = `${prefix}:${CLIENT}:list`;
      kvStore.set(listKey, ['older-fna']);

      const fnaId = await createFnaDraftFromIntake(intake(domain), ADMIN);

      expect(kvStore.get(listKey)).toEqual(['older-fna', fnaId]);
      expect(kvStore.has(`${prefix}:${CLIENT}:latest`)).toBe(false);
      const record = kvStore.get(`${prefix}:${fnaId}`) as Record<string, unknown>;
      expect(record).toMatchObject({
        id: fnaId,
        clientId: CLIENT,
        status: 'draft',
        intakeSource: 'client',
        [answersKey]: { currentAge: 45 },
      });
      if (answersKey === 'inputData') expect(record.inputs).toBeUndefined();
    },
  );

  it('does not list the same risk draft twice', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(FIXED_ID);
    const listKey = `risk_planning_fna:${CLIENT}:list`;
    kvStore.set(listKey, [FIXED_ID, 'older-fna']);

    const fnaId = await createFnaDraftFromIntake(intake('risk'), ADMIN);

    expect(fnaId).toBe(FIXED_ID);
    expect(kvStore.get(listKey)).toEqual([FIXED_ID, 'older-fna']);
    expect(kvStore.has(`risk_planning_fna:${FIXED_ID}`)).toBe(true);
  });
});

describe('createFnaDraftFromIntake client-scoped drafts', () => {
  it.each([
    ['medical', 'medical-fna'],
    ['investment', 'investment-ina'],
    ['tax', 'tax-planning-fna'],
    ['estate', 'estate-planning-fna'],
  ] as const)('%s is stored under the client and not at the wizard key', async (domain, prefix) => {
    const fnaId = await createFnaDraftFromIntake(intake(domain), ADMIN);

    expect(kvStore.get(`${prefix}:client:${CLIENT}:${fnaId}`)).toMatchObject({
      id: fnaId,
      clientId: CLIENT,
      status: 'draft',
      inputs: { currentAge: 45 },
      intakeSource: 'client',
    });
    expect(kvStore.has(`${prefix}:${fnaId}`)).toBe(false);
    expect(kvStore.has(`${prefix}:${CLIENT}:latest`)).toBe(false);
    expect(kvStore.has(`${prefix}:${CLIENT}:list`)).toBe(false);
  });
});
