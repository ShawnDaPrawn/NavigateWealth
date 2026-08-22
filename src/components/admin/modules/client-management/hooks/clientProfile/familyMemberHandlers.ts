/**
 * Family members and dependants.
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
import { ProfileData, FamilyMember } from '../../types';

interface Deps {
  familyMemberToDelete: string | null;
  profileData: ProfileData;
  setFamilyMemberToDelete: Dispatch<SetStateAction<string | null>>;
  setFamilyMembersInEditMode: Dispatch<SetStateAction<Set<string>>>;
  setHasChanges: Dispatch<SetStateAction<boolean>>;
  setProfileData: Dispatch<SetStateAction<ProfileData>>;
}

export function createFamilyMemberHandlers({
  familyMemberToDelete,
  profileData,
  setFamilyMemberToDelete,
  setFamilyMembersInEditMode,
  setHasChanges,
  setProfileData,
}: Deps) {
  const addFamilyMember = () => {
    const newMember: FamilyMember = {
      id: Date.now().toString(),
      fullName: '',
      relationship: '',
      dateOfBirth: '',
      gender: '',
      idPassportNumber: '',
      isFinanciallyDependent: false,
      isIncludedInEstatePlanning: false,
      shareProfileInformation: false,
      shareEmail: '',
      notes: '',
    };
    setProfileData((prev) => ({
      ...prev,
      familyMembers: [...prev.familyMembers, newMember],
    }));
    setFamilyMembersInEditMode((prev) => new Set([...prev, newMember.id]));
    setHasChanges(true);
  };

  const confirmDeleteFamilyMember = (id: string) => {
    setFamilyMemberToDelete(id);
  };

  const removeFamilyMember = () => {
    if (!familyMemberToDelete) return;
    setProfileData((prev) => ({
      ...prev,
      familyMembers: prev.familyMembers.filter((member) => member.id !== familyMemberToDelete),
    }));
    setFamilyMembersInEditMode((prev) => {
      const newSet = new Set(prev);
      newSet.delete(familyMemberToDelete);
      return newSet;
    });
    setFamilyMemberToDelete(null);
    setHasChanges(true);
  };

  const updateFamilyMember = (id: string, updates: Partial<FamilyMember>) => {
    setProfileData((prev) => ({
      ...prev,
      familyMembers: prev.familyMembers.map((member) =>
        member.id === id ? { ...member, ...updates } : member,
      ),
    }));
    setHasChanges(true);
  };

  const saveFamilyMember = (id: string) => {
    const member = profileData.familyMembers.find((m) => m.id === id);

    if (!member?.fullName || !member?.relationship) {
      toast.error('Please fill in all required fields (Full Name and Relationship) before saving');
      return;
    }

    setFamilyMembersInEditMode((prev) => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const editFamilyMember = (id: string) => {
    setFamilyMembersInEditMode((prev) => new Set([...prev, id]));
  };

  const cancelEditFamilyMember = (id: string) => {
    const member = profileData.familyMembers.find((m) => m.id === id);

    if (member && !member.fullName && !member.relationship) {
      setProfileData((prev) => ({
        ...prev,
        familyMembers: prev.familyMembers.filter((m) => m.id !== id),
      }));
      setFamilyMembersInEditMode((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      return;
    }

    setFamilyMembersInEditMode((prev) => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  return {
    addFamilyMember,
    confirmDeleteFamilyMember,
    removeFamilyMember,
    updateFamilyMember,
    saveFamilyMember,
    editFamilyMember,
    cancelEditFamilyMember,
  };
}
