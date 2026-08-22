/**
 * Liabilities.
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
import { ProfileData, Liability } from '../../types';

interface Deps {
  liabilityToDelete: string | null;
  profileData: ProfileData;
  setHasChanges: Dispatch<SetStateAction<boolean>>;
  setLiabilitiesInEditMode: Dispatch<SetStateAction<Set<string>>>;
  setLiabilityDisplayValues: Dispatch<
    SetStateAction<{ [id: string]: { amount?: string; monthlyPayment?: string } }>
  >;
  setLiabilityToDelete: Dispatch<SetStateAction<string | null>>;
  setProfileData: Dispatch<SetStateAction<ProfileData>>;
}

export function createLiabilityHandlers({
  liabilityToDelete,
  profileData,
  setHasChanges,
  setLiabilitiesInEditMode,
  setLiabilityDisplayValues,
  setLiabilityToDelete,
  setProfileData,
}: Deps) {
  const addLiability = () => {
    const newLiability: Liability = {
      id: Date.now().toString(),
      type: '',
      name: '',
      description: '',
      provider: '',
      outstandingBalance: 0,
      monthlyPayment: 0,
      interestRate: 0,
    };
    setProfileData((prev) => ({
      ...prev,
      liabilities: [...prev.liabilities, newLiability],
    }));
    setLiabilitiesInEditMode((prev) => new Set([...prev, newLiability.id]));
    setHasChanges(true);
  };

  const confirmDeleteLiability = (id: string) => {
    setLiabilityToDelete(id);
  };

  const removeLiability = () => {
    if (!liabilityToDelete) return;
    setProfileData((prev) => ({
      ...prev,
      liabilities: prev.liabilities.filter((liability) => liability.id !== liabilityToDelete),
    }));
    setLiabilitiesInEditMode((prev) => {
      const newSet = new Set(prev);
      newSet.delete(liabilityToDelete);
      return newSet;
    });
    setLiabilityDisplayValues((prev) => {
      const newState = { ...prev };
      delete newState[liabilityToDelete];
      return newState;
    });
    setLiabilityToDelete(null);
    setHasChanges(true);
  };

  const updateLiability = (id: string, updates: Partial<Liability>) => {
    setProfileData((prev) => ({
      ...prev,
      liabilities: prev.liabilities.map((liability) =>
        liability.id === id ? { ...liability, ...updates } : liability,
      ),
    }));
    setHasChanges(true);
  };

  const saveLiability = (id: string) => {
    const liability = profileData.liabilities.find((l) => l.id === id);

    if (!liability?.type || !liability?.name || !liability?.provider) {
      toast.error(
        'Please fill in all required fields (Liability Type, Liability Name, and Provider) before saving',
      );
      return;
    }

    if (liability.type === 'Other' && !liability.customType) {
      toast.error('For "Other" liability types, please specify the custom liability type');
      return;
    }

    setLiabilitiesInEditMode((prev) => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
    setLiabilityDisplayValues((prev) => {
      const newState = { ...prev };
      delete newState[id];
      return newState;
    });
  };

  const editLiability = (id: string) => {
    setLiabilitiesInEditMode((prev) => new Set([...prev, id]));
  };

  const cancelEditLiability = (id: string) => {
    const liability = profileData.liabilities.find((l) => l.id === id);

    if (liability && !liability.type && !liability.name && !liability.provider) {
      setProfileData((prev) => ({
        ...prev,
        liabilities: prev.liabilities.filter((l) => l.id !== id),
      }));
      setLiabilitiesInEditMode((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      setLiabilityDisplayValues((prev) => {
        const newState = { ...prev };
        delete newState[id];
        return newState;
      });
      return;
    }

    setLiabilitiesInEditMode((prev) => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });

    setLiabilityDisplayValues((prev) => {
      const newState = { ...prev };
      delete newState[id];
      return newState;
    });
  };

  return {
    addLiability,
    confirmDeleteLiability,
    removeLiability,
    updateLiability,
    saveLiability,
    editLiability,
    cancelEditLiability,
  };
}
