import React from 'react';
import type { ProfileData, Asset, Liability } from '../types';
import { EmptyState } from '../EmptyState';
import { emptyStateConfigs } from '../emptyStateConfigs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/card';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import { Button } from '../../../ui/button';
import { Textarea } from '../../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../ui/dialog';
import {
  formatCurrency,
  formatCurrencyInput,
  cleanCurrencyInput,
} from '../../../../utils/currencyFormatter';
import {
  TrendingUp,
  DollarSign,
  PieChart,
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  AlertTriangle,
  Scale,
  Wallet,
  Landmark,
} from 'lucide-react';
import {
  findPossiblePolicyAssetMatches,
  type DerivedPolicyAsset,
} from '../../../../utils/derivedPolicyAssets';
import { useInlineEditDialogClose } from '../../../shared/unsaved-changes';

interface AssetsLiabilitiesSectionProps {
  profileData: ProfileData;
  derivedPolicyAssets?: DerivedPolicyAsset[];
  linkedPolicyAssetsLoading?: boolean;
  linkedPolicyAssetsError?: string | null;
  assetsInEditMode: Set<string>;
  liabilitiesInEditMode: Set<string>;
  assetToDelete: string | null;
  setAssetToDelete: React.Dispatch<React.SetStateAction<string | null>>;
  liabilityToDelete: string | null;
  setLiabilityToDelete: React.Dispatch<React.SetStateAction<string | null>>;
  assetDisplayValues: { [id: string]: string };
  setAssetDisplayValues: React.Dispatch<React.SetStateAction<{ [id: string]: string }>>;
  liabilityDisplayValues: { [id: string]: { amount?: string; monthlyPayment?: string } };
  setLiabilityDisplayValues: React.Dispatch<
    React.SetStateAction<{ [id: string]: { amount?: string; monthlyPayment?: string } }>
  >;
  addAsset: () => void;
  updateAsset: (id: string, updates: Partial<Asset>) => void;
  saveAsset: (id: string) => void;
  editAsset: (id: string) => void;
  cancelEditAsset: (id: string) => void;
  confirmDeleteAsset: (id: string) => void;
  removeAsset: (id: string) => void;
  addLiability: () => void;
  updateLiability: (id: string, updates: Partial<Liability>) => void;
  saveLiability: (id: string) => void;
  editLiability: (id: string) => void;
  cancelEditLiability: (id: string) => void;
  confirmDeleteLiability: (id: string) => void;
  removeLiability: (id: string) => void;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
}

function SummaryMetric({
  label,
  value,
  helper,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  helper?: string;
  tone?: 'neutral' | 'positive' | 'negative' | 'accent';
}) {
  const toneClasses =
    tone === 'positive'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
      : tone === 'negative'
        ? 'border-red-200 bg-red-50 text-red-950'
        : tone === 'accent'
          ? 'border-[#6d28d9]/20 bg-[#6d28d9]/5 text-[#4c1d95]'
          : 'border-gray-200 bg-white text-gray-900';

  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneClasses}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-current/65">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold leading-tight text-current">{value}</p>
      {helper && <p className="mt-1 text-xs leading-snug text-current/65">{helper}</p>}
    </div>
  );
}

function DetailChip({ label, value }: { label: string; value: string }) {
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
  return liability.type === 'Other'
    ? liability.customType || 'Other'
    : liability.type || 'Liability';
}

