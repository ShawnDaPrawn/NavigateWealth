/**
 * The add, edit, remove, and re-subscribe dialogs of the newsletter
 * subscribers screen. JSX moved verbatim from NewsletterSubscribers.tsx;
 * every captured name became a prop.
 */
import React from 'react';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import {
  AlertCircle,
  CheckCircle,
  Loader2,
  Pencil,
  RotateCcw,
  Trash2,
  UserPlus,
} from 'lucide-react';
import type { Subscriber } from '../types';
import {
  useAddSubscriber,
  useRemoveSubscriber,
  useResubscribe,
  useUpdateSubscriber,
} from '../hooks/useNewsletterMutations';

interface SubscriberDialogsProps {
  addOpen: boolean;
  setAddOpen: React.Dispatch<React.SetStateAction<boolean>>;
  addFirstName: string;
  setAddFirstName: React.Dispatch<React.SetStateAction<string>>;
  addSurname: string;
  setAddSurname: React.Dispatch<React.SetStateAction<string>>;
  addEmail: string;
  setAddEmail: React.Dispatch<React.SetStateAction<string>>;
  addMutation: ReturnType<typeof useAddSubscriber>;
  handleAddSingle: () => Promise<void>;
  editTarget: Subscriber | null;
  setEditTarget: React.Dispatch<React.SetStateAction<Subscriber | null>>;
  editFirstName: string;
  setEditFirstName: React.Dispatch<React.SetStateAction<string>>;
  editSurname: string;
  setEditSurname: React.Dispatch<React.SetStateAction<string>>;
  editEmail: string;
  setEditEmail: React.Dispatch<React.SetStateAction<string>>;
  updateMutation: ReturnType<typeof useUpdateSubscriber>;
  handleUpdateSubscriber: () => Promise<void>;
  removeTarget: string | null;
  setRemoveTarget: React.Dispatch<React.SetStateAction<string | null>>;
  removeMutation: ReturnType<typeof useRemoveSubscriber>;
  handleRemove: () => Promise<void>;
  resubscribeTarget: string | null;
  setResubscribeTarget: React.Dispatch<React.SetStateAction<string | null>>;
  resubscribeMutation: ReturnType<typeof useResubscribe>;
  handleResubscribe: () => Promise<void>;
}

export function SubscriberDialogs({
  addOpen,
  setAddOpen,
  addFirstName,
  setAddFirstName,
  addSurname,
  setAddSurname,
  addEmail,
  setAddEmail,
  addMutation,
  handleAddSingle,
  editTarget,
  setEditTarget,
  editFirstName,
  setEditFirstName,
  editSurname,
  setEditSurname,
  editEmail,
  setEditEmail,
  updateMutation,
  handleUpdateSubscriber,
  removeTarget,
  setRemoveTarget,
  removeMutation,
  handleRemove,
  resubscribeTarget,
  setResubscribeTarget,
  resubscribeMutation,
  handleResubscribe,
}: SubscriberDialogsProps) {
  return (
    <>
      {/* ═══════ Add Single Subscriber Dialog ═══════ */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-purple-500" />
              Add Newsletter Subscriber
            </DialogTitle>
            <DialogDescription>
              Add a subscriber who has provided offline opt-in consent. This bypasses double opt-in
              and immediately activates them.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>
                Email Address <span className="text-red-500">*</span>
              </Label>
              <Input
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="subscriber@example.com"
                onKeyDown={(e) => e.key === 'Enter' && handleAddSingle()}
              />
            </div>
            <div className="space-y-2">
              <Label>
                First Name <span className="text-muted-foreground text-xs">(optional)</span>
              </Label>
              <Input
                value={addFirstName}
                onChange={(e) => setAddFirstName(e.target.value)}
                placeholder="John"
                onKeyDown={(e) => e.key === 'Enter' && handleAddSingle()}
              />
            </div>
            <div className="space-y-2">
              <Label>
                Surname <span className="text-muted-foreground text-xs">(optional)</span>
              </Label>
              <Input
                value={addSurname}
                onChange={(e) => setAddSurname(e.target.value)}
                placeholder="Smith"
                onKeyDown={(e) => e.key === 'Enter' && handleAddSingle()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700"
              onClick={handleAddSingle}
              disabled={!addEmail.trim().includes('@') || addMutation.isPending}
            >
              {addMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4 mr-1.5" />
              )}
              Add Subscriber
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════ Edit Subscriber Dialog ═══════ */}
      <Dialog
        open={!!editTarget}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-purple-500" />
              Edit Subscriber Details
            </DialogTitle>
            <DialogDescription>
              Update the subscriber name and email address. The newsletter audience will use the new
              details immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>
                Email Address <span className="text-red-500">*</span>
              </Label>
              <Input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="subscriber@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>First Name</Label>
              <Input
                value={editFirstName}
                onChange={(e) => setEditFirstName(e.target.value)}
                placeholder="John"
              />
            </div>
            <div className="space-y-2">
              <Label>Surname</Label>
              <Input
                value={editSurname}
                onChange={(e) => setEditSurname(e.target.value)}
                placeholder="Smith"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700"
              onClick={handleUpdateSubscriber}
              disabled={!editEmail.trim().includes('@') || updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Pencil className="h-4 w-4 mr-1.5" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ═══════ Remove Confirmation Dialog ═══════ */}
      <Dialog
        open={!!removeTarget}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Remove Subscriber
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to remove <strong>{removeTarget}</strong> from the newsletter?
              They will no longer receive future communications.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemove}
              disabled={removeMutation.isPending}
            >
              {removeMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1.5" />
              )}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════ Re-subscribe Confirmation Dialog ═══════ */}
      <Dialog
        open={!!resubscribeTarget}
        onOpenChange={(open) => {
          if (!open) setResubscribeTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              Re-subscribe Subscriber
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to re-subscribe <strong>{resubscribeTarget}</strong> to the
              newsletter? They will receive future communications.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResubscribeTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleResubscribe}
              disabled={resubscribeMutation.isPending}
            >
              {resubscribeMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4 mr-1.5" />
              )}
              Re-subscribe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
