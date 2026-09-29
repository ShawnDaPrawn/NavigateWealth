import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@/test/utils';

const { toastMock } = vi.hoisted(() => ({
  toastMock: { success: vi.fn(), error: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: toastMock }));

import { useFNAPublish } from '../useFNAPublish';

beforeEach(() => vi.clearAllMocks());

describe('useFNAPublish', () => {
  it('reports the published id, then closes', async () => {
    const onFNAComplete = vi.fn();
    const onClose = vi.fn();
    const { result } = renderHook(() =>
      useFNAPublish({ fnaType: 'medical', onFNAComplete, onClose }),
    );

    let ok = false;
    await act(async () => {
      ok = await result.current.publish(async () => 'fna-9');
    });

    expect(ok).toBe(true);
    expect(onFNAComplete).toHaveBeenCalledWith('fna-9');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(toastMock.success).toHaveBeenCalledWith('Medical Aid FNA published');
    expect(result.current.isPublishing).toBe(false);
  });

  it('keeps the wizard open and says so when the publish fails', async () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useFNAPublish({ fnaType: 'estate', onClose }));

    let ok = true;
    await act(async () => {
      ok = await result.current.publish(async () => {
        throw new Error('boom');
      });
    });

    expect(ok).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
    expect(toastMock.error).toHaveBeenCalledWith(
      'Failed to publish Estate Planning FNA. Please try again.',
    );
    expect(result.current.isPublishing).toBe(false);
  });
});
