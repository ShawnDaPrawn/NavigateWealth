/**
 * Create / edit dialog for a refund cluster (name, description, VAT category).
 *
 * The VAT category is a cluster-level setting shared by every entity in the
 * cluster — it drives each entity's "current period" VAT summary.
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
import { Textarea } from '../../../../../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../../ui/select';
import {
  MONTH_OPTIONS,
  VAT_PERIOD_OPTIONS,
  YEAR_END_DEPENDENT_CATEGORIES,
  vatPeriodDescription,
} from '../constants';
import type { RefundCluster, VatPeriodCategory } from '../types';

const DEFAULT_YEAR_END_MONTH = 2; // February — the SARS default.

interface ClusterFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set the dialog edits this cluster; otherwise it creates a new one. */
  cluster?: RefundCluster | null;
  onSubmit: (values: {
    name: string;
    description: string;
    vatPeriod: VatPeriodCategory | '';
    vatYearEndMonth: number;
  }) => void;
  isSubmitting: boolean;
}

export function ClusterFormDialog({
  open,
  onOpenChange,
  cluster,
  onSubmit,
  isSubmitting,
}: ClusterFormDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [vatPeriod, setVatPeriod] = useState<VatPeriodCategory | ''>('');
  const [vatYearEndMonth, setVatYearEndMonth] = useState<number>(DEFAULT_YEAR_END_MONTH);

  useEffect(() => {
    if (open) {
      setName(cluster?.name ?? '');
      setDescription(cluster?.description ?? '');
      setVatPeriod(cluster?.vatPeriod ?? '');
      setVatYearEndMonth(cluster?.vatYearEndMonth ?? DEFAULT_YEAR_END_MONTH);
    }
  }, [open, cluster]);

  const showYearEnd =
    vatPeriod !== '' && YEAR_END_DEPENDENT_CATEGORIES.includes(vatPeriod as VatPeriodCategory);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;
    onSubmit({
      name: name.trim(),
      description: description.trim(),
      vatPeriod,
      vatYearEndMonth,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{cluster ? 'Edit Refund Cluster' : 'Create New Cluster'}</DialogTitle>
          <DialogDescription>
            {cluster
              ? 'Update the cluster name, description and VAT category.'
              : 'Group entities together for VAT refund processing.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cluster-name">Cluster Name</Label>
            <Input
              id="cluster-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Q3 VAT Refunds"
              autoFocus
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cluster-description">Cluster Description</Label>
            <Textarea
              id="cluster-description"
              className="bg-white border-border shadow-sm min-h-20"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this cluster is for…"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cluster-vat-period">VAT Category</Label>
            <Select
              value={vatPeriod || undefined}
              onValueChange={(value) => setVatPeriod(value as VatPeriodCategory)}
            >
              <SelectTrigger id="cluster-vat-period">
                <SelectValue placeholder="Select VAT category" />
              </SelectTrigger>
              <SelectContent>
                {VAT_PERIOD_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Shared by all entities in this cluster — drives the current VAT period.
              {vatPeriodDescription(vatPeriod) ? ` ${vatPeriodDescription(vatPeriod)}` : ''}
            </p>
          </div>
          {showYearEnd && (
            <div className="space-y-2">
              <Label htmlFor="cluster-year-end">Tax year-end month</Label>
              <Select
                value={String(vatYearEndMonth)}
                onValueChange={(value) => setVatYearEndMonth(Number(value))}
              >
                <SelectTrigger id="cluster-year-end">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={String(option.value)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                The month the vendor’s tax year ends. Category D files two 6-month periods (this
                month and 6 months later); Category E files one 12-month period ending here.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
