/**
 * Type-label helpers for assets and liabilities rows.
 */
import type { Asset, Liability } from '../types';

export function getAssetTypeLabel(asset: Asset) {
  return asset.type === 'Other' ? asset.customType || 'Other' : asset.type || 'Asset';
}

export function getLiabilityTypeLabel(liability: Liability) {
  return liability.type === 'Other'
    ? liability.customType || 'Other'
    : liability.type || 'Liability';
}
