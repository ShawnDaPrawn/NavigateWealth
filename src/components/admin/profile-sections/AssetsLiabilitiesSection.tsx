import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Textarea } from '../../ui/textarea';
import { Button } from '../../ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../../ui/alert-dialog';
import { TrendingUp, DollarSign, Plus, Edit2, Trash2, X, Check, PieChart } from 'lucide-react';
import { EmptyState } from '../../pages/profile/EmptyState';
import { emptyStateConfigs } from '../../pages/profile/emptyStateConfigs';

interface Asset {
  id: string;
  type: string;
  name: string;
  description: string;
  value: number;
  ownershipType: string;
  provider: string;
  customType?: string;
}

interface Liability {
  id: string;
  type: string;
  name: string;
  description: string;
  provider: string;
  outstandingBalance: number;
  monthlyPayment: number;
  interestRate: number;
  customType?: string;
}

interface AssetsLiabilitiesSectionProps {
  assets: Asset[];
  liabilities: Liability[];
  assetsInEditMode: Set<string>;
  liabilitiesInEditMode: Set<string>;
  assetToDelete: string | null;
  liabilityToDelete: string | null;
  assetDisplayValues: {[id: string]: string};
  liabilityDisplayValues: {[id: string]: {amount?: string; monthlyPayment?: string}};
  setAssetDisplayValues: (value: React.SetStateAction<Record<string, string>>) => void;
  setLiabilityDisplayValues: (value: React.SetStateAction<Record<string, string>>) => void;
  addAsset: () => void;
  editAsset: (id: string) => void;
  saveAsset: (id: string) => void;
  cancelEditAsset: (id: string) => void;
  confirmDeleteAsset: (id: string) => void;
  removeAsset: () => void;
  updateAsset: (id: string, updates: Partial<Asset>) => void;
  addLiability: () => void;
  editLiability: (id: string) => void;
  saveLiability: (id: string) => void;
  cancelEditLiability: (id: string) => void;
  confirmDeleteLiability: (id: string) => void;
  removeLiability: () => void;
  updateLiability: (id: string, updates: Partial<Liability>) => void;
  setAssetToDelete: (value: string | null) => void;
  setLiabilityToDelete: (value: string | null) => void;
  formatCurrency: (value: number) => string;
  formatCurrencyInput: (value: string) => string;
  cleanCurrencyInput: (value: string) => string;
}

