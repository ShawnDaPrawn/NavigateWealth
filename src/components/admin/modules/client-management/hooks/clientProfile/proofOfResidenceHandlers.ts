/**
 * Proof of residence: upload, edit, delete.
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
import { ProfileData } from '../../types';

interface Deps {
  setHasChanges: Dispatch<SetStateAction<boolean>>;
  setProfileData: Dispatch<SetStateAction<ProfileData>>;
  setProofOfResidenceInEditMode: Dispatch<SetStateAction<boolean>>;
  setProofOfResidenceToDelete: Dispatch<SetStateAction<boolean>>;
}

export function createProofOfResidenceHandlers({
  setHasChanges,
  setProfileData,
  setProofOfResidenceInEditMode,
  setProofOfResidenceToDelete,
}: Deps) {
  const handleProofOfResidenceUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a PDF, JPG, or PNG file');
      return;
    }

    setProfileData((prev) => ({
      ...prev,
      proofOfResidenceUploaded: true,
      proofOfResidenceFileName: file.name,
    }));
    setProofOfResidenceInEditMode(false);
    setHasChanges(true);
  };

  const editProofOfResidence = () => {
    setProofOfResidenceInEditMode(true);
  };

  const saveProofOfResidence = () => {
    setProofOfResidenceInEditMode(false);
  };

  const confirmDeleteProofOfResidence = () => {
    setProofOfResidenceToDelete(true);
  };

  const removeProofOfResidence = () => {
    setProfileData((prev) => ({
      ...prev,
      proofOfResidenceUploaded: false,
      proofOfResidenceFileName: undefined,
    }));
    setProofOfResidenceToDelete(false);
    setProofOfResidenceInEditMode(false);
    setHasChanges(true);
  };

  return {
    handleProofOfResidenceUpload,
    editProofOfResidence,
    saveProofOfResidence,
    confirmDeleteProofOfResidence,
    removeProofOfResidence,
  };
}
