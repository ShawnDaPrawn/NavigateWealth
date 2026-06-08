import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  useInvitePersonnel,
  useCreatePersonnelAccount,
  useUpdatePersonnel,
  useDeletePersonnel,
  useAddPersonnelDocument,
  useResendPersonnelInvite,
  useCancelPersonnelInvite,
  useUpdateSuperAdmin,
  useBackfillAuthRoles,
} from '../usePersonnelMutations';

// ============================================================================
// MOCKS
// ============================================================================

const mockInvalidateQueries = vi.fn();
const mockRemoveQueries = vi.fn();
const mockQueryClient = {
  invalidateQueries: mockInvalidateQueries,
  removeQueries: mockRemoveQueries,
};

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => mockQueryClient,
  useMutation: (options: {
    mutationFn: (...args: unknown[]) => unknown;
    onSuccess?: (...args: unknown[]) => void;
    onError?: (...args: unknown[]) => void;
  }) => ({
    mutate: (...args: unknown[]) => options.mutationFn(...args),
    mutateAsync: (...args: unknown[]) => options.mutationFn(...args),
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
    data: undefined,
    _options: options,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const mockInvite = vi.fn();
const mockCreateAccount = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockAddDocument = vi.fn();
const mockResendInvite = vi.fn();
const mockCancelInvite = vi.fn();
const mockUpdateSuperAdmin = vi.fn();
const mockUpdatePermissions = vi.fn();
const mockBackfillAuthRoles = vi.fn();

vi.mock('../../api', () => ({
  personnelApi: {
    invite: (...args: unknown[]) => mockInvite(...args),
    createAccount: (...args: unknown[]) => mockCreateAccount(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    addDocument: (...args: unknown[]) => mockAddDocument(...args),
    resendInvite: (...args: unknown[]) => mockResendInvite(...args),
    cancelInvite: (...args: unknown[]) => mockCancelInvite(...args),
    updateSuperAdmin: (...args: unknown[]) => mockUpdateSuperAdmin(...args),
    updatePermissions: (...args: unknown[]) => mockUpdatePermissions(...args),
    backfillAuthRoles: (...args: unknown[]) => mockBackfillAuthRoles(...args),
  },
}));

vi.mock('../usePersonnel', () => ({
  personnelKeys: {
    all: ['personnel'],
    lists: () => ['personnel', 'list'],
    list: (filters?: unknown) => ['personnel', 'list', filters],
    details: () => ['personnel', 'detail'],
    detail: (id: string) => ['personnel', 'detail', id],
    clients: (personnelId: string) => ['personnel', 'detail', personnelId, 'clients'],
    superAdmin: () => ['personnel', 'super-admin'],
  },
}));

// ============================================================================
// HELPERS
// ============================================================================

/** Extract the useMutation options from a rendered hook result. */
function getMutationOptions(result: { _options: unknown }) {
  return result._options as {
    mutationFn: (...args: unknown[]) => unknown;
    onSuccess?: (...args: unknown[]) => void;
    onError?: (...args: unknown[]) => void;
  };
}

// ============================================================================
// TESTS
// ============================================================================

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useInvitePersonnel', () => {
  it('returns a mutation object with expected shape', () => {
    const { result } = renderHook(() => useInvitePersonnel());
    expect(typeof result.current.mutate).toBe('function');
    expect(result.current.isPending).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  it('mutationFn calls personnelApi.invite with the invite input (without initialModuleAccess)', async () => {
    mockInvite.mockResolvedValue({ id: 'p-1' });
    const { result } = renderHook(() => useInvitePersonnel());
    const opts = getMutationOptions(result.current);
    const input = { email: 'adviser@example.com', role: 'adviser' as const };
    await opts.mutationFn(input);
    expect(mockInvite).toHaveBeenCalledWith({ email: 'adviser@example.com', role: 'adviser' });
  });

  it('mutationFn strips initialModuleAccess before calling invite', async () => {
    mockInvite.mockResolvedValue({ id: 'p-2' });
    const { result } = renderHook(() => useInvitePersonnel());
    const opts = getMutationOptions(result.current);
    await opts.mutationFn({
      email: 'adviser@example.com',
      role: 'adviser' as const,
      initialModuleAccess: ['esign' as never],
    });
    expect(mockInvite).not.toHaveBeenCalledWith(
      expect.objectContaining({ initialModuleAccess: expect.anything() }),
    );
  });

  it('mutationFn calls updatePermissions when initialModuleAccess and result.id are present', async () => {
    mockInvite.mockResolvedValue({ id: 'p-3' });
    mockUpdatePermissions.mockResolvedValue({});
    const { result } = renderHook(() => useInvitePersonnel());
    const opts = getMutationOptions(result.current);
    await opts.mutationFn({
      email: 'adviser@example.com',
      role: 'adviser' as const,
      initialModuleAccess: ['esign' as never],
    });
    expect(mockUpdatePermissions).toHaveBeenCalledWith(
      expect.objectContaining({ personnelId: 'p-3' }),
    );
  });

  it('onSuccess fires toast.success and invalidates lists', async () => {
    const { toast } = await import('sonner');
    const { result } = renderHook(() => useInvitePersonnel());
    const opts = getMutationOptions(result.current);
    opts.onSuccess?.(undefined, undefined, undefined);
    expect(toast.success).toHaveBeenCalledWith('Personnel invited successfully');
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['personnel', 'list'],
    });
  });

  it('onError fires toast.error with the error message', async () => {
    const { toast } = await import('sonner');
    const { result } = renderHook(() => useInvitePersonnel());
    const opts = getMutationOptions(result.current);
    opts.onError?.(new Error('invite failed'), undefined, undefined);
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('invite failed'));
  });
});

