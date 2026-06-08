import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  usePermissions,
  useAllPermissions,
  usePermissionAudit,
  useUpdatePermissions,
  useCurrentUserPermissions,
} from '../usePermissions';

// ============================================================================
// MOCKS
// ============================================================================

const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();
const mockInvalidateQueries = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockFetchPermissions = vi.fn();
const mockFetchAllPermissions = vi.fn();
const mockFetchPermissionAudit = vi.fn();
const mockUpdatePermissions = vi.fn();
const mockFetchMyPermissions = vi.fn();

vi.mock('../../api', () => ({
  personnelApi: {
    fetchPermissions: (...args: unknown[]) => mockFetchPermissions(...args),
    fetchAllPermissions: (...args: unknown[]) => mockFetchAllPermissions(...args),
    fetchPermissionAudit: (...args: unknown[]) => mockFetchPermissionAudit(...args),
    updatePermissions: (...args: unknown[]) => mockUpdatePermissions(...args),
    fetchMyPermissions: (...args: unknown[]) => mockFetchMyPermissions(...args),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  // Default: useQuery returns empty object; useUseMutation returns empty object
  mockUseQuery.mockReturnValue({});
  mockUseMutation.mockReturnValue({});
});

// ============================================================================
// usePermissions
// ============================================================================

describe('usePermissions', () => {
  it('passes correct queryKey and enabled flag when both id and enabled=true', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => usePermissions('p-1'));

    expect(captured.queryKey).toEqual(['personnel', 'permissions', 'p-1']);
    expect(captured.enabled).toBe(true);
    expect(captured.retry).toBe(false);
  });

  it('sets enabled=false when personnelId is empty string', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => usePermissions(''));

    expect(captured.enabled).toBe(false);
  });

  it('sets enabled=false when enabled param is false', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => usePermissions('p-1', false));

    expect(captured.enabled).toBe(false);
  });

  it('queryFn calls personnelApi.fetchPermissions with the personnelId', async () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => usePermissions('p-1'));

    mockFetchPermissions.mockResolvedValue({ modules: {} });
    await (captured.queryFn as () => Promise<unknown>)();

    expect(mockFetchPermissions).toHaveBeenCalledWith('p-1');
  });
});

// ============================================================================
// useAllPermissions
// ============================================================================

describe('useAllPermissions', () => {
  it('passes correct queryKey including "all" suffix', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useAllPermissions());

    expect(captured.queryKey).toEqual(['personnel', 'permissions', 'all']);
    expect(captured.enabled).toBe(true);
  });

  it('sets enabled=false when enabled=false is passed', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useAllPermissions(false));

    expect(captured.enabled).toBe(false);
  });

  it('queryFn calls personnelApi.fetchAllPermissions', async () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useAllPermissions());

    mockFetchAllPermissions.mockResolvedValue([]);
    await (captured.queryFn as () => Promise<unknown>)();

    expect(mockFetchAllPermissions).toHaveBeenCalled();
  });
});

// ============================================================================
// usePermissionAudit
// ============================================================================

describe('usePermissionAudit', () => {
  it('passes correct queryKey with "audit" and personnelId', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => usePermissionAudit('p-2'));

    expect(captured.queryKey).toEqual(['personnel', 'permissions', 'audit', 'p-2']);
    expect(captured.enabled).toBe(true);
  });

  it('sets enabled=false when personnelId is empty', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => usePermissionAudit(''));

    expect(captured.enabled).toBe(false);
  });

  it('queryFn calls personnelApi.fetchPermissionAudit with personnelId', async () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => usePermissionAudit('p-2'));

    mockFetchPermissionAudit.mockResolvedValue([]);
    await (captured.queryFn as () => Promise<unknown>)();

    expect(mockFetchPermissionAudit).toHaveBeenCalledWith('p-2');
  });
});

// ============================================================================
// useUpdatePermissions
// ============================================================================

describe('useUpdatePermissions', () => {
  it('mutationFn calls personnelApi.updatePermissions with the input', async () => {
    let captured: Record<string, unknown> = {};
    mockUseMutation.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useUpdatePermissions());

    const input = { personnelId: 'p-3', modules: {} };
    mockUpdatePermissions.mockResolvedValue({});
    await (captured.mutationFn as (input: unknown) => Promise<unknown>)(input);

    expect(mockUpdatePermissions).toHaveBeenCalledWith(input);
  });

  it('onSuccess invalidates detail, me, all, and audit queries', () => {
    let captured: Record<string, unknown> = {};
    mockUseMutation.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useUpdatePermissions());

    const variables = { personnelId: 'p-3', modules: {} };
    (captured.onSuccess as (data: unknown, vars: unknown) => void)(undefined, variables);

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['personnel', 'permissions', 'p-3'],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['personnel', 'permissions', 'me'],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['personnel', 'permissions', 'all'],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['personnel', 'permissions', 'audit', 'p-3'],
    });
  });

  it('onSuccess fires toast.success', async () => {
    const { toast } = await import('sonner');
    let captured: Record<string, unknown> = {};
    mockUseMutation.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useUpdatePermissions());

    (captured.onSuccess as (data: unknown, vars: unknown) => void)(undefined, {
      personnelId: 'p-3',
      modules: {},
    });

    expect(toast.success).toHaveBeenCalledWith('Module permissions updated successfully');
  });

  it('onError fires toast.error with error message', async () => {
    const { toast } = await import('sonner');
    let captured: Record<string, unknown> = {};
    mockUseMutation.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useUpdatePermissions());

    (captured.onError as (error: Error) => void)(new Error('update failed'));

    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('update failed'));
  });
});

