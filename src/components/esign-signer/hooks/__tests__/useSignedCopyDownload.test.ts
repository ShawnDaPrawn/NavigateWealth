/**
 * "Download Copy" on the completion screen. Incident 2026-11-23: it used the
 * signing token (rotated on submit → 404), gave up on a copy still being
 * sealed, and swallowed every failure.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSignedCopyDownload } from '../useSignedCopyDownload';
import type { SignerSessionData } from '../../types';

const session = (extra: Partial<SignerSessionData> = {}) =>
  ({ envelope_title: 'Letter', ...extra }) as SignerSessionData;

const res = (status: number, body: unknown = {}) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    blob: async () => new Blob(['%PDF']),
    json: async () => body,
  }) as Response;

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  window.URL.createObjectURL = vi.fn(() => 'blob:x');
  window.URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('useSignedCopyDownload', () => {
  it('downloads with the grant from the submit response, not the rotated token', async () => {
    vi.mocked(fetch).mockResolvedValue(res(200));
    const { result } = renderHook(() =>
      useSignedCopyDownload({
        sessionData: session({ download_token: 'dl_grant', envelope_complete: true }),
        token: 'rotated-away',
      }),
    );
    await act(() => result.current.handleDownload());
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain('/signer/download/dl_grant');
    expect(result.current.notice).toBeNull();
  });

  it('waits while the signed copy is still being sealed', async () => {
    vi.useFakeTimers();
    vi.mocked(fetch)
      .mockResolvedValueOnce(res(409, { retryable: true }))
      .mockResolvedValueOnce(res(200));
    const { result } = renderHook(() =>
      useSignedCopyDownload({ sessionData: session({ download_token: 'dl_g' }), token: 't' }),
    );
    let done: Promise<void> = Promise.resolve();
    act(() => {
      done = result.current.handleDownload();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
      await done;
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.current.notice).toBeNull();
  });

  it('says so, instead of doing nothing, when the download fails', async () => {
    vi.mocked(fetch).mockResolvedValue(res(404, { error: 'Invalid or expired signing link' }));
    const { result } = renderHook(() =>
      useSignedCopyDownload({ sessionData: session(), token: 't' }),
    );
    await act(() => result.current.handleDownload());
    expect(result.current.notice).toEqual({
      tone: 'error',
      text: 'Invalid or expired signing link',
    });
  });

  it('explains that the copy comes once everyone has signed', async () => {
    const { result } = renderHook(() =>
      useSignedCopyDownload({ sessionData: session({ envelope_complete: false }), token: 't' }),
    );
    await act(() => result.current.handleDownload());
    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.available).toBe(false);
    expect(result.current.notice?.tone).toBe('info');
  });
});
