/**
 * listPersonnel super-admin auto-bootstrap — A10 follow-up guard
 * ==============================================================
 *
 * `listPersonnel` creates a KV profile for a super admin who does not have one
 * yet, so the owner appears in the personnel table. Moving the outer check to
 * the allowlist (A10) introduced a subtle bug in the INNER check: it asked
 * "does a profile exist for ANY allowlisted super admin?" rather than "does one
 * exist for the caller?". With the primary admin's profile already present, a
 * recovery admin was therefore judged already-bootstrapped and never got a
 * profile — silently absent from every personnel-backed workflow, in the
 * account that exists for emergencies.
 *
 * Run: npx vitest run src/supabase/functions/server/__tests__/personnel-super-admin-bootstrap.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const PREFIX = 'personnel:profile:';
let store = new Map<string, unknown>();

vi.mock('../kv_store.tsx', () => ({
  get: vi.fn(async (key: string) => store.get(key) ?? null),
  set: vi.fn(async (key: string, value: unknown) => {
    store.set(key, value);
  }),
  del: vi.fn(),
  getByPrefix: vi.fn(async (prefix: string) =>
    [...store.entries()].filter(([k]) => k.startsWith(prefix)).map(([, v]) => v),
  ),
  mget: vi.fn(),
  mset: vi.fn(),
  mdel: vi.fn(),
}));

vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({ auth: { admin: {} } }),
}));

vi.mock('../email-service.tsx', () => ({ sendEmail: vi.fn(async () => true) }));

import { PersonnelService } from '../client-management-personnel-service.ts';

const PRIMARY = 'shawn@navigatewealth.co';
const RECOVERY = 'shawn.africantreasures@gmail.com';

/** Seed a profile as if that account had already been bootstrapped. */
function seedProfile(id: string, email: string) {
  store.set(`${PREFIX}${id}`, {
    id,
    email,
    name: email,
    role: 'super_admin',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
}

const profileEmails = () =>
  [...store.values()].map((p) => (p as { email?: string }).email).filter(Boolean);

beforeEach(() => {
  store = new Map();
});

describe('super-admin auto-bootstrap', () => {
  it('bootstraps the recovery admin even when the primary profile exists', async () => {
    seedProfile('primary-id', PRIMARY);

    await PersonnelService.listPersonnel('recovery-id', 'super_admin', RECOVERY);

    expect(profileEmails()).toContain(RECOVERY);
  });

  it('does not duplicate a profile the caller already has', async () => {
    seedProfile('recovery-id', RECOVERY);

    await PersonnelService.listPersonnel('recovery-id', 'super_admin', RECOVERY);

    expect(profileEmails().filter((e) => e === RECOVERY)).toHaveLength(1);
  });

  it('matches the caller by id even when the stored email differs in case', async () => {
    seedProfile('recovery-id', RECOVERY.toUpperCase());

    await PersonnelService.listPersonnel('recovery-id', 'super_admin', RECOVERY);

    expect(store.size).toBe(1);
  });

  it('does not bootstrap a caller who is not a super admin', async () => {
    await PersonnelService.listPersonnel('adviser-id', 'adviser', 'adviser@navigatewealth.co');

    expect(store.size).toBe(0);
  });
});
