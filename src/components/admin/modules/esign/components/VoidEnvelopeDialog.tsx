import React, { useState } from 'react';
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
import { Input } from '../../../../ui/input';
import { Textarea } from '../../../../ui/textarea';
import { Ban, Loader2 } from 'lucide-react';

interface VoidEnvelopeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => Promise<void>;
  loading?: boolean;
  title?: string;
}

export function VoidEnvelopeDialog({
  open,
  onOpenChange,
  onConfirm,
  loading = false,
  title
}: VoidEnvelopeDialogProps) {
  const [reason, setReason] = useState('');

  const handleConfirm = async () => {
    if (!reason.trim()) return;
    await onConfirm(reason);
    setReason('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Ban className="h-5 w-5" />
            Void Envelope
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to void "{title || 'this envelope'}"? This action cannot be undone. 
            All parties will be notified that the envelope has been voided.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="reason">Reason for voiding (Required)</Label>
            <Textarea
              id="reason"
              placeholder="e.g. Incorrect document, Client request, etc."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={loading}
              className="min-h-[100px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleConfirm}
            disabled={loading || !reason.trim()}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Void Envelope
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
