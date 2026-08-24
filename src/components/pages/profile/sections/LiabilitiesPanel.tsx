/**
 * Liabilities card of the assets & liabilities section: the liability rows
 * with inline edit and add-liability. Pure view over props from
 * AssetsLiabilitiesSection.
 */
import React from 'react';
import type { ProfileData, Liability } from '../types';
import { EmptyState } from '../EmptyState';
import { emptyStateConfigs } from '../emptyStateConfigs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/card';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import { Button } from '../../../ui/button';
import { Textarea } from '../../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../ui/dialog';
import {
  formatCurrency,
  formatCurrencyInput,
  cleanCurrencyInput,
} from '../../../../utils/currencyFormatter';
import { DollarSign, Plus, Edit2, Trash2, X, Check, Landmark } from 'lucide-react';
import { useInlineEditDialogClose } from '../../../shared/unsaved-changes';

import { DetailChip } from './assetsLiabilitiesShared';
import { getLiabilityTypeLabel } from './assetsLiabilitiesLabels';

interface LiabilitiesPanelProps {
  profileData: ProfileData;
  totalLiabilities: number;
  liabilitiesInEditMode: Set<string>;
  liabilityDisplayValues: { [id: string]: { amount?: string; monthlyPayment?: string } };
  setLiabilityDisplayValues: React.Dispatch<
    React.SetStateAction<{ [id: string]: { amount?: string; monthlyPayment?: string } }>
  >;
  liabilityEditGuard: ReturnType<typeof useInlineEditDialogClose>;
  addLiability: () => void;
  updateLiability: (id: string, updates: Partial<Liability>) => void;
  saveLiability: (id: string) => void;
  editLiability: (id: string) => void;
  confirmDeleteLiability: (id: string) => void;
}

