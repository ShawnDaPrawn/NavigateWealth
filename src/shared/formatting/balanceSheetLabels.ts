/**
 * Display labels for balance-sheet rows.
 *
 * Both profile surfaces render the same rule — fall back to `customType` when
 * the type is 'Other', then to a generic noun when it is blank — and each kept
 * its own identical copy. One copy, used by both.
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
