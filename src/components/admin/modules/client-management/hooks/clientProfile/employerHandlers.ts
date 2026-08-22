/**
 * Employers and self-employment.
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
import { ProfileData, Employer } from '../../types';

interface Deps {
  employerToDelete: string | null;
  profileData: ProfileData;
  setEmployerToDelete: Dispatch<SetStateAction<string | null>>;
  setEmployersInEditMode: Dispatch<SetStateAction<Set<string>>>;
  setHasChanges: Dispatch<SetStateAction<boolean>>;
  setProfileData: Dispatch<SetStateAction<ProfileData>>;
  setSelfEmployedInEditMode: Dispatch<SetStateAction<boolean>>;
}

export function createEmployerHandlers({
  employerToDelete,
  profileData,
  setEmployerToDelete,
  setEmployersInEditMode,
  setHasChanges,
  setProfileData,
  setSelfEmployedInEditMode,
}: Deps) {
  const addEmployer = () => {
    const newEmployer: Employer = {
      id: Date.now().toString(),
      jobTitle: '',
      employerName: '',
      industry: '',
    };
    setProfileData((prev) => ({
      ...prev,
      employers: [...prev.employers, newEmployer],
    }));
    setEmployersInEditMode((prev) => new Set([...prev, newEmployer.id]));
    setHasChanges(true);
  };

  const confirmDeleteEmployer = (id: string) => {
    setEmployerToDelete(id);
  };

  const removeEmployer = () => {
    if (!employerToDelete) return;
    setProfileData((prev) => ({
      ...prev,
      employers: prev.employers.filter((employer) => employer.id !== employerToDelete),
    }));
    setEmployersInEditMode((prev) => {
      const newSet = new Set(prev);
      newSet.delete(employerToDelete);
      return newSet;
    });
    setEmployerToDelete(null);
    setHasChanges(true);
  };

  const updateEmployer = (id: string, updates: Partial<Employer>) => {
    setProfileData((prev) => ({
      ...prev,
      employers: prev.employers.map((employer) =>
        employer.id === id ? { ...employer, ...updates } : employer,
      ),
    }));
    setHasChanges(true);
  };

  const saveEmployer = (id: string) => {
    const employer = profileData.employers.find((e) => e.id === id);

    if (!employer?.employerName || !employer?.jobTitle || !employer?.industry) {
      toast.error(
        'Please fill in all required fields (Employer Name, Job Title, and Industry) before saving',
      );
      return;
    }

    setEmployersInEditMode((prev) => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const editEmployer = (id: string) => {
    setEmployersInEditMode((prev) => new Set([...prev, id]));
  };

  const cancelEditEmployer = (id: string) => {
    const employer = profileData.employers.find((e) => e.id === id);

    if (employer && !employer.employerName && !employer.jobTitle && !employer.industry) {
      setProfileData((prev) => ({
        ...prev,
        employers: prev.employers.filter((e) => e.id !== id),
      }));
      setEmployersInEditMode((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      return;
    }

    setEmployersInEditMode((prev) => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const saveSelfEmployed = () => {
    if (!profileData.selfEmployedIndustry || !profileData.selfEmployedDescription) {
      toast.error(
        'Please fill in all required fields (Industry and Business Description) before saving',
      );
      return;
    }
    setSelfEmployedInEditMode(false);
  };

  const cancelEditSelfEmployed = () => {
    setSelfEmployedInEditMode(false);
  };

  const editSelfEmployed = () => {
    setSelfEmployedInEditMode(true);
  };

  return {
    addEmployer,
    confirmDeleteEmployer,
    removeEmployer,
    updateEmployer,
    saveEmployer,
    editEmployer,
    cancelEditEmployer,
    saveSelfEmployed,
    cancelEditSelfEmployed,
    editSelfEmployed,
  };
}
