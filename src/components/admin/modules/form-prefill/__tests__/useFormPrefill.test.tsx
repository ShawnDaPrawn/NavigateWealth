import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@/test/utils';

const { resolveMock, auditMock, recalcMock } = vi.hoisted(() => ({
  resolveMock: vi.fn(),
  auditMock: vi.fn(),
  recalcMock: vi.fn(),
}));

vi.mock('@/services/form-prefill-api', () => ({
  resolveFormPrefill: resolveMock,
  logPrefillAudit: auditMock,
}));

vi.mock('@/components/admin/modules/client-keys', () => ({
  clientKeysApi: { recalculateClientKeys: recalcMock },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { useFormPrefill } from '../useFormPrefill';

const match = (formField: string, proposedValue: unknown) => ({
  formField,
  label: formField,
  proposedValue,
  canonicalKey: 'k',
  source: 'profile' as const,
  confidence: 'exact' as const,
  conflict: false,
});

beforeEach(() => {
  vi.clearAllMocks();
  auditMock.mockResolvedValue(undefined);
  recalcMock.mockResolvedValue({ success: true });
});

describe('useFormPrefill', () => {
  it('recalculates the client keys from policies, then opens the review', async () => {
    resolveMock.mockResolvedValue({ matches: [match('currentAge', 40)], resolverVersion: '1' });
    const { result } = renderHook(() =>
      useFormPrefill({
        clientId: 'c-1',
        formId: 'risk-fna-step1',
        currentValues: {},
        onApplyValues: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.refreshFromPolicies();
    });

    expect(recalcMock).toHaveBeenCalledWith('c-1');
    expect(recalcMock.mock.invocationCallOrder[0]).toBeLessThan(
      resolveMock.mock.invocationCallOrder[0],
    );
    expect(result.current.reviewOpen).toBe(true);
    expect(result.current.refreshing).toBe(false);
  });

  it('applies nested fields without mutating the form state it was given', async () => {
    const familyInfo = { fullName: '', age: 0 };
    const currentValues = { familyInfo };
    const onApplyValues = vi.fn();
    resolveMock.mockResolvedValue({
      matches: [match('familyInfo.age', 52)],
      resolverVersion: '1',
    });
    const { result } = renderHook(() =>
      useFormPrefill({
        clientId: 'c-1',
        formId: 'estate-fna-step1',
        currentValues,
        onApplyValues,
        autoOpenReview: false,
      }),
    );

    await act(async () => {
      await result.current.startPrefill();
    });

    expect(onApplyValues).toHaveBeenCalledWith({ familyInfo: { fullName: '', age: 52 } });
    expect(familyInfo.age).toBe(0);
  });
});
