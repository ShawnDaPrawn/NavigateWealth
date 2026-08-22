/**
 * Identity documents: upload, edit, delete.
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
import { ProfileData, IdentityDocument, IdentityDocumentType } from '../../types';
import { IdCard, FileText, CreditCard, Home, ReceiptText } from 'lucide-react';

interface Deps {
  profileData: ProfileData;
  setHasChanges: Dispatch<SetStateAction<boolean>>;
  setIdentityDocToDelete: Dispatch<SetStateAction<string | null>>;
  setIdentityDocsInEditMode: Dispatch<SetStateAction<Set<string>>>;
  setProfileData: Dispatch<SetStateAction<ProfileData>>;
}

export function createIdentityDocumentHandlers({
  profileData,
  setHasChanges,
  setIdentityDocToDelete,
  setIdentityDocsInEditMode,
  setProfileData,
}: Deps) {
  const hasDocumentType = (type: IdentityDocumentType) => {
    return profileData.identityDocuments.some((doc) => doc.type === type);
  };

  const addIdentityDocument = (type: IdentityDocumentType) => {
    if (hasDocumentType(type)) {
      const typeNames: Record<IdentityDocumentType, string> = {
        'national-id': 'National ID',
        passport: 'Passport',
        'drivers-license': "Driver's License",
        'proof-of-residence': 'Proof of Residence',
        'proof-primary-bank-account': 'Proof of Primary Bank Account',
        'utility-bill': 'Utility Bill',
      };
      toast.error(
        `Client already has a ${typeNames[type]}. Only one document of each type is allowed.`,
      );
      return;
    }

    const newDoc: IdentityDocument = {
      id: Date.now().toString(),
      type,
      number: '',
      countryOfIssue: 'South Africa',
      expiryDate: '',
      isVerified: false,
    };
    setProfileData((prev) => ({
      ...prev,
      identityDocuments: [...prev.identityDocuments, newDoc],
    }));
    setIdentityDocsInEditMode((prev) => new Set([...prev, newDoc.id]));
    setHasChanges(true);
  };

  const handleDocumentUpload = (id: string, event: React.ChangeEvent<HTMLInputElement>) => {
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

    const fileUrl = URL.createObjectURL(file);

    setProfileData((prev) => ({
      ...prev,
      identityDocuments: prev.identityDocuments.map((doc) =>
        doc.id === id
          ? {
              ...doc,
              fileName: file.name,
              fileUrl: fileUrl,
              fileSize: file.size,
              uploadDate: new Date().toISOString(),
              isVerified: false,
            }
          : doc,
      ),
    }));
    setHasChanges(true);
    toast.success(`Document "${file.name}" uploaded successfully`);
  };

  const updateIdentityDocument = (id: string, updates: Partial<IdentityDocument>) => {
    setProfileData((prev) => ({
      ...prev,
      identityDocuments: prev.identityDocuments.map((doc) =>
        doc.id === id ? { ...doc, ...updates } : doc,
      ),
    }));
    setHasChanges(true);
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
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
    setIdentityDocToDelete(null);
    setHasChanges(true);
  };

  const saveIdentityDocument = (id: string) => {
    const doc = profileData.identityDocuments.find((d) => d.id === id);

    if (doc?.type === 'national-id') {
      if (!doc.number || !doc.fileName) {
        toast.error('Please fill in the ID number and upload the document before saving');
        return;
      }
    }

    if (
      doc &&
      ['proof-of-residence', 'proof-primary-bank-account', 'utility-bill'].includes(doc.type) &&
      !doc.fileName
    ) {
      toast.error('Please upload the document before saving');
      return;
    }

    setIdentityDocsInEditMode((prev) => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const cancelEditIdentityDocument = (id: string) => {
    const doc = profileData.identityDocuments.find((d) => d.id === id);

    if (doc && !doc.number && !doc.fileName) {
      removeIdentityDocument(id);
      return;
    }

    setIdentityDocsInEditMode((prev) => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const editIdentityDocument = (id: string) => {
    setIdentityDocsInEditMode((prev) => new Set([...prev, id]));
  };

  const getDocumentTypeLabel = (type: IdentityDocumentType) => {
    switch (type) {
      case 'national-id':
        return 'Identity';
      case 'passport':
        return 'Passport';
      case 'drivers-license':
        return "Driver's License";
      case 'proof-of-residence':
        return 'Proof of Residence';
      case 'proof-primary-bank-account':
        return 'Proof of Primary Bank Account';
      case 'utility-bill':
        return 'Utility Bill';
      default:
        return type;
    }
  };

  const getDocumentTypeIcon = (type: IdentityDocumentType) => {
    switch (type) {
      case 'national-id':
        return { icon: IdCard, color: 'purple' };
      case 'passport':
        return { icon: FileText, color: 'blue' };
      case 'drivers-license':
        return { icon: CreditCard, color: 'amber' };
      case 'proof-of-residence':
        return { icon: Home, color: 'green' };
      case 'proof-primary-bank-account':
        return { icon: CreditCard, color: 'blue' };
      case 'utility-bill':
        return { icon: ReceiptText, color: 'amber' };
      default:
        return { icon: FileText, color: 'gray' };
    }
  };

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
