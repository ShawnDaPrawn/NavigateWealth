/**
 * Liabilities card of the admin assets & liabilities section (design: the
 * "Assets & liabilities redesign" canvas): one table, Edit and Delete under
 * ⋯ on each row. Pure view over props from AssetsLiabilitiesSection.
 */
import React from 'react';
import { Input } from '../../ui/input';
import { CurrencyInputField } from '../../ui/currency-input';
import { NumberInputField } from '../../ui/number-input';
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
import { Check, CreditCard, X } from 'lucide-react';
import { useInlineEditDialogClose } from '../../shared/unsaved-changes';

import {
  BalanceCard,
  PanelEmptyState,
  RowActionsMenu,
  TD,
  TD_ACTIONS,
  TD_NUM,
  TH,
  TH_NUM,
} from './assetsLiabilitiesShared';
import { getLiabilityTypeLabel } from '../../../shared/formatting';
import type { Liability } from '../../../shared/types';

interface LiabilitiesPanelProps {
  liabilities: Liability[];
  totalLiabilities: number;
  liabilitiesInEditMode: Set<string>;
  liabilityEditGuard: ReturnType<typeof useInlineEditDialogClose>;
  formatCurrency: (value: number) => string;
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
  liabilityEditGuard,
  formatCurrency,
  addLiability,
  updateLiability,
  saveLiability,
  editLiability,
  confirmDeleteLiability,
}: LiabilitiesPanelProps) {
  const addBlocked = liabilitiesInEditMode.size > 0;
  const totalMonthly = liabilities.reduce((sum, l) => sum + (l.monthlyPayment || 0), 0);

  return (
    <BalanceCard
      id="admin-liabilities-heading"
      title="Liabilities"
      addLabel="Add liability"
      onAdd={addLiability}
      addDisabled={addBlocked}
      addTitle={addBlocked ? 'Save the liability you are editing first' : undefined}
    >
      {liabilities.length === 0 ? (
        <PanelEmptyState
          icon={CreditCard}
          title="No liabilities yet"
          description="Add bonds, loans and credit cards so net worth is right."
          actionLabel="Add liability"
          onAction={addLiability}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead className="bg-nw-paper-3">
              <tr>
                <th scope="col" className={TH}>
                  Liability
                </th>
                <th scope="col" className={TH}>
                  Type
                </th>
                <th scope="col" className={TH}>
                  Provider
                </th>
                <th scope="col" className={TH_NUM}>
                  Interest
                </th>
                <th scope="col" className={TH_NUM}>
                  Monthly
                </th>
                <th scope="col" className={TH_NUM}>
                  Outstanding
                </th>
                <th scope="col" className={TH}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {liabilities.map((liability, index) => {
                const name = liability.name || `Liability ${index + 1}`;
                return (
                  <tr key={liability.id} className="transition-colors hover:bg-nw-paper-3">
                    <td className={TD}>
                      <p className="font-semibold text-nw-ink">{name}</p>
                      {liability.description && (
                        <p className="mt-0.5 max-w-xs text-[13px] leading-[18px] text-nw-muted">
                          {liability.description}
                        </p>
                      )}
                    </td>
                    <td className={TD}>{getLiabilityTypeLabel(liability)}</td>
                    <td className={`${TD} text-nw-text`}>{liability.provider || '—'}</td>
                    <td className={TD_NUM}>
                      {liability.interestRate > 0 ? `${liability.interestRate}%` : '—'}
                    </td>
                    <td className={TD_NUM}>{formatCurrency(liability.monthlyPayment || 0)}</td>
                    <td className={TD_NUM}>{formatCurrency(liability.outstandingBalance || 0)}</td>
                    <td className={TD_ACTIONS}>
                      <RowActionsMenu
                        name={name}
                        onEdit={() => {
                          liabilityEditGuard.trackEditStart(liability.id);
                          editLiability(liability.id);
                        }}
                        onDelete={() => confirmDeleteLiability(liability.id)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} className="px-5 py-3.5 font-semibold text-nw-ink">
                  Total liabilities
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-right font-semibold tabular-nums text-nw-ink">
                  {formatCurrency(totalMonthly)}
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-right font-semibold tabular-nums text-nw-ink">
                  {formatCurrency(totalLiabilities)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {liabilities.map((liability, index) => {
        const isEditing = liabilitiesInEditMode.has(liability.id);
        const isOtherType = liability.type === 'Other';
        let isValid: string | boolean | undefined =
          liability.type && liability.name && liability.provider;
        if (isOtherType) {
          isValid = isValid && liability.customType;
        }
        return (
          <React.Fragment key={`edit-${liability.id}`}>
            <Dialog
              open={isEditing}
              onOpenChange={(open) => liabilityEditGuard.handleDialogOpenChange(liability.id, open)}
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
                    <CurrencyInputField
                      id={`outstanding-${liability.id}`}
                      value={liability.outstandingBalance}
                      onValueChange={(v) =>
                        updateLiability(liability.id, { outstandingBalance: v ?? 0 })
                      }
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`monthly-payment-${liability.id}`}>
                      Monthly Repayment (R) *
                    </Label>
                    <CurrencyInputField
                      id={`monthly-payment-${liability.id}`}
                      value={liability.monthlyPayment}
                      onValueChange={(v) =>
                        updateLiability(liability.id, { monthlyPayment: v ?? 0 })
                      }
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`interest-rate-${liability.id}`}>Interest Rate (%)</Label>
                    <NumberInputField
                      id={`interest-rate-${liability.id}`}
                      decimals={2}
                      value={liability.interestRate || ''}
                      onValueChange={(v) => updateLiability(liability.id, { interestRate: v ?? 0 })}
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
                    onClick={() => liabilityEditGuard.handleDialogOpenChange(liability.id, false)}
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
      })}
    </BalanceCard>
  );
}
