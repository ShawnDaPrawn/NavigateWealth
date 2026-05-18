export interface PolicyAssetSourceRecord {
  id: string;
  categoryId?: string;
  category?: string;
  providerName?: string;
  archived?: boolean;
  data?: Record<string, unknown>;
}

export interface DerivedPolicyAsset {
  id: string;
  policyId: string;
  categoryId: string;
  bucket: 'retirement' | 'investment';
  assetTypeLabel: string;
  providerName: string;
  productType: string;
  policyNumber: string;
  value: number;
}

export interface ProductHoldingAssetSource {
  id: string;
  category: string;
  provider: string;
  product: string;
  policyNumber: string;
  value: number;
  status: string;
}

export interface ManualAssetDuplicateSource {
  id: string;
  type: string;
  customType?: string;
  name: string;
  description: string;
  provider: string;
  value: number;
}

const RETIREMENT_CATEGORY_IDS = new Set([
  'retirement_planning',
  'retirement_pre',
  'retirement_post',
]);

const INVESTMENT_CATEGORY_IDS = new Set([
  'investments',
  'investments_voluntary',
  'investments_guaranteed',
]);

function asPositiveNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  if (typeof value === 'string' && value.trim()) {
    const normalized = Number(value.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(normalized) && normalized > 0 ? normalized : 0;
  }

  return 0;
}

function firstPositiveValue(record: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const value = asPositiveNumber(record[key]);
    if (value > 0) return value;
  }
  return 0;
}

function firstNonEmptyString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeCompact(value: string): string {
  return normalizeText(value).replace(/\s+/g, '');
}

function valuesAreClose(left: number, right: number): boolean {
  const a = asPositiveNumber(left);
  const b = asPositiveNumber(right);
  if (a <= 0 || b <= 0) return false;

  const difference = Math.abs(a - b);
  return difference <= Math.max(1000, Math.max(a, b) * 0.05);
}

export function derivePolicyAssetsFromPolicies(
  policies: PolicyAssetSourceRecord[],
): DerivedPolicyAsset[] {
  if (!Array.isArray(policies) || policies.length === 0) return [];

  return policies
    .filter((policy) => policy && !policy.archived && policy.data && typeof policy.data === 'object')
    .map((policy) => {
      const categoryId = String(policy.categoryId || policy.category || '').trim();
      const data = policy.data as Record<string, unknown>;

      if (RETIREMENT_CATEGORY_IDS.has(categoryId)) {
        const value = firstPositiveValue(data, [
          'retirement_fund_value',
          'retirement_current_value',
          'post_retirement_capital_value',
          'ret_3',
          'ret_pre_3',
          'ret_post_3',
        ]);

        if (value <= 0) return null;

        return {
          id: `policy-asset:${policy.id}`,
          policyId: policy.id,
          categoryId,
          bucket: 'retirement',
          assetTypeLabel: 'Retirement Policy',
          providerName: policy.providerName?.trim() || 'Retirement Provider',
          productType:
            firstNonEmptyString(data, [
              'retirement_fund_type',
              'ret_2',
              'ret_pre_2',
              'ret_post_2',
            ]) || 'Retirement Product',
          policyNumber:
            firstNonEmptyString(data, ['ret_1', 'ret_pre_1', 'ret_post_1']) || 'Policy on file',
          value,
        } satisfies DerivedPolicyAsset;
      }

      if (INVESTMENT_CATEGORY_IDS.has(categoryId)) {
        const value = firstPositiveValue(data, [
          'invest_current_value',
          'inv_3',
          'inv_vol_3',
        ]);

        if (value <= 0) return null;

        return {
          id: `policy-asset:${policy.id}`,
          policyId: policy.id,
          categoryId,
          bucket: 'investment',
          assetTypeLabel: 'Investment Policy',
          providerName: policy.providerName?.trim() || 'Investment Provider',
          productType:
            firstNonEmptyString(data, [
              'invest_product_type',
              'inv_2',
              'inv_vol_2',
              'inv_gua_2',
            ]) || 'Investment Product',
          policyNumber:
            firstNonEmptyString(data, ['inv_1', 'inv_vol_1', 'inv_gua_1']) || 'Policy on file',
          value,
        } satisfies DerivedPolicyAsset;
      }

      return null;
    })
    .filter((asset): asset is DerivedPolicyAsset => asset !== null)
    .sort((left, right) => {
      if (left.bucket !== right.bucket) {
        return left.bucket.localeCompare(right.bucket);
      }
      return `${left.providerName} ${left.policyNumber}`.localeCompare(
        `${right.providerName} ${right.policyNumber}`,
      );
    });
}

