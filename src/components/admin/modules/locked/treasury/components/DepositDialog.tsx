/**
 * Deposit dialog — pull money INTO the financial account via an InboundTransfer
 * from a linked external bank account (origin payment method).
 */

import { useEffect, useState } from 'react';
import { Button } from '../../../../../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../../ui/dialog';
import { Input } from '../../../../../ui/input';
import { Label } from '../../../../../ui/label';
import { formatMinor, parseToMinor } from '../constants';
import type { DepositInput } from '../types';

interface DepositDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currency: string;
  onSubmit: (input: DepositInput) => void;
  isSubmitting: boolean;
}

export function DepositDialog({
  open,
  onOpenChange,
  currency,
  onSubmit,
  isSubmitting,
}: DepositDialogProps) {
  const [amount, setAmount] = useState('');
  const [originPaymentMethod, setOriginPaymentMethod] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (open) {
      setAmount('');
      setOriginPaymentMethod('');
      setDescription('');
    }
  }, [open]);

  const amountMinor = parseToMinor(amount);
  const canSubmit = !!amountMinor && !!originPaymentMethod.trim() && !isSubmitting;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amountMinor || !originPaymentMethod.trim() || isSubmitting) return;
    onSubmit({
      amount: amountMinor,
      currency,
      originPaymentMethod: originPaymentMethod.trim(),
      description: description.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Deposit funds</DialogTitle>
          <DialogDescription>
            Pull money into the financial account from a linked external bank account.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="deposit-amount">Amount</Label>
            <Input
              id="deposit-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              autoFocus
            />
            {amountMinor ? (
              <p className="text-xs text-muted-foreground">{formatMinor(amountMinor, currency)}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="deposit-origin">Origin payment method</Label>
            <Input
              id="deposit-origin"
              value={originPaymentMethod}
              onChange={(e) => setOriginPaymentMethod(e.target.value)}
              placeholder="pm_…"
            />
            <p className="text-xs text-muted-foreground">
              The linked external bank account's payment method ID to debit.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="deposit-description">Description (optional)</Label>
            <Input
              id="deposit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Top up"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {isSubmitting ? 'Processing…' : 'Deposit'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
