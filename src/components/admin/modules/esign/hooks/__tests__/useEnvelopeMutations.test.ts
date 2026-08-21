import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  useUploadDocument,
  useSaveFields,
  useSendInvites,
  useVoidEnvelope,
  useSaveAsTemplate,
  useSendOTP,
  useSubmitSignature,
  useRejectSigning,
} from '../useEnvelopeMutations';

// ============================================================================
// MOCK SETUP
// ============================================================================

const mockInvalidateQueries = vi.fn();
const mockQueryClient = {
  invalidateQueries: mockInvalidateQueries,
};

vi.mock('@tanstack/react-query', () => ({
  useMutation: (options: Record<string, unknown>) => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    isSuccess: false,
    isIdle: true,
    error: null,
    data: undefined,
    reset: vi.fn(),
    // Expose options so tests can call mutationFn / onSuccess / onError directly
    _options: options,
  }),
  useQueryClient: () => mockQueryClient,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const mockEsignApi = {
  uploadDocument: vi.fn(),
  saveFields: vi.fn(),
  sendInvites: vi.fn(),
  voidEnvelope: vi.fn(),
  saveAsTemplate: vi.fn(),
  sendOTP: vi.fn(),
  submitSignature: vi.fn(),
  rejectSigning: vi.fn(),
};

vi.mock('../../api', () => ({
  esignApi: {
    uploadDocument: (...args: unknown[]) => mockEsignApi.uploadDocument(...args),
    saveFields: (...args: unknown[]) => mockEsignApi.saveFields(...args),
    sendInvites: (...args: unknown[]) => mockEsignApi.sendInvites(...args),
    voidEnvelope: (...args: unknown[]) => mockEsignApi.voidEnvelope(...args),
    saveAsTemplate: (...args: unknown[]) => mockEsignApi.saveAsTemplate(...args),
    sendOTP: (...args: unknown[]) => mockEsignApi.sendOTP(...args),
    submitSignature: (...args: unknown[]) => mockEsignApi.submitSignature(...args),
    rejectSigning: (...args: unknown[]) => mockEsignApi.rejectSigning(...args),
  },
}));

vi.mock('../useEnvelopesQuery', () => ({
  esignKeys: {
    all: ['esign'],
    envelopes: () => ['esign', 'envelopes'],
    envelope: (id: string) => ['esign', 'envelope', id],
    clientEnvelopes: (clientId: string) => ['esign', 'client', clientId],
    allEnvelopes: (status?: string) => ['esign', 'envelopes', { status }],
    auditTrail: (envelopeId: string) => ['esign', 'envelope', envelopeId, 'audit'],
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

vi.mock('../../utils/toastWithRetry', () => ({
  toastError: vi.fn(),
}));

vi.mock('../../constants', () => ({
  SUCCESS_MESSAGES: {
    ENVELOPE_CREATED: 'Envelope created successfully',
    ENVELOPE_SENT: 'Envelope sent to signers',
    ENVELOPE_VOIDED: 'Envelope voided successfully',
    SIGNATURE_SUBMITTED: 'Signature submitted successfully',
    TEMPLATE_SAVED: 'Template saved successfully',
    FIELDS_SAVED: 'Fields saved successfully',
    OTP_SENT: 'OTP sent successfully',
  },
  ERROR_MESSAGES: {
    UPLOAD_FAILED: 'Failed to upload document',
    SEND_FAILED: 'Failed to send invitations',
    VOID_FAILED: 'Failed to void envelope',
    SIGNATURE_FAILED: 'Failed to submit signature',
    TEMPLATE_FAILED: 'Failed to save template',
    FIELDS_FAILED: 'Failed to save fields',
    OTP_SEND_FAILED: 'Failed to send OTP',
  },
}));

// ============================================================================
// HELPERS
// ============================================================================

function getOptions(hook: () => any): Record<string, any> {
  const { result } = renderHook(hook);
  return result.current._options as Record<string, unknown>;
}

// ============================================================================
// TESTS
// ============================================================================

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useUploadDocument', () => {
  it('returns a mutation object with mutate and isPending', () => {
    const { result } = renderHook(() => useUploadDocument());
    expect(typeof result.current.mutate).toBe('function');
    expect(result.current.isPending).toBe(false);
  });

  it('mutationFn calls esignApi.uploadDocument with the request', async () => {
    const request = {
      files: [],
      context: { clientId: 'client-1', title: 'Test', message: 'Hi', expiryDays: 30 },
    };
    mockEsignApi.uploadDocument.mockResolvedValue({ id: 'env-1' });
    const { mutationFn } = getOptions(() => useUploadDocument());
    await mutationFn(request);
    expect(mockEsignApi.uploadDocument).toHaveBeenCalledWith(request);
  });

  it('onSuccess invalidates envelopes query', async () => {
    const { onSuccess } = getOptions(() => useUploadDocument());
    const variables = {
      files: [],
      context: { clientId: '', title: '', message: '', expiryDays: 30 },
    };
    await onSuccess(undefined, variables, undefined);
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['esign', 'envelopes'] });
  });

  it('onSuccess also invalidates clientEnvelopes when clientId is provided', async () => {
    const { onSuccess } = getOptions(() => useUploadDocument());
    const variables = {
      files: [],
      context: { clientId: 'client-42', title: '', message: '', expiryDays: 30 },
    };
    await onSuccess(undefined, variables, undefined);
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['esign', 'client', 'client-42'],
    });
  });

  it('onSuccess shows a success toast', async () => {
    const { toast } = await import('sonner');
    const { onSuccess } = getOptions(() => useUploadDocument());
    const variables = {
      files: [],
      context: { clientId: '', title: '', message: '', expiryDays: 30 },
    };
    await onSuccess(undefined, variables, undefined);
    expect(toast.success).toHaveBeenCalledWith('Envelope created successfully');
  });

  it('onError calls toastError with retry callback', async () => {
    const { toastError } = await import('../../utils/toastWithRetry');
    const { onError } = getOptions(() => useUploadDocument());
    const error = new Error('Network failure');
    const variables = {
      files: [],
      context: { clientId: '', title: '', message: '', expiryDays: 30 },
    };
    await onError(error, variables, undefined);
    expect(toastError).toHaveBeenCalledWith(
      'Failed to upload document',
      error,
      expect.objectContaining({ id: 'esign-upload-failed', retry: expect.any(Function) }),
    );
  });
});

