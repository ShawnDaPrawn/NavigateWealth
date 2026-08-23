import React from 'react';
import type { ProfileData, Asset, Liability } from '../types';
import { Card, CardContent } from '../../../ui/card';
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
import { formatCurrency } from '../../../../utils/currencyFormatter';
import { Scale } from 'lucide-react';
import {
  findPossiblePolicyAssetMatches,
  type DerivedPolicyAsset,
} from '../../../../utils/derivedPolicyAssets';
import { useInlineEditDialogClose } from '../../../shared/unsaved-changes';

import { SummaryMetric } from './assetsLiabilitiesShared';
import { AssetsPanel } from './AssetsPanel';
import { LiabilitiesPanel } from './LiabilitiesPanel';

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
        <AssetsPanel
          profileData={profileData}
          derivedPolicyAssets={derivedPolicyAssets}
          linkedPolicyAssetsLoading={linkedPolicyAssetsLoading}
          linkedPolicyAssetsError={linkedPolicyAssetsError}
          linkedPolicyAssetTotal={linkedPolicyAssetTotal}
          possibleDuplicateMatches={possibleDuplicateMatches}
          possibleDuplicateCount={possibleDuplicateCount}
          totalAssets={totalAssets}
          assetsInEditMode={assetsInEditMode}
          assetDisplayValues={assetDisplayValues}
          setAssetDisplayValues={setAssetDisplayValues}
          assetEditGuard={assetEditGuard}
          addAsset={addAsset}
          updateAsset={updateAsset}
          saveAsset={saveAsset}
          editAsset={editAsset}
          confirmDeleteAsset={confirmDeleteAsset}
        />

        <LiabilitiesPanel
          profileData={profileData}
          totalLiabilities={totalLiabilities}
          liabilitiesInEditMode={liabilitiesInEditMode}
          liabilityDisplayValues={liabilityDisplayValues}
          setLiabilityDisplayValues={setLiabilityDisplayValues}
          liabilityEditGuard={liabilityEditGuard}
          addLiability={addLiability}
          updateLiability={updateLiability}
          saveLiability={saveLiability}
          editLiability={editLiability}
          confirmDeleteLiability={confirmDeleteLiability}
        />
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
