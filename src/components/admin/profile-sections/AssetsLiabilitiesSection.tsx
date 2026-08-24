import React from 'react';
import { Card, CardContent } from '../../ui/card';
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
import { PieChart } from 'lucide-react';
import {
  findPossiblePolicyAssetMatches,
  type DerivedPolicyAsset,
} from '../../../utils/derivedPolicyAssets';
import { useInlineEditDialogClose } from '../../shared/unsaved-changes';

import { SummaryMetric } from './assetsLiabilitiesShared';
import { AssetsPanel } from './AssetsPanel';
import { LiabilitiesPanel } from './LiabilitiesPanel';
import type { Asset, Liability } from '../../../shared/types';

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
  setLiabilityDisplayValues: (
    value: React.SetStateAction<Record<string, { amount?: string; monthlyPayment?: string }>>,
  ) => void;
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
}: AssetsLiabilitiesSectionProps) {
  const totalAssets = assets.reduce((sum, asset) => sum + (asset.value || 0), 0);
  const linkedPolicyAssetTotal = derivedPolicyAssets.reduce((sum, asset) => sum + asset.value, 0);
  const combinedAssets = totalAssets + linkedPolicyAssetTotal;
  const totalLiabilities = liabilities.reduce(
    (sum, liability) => sum + (liability.outstandingBalance || 0),
    0,
  );
  const netWorth = combinedAssets - totalLiabilities;
  const possibleDuplicateMatches = findPossiblePolicyAssetMatches(assets, derivedPolicyAssets);
  const possibleDuplicateCount = Object.keys(possibleDuplicateMatches).length;
  const hasBalanceSheetData =
    assets.length > 0 || liabilities.length > 0 || derivedPolicyAssets.length > 0;

  const assetEditGuard = useInlineEditDialogClose({
    getItem: (id) => assets.find((asset) => asset.id === id),
    onCancelEdit: cancelEditAsset,
    itemLabel: 'this asset',
  });

  const liabilityEditGuard = useInlineEditDialogClose({
    getItem: (id) => liabilities.find((liability) => liability.id === id),
    onCancelEdit: cancelEditLiability,
    itemLabel: 'this liability',
  });

  return (
    <div className="space-y-5">
      {hasBalanceSheetData && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryMetric
            label="Manual Assets"
            value={formatCurrency(totalAssets)}
            tone="positive"
          />
          <SummaryMetric
            label="Linked Policy Assets"
            value={formatCurrency(linkedPolicyAssetTotal)}
            tone="accent"
          />
          <SummaryMetric
            label="Combined Assets"
            value={formatCurrency(combinedAssets)}
            tone="positive"
          />
          <SummaryMetric
            label="Total Liabilities"
            value={formatCurrency(totalLiabilities)}
            tone="negative"
          />
          <SummaryMetric label="Net Worth" value={formatCurrency(netWorth)} tone="accent" />
        </div>
      )}

      <AssetsPanel
        assets={assets}
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
        formatCurrency={formatCurrency}
        formatCurrencyInput={formatCurrencyInput}
        addAsset={addAsset}
        updateAsset={updateAsset}
        saveAsset={saveAsset}
        editAsset={editAsset}
        confirmDeleteAsset={confirmDeleteAsset}
      />

      <LiabilitiesPanel
        liabilities={liabilities}
        totalLiabilities={totalLiabilities}
        liabilitiesInEditMode={liabilitiesInEditMode}
        liabilityDisplayValues={liabilityDisplayValues}
        setLiabilityDisplayValues={setLiabilityDisplayValues}
        liabilityEditGuard={liabilityEditGuard}
        formatCurrency={formatCurrency}
        formatCurrencyInput={formatCurrencyInput}
        addLiability={addLiability}
        updateLiability={updateLiability}
        saveLiability={saveLiability}
        editLiability={editLiability}
        confirmDeleteLiability={confirmDeleteLiability}
      />

      {hasBalanceSheetData && (
        <Card className="border-[#6d28d9]/20 bg-gradient-to-br from-[#6d28d9]/5 via-white to-white shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#6d28d9]/10">
              <PieChart className="h-5 w-5 text-[#6d28d9]" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Net Worth Snapshot</p>
              <p
                className={`text-xl font-semibold ${netWorth >= 0 ? 'text-[#4c1d95]' : 'text-red-600'}`}
              >
                {formatCurrency(netWorth)}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

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
            <AlertDialogAction onClick={removeAsset} className="bg-red-600 hover:bg-red-700">
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
            <AlertDialogAction onClick={removeLiability} className="bg-red-600 hover:bg-red-700">
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
