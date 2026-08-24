/**
 * Assets.
 *
 * Split out of `useClientProfile.ts` (1,523 lines), where nine collection
 * editors shared one hook body. These are plain functions over the profile
 * state, not hooks — the region contains no `useState`, `useCallback` or
 * `useEffect`, which is what makes moving it out of the hook body legal.
 *
 * The hook still owns the state; this owns the operations on one slice of it.
 */
import type { Dispatch, SetStateAction } from 'react';
import { toast } from 'sonner';
import { ProfileData, Asset } from '../../types';

interface Deps {
  assetToDelete: string | null;
  profileData: ProfileData;
  setAssetDisplayValues: Dispatch<SetStateAction<{ [id: string]: string }>>;
  setAssetToDelete: Dispatch<SetStateAction<string | null>>;
  setAssetsInEditMode: Dispatch<SetStateAction<Set<string>>>;
  setHasChanges: Dispatch<SetStateAction<boolean>>;
  setProfileData: Dispatch<SetStateAction<ProfileData>>;
}

export function createAssetHandlers({
  assetToDelete,
  profileData,
  setAssetDisplayValues,
  setAssetToDelete,
  setAssetsInEditMode,
  setHasChanges,
  setProfileData,
}: Deps) {
  const addAsset = () => {
    const newAsset: Asset = {
      id: Date.now().toString(),
      type: '',
      name: '',
      description: '',
      value: 0,
      ownershipType: '',
      provider: '',
    };
    setProfileData((prev) => ({
      ...prev,
      assets: [...prev.assets, newAsset],
    }));
    setAssetsInEditMode((prev) => new Set([...prev, newAsset.id]));
    setHasChanges(true);
  };

  const confirmDeleteAsset = (id: string) => {
    setAssetToDelete(id);
  };

  const removeAsset = () => {
    if (!assetToDelete) return;
    setProfileData((prev) => ({
      ...prev,
      assets: prev.assets.filter((asset) => asset.id !== assetToDelete),
    }));
    setAssetsInEditMode((prev) => {
      const newSet = new Set(prev);
      newSet.delete(assetToDelete);
      return newSet;
    });
    setAssetDisplayValues((prev) => {
      const newState = { ...prev };
      delete newState[assetToDelete];
      return newState;
    });
    setAssetToDelete(null);
    setHasChanges(true);
  };

  const updateAsset = (id: string, updates: Partial<Asset>) => {
    setProfileData((prev) => ({
      ...prev,
      assets: prev.assets.map((asset) => (asset.id === id ? { ...asset, ...updates } : asset)),
    }));
    setHasChanges(true);
  };

  const saveAsset = (id: string) => {
    const asset = profileData.assets.find((a) => a.id === id);

    if (!asset?.type || !asset?.name || !asset?.ownershipType) {
      toast.error(
        'Please fill in all required fields (Asset Type, Asset Name, and Ownership Type) before saving',
      );
      return;
    }

    if (asset.type === 'Other' && !asset.customType) {
      toast.error('For "Other" asset types, please specify the custom asset type');
      return;
    }

    setAssetsInEditMode((prev) => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
    setAssetDisplayValues((prev) => {
      const newState = { ...prev };
      delete newState[id];
      return newState;
    });
  };

  const editAsset = (id: string) => {
    setAssetsInEditMode((prev) => new Set([...prev, id]));
  };

  const cancelEditAsset = (id: string) => {
    const asset = profileData.assets.find((a) => a.id === id);

    if (asset && !asset.type && !asset.name && !asset.ownershipType) {
      setProfileData((prev) => ({
        ...prev,
        assets: prev.assets.filter((a) => a.id !== id),
      }));
      setAssetsInEditMode((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      setAssetDisplayValues((prev) => {
        const newState = { ...prev };
        delete newState[id];
        return newState;
      });
      return;
    }

    setAssetsInEditMode((prev) => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });

    setAssetDisplayValues((prev) => {
      const newState = { ...prev };
      delete newState[id];
      return newState;
    });
  };

  return {
    addAsset,
    confirmDeleteAsset,
    removeAsset,
    updateAsset,
    saveAsset,
    editAsset,
    cancelEditAsset,
  };
}