export function AssetsLiabilitiesSection({
  profileData,
  derivedPolicyAssets = [],
  linkedPolicyAssetsLoading = false,
  linkedPolicyAssetsError = null,
  assetsInEditMode,
  liabilitiesInEditMode,
  assetToDelete,
  setAssetToDelete,
  liabilityToDelete,
  setLiabilityToDelete,
  assetDisplayValues,
  setAssetDisplayValues,
  liabilityDisplayValues,
  setLiabilityDisplayValues,
  addAsset,
  updateAsset,
  saveAsset,
  editAsset,
  cancelEditAsset,
  confirmDeleteAsset,
  removeAsset,
  addLiability,
  updateLiability,
  saveLiability,
  editLiability,
  cancelEditLiability,
  confirmDeleteLiability,
  removeLiability,
  totalAssets,
  totalLiabilities,
  netWorth,
}: AssetsLiabilitiesSectionProps) {
  const linkedPolicyAssetTotal = derivedPolicyAssets.reduce((sum, asset) => sum + asset.value, 0);
  const combinedAssets = totalAssets + linkedPolicyAssetTotal;
  const combinedNetWorth = combinedAssets - totalLiabilities;
  const possibleDuplicateMatches = findPossiblePolicyAssetMatches(
    profileData.assets,
    derivedPolicyAssets,
  );
  const possibleDuplicateCount = Object.keys(possibleDuplicateMatches).length;
  const hasBalanceSheetData =
    profileData.assets.length > 0 ||
    profileData.liabilities.length > 0 ||
    derivedPolicyAssets.length > 0;
  const netWorthIsNegative = combinedNetWorth < 0;

  const assetEditGuard = useInlineEditDialogClose({
    getItem: (id) => profileData.assets.find((asset) => asset.id === id),
    onCancelEdit: cancelEditAsset,
    itemLabel: 'this asset',
  });

  const liabilityEditGuard = useInlineEditDialogClose({
    getItem: (id) => profileData.liabilities.find((liability) => liability.id === id),
    onCancelEdit: cancelEditLiability,
    itemLabel: 'this liability',
  });

  return (
    <div className="space-y-5">
      {hasBalanceSheetData && (
        <Card className="overflow-hidden border-[#6d28d9]/20 shadow-sm">
          <CardContent className="p-0">
            <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1.95fr]">
              <div className="relative overflow-hidden bg-gradient-to-br from-[#22183f] via-[#31235d] to-[#6d28d9] p-6 text-white">
                <div className="absolute -right-12 -top-16 h-40 w-40 rounded-full bg-white/10" />
                <div className="absolute -bottom-20 left-8 h-44 w-44 rounded-full bg-white/5" />
                <div className="relative">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/12 ring-1 ring-white/15">
                    <Scale className="h-5 w-5" />
                  </div>
                  <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-white/65">
                    Balance Sheet Position
                  </p>
                  <p
                    className={`mt-2 text-3xl font-semibold leading-tight ${netWorthIsNegative ? 'text-red-200' : 'text-white'}`}
                  >
                    {formatCurrency(combinedNetWorth)}
                  </p>
                  <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/75">
                    Net worth is calculated from all captured assets, linked policy values, and
                    outstanding liabilities.
                  </p>
                  <div className="mt-5 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white/85">
                    <span className="font-semibold">{formatCurrency(combinedAssets)}</span> assets
                    <span className="mx-2 text-white/45">minus</span>
                    <span className="font-semibold">{formatCurrency(totalLiabilities)}</span>{' '}
                    liabilities
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 sm:p-6">
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-950">What is included</p>
                    <p className="mt-1 text-sm text-gray-500">
                      Manual entries remain editable here; policy-linked holdings are included
                      automatically.
                    </p>
                  </div>
                  {netWorthIsNegative && (
                    <div className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                      Negative net worth
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <SummaryMetric
                    label="Manual Assets"
                    value={formatCurrency(totalAssets)}
                    helper={`${profileData.assets.length} editable ${profileData.assets.length === 1 ? 'entry' : 'entries'}`}
                    tone="positive"
                  />
                  <SummaryMetric
                    label="Linked Policies"
                    value={formatCurrency(linkedPolicyAssetTotal)}
                    helper={`${derivedPolicyAssets.length} read-only ${derivedPolicyAssets.length === 1 ? 'holding' : 'holdings'}`}
                    tone="accent"
                  />
                  <SummaryMetric
                    label="Total Assets"
                    value={formatCurrency(combinedAssets)}
                    helper="Manual plus linked"
                    tone="positive"
                  />
                  <SummaryMetric
                    label="Liabilities"
                    value={formatCurrency(totalLiabilities)}
                    helper={`${profileData.liabilities.length} debt ${profileData.liabilities.length === 1 ? 'entry' : 'entries'}`}
                    tone="negative"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2 xl:items-start">
        <Card className="h-full border-gray-200 shadow-sm">
          <CardHeader className="border-b border-gray-100 bg-gradient-to-br from-emerald-50 via-white to-white pb-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100">
                  <Wallet className="h-5 w-5 text-emerald-700" />
                </div>
                <div>
                  <CardTitle className="text-xl">Assets</CardTitle>
                  <CardDescription>What you own and what is linked from policies</CardDescription>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                  Manual {formatCurrency(totalAssets)}
                </div>
                <div className="rounded-full bg-[#6d28d9]/10 px-3 py-1 text-xs font-semibold text-[#5b21b6]">
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
          <CardContent className="space-y-3 p-4">
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
                      Retirement and investment policies are shown here automatically so you do not
                      need to capture the same holdings again in your profile. These rows are
                      read-only and stay linked to your policy register.
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
                    <p className="text-sm font-semibold text-amber-950">
                      Possible duplicate assets detected
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-amber-900/80">
                      {possibleDuplicateCount} manual{' '}
                      {possibleDuplicateCount === 1 ? 'asset appears' : 'assets appear'} to overlap
                      with a linked retirement or investment policy. These are warnings only.
                      Nothing has been merged or deleted.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {profileData.assets.length === 0 ? (
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
                  are shown below without writing anything into your editable asset list.
                </div>
              )
            ) : (
              profileData.assets.map((asset, index) => {
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
                    <div className="rounded-2xl border border-gray-200 bg-white p-4 transition-colors hover:border-emerald-200 hover:bg-emerald-50/30">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100">
                            <TrendingUp className="h-5 w-5 text-emerald-700" />
                          </div>
                          <div className="min-w-0 space-y-2">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <p className="text-base font-semibold text-gray-950">
                                {asset.name || `Asset ${index + 1}`}
                              </p>
                              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                                {getAssetTypeLabel(asset)}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <DetailChip
                                label="Ownership"
                                value={asset.ownershipType || 'Not set'}
                              />
                              {asset.provider && (
                                <DetailChip label="Provider" value={asset.provider} />
                              )}
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
                                      <span className="text-amber-700/80">
                                        {match.policyNumber}
                                      </span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-3 self-end lg:self-start">
                          <div className="text-right">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700/70">
                              Value
                            </p>
                            <p className="text-lg font-semibold text-emerald-950">
                              {formatCurrency(asset.value || 0)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
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
                    </div>

                    <Dialog
                      open={isEditing}
                      onOpenChange={(open) => assetEditGuard.handleDialogOpenChange(asset.id, open)}
                    >
                      <DialogContent className="sm:max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>{asset.name || `Asset ${index + 1}`}</DialogTitle>
                          <DialogDescription>
                            Update the asset details without expanding the whole dashboard.
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
                                <SelectItem value="Retirement Savings">
                                  Retirement Savings
                                </SelectItem>
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
                                onChange={(e) =>
                                  updateAsset(asset.id, { customType: e.target.value })
                                }
                                placeholder="Specify custom asset type"
                                className="mt-1.5"
                              />
                            </div>
                          )}
                          <div className="sm:col-span-2">
                            <Label htmlFor={`asset-name-${asset.id}`}>
                              Asset Name / Description *
                            </Label>
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
                                const formattedDisplay = formatCurrencyInput(e.target.value);
                                setAssetDisplayValues((prev) => ({
                                  ...prev,
                                  [asset.id]: formattedDisplay,
                                }));
                                const cleanValue = cleanCurrencyInput(formattedDisplay);
                                updateAsset(asset.id, { value: parseFloat(cleanValue) || 0 });
                              }}
                              onBlur={() => {
                                setAssetDisplayValues((prev) => {
                                  const nextValues = { ...prev };
                                  delete nextValues[asset.id];
                                  return nextValues;
                                });
                              }}
                              placeholder="0.00"
                              className="mt-1.5"
                            />
                          </div>
                          <div>
                            <Label htmlFor={`ownership-${asset.id}`}>Ownership Type *</Label>
                            <Select
                              value={asset.ownershipType}
                              onValueChange={(value) =>
                                updateAsset(asset.id, { ownershipType: value })
                              }
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
                              onChange={(e) =>
                                updateAsset(asset.id, { description: e.target.value })
                              }
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
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Linked Policy Assets</p>
                    <p className="text-xs text-gray-500">
                      These policy-backed holdings are included automatically and cannot be edited
                      here.
                    </p>
                  </div>
                  <div className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                    {formatCurrency(linkedPolicyAssetTotal)}
                  </div>
                </div>

                {derivedPolicyAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className="rounded-2xl border border-[#6d28d9]/15 bg-gradient-to-r from-[#6d28d9]/5 via-white to-white p-4"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#6d28d9]/10">
                          <PieChart className="h-5 w-5 text-[#6d28d9]" />
                        </div>
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <p className="text-base font-semibold text-gray-950">
                              {asset.providerName}
                            </p>
                            <span className="rounded-full bg-[#6d28d9]/10 px-2 py-0.5 text-[11px] font-medium text-[#5b21b6]">
                              {asset.assetTypeLabel}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <DetailChip label="Product" value={asset.productType} />
                            <DetailChip label="Policy" value={asset.policyNumber} />
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2 self-start">
                        <div className="text-right">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6d28d9]/70">
                            Value
                          </p>
                          <p className="text-lg font-semibold text-[#4c1d95]">
                            {formatCurrency(asset.value)}
                          </p>
                        </div>
                        <div className="rounded-full border border-[#6d28d9]/20 bg-[#6d28d9]/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5b21b6]">
                          Linked
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="h-full border-gray-200 shadow-sm">
          <CardHeader className="border-b border-gray-100 bg-gradient-to-br from-red-50 via-white to-white pb-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-100">
                  <Landmark className="h-5 w-5 text-red-700" />
                </div>
                <div>
                  <CardTitle className="text-xl">Liabilities</CardTitle>
                  <CardDescription>
                    What you owe and the monthly pressure it creates
                  </CardDescription>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">
                  {formatCurrency(totalLiabilities)}
                </div>
                <Button
                  onClick={addLiability}
                  size="sm"
                  disabled={liabilitiesInEditMode.size > 0}
                  className="bg-[#6d28d9] hover:bg-[#5b21b6] disabled:cursor-not-allowed disabled:opacity-50"
                  title={
                    liabilitiesInEditMode.size > 0
                      ? 'Please save the current liability before adding a new one'
                      : 'Add a new liability'
                  }
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add Liability
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            {profileData.liabilities.length === 0 ? (
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
              profileData.liabilities.map((liability, index) => {
                const isEditing = liabilitiesInEditMode.has(liability.id);
                const isOtherType = liability.type === 'Other';
                let isValid: string | boolean | undefined =
                  liability.type && liability.name && liability.provider;
                if (isOtherType) {
                  isValid = isValid && liability.customType;
                }

                return (
                  <React.Fragment key={liability.id}>
                    <div className="rounded-2xl border border-gray-200 bg-white p-4 transition-colors hover:border-red-200 hover:bg-red-50/25">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-100">
                            <DollarSign className="h-5 w-5 text-red-700" />
                          </div>
                          <div className="min-w-0 space-y-2">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <p className="text-base font-semibold text-gray-950">
                                {liability.name || `Liability ${index + 1}`}
                              </p>
                              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                                {getLiabilityTypeLabel(liability)}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <DetailChip
                                label="Monthly"
                                value={formatCurrency(liability.monthlyPayment || 0)}
                              />
                              <DetailChip
                                label="Provider"
                                value={liability.provider || 'Not set'}
                              />
                              {liability.interestRate > 0 && (
                                <DetailChip label="Interest" value={`${liability.interestRate}%`} />
                              )}
                            </div>
                            {liability.description && (
                              <p className="text-xs leading-relaxed text-gray-500">
                                {liability.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-3 self-end lg:self-start">
                          <div className="text-right">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-red-700/70">
                              Outstanding
                            </p>
                            <p className="text-lg font-semibold text-red-950">
                              {formatCurrency(liability.outstandingBalance || 0)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                liabilityEditGuard.trackEditStart(liability.id);
                                editLiability(liability.id);
                              }}
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
                    </div>

                    <Dialog
                      open={isEditing}
                      onOpenChange={(open) =>
                        liabilityEditGuard.handleDialogOpenChange(liability.id, open)
                      }
                    >
                      <DialogContent className="sm:max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>{liability.name || `Liability ${index + 1}`}</DialogTitle>
                          <DialogDescription>
                            Update the liability details without stretching the page.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div className="sm:col-span-2">
                            <Label htmlFor={`liability-type-${liability.id}`}>
                              Liability Type *
                            </Label>
                            <Select
                              value={liability.type}
                              onValueChange={(value) =>
                                updateLiability(liability.id, { type: value })
                              }
                            >
                              <SelectTrigger
                                id={`liability-type-${liability.id}`}
                                className="mt-1.5"
                              >
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
                              <Label htmlFor={`custom-liability-type-${liability.id}`}>
                                Custom Liability Type *
                              </Label>
                              <Input
                                id={`custom-liability-type-${liability.id}`}
                                value={liability.customType || ''}
                                onChange={(e) =>
                                  updateLiability(liability.id, { customType: e.target.value })
                                }
                                placeholder="Specify custom liability type"
                                className="mt-1.5"
                              />
                            </div>
                          )}
                          <div className="sm:col-span-2">
                            <Label htmlFor={`liability-name-${liability.id}`}>
                              Liability Name / Description *
                            </Label>
                            <Input
                              id={`liability-name-${liability.id}`}
                              value={liability.name}
                              onChange={(e) =>
                                updateLiability(liability.id, { name: e.target.value })
                              }
                              placeholder="Enter liability name"
                              className="mt-1.5"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <Label htmlFor={`liability-provider-${liability.id}`}>
                              Provider / Bank *
                            </Label>
                            <Input
                              id={`liability-provider-${liability.id}`}
                              value={liability.provider}
                              onChange={(e) =>
                                updateLiability(liability.id, { provider: e.target.value })
                              }
                              placeholder="e.g., Standard Bank, ABSA"
                              className="mt-1.5"
                            />
                          </div>
                          <div>
                            <Label htmlFor={`outstanding-${liability.id}`}>
                              Outstanding Balance (R) *
                            </Label>
                            <Input
                              id={`outstanding-${liability.id}`}
                              type="text"
                              value={
                                liabilityDisplayValues[liability.id]?.amount !== undefined
                                  ? liabilityDisplayValues[liability.id].amount
                                  : liability.outstandingBalance
                                    ? formatCurrencyInput(liability.outstandingBalance.toString())
                                    : ''
                              }
                              onChange={(e) => {
                                const formattedDisplay = formatCurrencyInput(e.target.value);
                                setLiabilityDisplayValues((prev) => ({
                                  ...prev,
                                  [liability.id]: {
                                    ...prev[liability.id],
                                    amount: formattedDisplay,
                                  },
                                }));
                                const cleanValue = cleanCurrencyInput(formattedDisplay);
                                updateLiability(liability.id, {
                                  outstandingBalance: parseFloat(cleanValue) || 0,
                                });
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
                              placeholder="0.00"
                              className="mt-1.5"
                            />
                          </div>
                          <div>
                            <Label htmlFor={`monthly-payment-${liability.id}`}>
                              Monthly Repayment (R) *
                            </Label>
                            <Input
                              id={`monthly-payment-${liability.id}`}
                              type="text"
                              value={
                                liabilityDisplayValues[liability.id]?.monthlyPayment !== undefined
                                  ? liabilityDisplayValues[liability.id].monthlyPayment
                                  : liability.monthlyPayment
                                    ? formatCurrencyInput(liability.monthlyPayment.toString())
                                    : ''
                              }
                              onChange={(e) => {
                                const formattedDisplay = formatCurrencyInput(e.target.value);
                                setLiabilityDisplayValues((prev) => ({
                                  ...prev,
                                  [liability.id]: {
                                    ...prev[liability.id],
                                    monthlyPayment: formattedDisplay,
                                  },
                                }));
                                const cleanValue = cleanCurrencyInput(formattedDisplay);
                                updateLiability(liability.id, {
                                  monthlyPayment: parseFloat(cleanValue) || 0,
                                });
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
                              placeholder="0.00"
                              className="mt-1.5"
                            />
                          </div>
                          <div>
                            <Label htmlFor={`interest-rate-${liability.id}`}>
                              Interest Rate (%)
                            </Label>
                            <Input
                              id={`interest-rate-${liability.id}`}
                              type="number"
                              step="0.01"
                              value={liability.interestRate || ''}
                              onChange={(e) =>
                                updateLiability(liability.id, {
                                  interestRate: parseFloat(e.target.value) || 0,
                                })
                              }
                              placeholder="0.00"
                              className="mt-1.5"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <Label htmlFor={`liability-desc-${liability.id}`}>
                              Additional Details
                            </Label>
                            <Textarea
                              id={`liability-desc-${liability.id}`}
                              value={liability.description}
                              onChange={(e) =>
                                updateLiability(liability.id, { description: e.target.value })
                              }
                              placeholder="Any additional information"
                              className="mt-1.5"
                              rows={3}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={() =>
                              liabilityEditGuard.handleDialogOpenChange(liability.id, false)
                            }
                            className="border-gray-300 text-gray-700 hover:bg-gray-50"
                          >
                            <X className="mr-1 h-4 w-4" />
                            Cancel
                          </Button>
                          <Button
                            onClick={() => {
                              liabilityEditGuard.clearSnapshot(liability.id);
                              saveLiability(liability.id);
                            }}
                            disabled={!isValid}
                            className={
                              !isValid
                                ? 'cursor-not-allowed bg-gray-300 text-gray-500 hover:bg-gray-300'
                                : 'bg-[#6d28d9] text-white hover:bg-[#5b21b6]'
                            }
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
      </div>

      <AlertDialog
        open={assetToDelete !== null}
        onOpenChange={(open) => !open && setAssetToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Asset</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this asset? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAssetToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => assetToDelete && removeAsset(assetToDelete)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={liabilityToDelete !== null}
        onOpenChange={(open) => !open && setLiabilityToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Liability</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this liability? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setLiabilityToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => liabilityToDelete && removeLiability(liabilityToDelete)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {assetEditGuard.confirmDialog}
      {liabilityEditGuard.confirmDialog}
    </div>
  );
}
