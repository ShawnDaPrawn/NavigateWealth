import { AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Textarea } from '../../ui/textarea';

interface RejectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rejectReason: string;
  onRejectReasonChange: (reason: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function RejectDialog({
  open,
  onOpenChange,
  rejectReason,
  onRejectReasonChange,
  onSubmit,
  onCancel,
}: RejectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Decline to sign
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to decline this document? This action cannot be undone. The sender
            will be notified of your reason.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          value={rejectReason}
          onChange={(e) => onRejectReasonChange(e.target.value)}
          placeholder="Please explain why you are declining..."
          className="mt-4 min-h-[100px]"
        />

        <DialogFooter className="mt-6">
          <Button onClick={onCancel} variant="outline" className="h-11">
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={!rejectReason.trim()}
            variant="destructive"
            className="h-11"
          >
            Decline document
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
