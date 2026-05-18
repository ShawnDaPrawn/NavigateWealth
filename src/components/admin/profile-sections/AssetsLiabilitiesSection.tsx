import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Textarea } from '../../ui/textarea';
import { Button } from '../../ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { TrendingUp, DollarSign, Plus, Edit2, Trash2, X, Check, PieChart, AlertTriangle } from 'lucide-react';
import { EmptyState } from '../../pages/profile/EmptyState';
import { emptyStateConfigs } from '../../pages/profile/emptyStateConfigs';
import { findPossiblePolicyAssetMatches, type DerivedPolicyAsset } from '../../../utils/derivedPolicyAssets';

interface Asset {
  id: string;
  type: string;
  name: string;
  description: string;
  value: number;
  ownershipType: string;
  provider: string;
  customType?: string;
}

interface Liability {
  id: string;
  type: string;
  name: string;
  description: string;
  provider: string;
  outstandingBalance: number;
  monthlyPayment: number;
  interestRate: number;
  customType?: string;
}

interface AssetsLiabilitiesSectionProps {
  assets: Asset[];
  liabilities: Liability[];
  derivedPolicyAssets?: DerivedPolicyAsset[];
  linkedPolicyAssetsLoading?: boolean;
  linkedPolicyAssetsError?: string | null;
  assetsInEditMode: Set<string>;
  liabilitiesInEditMode: Set<string>;
  assetToDelete: string | null;
  liabilityToDelete: string | null;
  assetDisplayValues: { [id: string]: string };
  liabilityDisplayValues: { [id: string]: { amount?: string; monthlyPayment?: string } };
  setAssetDisplayValues: (value: React.SetStateAction<Record<string, string>>) => void;
  setLiabilityDisplayValues: (value: React.SetStateAction<Record<string, { amount?: string; monthlyPayment?: string }>>) => void;
  addAsset: () => void;
  editAsset: (id: string) => void;
  saveAsset: (id: string) => void;
  cancelEditAsset: (id: string) => void;
  confirmDeleteAsset: (id: string) => void;
  removeAsset: () => void;
  updateAsset: (id: string, updates: Partial<Asset>) => void;
  addLiability: () => void;
  editLiability: (id: string) => void;
  saveLiability: (id: string) => void;
  cancelEditLiability: (id: string) => void;
  confirmDeleteLiability: (id: string) => void;
  removeLiability: () => void;
  updateLiability: (id: string, updates: Partial<Liability>) => void;
  setAssetToDelete: (value: string | null) => void;
  setLiabilityToDelete: (value: string | null) => void;
  formatCurrency: (value: number) => string;
  formatCurrencyInput: (value: string) => string;
  cleanCurrencyInput: (value: string) => string;
}