describe('useSaveFields', () => {
  it('returns a mutation object with mutate and isPending', () => {
    const { result } = renderHook(() => useSaveFields());
    expect(typeof result.current.mutate).toBe('function');
    expect(result.current.isPending).toBe(false);
  });

  it('mutationFn calls esignApi.saveFields with envelopeId and fields', async () => {
    mockEsignApi.saveFields.mockResolvedValue({});
    const { mutationFn } = getOptions(() => useSaveFields());
    await mutationFn({ envelopeId: 'env-2', fields: [] });
    expect(mockEsignApi.saveFields).toHaveBeenCalledWith('env-2', []);
  });

  it('onSuccess invalidates the specific envelope query', async () => {
    const { onSuccess } = getOptions(() => useSaveFields());
    await onSuccess(undefined, { envelopeId: 'env-2', fields: [] }, undefined);
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['esign', 'envelope', 'env-2'],
    });
  });

  it('onSuccess shows fields-saved toast', async () => {
    const { toast } = await import('sonner');
    const { onSuccess } = getOptions(() => useSaveFields());
    await onSuccess(undefined, { envelopeId: 'env-2', fields: [] }, undefined);
    expect(toast.success).toHaveBeenCalledWith('Fields saved successfully');
  });

  it('onError calls toastError with envelope-scoped id', async () => {
    const { toastError } = await import('../../utils/toastWithRetry');
    const { onError } = getOptions(() => useSaveFields());
    const error = new Error('Save failed');
    await onError(error, { envelopeId: 'env-2', fields: [] }, undefined);
    expect(toastError).toHaveBeenCalledWith(
      'Failed to save fields',
      error,
      expect.objectContaining({ id: 'esign-savefields-env-2' }),
    );
  });
});

