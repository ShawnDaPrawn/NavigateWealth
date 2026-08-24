/**
 * Assets card of the admin assets & liabilities section. Pure view over
 * props from AssetsLiabilitiesSection.
 */
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Input } from '../../ui/input';
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
import { TrendingUp, Plus, Edit2, Trash2, X, Check, PieChart, AlertTriangle } from 'lucide-react';
import { EmptyState } from '../../pages/profile/EmptyState';
import { emptyStateConfigs } from '../../pages/profile/emptyStateConfigs';
import {
  findPossiblePolicyAssetMatches,
  type DerivedPolicyAsset,
} from '../../../utils/derivedPolicyAssets';
import { useInlineEditDialogClose } from '../../shared/unsaved-changes';

import { DetailChip } from './assetsLiabilitiesShared';
import { getAssetTypeLabel } from '../../../shared/formatting';
import type { Asset } from '../../../shared/types';

interface AssetsPanelProps {
  assets: Asset[];
  derivedPolicyAssets: DerivedPolicyAsset[];
  linkedPolicyAssetsLoading: boolean;
  linkedPolicyAssetsError: string | null;
  linkedPolicyAssetTotal: number;
  possibleDuplicateMatches: ReturnType<typeof findPossiblePolicyAssetMatches>;
  possibleDuplicateCount: number;
  totalAssets: number;
  assetsInEditMode: Set<string>;
  assetDisplayValues: { [id: string]: string };
  setAssetDisplayValues: React.Dispatch<React.SetStateAction<{ [id: string]: string }>>;
  assetEditGuard: ReturnType<typeof useInlineEditDialogClose>;
  formatCurrency: (value: number) => string;
  formatCurrencyInput: (value: string) => string;
  addAsset: () => void;
  updateAsset: (id: string, updates: Partial<Asset>) => void;
  saveAsset: (id: string) => void;
  editAsset: (id: string) => void;
  confirmDeleteAsset: (id: string) => void;
}

