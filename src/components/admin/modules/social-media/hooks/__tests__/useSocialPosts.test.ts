import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
}));
vi.mock('sonner', () => ({ toast }));

const postsApi = vi.hoisted(() => ({
  getByDateRange: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
}));
vi.mock('../../api', () => ({ postsApi }));

import { defaultPostRange, describeComposeResult, useSocialPosts } from '../useSocialPosts';
import type { SocialPost } from '../../types';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client }, children);
}

const post = (id: string, status: SocialPost['status']): SocialPost => ({
  id,
  profiles: ['c'],
  body: 'b',
  media: [],
  status,
  createdBy: 'api',
  createdAt: new Date(),
  updatedAt: new Date(),
  retryCount: 0,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useSocialPosts', () => {
  it('fetches the default window and filters by status', async () => {
    postsApi.getByDateRange.mockResolvedValue([post('1', 'scheduled'), post('2', 'published')]);
    const { result } = renderHook(() => useSocialPosts(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.posts).toHaveLength(2);
    expect(result.current.getPostsByStatus('scheduled').map((p) => p.id)).toEqual(['1']);
    const [start, end] = postsApi.getByDateRange.mock.calls[0];
    expect(end.getTime() - start.getTime()).toBe(77 * 24 * 60 * 60 * 1000);
  });

  it('creates through Buffer and toasts by outcome', async () => {
    postsApi.getByDateRange.mockResolvedValue([]);
    postsApi.create.mockResolvedValue({ created: [{ channelId: 'c' }], failed: [] });
    const { result } = renderHook(() => useSocialPosts(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let outcome;
    await act(async () => {
      outcome = await result.current.createPost({ channelIds: ['c'], text: 't', mode: 'queue' });
    });
    expect(outcome).toEqual({ created: [{ channelId: 'c' }], failed: [] });
    expect(toast.success).toHaveBeenCalledWith('Sent to Buffer for 1 channel');

    postsApi.create.mockResolvedValue({
      created: [],
      failed: [{ channelId: 'c', platform: 'x', error: 'nope' }],
    });
    await act(async () => {
      await result.current.createPost({ channelIds: ['c'], text: 't', mode: 'queue' });
    });
    expect(toast.error).toHaveBeenCalledWith('nope');
  });

  it('returns null and toasts when the request itself fails', async () => {
    postsApi.getByDateRange.mockResolvedValue([]);
    postsApi.create.mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useSocialPosts(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    let outcome: unknown = 'unset';
    await act(async () => {
      outcome = await result.current.createPost({ channelIds: ['c'], text: 't', mode: 'now' });
    });
    expect(outcome).toBeNull();
    expect(toast.error).toHaveBeenCalledWith('Network error');
  });

  it('deletes in Buffer', async () => {
    postsApi.getByDateRange.mockResolvedValue([]);
    postsApi.delete.mockResolvedValue(undefined);
    const { result } = renderHook(() => useSocialPosts(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    let ok = false;
    await act(async () => {
      ok = await result.current.deletePost('p1');
    });
    expect(ok).toBe(true);
    expect(postsApi.delete).toHaveBeenCalledWith('p1');
    expect(toast.success).toHaveBeenCalledWith('Post deleted in Buffer');
  });
});

describe('helpers', () => {
  it('describes compose outcomes', () => {
    expect(
      describeComposeResult({
        created: [{ channelId: 'a' }, { channelId: 'b' }] as never,
        failed: [],
      }),
    ).toEqual({
      kind: 'success',
      message: 'Sent to Buffer for 2 channels',
    });
    expect(
      describeComposeResult({
        created: [{ channelId: 'a' }] as never,
        failed: [{ channelId: 'b', platform: null, error: 'x' }],
      }),
    ).toEqual({ kind: 'partial', message: '1 created, 1 failed: x' });
    expect(describeComposeResult({ created: [], failed: [] })).toEqual({
      kind: 'error',
      message: 'Buffer rejected the post',
    });
  });

  it('default range spans two weeks back to nine weeks ahead', () => {
    const now = new Date('2026-09-10T00:00:00.000Z');
    const range = defaultPostRange(now);
    expect(range.start.toISOString()).toBe('2026-08-27T00:00:00.000Z');
    expect(range.end.toISOString()).toBe('2026-11-12T00:00:00.000Z');
  });
});
