/**
 * Tests for useEnvelopeActions hook
 *
 * Pure useState hook — no React Query. All API calls are mocked.
 * Mock paths are relative to this test file (hooks/__tests__/):
 *   - '../../api'             → esign/api.ts
 *   - '../../../../../../utils/logger' → utils/logger.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEnvelopeActions } from '../useEnvelopeActions';

// ============================================================================
// TOP-LEVEL MOCK SPIES
// vi.mock is hoisted before variable declarations, so we use arrow-function
// wrappers to avoid ReferenceError at hoist time.
// ============================================================================

const mockUploadDocument = vi.fn();
const mockSendInvites = vi.fn();
const mockSubmitSignature = vi.fn();
const mockRejectSigning = vi.fn();
const mockSaveAsTemplate = vi.fn();
const mockSaveFields = vi.fn();
const mockDeleteEnvelope = vi.fn();
const mockVoidEnvelope = vi.fn();
const mockDownloadDocument = vi.fn();

vi.mock('../../api', () => ({
  esignApi: {
    uploadDocument: (...args: unknown[]) => mockUploadDocument(...args),
    sendInvites: (...args: unknown[]) => mockSendInvites(...args),
    submitSignature: (...args: unknown[]) => mockSubmitSignature(...args),
    rejectSigning: (...args: unknown[]) => mockRejectSigning(...args),
    saveAsTemplate: (...args: unknown[]) => mockSaveAsTemplate(...args),
    saveFields: (...args: unknown[]) => mockSaveFields(...args),
    deleteEnvelope: (...args: unknown[]) => mockDeleteEnvelope(...args),
    voidEnvelope: (...args: unknown[]) => mockVoidEnvelope(...args),
    downloadDocument: (...args: unknown[]) => mockDownloadDocument(...args),
  },
}));

vi.mock('../../../../../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ============================================================================
// HELPERS
// ============================================================================

/** Minimal valid File object for upload requests */
function makeFile(name = 'test.pdf'): File {
  return new File(['content'], name, { type: 'application/pdf' });
}

/** Minimal valid UploadDocumentRequest with at least one file */
function makeUploadRequest(files: File[] = [makeFile()]) {
  return {
    files,
    context: { title: 'Test Envelope', clientId: 'client-1' },
  };
}

/** Minimal EsignEnvelope shape */
function makeEnvelope(id = 'env-1') {
  return {
    id,
    client_id: 'client-1',
    title: 'Test Envelope',
    status: 'draft' as const,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };
}

// ============================================================================
// SETUP
// ============================================================================

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================================
// INITIAL STATE
// ============================================================================

describe('useEnvelopeActions – initial state', () => {
  it('returns false for all loading flags', () => {
    const { result } = renderHook(() => useEnvelopeActions());
    expect(result.current.uploading).toBe(false);
    expect(result.current.sending).toBe(false);
    expect(result.current.signing).toBe(false);
    expect(result.current.rejecting).toBe(false);
    expect(result.current.savingTemplate).toBe(false);
    expect(result.current.savingFields).toBe(false);
    expect(result.current.deleting).toBe(false);
    expect(result.current.voiding).toBe(false);
    expect(result.current.downloading).toBe(false);
  });

  it('returns null for all error states', () => {
    const { result } = renderHook(() => useEnvelopeActions());
    expect(result.current.uploadError).toBeNull();
    expect(result.current.sendError).toBeNull();
    expect(result.current.signError).toBeNull();
    expect(result.current.rejectError).toBeNull();
    expect(result.current.templateError).toBeNull();
    expect(result.current.saveFieldsError).toBeNull();
    expect(result.current.deleteError).toBeNull();
    expect(result.current.voidError).toBeNull();
  });

  it('exposes all action functions', () => {
    const { result } = renderHook(() => useEnvelopeActions());
    expect(typeof result.current.uploadDocument).toBe('function');
    expect(typeof result.current.sendInvites).toBe('function');
    expect(typeof result.current.submitSignature).toBe('function');
    expect(typeof result.current.rejectSigning).toBe('function');
    expect(typeof result.current.saveAsTemplate).toBe('function');
    expect(typeof result.current.saveFields).toBe('function');
    expect(typeof result.current.deleteEnvelope).toBe('function');
    expect(typeof result.current.voidEnvelope).toBe('function');
    expect(typeof result.current.downloadDocument).toBe('function');
  });
});

