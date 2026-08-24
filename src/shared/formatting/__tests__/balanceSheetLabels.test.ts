/**
 * Pins the balance-sheet row labels.
 *
 * The client profile and the admin client-profile viewer each carried their own
 * identical copy of these two helpers. They are now one copy used by both, so
 * these cases stand for the labels rendered on BOTH surfaces — the fallback
 * chain in particular, which is what makes a row read "Other" instead of blank.
 */
import { describe, it, expect } from 'vitest';
import { getAssetTypeLabel, getLiabilityTypeLabel } from '../balanceSheetLabels';
import type { Asset, Liability } from '../../types';

const asset = (over: Partial<Asset>): Asset => ({
  id: 'a1',
  type: 'Property',
  name: 'House',
  description: '',
  value: 0,
  ownershipType: 'Sole',
  provider: '',
  ...over,
});

const liability = (over: Partial<Liability>): Liability => ({
  id: 'l1',
  type: 'Mortgage',
  name: 'Bond',
  description: '',
  provider: '',
  outstandingBalance: 0,
  monthlyPayment: 0,
  interestRate: 0,
  ...over,
});

describe('getAssetTypeLabel', () => {
  it('uses the type when it is a normal one', () => {
    expect(getAssetTypeLabel(asset({ type: 'Property' }))).toBe('Property');
  });

  it("substitutes customType when the type is 'Other'", () => {
    expect(getAssetTypeLabel(asset({ type: 'Other', customType: 'Artwork' }))).toBe('Artwork');
  });

  it("falls back to 'Other' when the type is 'Other' with no customType", () => {
    expect(getAssetTypeLabel(asset({ type: 'Other', customType: '' }))).toBe('Other');
  });

  it("falls back to 'Asset' when the type is blank", () => {
    // A blank type must still render a noun, not an empty cell.
    expect(getAssetTypeLabel(asset({ type: '' }))).toBe('Asset');
  });

  it('ignores customType when the type is not Other', () => {
    expect(getAssetTypeLabel(asset({ type: 'Vehicle', customType: 'Ignored' }))).toBe('Vehicle');
  });
});

describe('getLiabilityTypeLabel', () => {
  it('uses the type when it is a normal one', () => {
    expect(getLiabilityTypeLabel(liability({ type: 'Mortgage' }))).toBe('Mortgage');
  });

  it("substitutes customType when the type is 'Other'", () => {
    expect(getLiabilityTypeLabel(liability({ type: 'Other', customType: 'Study loan' }))).toBe(
      'Study loan',
    );
  });

  it("falls back to 'Other' when the type is 'Other' with no customType", () => {
    expect(getLiabilityTypeLabel(liability({ type: 'Other', customType: undefined }))).toBe(
      'Other',
    );
  });

  it("falls back to 'Liability' when the type is blank", () => {
    expect(getLiabilityTypeLabel(liability({ type: '' }))).toBe('Liability');
  });
});
