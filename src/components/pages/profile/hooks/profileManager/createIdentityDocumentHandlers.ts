/**
 * Identity documents: add, upload, edit, delete, and the type label/icon lookups.
 *
 * Split out of `useProfileManager.ts` (1,126 lines), following the
 * clientProfile factory pattern: plain functions over the profile state —
 * no useState/useCallback/useEffect in this region, which is what makes
 * moving it out of the hook body legal. The hook still owns the state.
 */
import type { Dispatch, SetStateAction } from 'react';
import { IdCard, FileText, CreditCard } from 'lucide-react';
import type { ProfileData, IdentityDocument, IdentityDocumentType } from '../../types';
import { createIdentityDocument } from '../../profileHandlers';
import { getSession } from '../../../../../utils/auth/authService';
import { toast } from 'sonner';
import { projectId } from '../../../../../utils/supabase/info';

// ============================================================================
// Hook Input
// ============================================================================

interface Deps {
  profileData: ProfileData;
  setProfileData: Dispatch<SetStateAction<ProfileData>>;
  setIdentityDocToDelete: Dispatch<SetStateAction<string | null>>;
  setIdentityDocsInEditMode: Dispatch<SetStateAction<Set<string>>>;
}

export function createIdentityDocumentHandlers({
  profileData,
  setProfileData,
  setIdentityDocToDelete,
  setIdentityDocsInEditMode,
}: Deps) {
  const hasDocumentType = (type: IdentityDocumentType) =>
    profileData.identityDocuments.some((doc) => doc.type === type);

  const addIdentityDocument = (type: IdentityDocumentType) => {
    if (profileData.identityDocuments.some((doc) => doc.type === type)) {
      const typeNames = {
        'national-id': 'National ID',
        passport: 'Passport',
        'drivers-license': "Driver's License",
      };
      toast.error(
        `You have already added a ${typeNames[type]}. Only one document of each type is allowed.`,
      );
      return;
    }
    const newDoc: IdentityDocument = createIdentityDocument(type);
    setProfileData((prev) => ({
      ...prev,
      identityDocuments: [...prev.identityDocuments, newDoc],
    }));
    setIdentityDocsInEditMode((prev) => new Set([...prev, newDoc.id]));
  };

  const handleDocumentUpload = async (id: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }
    const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a PDF, JPG, or PNG file');
      return;
    }
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
        identityDocuments: prev.identityDocuments.map((doc) =>
          doc.id === id
            ? {
                ...doc,
                fileName: file.name,
                fileSize: file.size,
                fileUrl: result.path,
                uploadDate: new Date().toISOString(),
                isVerified: false,
              }
            : doc,
        ),
      }));
      toast.success('Document uploaded successfully');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload document');
    }
  };

  const updateIdentityDocument = (id: string, updates: Partial<IdentityDocument>) => {
    setProfileData((prev) => ({
      ...prev,
      identityDocuments: prev.identityDocuments.map((doc) =>
        doc.id === id ? { ...doc, ...updates } : doc,
      ),
    }));
  };

  const confirmDeleteIdentityDocument = (id: string) => {
    setIdentityDocToDelete(id);
  };

  const removeIdentityDocument = (id: string) => {
    setProfileData((prev) => ({
      ...prev,
      identityDocuments: prev.identityDocuments.filter((doc) => doc.id !== id),
    }));
    setIdentityDocsInEditMode((prev) => {
      const s = new Set(prev);
      s.delete(id);
      return s;
    });
    setIdentityDocToDelete(null);
  };

  const saveIdentityDocument = (id: string) => {
    const doc = profileData.identityDocuments.find((d) => d.id === id);
    if (doc?.type === 'national-id') {
      if (!doc.number || !doc.fileName) {
        toast.error('Please fill in the ID number and upload the document before saving');
        return;
      }
    }
    setIdentityDocsInEditMode((prev) => {
      const s = new Set(prev);
      s.delete(id);
      return s;
    });
  };

  const cancelEditIdentityDocument = (id: string) => {
    setProfileData((prev) => {
      const doc = prev.identityDocuments.find((d) => d.id === id);
      if (doc && !doc.number && !doc.fileName) {
        return { ...prev, identityDocuments: prev.identityDocuments.filter((d) => d.id !== id) };
      }
      return prev;
    });
    setIdentityDocsInEditMode((prev) => {
      const s = new Set(prev);
      s.delete(id);
      return s;
    });
  };

  const editIdentityDocument = (id: string) => {
    setIdentityDocsInEditMode((prev) => new Set([...prev, id]));
  };

  // ── Document type helpers ───────────────────────────────────────

  const getDocumentTypeLabel = (type: IdentityDocumentType): string => {
    switch (type) {
      case 'national-id':
        return 'National ID Card';
      case 'passport':
        return 'Passport';
      case 'drivers-license':
        return "Driver's License";
      default:
        return type;
    }
  };

  const getDocumentTypeIcon = (
    type: IdentityDocumentType,
  ): { icon: React.ElementType; color: string } => {
    switch (type) {
      case 'national-id':
        return { icon: IdCard, color: 'purple' };
      case 'passport':
        return { icon: FileText, color: 'blue' };
      case 'drivers-license':
        return { icon: CreditCard, color: 'amber' };
      default:
        return { icon: FileText, color: 'gray' };
    }
  };

  // ══════════════════════════════════════════════════════════════════
  // Proof of Residence Handlers
  // ══════════════════════════════════════════════════════════════════

  return {
    hasDocumentType,
    addIdentityDocument,
    handleDocumentUpload,
    updateIdentityDocument,
    confirmDeleteIdentityDocument,
    removeIdentityDocument,
    saveIdentityDocument,
    cancelEditIdentityDocument,
    editIdentityDocument,
    getDocumentTypeLabel,
    getDocumentTypeIcon,
  };
}