describe('useSendInvites', () => {
  it('returns a mutation object with mutate and isPending', () => {
    const { result } = renderHook(() => useSendInvites());
    expect(typeof result.current.mutate).toBe('function');
    expect(result.current.isPending).toBe(false);
  });

  it('mutationFn calls esignApi.sendInvites with envelopeId and request', async () => {
    mockEsignApi.sendInvites.mockResolvedValue({});
    const { mutationFn } = getOptions(() => useSendInvites());
    const req = { signers: [], expiryDays: 30, message: 'Sign please' };
    await mutationFn({ envelopeId: 'env-3', request: req });
    expect(mockEsignApi.sendInvites).toHaveBeenCalledWith('env-3', req);
  });

  it('onSuccess invalidates envelopes and specific envelope', async () => {
    const { onSuccess } = getOptions(() => useSendInvites());
    const req = { signers: [], expiryDays: 30, message: '' };
    await onSuccess(undefined, { envelopeId: 'env-3', request: req }, undefined);
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['esign', 'envelopes'] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['esign', 'envelope', 'env-3'],
    });
  });

  it('onSuccess shows envelope-sent toast', async () => {
    const { toast } = await import('sonner');
    const { onSuccess } = getOptions(() => useSendInvites());
    const req = { signers: [], expiryDays: 30, message: '' };
    await onSuccess(undefined, { envelopeId: 'env-3', request: req }, undefined);
    expect(toast.success).toHaveBeenCalledWith('Envelope sent to signers');
  });

  it('onError calls toastError with envelope-scoped id', async () => {
    const { toastError } = await import('../../utils/toastWithRetry');
    const { onError } = getOptions(() => useSendInvites());
    const error = new Error('Send failed');
    const req = { signers: [], expiryDays: 30, message: '' };
    await onError(error, { envelopeId: 'env-3', request: req }, undefined);
    expect(toastError).toHaveBeenCalledWith(
      'Failed to send invitations',
      error,
      expect.objectContaining({ id: 'esign-send-env-3' }),
    );
  });
});

describe('useVoidEnvelope', () => {
  it('returns a mutation object with mutate and isPending', () => {
    const { result } = renderHook(() => useVoidEnvelope());
    expect(typeof result.current.mutate).toBe('function');
    expect(result.current.isPending).toBe(false);
  });

  it('mutationFn calls esignApi.voidEnvelope with the envelopeId', async () => {
    mockEsignApi.voidEnvelope.mockResolvedValue({});
    const { mutationFn } = getOptions(() => useVoidEnvelope());
    await mutationFn('env-4');
    expect(mockEsignApi.voidEnvelope).toHaveBeenCalledWith('env-4');
  });

  it('onSuccess invalidates envelopes and specific envelope', async () => {
    const { onSuccess } = getOptions(() => useVoidEnvelope());
    await onSuccess(undefined, 'env-4', undefined);
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['esign', 'envelopes'] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['esign', 'envelope', 'env-4'],
    });
  });

  it('onSuccess shows voided toast', async () => {
    const { toast } = await import('sonner');
    const { onSuccess } = getOptions(() => useVoidEnvelope());
    await onSuccess(undefined, 'env-4', undefined);
    expect(toast.success).toHaveBeenCalledWith('Envelope voided successfully');
  });

  it('onError calls toastError with envelope-scoped id', async () => {
    const { toastError } = await import('../../utils/toastWithRetry');
    const { onError } = getOptions(() => useVoidEnvelope());
    const error = new Error('Void failed');
    await onError(error, 'env-4', undefined);
    expect(toastError).toHaveBeenCalledWith(
      'Failed to void envelope',
      error,
      expect.objectContaining({ id: 'esign-void-env-4' }),
    );
  });
});

describe('useSaveAsTemplate', () => {
  it('returns a mutation object with mutate and isPending', () => {
    const { result } = renderHook(() => useSaveAsTemplate());
    expect(typeof result.current.mutate).toBe('function');
    expect(result.current.isPending).toBe(false);
  });

  it('mutationFn calls esignApi.saveAsTemplate with envelopeId and request', async () => {
    mockEsignApi.saveAsTemplate.mockResolvedValue({ id: 'tpl-1' });
    const { mutationFn } = getOptions(() => useSaveAsTemplate());
    const req = { name: 'Agreement Template', description: 'Standard agreement' };
    await mutationFn({ envelopeId: 'env-5', request: req });
    expect(mockEsignApi.saveAsTemplate).toHaveBeenCalledWith('env-5', req);
  });

  it('onSuccess shows template-saved toast', async () => {
    const { toast } = await import('sonner');
    const { onSuccess } = getOptions(() => useSaveAsTemplate());
    await onSuccess(undefined, undefined, undefined);
    expect(toast.success).toHaveBeenCalledWith('Template saved successfully');
  });

  it('onError shows error toast with message', async () => {
    const { toast } = await import('sonner');
    const { onError } = getOptions(() => useSaveAsTemplate());
    const error = new Error('Template save failed');
    await onError(error, undefined, undefined);
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Template save failed'));
  });
});

