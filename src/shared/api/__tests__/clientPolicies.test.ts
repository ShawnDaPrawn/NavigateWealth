import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.fn();
vi.mock('@/utils/api', () => ({
  api: { get: (...args: unknown[]) => mockGet(...args) },
}));

import {
  clientPoliciesQueryOptions,
  fetchClientPolicies,
  fetchPolicySchemas,
  filterPoliciesForCategory,
  invalidateAllClientPolicies,
  invalidateClientPolicies,
  policySchemasQueryOptions,
  POLICIES_FRESH_MS,
} from '../clientPolicies';
import { clientPolicyKeys } from '@/utils/queryKeys';

beforeEach(() => {
  mockGet.mockReset();
});

describe('filterPoliciesForCategory mirrors GET /integrations/policies?categoryId=', () => {
  const policies = [
    { id: 'r', categoryId: 'risk_planning' },
    { id: 'rp', categoryId: 'retirement_planning' },
    { id: 'pre', categoryId: 'retirement_pre' },
    { id: 'post', categoryId: 'retirement_post' },
    { id: 'fixed', categoryId: 'retirement_post_fixed' },
    { id: 'inv', categoryId: 'investments' },
    { id: 'vol', categoryId: 'investments_voluntary' },
    { id: 'gua', categoryId: 'investments_guaranteed' },
    { id: 'eb', categoryId: 'employee_benefits' },
    { id: 'eb-risk', categoryId: 'employee_benefits_risk' },
    { id: 'none' },
  ];
  const ids = (categoryId: string) =>
    filterPoliciesForCategory(policies, categoryId).map((policy) => policy.id);

  it('folds the retirement sub-categories into retirement_planning', () => {
    expect(ids('retirement_planning')).toEqual(['rp', 'pre', 'post', 'fixed']);
  });

  it('folds the investment sub-categories into investments', () => {
    expect(ids('investments')).toEqual(['inv', 'vol', 'gua']);
  });

  it('does NOT widen employee_benefits, exactly as the server does not', () => {
    expect(ids('employee_benefits')).toEqual(['eb']);
  });

  it('matches every other category exactly, and never a policy with no category', () => {
    expect(ids('risk_planning')).toEqual(['r']);
    expect(ids('retirement_pre')).toEqual(['pre']);
  });

  it('treats an empty category as no filter, as the server does', () => {
    expect(ids('')).toHaveLength(policies.length);
  });
});

describe('fetchClientPolicies', () => {
  it('asks for the active policies by default', async () => {
    mockGet.mockResolvedValue({ policies: [{ id: 'p1' }] });
    await expect(fetchClientPolicies('client 1')).resolves.toEqual([{ id: 'p1' }]);
    expect(mockGet).toHaveBeenCalledWith('/integrations/policies?clientId=client%201');
  });

  it('asks for the archived policies when told to', async () => {
    mockGet.mockResolvedValue({});
    await expect(fetchClientPolicies('c1', true)).resolves.toEqual([]);
    expect(mockGet).toHaveBeenCalledWith('/integrations/policies?clientId=c1&includeArchived=true');
  });

  it('is refetched whenever a screen opens, bar a few seconds to cover one screen', () => {
    // Long enough that the Overview's embedded Policies view, mounting the
    // moment the Overview's own fetch lands, does not fetch again; short
    // enough that every separate open refetches.
    expect(clientPoliciesQueryOptions('c1').staleTime).toBe(POLICIES_FRESH_MS);
    expect(POLICIES_FRESH_MS).toBeLessThanOrEqual(5_000);
    expect(clientPoliciesQueryOptions('c1').queryKey).toEqual(clientPolicyKeys.list('c1', false));
    expect(clientPoliciesQueryOptions('c1', { archived: true }).queryKey).toEqual(
      clientPolicyKeys.list('c1', true),
    );
  });
});

describe('fetchPolicySchemas', () => {
  it('keeps categories with fields and drops empty ones', async () => {
    mockGet.mockResolvedValue({
      schemas: {
        risk_planning: { fields: [{ id: 'f1' }] },
        tax_planning: { fields: [] },
        broken: {},
      },
    });
    await expect(fetchPolicySchemas()).resolves.toEqual({ risk_planning: [{ id: 'f1' }] });
    expect(mockGet).toHaveBeenCalledWith('/integrations/schemas/batch');
  });

  it('is cached as configuration', () => {
    expect(policySchemasQueryOptions().staleTime).toBe(10 * 60 * 1000);
  });
});

describe('invalidation', () => {
  function seeded() {
    const queryClient = new QueryClient();
    queryClient.setQueryData(clientPolicyKeys.list('c1', false), []);
    queryClient.setQueryData(clientPolicyKeys.list('c1', true), []);
    queryClient.setQueryData(clientPolicyKeys.list('c2', false), []);
    const invalidated = (clientId: string, archived: boolean) =>
      queryClient.getQueryState(clientPolicyKeys.list(clientId, archived))?.isInvalidated;
    return { queryClient, invalidated };
  }

  it("a write invalidates that client's active and archived lists, and no one else's", async () => {
    const { queryClient, invalidated } = seeded();
    await invalidateClientPolicies(queryClient, 'c1');
    expect(invalidated('c1', false)).toBe(true);
    expect(invalidated('c1', true)).toBe(true);
    expect(invalidated('c2', false)).toBe(false);
  });

  it('a bulk write invalidates every client', async () => {
    const { queryClient, invalidated } = seeded();
    await invalidateAllClientPolicies(queryClient);
    expect(invalidated('c1', false)).toBe(true);
    expect(invalidated('c2', false)).toBe(true);
  });
});
