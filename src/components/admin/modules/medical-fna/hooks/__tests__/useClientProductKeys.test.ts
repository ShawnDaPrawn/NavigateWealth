import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useClientProductKeys } from '../useClientProductKeys';

// ============================================================================
// MOCKS
// ============================================================================

const mockUseQuery = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useQueryClient: () => ({}),
}));

// Mock useClientKeys which is imported from client-management
const mockUseClientKeys = vi.fn();

vi.mock('../../../client-keys', () => ({
  useClientKeys: (...args: unknown[]) => mockUseClientKeys(...args),
}));

const mockApiGet = vi.fn();

vi.mock('../../../../../../utils/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockUseQuery.mockReturnValue({ data: undefined, isLoading: false });
  mockUseClientKeys.mockReturnValue({ data: undefined, isLoading: false });
});

// ============================================================================
// Policies query
// ============================================================================

describe('useClientProductKeys — policies query', () => {
  it('passes correct queryKey for policies', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return { data: undefined, isLoading: false };
    });

    renderHook(() => useClientProductKeys('client-123'));

    expect(captured.queryKey).toEqual(['medical-aid-policies', 'client-123']);
  });

  it('sets enabled=true when clientId is provided', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return { data: undefined, isLoading: false };
    });

    renderHook(() => useClientProductKeys('client-123'));

    expect(captured.enabled).toBe(true);
  });

  it('sets enabled=false when clientId is undefined', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return { data: undefined, isLoading: false };
    });

    renderHook(() => useClientProductKeys(undefined));

    expect(captured.enabled).toBe(false);
  });

  it('staleTime is 5 minutes', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return { data: undefined, isLoading: false };
    });

    renderHook(() => useClientProductKeys('client-123'));

    expect(captured.staleTime).toBe(5 * 60 * 1000);
  });

  it('queryFn calls api.get with clientId and categoryId=medical_aid', async () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return { data: undefined, isLoading: false };
    });

    renderHook(() => useClientProductKeys('client-123'));

    mockApiGet.mockResolvedValue({ policies: [] });
    await (captured.queryFn as () => Promise<unknown>)();

    expect(mockApiGet).toHaveBeenCalledWith(
      '/integrations/policies?clientId=client-123&categoryId=medical_aid',
    );
  });

  it('queryFn returns null when api.get throws', async () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return { data: undefined, isLoading: false };
    });

    renderHook(() => useClientProductKeys('client-123'));

    mockApiGet.mockRejectedValue(new Error('network error'));
    const result = await (captured.queryFn as () => Promise<unknown>)();

    expect(result).toBeNull();
  });
});

// ============================================================================
// isLoading
// ============================================================================

describe('useClientProductKeys — isLoading', () => {
  it('isLoading is true when client keys are loading', () => {
    mockUseClientKeys.mockReturnValue({ data: undefined, isLoading: true });
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false });

    const { result } = renderHook(() => useClientProductKeys('client-123'));

    expect(result.current.isLoading).toBe(true);
  });

  it('isLoading is true when policies are loading', () => {
    mockUseClientKeys.mockReturnValue({ data: undefined, isLoading: false });
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });

    const { result } = renderHook(() => useClientProductKeys('client-123'));

    expect(result.current.isLoading).toBe(true);
  });

  it('isLoading is false when both are done', () => {
    mockUseClientKeys.mockReturnValue({ data: undefined, isLoading: false });
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false });

    const { result } = renderHook(() => useClientProductKeys('client-123'));

    expect(result.current.isLoading).toBe(false);
  });
});

// ============================================================================
// Derived product data
// ============================================================================

describe('useClientProductKeys — productData derivation', () => {
  it('returns undefined fields when no data available', () => {
    mockUseClientKeys.mockReturnValue({ data: undefined, isLoading: false });
    mockUseQuery.mockReturnValue({ data: null, isLoading: false });

    const { result } = renderHook(() => useClientProductKeys('client-123'));

    expect(result.current.planType).toBeUndefined();
    expect(result.current.totalPremium).toBeUndefined();
    expect(result.current.msa).toBeUndefined();
  });

  it('extracts planType from KV store (clientKeys)', () => {
    mockUseClientKeys.mockReturnValue({
      data: {
        keys: [{ keyId: 'medical_aid_plan_type', value: 'Comprehensive', dataType: 'text' }],
      },
      isLoading: false,
    });
    mockUseQuery.mockReturnValue({ data: null, isLoading: false });

    const { result } = renderHook(() => useClientProductKeys('client-123'));

    expect(result.current.planType).toBe('Comprehensive');
  });

  it('extracts totalPremium from KV store using medical_aid_total_premium key', () => {
    mockUseClientKeys.mockReturnValue({
      data: {
        keys: [{ keyId: 'medical_aid_total_premium', value: 1500, dataType: 'currency' }],
      },
      isLoading: false,
    });
    mockUseQuery.mockReturnValue({ data: null, isLoading: false });

    const { result } = renderHook(() => useClientProductKeys('client-123'));

    expect(result.current.totalPremium).toBe(1500);
  });

  it('calculates total premium from policies when KV store has no total premium', () => {
    mockUseClientKeys.mockReturnValue({ data: { keys: [] }, isLoading: false });
    mockUseQuery.mockReturnValue({
      data: {
        policies: [{ data: { ma_6: 800 } }, { data: { ma_6: 700 } }],
      },
      isLoading: false,
    });

    const { result } = renderHook(() => useClientProductKeys('client-123'));

    expect(result.current.totalPremium).toBe(1500);
  });

  it('extracts planType from policy data when not in KV store', () => {
    mockUseClientKeys.mockReturnValue({ data: { keys: [] }, isLoading: false });
    mockUseQuery.mockReturnValue({
      data: {
        policies: [{ data: { ma_2: 'Hospital Plan' } }],
      },
      isLoading: false,
    });

    const { result } = renderHook(() => useClientProductKeys('client-123'));

    expect(result.current.planType).toBe('Hospital Plan');
  });

  it('parses numeric MSA from string value (strips R and commas)', () => {
    mockUseClientKeys.mockReturnValue({
      data: {
        keys: [{ keyId: 'medical_aid_msa', value: 'R 2,500', dataType: 'currency' }],
      },
      isLoading: false,
    });
    mockUseQuery.mockReturnValue({ data: null, isLoading: false });

    const { result } = renderHook(() => useClientProductKeys('client-123'));

    expect(result.current.msa).toBe(2500);
  });

  it('returns undefined for dependentsCount when not available', () => {
    mockUseClientKeys.mockReturnValue({ data: { keys: [] }, isLoading: false });
    mockUseQuery.mockReturnValue({ data: { policies: [{ data: {} }] }, isLoading: false });

    const { result } = renderHook(() => useClientProductKeys('client-123'));

    expect(result.current.dependentsCount).toBeUndefined();
  });
});
