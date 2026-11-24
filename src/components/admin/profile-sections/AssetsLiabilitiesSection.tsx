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
  findPossiblePolicyAssetMatches,
  type DerivedPolicyAsset,
} from '../../../utils/derivedPolicyAssets';
import { useInlineEditDialogClose } from '../../shared/unsaved-changes';

import { NetWorthStrip } from './assetsLiabilitiesShared';
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
  /** Opens the client's Policy details tab from a policy row. */
  onOpenPolicies?: () => void;
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
  onOpenPolicies,
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
  const assetCount = assets.length + derivedPolicyAssets.length;
  const assetsMeta =
    `${assetCount} ${assetCount === 1 ? 'asset' : 'assets'}` +
    (derivedPolicyAssets.length > 0 ? `, ${derivedPolicyAssets.length} from policies` : '');
  const liabilitiesMeta =
    liabilities.length === 0
      ? 'None added'
      : `${liabilities.length} ${liabilities.length === 1 ? 'liability' : 'liabilities'}`;
  const hasBalanceSheetData =
    assets.length > 0 || liabilities.length > 0 || derivedPolicyAssets.length > 0;

  const assetToDeleteName =
    assets.find((asset) => asset.id === assetToDelete)?.name || 'this asset';
  const liabilityToDeleteName =
    liabilities.find((liability) => liability.id === liabilityToDelete)?.name || 'this liability';

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
        <NetWorthStrip
          assets={formatCurrency(combinedAssets)}
          assetsMeta={assetsMeta}
          liabilities={formatCurrency(totalLiabilities)}
          liabilitiesMeta={liabilitiesMeta}
          netWorth={formatCurrency(netWorth)}
          netWorthNegative={netWorth < 0}
        />
      )}

      <AssetsPanel
        assets={assets}
        derivedPolicyAssets={derivedPolicyAssets}
        linkedPolicyAssetsLoading={linkedPolicyAssetsLoading}
        linkedPolicyAssetsError={linkedPolicyAssetsError}
        possibleDuplicateMatches={possibleDuplicateMatches}
        possibleDuplicateCount={possibleDuplicateCount}
        combinedAssets={combinedAssets}
        assetsInEditMode={assetsInEditMode}
        assetEditGuard={assetEditGuard}
        formatCurrency={formatCurrency}
        addAsset={addAsset}
        updateAsset={updateAsset}
        saveAsset={saveAsset}
        editAsset={editAsset}
        confirmDeleteAsset={confirmDeleteAsset}
        onOpenPolicies={onOpenPolicies}
      />

      <LiabilitiesPanel
        liabilities={liabilities}
        totalLiabilities={totalLiabilities}
        liabilitiesInEditMode={liabilitiesInEditMode}
        liabilityEditGuard={liabilityEditGuard}
        formatCurrency={formatCurrency}
        addLiability={addLiability}
        updateLiability={updateLiability}
        saveLiability={saveLiability}
        editLiability={editLiability}
        confirmDeleteLiability={confirmDeleteLiability}
      />

      <AlertDialog
        open={assetToDelete !== null}
        onOpenChange={(open) => !open && setAssetToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {assetToDeleteName}?</AlertDialogTitle>
            <AlertDialogDescription>
              It comes off this client's assets and net worth. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAssetToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={removeAsset} className="bg-red-600 hover:bg-red-700">
              Delete asset
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
            <AlertDialogTitle>Delete {liabilityToDeleteName}?</AlertDialogTitle>
            <AlertDialogDescription>
              It comes off this client's liabilities and net worth. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setLiabilityToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={removeLiability} className="bg-red-600 hover:bg-red-700">
              Delete liability
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {assetEditGuard.confirmDialog}
      {liabilityEditGuard.confirmDialog}
    </div>
  );
}