export function derivePolicyAssetsFromProductHoldings(
  holdings: ProductHoldingAssetSource[],
): DerivedPolicyAsset[] {
  if (!Array.isArray(holdings) || holdings.length === 0) return [];

  return holdings
    .filter((holding) => {
      if (!holding || typeof holding !== 'object') return false;
      const status = String(holding.status || '').trim().toLowerCase();
      return status !== 'archived';
    })
    .map((holding) => {
      const category = String(holding.category || '').trim().toLowerCase();
      const value = asPositiveNumber(holding.value);

      if (value <= 0) return null;
      if (category !== 'retirement' && category !== 'investment') return null;

      return {
        id: `holding-asset:${holding.id}`,
        policyId: holding.id,
        categoryId: category,
        bucket: category,
        assetTypeLabel: category === 'retirement' ? 'Retirement Policy' : 'Investment Policy',
        providerName: holding.provider?.trim() || (category === 'retirement' ? 'Retirement Provider' : 'Investment Provider'),
        productType: holding.product?.trim() || (category === 'retirement' ? 'Retirement Product' : 'Investment Product'),
        policyNumber: holding.policyNumber?.trim() || 'Policy on file',
        value,
      } satisfies DerivedPolicyAsset;
    })
    .filter((asset): asset is DerivedPolicyAsset => asset !== null)
    .sort((left, right) => {
      if (left.bucket !== right.bucket) {
        return left.bucket.localeCompare(right.bucket);
      }
      return `${left.providerName} ${left.policyNumber}`.localeCompare(
        `${right.providerName} ${right.policyNumber}`,
      );
    });
}

export function findPossiblePolicyAssetMatches(
  manualAssets: ManualAssetDuplicateSource[],
  policyAssets: DerivedPolicyAsset[],
): Record<string, DerivedPolicyAsset[]> {
  if (!Array.isArray(manualAssets) || manualAssets.length === 0) return {};
  if (!Array.isArray(policyAssets) || policyAssets.length === 0) return {};

  const matches: Record<string, DerivedPolicyAsset[]> = {};

  for (const asset of manualAssets) {
    const manualText = normalizeText(
      [
        asset.type,
        asset.customType,
        asset.name,
        asset.description,
        asset.provider,
      ]
        .filter(Boolean)
        .join(' '),
    );
    const manualCompact = normalizeCompact(
      [asset.name, asset.description, asset.provider].filter(Boolean).join(' '),
    );

    const assetMatches = policyAssets.filter((policyAsset) => {
      if (!valuesAreClose(asset.value, policyAsset.value)) return false;

      const providerCompact = normalizeCompact(policyAsset.providerName);
      const policyCompact = normalizeCompact(policyAsset.policyNumber);
      const productCompact = normalizeCompact(policyAsset.productType);

      const providerMatch =
        manualCompact.length >= 4 &&
        providerCompact.length >= 4 &&
        (manualCompact.includes(providerCompact) || providerCompact.includes(manualCompact));
      const policyMatch =
        manualCompact.length >= 5 &&
        policyCompact.length >= 5 &&
        manualCompact.includes(policyCompact);
      const productMatch =
        manualCompact.length >= 6 &&
        productCompact.length >= 6 &&
        manualCompact.includes(productCompact);
      const bucketTypeMatch =
        (policyAsset.bucket === 'investment' && manualText.includes('investment')) ||
        (policyAsset.bucket === 'retirement' && manualText.includes('retirement'));

      return (
        (providerMatch && (policyMatch || productMatch)) ||
        (policyMatch && (providerMatch || productMatch)) ||
        (providerMatch && bucketTypeMatch && productMatch)
      );
    });

    if (assetMatches.length > 0) {
      matches[asset.id] = assetMatches;
    }
  }

  return matches;
}
