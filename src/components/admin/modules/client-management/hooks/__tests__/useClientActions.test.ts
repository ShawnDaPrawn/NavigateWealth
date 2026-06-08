/**
 * Tests for useClientActions hook.
 *
 * Strategy: mock sonner's toast and the API module.
 * Use renderHook + act to test async behaviour.
 *
 * NOTE: paths from __tests__/ need one extra ../ compared to the source file.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const mockUpdateClientMetadata = vi.fn();
const mockRunSanctionsScreening = vi.fn();

vi.mock('../../api', () => ({
  clientApi: {
    updateClientMetadata: (...args: unknown[]) => mockUpdateClientMetadata(...args),
    runSanctionsScreening: (...args: unknown[]) => mockRunSanctionsScreening(...args),
  },
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { useClientActions } from '../useClientActions';
import { toast } from 'sonner';

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('useClientActions — initial state', () => {
  beforeEach(() => vi.clearAllMocks());

  it('initial updating is false', () => {
    const { result } = renderHook(() => useClientActions());
    expect(result.current.updating).toBe(false);
  });
});

describe('useClientActions — updateClientMetadata', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updating is false after successful call', async () => {
    mockUpdateClientMetadata.mockResolvedValue(undefined);
    const { result } = renderHook(() => useClientActions());

    await act(async () => {
      await result.current.updateClientMetadata('user-1', { plan: 'premium' });
    });

    expect(result.current.updating).toBe(false);
  });

  it('returns true on success', async () => {
    mockUpdateClientMetadata.mockResolvedValue(undefined);
    const { result } = renderHook(() => useClientActions());

    let returnValue: boolean | undefined;
    await act(async () => {
      returnValue = await result.current.updateClientMetadata('user-1', { plan: 'premium' });
    });

    expect(returnValue).toBe(true);
  });

  it('calls toast.success on success', async () => {
    mockUpdateClientMetadata.mockResolvedValue(undefined);
    const { result } = renderHook(() => useClientActions());

    await act(async () => {
      await result.current.updateClientMetadata('user-1', {});
    });

    expect(toast.success).toHaveBeenCalledWith('Client profile updated successfully');
  });

  it('returns false on failure', async () => {
    mockUpdateClientMetadata.mockRejectedValue(new Error('network error'));
    const { result } = renderHook(() => useClientActions());

    let returnValue: boolean | undefined;
    await act(async () => {
      returnValue = await result.current.updateClientMetadata('user-1', {});
    });

    expect(returnValue).toBe(false);
  });

  it('calls toast.error on failure with error message', async () => {
    mockUpdateClientMetadata.mockRejectedValue(new Error('network error'));
    const { result } = renderHook(() => useClientActions());

    await act(async () => {
      await result.current.updateClientMetadata('user-1', {});
    });

    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('network error'));
  });

  it('updating is false after failed call', async () => {
    mockUpdateClientMetadata.mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useClientActions());

    await act(async () => {
      await result.current.updateClientMetadata('user-1', {});
    });

    expect(result.current.updating).toBe(false);
  });

  it('calls toast.error with fallback message for non-Error rejection', async () => {
    mockUpdateClientMetadata.mockRejectedValue('plain error');
    const { result } = renderHook(() => useClientActions());

    await act(async () => {
      await result.current.updateClientMetadata('user-1', {});
    });

    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Unknown error'));
  });
});

describe('useClientActions — runSanctionsScreening', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns true on success', async () => {
    mockRunSanctionsScreening.mockResolvedValue(undefined);
    const { result } = renderHook(() => useClientActions());

    let returnValue: boolean | undefined;
    await act(async () => {
      returnValue = await result.current.runSanctionsScreening('user-1');
    });

    expect(returnValue).toBe(true);
  });

  it('calls toast.success on success', async () => {
    mockRunSanctionsScreening.mockResolvedValue(undefined);
    const { result } = renderHook(() => useClientActions());

    await act(async () => {
      await result.current.runSanctionsScreening('user-1');
    });

    expect(toast.success).toHaveBeenCalledWith('Sanctions screening completed. No matches found.');
  });

  it('returns false on failure', async () => {
    mockRunSanctionsScreening.mockRejectedValue(new Error('screening error'));
    const { result } = renderHook(() => useClientActions());

    let returnValue: boolean | undefined;
    await act(async () => {
      returnValue = await result.current.runSanctionsScreening('user-1');
    });

    expect(returnValue).toBe(false);
  });

  it('calls toast.error on failure', async () => {
    mockRunSanctionsScreening.mockRejectedValue(new Error('screening error'));
    const { result } = renderHook(() => useClientActions());

    await act(async () => {
      await result.current.runSanctionsScreening('user-1');
    });

    expect(toast.error).toHaveBeenCalledWith('Sanctions screening failed');
  });

  it('updating is false after call completes (success)', async () => {
    mockRunSanctionsScreening.mockResolvedValue(undefined);
    const { result } = renderHook(() => useClientActions());

    await act(async () => {
      await result.current.runSanctionsScreening('user-1');
    });

    expect(result.current.updating).toBe(false);
  });

  it('updating is false after call completes (failure)', async () => {
    mockRunSanctionsScreening.mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useClientActions());

    await act(async () => {
      await result.current.runSanctionsScreening('user-1');
    });

    expect(result.current.updating).toBe(false);
  });
});