// ============================================================================
// uploadDocument
// ============================================================================

describe('uploadDocument', () => {
  it('returns the envelope with field_candidates on success', async () => {
    const envelope = makeEnvelope();
    const candidates = [
      {
        id: 'f1',
        type: 'signature',
        page: 1,
        x: 10,
        y: 20,
        width: 100,
        height: 50,
        required: true,
        source: 'acroform' as const,
      },
    ];
    mockUploadDocument.mockResolvedValue({ envelope, field_candidates: candidates });

    const { result } = renderHook(() => useEnvelopeActions());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.uploadDocument(makeUploadRequest());
    });

    expect(returned).toMatchObject({ id: 'env-1', field_candidates: candidates });
  });

  it('returns envelope with empty field_candidates when API response omits them', async () => {
    const envelope = makeEnvelope();
    mockUploadDocument.mockResolvedValue({ envelope });

    const { result } = renderHook(() => useEnvelopeActions());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.uploadDocument(makeUploadRequest());
    });

    expect((returned as { field_candidates: unknown[] }).field_candidates).toEqual([]);
  });

  it('sets uploading=false after a successful call', async () => {
    mockUploadDocument.mockResolvedValue({ envelope: makeEnvelope() });

    const { result } = renderHook(() => useEnvelopeActions());
    await act(async () => {
      await result.current.uploadDocument(makeUploadRequest());
    });

    expect(result.current.uploading).toBe(false);
  });

  it('returns null and sets uploadError when no files are provided', async () => {
    const { result } = renderHook(() => useEnvelopeActions());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.uploadDocument(makeUploadRequest([]));
    });

    expect(returned).toBeNull();
    expect(result.current.uploadError).toBe(
      'No files provided. Please select at least one document.',
    );
    expect(result.current.uploading).toBe(false);
  });

  it('returns null and sets uploadError on API failure', async () => {
    mockUploadDocument.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useEnvelopeActions());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.uploadDocument(makeUploadRequest());
    });

    expect(returned).toBeNull();
    expect(result.current.uploadError).toBe('Network error');
    expect(result.current.uploading).toBe(false);
  });

  it('sets uploadError to fallback message when a non-Error is thrown', async () => {
    mockUploadDocument.mockRejectedValue('unexpected failure');

    const { result } = renderHook(() => useEnvelopeActions());
    await act(async () => {
      await result.current.uploadDocument(makeUploadRequest());
    });

    expect(result.current.uploadError).toBe('Upload failed');
  });
});

// ============================================================================
// sendInvites
// ============================================================================

describe('sendInvites', () => {
  const req = { signers: [{ name: 'Alice', email: 'alice@example.com' }] };

  it('returns true on success', async () => {
    mockSendInvites.mockResolvedValue({});
    const { result } = renderHook(() => useEnvelopeActions());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.sendInvites('env-1', req);
    });

    expect(returned).toBe(true);
  });

  it('clears loading state after success', async () => {
    mockSendInvites.mockResolvedValue({});
    const { result } = renderHook(() => useEnvelopeActions());

    await act(async () => {
      await result.current.sendInvites('env-1', req);
    });

    expect(result.current.sending).toBe(false);
  });

  it('returns false and sets sendError on failure', async () => {
    mockSendInvites.mockRejectedValue(new Error('Send failed'));
    const { result } = renderHook(() => useEnvelopeActions());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.sendInvites('env-1', req);
    });

    expect(returned).toBe(false);
    expect(result.current.sendError).toBe('Send failed');
    expect(result.current.sending).toBe(false);
  });
});

// ============================================================================
// submitSignature
// ============================================================================

