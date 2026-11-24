import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AssetsLiabilitiesSection } from '../AssetsLiabilitiesSection';
import type { DerivedPolicyAsset } from '../../../../utils/derivedPolicyAssets';
import type { Asset, Liability } from '../../../../shared/types';

const rand = (n: number) => `R${n.toFixed(2)}`;

const property: Asset = {
  id: 'a1',
  type: 'Property',
  name: 'Unit 29 Pebble Creek',
  description: '',
  value: 2100000,
  ownershipType: 'Sole',
  provider: 'Nedbank',
} as Asset;

const policy: DerivedPolicyAsset = {
  id: 'policy-asset:p1',
  policyId: 'p1',
  categoryId: 'investments_voluntary',
  bucket: 'investment',
  assetTypeLabel: 'Investment Policy',
  providerName: 'Allan Gray',
  productType: 'Unit Trust',
  policyNumber: 'AGLP398635',
  value: 345444,
};

function renderSection(
  overrides: Partial<React.ComponentProps<typeof AssetsLiabilitiesSection>> = {},
) {
  const props: React.ComponentProps<typeof AssetsLiabilitiesSection> = {
    assets: [property],
    liabilities: [] as Liability[],
    derivedPolicyAssets: [policy],
    assetsInEditMode: new Set(),
    liabilitiesInEditMode: new Set(),
    assetToDelete: null,
    liabilityToDelete: null,
    addAsset: vi.fn(),
    editAsset: vi.fn(),
    saveAsset: vi.fn(),
    cancelEditAsset: vi.fn(),
    confirmDeleteAsset: vi.fn(),
    removeAsset: vi.fn(),
    updateAsset: vi.fn(),
    addLiability: vi.fn(),
    editLiability: vi.fn(),
    saveLiability: vi.fn(),
    cancelEditLiability: vi.fn(),
    confirmDeleteLiability: vi.fn(),
    removeLiability: vi.fn(),
    updateLiability: vi.fn(),
    setAssetToDelete: vi.fn(),
    setLiabilityToDelete: vi.fn(),
    formatCurrency: rand,
    ...overrides,
  };
  render(<AssetsLiabilitiesSection {...props} />);
  return props;
}

describe('AssetsLiabilitiesSection', () => {
  it('shows assets − liabilities = net worth once, counting policies', () => {
    renderSection();
    const strip = screen.getByRole('region', { name: 'Net worth' });
    expect(within(strip).getAllByText(rand(2445444))).toHaveLength(2);
    expect(within(strip).getByText('2 assets, 1 from policies')).toBeDefined();
    expect(within(strip).getByText('None added')).toBeDefined();
  });

  it('lists captured and policy assets in one table with their source', () => {
    renderSection();
    const table = screen.getByRole('table');
    expect(within(table).getByText('Unit 29 Pebble Creek')).toBeDefined();
    expect(within(table).getByText('Added here')).toBeDefined();
    expect(within(table).getByText('Allan Gray')).toBeDefined();
    expect(within(table).getByText('From policies')).toBeDefined();
    expect(within(table).getByText('Total assets')).toBeDefined();
    expect(screen.queryByText('Linked Policy Assets')).toBeNull();
  });

  it('opens Policy details from a policy row', () => {
    const onOpenPolicies = vi.fn();
    renderSection({ onOpenPolicies });
    fireEvent.click(screen.getByRole('button', { name: /Open policy/ }));
    expect(onOpenPolicies).toHaveBeenCalledTimes(1);
  });

  it('shows the empty states when nothing is on record', () => {
    const props = renderSection({ assets: [], derivedPolicyAssets: [] });
    expect(screen.getByText('No assets yet')).toBeDefined();
    expect(screen.getByText('No liabilities yet')).toBeDefined();
    fireEvent.click(screen.getAllByRole('button', { name: 'Add liability' })[0]);
    expect(props.addLiability).toHaveBeenCalled();
  });
});
