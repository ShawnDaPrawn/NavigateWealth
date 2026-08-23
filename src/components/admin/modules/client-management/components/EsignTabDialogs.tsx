/**
 * The delete and recall envelope dialogs of the client e-sign tab. JSX
 * moved verbatim from EsignTab.tsx; every captured name became a prop.
 */
import React from 'react';
import { Button } from '../../../../ui/button';
import { Label } from '../../../../ui/label';
import { Textarea } from '../../../../ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import { Loader2 } from 'lucide-react';
import type { EsignEnvelope } from '../../esign/types';

interface EsignTabDialogsProps {
  deleteDialogOpen: boolean;
  setDeleteDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  recallDialogOpen: boolean;
  setRecallDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  envelopeToDelete: EsignEnvelope | null;
  envelopeToRecall: EsignEnvelope | null;
  recallReason: string;
  setRecallReason: React.Dispatch<React.SetStateAction<string>>;
  deleting: boolean;
  handleDelete: () => Promise<void>;
  handleRecall: () => Promise<void>;
}

export function EsignTabDialogs({
  deleteDialogOpen,
  setDeleteDialogOpen,
  recallDialogOpen,
  setRecallDialogOpen,
  envelopeToDelete,
  envelopeToRecall,
  recallReason,
  setRecallReason,
  deleting,
  handleDelete,
  handleRecall,
}: EsignTabDialogsProps) {
  return (
    <>
      {/* Delete Envelope Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Envelope</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{envelopeToDelete?.title}&rdquo;? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recall Envelope Dialog */}
      <Dialog open={recallDialogOpen} onOpenChange={setRecallDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recall Envelope</DialogTitle>
            <DialogDescription>
              Recalling &ldquo;{envelopeToRecall?.title}&rdquo; will void it and notify all signers.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="recallReason">Reason for Recall</Label>
            <Textarea
              id="recallReason"
              value={recallReason}
              onChange={(e) => setRecallReason(e.target.value)}
              placeholder="Enter the reason for recalling the envelope..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecallDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRecall}>
              Recall
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