// ============================================================================
// useCurrentUserPermissions
// ============================================================================

describe('useCurrentUserPermissions', () => {
  it('returns isSuperAdmin=true when data.isSuperAdmin is true', () => {
    mockUseQuery.mockReturnValue({ data: { isSuperAdmin: true, modules: {} }, isLoading: false });

    const { result } = renderHook(() => useCurrentUserPermissions());

    expect(result.current.isSuperAdmin).toBe(true);
  });

  it('can() returns true for always-accessible modules (dashboard, notes)', () => {
    mockUseQuery.mockReturnValue({ data: { isSuperAdmin: false, modules: {} }, isLoading: false });

    const { result } = renderHook(() => useCurrentUserPermissions());

    expect(result.current.can('dashboard')).toBe(true);
    expect(result.current.can('notes')).toBe(true);
  });

  it('can() returns true for any module when isSuperAdmin=true', () => {
    mockUseQuery.mockReturnValue({ data: { isSuperAdmin: true, modules: {} }, isLoading: false });

    const { result } = renderHook(() => useCurrentUserPermissions());

    expect(result.current.can('personnel')).toBe(true);
    expect(result.current.can('clients')).toBe(true);
  });

  it('can() returns true while loading (optimistic)', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });

    const { result } = renderHook(() => useCurrentUserPermissions());

    expect(result.current.can('clients')).toBe(true);
  });

  it('can() returns false when module not in stored permissions and not loading', () => {
    mockUseQuery.mockReturnValue({
      data: { isSuperAdmin: false, modules: { clients: { access: false } } },
      isLoading: false,
    });

    const { result } = renderHook(() => useCurrentUserPermissions());

    expect(result.current.can('clients')).toBe(false);
  });

  it('can() returns true when module has access:true in stored permissions', () => {
    mockUseQuery.mockReturnValue({
      data: { isSuperAdmin: false, modules: { clients: { access: true } } },
      isLoading: false,
    });

    const { result } = renderHook(() => useCurrentUserPermissions());

    expect(result.current.can('clients')).toBe(true);
  });

  it('canDo() returns true for super admin regardless of capability', () => {
    mockUseQuery.mockReturnValue({ data: { isSuperAdmin: true, modules: {} }, isLoading: false });

    const { result } = renderHook(() => useCurrentUserPermissions());

    expect(result.current.canDo('clients', 'delete')).toBe(true);
    expect(result.current.canDo('personnel', 'manage_permissions')).toBe(true);
  });

  it('canDo() returns true for "view" when module is accessible', () => {
    mockUseQuery.mockReturnValue({
      data: { isSuperAdmin: false, modules: { clients: { access: true, capabilities: ['view'] } } },
      isLoading: false,
    });

    const { result } = renderHook(() => useCurrentUserPermissions());

    expect(result.current.canDo('clients', 'view')).toBe(true);
  });

  it('canDo() returns true when no capabilities stored (backwards compat)', () => {
    mockUseQuery.mockReturnValue({
      data: { isSuperAdmin: false, modules: { clients: { access: true, capabilities: [] } } },
      isLoading: false,
    });

    const { result } = renderHook(() => useCurrentUserPermissions());

    expect(result.current.canDo('clients', 'create')).toBe(true);
  });

  it('canDo() returns false when capability not in stored capabilities', () => {
    mockUseQuery.mockReturnValue({
      data: {
        isSuperAdmin: false,
        modules: { clients: { access: true, capabilities: ['create'] } },
      },
      isLoading: false,
    });

    const { result } = renderHook(() => useCurrentUserPermissions());

    expect(result.current.canDo('clients', 'delete')).toBe(false);
  });

  it('accessibleModules always includes dashboard and notes', () => {
    mockUseQuery.mockReturnValue({
      data: { isSuperAdmin: false, modules: {} },
      isLoading: false,
    });

    const { result } = renderHook(() => useCurrentUserPermissions());

    expect(result.current.accessibleModules).toContain('dashboard');
    expect(result.current.accessibleModules).toContain('notes');
  });

  it('accessibleModules includes all modules for super admin', () => {
    mockUseQuery.mockReturnValue({ data: { isSuperAdmin: true, modules: {} }, isLoading: false });

    const { result } = renderHook(() => useCurrentUserPermissions());

    expect(result.current.accessibleModules.length).toBeGreaterThan(5);
    expect(result.current.accessibleModules).toContain('ai-management');
  });

  it('isLoading reflects the query loading state', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });

    const { result } = renderHook(() => useCurrentUserPermissions());

    expect(result.current.isLoading).toBe(true);
  });

  it('permissions reflects the raw data from the query', () => {
    const mockData = { isSuperAdmin: false, modules: { clients: { access: true } } };
    mockUseQuery.mockReturnValue({ data: mockData, isLoading: false });

    const { result } = renderHook(() => useCurrentUserPermissions());

    expect(result.current.permissions).toBe(mockData);
  });
});
