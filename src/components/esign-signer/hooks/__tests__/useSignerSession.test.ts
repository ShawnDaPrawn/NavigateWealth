/**
 * useSignerSession — unit tests
 *
 * The hook wraps esignSignerService calls with loading/error state management.
 * We mock the service and test every public method the hook exposes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mock esignSignerService
// ---------------------------------------------------------------------------
const mockValidateAccessToken = vi.fn();
const mockVerifyOtp = vi.fn();
const mockResendOtp = vi.fn();
const mockVerifyKba = vi.fn();
const mockSubmitSignature = vi.fn();
const mockRejectDocument = vi.fn();

vi.mock('../../services/esignSignerService', () => ({
  esignSignerService: {
    validateAccessToken: (...args: unknown[]) => mockValidateAccessToken(...args),
    verifyOtp: (...args: unknown[]) => mockVerifyOtp(...args),
    resendOtp: (...args: unknown[]) => mockResendOtp(...args),
    verifyKba: (...args: unknown[]) => mockVerifyKba(...args),
    submitSignature: (...args: unknown[]) => mockSubmitSignature(...args),
    rejectDocument: (...args: unknown[]) => mockRejectDocument(...args),
  },
}));

import { useSignerSession } from '../useSignerSession';
import type { SignerSessionData } from '../../types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const SESSION: SignerSessionData = {
  envelope_id: 'env-1',
  envelope_title: 'Test Envelope',
  signer_id: 'signer-1',
  signer_name: 'Alice',
  signer_email: 'alice@example.com',
  signer_status: 'pending',
  otp_required: true,
  document_url: 'https://example.com/doc.pdf',
  page_count: 3,
  fields: [],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe('initial state', () => {
  it('starts with null sessionData, loading=false, error=null', () => {
    const { result } = renderHook(() => useSignerSession());
    expect(result.current.sessionData).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });
});

describe('validateToken', () => {
  it('sets sessionData on success and returns validation result', async () => {
    mockValidateAccessToken.mockResolvedValueOnce({ success: true, data: SESSION });

    const { result } = renderHook(() => useSignerSession());

    let ret: Awaited<ReturnType<typeof result.current.validateToken>>;
    await act(async () => {
      ret = await result.current.validateToken('tok-1');
    });

    expect(mockValidateAccessToken).toHaveBeenCalledWith('tok-1');
    expect(result.current.sessionData?.envelope_id).toBe('env-1');
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(ret!.success).toBe(true);
  });

  it('maps document_page_count to page_count when page_count is 0', async () => {
    const rawData = { ...SESSION, page_count: 0, document_page_count: 5 };
    mockValidateAccessToken.mockResolvedValueOnce({ success: true, data: rawData });

    const { result } = renderHook(() => useSignerSession());
    await act(async () => {
      await result.current.validateToken('tok');
    });

    expect(result.current.sessionData?.page_count).toBe(5);
  });

  it('sets error and returns failure result when service returns failure', async () => {
    mockValidateAccessToken.mockResolvedValueOnce({
      success: false,
      error: 'Token expired',
    });

    const { result } = renderHook(() => useSignerSession());

    let ret: Awaited<ReturnType<typeof result.current.validateToken>>;
    await act(async () => {
      ret = await result.current.validateToken('bad-tok');
    });

    expect(result.current.sessionData).toBeNull();
    expect(result.current.error).toBe('Token expired');
    expect(ret!.success).toBe(false);
  });

  it('uses default error message when service returns failure without error field', async () => {
    mockValidateAccessToken.mockResolvedValueOnce({ success: false });

    const { result } = renderHook(() => useSignerSession());
    await act(async () => {
      await result.current.validateToken('tok');
    });

    expect(result.current.error).toBe('Invalid or expired token');
  });

  it('catches thrown exceptions and returns failure', async () => {
    mockValidateAccessToken.mockRejectedValueOnce(new Error('Network down'));

    const { result } = renderHook(() => useSignerSession());

    let ret: Awaited<ReturnType<typeof result.current.validateToken>>;
    await act(async () => {
      ret = await result.current.validateToken('tok');
    });

    expect(ret!.success).toBe(false);
    expect(ret!.error).toBe('Failed to validate token');
    expect(result.current.error).toBe('Failed to validate token');
    expect(result.current.loading).toBe(false);
  });
});

describe('verifyOtp', () => {
  it('updates signer_status to otp_verified on success', async () => {
    mockValidateAccessToken.mockResolvedValueOnce({ success: true, data: SESSION });
    mockVerifyOtp.mockResolvedValueOnce({ success: true });

    const { result } = renderHook(() => useSignerSession());

    // Populate session first
    await act(async () => {
      await result.current.validateToken('tok');
    });

    let ret: Awaited<ReturnType<typeof result.current.verifyOtp>>;
    await act(async () => {
      ret = await result.current.verifyOtp('tok', '123456');
    });

    expect(mockVerifyOtp).toHaveBeenCalledWith('tok', '123456');
    expect(result.current.sessionData?.signer_status).toBe('otp_verified');
    expect(ret!.success).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('sets error when OTP verification fails', async () => {
    mockVerifyOtp.mockResolvedValueOnce({ success: false, error: 'Wrong OTP' });

    const { result } = renderHook(() => useSignerSession());

    let ret: Awaited<ReturnType<typeof result.current.verifyOtp>>;
    await act(async () => {
      ret = await result.current.verifyOtp('tok', 'bad');
    });

    expect(result.current.error).toBe('Wrong OTP');
    expect(ret!.success).toBe(false);
  });

  it('uses default error message when verifyOtp returns failure without error', async () => {
    mockVerifyOtp.mockResolvedValueOnce({ success: false });

    const { result } = renderHook(() => useSignerSession());
    await act(async () => {
      await result.current.verifyOtp('tok', '000');
    });

    expect(result.current.error).toBe('Invalid OTP');
  });

  it('catches thrown exceptions in verifyOtp', async () => {
    mockVerifyOtp.mockRejectedValueOnce(new Error('Network'));

    const { result } = renderHook(() => useSignerSession());

    let ret: Awaited<ReturnType<typeof result.current.verifyOtp>>;
    await act(async () => {
      ret = await result.current.verifyOtp('tok', '123');
    });

    expect(ret!.success).toBe(false);
    expect(ret!.error).toBe('Failed to verify OTP');
    expect(result.current.loading).toBe(false);
  });
});

describe('verifyKba', () => {
  it('delegates the identity challenge and preserves a passed result', async () => {
    mockVerifyKba.mockResolvedValueOnce({ success: true, status: 'passed' });
    const { result } = renderHook(() => useSignerSession());

    let ret: Awaited<ReturnType<typeof result.current.verifyKba>>;
    await act(async () => {
      ret = await result.current.verifyKba('tok', '9001015009087');
    });

    expect(mockVerifyKba).toHaveBeenCalledWith('tok', '9001015009087');
    expect(ret!).toEqual({ success: true, status: 'passed' });
    expect(result.current.error).toBeNull();
  });

  it('fails closed when the identity provider rejects or throws', async () => {
    mockVerifyKba.mockResolvedValueOnce({ success: false, error: 'Not verified' });
    const { result } = renderHook(() => useSignerSession());

    await act(async () => {
      await result.current.verifyKba('tok');
    });
    expect(result.current.error).toBe('Not verified');

    mockVerifyKba.mockRejectedValueOnce(new Error('offline'));
    await act(async () => {
      await result.current.verifyKba('tok');
    });
    expect(result.current.error).toBe('Failed to verify identity');
  });
});

describe('submitSignature', () => {
  it('updates signer_status to signed on success', async () => {
    mockValidateAccessToken.mockResolvedValueOnce({ success: true, data: SESSION });
    mockSubmitSignature.mockResolvedValueOnce({ success: true });

    const { result } = renderHook(() => useSignerSession());
    await act(async () => {
      await result.current.validateToken('tok');
    });

    let ret: Awaited<ReturnType<typeof result.current.submitSignature>>;
    await act(async () => {
      ret = await result.current.submitSignature('tok', [
        { field_id: 'f1', type: 'signature', value: 'data:image/png;base64,xxx' },
      ]);
    });

    expect(mockSubmitSignature).toHaveBeenCalled();
    expect(result.current.sessionData?.signer_status).toBe('signed');
    expect(ret!.success).toBe(true);
  });

  it('sets error when submission fails', async () => {
    mockSubmitSignature.mockResolvedValueOnce({ success: false, error: 'Already signed' });

    const { result } = renderHook(() => useSignerSession());

    let ret: Awaited<ReturnType<typeof result.current.submitSignature>>;
    await act(async () => {
      ret = await result.current.submitSignature('tok', []);
    });

    expect(result.current.error).toBe('Already signed');
    expect(ret!.success).toBe(false);
  });

  it('uses default error when submitSignature returns failure without error field', async () => {
    mockSubmitSignature.mockResolvedValueOnce({ success: false });

    const { result } = renderHook(() => useSignerSession());
    await act(async () => {
      await result.current.submitSignature('tok', []);
    });

    expect(result.current.error).toBe('Failed to submit signature');
  });

  it('catches thrown exceptions in submitSignature', async () => {
    mockSubmitSignature.mockRejectedValueOnce(new Error('Network'));

    const { result } = renderHook(() => useSignerSession());

    let ret: Awaited<ReturnType<typeof result.current.submitSignature>>;
    await act(async () => {
      ret = await result.current.submitSignature('tok', []);
    });

    expect(ret!.success).toBe(false);
    expect(ret!.error).toBe('Failed to submit signature');
    expect(result.current.loading).toBe(false);
  });
});

describe('rejectDocument', () => {
  it('updates signer_status to rejected on success', async () => {
    mockValidateAccessToken.mockResolvedValueOnce({ success: true, data: SESSION });
    mockRejectDocument.mockResolvedValueOnce({ success: true });

    const { result } = renderHook(() => useSignerSession());
    await act(async () => {
      await result.current.validateToken('tok');
    });

    let ret: Awaited<ReturnType<typeof result.current.rejectDocument>>;
    await act(async () => {
      ret = await result.current.rejectDocument('tok', 'I do not agree');
    });

    expect(mockRejectDocument).toHaveBeenCalledWith('tok', 'I do not agree');
    expect(result.current.sessionData?.signer_status).toBe('rejected');
    expect(ret!.success).toBe(true);
  });

  it('sets error when rejection fails', async () => {
    mockRejectDocument.mockResolvedValueOnce({ success: false, error: 'Cannot reject' });

    const { result } = renderHook(() => useSignerSession());

    let ret: Awaited<ReturnType<typeof result.current.rejectDocument>>;
    await act(async () => {
      ret = await result.current.rejectDocument('tok', 'reason');
    });

    expect(result.current.error).toBe('Cannot reject');
    expect(ret!.success).toBe(false);
  });

  it('uses default error when rejectDocument returns failure without error field', async () => {
    mockRejectDocument.mockResolvedValueOnce({ success: false });

    const { result } = renderHook(() => useSignerSession());
    await act(async () => {
      await result.current.rejectDocument('tok', 'reason');
    });

    expect(result.current.error).toBe('Failed to reject document');
  });

  it('catches thrown exceptions in rejectDocument', async () => {
    mockRejectDocument.mockRejectedValueOnce(new Error('Network'));

    const { result } = renderHook(() => useSignerSession());

    let ret: Awaited<ReturnType<typeof result.current.rejectDocument>>;
    await act(async () => {
      ret = await result.current.rejectDocument('tok', 'r');
    });

    expect(ret!.success).toBe(false);
    expect(ret!.error).toBe('Failed to reject document');
    expect(result.current.loading).toBe(false);
  });
});

describe('resendOtp', () => {
  it('delegates directly to the service', async () => {
    mockResendOtp.mockResolvedValueOnce({ success: true });

    const { result } = renderHook(() => useSignerSession());

    let ret: Awaited<ReturnType<typeof result.current.resendOtp>>;
    await act(async () => {
      ret = await result.current.resendOtp('tok');
    });

    expect(mockResendOtp).toHaveBeenCalledWith('tok');
    expect(ret!.success).toBe(true);
  });
});
