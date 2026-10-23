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
  clientGoalsQueryOptions,
  invalidateAllClientPolicies,
  invalidateClientGoals,
  invalidateClientPolicies,
  invalidatePolicySchemas,
  policySchemasQueryOptions,
  POLICIES_FRESH_MS,
} from '../clientPolicies';
import { clientGoalKeys, clientPolicyKeys, policySchemaKeys } from '@/utils/queryKeys';

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
    { id: 'eb-ret', categoryId: 'employee_benefits_retirement' },
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

  it('keeps an employee-benefits sub-tab on that sub-category alone', () => {
    // The parent tab must not show these, and these tabs must not show the parent.
    expect(ids('employee_benefits_risk')).toEqual(['eb-risk']);
    expect(ids('employee_benefits_retirement')).toEqual(['eb-ret']);
  });

  it('matches every other category exactly, and never a policy with no category', () => {
    expect(ids('risk_planning')).toEqual(['r']);
    expect(ids('retirement_pre')).toEqual(['pre']);
  });

  it('treats an empty category as no filter, as the server does', () => {
    const all = filterPoliciesForCategory(policies, '');
    expect(all).toHaveLength(policies.length);
    // A copy: a section that mutates its rows must not change the shared list.
    expect(all).not.toBe(policies);
    const size = policies.length;
    all.pop();
    expect(policies).toHaveLength(size);
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

  it('treats a missing body as no policies', async () => {
    mockGet.mockResolvedValue(null);
    await expect(fetchClientPolicies('c1')).resolves.toEqual([]);
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

  it('returns nothing when the batch is missing or a category has no field list', async () => {
    mockGet.mockResolvedValue(null);
    await expect(fetchPolicySchemas()).resolves.toEqual({});

    mockGet.mockResolvedValue({
      schemas: { risk_planning: { fields: null }, medical_aid: { fields: [{ id: 'scheme' }] } },
    });
    await expect(fetchPolicySchemas()).resolves.toEqual({ medical_aid: [{ id: 'scheme' }] });
  });
});

describe('client goals', () => {
  it('asks for that client only, and treats a missing list as empty', async () => {
    mockGet.mockResolvedValue({ goals: [{ id: 'g1' }] });
    const options = clientGoalsQueryOptions<{ id: string }>('client/1');
    await expect(options.queryFn()).resolves.toEqual([{ id: 'g1' }]);
    expect(mockGet).toHaveBeenCalledWith('/goals/client%2F1');
    expect(options.queryKey).toEqual(clientGoalKeys.client('client/1'));
    // Unlike policies, a goals screen refetches on every open.
    expect(options.staleTime).toBe(0);
  });

  it('treats a missing goals payload as an empty list', async () => {
    mockGet.mockResolvedValue(null);
    await expect(clientGoalsQueryOptions('c1').queryFn()).resolves.toEqual([]);
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

  it("a goal edit invalidates that client's goals and no one else's", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(clientGoalKeys.client('c1'), []);
    queryClient.setQueryData(clientGoalKeys.client('c2'), []);
    await invalidateClientGoals(queryClient, 'c1');
    expect(queryClient.getQueryState(clientGoalKeys.client('c1'))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(clientGoalKeys.client('c2'))?.isInvalidated).toBe(false);
  });

  it('a schema edit invalidates the shared schema batch', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(policySchemaKeys.batch(), {});
    await invalidatePolicySchemas(queryClient);
    expect(queryClient.getQueryState(policySchemaKeys.batch())?.isInvalidated).toBe(true);
  });
});
