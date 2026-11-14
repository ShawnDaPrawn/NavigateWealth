import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import { Button } from '../../../../ui/button';
import { Label } from '../../../../ui/label';
import { Textarea } from '../../../../ui/textarea';
import { Loader2 } from 'lucide-react';

interface ApproveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  loading: boolean;
  /** The applicant's name, for the title ("Approve Nadia Hendricks?"). */
  applicantName?: string;
}

/** Approve confirmation: says what approval does (design system: confirmations). */
export function ApproveDialog({
  open,
  onOpenChange,
  onConfirm,
  loading,
  applicantName,
}: ApproveDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="text-base">
            {applicantName ? `Approve ${applicantName}?` : 'Approve application?'}
          </DialogTitle>
          <DialogDescription className="text-sm">
            This creates the client profile, copies the synced fields across and grants portal
            access. The client is notified by email.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Confirm approval
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DeclineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  loading: boolean;
  reason: string;
  setReason: (reason: string) => void;
  applicantName?: string;
}

/** Reject with a required reason, checked inline. */
export function DeclineDialog({
  open,
  onOpenChange,
  onConfirm,
  loading,
  reason,
  setReason,
  applicantName,
}: DeclineDialogProps) {
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  const submit = () => {
    if (!reason.trim()) {
      setError('Please provide a reason for rejection');
      document.getElementById('reject-reason')?.focus();
      return;
    }
    onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-base">
            {applicantName ? `Reject ${applicantName}'s application?` : 'Reject application?'}
          </DialogTitle>
          <DialogDescription className="text-sm">
            The application moves to Rejected. Please give a reason — it is kept with the
            application and sent to the applicant.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5 py-1">
          <Label htmlFor="reject-reason" className="text-sm font-medium">
            Reason <span className="text-red-600">*</span>
          </Label>
          <Textarea
            id="reject-reason"
            placeholder="e.g. Incomplete documentation, does not meet criteria…"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError(null);
            }}
            rows={4}
            className="resize-none"
            aria-invalid={!!error}
            aria-describedby={error ? 'reject-reason-error' : 'reject-reason-hint'}
          />
          {error ? (
            <p id="reject-reason-error" className="text-xs text-red-600">
              {error}
            </p>
          ) : (
            <p id="reject-reason-hint" className="text-xs text-muted-foreground">
              Be specific and professional.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={submit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Reject application
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
