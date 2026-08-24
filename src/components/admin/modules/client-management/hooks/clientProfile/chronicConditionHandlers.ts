/**
 * Chronic conditions.
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
import { ProfileData, ChronicCondition } from '../../types';

interface Deps {
  chronicConditionToDelete: string | null;
  profileData: ProfileData;
  setChronicConditionToDelete: Dispatch<SetStateAction<string | null>>;
  setChronicConditionsInEditMode: Dispatch<SetStateAction<Set<string>>>;
  setHasChanges: Dispatch<SetStateAction<boolean>>;
  setProfileData: Dispatch<SetStateAction<ProfileData>>;
}

export function createChronicConditionHandlers({
  chronicConditionToDelete,
  profileData,
  setChronicConditionToDelete,
  setChronicConditionsInEditMode,
  setHasChanges,
  setProfileData,
}: Deps) {
  const addChronicCondition = () => {
    const newCondition: ChronicCondition = {
      id: Date.now().toString(),
      conditionName: '',
      monthDiagnosed: '',
      yearDiagnosed: '',
      onTreatment: false,
      treatingDoctor: '',
    };
    setProfileData((prev) => ({
      ...prev,
      chronicConditions: [...prev.chronicConditions, newCondition],
    }));
    setChronicConditionsInEditMode((prev) => new Set([...prev, newCondition.id]));
    setHasChanges(true);
  };

  const confirmDeleteChronicCondition = (id: string) => {
    setChronicConditionToDelete(id);
  };

  const removeChronicCondition = () => {
    if (!chronicConditionToDelete) return;
    setProfileData((prev) => ({
      ...prev,
      chronicConditions: prev.chronicConditions.filter(
        (condition) => condition.id !== chronicConditionToDelete,
      ),
    }));
    setChronicConditionsInEditMode((prev) => {
      const newSet = new Set(prev);
      newSet.delete(chronicConditionToDelete);
      return newSet;
    });
    setChronicConditionToDelete(null);
    setHasChanges(true);
  };

  const updateChronicCondition = (id: string, updates: Partial<ChronicCondition>) => {
    setProfileData((prev) => ({
      ...prev,
      chronicConditions: prev.chronicConditions.map((condition) =>
        condition.id === id ? { ...condition, ...updates } : condition,
      ),
    }));
    setHasChanges(true);
  };

  const saveChronicCondition = (id: string) => {
    const condition = profileData.chronicConditions.find((c) => c.id === id);

    if (!condition?.conditionName) {
      toast.error('Please enter the name of the condition before saving');
      return;
    }

    setChronicConditionsInEditMode((prev) => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const editChronicCondition = (id: string) => {
    setChronicConditionsInEditMode((prev) => new Set([...prev, id]));
  };

  const cancelEditChronicCondition = (id: string) => {
    const condition = profileData.chronicConditions.find((c) => c.id === id);

    if (condition && !condition.conditionName) {
      setProfileData((prev) => ({
        ...prev,
        chronicConditions: prev.chronicConditions.filter((c) => c.id !== id),
      }));
      setChronicConditionsInEditMode((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      return;
    }

    setChronicConditionsInEditMode((prev) => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  return {
    addChronicCondition,
    confirmDeleteChronicCondition,
    removeChronicCondition,
    updateChronicCondition,
    saveChronicCondition,
    editChronicCondition,
    cancelEditChronicCondition,
  };
}
