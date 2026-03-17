import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useClientKeys } from '../../client-management/hooks/useClientKeys';
import { MEDICAL_AID_KEYS } from '../../product-management/keyManagerConstants';
import { projectId, publicAnonKey } from '../../../../../utils/supabase/info';
import { medicalFnaKeys } from './queryKeys';

export interface MedicalAidProductData {
  planType?: string;
  hospitalTariff?: string;
  totalPremium?: number;
  msa?: number;
  lateJoinerPenalty?: number;
  dependentsCount?: number;
  isLoading: boolean;
}

export function useClientProductKeys(clientId: string | undefined): MedicalAidProductData {
  const { data: clientKeys, isLoading: isKeysLoading } = useClientKeys(clientId || '');

  // Fetch policies directly to bypass KV store sync issues for text fields
  const { data: policiesData, isLoading: isPoliciesLoading } = useQuery({
    queryKey: medicalFnaKeys.policies(clientId),
    queryFn: async () => {
      if (!clientId) return null;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/integrations/policies?clientId=${clientId}&categoryId=medical_aid`,
        {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        }
      );
      if (!res.ok) return null;
      return await res.json();
    },
    enabled: !!clientId,
    staleTime: 1000 * 60 * 5, // 5 mins
  });

  const productData = useMemo(() => {
    // 1. Try to get from Client Keys (KV Store) first
    // Helper to get value by key ID
    const getValueFromKeys = (keyId: string) => {
      if (!clientKeys || !clientKeys.keys) return undefined;
      const key = clientKeys.keys.find(k => k.keyId === keyId);
      return key ? key.value : undefined;
    };

    // 2. Fallback to raw Policy Data if keys are missing
    // We assume the first policy is the primary one for FNA purposes
    const primaryPolicy = policiesData?.policies?.[0]?.data || null;

    const getValue = (keyId: string, policyFieldId?: string) => {
      // Try KV store first
      const kvValue = getValueFromKeys(keyId);
      if (kvValue !== undefined && kvValue !== null && kvValue !== 0 && kvValue !== '') {
        return kvValue;
      }

      // Fallback to policy data
      if (primaryPolicy && policyFieldId) {
        return primaryPolicy[policyFieldId];
      }

      return undefined;
    };

    const parseNumber = (val: unknown): number | undefined => {
      if (val === undefined || val === null) return undefined;
      if (typeof val === 'number') return val;
      if (typeof val === 'string') {
        // Remove 'R', spaces, commas
        const clean = val.replace(/[R,\s]/g, '');
        const num = parseFloat(clean);
        return isNaN(num) ? undefined : num;
      }
      return undefined;
    };

    // Calculate total premium from all policies if not in KV
    let calculatedTotalPremium: number | undefined = undefined;
    if (policiesData?.policies) {
      calculatedTotalPremium = policiesData.policies.reduce((sum: number, p: { data?: Record<string, unknown> }) => {
        const premium = parseNumber(p.data?.['ma_6']); // ma_6 is Premium
        return sum + (premium || 0);
      }, 0);
    }

    // Default Schema Field IDs for Medical Aid:
    // ma_2: Plan Type (medical_aid_plan_type)
    // ma_4: Dependents (medical_aid_dependents)
    // ma_6: Premium (medical_aid_monthly_premium)
    // ma_8: MSA (medical_aid_msa)
    // ma_9: LJP (medical_aid_late_joiner_penalty)
    // ma_10: Hospital Tariff (medical_aid_hospital_tariff)

    const premiumFromKeys = parseNumber(getValueFromKeys('medical_aid_total_premium'));

    return {
      planType: getValue('medical_aid_plan_type', 'ma_2') as string | undefined,
      hospitalTariff: getValue('medical_aid_hospital_tariff', 'ma_10') as string | undefined,
      totalPremium: premiumFromKeys || calculatedTotalPremium,
      msa: parseNumber(getValue('medical_aid_msa', 'ma_8')),
      lateJoinerPenalty: parseNumber(getValue('medical_aid_late_joiner_penalty', 'ma_9')),
      dependentsCount: parseNumber(getValue('medical_aid_dependents', 'ma_4')),
      isLoading: isKeysLoading || isPoliciesLoading,
    };
  }, [clientKeys, policiesData, isKeysLoading, isPoliciesLoading]);

  return productData;
}