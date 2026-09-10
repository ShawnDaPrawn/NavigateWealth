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

const socialAssetsApi = vi.hoisted(() => ({
  listBatches: vi.fn(),
  getBatch: vi.fn(),
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  listPlaybooks: vi.fn(),
  updatePlaybook: vi.fn(),
  updateAsset: vi.fn(),
  runJob: vi.fn(),
}));
vi.mock('../../api', () => ({ socialAssetsApi }));

import {
  describeJobReport,
  useRunSocialJob,
  useSocialBatch,
  useSocialBatches,
  useUpdateSocialAsset,
  useUpdateSocialSettings,
} from '../useSocialAssets';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useSocialAssets hooks', () => {
  it('lists batches and reads one week only when a key is given', async () => {
    socialAssetsApi.listBatches.mockResolvedValue([{ week_key: '2026-W38' }]);
    const { result } = renderHook(() => useSocialBatches(4), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual([{ week_key: '2026-W38' }]));
    expect(socialAssetsApi.listBatches).toHaveBeenCalledWith(4);

    const disabled = renderHook(() => useSocialBatch(null), { wrapper });
    expect(disabled.result.current.fetchStatus).toBe('idle');
    expect(socialAssetsApi.getBatch).not.toHaveBeenCalled();
  });

  it('saves settings into the cache and toasts', async () => {
    socialAssetsApi.updateSettings.mockResolvedValue({ id: 'default', enabled: false });
    const { result } = renderHook(() => useUpdateSocialSettings(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ enabled: false });
    });
    expect(socialAssetsApi.updateSettings).toHaveBeenCalledWith({ enabled: false });
    expect(toast.success).toHaveBeenCalledWith('Automation settings saved');
  });

  it('toasts the right message for each asset override', async () => {
    const { result } = renderHook(() => useUpdateSocialAsset(), { wrapper });
    socialAssetsApi.updateAsset.mockResolvedValueOnce({ state: 'rejected', image_status: 'none' });
    await act(async () => {
      await result.current.mutateAsync({ assetId: 'a', patch: { state: 'rejected' } });
    });
    expect(toast.success).toHaveBeenLastCalledWith('Asset removed from this week’s candidates');

    socialAssetsApi.updateAsset.mockResolvedValueOnce({
      state: 'generated',
      image_status: 'pending',
    });
    await act(async () => {
      await result.current.mutateAsync({ assetId: 'a', patch: { retryImage: true } });
    });
    expect(toast.success).toHaveBeenLastCalledWith('Image queued for rendering');

    socialAssetsApi.updateAsset.mockRejectedValueOnce(
      new Error('A scheduled asset is managed in Buffer'),
    );
    await act(async () => {
      await result.current
        .mutateAsync({ assetId: 'a', patch: { state: 'rejected' } })
        .catch(() => undefined);
    });
    expect(toast.error).toHaveBeenCalledWith('A scheduled asset is managed in Buffer');
  });

  it('runs a job and summarises its report', async () => {
    socialAssetsApi.runJob.mockResolvedValue({
      dryRun: false,
      scanned: 3,
      rendered: 2,
      failed: 1,
      skipped: 0,
      details: [],
    });
    const { result } = renderHook(() => useRunSocialJob(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync('render-images');
    });
    expect(toast.success).toHaveBeenCalledWith(
      'Images: 2 rendered, 1 failed, 0 skipped (of 3 pending)',
    );
    expect(
      describeJobReport('sync-buffer', {
        dryRun: false,
        checked: 4,
        published: 1,
        failed: 1,
        removed: 1,
        unchanged: 1,
        errors: [],
      }),
    ).toBe('Buffer sync: 1 published, 1 failed, 1 removed in Buffer, 1 unchanged (of 4 checked)');
  });
});