describe('useSendOTP', () => {
  it('returns a mutation object with mutate and isPending', () => {
    const { result } = renderHook(() => useSendOTP());
    expect(typeof result.current.mutate).toBe('function');
    expect(result.current.isPending).toBe(false);
  });

  it('mutationFn calls esignApi.sendOTP with envelopeId and signerId', async () => {
    mockEsignApi.sendOTP.mockResolvedValue({});
    const { mutationFn } = getOptions(() => useSendOTP());
    await mutationFn({ envelopeId: 'env-6', signerId: 'signer-1' });
    expect(mockEsignApi.sendOTP).toHaveBeenCalledWith('env-6', 'signer-1');
  });

  it('onSuccess shows OTP-sent toast', async () => {
    const { toast } = await import('sonner');
    const { onSuccess } = getOptions(() => useSendOTP());
    await onSuccess(undefined, undefined, undefined);
    expect(toast.success).toHaveBeenCalledWith('OTP sent successfully');
  });

  it('onError shows error toast with message', async () => {
    const { toast } = await import('sonner');
    const { onError } = getOptions(() => useSendOTP());
    const error = new Error('OTP send failed');
    await onError(error, undefined, undefined);
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('OTP send failed'));
  });
});

describe('useSubmitSignature', () => {
  it('returns a mutation object with mutate and isPending', () => {
    const { result } = renderHook(() => useSubmitSignature());
    expect(typeof result.current.mutate).toBe('function');
    expect(result.current.isPending).toBe(false);
  });

  it('mutationFn calls esignApi.submitSignature with envelopeId and request', async () => {
    mockEsignApi.submitSignature.mockResolvedValue({});
    const { mutationFn } = getOptions(() => useSubmitSignature());
    const req = {
      signerId: 'signer-1',
      signatureDataUrl: 'data:image/png;base64,abc',
      consentAccepted: true,
    };
    await mutationFn({ envelopeId: 'env-7', request: req });
    expect(mockEsignApi.submitSignature).toHaveBeenCalledWith('env-7', req);
  });

  it('onSuccess invalidates envelopes and specific envelope', async () => {
    const { onSuccess } = getOptions(() => useSubmitSignature());
    const req = { signerId: 'signer-1', signatureDataUrl: '', consentAccepted: true };
    await onSuccess(undefined, { envelopeId: 'env-7', request: req }, undefined);
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['esign', 'envelopes'] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['esign', 'envelope', 'env-7'],
    });
  });

  it('onSuccess shows signature-submitted toast', async () => {
    const { toast } = await import('sonner');
    const { onSuccess } = getOptions(() => useSubmitSignature());
    const req = { signerId: 'signer-1', signatureDataUrl: '', consentAccepted: true };
    await onSuccess(undefined, { envelopeId: 'env-7', request: req }, undefined);
    expect(toast.success).toHaveBeenCalledWith('Signature submitted successfully');
  });

  it('onError shows error toast with message', async () => {
    const { toast } = await import('sonner');
    const { onError } = getOptions(() => useSubmitSignature());
    const error = new Error('Submission failed');
    await onError(error, undefined, undefined);
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Submission failed'));
  });
});

describe('useRejectSigning', () => {
  it('returns a mutation object with mutate and isPending', () => {
    const { result } = renderHook(() => useRejectSigning());
    expect(typeof result.current.mutate).toBe('function');
    expect(result.current.isPending).toBe(false);
  });

  it('mutationFn calls esignApi.rejectSigning with envelopeId and request', async () => {
    mockEsignApi.rejectSigning.mockResolvedValue({});
    const { mutationFn } = getOptions(() => useRejectSigning());
    const req = { signerId: 'signer-1', reason: 'Terms not acceptable' };
    await mutationFn({ envelopeId: 'env-8', request: req });
    expect(mockEsignApi.rejectSigning).toHaveBeenCalledWith('env-8', req);
  });

  it('onSuccess invalidates envelopes and specific envelope', async () => {
    const { onSuccess } = getOptions(() => useRejectSigning());
    const req = { signerId: 'signer-1', reason: 'Terms not acceptable' };
    await onSuccess(undefined, { envelopeId: 'env-8', request: req }, undefined);
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['esign', 'envelopes'] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['esign', 'envelope', 'env-8'],
    });
  });

  it('onSuccess shows toast.info for rejection', async () => {
    const { toast } = await import('sonner');
    const { onSuccess } = getOptions(() => useRejectSigning());
    const req = { signerId: 'signer-1', reason: 'Terms not acceptable' };
    await onSuccess(undefined, { envelopeId: 'env-8', request: req }, undefined);
    expect(toast.info).toHaveBeenCalledWith('Signing rejected');
  });

  it('onError shows error toast with message', async () => {
    const { toast } = await import('sonner');
    const { onError } = getOptions(() => useRejectSigning());
    const error = new Error('Rejection failed');
    await onError(error, undefined, undefined);
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Rejection failed'));
  });
});
