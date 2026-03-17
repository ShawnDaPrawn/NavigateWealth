import React from 'react';
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
import { Loader2, CheckCircle2, XCircle, AlertTriangle, ShieldCheck } from 'lucide-react';

interface ApproveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  loading: boolean;
}

export function ApproveDialog({ open, onOpenChange, onConfirm, loading }: ApproveDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <DialogTitle className="text-base">Approve Application</DialogTitle>
              <DialogDescription className="text-sm mt-0.5">
                This action will grant the client portal access.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3 my-2">
          <p className="text-xs text-emerald-700 leading-relaxed">
            The client will be notified via email and granted access to the Navigate Wealth client
            portal. A client profile will be auto-populated from their application data.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Confirm Approval
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
}

export function DeclineDialog({
  open,
  onOpenChange,
  onConfirm,
  loading,
  reason,
  setReason,
}: DeclineDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <DialogTitle className="text-base">Reject Application</DialogTitle>
              <DialogDescription className="text-sm mt-0.5">
                Please provide a reason — this will be communicated to the applicant.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="reason" className="text-sm font-medium">
            Rejection Reason <span className="text-red-500">*</span>
          </Label>
          <Textarea
            id="reason"
            placeholder="e.g., Incomplete documentation, Does not meet criteria..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground">
            Be specific and professional. This message will be sent to the applicant.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={loading || !reason.trim()}
            className="gap-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            Reject Application
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
