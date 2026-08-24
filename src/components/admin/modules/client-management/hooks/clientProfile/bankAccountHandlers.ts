/**
 * Bank accounts and proof of bank.
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
import { ProfileData, BankAccount } from '../../types';

interface Deps {
  bankAccountToDelete: string | null;
  profileData: ProfileData;
  proofOfBankToDelete: string | null;
  setBankAccountToDelete: Dispatch<SetStateAction<string | null>>;
  setBankAccountsInEditMode: Dispatch<SetStateAction<Set<string>>>;
  setHasChanges: Dispatch<SetStateAction<boolean>>;
  setProfileData: Dispatch<SetStateAction<ProfileData>>;
  setProofOfBankToDelete: Dispatch<SetStateAction<string | null>>;
}

export function createBankAccountHandlers({
  bankAccountToDelete,
  profileData,
  proofOfBankToDelete,
  setBankAccountToDelete,
  setBankAccountsInEditMode,
  setHasChanges,
  setProfileData,
  setProofOfBankToDelete,
}: Deps) {
  const addBankAccount = () => {
    const newAccount: BankAccount = {
      id: Date.now().toString(),
      accountHolderName: '',
      bankName: '',
      accountNumber: '',
      accountType: 'checking',
      branchCode: '',
      isPrimary: false,
    };
    setProfileData((prev) => ({
      ...prev,
      bankAccounts: [...prev.bankAccounts, newAccount],
    }));
    setBankAccountsInEditMode((prev) => new Set([...prev, newAccount.id]));
    setHasChanges(true);
  };

  const confirmDeleteBankAccount = (id: string) => {
    setBankAccountToDelete(id);
  };

  const removeBankAccount = () => {
    if (!bankAccountToDelete) return;
    setProfileData((prev) => ({
      ...prev,
      bankAccounts: prev.bankAccounts.filter((account) => account.id !== bankAccountToDelete),
    }));
    setBankAccountsInEditMode((prev) => {
      const newSet = new Set(prev);
      newSet.delete(bankAccountToDelete);
      return newSet;
    });
    setBankAccountToDelete(null);
    setHasChanges(true);
  };

  const updateBankAccount = (id: string, updates: Partial<BankAccount>) => {
    setProfileData((prev) => ({
      ...prev,
      bankAccounts: prev.bankAccounts.map((account) =>
        account.id === id ? { ...account, ...updates } : account,
      ),
    }));
    setHasChanges(true);
  };

  const saveBankAccount = (id: string) => {
    const account = profileData.bankAccounts.find((a) => a.id === id);

    if (
      !account?.accountHolderName ||
      !account?.bankName ||
      !account?.accountNumber ||
      !account?.accountType
    ) {
      toast.error(
        'Please fill in all required fields (Account Holder Name, Bank Name, Account Number, and Account Type) before saving',
      );
      return;
    }

    if (account.bankName === 'Other') {
      if (!account.customBankName || !account.customBranchCode) {
        toast.error(
          'For "Other" banks, please provide the Custom Bank Name and Custom Branch Code',
        );
        return;
      }
    } else {
      if (!account.branchCode) {
        toast.error('Please provide the Branch Code before saving');
        return;
      }
    }

    setBankAccountsInEditMode((prev) => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const editBankAccount = (id: string) => {
    setBankAccountsInEditMode((prev) => new Set([...prev, id]));
  };

  const cancelEditBankAccount = (id: string) => {
    const account = profileData.bankAccounts.find((a) => a.id === id);

    if (
      account &&
      !account.accountHolderName &&
      !account.bankName &&
      !account.accountNumber &&
      !account.accountType
    ) {
      setProfileData((prev) => ({
        ...prev,
        bankAccounts: prev.bankAccounts.filter((a) => a.id !== id),
      }));
      setBankAccountsInEditMode((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      return;
    }

    setBankAccountsInEditMode((prev) => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const handleProofOfBankUpload = (id: string, file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      updateBankAccount(id, {
        proofOfBankDocument: reader.result as string,
        proofOfBankFileName: file.name,
      });
    };
    reader.readAsDataURL(file);
  };

  const confirmDeleteProofOfBank = (id: string) => {
    setProofOfBankToDelete(id);
  };

  const removeProofOfBank = () => {
    if (!proofOfBankToDelete) return;
    updateBankAccount(proofOfBankToDelete, {
      proofOfBankDocument: undefined,
      proofOfBankFileName: undefined,
    });
    setProofOfBankToDelete(null);
  };

  return {
    addBankAccount,
    confirmDeleteBankAccount,
    removeBankAccount,
    updateBankAccount,
    saveBankAccount,
    editBankAccount,
    cancelEditBankAccount,
    handleProofOfBankUpload,
    confirmDeleteProofOfBank,
    removeProofOfBank,
  };
}
