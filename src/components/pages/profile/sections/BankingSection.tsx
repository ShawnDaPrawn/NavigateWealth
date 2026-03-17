import React from 'react';
import type { ProfileData, BankAccount } from '../types';
import { EmptyState } from '../EmptyState';
import { emptyStateConfigs } from '../emptyStateConfigs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/card';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import { Button } from '../../../ui/button';
import { Badge } from '../../../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../ui/select';
import { Checkbox } from '../../../ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../../../ui/alert-dialog';
import { CreditCard, FileText, Plus, Edit2, Trash2, Upload, X, Check } from 'lucide-react';

interface BankingSectionProps {
  profileData: ProfileData;
  bankAccountsInEditMode: Set<string>;
  bankAccountToDelete: string | null;
  setBankAccountToDelete: React.Dispatch<React.SetStateAction<string | null>>;
  proofOfBankToDelete: string | null;
  setProofOfBankToDelete: React.Dispatch<React.SetStateAction<string | null>>;
  addBankAccount: () => void;
  updateBankAccount: (id: string, updates: Partial<BankAccount>) => void;
  saveBankAccount: (id: string) => void;
  editBankAccount: (id: string) => void;
  cancelEditBankAccount: (id: string) => void;
  confirmDeleteBankAccount: (id: string) => void;
  removeBankAccount: (id: string) => void;
  handleProofOfBankUpload: (id: string, file: File) => void;
  confirmDeleteProofOfBank: (id: string) => void;
  removeProofOfBank: (id: string) => void;
}

