/**
 * Proof-of-bank, self-employed, and proof-of-residence document handling.
 *
 * Split out of `useProfileManager.ts` (1,126 lines), following the
 * clientProfile factory pattern: plain functions over the profile state —
 * no useState/useCallback/useEffect in this region, which is what makes
 * moving it out of the hook body legal. The hook still owns the state.
 */
import type { Dispatch, SetStateAction } from 'react';
import React from 'react';
import { toast } from 'sonner';
import { projectId } from '../../../../../utils/supabase/info';
import { getSession } from '../../../../../utils/auth/authService';
import type { ProfileData } from '../../types';

interface Deps {
  profileData: ProfileData;
  setProfileData: Dispatch<SetStateAction<ProfileData>>;
  setProofOfBankToDelete: Dispatch<SetStateAction<string | null>>;
  setSelfEmployedInEditMode: Dispatch<SetStateAction<boolean>>;
  setProofOfResidenceInEditMode: Dispatch<SetStateAction<boolean>>;
  setProofOfResidenceToDelete: Dispatch<SetStateAction<boolean>>;
}

export function createProofDocumentHandlers({
  profileData,
  setProfileData,
  setProofOfBankToDelete,
  setSelfEmployedInEditMode,
  setProofOfResidenceInEditMode,
  setProofOfResidenceToDelete,
}: Deps) {
  const handleProofOfBankUpload = async (id: string, file: File) => {
    try {
      const session = await getSession();
      if (!session) {
        toast.error('You must be logged in to upload files');
        return;
      }
      toast.info('Uploading document...');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', session.user.id);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/profile/upload`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: formData,
        },
      );
      if (!response.ok) throw new Error('Upload failed');
      const result = await response.json();
      setProfileData((prev) => ({
        ...prev,
        bankAccounts: prev.bankAccounts.map((a) =>
          a.id === id
            ? { ...a, proofOfBankDocument: result.path, proofOfBankFileName: file.name }
            : a,
        ),
      }));
      toast.success('Document uploaded successfully');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload document');
    }
  };

  const confirmDeleteProofOfBank = (id: string) => {
    setProofOfBankToDelete(id);
  };

  const removeProofOfBank = (id: string) => {
    setProfileData((prev) => ({
      ...prev,
      bankAccounts: prev.bankAccounts.map((a) =>
        a.id === id ? { ...a, proofOfBankDocument: undefined, proofOfBankFileName: undefined } : a,
      ),
    }));
    setProofOfBankToDelete(null);
  };

  // ══════════════════════════════════════════════════════════════════
  // Self-Employed Handlers
  // ══════════════════════════════════════════════════════════════════

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

  // ══════════════════════════════════════════════════════════════════
  // Risk Assessment Management
  // ══════════════════════════════════════════════════════════════════

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
  };

  return {
    handleProofOfBankUpload,
    confirmDeleteProofOfBank,
    removeProofOfBank,
    saveSelfEmployed,
    cancelEditSelfEmployed,
    editSelfEmployed,
    handleProofOfResidenceUpload,
    editProofOfResidence,
    saveProofOfResidence,
    confirmDeleteProofOfResidence,
    removeProofOfResidence,
  };
}
