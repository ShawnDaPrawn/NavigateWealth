/**
 * Tests for toastError / toastSuccess / toastInfo — sonner wrapper utilities.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockToastError = vi.fn().mockReturnValue('toast-id-1');
const mockToastSuccess = vi.fn().mockReturnValue('toast-id-2');
const mockToastInfo = vi.fn().mockReturnValue('toast-id-3');

vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
    info: (...args: unknown[]) => mockToastInfo(...args),
  },
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { toastError, toastSuccess, toastInfo } from '../toastWithRetry';

// ── Helpers ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockToastError.mockReturnValue('toast-id-1');
  mockToastSuccess.mockReturnValue('toast-id-2');
  mockToastInfo.mockReturnValue('toast-id-3');
});

// ── toastError ────────────────────────────────────────────────────────────────

describe('toastError', () => {
  it('calls toast.error with formatted context and reason', () => {
    toastError('Save failed', new Error('Network timeout'));
    expect(mockToastError).toHaveBeenCalledWith('Save failed: Network timeout', expect.any(Object));
  });

  it('uses string error as reason', () => {
    toastError('Load failed', 'server unavailable');
    expect(mockToastError).toHaveBeenCalledWith(
      'Load failed: server unavailable',
      expect.any(Object),
    );
  });

  it('uses "Unknown error" for non-string, non-Error reasons', () => {
    toastError('Operation failed', { code: 500 });
    expect(mockToastError).toHaveBeenCalledWith(
      'Operation failed: Unknown error',
      expect.any(Object),
    );
  });

  it('does not append reason when context ends with period', () => {
    toastError('Something went wrong.', new Error('details'));
    const [message] = mockToastError.mock.calls[0] as [string];
    expect(message).toBe('Something went wrong.');
  });

  it('does not append reason when context ends with exclamation mark', () => {
    toastError('Failed!', new Error('details'));
    const [message] = mockToastError.mock.calls[0] as [string];
    expect(message).toBe('Failed!');
  });

  it('uses default duration of 4000ms when no retry provided', () => {
    toastError('Error', new Error('oops'));
    const [, opts] = mockToastError.mock.calls[0] as [string, { duration: number }];
    expect(opts.duration).toBe(4000);
  });

  it('uses longer duration of 6000ms when retry is provided', () => {
    toastError('Error', new Error('oops'), { retry: () => {} });
    const [, opts] = mockToastError.mock.calls[0] as [string, { duration: number }];
    expect(opts.duration).toBe(6000);
  });

  it('includes retry action when retry is provided', () => {
    const retry = vi.fn();
    toastError('Error', new Error('oops'), { retry });
    const [, opts] = mockToastError.mock.calls[0] as [string, { action?: { label: string } }];
    expect(opts.action?.label).toBe('Retry');
  });

  it('has no action when retry is not provided', () => {
    toastError('Error', new Error('oops'));
    const [, opts] = mockToastError.mock.calls[0] as [string, { action?: unknown }];
    expect(opts.action).toBeUndefined();
  });

  it('passes id to toast.error', () => {
    toastError('Error', new Error('x'), { id: 'my-id' });
    const [, opts] = mockToastError.mock.calls[0] as [string, { id?: string }];
    expect(opts.id).toBe('my-id');
  });

  it('respects custom duration override', () => {
    toastError('Error', new Error('x'), { duration: 10000 });
    const [, opts] = mockToastError.mock.calls[0] as [string, { duration: number }];
    expect(opts.duration).toBe(10000);
  });

  it('returns the toast id', () => {
    const result = toastError('Error', new Error('x'));
    expect(result).toBe('toast-id-1');
  });

  it('retry onClick calls retry function', () => {
    const retry = vi.fn().mockReturnValue(undefined);
    toastError('Error', new Error('oops'), { retry });

    const [, opts] = mockToastError.mock.calls[0] as [string, { action: { onClick: () => void } }];
    opts.action.onClick();
    expect(retry).toHaveBeenCalledOnce();
  });
});

// ── toastSuccess ──────────────────────────────────────────────────────────────

describe('toastSuccess', () => {
  it('calls toast.success with the message', () => {
    toastSuccess('Saved successfully');
    expect(mockToastSuccess).toHaveBeenCalledWith('Saved successfully', expect.any(Object));
  });

  it('uses duration of 3000ms', () => {
    toastSuccess('Done');
    const [, opts] = mockToastSuccess.mock.calls[0] as [string, { duration: number }];
    expect(opts.duration).toBe(3000);
  });

  it('passes id to toast.success', () => {
    toastSuccess('Done', 'success-1');
    const [, opts] = mockToastSuccess.mock.calls[0] as [string, { id?: string }];
    expect(opts.id).toBe('success-1');
  });

  it('returns the toast id', () => {
    const result = toastSuccess('Done');
    expect(result).toBe('toast-id-2');
  });
});

// ── toastInfo ─────────────────────────────────────────────────────────────────

describe('toastInfo', () => {
  it('calls toast.info with the message', () => {
    toastInfo('Processing...');
    expect(mockToastInfo).toHaveBeenCalledWith('Processing...', expect.any(Object));
  });

  it('uses duration of 3000ms', () => {
    toastInfo('Note');
    const [, opts] = mockToastInfo.mock.calls[0] as [string, { duration: number }];
    expect(opts.duration).toBe(3000);
  });

  it('returns the toast id', () => {
    const result = toastInfo('Note');
    expect(result).toBe('toast-id-3');
  });
});
