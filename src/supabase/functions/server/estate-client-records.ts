/**
 * Estate Planning FNA — the client's records as estate inputs.
 *
 * The estate auto-populate route used to read `asset:{clientId}:*`,
 * `liability:{clientId}:*` and `policy:{clientId}:*`. Nothing in the
 * platform writes those keys (production holds none), so every estate FNA
 * opened with no assets, liabilities or life policies. The records live in
 * two places, and this module reads them from there:
 *
 *   - `user_profile:{clientId}:personal_info` → `assets` and `liabilities`,
 *     captured in the client's Assets & liabilities section;
 *   - `policies:client:{clientId}` → the policy register (Policy details):
 *     retirement funds and investments become assets, risk cover becomes
 *     life policies.
 *
 * The mapping functions are pure so they can be tested without the store.
 */

import { createKvRepository } from './repositories/kv-repository.ts';
import { clientProfileId, clientProfiles } from './repositories/client-adviser-repository.ts';

type Row = Record<string, unknown>;

export interface EstateRecordAsset {
  id: string;
  type: 'property' | 'financial' | 'business' | 'personal' | 'retirement';
  subType: string;
  description: string;
  currentValue: number;
  ownership: 'sole' | 'joint' | 'trust' | 'company';
  ownershipPercentage: number;
  location: 'south_africa' | 'offshore';
  liquidity: 'liquid' | 'semi_liquid' | 'illiquid';
  includeInEstate: boolean;
  purchasePrice?: number;
  unrealisedGain?: number;
  bondedAmount?: number;
  hasBuyAndSellAgreement?: boolean;
  buyAndSellFunded?: boolean;
  beneficiaryNominated?: boolean;
  beneficiaryDetails?: string;
}

export interface EstateRecordLiability {
  id: string;
  type:
    | 'home_loan'
    | 'vehicle_finance'
    | 'personal_loan'
    | 'credit_card'
    | 'business_debt'
    | 'tax_liability'
    | 'other';
  description: string;
  outstandingBalance: number;
  securedAgainst: string;
  lifeCoverCeded: boolean;
  creditorName: string;
}

export interface EstateRecordLifePolicy {
  id: string;
  policyType: 'life_cover' | 'group_life' | 'funeral';
  sumAssured: number;
  ownership: 'client';
  beneficiaryType: 'estate' | 'nominated';
  beneficiaries: never[];
  cededTo: string;
  payableToEstate: boolean;
  isBuyAndSellPolicy: boolean;
}

export interface EstateClientRecords {
  assets: EstateRecordAsset[];
  liabilities: EstateRecordLiability[];
  lifePolicies: EstateRecordLifePolicy[];
}

// ── helpers ────────────────────────────────────────────────────────────────

