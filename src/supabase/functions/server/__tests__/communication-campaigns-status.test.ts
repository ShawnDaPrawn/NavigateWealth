/**
 * communication-campaigns.ts — status roll-up and history filtering
 * =================================================================
 *
 * `sendCampaign` used to end with a literal `status: 'completed'` and a `sent++`
 * that incremented whenever `sendMessage` did not THROW. Since `sendMessage`
 * deliberately swallows email failures (the portal copy is still written), a
 * campaign where the provider refused every address finished green in the
 * manager and nothing in the UI could tell an operator otherwise. These tests
 * pin the real roll-up.
 *
 * They also cover the two filters the History view needs to be useful now that
 * individual client messages share the list with campaigns: `status` and
 * `origin`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});

const sendMessageMock = vi.hoisted(() => vi.fn());
const getAllClientsMock = vi.hoisted(() => vi.fn(async () => []));

vi.mock('../communication-messaging.ts', () => ({
  sendMessage: sendMessageMock,
  getAllClients: getAllClientsMock,
}));

vi.mock('../communication-service-helpers.ts', async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    '../communication-service-helpers.ts',
  );
  return {
    ...actual,
    // Real implementation reaches Supabase auth to turn a uuid into a name.
    resolveAdminDisplayNames: vi.fn(
      async (ids: string[]) => new Map(ids.map((id) => [id, `User ${id}`])),
    ),
  };
});

vi.mock('../kv_store.tsx', async () => {
  const { makeKvMock } = await import('./helpers/contract-harness.ts');
  return makeKvMock();
});

vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);

const { kvStore } = await import('./helpers/contract-harness.ts');
const { listCampaignsFiltered, sendCampaign } = await import('../communication-campaigns.ts');
const repo = await import('../communication-repo.ts');

type StoredCampaign = Awaited<ReturnType<typeof repo.getCampaignById>>;

function seedCampaign(overrides: Record<string, unknown> = {}): string {
  const id = (overrides.id as string) || 'camp-1';
  kvStore.set(`communication:campaigns:${id}`, {
    id,
    subject: 'Quarterly update',
    bodyHtml: '<p>News</p>',
    channel: 'email',
    recipientType: 'multiple',
    selectedRecipients: [
      { id: 'c1', email: 'one@example.com' },
      { id: 'c2', email: 'two@example.com' },
    ],
    status: 'draft',
    attachments: [],
    scheduling: { type: 'immediate' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'admin-1',
    ...overrides,
  });
  return id;
}

const ok = { status: 'completed' as const };

beforeEach(() => {
  kvStore.clear();
  sendMessageMock.mockReset();
  sendMessageMock.mockResolvedValue(ok);
});

describe('sendCampaign — status reflects what actually happened', () => {
  it('is completed when every recipient was delivered', async () => {
    const id = seedCampaign();
    const result = await sendCampaign(id, 'admin-1');

    expect(result.status).toBe('completed');
    expect(result.sent).toBe(2);
    expect(((await repo.getCampaignById(id)) as StoredCampaign)?.status).toBe('completed');
  });

  it('is partial when only some recipients were delivered', async () => {
    sendMessageMock
      .mockResolvedValueOnce(ok)
      .mockResolvedValueOnce({ status: 'failed', failureReason: 'network timeout' });

    const id = seedCampaign();
    const result = await sendCampaign(id, 'admin-1');

    expect(result.status).toBe('partial');
    const stored = (await repo.getCampaignById(id)) as StoredCampaign;
    expect(stored?.stats).toEqual({ sent: 1, failed: 1, total: 2 });
    expect(stored?.failureReason).toBe('network timeout');
  });

  it('is failed when nobody was delivered', async () => {
    sendMessageMock.mockResolvedValue({ status: 'failed', failureReason: 'network timeout' });

    const id = seedCampaign();
    const result = await sendCampaign(id, 'admin-1');

    expect(result.status).toBe('failed');
    expect(result.success).toBe(false);
    expect(result.sent).toBe(0);
  });

  it('is rejected when every recipient was refused terminally', async () => {
    sendMessageMock.mockResolvedValue({ status: 'rejected', failureReason: 'invalid address' });

    const id = seedCampaign();
    expect((await sendCampaign(id, 'admin-1')).status).toBe('rejected');
  });

  it('passes its own id down so fan-out is not mistaken for individual messages', async () => {
    const id = seedCampaign();
    await sendCampaign(id, 'admin-1');

    expect(sendMessageMock).toHaveBeenCalledWith(
      'admin-1',
      expect.objectContaining({ campaignId: id }),
    );
  });

  it('refuses to re-send a recorded individual message', async () => {
    // Direct sends are filed as campaign rows so the manager can see them.
    // Treating one as a draft would silently mail the client a second time.
    const id = seedCampaign({ id: 'direct-1', origin: 'direct', status: 'completed' });
    await expect(sendCampaign(id, 'admin-1')).rejects.toThrow(/already been sent/i);
    expect(sendMessageMock).not.toHaveBeenCalled();
  });
});

describe('listCampaignsFiltered — history filters', () => {
  beforeEach(() => {
    seedCampaign({ id: 'a', status: 'completed', createdAt: '2026-01-03T00:00:00.000Z' });
    seedCampaign({ id: 'b', status: 'failed', createdAt: '2026-01-02T00:00:00.000Z' });
    seedCampaign({
      id: 'c',
      status: 'completed',
      origin: 'direct',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('returns everything, newest first, when unfiltered', async () => {
    const result = await listCampaignsFiltered({ page: 1, limit: 10 });
    expect(result.campaigns.map((c) => c.id)).toEqual(['a', 'b', 'c']);
    expect(result.total).toBe(3);
  });

  it('filters by status', async () => {
    const result = await listCampaignsFiltered({ page: 1, limit: 10, status: 'failed' });
    expect(result.campaigns.map((c) => c.id)).toEqual(['b']);
  });

  it('filters individual messages apart from campaigns', async () => {
    const direct = await listCampaignsFiltered({ page: 1, limit: 10, origin: 'direct' });
    expect(direct.campaigns.map((c) => c.id)).toEqual(['c']);

    // Rows predating `origin` are Communication Centre campaigns, so an absent
    // value must read as 'campaign' rather than dropping them from the list.
    const campaigns = await listCampaignsFiltered({ page: 1, limit: 10, origin: 'campaign' });
    expect(campaigns.campaigns.map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('keeps every sender in the filter options regardless of the active filter', async () => {
    const result = await listCampaignsFiltered({ page: 1, limit: 10, status: 'failed' });
    expect(result.senderOptions).toEqual([{ userId: 'admin-1', label: 'User admin-1' }]);
  });
});
