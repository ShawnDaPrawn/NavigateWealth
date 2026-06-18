/**
 * Send dialog — pay money OUT of the financial account via an OutboundPayment
 * to an external recipient. Money movement is irreversible, so this is a
 * two-step flow: the form, then an explicit confirmation screen.
 */

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
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
import type { SendInput } from '../types';

interface SendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currency: string;
  onSubmit: (input: SendInput) => void;
  isSubmitting: boolean;
}

export function SendDialog({
  open,
  onOpenChange,
  currency,
  onSubmit,
  isSubmitting,
}: SendDialogProps) {
  const [amount, setAmount] = useState('');
  const [destinationPaymentMethod, setDestinationPaymentMethod] = useState('');
  const [customer, setCustomer] = useState('');
  const [description, setDescription] = useState('');
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount('');
      setDestinationPaymentMethod('');
      setCustomer('');
      setDescription('');
      setConfirming(false);
    }
  }, [open]);

  const amountMinor = parseToMinor(amount);
  const canContinue = !!amountMinor && !!destinationPaymentMethod.trim();

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canContinue) return;
    setConfirming(true);
  };

  const handleConfirm = () => {
    if (!amountMinor || !destinationPaymentMethod.trim() || isSubmitting) return;
    onSubmit({
      amount: amountMinor,
      currency,
      destinationPaymentMethod: destinationPaymentMethod.trim(),
      customer: customer.trim() || undefined,
      description: description.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {!confirming ? (
          <>
            <DialogHeader>
              <DialogTitle>Send payment</DialogTitle>
              <DialogDescription>
                Pay money out of the financial account to an external recipient.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleContinue} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="send-amount">Amount</Label>
                <Input
                  id="send-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  autoFocus
                />
                {amountMinor ? (
                  <p className="text-xs text-muted-foreground">
                    {formatMinor(amountMinor, currency)}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="send-destination">Destination payment method</Label>
                <Input
                  id="send-destination"
                  value={destinationPaymentMethod}
                  onChange={(e) => setDestinationPaymentMethod(e.target.value)}
                  placeholder="pm_…"
                />
                <p className="text-xs text-muted-foreground">
                  The recipient's payment method ID to pay.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="send-customer">Customer ID (for reusable pm_…)</Label>
                <Input
                  id="send-customer"
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                  placeholder="cus_…"
                />
                <p className="text-xs text-muted-foreground">
                  Required when the destination is a reusable payment method attached to a customer.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="send-description">Description (optional)</Label>
                <Input
                  id="send-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Supplier payment"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!canContinue}>
                  Continue
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Confirm payment
              </DialogTitle>
              <DialogDescription>
                This moves money out of the financial account and cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border bg-muted/40 p-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-semibold">
                  {amountMinor ? formatMinor(amountMinor, currency) : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">To</span>
                <span className="font-mono text-xs truncate">{destinationPaymentMethod}</span>
              </div>
              {customer.trim() ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Customer</span>
                  <span className="font-mono text-xs truncate">{customer.trim()}</span>
                </div>
              ) : null}
              {description.trim() ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Description</span>
                  <span className="truncate">{description.trim()}</span>
                </div>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirming(false)}
                disabled={isSubmitting}
              >
                Back
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleConfirm}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Sending…' : 'Confirm & send'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
