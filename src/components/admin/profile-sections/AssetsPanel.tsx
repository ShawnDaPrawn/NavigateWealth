/**
 * Assets card of the admin assets & liabilities section (design: the
 * "Assets & liabilities redesign" canvas). One table holds every asset:
 * the ones captured here (Edit and Delete under ⋯) and the retirement and
 * investment policies read from Policy details (Open policy). Pure view
 * over props from AssetsLiabilitiesSection.
 */
import React from 'react';
import { Input } from '../../ui/input';
import { CurrencyInputField } from '../../ui/currency-input';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Textarea } from '../../ui/textarea';
import { Button } from '../../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { AlertTriangle, ArrowRight, Check, TrendingUp, X } from 'lucide-react';
import {
  findPossiblePolicyAssetMatches,
  type DerivedPolicyAsset,
} from '../../../utils/derivedPolicyAssets';
import { useInlineEditDialogClose } from '../../shared/unsaved-changes';

import {
  BalanceCard,
  PanelEmptyState,
  RowActionsMenu,
  SourceBadge,
  TD,
  TD_ACTIONS,
  TD_NUM,
  TH,
  TH_NUM,
} from './assetsLiabilitiesShared';
import { getAssetTypeLabel } from '../../../shared/formatting';
import type { Asset } from '../../../shared/types';

interface AssetsPanelProps {
  assets: Asset[];
  derivedPolicyAssets: DerivedPolicyAsset[];
  linkedPolicyAssetsLoading: boolean;
  linkedPolicyAssetsError: string | null;
  possibleDuplicateMatches: ReturnType<typeof findPossiblePolicyAssetMatches>;
  possibleDuplicateCount: number;
  combinedAssets: number;
  assetsInEditMode: Set<string>;
  assetEditGuard: ReturnType<typeof useInlineEditDialogClose>;
  formatCurrency: (value: number) => string;
  addAsset: () => void;
  updateAsset: (id: string, updates: Partial<Asset>) => void;
  saveAsset: (id: string) => void;
  editAsset: (id: string) => void;
  confirmDeleteAsset: (id: string) => void;
  /** Opens the client's Policy details tab. Without it, policy rows show no link. */
  onOpenPolicies?: () => void;
}