function SummaryMetric({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'positive' | 'negative' | 'accent';
}) {
  const toneClasses =
    tone === 'positive'
      ? 'border-green-200 bg-green-50 text-green-900'
      : tone === 'negative'
        ? 'border-red-200 bg-red-50 text-red-900'
        : tone === 'accent'
          ? 'border-[#6d28d9]/20 bg-[#6d28d9]/5 text-[#4c1d95]'
          : 'border-gray-200 bg-gray-50 text-gray-900';

  return (
    <div className={`rounded-xl border px-4 py-3 ${toneClasses}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-current/70">{label}</p>
      <p className="mt-1 text-lg font-semibold text-current">{value}</p>
    </div>
  );
}

function DetailChip({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-700">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900">{value}</span>
    </span>
  );
}

function getAssetTypeLabel(asset: Asset) {
  return asset.type === 'Other' ? asset.customType || 'Other' : asset.type || 'Asset';
}

function getLiabilityTypeLabel(liability: Liability) {
  return liability.type === 'Other' ? liability.customType || 'Other' : liability.type || 'Liability';
}

export function AssetsLiabilitiesSection({
  assets = [],
  liabilities = [],
  derivedPolicyAssets = [],
  linkedPolicyAssetsLoading = false,
  linkedPolicyAssetsError = null,
  assetsInEditMode,
  liabilitiesInEditMode,
  assetToDelete,
  liabilityToDelete,
  assetDisplayValues,
  liabilityDisplayValues,
  setAssetDisplayValues,
  setLiabilityDisplayValues,
  addAsset,
  editAsset,
  saveAsset,
  cancelEditAsset,
  confirmDeleteAsset,
  removeAsset,
  updateAsset,
  addLiability,
  editLiability,
  saveLiability,
  cancelEditLiability,
  confirmDeleteLiability,
  removeLiability,
  updateLiability,
  setAssetToDelete,
  setLiabilityToDelete,
  formatCurrency,
  formatCurrencyInput,
  cleanCurrencyInput,
}: AssetsLiabilitiesSectionProps) {
  const totalAssets = assets.reduce((sum, asset) => sum + (asset.value || 0), 0);
  const linkedPolicyAssetTotal = derivedPolicyAssets.reduce((sum, asset) => sum + asset.value, 0);
  const combinedAssets = totalAssets + linkedPolicyAssetTotal;
  const totalLiabilities = liabilities.reduce((sum, liability) => sum + (liability.outstandingBalance || 0), 0);
  const netWorth = combinedAssets - totalLiabilities;
  const possibleDuplicateMatches = findPossiblePolicyAssetMatches(assets, derivedPolicyAssets);
  const possibleDuplicateCount = Object.keys(possibleDuplicateMatches).length;
  const hasBalanceSheetData =
    assets.length > 0 || liabilities.length > 0 || derivedPolicyAssets.length > 0;

  return (
    <div className="space-y-5">
      {hasBalanceSheetData && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryMetric label="Manual Assets" value={formatCurrency(totalAssets)} tone="positive" />
          <SummaryMetric
            label="Linked Policy Assets"
            value={formatCurrency(linkedPolicyAssetTotal)}
            tone="accent"
          />
          <SummaryMetric label="Combined Assets" value={formatCurrency(combinedAssets)} tone="positive" />
          <SummaryMetric label="Total Liabilities" value={formatCurrency(totalLiabilities)} tone="negative" />
          <SummaryMetric label="Net Worth" value={formatCurrency(netWorth)} tone="accent" />
        </div>
      )}

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
                title={assetsInEditMode.size > 0 ? 'Please save the current asset before adding a new one' : 'Add a new asset'}
              >
                <Plus className="mr-1 h-4 w-4" />
                Add Asset
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {(linkedPolicyAssetsLoading || linkedPolicyAssetsError || derivedPolicyAssets.length > 0) && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100">
                  <PieChart className="h-4 w-4 text-blue-700" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-blue-950">Linked Policy Assets</p>
                  <p className="mt-1 text-xs leading-relaxed text-blue-900/80">
                    Retirement and investment policies are being displayed here automatically so
                    advisers do not have to capture the same holdings twice. These rows are
                    read-only and remain managed in Policy Details.
                  </p>
                  {linkedPolicyAssetsLoading && (
                    <p className="mt-2 text-xs font-medium text-blue-800">
                      Loading linked policy assets...
                    </p>
                  )}
                  {linkedPolicyAssetsError && (
                    <p className="mt-2 text-xs font-medium text-red-700">
                      {linkedPolicyAssetsError}
                    </p>
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
                  <p className="text-sm font-semibold text-amber-950">Possible duplicate assets detected</p>
                  <p className="mt-1 text-xs leading-relaxed text-amber-900/80">
                    {possibleDuplicateCount} manual {possibleDuplicateCount === 1 ? 'asset appears' : 'assets appear'} to overlap with a linked retirement or investment policy.
                    These are warnings only. Nothing has been merged or deleted.
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
                No manual assets have been entered yet. Linked retirement and investment policies
                are shown below without writing anything into the profile asset list.
              </div>
            )
          ) : (
            assets.map((asset, index) => {
              const isEditing = assetsInEditMode.has(asset.id);
              const isOtherType = asset.type === 'Other';
              const duplicateMatches = possibleDuplicateMatches[asset.id] || [];
              let isValid: string | boolean | undefined = asset.type && asset.name && asset.ownershipType;
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
                            <p className="text-sm font-semibold text-gray-900">{asset.name || `Asset ${index + 1}`}</p>
                            <span className="text-xs text-gray-500">{getAssetTypeLabel(asset)}</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <DetailChip label="Value" value={formatCurrency(asset.value || 0)} />
                            <DetailChip label="Ownership" value={asset.ownershipType || 'Not set'} />
                            {asset.provider && <DetailChip label="Provider" value={asset.provider} />}
                          </div>
                          {asset.description && (
                            <p className="text-xs leading-relaxed text-gray-500">{asset.description}</p>
                          )}
                          {duplicateMatches.length > 0 && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                              <p className="text-xs font-semibold text-amber-900">Possible duplicate of linked policy</p>
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
                          onClick={() => editAsset(asset.id)}
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

                  <Dialog open={isEditing} onOpenChange={(open) => !open && cancelEditAsset(asset.id)}>
                    <DialogContent className="sm:max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>{asset.name || `Asset ${index + 1}`}</DialogTitle>
                        <DialogDescription>Update the client's asset details without expanding the entire profile page.</DialogDescription>
                      </DialogHeader>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <Label htmlFor={`asset-type-${asset.id}`}>Asset Type *</Label>
                          <Select value={asset.type} onValueChange={(value) => updateAsset(asset.id, { type: value })}>
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
                          <Input
                            id={`asset-value-${asset.id}`}
                            type="text"
                            value={assetDisplayValues[asset.id] !== undefined ? assetDisplayValues[asset.id] : (asset.value ? formatCurrencyInput(asset.value.toString()) : '')}
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
                          <Select value={asset.ownershipType} onValueChange={(value) => updateAsset(asset.id, { ownershipType: value })}>
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
                          onClick={() => cancelEditAsset(asset.id)}
                          className="border-gray-300 text-gray-700 hover:bg-gray-50"
                        >
                          <X className="mr-1 h-4 w-4" />
                          Cancel
                        </Button>
                        <Button
                          onClick={() => saveAsset(asset.id)}
                          disabled={!isValid}
                          className={!isValid ? 'cursor-not-allowed bg-gray-300 text-gray-500 hover:bg-gray-300' : 'bg-[#6d28d9] text-white hover:bg-[#5b21b6]'}
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
                <div
                  key={asset.id}
                  className="rounded-xl border border-blue-100 bg-white px-4 py-3"
                >
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

      <Card className="border-gray-200 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100">
                <DollarSign className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <CardTitle className="text-xl">Liabilities</CardTitle>
                <CardDescription>Client's debts and financial obligations</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-red-50 px-3 py-1 text-sm font-medium text-red-700">
                {formatCurrency(totalLiabilities)}
              </div>
              <Button
                onClick={addLiability}
                size="sm"
                disabled={liabilitiesInEditMode.size > 0}
                className="bg-[#6d28d9] hover:bg-[#5b21b6] disabled:cursor-not-allowed disabled:opacity-50"
                title={liabilitiesInEditMode.size > 0 ? 'Please save the current liability before adding a new one' : 'Add a new liability'}
              >
                <Plus className="mr-1 h-4 w-4" />
                Add Liability
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {liabilities.length === 0 ? (
            <EmptyState
              icon={emptyStateConfigs.liabilities.icon}
              title={emptyStateConfigs.liabilities.title}
              description={emptyStateConfigs.liabilities.description}
              actionLabel={emptyStateConfigs.liabilities.actionLabel}
              onAction={addLiability}
              iconColor={emptyStateConfigs.liabilities.iconColor}
              iconBgColor={emptyStateConfigs.liabilities.iconBgColor}
              buttonColor={emptyStateConfigs.liabilities.buttonColor}
              buttonHoverColor={emptyStateConfigs.liabilities.buttonHoverColor}
            />
          ) : (
            liabilities.map((liability, index) => {
              const isEditing = liabilitiesInEditMode.has(liability.id);
              const isOtherType = liability.type === 'Other';
              let isValid: string | boolean | undefined = liability.type && liability.name && liability.provider;
              if (isOtherType) {
                isValid = isValid && liability.customType;
              }

              return (
                <React.Fragment key={liability.id}>
                  <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 transition-colors hover:border-gray-300">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-100">
                          <DollarSign className="h-5 w-5 text-red-600" />
                        </div>
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <p className="text-sm font-semibold text-gray-900">{liability.name || `Liability ${index + 1}`}</p>
                            <span className="text-xs text-gray-500">{getLiabilityTypeLabel(liability)}</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <DetailChip label="Outstanding" value={formatCurrency(liability.outstandingBalance || 0)} />
                            <DetailChip label="Monthly" value={formatCurrency(liability.monthlyPayment || 0)} />
                            <DetailChip label="Provider" value={liability.provider || 'Not set'} />
                            {liability.interestRate > 0 && <DetailChip label="Interest" value={`${liability.interestRate}%`} />}
                          </div>
                          {liability.description && (
                            <p className="text-xs leading-relaxed text-gray-500">{liability.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 self-end lg:self-start">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => editLiability(liability.id)}
                          className="border-[#6d28d9] text-[#6d28d9] hover:bg-[#6d28d9]/10"
                        >
                          <Edit2 className="mr-1 h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => confirmDeleteLiability(liability.id)}
                          className="border-red-200 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <Dialog open={isEditing} onOpenChange={(open) => !open && cancelEditLiability(liability.id)}>
                    <DialogContent className="sm:max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>{liability.name || `Liability ${index + 1}`}</DialogTitle>
                        <DialogDescription>Update the client's liability details without stretching the whole page.</DialogDescription>
                      </DialogHeader>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <Label htmlFor={`liability-type-${liability.id}`}>Liability Type *</Label>
                          <Select value={liability.type} onValueChange={(value) => updateLiability(liability.id, { type: value })}>
                            <SelectTrigger id={`liability-type-${liability.id}`} className="mt-1.5">
                              <SelectValue placeholder="Select liability type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Home Loan">Home Loan</SelectItem>
                              <SelectItem value="Vehicle Finance">Vehicle Finance</SelectItem>
                              <SelectItem value="Credit Card">Credit Card</SelectItem>
                              <SelectItem value="Personal Loan">Personal Loan</SelectItem>
                              <SelectItem value="Student Loan">Student Loan</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {isOtherType && (
                          <div className="sm:col-span-2">
                            <Label htmlFor={`custom-liability-type-${liability.id}`}>Custom Liability Type *</Label>
                            <Input
                              id={`custom-liability-type-${liability.id}`}
                              value={liability.customType || ''}
                              onChange={(e) => updateLiability(liability.id, { customType: e.target.value })}
                              placeholder="Specify custom liability type"
                              className="mt-1.5"
                            />
                          </div>
                        )}
                        <div className="sm:col-span-2">
                          <Label htmlFor={`liability-name-${liability.id}`}>Liability Name / Description *</Label>
                          <Input
                            id={`liability-name-${liability.id}`}
                            value={liability.name}
                            onChange={(e) => updateLiability(liability.id, { name: e.target.value })}
                            placeholder="Enter liability name"
                            className="mt-1.5"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <Label htmlFor={`liability-provider-${liability.id}`}>Provider / Bank *</Label>
                          <Input
                            id={`liability-provider-${liability.id}`}
                            value={liability.provider}
                            onChange={(e) => updateLiability(liability.id, { provider: e.target.value })}
                            placeholder="e.g., Standard Bank, ABSA"
                            className="mt-1.5"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`outstanding-${liability.id}`}>Outstanding Balance (R) *</Label>
                          <Input
                            id={`outstanding-${liability.id}`}
                            type="text"
                            value={liabilityDisplayValues[liability.id]?.amount !== undefined ? liabilityDisplayValues[liability.id].amount : (liability.outstandingBalance ? formatCurrencyInput(liability.outstandingBalance.toString()) : '')}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^0-9.]/g, '');
                              setLiabilityDisplayValues((prev) => ({
                                ...prev,
                                [liability.id]: {
                                  ...prev[liability.id],
                                  amount: raw,
                                },
                              }));
                              updateLiability(liability.id, { outstandingBalance: parseFloat(raw) || 0 });
                            }}
                            onBlur={() => {
                              setLiabilityDisplayValues((prev) => {
                                const nextValues = { ...prev };
                                if (nextValues[liability.id]) {
                                  delete nextValues[liability.id].amount;
                                  if (Object.keys(nextValues[liability.id]).length === 0) {
                                    delete nextValues[liability.id];
                                  }
                                }
                                return nextValues;
                              });
                            }}
                            onFocus={() => {
                              const currentDisplay = liabilityDisplayValues[liability.id]?.amount;
                              if (currentDisplay === undefined) {
                                setLiabilityDisplayValues((prev) => ({
                                  ...prev,
                                  [liability.id]: {
                                    ...prev[liability.id],
                                    amount: liability.outstandingBalance ? liability.outstandingBalance.toString() : '',
                                  },
                                }));
                              }
                            }}
                            placeholder="0.00"
                            className="mt-1.5"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`monthly-payment-${liability.id}`}>Monthly Repayment (R) *</Label>
                          <Input
                            id={`monthly-payment-${liability.id}`}
                            type="text"
                            value={liabilityDisplayValues[liability.id]?.monthlyPayment !== undefined ? liabilityDisplayValues[liability.id].monthlyPayment : (liability.monthlyPayment ? formatCurrencyInput(liability.monthlyPayment.toString()) : '')}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^0-9.]/g, '');
                              setLiabilityDisplayValues((prev) => ({
                                ...prev,
                                [liability.id]: {
                                  ...prev[liability.id],
                                  monthlyPayment: raw,
                                },
                              }));
                              updateLiability(liability.id, { monthlyPayment: parseFloat(raw) || 0 });
                            }}
                            onBlur={() => {
                              setLiabilityDisplayValues((prev) => {
                                const nextValues = { ...prev };
                                if (nextValues[liability.id]) {
                                  delete nextValues[liability.id].monthlyPayment;
                                  if (Object.keys(nextValues[liability.id]).length === 0) {
                                    delete nextValues[liability.id];
                                  }
                                }
                                return nextValues;
                              });
                            }}
                            onFocus={() => {
                              const currentDisplay = liabilityDisplayValues[liability.id]?.monthlyPayment;
                              if (currentDisplay === undefined) {
                                setLiabilityDisplayValues((prev) => ({
                                  ...prev,
                                  [liability.id]: {
                                    ...prev[liability.id],
                                    monthlyPayment: liability.monthlyPayment ? liability.monthlyPayment.toString() : '',
                                  },
                                }));
                              }
                            }}
                            placeholder="0.00"
                            className="mt-1.5"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`interest-rate-${liability.id}`}>Interest Rate (%)</Label>
                          <Input
                            id={`interest-rate-${liability.id}`}
                            type="number"
                            step="0.01"
                            value={liability.interestRate || ''}
                            onChange={(e) => updateLiability(liability.id, { interestRate: parseFloat(e.target.value) || 0 })}
                            placeholder="0.00"
                            className="mt-1.5"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <Label htmlFor={`liability-desc-${liability.id}`}>Additional Details</Label>
                          <Textarea
                            id={`liability-desc-${liability.id}`}
                            value={liability.description}
                            onChange={(e) => updateLiability(liability.id, { description: e.target.value })}
                            placeholder="Any additional information"
                            className="mt-1.5"
                            rows={3}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => cancelEditLiability(liability.id)}
                          className="border-gray-300 text-gray-700 hover:bg-gray-50"
                        >
                          <X className="mr-1 h-4 w-4" />
                          Cancel
                        </Button>
                        <Button
                          onClick={() => saveLiability(liability.id)}
                          disabled={!isValid}
                          className={!isValid ? 'cursor-not-allowed bg-gray-300 text-gray-500 hover:bg-gray-300' : 'bg-[#6d28d9] text-white hover:bg-[#5b21b6]'}
                        >
                          <Check className="mr-1 h-4 w-4" />
                          Save Liability
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </React.Fragment>
              );
            })
          )}
        </CardContent>
      </Card>

      {hasBalanceSheetData && (
        <Card className="border-[#6d28d9]/20 bg-gradient-to-br from-[#6d28d9]/5 via-white to-white shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#6d28d9]/10">
              <PieChart className="h-5 w-5 text-[#6d28d9]" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Net Worth Snapshot</p>
              <p className={`text-xl font-semibold ${netWorth >= 0 ? 'text-[#4c1d95]' : 'text-red-600'}`}>{formatCurrency(netWorth)}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={assetToDelete !== null} onOpenChange={(open) => !open && setAssetToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Asset</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this asset? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAssetToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={removeAsset} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={liabilityToDelete !== null} onOpenChange={(open) => !open && setLiabilityToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Liability</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this liability? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setLiabilityToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={removeLiability} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