describe('submitSignature', () => {
  const req = { signerId: 'signer-1', consentAccepted: true };

  it('returns true on success', async () => {
    mockSubmitSignature.mockResolvedValue({});
    const { result } = renderHook(() => useEnvelopeActions());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.submitSignature('env-1', req);
    });

    expect(returned).toBe(true);
  });

  it('clears loading state after success', async () => {
    mockSubmitSignature.mockResolvedValue({});
    const { result } = renderHook(() => useEnvelopeActions());

    await act(async () => {
      await result.current.submitSignature('env-1', req);
    });

    expect(result.current.signing).toBe(false);
  });

  it('returns false and sets signError on failure', async () => {
    mockSubmitSignature.mockRejectedValue(new Error('Sign failed'));
    const { result } = renderHook(() => useEnvelopeActions());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.submitSignature('env-1', req);
    });

    expect(returned).toBe(false);
    expect(result.current.signError).toBe('Sign failed');
    expect(result.current.signing).toBe(false);
  });
});

// ============================================================================
// rejectSigning
// ============================================================================

describe('rejectSigning', () => {
  const req = { signerId: 'signer-1', reason: 'Not acceptable' };

  it('returns true on success', async () => {
    mockRejectSigning.mockResolvedValue({});
    const { result } = renderHook(() => useEnvelopeActions());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.rejectSigning('env-1', req);
    });

    expect(returned).toBe(true);
  });

  it('clears loading state after success', async () => {
    mockRejectSigning.mockResolvedValue({});
    const { result } = renderHook(() => useEnvelopeActions());

    await act(async () => {
      await result.current.rejectSigning('env-1', req);
    });

    expect(result.current.rejecting).toBe(false);
  });

  it('returns false and sets rejectError on failure', async () => {
    mockRejectSigning.mockRejectedValue(new Error('Reject failed'));
    const { result } = renderHook(() => useEnvelopeActions());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.rejectSigning('env-1', req);
    });

    expect(returned).toBe(false);
    expect(result.current.rejectError).toBe('Reject failed');
    expect(result.current.rejecting).toBe(false);
  });
});

// ============================================================================
// saveAsTemplate
// ============================================================================

describe('saveAsTemplate', () => {
  const req = { name: 'My Template', description: 'Desc' };

  it('returns true on success', async () => {
    mockSaveAsTemplate.mockResolvedValue({ id: 'tpl-1' });
    const { result } = renderHook(() => useEnvelopeActions());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.saveAsTemplate('env-1', req);
    });

    expect(returned).toBe(true);
  });

  it('clears loading state after success', async () => {
    mockSaveAsTemplate.mockResolvedValue({ id: 'tpl-1' });
    const { result } = renderHook(() => useEnvelopeActions());

    await act(async () => {
      await result.current.saveAsTemplate('env-1', req);
    });

    expect(result.current.savingTemplate).toBe(false);
  });

  it('returns false and sets templateError on failure', async () => {
    mockSaveAsTemplate.mockRejectedValue(new Error('Template error'));
    const { result } = renderHook(() => useEnvelopeActions());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.saveAsTemplate('env-1', req);
    });

    expect(returned).toBe(false);
    expect(result.current.templateError).toBe('Template error');
    expect(result.current.savingTemplate).toBe(false);
  });
});

// ============================================================================
// saveFields
// ============================================================================

describe('saveFields', () => {
  it('returns true on success', async () => {
    mockSaveFields.mockResolvedValue({ success: true, fields: [] });
    const { result } = renderHook(() => useEnvelopeActions());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.saveFields('env-1', []);
    });

    expect(returned).toBe(true);
  });

  it('clears loading state after success', async () => {
    mockSaveFields.mockResolvedValue({ success: true, fields: [] });
    const { result } = renderHook(() => useEnvelopeActions());

    await act(async () => {
      await result.current.saveFields('env-1', []);
    });

    expect(result.current.savingFields).toBe(false);
  });

  it('returns false and sets saveFieldsError on failure', async () => {
    mockSaveFields.mockRejectedValue(new Error('Fields error'));
    const { result } = renderHook(() => useEnvelopeActions());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.saveFields('env-1', []);
    });

    expect(returned).toBe(false);
    expect(result.current.saveFieldsError).toBe('Fields error');
    expect(result.current.savingFields).toBe(false);
  });
});

