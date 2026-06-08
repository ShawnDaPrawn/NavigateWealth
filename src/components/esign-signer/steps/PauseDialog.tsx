import { PauseCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { Button } from '../../ui/button';

interface PauseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expiresAt: string | null | undefined;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PauseDialog({
  open,
  onOpenChange,
  expiresAt,
  onConfirm,
  onCancel,
}: PauseDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PauseCircle className="h-5 w-5 text-indigo-600" />
            Save & Finish later
          </DialogTitle>
          <DialogDescription>
            Your filled fields will be saved on this device. You can return to this signing link any
            time before the document expires.
          </DialogDescription>
        </DialogHeader>

        {expiresAt && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900">
            This document expires on{' '}
            <strong>
              {new Date(expiresAt).toLocaleDateString('en-ZA', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </strong>
            .
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button variant="outline" className="h-11" onClick={onCancel}>
            Keep signing
          </Button>
          <Button onClick={onConfirm} className="bg-indigo-600 hover:bg-indigo-700 h-11">
            <PauseCircle className="h-4 w-4 mr-1.5" />
            Save & exit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