describe('useCreatePersonnelAccount', () => {
  it('returns a mutation object with expected shape', () => {
    const { result } = renderHook(() => useCreatePersonnelAccount());
    expect(typeof result.current.mutate).toBe('function');
    expect(result.current.isPending).toBe(false);
  });

  it('mutationFn calls personnelApi.createAccount and returns profile + recoveryLink', async () => {
    const profile = { id: 'p-10', email: 'new@example.com' };
    mockCreateAccount.mockResolvedValue({ profile, recoveryLink: 'https://example.com/reset' });
    const { result } = renderHook(() => useCreatePersonnelAccount());
    const opts = getMutationOptions(result.current);
    const returned = await opts.mutationFn({ email: 'new@example.com', role: 'adviser' as const });
    expect(mockCreateAccount).toHaveBeenCalledWith({ email: 'new@example.com', role: 'adviser' });
    expect(returned).toEqual({ profile, recoveryLink: 'https://example.com/reset' });
  });

  it('mutationFn calls updatePermissions when initialModuleAccess and profile.id present', async () => {
    mockCreateAccount.mockResolvedValue({
      profile: { id: 'p-11' },
      recoveryLink: null,
    });
    mockUpdatePermissions.mockResolvedValue({});
    const { result } = renderHook(() => useCreatePersonnelAccount());
    const opts = getMutationOptions(result.current);
    await opts.mutationFn({
      email: 'x@example.com',
      role: 'adviser' as const,
      initialModuleAccess: ['personnel' as never],
    });
    expect(mockUpdatePermissions).toHaveBeenCalledWith(
      expect.objectContaining({ personnelId: 'p-11' }),
    );
  });

  it('onSuccess fires toast.success and invalidates lists', async () => {
    const { toast } = await import('sonner');
    const { result } = renderHook(() => useCreatePersonnelAccount());
    const opts = getMutationOptions(result.current);
    opts.onSuccess?.(undefined, undefined, undefined);
    expect(toast.success).toHaveBeenCalledWith('Personnel account created successfully');
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['personnel', 'list'] });
  });

  it('onError fires toast.error with the error message', async () => {
    const { toast } = await import('sonner');
    const { result } = renderHook(() => useCreatePersonnelAccount());
    const opts = getMutationOptions(result.current);
    opts.onError?.(new Error('create failed'), undefined, undefined);
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('create failed'));
  });
});

