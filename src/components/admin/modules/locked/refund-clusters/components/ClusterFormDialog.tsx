/**
 * Create / edit dialog for a refund cluster (name + description).
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
import type { RefundCluster } from '../types';

interface ClusterFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set the dialog edits this cluster; otherwise it creates a new one. */
  cluster?: RefundCluster | null;
  onSubmit: (values: { name: string; description: string }) => void;
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

  useEffect(() => {
    if (open) {
      setName(cluster?.name ?? '');
      setDescription(cluster?.description ?? '');
    }
  }, [open, cluster]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;
    onSubmit({ name: name.trim(), description: description.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{cluster ? 'Edit Refund Cluster' : 'Create New Cluster'}</DialogTitle>
          <DialogDescription>
            {cluster
              ? 'Update the cluster name and description.'
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
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this cluster is for…"
              rows={3}
            />
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
