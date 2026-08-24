/**
 * Client keys — the KV store of derived per-client values.
 *
 * A client key is a single named value calculated from that client's policies
 * (total life cover, medical aid premium, retirement contribution, and so on).
 * Three separate FNA modules read these, which is why the domain lives in its
 * own module rather than inside client-management.
 */

export interface ClientKeyValue {
  keyId: string;
  name: string;
  value: number | string | boolean | null;
  dataType: 'currency' | 'number' | 'percentage' | 'text' | 'date' | 'boolean';
  category: string;
  isCalculated: boolean;
  lastUpdated?: string;
  contributingPolicies?: ContributingPolicy[];
}

export interface ContributingPolicy {
  policyId: string;
  policyName: string;
  provider: string;
  value: number;
  fieldName: string;
}

export interface ClientKeysResponse {
  keys: ClientKeyValue[];
  lastCalculated: string;
  totalCategories: number;
}