describe('useUpdatePersonnel', () => {
  it('returns a mutation object with expected shape', () => {
    const { result } = renderHook(() => useUpdatePersonnel());
    expect(typeof result.current.mutate).toBe('function');
    expect(result.current.isPending).toBe(false);
  });

  it('mutationFn calls personnelApi.update with id and remaining fields', async () => {
    mockUpdate.mockResolvedValue({ id: 'p-20' });
    const { result } = renderHook(() => useUpdatePersonnel());
    const opts = getMutationOptions(result.current);
    await opts.mutationFn({ id: 'p-20', phone: '+27000000000', jobTitle: 'Adviser' });
    expect(mockUpdate).toHaveBeenCalledWith('p-20', { phone: '+27000000000', jobTitle: 'Adviser' });
  });

  it('onSuccess fires toast.success and invalidates lists + detail', async () => {
    const { toast } = await import('sonner');
    const { result } = renderHook(() => useUpdatePersonnel());
    const opts = getMutationOptions(result.current);
    opts.onSuccess?.(undefined, { id: 'p-20' }, undefined);
    expect(toast.success).toHaveBeenCalledWith('Personnel updated successfully');
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['personnel', 'list'] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['personnel', 'detail', 'p-20'],
    });
  });

  it('onError fires toast.error with the error message', async () => {
    const { toast } = await import('sonner');
    const { result } = renderHook(() => useUpdatePersonnel());
    const opts = getMutationOptions(result.current);
    opts.onError?.(new Error('update failed'), undefined, undefined);
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('update failed'));
  });
});

describe('useDeletePersonnel', () => {
  it('returns a mutation object with expected shape', () => {
    const { result } = renderHook(() => useDeletePersonnel());
    expect(typeof result.current.mutate).toBe('function');
    expect(result.current.isPending).toBe(false);
  });

  it('mutationFn calls personnelApi.delete with the personnel id', async () => {
    mockDelete.mockResolvedValue(undefined);
    const { result } = renderHook(() => useDeletePersonnel());
    const opts = getMutationOptions(result.current);
    await opts.mutationFn('p-30');
    expect(mockDelete).toHaveBeenCalledWith('p-30');
  });

  it('onSuccess fires toast.success, invalidates lists, and removes the detail query', async () => {
    const { toast } = await import('sonner');
    const { result } = renderHook(() => useDeletePersonnel());
    const opts = getMutationOptions(result.current);
    opts.onSuccess?.(undefined, 'p-30', undefined);
    expect(toast.success).toHaveBeenCalledWith('Personnel deleted successfully');
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['personnel', 'list'] });
    expect(mockRemoveQueries).toHaveBeenCalledWith({
      queryKey: ['personnel', 'detail', 'p-30'],
    });
  });

  it('onError fires toast.error with the error message', async () => {
    const { toast } = await import('sonner');
    const { result } = renderHook(() => useDeletePersonnel());
    const opts = getMutationOptions(result.current);
    opts.onError?.(new Error('delete failed'), undefined, undefined);
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('delete failed'));
  });
});