export function AssetsPanel({
  assets,
  derivedPolicyAssets,
  linkedPolicyAssetsLoading,
  linkedPolicyAssetsError,
  possibleDuplicateMatches,
  possibleDuplicateCount,
  combinedAssets,
  assetsInEditMode,
  assetEditGuard,
  formatCurrency,
  addAsset,
  updateAsset,
  saveAsset,
  editAsset,
  confirmDeleteAsset,
  onOpenPolicies,
}: AssetsPanelProps) {
  const hasRows = assets.length > 0 || derivedPolicyAssets.length > 0;
  const addBlocked = assetsInEditMode.size > 0;

  return (
    <BalanceCard
      id="admin-assets-heading"
      title="Assets"
      description={
        derivedPolicyAssets.length > 0
          ? 'Policies show here from Policy details and are edited there.'
          : undefined
      }
      addLabel="Add asset"
      onAdd={addAsset}
      addDisabled={addBlocked}
      addTitle={addBlocked ? 'Save the asset you are editing first' : undefined}
    >
      {(linkedPolicyAssetsLoading || linkedPolicyAssetsError) && (
        <p
          className={`border-b border-nw-line-soft px-5 py-2.5 text-[13px] ${
            linkedPolicyAssetsError ? 'text-red-700' : 'text-nw-muted'
          }`}
          role={linkedPolicyAssetsError ? 'alert' : 'status'}
        >
          {linkedPolicyAssetsError || 'Loading policies…'}
        </p>
      )}

      {possibleDuplicateCount > 0 && (
        <div className="flex items-start gap-3 border-b border-nw-warn-line bg-nw-warn-bg px-5 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-nw-warn" aria-hidden="true" />
          <p className="text-[13px] leading-[18px] text-nw-warn-dark">
            <span className="font-semibold">
              {possibleDuplicateCount}{' '}
              {possibleDuplicateCount === 1 ? 'asset looks' : 'assets look'} like a policy already
              listed.
            </span>{' '}
            Check before saving so it isn't counted twice. Nothing has been merged or deleted.
          </p>
        </div>
      )}

      {!hasRows ? (
        <PanelEmptyState
          icon={TrendingUp}
          title="No assets yet"
          description="Add property, vehicles, cash and other holdings. Retirement and investment policies appear here on their own."
          actionLabel="Add asset"
          onAction={addAsset}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead className="bg-nw-paper-3">
              <tr>
                <th scope="col" className={TH}>
                  Asset
                </th>
                <th scope="col" className={TH}>
                  Type
                </th>
                <th scope="col" className={TH}>
                  Details
                </th>
                <th scope="col" className={TH}>
                  Source
                </th>
                <th scope="col" className={TH_NUM}>
                  Value
                </th>
                <th scope="col" className={TH}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset, index) => {
                const name = asset.name || `Asset ${index + 1}`;
                const details = [
                  asset.ownershipType ? `${asset.ownershipType} owner` : '',
                  asset.provider,
                ]
                  .filter(Boolean)
                  .join(' · ');
                const duplicateMatches = possibleDuplicateMatches[asset.id] || [];
                return (
                  <tr key={asset.id} className="transition-colors hover:bg-nw-paper-3">
                    <td className={TD}>
                      <p className="font-semibold text-nw-ink">{name}</p>
                      {asset.description && (
                        <p className="mt-0.5 max-w-xs text-[13px] leading-[18px] text-nw-muted">
                          {asset.description}
                        </p>
                      )}
                      {duplicateMatches.length > 0 && (
                        <p className="mt-1 text-[13px] leading-[18px] text-nw-warn-dark">
                          Possible duplicate of{' '}
                          {duplicateMatches
                            .map((match) => `${match.providerName} ${match.policyNumber}`)
                            .join(', ')}
                        </p>
                      )}
                    </td>
                    <td className={TD}>{getAssetTypeLabel(asset)}</td>
                    <td className={`${TD} text-nw-text`}>{details || '—'}</td>
                    <td className={TD}>
                      <SourceBadge linked={false} />
                    </td>
                    <td className={TD_NUM}>{formatCurrency(asset.value || 0)}</td>
                    <td className={TD_ACTIONS}>
                      <RowActionsMenu
                        name={name}
                        onEdit={() => {
                          assetEditGuard.trackEditStart(asset.id);
                          editAsset(asset.id);
                        }}
                        onDelete={() => confirmDeleteAsset(asset.id)}
                      />
                    </td>
                  </tr>
                );
              })}
              {derivedPolicyAssets.map((asset) => (
                <tr key={asset.id} className="transition-colors hover:bg-nw-paper-3">
                  <td className={`${TD} font-semibold text-nw-ink`}>{asset.providerName}</td>
                  <td className={TD}>{asset.assetTypeLabel}</td>
                  <td className={`${TD} tabular-nums text-nw-text`}>
                    {asset.productType} · {asset.policyNumber}
                  </td>
                  <td className={TD}>
                    <SourceBadge linked />
                  </td>
                  <td className={TD_NUM}>{formatCurrency(asset.value)}</td>
                  <td className={TD_ACTIONS}>
                    {onOpenPolicies && (
                      <button
                        type="button"
                        onClick={onOpenPolicies}
                        className="group inline-flex items-center gap-1 rounded text-[13px] font-semibold text-nw-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-violet/60"
                      >
                        Open policy
                        <ArrowRight
                          className="h-3.5 w-3.5 transition-transform group-hover:translate-x-[3px] motion-reduce:transition-none"
                          aria-hidden="true"
                        />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} className="px-5 py-3.5 font-semibold text-nw-ink">
                  Total assets
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-right font-semibold tabular-nums text-nw-ink">
                  {formatCurrency(combinedAssets)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {assets.map((asset, index) => {
        const isEditing = assetsInEditMode.has(asset.id);
        const isOtherType = asset.type === 'Other';
        let isValid: string | boolean | undefined = asset.type && asset.name && asset.ownershipType;
        if (isOtherType) {
          isValid = isValid && asset.customType;
        }
        return (
          <React.Fragment key={`edit-${asset.id}`}>
            <Dialog
              open={isEditing}
              onOpenChange={(open) => assetEditGuard.handleDialogOpenChange(asset.id, open)}
            >
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{asset.name || `Asset ${index + 1}`}</DialogTitle>
                  <DialogDescription>
                    Update the client's asset details without expanding the entire profile page.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label htmlFor={`asset-type-${asset.id}`}>Asset Type *</Label>
                    <Select
                      value={asset.type}
                      onValueChange={(value) => updateAsset(asset.id, { type: value })}
                    >
                      <SelectTrigger id={`asset-type-${asset.id}`} className="mt-1.5">
                        <SelectValue placeholder="Select asset type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Property">Property</SelectItem>
                        <SelectItem value="Vehicle">Vehicle</SelectItem>
                        <SelectItem value="Investment">Investment</SelectItem>
                        <SelectItem value="Cash">Cash</SelectItem>
                        <SelectItem value="Retirement Savings">Retirement Savings</SelectItem>
                        <SelectItem value="Business Interest">Business Interest</SelectItem>
                        <SelectItem value="Collectibles">Collectibles</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {isOtherType && (
                    <div className="sm:col-span-2">
                      <Label htmlFor={`custom-type-${asset.id}`}>Custom Asset Type *</Label>
                      <Input
                        id={`custom-type-${asset.id}`}
                        value={asset.customType || ''}
                        onChange={(e) => updateAsset(asset.id, { customType: e.target.value })}
                        placeholder="Specify custom asset type"
                        className="mt-1.5"
                      />
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <Label htmlFor={`asset-name-${asset.id}`}>Asset Name / Description *</Label>
                    <Input
                      id={`asset-name-${asset.id}`}
                      value={asset.name}
                      onChange={(e) => updateAsset(asset.id, { name: e.target.value })}
                      placeholder="Enter asset name"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`asset-value-${asset.id}`}>Current Estimated Value (R) *</Label>
                    <CurrencyInputField
                      id={`asset-value-${asset.id}`}
                      value={asset.value}
                      onValueChange={(v) => updateAsset(asset.id, { value: v ?? 0 })}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`ownership-${asset.id}`}>Ownership Type *</Label>
                    <Select
                      value={asset.ownershipType}
                      onValueChange={(value) => updateAsset(asset.id, { ownershipType: value })}
                    >
                      <SelectTrigger id={`ownership-${asset.id}`} className="mt-1.5">
                        <SelectValue placeholder="Select ownership" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Sole">Sole</SelectItem>
                        <SelectItem value="Joint">Joint</SelectItem>
                        <SelectItem value="Trust">Trust</SelectItem>
                        <SelectItem value="Company">Company</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor={`provider-${asset.id}`}>Linked Provider or Institution</Label>
                    <Input
                      id={`provider-${asset.id}`}
                      value={asset.provider}
                      onChange={(e) => updateAsset(asset.id, { provider: e.target.value })}
                      placeholder="e.g., ABC Bank, XYZ Investments"
                      className="mt-1.5"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor={`asset-desc-${asset.id}`}>Additional Details</Label>
                    <Textarea
                      id={`asset-desc-${asset.id}`}
                      value={asset.description}
                      onChange={(e) => updateAsset(asset.id, { description: e.target.value })}
                      placeholder="Any additional information"
                      className="mt-1.5"
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => assetEditGuard.handleDialogOpenChange(asset.id, false)}
                    className="border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    <X className="mr-1 h-4 w-4" />
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      assetEditGuard.clearSnapshot(asset.id);
                      saveAsset(asset.id);
                    }}
                    disabled={!isValid}
                    className={
                      !isValid
                        ? 'cursor-not-allowed bg-gray-300 text-gray-500 hover:bg-gray-300'
                        : 'bg-[#6d28d9] text-white hover:bg-[#5b21b6]'
                    }
                  >
                    <Check className="mr-1 h-4 w-4" />
                    Save Asset
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </React.Fragment>
        );
      })}
    </BalanceCard>
  );
}
