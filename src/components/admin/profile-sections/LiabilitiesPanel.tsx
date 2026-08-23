/**
 * Liabilities card of the admin assets & liabilities section. Pure view
 * over props from AssetsLiabilitiesSection.
 */
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Textarea } from '../../ui/textarea';
import { Button } from '../../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { DollarSign, Plus, Edit2, Trash2, X, Check } from 'lucide-react';
import { EmptyState } from '../../pages/profile/EmptyState';
import { emptyStateConfigs } from '../../pages/profile/emptyStateConfigs';
import { useInlineEditDialogClose } from '../../shared/unsaved-changes';

import { DetailChip } from './assetsLiabilitiesShared';
import { getLiabilityTypeLabel } from './assetsLiabilitiesLabels';
import type { Liability } from './assetsLiabilitiesTypes';

interface LiabilitiesPanelProps {
  liabilities: Liability[];
  totalLiabilities: number;
  liabilitiesInEditMode: Set<string>;
  liabilityDisplayValues: { [id: string]: { amount?: string; monthlyPayment?: string } };
  setLiabilityDisplayValues: React.Dispatch<
    React.SetStateAction<{ [id: string]: { amount?: string; monthlyPayment?: string } }>
  >;
  liabilityEditGuard: ReturnType<typeof useInlineEditDialogClose>;
  formatCurrency: (value: number) => string;
  formatCurrencyInput: (value: string) => string;
  addLiability: () => void;
  updateLiability: (id: string, updates: Partial<Liability>) => void;
  saveLiability: (id: string) => void;
  editLiability: (id: string) => void;
  confirmDeleteLiability: (id: string) => void;
}

export function LiabilitiesPanel({
  liabilities,
  totalLiabilities,
  liabilitiesInEditMode,
  liabilityDisplayValues,
  setLiabilityDisplayValues,
  liabilityEditGuard,
  formatCurrency,
  formatCurrencyInput,
  addLiability,
  updateLiability,
  saveLiability,
  editLiability,
  confirmDeleteLiability,
}: LiabilitiesPanelProps) {
  return (
    <Card className="border-gray-200 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100">
              <DollarSign className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <CardTitle className="text-xl">Liabilities</CardTitle>
              <CardDescription>Client's debts and financial obligations</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-red-50 px-3 py-1 text-sm font-medium text-red-700">
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
      <CardContent className="space-y-3">
        {liabilities.length === 0 ? (
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
          liabilities.map((liability, index) => {
            const isEditing = liabilitiesInEditMode.has(liability.id);
            const isOtherType = liability.type === 'Other';
            let isValid: string | boolean | undefined =
              liability.type && liability.name && liability.provider;
            if (isOtherType) {
              isValid = isValid && liability.customType;
            }

            return (
              <React.Fragment key={liability.id}>
                <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 transition-colors hover:border-gray-300">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-100">
                        <DollarSign className="h-5 w-5 text-red-600" />
                      </div>
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="text-sm font-semibold text-gray-900">
                            {liability.name || `Liability ${index + 1}`}
                          </p>
                          <span className="text-xs text-gray-500">
                            {getLiabilityTypeLabel(liability)}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <DetailChip
                            label="Outstanding"
                            value={formatCurrency(liability.outstandingBalance || 0)}
                          />
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
                    <div className="flex shrink-0 items-center gap-2 self-end lg:self-start">
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
                        Update the client's liability details without stretching the whole page.
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
                            const raw = e.target.value.replace(/[^0-9.]/g, '');
                            setLiabilityDisplayValues((prev) => ({
                              ...prev,
                              [liability.id]: {
                                ...prev[liability.id],
                                amount: raw,
                              },
                            }));
                            updateLiability(liability.id, {
                              outstandingBalance: parseFloat(raw) || 0,
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
                          onFocus={() => {
                            const currentDisplay = liabilityDisplayValues[liability.id]?.amount;
                            if (currentDisplay === undefined) {
                              setLiabilityDisplayValues((prev) => ({
                                ...prev,
                                [liability.id]: {
                                  ...prev[liability.id],
                                  amount: liability.outstandingBalance
                                    ? liability.outstandingBalance.toString()
                                    : '',
                                },
                              }));
                            }
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
                            const raw = e.target.value.replace(/[^0-9.]/g, '');
                            setLiabilityDisplayValues((prev) => ({
                              ...prev,
                              [liability.id]: {
                                ...prev[liability.id],
                                monthlyPayment: raw,
                              },
                            }));
                            updateLiability(liability.id, {
                              monthlyPayment: parseFloat(raw) || 0,
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
                          onFocus={() => {
                            const currentDisplay =
                              liabilityDisplayValues[liability.id]?.monthlyPayment;
                            if (currentDisplay === undefined) {
                              setLiabilityDisplayValues((prev) => ({
                                ...prev,
                                [liability.id]: {
                                  ...prev[liability.id],
                                  monthlyPayment: liability.monthlyPayment
                                    ? liability.monthlyPayment.toString()
                                    : '',
                                },
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