describe('useAddPersonnelDocument', () => {
  it('returns a mutation object with expected shape', () => {
    const { result } = renderHook(() => useAddPersonnelDocument());
    expect(typeof result.current.mutate).toBe('function');
    expect(result.current.isPending).toBe(false);
  });

  it('mutationFn calls personnelApi.addDocument with the input', async () => {
    mockAddDocument.mockResolvedValue({ id: 'doc-1' });
    const { result } = renderHook(() => useAddPersonnelDocument());
    const opts = getMutationOptions(result.current);
    const input = {
      personnelId: 'p-40',
      name: 'RE5.pdf',
      type: 're5' as const,
      url: 'https://...',
    };
    await opts.mutationFn(input);
    expect(mockAddDocument).toHaveBeenCalledWith(input);
  });

  it('onSuccess fires toast.success and invalidates the specific personnel detail', async () => {
    const { toast } = await import('sonner');
    const { result } = renderHook(() => useAddPersonnelDocument());
    const opts = getMutationOptions(result.current);
    opts.onSuccess?.(
      undefined,
      { personnelId: 'p-40', name: 'RE5.pdf', type: 're5', url: 'https://...' },
      undefined,
    );
    expect(toast.success).toHaveBeenCalledWith('Document uploaded successfully');
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['personnel', 'detail', 'p-40'],
    });
  });

  it('onError fires toast.error with the error message', async () => {
    const { toast } = await import('sonner');
    const { result } = renderHook(() => useAddPersonnelDocument());
    const opts = getMutationOptions(result.current);
    opts.onError?.(new Error('upload failed'), undefined, undefined);
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('upload failed'));
  });
});

describe('useResendPersonnelInvite', () => {
  it('returns a mutation object with expected shape', () => {
    const { result } = renderHook(() => useResendPersonnelInvite());
    expect(typeof result.current.mutate).toBe('function');
    expect(result.current.isPending).toBe(false);
  });

  it('mutationFn calls personnelApi.resendInvite with the personnelId', async () => {
    mockResendInvite.mockResolvedValue({ email: 'adviser@example.com' });
    const { result } = renderHook(() => useResendPersonnelInvite());
    const opts = getMutationOptions(result.current);
    await opts.mutationFn('p-50');
    expect(mockResendInvite).toHaveBeenCalledWith('p-50');
  });

  it('onSuccess fires toast.success with the email address and invalidates lists', async () => {
    const { toast } = await import('sonner');
    const { result } = renderHook(() => useResendPersonnelInvite());
    const opts = getMutationOptions(result.current);
    opts.onSuccess?.({ email: 'adviser@example.com' }, undefined, undefined);
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('adviser@example.com'));
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['personnel', 'list'] });
  });

  it('onError fires toast.error with the error message', async () => {
    const { toast } = await import('sonner');
    const { result } = renderHook(() => useResendPersonnelInvite());
    const opts = getMutationOptions(result.current);
    opts.onError?.(new Error('resend failed'), undefined, undefined);
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('resend failed'));
  });
});

describe('useCancelPersonnelInvite', () => {
  it('returns a mutation object with expected shape', () => {
    const { result } = renderHook(() => useCancelPersonnelInvite());
    expect(typeof result.current.mutate).toBe('function');
    expect(result.current.isPending).toBe(false);
  });

  it('mutationFn calls personnelApi.cancelInvite with the personnelId', async () => {
    mockCancelInvite.mockResolvedValue({ email: 'pending@example.com' });
    const { result } = renderHook(() => useCancelPersonnelInvite());
    const opts = getMutationOptions(result.current);
    await opts.mutationFn('p-60');
    expect(mockCancelInvite).toHaveBeenCalledWith('p-60');
  });

  it('onSuccess fires toast.success with the email and invalidates lists', async () => {
    const { toast } = await import('sonner');
    const { result } = renderHook(() => useCancelPersonnelInvite());
    const opts = getMutationOptions(result.current);
    opts.onSuccess?.({ email: 'pending@example.com' }, undefined, undefined);
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('pending@example.com'));
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['personnel', 'list'] });
  });

  it('onError fires toast.error with the error message', async () => {
    const { toast } = await import('sonner');
    const { result } = renderHook(() => useCancelPersonnelInvite());
    const opts = getMutationOptions(result.current);
    opts.onError?.(new Error('cancel failed'), undefined, undefined);
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('cancel failed'));
  });
});

