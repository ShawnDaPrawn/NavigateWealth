/**
 * Create-card dialog — issue an active virtual card to an existing cardholder,
 * with an optional spending limit.
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../../ui/select';
import { SPENDING_LIMIT_INTERVALS, formatMinor, parseToMinor } from '../constants';
import type { Cardholder, CardInput, SpendingLimitInterval } from '../types';

interface CreateCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardholders: Cardholder[];
  onSubmit: (input: CardInput) => void;
  isSubmitting: boolean;
}

export function CreateCardDialog({
  open,
  onOpenChange,
  cardholders,
  onSubmit,
  isSubmitting,
}: CreateCardDialogProps) {
  const [cardholderId, setCardholderId] = useState('');
  const [limitAmount, setLimitAmount] = useState('');
  const [limitInterval, setLimitInterval] = useState<SpendingLimitInterval>('monthly');

  useEffect(() => {
    if (open) {
      setCardholderId('');
      setLimitAmount('');
      setLimitInterval('monthly');
    }
  }, [open]);

  const limitMinor = limitAmount.trim() ? parseToMinor(limitAmount) : null;
  const limitInvalid = limitAmount.trim().length > 0 && !limitMinor;
  const canSubmit = !!cardholderId && !limitInvalid && !isSubmitting;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      cardholderId,
      ...(limitMinor
        ? { spendingLimitAmount: limitMinor, spendingLimitInterval: limitInterval }
        : {}),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create virtual card</DialogTitle>
          <DialogDescription>Issue an active virtual card to a cardholder.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="card-cardholder">Cardholder</Label>
            {cardholders.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No cardholders yet — create one first.
              </p>
            ) : (
              <Select value={cardholderId || undefined} onValueChange={setCardholderId}>
                <SelectTrigger id="card-cardholder">
                  <SelectValue placeholder="Select a cardholder" />
                </SelectTrigger>
                <SelectContent>
                  {cardholders.map((ch) => (
                    <SelectItem key={ch.id} value={ch.id}>
                      {ch.name} ({ch.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="card-limit">Spending limit (optional)</Label>
            <div className="flex gap-2">
              <Input
                id="card-limit"
                inputMode="decimal"
                value={limitAmount}
                onChange={(e) => setLimitAmount(e.target.value)}
                placeholder="0.00"
                className="flex-1"
              />
              <Select
                value={limitInterval}
                onValueChange={(v) => setLimitInterval(v as SpendingLimitInterval)}
              >
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SPENDING_LIMIT_INTERVALS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {limitInvalid ? (
              <p className="text-xs text-destructive">Enter a valid positive amount.</p>
            ) : limitMinor ? (
              <p className="text-xs text-muted-foreground">
                {formatMinor(limitMinor)} {limitInterval.replace(/_/g, ' ')}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {isSubmitting ? 'Creating…' : 'Create card'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
