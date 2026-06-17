/**
 * Create / edit dialog for a refund-cluster manager — the person who runs an
 * entity's banking and eFiling. Managers are created here and assigned to
 * entities from the entity form.
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
import type { RefundManager, RefundManagerInput } from '../types';

interface ManagerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set the dialog edits this manager; otherwise it creates a new one. */
  manager?: RefundManager | null;
  onSubmit: (values: RefundManagerInput) => void;
  isSubmitting: boolean;
}

export function ManagerFormDialog({
  open,
  onOpenChange,
  manager,
  onSubmit,
  isSubmitting,
}: ManagerFormDialogProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(manager?.name ?? '');
      setEmail(manager?.email ?? '');
      setPhone(manager?.phone ?? '');
      setRole(manager?.role ?? '');
      setNotes(manager?.notes ?? '');
      setError(null);
    }
  }, [open, manager]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    const trimmedEmail = email.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Email is invalid');
      return;
    }
    setError(null);
    onSubmit({
      name: name.trim(),
      email: trimmedEmail,
      phone: phone.trim(),
      role: role.trim(),
      notes: notes.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{manager ? 'Edit Manager' : 'Add Manager'}</DialogTitle>
          <DialogDescription>
            Managers run the banking and eFiling for entities in this cluster.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="manager-name">Name</Label>
            <Input
              id="manager-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              autoFocus
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="manager-email">Email</Label>
              <Input
                id="manager-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="manager-phone">Phone</Label>
              <Input
                id="manager-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+27 …"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="manager-role">Role</Label>
            <Input
              id="manager-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Bookkeeper, Tax practitioner"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="manager-notes">Notes</Label>
            <Textarea
              id="manager-notes"
              className="bg-white border-border shadow-sm min-h-20"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything worth recording about this manager…"
              rows={3}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
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
