import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as kv from '../kv_store.tsx';
import {
  acceptIntakeSession,
  createOrUpdateIntakeDraft,
  getIntakeSession,
  requestMoreInfo,
  submitIntakeSession,
} from '../fna-intake-service.ts';

vi.mock('../kv_store.tsx', () => ({
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  getByPrefix: vi.fn(),
}));

vi.mock('../fna-intake-notifications.ts', () => ({
  notifyIntakeSubmitted: vi.fn(),
  notifyIntakeRequestInfo: vi.fn(),
  notifyIntakeAccepted: vi.fn(),
}));

vi.mock('../admin-audit-service.ts', () => ({
  AdminAuditService: { record: vi.fn() },
}));

const clientId = '11111111-1111-1111-1111-111111111111';
const user = { id: clientId, email: 'client@test.com' };
const admin = { id: '22222222-2222-2222-2222-222222222222', email: 'admin@test.com' };

describe('fna-intake lifecycle', () => {
  beforeEach(() => {
    vi.mocked(kv.get).mockReset();
    vi.mocked(kv.set).mockReset();
    vi.mocked(kv.del).mockReset();
    vi.mocked(kv.getByPrefix).mockReset();
  });

  it('draft → submit → accept is idempotent on second accept', async () => {
    const sessions = new Map<string, unknown>();
    const pointers = new Map<string, string>();

    vi.mocked(kv.get).mockImplementation(async (key: string) => {
      if (key.startsWith('fna-intake:session:')) return sessions.get(key) ?? null;
      if (key.startsWith('fna-intake:client:')) return pointers.get(key) ?? null;
      if (key === 'fna-intake:submitted') return [];
      if (key.startsWith('fna-intake:submitted:')) return null;
      if (key.startsWith('retirement_fna:')) return null;
      return null;
    });

    vi.mocked(kv.set).mockImplementation(async (key: string, value: unknown) => {
      if (key.startsWith('fna-intake:session:')) sessions.set(key, value);
      if (key.startsWith('fna-intake:client:')) pointers.set(key, value as string);
      return undefined;
    });

    vi.mocked(kv.del).mockResolvedValue(undefined);

    const draft = await createOrUpdateIntakeDraft(clientId, 'retirement', { currentAge: 45 }, user);
    const submitted = await submitIntakeSession(draft.id, user, true);
    expect(submitted.status).toBe('submitted');

    const first = await acceptIntakeSession(draft.id, admin);
    const second = await acceptIntakeSession(draft.id, admin);
    expect(second.linkedFnaId).toBe(first.linkedFnaId);
    expect(second.session.status).toBe('accepted');

    const stored = await getIntakeSession(draft.id);
    expect(stored?.status).toBe('accepted');
  });

  it('request-info returns intake to client_draft', async () => {
    const session = {
      id: '33333333-3333-3333-3333-333333333333',
      clientId,
      domain: 'tax' as const,
      status: 'submitted' as const,
      inputs: { age: 40 },
      progressPercent: 80,
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
      intakeSource: 'client' as const,
    };

    vi.mocked(kv.get).mockImplementation(async (key: string) => {
      if (key === `fna-intake:session:${session.id}`) return session;
      if (key === 'fna-intake:submitted') return [session.id];
      return null;
    });

    vi.mocked(kv.set).mockResolvedValue(undefined);
    vi.mocked(kv.del).mockResolvedValue(undefined);

    const updated = await requestMoreInfo(session.id, admin);
    expect(updated.status).toBe('client_draft');
    expect(updated.requestInfoAt).toBeTruthy();
  });
});
