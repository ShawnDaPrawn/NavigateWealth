/**
 * Group rules preview: the live count and first 50 matches the Client
 * Management group editor shows while rules are being edited.
 */
import { describe, expect, it, vi } from 'vitest';

const clients = vi.hoisted(() => ({ list: [] as Array<Record<string, unknown>> }));
vi.mock('../communication-repo.ts', () => ({
  fetchMatcherClients: async () => clients.list,
}));
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);

import { GROUP_PREVIEW_LIMIT, previewGroupMembers } from '../communication-group-preview.ts';

const make = (i: number, provider: string) => ({
  id: `c${i}`,
  firstName: `First${i}`,
  lastName: 'Client',
  email: `c${i}@example.com`,
  products: [{ provider, type: 'retirement' }],
});

describe('previewGroupMembers', () => {
  it('counts every match and lists the first 50, without names leaking undefined', async () => {
    clients.list = [
      ...Array.from({ length: 60 }, (_, i) => make(i, 'Allan Gray')),
      make(99, 'Sygnia'),
      { id: 'nameless', products: [{ provider: 'Allan Gray' }] },
    ];
    const preview = await previewGroupMembers({ productFilters: [{ provider: 'allan gray' }] });
    expect(preview.count).toBe(61);
    expect(preview.clients).toHaveLength(GROUP_PREVIEW_LIMIT);
    expect(preview.clients[0]).toEqual({
      id: 'c0',
      name: 'First0 Client',
      email: 'c0@example.com',
    });
  });

  it('matches nobody when no rule is set (a manual group)', async () => {
    clients.list = [make(1, 'Allan Gray')];
    expect(await previewGroupMembers({})).toEqual({ count: 0, clients: [] });
  });
});
