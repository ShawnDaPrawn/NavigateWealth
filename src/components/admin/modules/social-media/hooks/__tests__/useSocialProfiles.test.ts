import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

const profilesApi = vi.hoisted(() => ({ getAll: vi.fn(), getStatus: vi.fn() }));
vi.mock('../../api', () => ({ profilesApi }));

import { useBufferStatus, useSocialProfiles } from '../useSocialProfiles';
import type { SocialProfile } from '../../types';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client }, children);
}

const profile = (
  id: string,
  platform: SocialProfile['platform'],
  isConnected: boolean,
): SocialProfile => ({
  id,
  platform,
  name: id,
  username: id,
  isConnected,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useSocialProfiles', () => {
  it('exposes Buffer channels and the connected subset', async () => {
    profilesApi.getAll.mockResolvedValue([
      profile('li', 'linkedin', true),
      profile('x', 'x', false),
    ]);
    const { result } = renderHook(() => useSocialProfiles(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.profiles).toHaveLength(2);
    expect(result.current.connectedProfiles.map((p) => p.id)).toEqual(['li']);
    expect(result.current.isConnected('linkedin')).toBe(true);
    expect(result.current.isConnected('x')).toBe(false);
    expect(result.current.getProfileById('x')?.platform).toBe('x');
    expect(result.current.getProfilesByPlatform('linkedin')).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('surfaces a fetch error', async () => {
    profilesApi.getAll.mockRejectedValue(new Error('Buffer API key is not configured'));
    const { result } = renderHook(() => useSocialProfiles(), { wrapper });
    await waitFor(() => expect(result.current.error).toBe('Buffer API key is not configured'));
    expect(result.current.profiles).toEqual([]);
  });

  it('does not fetch when disabled', () => {
    const { result } = renderHook(() => useSocialProfiles({ fetchOnMount: false }), { wrapper });
    expect(result.current.loading).toBe(false);
    expect(profilesApi.getAll).not.toHaveBeenCalled();
  });
});

describe('useBufferStatus', () => {
  it('reads the status', async () => {
    profilesApi.getStatus.mockResolvedValue({
      configured: true,
      account: { email: 'e', organizations: [] },
    });
    const { result } = renderHook(() => useBufferStatus(), { wrapper });
    await waitFor(() => expect(result.current.data?.configured).toBe(true));
  });
});