// ============================================================================
// deleteEnvelope
// ============================================================================

describe('deleteEnvelope', () => {
  it('returns true on success', async () => {
    mockDeleteEnvelope.mockResolvedValue(undefined);
    const { result } = renderHook(() => useEnvelopeActions());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.deleteEnvelope('env-1');
    });

    expect(returned).toBe(true);
  });

  it('clears loading state after success', async () => {
    mockDeleteEnvelope.mockResolvedValue(undefined);
    const { result } = renderHook(() => useEnvelopeActions());

    await act(async () => {
      await result.current.deleteEnvelope('env-1');
    });

    expect(result.current.deleting).toBe(false);
  });

  it('returns false and sets deleteError on failure', async () => {
    mockDeleteEnvelope.mockRejectedValue(new Error('Delete failed'));
    const { result } = renderHook(() => useEnvelopeActions());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.deleteEnvelope('env-1');
    });

    expect(returned).toBe(false);
    expect(result.current.deleteError).toBe('Delete failed');
    expect(result.current.deleting).toBe(false);
  });
});

// ============================================================================
// voidEnvelope
// ============================================================================

describe('voidEnvelope', () => {
  it('returns true on success', async () => {
    mockVoidEnvelope.mockResolvedValue(undefined);
    const { result } = renderHook(() => useEnvelopeActions());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.voidEnvelope('env-1', 'Too late');
    });

    expect(returned).toBe(true);
  });

  it('passes reason to API call', async () => {
    mockVoidEnvelope.mockResolvedValue(undefined);
    const { result } = renderHook(() => useEnvelopeActions());

    await act(async () => {
      await result.current.voidEnvelope('env-1', 'Wrong signer');
    });

    expect(mockVoidEnvelope).toHaveBeenCalledWith('env-1', 'Wrong signer');
  });

  it('clears loading state after success', async () => {
    mockVoidEnvelope.mockResolvedValue(undefined);
    const { result } = renderHook(() => useEnvelopeActions());

    await act(async () => {
      await result.current.voidEnvelope('env-1');
    });

    expect(result.current.voiding).toBe(false);
  });

  it('returns false and sets voidError on failure', async () => {
    mockVoidEnvelope.mockRejectedValue(new Error('Void failed'));
    const { result } = renderHook(() => useEnvelopeActions());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.voidEnvelope('env-1');
    });

    expect(returned).toBe(false);
    expect(result.current.voidError).toBe('Void failed');
    expect(result.current.voiding).toBe(false);
  });
});

// ============================================================================
// downloadDocument
// ============================================================================

describe('downloadDocument', () => {
  it('calls esignApi.downloadDocument with envelopeId and filename', async () => {
    mockDownloadDocument.mockResolvedValue(undefined);
    const { result } = renderHook(() => useEnvelopeActions());

    await act(async () => {
      await result.current.downloadDocument('env-1', 'signed.pdf');
    });

    expect(mockDownloadDocument).toHaveBeenCalledWith('env-1', 'signed.pdf');
  });

  it('calls esignApi.downloadDocument with only envelopeId when no filename', async () => {
    mockDownloadDocument.mockResolvedValue(undefined);
    const { result } = renderHook(() => useEnvelopeActions());

    await act(async () => {
      await result.current.downloadDocument('env-1');
    });

    expect(mockDownloadDocument).toHaveBeenCalledWith('env-1', undefined);
  });

  it('clears downloading state after completion', async () => {
    mockDownloadDocument.mockResolvedValue(undefined);
    const { result } = renderHook(() => useEnvelopeActions());

    await act(async () => {
      await result.current.downloadDocument('env-1');
    });

    expect(result.current.downloading).toBe(false);
  });

  it('does not throw when the API call fails', async () => {
    mockDownloadDocument.mockRejectedValue(new Error('Download error'));
    const { result } = renderHook(() => useEnvelopeActions());

    await act(async () => {
      await expect(result.current.downloadDocument('env-1')).resolves.toBeUndefined();
    });

    expect(result.current.downloading).toBe(false);
  });
});