describe('useUpdateSuperAdmin', () => {
  it('returns a mutation object with expected shape', () => {
    const { result } = renderHook(() => useUpdateSuperAdmin());
    expect(typeof result.current.mutate).toBe('function');
    expect(result.current.isPending).toBe(false);
  });

  it('mutationFn calls personnelApi.updateSuperAdmin with the updates', async () => {
    mockUpdateSuperAdmin.mockResolvedValue({ id: 'sa-1' });
    const { result } = renderHook(() => useUpdateSuperAdmin());
    const opts = getMutationOptions(result.current);
    const updates = { phone: '+27000000001', company: 'Navigate Wealth' };
    await opts.mutationFn(updates);
    expect(mockUpdateSuperAdmin).toHaveBeenCalledWith(updates);
  });

  it('onSuccess fires toast.success and invalidates super admin query', async () => {
    const { toast } = await import('sonner');
    const { result } = renderHook(() => useUpdateSuperAdmin());
    const opts = getMutationOptions(result.current);
    opts.onSuccess?.(undefined, undefined, undefined);
    expect(toast.success).toHaveBeenCalledWith('Super admin profile updated successfully');
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['personnel', 'super-admin'],
    });
  });

  it('onError fires toast.error with the error message', async () => {
    const { toast } = await import('sonner');
    const { result } = renderHook(() => useUpdateSuperAdmin());
    const opts = getMutationOptions(result.current);
    opts.onError?.(new Error('super admin update failed'), undefined, undefined);
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('super admin update failed'));
  });
});

describe('useBackfillAuthRoles', () => {
  it('returns a mutation object with expected shape', () => {
    const { result } = renderHook(() => useBackfillAuthRoles());
    expect(typeof result.current.mutate).toBe('function');
    expect(result.current.isPending).toBe(false);
  });

  it('mutationFn calls personnelApi.backfillAuthRoles defaulting dryRun to true', async () => {
    mockBackfillAuthRoles.mockResolvedValue({
      dryRun: true,
      updated: 2,
      skipped: 5,
      errors: 0,
    });
    const { result } = renderHook(() => useBackfillAuthRoles());
    const opts = getMutationOptions(result.current);
    await opts.mutationFn(undefined);
    expect(mockBackfillAuthRoles).toHaveBeenCalledWith(true);
  });

  it('mutationFn passes explicit dryRun=false when provided', async () => {
    mockBackfillAuthRoles.mockResolvedValue({
      dryRun: false,
      updated: 3,
      skipped: 4,
      errors: 0,
    });
    const { result } = renderHook(() => useBackfillAuthRoles());
    const opts = getMutationOptions(result.current);
    await opts.mutationFn(false);
    expect(mockBackfillAuthRoles).toHaveBeenCalledWith(false);
  });

  it('onSuccess fires toast.info when dryRun is true', async () => {
    const { toast } = await import('sonner');
    const { result } = renderHook(() => useBackfillAuthRoles());
    const opts = getMutationOptions(result.current);
    opts.onSuccess?.({ dryRun: true, updated: 2, skipped: 5, errors: 0 }, undefined, undefined);
    expect(toast.info).toHaveBeenCalledWith(expect.stringContaining('Dry run'));
  });

  it('onSuccess fires toast.success when dryRun is false', async () => {
    const { toast } = await import('sonner');
    const { result } = renderHook(() => useBackfillAuthRoles());
    const opts = getMutationOptions(result.current);
    opts.onSuccess?.({ dryRun: false, updated: 3, skipped: 4, errors: 0 }, undefined, undefined);
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Backfill complete'));
  });

  it('onError fires toast.error with the error message', async () => {
    const { toast } = await import('sonner');
    const { result } = renderHook(() => useBackfillAuthRoles());
    const opts = getMutationOptions(result.current);
    opts.onError?.(new Error('backfill failed'), undefined, undefined);
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('backfill failed'));
  });
});