export function AssetsPanel({
  assets,
  derivedPolicyAssets,
  linkedPolicyAssetsLoading,
  linkedPolicyAssetsError,
  linkedPolicyAssetTotal,
  possibleDuplicateMatches,
  possibleDuplicateCount,
  totalAssets,
  assetsInEditMode,
  assetDisplayValues,
  setAssetDisplayValues,
  assetEditGuard,
  formatCurrency,
  formatCurrencyInput,
  addAsset,
  updateAsset,
  saveAsset,
  editAsset,
  confirmDeleteAsset,
}: AssetsPanelProps) {
  return (
    <Card className="border-gray-200 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <CardTitle className="text-xl">Assets</CardTitle>
              <CardDescription>Client's properties, investments, and valuables</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-green-700">
              Manual {formatCurrency(totalAssets)}
            </div>
            <div className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
              Linked {formatCurrency(linkedPolicyAssetTotal)}
            </div>
            <Button
              onClick={addAsset}
              size="sm"
              disabled={assetsInEditMode.size > 0}
              className="bg-[#6d28d9] hover:bg-[#5b21b6] disabled:cursor-not-allowed disabled:opacity-50"
              title={
                assetsInEditMode.size > 0
                  ? 'Please save the current asset before adding a new one'
                  : 'Add a new asset'
              }
            >
              <Plus className="mr-1 h-4 w-4" />
              Add Asset
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {(linkedPolicyAssetsLoading ||
          linkedPolicyAssetsError ||
          derivedPolicyAssets.length > 0) && (
          <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100">
                <PieChart className="h-4 w-4 text-blue-700" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-blue-950">Linked Policy Assets</p>
                <p className="mt-1 text-xs leading-relaxed text-blue-900/80">
                  Retirement and investment policies are being displayed here automatically so
                  advisers do not have to capture the same holdings twice. These rows are read-only
                  and remain managed in Policy Details.
                </p>
                {linkedPolicyAssetsLoading && (
                  <p className="mt-2 text-xs font-medium text-blue-800">
                    Loading linked policy assets...
                  </p>
                )}
                {linkedPolicyAssetsError && (
                  <p className="mt-2 text-xs font-medium text-red-700">{linkedPolicyAssetsError}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {possibleDuplicateCount > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                <AlertTriangle className="h-4 w-4 text-amber-700" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-amber-950">
                  Possible duplicate assets detected
                </p>
                <p className="mt-1 text-xs leading-relaxed text-amber-900/80">
                  {possibleDuplicateCount} manual{' '}
                  {possibleDuplicateCount === 1 ? 'asset appears' : 'assets appear'} to overlap with
                  a linked retirement or investment policy. These are warnings only. Nothing has
                  been merged or deleted.
                </p>
              </div>
            </div>
          </div>
        )}

        {assets.length === 0 ? (
          derivedPolicyAssets.length === 0 ? (
            <EmptyState
              icon={emptyStateConfigs.assets.icon}
              title={emptyStateConfigs.assets.title}
              description={emptyStateConfigs.assets.description}
              actionLabel={emptyStateConfigs.assets.actionLabel}
              onAction={addAsset}
              iconColor={emptyStateConfigs.assets.iconColor}
              iconBgColor={emptyStateConfigs.assets.iconBgColor}
              buttonColor={emptyStateConfigs.assets.buttonColor}
              buttonHoverColor={emptyStateConfigs.assets.buttonHoverColor}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-4 text-sm text-gray-600">
              No manual assets have been entered yet. Linked retirement and investment policies are
              shown below without writing anything into the profile asset list.
            </div>
          )
        ) : (
          assets.map((asset, index) => {
            const isEditing = assetsInEditMode.has(asset.id);
            const isOtherType = asset.type === 'Other';
            const duplicateMatches = possibleDuplicateMatches[asset.id] || [];
            let isValid: string | boolean | undefined =
              asset.type && asset.name && asset.ownershipType;
            if (isOtherType) {
              isValid = isValid && asset.customType;
            }

            return (
              <React.Fragment key={asset.id}>
                <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 transition-colors hover:border-gray-300">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-100">
                        <TrendingUp className="h-5 w-5 text-green-600" />
                      </div>
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="text-sm font-semibold text-gray-900">
                            {asset.name || `Asset ${index + 1}`}
                          </p>
                          <span className="text-xs text-gray-500">{getAssetTypeLabel(asset)}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <DetailChip label="Value" value={formatCurrency(asset.value || 0)} />
                          <DetailChip label="Ownership" value={asset.ownershipType || 'Not set'} />
                          {asset.provider && <DetailChip label="Provider" value={asset.provider} />}
                        </div>
                        {asset.description && (
                          <p className="text-xs leading-relaxed text-gray-500">
                            {asset.description}
                          </p>
                        )}
                        {duplicateMatches.length > 0 && (
                          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                            <p className="text-xs font-semibold text-amber-900">
                              Possible duplicate of linked policy
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {duplicateMatches.map((match) => (
                                <span
                                  key={`${asset.id}:${match.id}`}
                                  className="inline-flex flex-wrap items-center gap-1 rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[11px] font-medium text-amber-800"
                                >
                                  <span>{match.providerName}</span>
                                  <span className="text-amber-700/80">{match.productType}</span>
                                  <span className="text-amber-700/80">{match.policyNumber}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 self-end lg:self-start">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          assetEditGuard.trackEditStart(asset.id);
                          editAsset(asset.id);
                        }}
                        className="border-[#6d28d9] text-[#6d28d9] hover:bg-[#6d28d9]/10"
                      >
                        <Edit2 className="mr-1 h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => confirmDeleteAsset(asset.id)}
                        className="border-red-200 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

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
                        <Label htmlFor={`asset-value-${asset.id}`}>
                          Current Estimated Value (R) *
                        </Label>
                        <Input
                          id={`asset-value-${asset.id}`}
                          type="text"
                          value={
                            assetDisplayValues[asset.id] !== undefined
                              ? assetDisplayValues[asset.id]
                              : asset.value
                                ? formatCurrencyInput(asset.value.toString())
                                : ''
                          }
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^0-9.]/g, '');
                            setAssetDisplayValues((prev) => ({
                              ...prev,
                              [asset.id]: raw,
                            }));
                            updateAsset(asset.id, { value: parseFloat(raw) || 0 });
                          }}
                          onBlur={() => {
                            setAssetDisplayValues((prev) => {
                              const nextValues = { ...prev };
                              delete nextValues[asset.id];
                              return nextValues;
                            });
                          }}
                          onFocus={() => {
                            if (assetDisplayValues[asset.id] === undefined) {
                              setAssetDisplayValues((prev) => ({
                                ...prev,
                                [asset.id]: asset.value ? asset.value.toString() : '',
                              }));
                            }
                          }}
                          placeholder="0.00"
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
                        <Label htmlFor={`provider-${asset.id}`}>
                          Linked Provider or Institution
                        </Label>
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
          })
        )}

        {derivedPolicyAssets.length > 0 && (
          <div className="space-y-3 border-t border-gray-100 pt-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">Linked Policy Assets</p>
                <p className="text-xs text-gray-500">
                  Read-only values derived from active retirement and investment policies.
                </p>
              </div>
              <div className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                {formatCurrency(linkedPolicyAssetTotal)}
              </div>
            </div>

            {derivedPolicyAssets.map((asset) => (
              <div key={asset.id} className="rounded-xl border border-blue-100 bg-white px-4 py-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100">
                      <PieChart className="h-5 w-5 text-blue-700" />
                    </div>
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="text-sm font-semibold text-gray-900">{asset.providerName}</p>
                        <span className="text-xs text-gray-500">{asset.assetTypeLabel}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <DetailChip label="Value" value={formatCurrency(asset.value)} />
                        <DetailChip label="Product" value={asset.productType} />
                        <DetailChip label="Policy" value={asset.policyNumber} />
                      </div>
                    </div>
                  </div>
                  <div className="self-start rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-700">
                    From Policy Register
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
