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
import { VAT_PERIOD_OPTIONS, vatPeriodDescription } from '../constants';
import type { RefundCluster, VatPeriodCategory } from '../types';

interface ClusterFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set the dialog edits this cluster; otherwise it creates a new one. */
  cluster?: RefundCluster | null;
  onSubmit: (values: {
    name: string;
    description: string;
    vatPeriod: VatPeriodCategory | '';
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

  useEffect(() => {
    if (open) {
      setName(cluster?.name ?? '');
      setDescription(cluster?.description ?? '');
      setVatPeriod(cluster?.vatPeriod ?? '');
    }
  }, [open, cluster]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;
    onSubmit({ name: name.trim(), description: description.trim(), vatPeriod });
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
