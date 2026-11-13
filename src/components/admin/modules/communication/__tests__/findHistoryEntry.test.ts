import { afterEach, describe, expect, it, vi } from 'vitest';
import { communicationApi } from '../api';
import type { ActivityLogEntry } from '../types';

const entry = (id: string) => ({ id }) as ActivityLogEntry;
const page = (ids: string[], total: number) => ({
  entries: ids.map(entry),
  total,
  page: 1,
  limit: 2,
  senderOptions: [],
});

afterEach(() => vi.restoreAllMocks());

describe('communicationApi.findHistoryEntry', () => {
  it('walks the unfiltered history until it finds the message', async () => {
    const spy = vi
      .spyOn(communicationApi, 'getHistoryPage')
      .mockResolvedValueOnce(page(['a', 'b'], 5))
      .mockResolvedValueOnce(page(['c', 'd'], 5));
    await expect(communicationApi.findHistoryEntry('d', { limit: 2 })).resolves.toEqual(entry('d'));
    expect(spy).toHaveBeenNthCalledWith(1, { page: 1, limit: 2 });
    expect(spy).toHaveBeenNthCalledWith(2, { page: 2, limit: 2 });
  });

  it('stops at the end of the history', async () => {
    const spy = vi
      .spyOn(communicationApi, 'getHistoryPage')
      .mockResolvedValueOnce(page(['a', 'b'], 3))
      .mockResolvedValueOnce(page(['c'], 3));
    await expect(communicationApi.findHistoryEntry('z', { limit: 2 })).resolves.toBeNull();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('gives up after the page limit', async () => {
    const spy = vi
      .spyOn(communicationApi, 'getHistoryPage')
      .mockResolvedValue(page(['a', 'b'], 1000));
    await expect(
      communicationApi.findHistoryEntry('z', { limit: 2, maxPages: 3 }),
    ).resolves.toBeNull();
    expect(spy).toHaveBeenCalledTimes(3);
  });
});
