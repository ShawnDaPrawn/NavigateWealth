/**
 * Discard Envelope Dialog
 *
 * AlertDialog-based confirmation for discarding envelopes that are
 * still in progress (draft, sent, or viewed — with no completed signatures).
 *
 * Shows contextual messaging:
 *  - Draft:       "This draft will be permanently removed."
 *  - Sent/Viewed: "All recipients will be notified that this envelope has been discarded."
 */

import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../ui/alert-dialog';
import { Loader2, AlertTriangle } from 'lucide-react';

interface DiscardEnvelopeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  title?: string;
  /** The current status of the envelope — drives contextual messaging. */
  envelopeStatus: string;
  loading?: boolean;
}

export function DiscardEnvelopeDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  envelopeStatus,
  loading = false,
}: DiscardEnvelopeDialogProps) {
  const [confirming, setConfirming] = useState(false);

  const isDraft = envelopeStatus === 'draft';
  const isSent = envelopeStatus === 'sent' || envelopeStatus === 'viewed';

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm();
    } finally {
      setConfirming(false);
    }
  };

  const isWorking = loading || confirming;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Discard Envelope
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">
              Are you sure you want to discard{' '}
              <span className="font-medium text-foreground">
                &ldquo;{title || 'this envelope'}&rdquo;
              </span>
              ? This action cannot be undone.
            </span>
            {isDraft && (
              <span className="block text-muted-foreground">
                This draft and all associated fields will be permanently removed.
              </span>
            )}
            {isSent && (
              <span className="block text-amber-600">
                All recipients will be notified that this envelope has been
                discarded and signing links will be invalidated.
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isWorking}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault(); // Prevent default close — we close after async completes
              handleConfirm();
            }}
            disabled={isWorking}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isWorking ? (
              <div className="contents">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Discarding...
              </div>
            ) : (
              'Discard Envelope'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