function isRow(value: unknown): value is Row {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function amount(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : 0;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }
  return 0;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function firstAmount(data: Row, keys: string[]): number {
  for (const key of keys) {
    const n = amount(data[key]);
    if (n > 0) return n;
  }
  return 0;
}

function firstText(data: Row, keys: string[]): string {
  for (const key of keys) {
    const t = text(data[key]);
    if (t) return t;
  }
  return '';
}

function liquidityOf(
  type: EstateRecordAsset['type'],
  subType: string,
): EstateRecordAsset['liquidity'] {
  if (type === 'financial') return subType === 'endowment' ? 'semi_liquid' : 'liquid';
  if (type === 'retirement') return 'semi_liquid';
  return 'illiquid';
}

// ── profile assets and liabilities ─────────────────────────────────────────

/** The Assets & liabilities "Asset type" options, as estate asset kinds. */
const PROFILE_ASSET_KIND: Record<string, [EstateRecordAsset['type'], string]> = {
  Property: ['property', 'primary_residence'],
  Vehicle: ['personal', 'vehicle'],
  Investment: ['financial', 'unit_trust'],
  Cash: ['financial', 'cash'],
  'Retirement Savings': ['retirement', 'ra'],
  'Business Interest': ['business', 'private_company_shares'],
  Collectibles: ['personal', 'art'],
  Other: ['personal', 'other'],
};

const PROFILE_OWNERSHIP: Record<string, EstateRecordAsset['ownership']> = {
  Sole: 'sole',
  Joint: 'joint',
  Trust: 'trust',
  Company: 'company',
};

export function estateAssetsFromProfile(rows: unknown): EstateRecordAsset[] {
  if (!Array.isArray(rows)) return [];
  let properties = 0;
  const assets: EstateRecordAsset[] = [];
  rows.forEach((row, index) => {
    if (!isRow(row)) return;
    const currentValue = amount(row.value);
    const name = text(row.name) || text(row.description);
    if (!name && currentValue === 0) return;

    const [type, defaultSubType] = PROFILE_ASSET_KIND[text(row.type)] ?? ['personal', 'other'];
    // The first property is taken as the home (it carries the primary
    // residence CGT exclusion); any further property as a rental.
    let subType = defaultSubType;
    if (type === 'property') subType = properties++ === 0 ? 'primary_residence' : 'rental';

    const ownership = PROFILE_OWNERSHIP[text(row.ownershipType)] ?? 'sole';
    assets.push({
      id: text(row.id) || `profile-asset-${index + 1}`,
      type,
      subType,
      description: name || `Asset ${index + 1}`,
      currentValue,
      ownership,
      ownershipPercentage: ownership === 'joint' ? 50 : 100,
      location: 'south_africa',
      liquidity: liquidityOf(type, subType),
      // Assets held in a trust or company are not the client's to bequeath.
      includeInEstate: ownership !== 'trust' && ownership !== 'company',
      purchasePrice: 0,
      unrealisedGain: 0,
      bondedAmount: 0,
      hasBuyAndSellAgreement: false,
      buyAndSellFunded: false,
      beneficiaryNominated: false,
      beneficiaryDetails: '',
    });
  });
  return assets;
}

/** The Assets & liabilities "Liability type" options, as estate liability kinds. */
const PROFILE_LIABILITY_TYPE: Record<string, EstateRecordLiability['type']> = {
  'Home Loan': 'home_loan',
  'Vehicle Finance': 'vehicle_finance',
  'Credit Card': 'credit_card',
  'Personal Loan': 'personal_loan',
  'Student Loan': 'personal_loan',
  Other: 'other',
};

export function estateLiabilitiesFromProfile(rows: unknown): EstateRecordLiability[] {
  if (!Array.isArray(rows)) return [];
  const liabilities: EstateRecordLiability[] = [];
  rows.forEach((row, index) => {
    if (!isRow(row)) return;
    const outstandingBalance = amount(row.outstandingBalance);
    const name = text(row.name) || text(row.description);
    if (!name && outstandingBalance === 0) return;
    liabilities.push({
      id: text(row.id) || `profile-liability-${index + 1}`,
      type: PROFILE_LIABILITY_TYPE[text(row.type)] ?? 'other',
      description: name || `Liability ${index + 1}`,
      outstandingBalance,
      securedAgainst: '',
      lifeCoverCeded: false,
      creditorName: text(row.provider),
    });
  });
  return liabilities;
}

// ── the policy register ────────────────────────────────────────────────────

/**
 * `policies:client:{id}` is a flat array, or on older records an object
 * holding one (`policies`, `value`) or arrays keyed by category — the same
 * unwrapping client-portal-service does.
 */
export function unwrapPolicyRegister(stored: unknown): Row[] {
  let list: unknown[] = [];
  if (Array.isArray(stored)) list = stored;
  else if (isRow(stored)) {
    if (Array.isArray(stored.policies)) list = stored.policies;
    else if (Array.isArray(stored.value)) list = stored.value;
    else {
      const values = Object.values(stored);
      if (values.length > 0 && values.every(Array.isArray)) list = values.flat();
    }
  }
  return list.filter(isRow);
}

const RETIREMENT_CATEGORIES = new Set([
  'retirement_planning',
  'retirement_pre',
  'retirement_post',
  'employee_benefits_retirement',
]);
const INVESTMENT_CATEGORIES = new Set([
  'investments',
  'investments_voluntary',
  'investments_guaranteed',
]);

function retirementSubType(productType: string): string {
  const t = productType.toLowerCase();
  if (t.includes('pension')) return 'pension';
  if (t.includes('provident')) return 'provident';
  if (t.includes('preserv')) return 'preservation';
  return 'ra';
}

/**
 * Retirement funds and investments from the policy register as assets, and
 * risk cover as life policies. A policy with no value or cover is skipped,
 * as is an archived one.
 */
export function estateRecordsFromPolicies(
  register: Row[],
): Pick<EstateClientRecords, 'assets' | 'lifePolicies'> {
  const assets: EstateRecordAsset[] = [];
  const lifePolicies: EstateRecordLifePolicy[] = [];

  for (const policy of register) {
    if (policy.archived === true) continue;
    const data = isRow(policy.data) ? policy.data : null;
    if (!data) continue;
    const id = text(policy.id) || `${assets.length + lifePolicies.length + 1}`;
    const category = text(policy.categoryId) || text(policy.category);
    const provider = text(policy.providerName);

    if (RETIREMENT_CATEGORIES.has(category)) {
      // A fixed (guaranteed life) annuity is not here: it holds no capital.
      const currentValue = firstAmount(data, [
        'retirement_fund_value',
        'retirement_current_value',
        'post_retirement_capital_value',
        'ret_3',
        'ret_pre_3',
        'ret_post_3',
        'eb_ret_4',
      ]);
      if (currentValue <= 0) continue;
      const productType = firstText(data, [
        'retirement_fund_type',
        'ret_2',
        'ret_pre_2',
        'ret_post_2',
        'eb_ret_3',
      ]);
      const subType = retirementSubType(productType);
      assets.push({
        id: `policy-asset:${id}`,
        type: 'retirement',
        subType,
        description: [provider, productType || 'Retirement fund'].filter(Boolean).join(' '),
        currentValue,
        ownership: 'sole',
        ownershipPercentage: 100,
        location: 'south_africa',
        liquidity: liquidityOf('retirement', subType),
        includeInEstate: true,
        beneficiaryNominated: false,
        beneficiaryDetails: '',
      });
      continue;
    }

    if (INVESTMENT_CATEGORIES.has(category)) {
      const currentValue = firstAmount(data, [
        'invest_current_value',
        'inv_3',
        'inv_vol_3',
        'inv_gua_3',
      ]);
      if (currentValue <= 0) continue;
      const productType = firstText(data, [
        'invest_product_type',
        'inv_2',
        'inv_vol_2',
        'inv_gua_2',
      ]);
      const subType = productType.toLowerCase().includes('endowment') ? 'endowment' : 'unit_trust';
      assets.push({
        id: `policy-asset:${id}`,
        type: 'financial',
        subType,
        description: [provider, productType || 'Investment'].filter(Boolean).join(' '),
        currentValue,
        ownership: 'sole',
        ownershipPercentage: 100,
        location: 'south_africa',
        liquidity: liquidityOf('financial', subType),
        includeInEstate: true,
      });
      continue;
    }

    if (category === 'risk_planning' || category === 'employee_benefits_risk') {
      const groupLife = category === 'employee_benefits_risk';
      const sumAssured = firstAmount(data, groupLife ? ['eb_risk_4'] : ['rp_2']);
      if (sumAssured <= 0) continue;
      // The register does not record who the policy pays. An individual
      // policy keeps the estate route's long-standing default (payable to
      // the estate); group life is paid by the fund to its beneficiaries.
      lifePolicies.push({
        id: `policy-life:${id}`,
        policyType: groupLife ? 'group_life' : 'life_cover',
        sumAssured,
        ownership: 'client',
        beneficiaryType: groupLife ? 'nominated' : 'estate',
        beneficiaries: [],
        cededTo: '',
        payableToEstate: !groupLife,
        isBuyAndSellPolicy: false,
      });
    }
  }

  return { assets, lifePolicies };
}

// ── loading ────────────────────────────────────────────────────────────────

const policyRegisters = createKvRepository<unknown>('policies:client:');

interface ProfileBalanceSheet {
  assets?: unknown;
  liabilities?: unknown;
  [key: string]: unknown;
}

/** The client's assets, liabilities and life policies, ready for the estate FNA. */
export async function loadEstateClientRecords(clientId: string): Promise<EstateClientRecords> {
  const [profile, register] = await Promise.all([
    clientProfiles.get(clientProfileId(clientId)) as Promise<ProfileBalanceSheet | null>,
    policyRegisters.get(clientId),
  ]);
  const fromPolicies = estateRecordsFromPolicies(unwrapPolicyRegister(register));
  return {
    assets: [...estateAssetsFromProfile(profile?.assets), ...fromPolicies.assets],
    liabilities: estateLiabilitiesFromProfile(profile?.liabilities),
    lifePolicies: fromPolicies.lifePolicies,
  };
}