export function BankingSection({
  profileData,
  bankAccountsInEditMode, bankAccountToDelete, setBankAccountToDelete,
  proofOfBankToDelete, setProofOfBankToDelete,
  addBankAccount, updateBankAccount, saveBankAccount,
  editBankAccount, cancelEditBankAccount, confirmDeleteBankAccount, removeBankAccount,
  handleProofOfBankUpload, confirmDeleteProofOfBank, removeProofOfBank,
}: BankingSectionProps) {
  return (
    <div className="contents">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[#6d28d9]/10 flex items-center justify-center"><CreditCard className="h-5 w-5 text-[#6d28d9]" /></div>
              <div><CardTitle>Banking Details</CardTitle><CardDescription>Your bank account information</CardDescription></div>
            </div>
            <Button onClick={addBankAccount} size="sm" disabled={bankAccountsInEditMode.size > 0} className="bg-[#6d28d9] hover:bg-[#5b21b6] disabled:opacity-50 disabled:cursor-not-allowed" title={bankAccountsInEditMode.size > 0 ? "Please save the current bank account before adding a new one" : "Add a new bank account"}>
              <Plus className="h-4 w-4 mr-1" />Add Account
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {profileData.bankAccounts.length === 0 ? (
            <EmptyState icon={emptyStateConfigs.banking.icon} title={emptyStateConfigs.banking.title} description={emptyStateConfigs.banking.description} actionLabel={emptyStateConfigs.banking.actionLabel} onAction={addBankAccount} iconColor={emptyStateConfigs.banking.iconColor} iconBgColor={emptyStateConfigs.banking.iconBgColor} buttonColor={emptyStateConfigs.banking.buttonColor} buttonHoverColor={emptyStateConfigs.banking.buttonHoverColor} />
          ) : (
            <div className="space-y-4">
              {profileData.bankAccounts.map((account, index) => {
                const isInEditMode = bankAccountsInEditMode.has(account.id);
                const isOtherBank = account.bankName === 'Other';
                let isValid: string | boolean | undefined = account.accountHolderName && account.bankName && account.accountNumber && account.accountType;
                if (isOtherBank) { isValid = isValid && account.customBankName && account.customBranchCode; }
                else { isValid = isValid && account.branchCode; }

                return (
                  <div key={account.id} className={`p-5 rounded-lg border-2 ${isInEditMode ? 'border-[#6d28d9] bg-white' : 'border-gray-200 bg-white'}`}>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center"><CreditCard className="h-5 w-5 text-[#6d28d9]" /></div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-gray-900">{account.accountHolderName || `Bank Account ${index + 1}`}</p>
                            {account.isPrimary && (<Badge className="bg-[#6d28d9] text-white">Primary</Badge>)}
                          </div>
                          {!isInEditMode && account.bankName && (<p className="text-sm text-gray-600">{isOtherBank ? account.customBankName : account.bankName} • {account.accountType}</p>)}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {!isInEditMode ? (
                          <div className="contents">
                            <Button variant="outline" size="sm" onClick={() => editBankAccount(account.id)} className="border-[#6d28d9] text-[#6d28d9] hover:bg-[#6d28d9]/10"><Edit2 className="h-4 w-4 mr-1" />Edit</Button>
                            {profileData.bankAccounts.length > 1 && (<Button variant="outline" size="sm" onClick={() => confirmDeleteBankAccount(account.id)} className="border-red-600 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>)}
                          </div>
                        ) : (
                          <div className="contents">
                            <Button variant="outline" size="sm" onClick={() => cancelEditBankAccount(account.id)} className="border-gray-300 text-gray-700 hover:bg-gray-50"><X className="h-4 w-4 mr-1" />Cancel</Button>
                            <Button variant="outline" size="sm" onClick={() => saveBankAccount(account.id)} disabled={!isValid} className={`${!isValid ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-[#6d28d9] text-white hover:bg-[#5b21b6]'} border-[#6d28d9]`}><Check className="h-4 w-4 mr-1" />Save</Button>
                          </div>
                        )}
                      </div>
                    </div>

                    {isInEditMode ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2"><Label htmlFor={`holder-${account.id}`}>Account Holder Name *</Label><Input id={`holder-${account.id}`} value={account.accountHolderName} onChange={(e) => updateBankAccount(account.id, { accountHolderName: e.target.value })} placeholder="Enter account holder name" className="mt-1.5" /></div>
                        <div className="sm:col-span-2">
                          <Label htmlFor={`bank-${account.id}`}>Bank Name *</Label>
                          <Select value={account.bankName} onValueChange={(value) => updateBankAccount(account.id, { bankName: value })}>
                            <SelectTrigger id={`bank-${account.id}`} className="mt-1.5"><SelectValue placeholder="Select bank" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ABSA">ABSA</SelectItem><SelectItem value="Standard Bank">Standard Bank</SelectItem><SelectItem value="FNB">FNB</SelectItem><SelectItem value="Nedbank">Nedbank</SelectItem><SelectItem value="Capitec">Capitec</SelectItem><SelectItem value="Discovery Bank">Discovery Bank</SelectItem><SelectItem value="TymeBank">TymeBank</SelectItem><SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {isOtherBank && (
                          <div className="contents">
                            <div className="sm:col-span-2"><Label htmlFor={`custom-bank-${account.id}`}>Custom Bank Name *</Label><Input id={`custom-bank-${account.id}`} value={account.customBankName || ''} onChange={(e) => updateBankAccount(account.id, { customBankName: e.target.value })} placeholder="Enter bank name" className="mt-1.5" /></div>
                            <div className="sm:col-span-2"><Label htmlFor={`custom-branch-${account.id}`}>Custom Branch Code *</Label><Input id={`custom-branch-${account.id}`} value={account.customBranchCode || ''} onChange={(e) => updateBankAccount(account.id, { customBranchCode: e.target.value })} placeholder="Enter branch code" className="mt-1.5" /></div>
                          </div>
                        )}
                        <div><Label htmlFor={`account-num-${account.id}`}>Account Number *</Label><Input id={`account-num-${account.id}`} value={account.accountNumber} onChange={(e) => updateBankAccount(account.id, { accountNumber: e.target.value })} placeholder="Enter account number" className="mt-1.5" /></div>
                        {!isOtherBank && (<div><Label htmlFor={`branch-${account.id}`}>Branch Code *</Label><Input id={`branch-${account.id}`} value={account.branchCode} onChange={(e) => updateBankAccount(account.id, { branchCode: e.target.value })} placeholder="Enter branch code" className="mt-1.5" /></div>)}
                        <div className="sm:col-span-2">
                          <Label htmlFor={`account-type-${account.id}`}>Account Type *</Label>
                          <Select value={account.accountType} onValueChange={(value) => updateBankAccount(account.id, { accountType: value })}>
                            <SelectTrigger id={`account-type-${account.id}`} className="mt-1.5"><SelectValue placeholder="Select type" /></SelectTrigger>
                            <SelectContent><SelectItem value="checking">Checking</SelectItem><SelectItem value="savings">Savings</SelectItem><SelectItem value="transmission">Transmission</SelectItem></SelectContent>
                          </Select>
                        </div>

                        {/* Proof of Bank Document Upload */}
                        <div className="sm:col-span-2">
                          <Label htmlFor={`proof-${account.id}`}>Proof of Bank Document</Label>
                          {account.proofOfBankDocument ? (
                            <div className="mt-1.5 p-4 border-2 border-green-200 rounded-lg bg-green-50">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2"><FileText className="h-5 w-5 text-green-600" /><div><p className="text-sm text-gray-900">{account.proofOfBankFileName}</p><p className="text-xs text-gray-600">Document uploaded</p></div></div>
                                <div className="flex gap-2">
                                  <Button variant="outline" size="sm" onClick={() => { const input = document.getElementById(`proof-${account.id}`) as HTMLInputElement; input?.click(); }} className="border-[#6d28d9] text-[#6d28d9]">Replace</Button>
                                  <Button variant="outline" size="sm" onClick={() => confirmDeleteProofOfBank(account.id)} className="border-red-600 text-red-600"><Trash2 className="h-4 w-4" /></Button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-1.5 p-4 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                              <div className="text-center">
                                <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" /><p className="text-sm text-gray-600 mb-1">Upload Proof of Bank</p><p className="text-xs text-gray-500 mb-3">PDF, JPG, PNG up to 10MB</p>
                                <Button variant="outline" size="sm" onClick={() => { const input = document.getElementById(`proof-${account.id}`) as HTMLInputElement; input?.click(); }} className="border-[#6d28d9] text-[#6d28d9]">Choose File</Button>
                              </div>
                            </div>
                          )}
                          <input id={`proof-${account.id}`} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) { if (file.size > 10 * 1024 * 1024) { alert('File size must be less than 10MB'); return; } handleProofOfBankUpload(account.id, file); } }} />
                        </div>

                        <div className="sm:col-span-2 flex items-center space-x-2 p-3 rounded-lg border border-gray-200 bg-gray-50">
                          <Checkbox id={`primary-${account.id}`} checked={account.isPrimary} onCheckedChange={(checked) => updateBankAccount(account.id, { isPrimary: checked as boolean })} />
                          <Label htmlFor={`primary-${account.id}`} className="text-sm cursor-pointer">Set as primary bank account</Label>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                          <div><p className="text-gray-600 text-[12px]">Bank</p><p className="text-gray-900">{isOtherBank ? account.customBankName : account.bankName}</p></div>
                          <div><p className="text-gray-600 text-[12px]">Account Number</p><p className="text-gray-900">{account.accountNumber}</p></div>
                          <div><p className="text-gray-600 text-[12px]">Branch Code</p><p className="text-gray-900">{isOtherBank ? account.customBranchCode : account.branchCode}</p></div>
                          <div><p className="text-gray-600 text-[12px]">Account Type</p><p className="text-gray-900 capitalize">{account.accountType}</p></div>
                        </div>
                        {account.proofOfBankDocument && (
                          <div className="pt-2 border-t border-gray-200">
                            <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-green-600" /><p className="text-sm text-gray-900">{account.proofOfBankFileName}</p><Badge variant="outline" className="text-green-600 border-green-600">Verified</Badge></div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={bankAccountToDelete !== null} onOpenChange={() => setBankAccountToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Bank Account</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete this bank account? This action cannot be undone and all information about this account will be permanently removed.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel onClick={() => setBankAccountToDelete(null)}>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => bankAccountToDelete && removeBankAccount(bankAccountToDelete)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={proofOfBankToDelete !== null} onOpenChange={() => setProofOfBankToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Proof of Bank Document</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete this proof of bank document? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel onClick={() => setProofOfBankToDelete(null)}>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => proofOfBankToDelete && removeProofOfBank(proofOfBankToDelete)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