export function LiabilitiesPanel({
  profileData,
  totalLiabilities,
  liabilitiesInEditMode,
  liabilityDisplayValues,
  setLiabilityDisplayValues,
  liabilityEditGuard,
  addLiability,
  updateLiability,
  saveLiability,
  editLiability,
  confirmDeleteLiability,
}: LiabilitiesPanelProps) {
  return (
    <Card className="h-full border-gray-200 shadow-sm">
      <CardHeader className="border-b border-gray-100 bg-gradient-to-br from-red-50 via-white to-white pb-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-100">
              <Landmark className="h-5 w-5 text-red-700" />
            </div>
            <div>
              <CardTitle className="text-xl">Liabilities</CardTitle>
              <CardDescription>What you owe and the monthly pressure it creates</CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">
              {formatCurrency(totalLiabilities)}
            </div>
            <Button
              onClick={addLiability}
              size="sm"
              disabled={liabilitiesInEditMode.size > 0}
              className="bg-[#6d28d9] hover:bg-[#5b21b6] disabled:cursor-not-allowed disabled:opacity-50"
              title={
                liabilitiesInEditMode.size > 0
                  ? 'Please save the current liability before adding a new one'
                  : 'Add a new liability'
              }
            >
              <Plus className="mr-1 h-4 w-4" />
              Add Liability
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        {profileData.liabilities.length === 0 ? (
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
          profileData.liabilities.map((liability, index) => {
            const isEditing = liabilitiesInEditMode.has(liability.id);
            const isOtherType = liability.type === 'Other';
            let isValid: string | boolean | undefined =
              liability.type && liability.name && liability.provider;
            if (isOtherType) {
              isValid = isValid && liability.customType;
            }

            return (
              <React.Fragment key={liability.id}>
                <div className="rounded-2xl border border-gray-200 bg-white p-4 transition-colors hover:border-red-200 hover:bg-red-50/25">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-100">
                        <DollarSign className="h-5 w-5 text-red-700" />
                      </div>
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="text-base font-semibold text-gray-950">
                            {liability.name || `Liability ${index + 1}`}
                          </p>
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                            {getLiabilityTypeLabel(liability)}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <DetailChip
                            label="Monthly"
                            value={formatCurrency(liability.monthlyPayment || 0)}
                          />
                          <DetailChip label="Provider" value={liability.provider || 'Not set'} />
                          {liability.interestRate > 0 && (
                            <DetailChip label="Interest" value={`${liability.interestRate}%`} />
                          )}
                        </div>
                        {liability.description && (
                          <p className="text-xs leading-relaxed text-gray-500">
                            {liability.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-3 self-end lg:self-start">
                      <div className="text-right">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-red-700/70">
                          Outstanding
                        </p>
                        <p className="text-lg font-semibold text-red-950">
                          {formatCurrency(liability.outstandingBalance || 0)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            liabilityEditGuard.trackEditStart(liability.id);
                            editLiability(liability.id);
                          }}
                          className="border-[#6d28d9] text-[#6d28d9] hover:bg-[#6d28d9]/10"
                        >
                          <Edit2 className="mr-1 h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => confirmDeleteLiability(liability.id)}
                          className="border-red-200 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <Dialog
                  open={isEditing}
                  onOpenChange={(open) =>
                    liabilityEditGuard.handleDialogOpenChange(liability.id, open)
                  }
                >
                  <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>{liability.name || `Liability ${index + 1}`}</DialogTitle>
                      <DialogDescription>
                        Update the liability details without stretching the page.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                          <Label htmlFor={`custom-liability-type-${liability.id}`}>
                            Custom Liability Type *
                          </Label>
                          <Input
                            id={`custom-liability-type-${liability.id}`}
                            value={liability.customType || ''}
                            onChange={(e) =>
                              updateLiability(liability.id, { customType: e.target.value })
                            }
                            placeholder="Specify custom liability type"
                            className="mt-1.5"
                          />
                        </div>
                      )}
                      <div className="sm:col-span-2">
                        <Label htmlFor={`liability-name-${liability.id}`}>
                          Liability Name / Description *
                        </Label>
                        <Input
                          id={`liability-name-${liability.id}`}
                          value={liability.name}
                          onChange={(e) => updateLiability(liability.id, { name: e.target.value })}
                          placeholder="Enter liability name"
                          className="mt-1.5"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Label htmlFor={`liability-provider-${liability.id}`}>
                          Provider / Bank *
                        </Label>
                        <Input
                          id={`liability-provider-${liability.id}`}
                          value={liability.provider}
                          onChange={(e) =>
                            updateLiability(liability.id, { provider: e.target.value })
                          }
                          placeholder="e.g., Standard Bank, ABSA"
                          className="mt-1.5"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`outstanding-${liability.id}`}>
                          Outstanding Balance (R) *
                        </Label>
                        <Input
                          id={`outstanding-${liability.id}`}
                          type="text"
                          value={
                            liabilityDisplayValues[liability.id]?.amount !== undefined
                              ? liabilityDisplayValues[liability.id].amount
                              : liability.outstandingBalance
                                ? formatCurrencyInput(liability.outstandingBalance.toString())
                                : ''
                          }
                          onChange={(e) => {
                            const formattedDisplay = formatCurrencyInput(e.target.value);
                            setLiabilityDisplayValues((prev) => ({
                              ...prev,
                              [liability.id]: {
                                ...prev[liability.id],
                                amount: formattedDisplay,
                              },
                            }));
                            const cleanValue = cleanCurrencyInput(formattedDisplay);
                            updateLiability(liability.id, {
                              outstandingBalance: parseFloat(cleanValue) || 0,
                            });
                          }}
                          onBlur={() => {
                            setLiabilityDisplayValues((prev) => {
                              const nextValues = { ...prev };
                              if (nextValues[liability.id]) {
                                delete nextValues[liability.id].amount;
                                if (Object.keys(nextValues[liability.id]).length === 0) {
                                  delete nextValues[liability.id];
                                }
                              }
                              return nextValues;
                            });
                          }}
                          placeholder="0.00"
                          className="mt-1.5"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`monthly-payment-${liability.id}`}>
                          Monthly Repayment (R) *
                        </Label>
                        <Input
                          id={`monthly-payment-${liability.id}`}
                          type="text"
                          value={
                            liabilityDisplayValues[liability.id]?.monthlyPayment !== undefined
                              ? liabilityDisplayValues[liability.id].monthlyPayment
                              : liability.monthlyPayment
                                ? formatCurrencyInput(liability.monthlyPayment.toString())
                                : ''
                          }
                          onChange={(e) => {
                            const formattedDisplay = formatCurrencyInput(e.target.value);
                            setLiabilityDisplayValues((prev) => ({
                              ...prev,
                              [liability.id]: {
                                ...prev[liability.id],
                                monthlyPayment: formattedDisplay,
                              },
                            }));
                            const cleanValue = cleanCurrencyInput(formattedDisplay);
                            updateLiability(liability.id, {
                              monthlyPayment: parseFloat(cleanValue) || 0,
                            });
                          }}
                          onBlur={() => {
                            setLiabilityDisplayValues((prev) => {
                              const nextValues = { ...prev };
                              if (nextValues[liability.id]) {
                                delete nextValues[liability.id].monthlyPayment;
                                if (Object.keys(nextValues[liability.id]).length === 0) {
                                  delete nextValues[liability.id];
                                }
                              }
                              return nextValues;
                            });
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
                          onChange={(e) =>
                            updateLiability(liability.id, {
                              interestRate: parseFloat(e.target.value) || 0,
                            })
                          }
                          placeholder="0.00"
                          className="mt-1.5"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Label htmlFor={`liability-desc-${liability.id}`}>Additional Details</Label>
                        <Textarea
                          id={`liability-desc-${liability.id}`}
                          value={liability.description}
                          onChange={(e) =>
                            updateLiability(liability.id, { description: e.target.value })
                          }
                          placeholder="Any additional information"
                          className="mt-1.5"
                          rows={3}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() =>
                          liabilityEditGuard.handleDialogOpenChange(liability.id, false)
                        }
                        className="border-gray-300 text-gray-700 hover:bg-gray-50"
                      >
                        <X className="mr-1 h-4 w-4" />
                        Cancel
                      </Button>
                      <Button
                        onClick={() => {
                          liabilityEditGuard.clearSnapshot(liability.id);
                          saveLiability(liability.id);
                        }}
                        disabled={!isValid}
                        className={
                          !isValid
                            ? 'cursor-not-allowed bg-gray-300 text-gray-500 hover:bg-gray-300'
                            : 'bg-[#6d28d9] text-white hover:bg-[#5b21b6]'
                        }
                      >
                        <Check className="mr-1 h-4 w-4" />
                        Save Liability
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </React.Fragment>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