export function AssetsLiabilitiesSection({
  assets = [],
  liabilities = [],
  assetsInEditMode,
  liabilitiesInEditMode,
  assetToDelete,
  liabilityToDelete,
  assetDisplayValues,
  liabilityDisplayValues,
  setAssetDisplayValues,
  setLiabilityDisplayValues,
  addAsset,
  editAsset,
  saveAsset,
  cancelEditAsset,
  confirmDeleteAsset,
  removeAsset,
  updateAsset,
  addLiability,
  editLiability,
  saveLiability,
  cancelEditLiability,
  confirmDeleteLiability,
  removeLiability,
  updateLiability,
  setAssetToDelete,
  setLiabilityToDelete,
  formatCurrency,
  formatCurrencyInput,
  cleanCurrencyInput
}: AssetsLiabilitiesSectionProps) {
  const totalAssets = (assets || []).reduce((sum, asset) => sum + (asset.value || 0), 0);
  const totalLiabilities = (liabilities || []).reduce((sum, liability) => sum + (liability.outstandingBalance || 0), 0);
  const netWorth = totalAssets - totalLiabilities;

  return (
    <div className="space-y-6">
      {/* Assets Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <CardTitle>Assets</CardTitle>
                <CardDescription>Client's properties, investments, and valuables</CardDescription>
              </div>
            </div>
            <Button
              onClick={addAsset}
              size="sm"
              disabled={assetsInEditMode.size > 0}
              className="bg-[#6d28d9] hover:bg-[#5b21b6] disabled:opacity-50 disabled:cursor-not-allowed"
              title={assetsInEditMode.size > 0 ? "Please save the current asset before adding a new one" : "Add a new asset"}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Asset
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {(assets || []).length === 0 ? (
            <EmptyState
              icon={emptyStateConfigs.assets.icon}
              title={emptyStateConfigs.assets.title}
              description={emptyStateConfigs.assets.description}
              actionLabel={emptyStateConfigs.assets.actionLabel}
              onAction={addAsset}
              iconColor={emptyStateConfigs.assets.iconColor}
              iconBgColor={emptyStateConfigs.assets.iconBgColor}
              buttonColor={emptyStateConfigs.assets.buttonColor}
              buttonHoverColor={emptyStateConfigs.assets.buttonHoverColor}
            />
          ) : (
            <div className="space-y-4">
              {(assets || []).map((asset, index) => {
                const isEditing = assetsInEditMode.has(asset.id);
                const isOtherType = asset.type === 'Other';
                
                // Validation
                let isValid = asset.type && asset.name && asset.ownershipType;
                if (isOtherType) {
                  isValid = isValid && !!asset.customType;
                }
                
                return (
                  <div key={asset.id} className={`p-5 rounded-lg border-2 ${isEditing ? 'border-[#6d28d9] bg-white' : 'border-gray-200 bg-white'}`}>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                          <TrendingUp className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <p className="text-gray-900">{asset.name || `Asset ${index + 1}`}</p>
                          {!isEditing && asset.type && (
                            <p className="text-sm text-gray-600">
                              {isOtherType ? asset.customType : asset.type} • {formatCurrency(asset.value || 0)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {!isEditing ? (
                          <div className="contents">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => editAsset(asset.id)}
                              className="border-[#6d28d9] text-[#6d28d9] hover:bg-[#6d28d9]/10"
                            >
                              <Edit2 className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => confirmDeleteAsset(asset.id)}
                              className="border-red-600 text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="contents">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => cancelEditAsset(asset.id)}
                              className="border-gray-300 text-gray-700 hover:bg-gray-50"
                            >
                              <X className="h-4 w-4 mr-1" />
                              Cancel
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => saveAsset(asset.id)}
                              disabled={!isValid}
                              className={`${!isValid ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-[#6d28d9] text-white hover:bg-[#5b21b6]'} border-[#6d28d9]`}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Save
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                          <Label htmlFor={`asset-type-${asset.id}`}>Asset Type *</Label>
                          <Select
                            value={asset.type}
                            onValueChange={(value) => updateAsset(asset.id, { type: value })}
                          >
                            <SelectTrigger id={`asset-type-${asset.id}`} className="mt-1.5">
                              <SelectValue placeholder="Select asset type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Property">Property</SelectItem>
                              <SelectItem value="Vehicle">Vehicle</SelectItem>
                              <SelectItem value="Investment">Investment</SelectItem>
                              <SelectItem value="Cash">Cash</SelectItem>
                              <SelectItem value="Retirement Savings">Retirement Savings</SelectItem>
                              <SelectItem value="Business Interest">Business Interest</SelectItem>
                              <SelectItem value="Collectibles">Collectibles</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {isOtherType && (
                          <div className="sm:col-span-2">
                            <Label htmlFor={`custom-type-${asset.id}`}>Custom Asset Type *</Label>
                            <Input
                              id={`custom-type-${asset.id}`}
                              value={asset.customType || ''}
                              onChange={(e) => updateAsset(asset.id, { customType: e.target.value })}
                              placeholder="Specify custom asset type"
                              className="mt-1.5"
                            />
                          </div>
                        )}

                        <div className="sm:col-span-2">
                          <Label htmlFor={`asset-name-${asset.id}`}>Asset Name / Description *</Label>
                          <Input
                            id={`asset-name-${asset.id}`}
                            value={asset.name}
                            onChange={(e) => updateAsset(asset.id, { name: e.target.value })}
                            placeholder="Enter asset name"
                            className="mt-1.5"
                          />
                        </div>

                        <div>
                          <Label htmlFor={`asset-value-${asset.id}`}>Current Estimated Value (R) *</Label>
                          <Input
                            id={`asset-value-${asset.id}`}
                            type="text"
                            value={assetDisplayValues[asset.id] !== undefined 
                              ? assetDisplayValues[asset.id]
                              : (asset.value ? formatCurrencyInput(asset.value.toString()) : '')
                            }
                            onChange={(e) => {
                              // Raw input only — no reformatting while typing to avoid cursor issues
                              const raw = e.target.value.replace(/[^0-9.]/g, '');
                              
                              setAssetDisplayValues((prev: Record<string, string>) => ({
                                ...prev,
                                [asset.id]: raw
                              }));
                              
                              updateAsset(asset.id, { value: parseFloat(raw) || 0 });
                            }}
                            onBlur={() => {
                              setAssetDisplayValues((prev: Record<string, string>) => {
                                const newState = { ...prev };
                                delete newState[asset.id];
                                return newState;
                              });
                            }}
                            onFocus={() => {
                              if (assetDisplayValues[asset.id] === undefined) {
                                setAssetDisplayValues((prev: Record<string, string>) => ({
                                  ...prev,
                                  [asset.id]: asset.value ? asset.value.toString() : ''
                                }));
                              }
                            }}
                            placeholder="0.00"
                            className="mt-1.5"
                          />
                        </div>

                        <div>
                          <Label htmlFor={`ownership-${asset.id}`}>Ownership Type *</Label>
                          <Select
                            value={asset.ownershipType}
                            onValueChange={(value) => updateAsset(asset.id, { ownershipType: value })}
                          >
                            <SelectTrigger id={`ownership-${asset.id}`} className="mt-1.5">
                              <SelectValue placeholder="Select ownership" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Sole">Sole</SelectItem>
                              <SelectItem value="Joint">Joint</SelectItem>
                              <SelectItem value="Trust">Trust</SelectItem>
                              <SelectItem value="Company">Company</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="sm:col-span-2">
                          <Label htmlFor={`provider-${asset.id}`}>Linked Provider or Institution</Label>
                          <Input
                            id={`provider-${asset.id}`}
                            value={asset.provider}
                            onChange={(e) => updateAsset(asset.id, { provider: e.target.value })}
                            placeholder="e.g., ABC Bank, XYZ Investments"
                            className="mt-1.5"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <Label htmlFor={`asset-desc-${asset.id}`}>Additional Details</Label>
                          <Textarea
                            id={`asset-desc-${asset.id}`}
                            value={asset.description}
                            onChange={(e) => updateAsset(asset.id, { description: e.target.value })}
                            placeholder="Any additional information"
                            className="mt-1.5"
                            rows={2}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-gray-600 font-bold font-normal">Value</p>
                            <p className="text-gray-900 text-[12px]">{formatCurrency(asset.value || 0)}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Ownership</p>
                            <p className="text-gray-900 text-[12px]">{asset.ownershipType}</p>
                          </div>
                          {asset.provider && (
                            <div>
                              <p className="text-gray-600">Provider</p>
                              <p className="text-gray-900 text-[12px]">{asset.provider}</p>
                            </div>
                          )}
                        </div>
                        {asset.description && (
                          <div className="pt-2 border-t border-gray-200">
                            <p className="text-sm text-gray-600">{asset.description}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="mt-4 p-4 rounded-lg bg-green-50 border border-green-200">
                <div className="flex items-center justify-between">
                  <span className="text-green-800">Total Assets</span>
                  <span className="text-green-600 text-lg">
                    {formatCurrency(totalAssets)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Liabilities Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <CardTitle>Liabilities</CardTitle>
                <CardDescription>Client's debts and financial obligations</CardDescription>
              </div>
            </div>
            <Button
              onClick={addLiability}
              size="sm"
              disabled={liabilitiesInEditMode.size > 0}
              className="bg-[#6d28d9] hover:bg-[#5b21b6] disabled:opacity-50 disabled:cursor-not-allowed"
              title={liabilitiesInEditMode.size > 0 ? "Please save the current liability before adding a new one" : "Add a new liability"}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Liability
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {(liabilities || []).length === 0 ? (
            <EmptyState
              icon={emptyStateConfigs.liabilities.icon}
              title={emptyStateConfigs.liabilities.title}
              description={emptyStateConfigs.liabilities.description}
              actionLabel={emptyStateConfigs.liabilities.actionLabel}
              onAction={addLiability}
              iconColor={emptyStateConfigs.liabilities.iconColor}
              iconBgColor={emptyStateConfigs.liabilities.iconBgColor}
              buttonColor={emptyStateConfigs.liabilities.buttonColor}
              buttonHoverColor={emptyStateConfigs.liabilities.buttonHoverColor}
            />
          ) : (
            <div className="space-y-4">
              {(liabilities || []).map((liability, index) => {
                const isEditing = liabilitiesInEditMode.has(liability.id);
                const isOtherType = liability.type === 'Other';
                
                // Validation
                let isValid = liability.type && liability.name && liability.provider;
                if (isOtherType) {
                  isValid = isValid && !!liability.customType;
                }
                
                return (
                  <div key={liability.id} className={`p-5 rounded-lg border-2 ${isEditing ? 'border-[#6d28d9] bg-white' : 'border-gray-200 bg-white'}`}>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center">
                          <DollarSign className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                          <p className="text-gray-900">{liability.name || `Liability ${index + 1}`}</p>
                          {!isEditing && liability.type && (
                            <p className="text-sm text-gray-600">
                              {isOtherType ? liability.customType : liability.type} • {formatCurrency(liability.outstandingBalance || 0)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {!isEditing ? (
                          <div className="contents">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => editLiability(liability.id)}
                              className="border-[#6d28d9] text-[#6d28d9] hover:bg-[#6d28d9]/10"
                            >
                              <Edit2 className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => confirmDeleteLiability(liability.id)}
                              className="border-red-600 text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="contents">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => cancelEditLiability(liability.id)}
                              className="border-gray-300 text-gray-700 hover:bg-gray-50"
                            >
                              <X className="h-4 w-4 mr-1" />
                              Cancel
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => saveLiability(liability.id)}
                              disabled={!isValid}
                              className={`${!isValid ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-[#6d28d9] text-white hover:bg-[#5b21b6]'} border-[#6d28d9]`}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Save
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                          <Label htmlFor={`liability-type-${liability.id}`}>Liability Type *</Label>
                          <Select
                            value={liability.type}
                            onValueChange={(value) => updateLiability(liability.id, { type: value })}
                          >
                            <SelectTrigger id={`liability-type-${liability.id}`} className="mt-1.5">
                              <SelectValue placeholder="Select liability type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Home Loan">Home Loan</SelectItem>
                              <SelectItem value="Vehicle Finance">Vehicle Finance</SelectItem>
                              <SelectItem value="Credit Card">Credit Card</SelectItem>
                              <SelectItem value="Personal Loan">Personal Loan</SelectItem>
                              <SelectItem value="Student Loan">Student Loan</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {isOtherType && (
                          <div className="sm:col-span-2">
                            <Label htmlFor={`custom-liability-type-${liability.id}`}>Custom Liability Type *</Label>
                            <Input
                              id={`custom-liability-type-${liability.id}`}
                              value={liability.customType || ''}
                              onChange={(e) => updateLiability(liability.id, { customType: e.target.value })}
                              placeholder="Specify custom liability type"
                              className="mt-1.5"
                            />
                          </div>
                        )}

                        <div className="sm:col-span-2">
                          <Label htmlFor={`liability-name-${liability.id}`}>Liability Name / Description *</Label>
                          <Input
                            id={`liability-name-${liability.id}`}
                            value={liability.name}
                            onChange={(e) => updateLiability(liability.id, { name: e.target.value })}
                            placeholder="Enter liability name"
                            className="mt-1.5"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <Label htmlFor={`liability-provider-${liability.id}`}>Provider / Bank *</Label>
                          <Input
                            id={`liability-provider-${liability.id}`}
                            value={liability.provider}
                            onChange={(e) => updateLiability(liability.id, { provider: e.target.value })}
                            placeholder="e.g., Standard Bank, ABSA"
                            className="mt-1.5"
                          />
                        </div>

                        <div>
                          <Label htmlFor={`outstanding-${liability.id}`}>Outstanding Balance (R) *</Label>
                          <Input
                            id={`outstanding-${liability.id}`}
                            type="text"
                            value={liabilityDisplayValues[liability.id]?.amount !== undefined
                              ? liabilityDisplayValues[liability.id].amount
                              : (liability.outstandingBalance ? formatCurrencyInput(liability.outstandingBalance.toString()) : '')
                            }
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^0-9.]/g, '');
                              
                              setLiabilityDisplayValues((prev: Record<string, string>) => ({
                                ...prev,
                                [liability.id]: {
                                  ...prev[liability.id],
                                  amount: raw
                                }
                              }));
                              
                              updateLiability(liability.id, { outstandingBalance: parseFloat(raw) || 0 });
                            }}
                            onBlur={() => {
                              setLiabilityDisplayValues((prev: Record<string, string>) => {
                                const newState = { ...prev };
                                if (newState[liability.id]) {
                                  delete newState[liability.id].amount;
                                  if (Object.keys(newState[liability.id]).length === 0) {
                                    delete newState[liability.id];
                                  }
                                }
                                return newState;
                              });
                            }}
                            onFocus={() => {
                              const currentDisplay = liabilityDisplayValues[liability.id]?.amount;
                              if (currentDisplay === undefined) {
                                setLiabilityDisplayValues((prev: Record<string, string>) => ({
                                  ...prev,
                                  [liability.id]: {
                                    ...prev[liability.id],
                                    amount: liability.outstandingBalance ? liability.outstandingBalance.toString() : ''
                                  }
                                }));
                              }
                            }}
                            placeholder="0.00"
                            className="mt-1.5"
                          />
                        </div>

                        <div>
                          <Label htmlFor={`monthly-payment-${liability.id}`}>Monthly Repayment (R) *</Label>
                          <Input
                            id={`monthly-payment-${liability.id}`}
                            type="text"
                            value={liabilityDisplayValues[liability.id]?.monthlyPayment !== undefined
                              ? liabilityDisplayValues[liability.id].monthlyPayment
                              : (liability.monthlyPayment ? formatCurrencyInput(liability.monthlyPayment.toString()) : '')
                            }
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^0-9.]/g, '');
                              
                              setLiabilityDisplayValues((prev: Record<string, string>) => ({
                                ...prev,
                                [liability.id]: {
                                  ...prev[liability.id],
                                  monthlyPayment: raw
                                }
                              }));
                              
                              updateLiability(liability.id, { monthlyPayment: parseFloat(raw) || 0 });
                            }}
                            onBlur={() => {
                              setLiabilityDisplayValues((prev: Record<string, string>) => {
                                const newState = { ...prev };
                                if (newState[liability.id]) {
                                  delete newState[liability.id].monthlyPayment;
                                  if (Object.keys(newState[liability.id]).length === 0) {
                                    delete newState[liability.id];
                                  }
                                }
                                return newState;
                              });
                            }}
                            onFocus={() => {
                              const currentDisplay = liabilityDisplayValues[liability.id]?.monthlyPayment;
                              if (currentDisplay === undefined) {
                                setLiabilityDisplayValues((prev: Record<string, string>) => ({
                                  ...prev,
                                  [liability.id]: {
                                    ...prev[liability.id],
                                    monthlyPayment: liability.monthlyPayment ? liability.monthlyPayment.toString() : ''
                                  }
                                }));
                              }
                            }}
                            placeholder="0.00"
                            className="mt-1.5"
                          />
                        </div>

                        <div>
                          <Label htmlFor={`interest-rate-${liability.id}`}>Interest Rate (%)</Label>
                          <Input
                            id={`interest-rate-${liability.id}`}
                            type="number"
                            step="0.01"
                            value={liability.interestRate || ''}
                            onChange={(e) => updateLiability(liability.id, { interestRate: parseFloat(e.target.value) || 0 })}
                            placeholder="0.00"
                            className="mt-1.5"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <Label htmlFor={`liability-desc-${liability.id}`}>Additional Details</Label>
                          <Textarea
                            id={`liability-desc-${liability.id}`}
                            value={liability.description}
                            onChange={(e) => updateLiability(liability.id, { description: e.target.value })}
                            placeholder="Any additional information"
                            className="mt-1.5"
                            rows={2}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-gray-600">Outstanding Balance</p>
                            <p className="text-gray-900 text-[12px]">{formatCurrency(liability.outstandingBalance || 0)}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Monthly Payment</p>
                            <p className="text-gray-900 text-[12px]">{formatCurrency(liability.monthlyPayment || 0)}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Provider</p>
                            <p className="text-gray-900 text-[12px]">{liability.provider}</p>
                          </div>
                          {liability.interestRate > 0 && (
                            <div>
                              <p className="text-gray-600">Interest Rate</p>
                              <p className="text-gray-900 text-[12px]">{liability.interestRate}%</p>
                            </div>
                          )}
                        </div>
                        {liability.description && (
                          <div className="pt-2 border-t border-gray-200">
                            <p className="text-sm text-gray-600">{liability.description}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="mt-4 p-4 rounded-lg bg-red-50 border border-red-200">
                <div className="flex items-center justify-between">
                  <span className="text-red-800">Total Liabilities</span>
                  <span className="text-red-600 text-lg">
                    {formatCurrency(totalLiabilities)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Net Worth Summary */}
      {(assets.length > 0 || liabilities.length > 0) && (
        <Card className="border-[#6d28d9]/30 bg-gradient-to-br from-[#6d28d9]/5 to-transparent">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-[#6d28d9]/10 flex items-center justify-center">
                  <PieChart className="h-6 w-6 text-[#6d28d9]" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Net Worth</p>
                  <p className={`text-2xl ${netWorth >= 0 ? 'text-[#6d28d9]' : 'text-red-600'}`}>
                    {formatCurrency(netWorth)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Delete Asset Confirmation Dialog */}
      <AlertDialog open={assetToDelete !== null} onOpenChange={(open) => !open && setAssetToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Asset</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this asset? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAssetToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={removeAsset}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Liability Confirmation Dialog */}
      <AlertDialog open={liabilityToDelete !== null} onOpenChange={(open) => !open && setLiabilityToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Liability</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this liability? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setLiabilityToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={removeLiability}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}