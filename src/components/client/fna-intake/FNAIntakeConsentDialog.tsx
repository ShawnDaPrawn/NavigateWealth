import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Alert, AlertDescription } from '../../ui/alert';
import { AlertCircle } from 'lucide-react';
import { FNA_INTAKE_CONSENT_TEXT } from '../../../services/fna-intake-api';

interface FNAIntakeConsentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isSubmitting?: boolean;
}

export function FNAIntakeConsentDialog({
  open,
  onOpenChange,
  onConfirm,
  isSubmitting = false,
}: FNAIntakeConsentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Submit for adviser review</DialogTitle>
          <DialogDescription>
            Your information helps us prepare your analysis. This is not financial advice until your
            Navigate Wealth adviser reviews and publishes your formal needs analysis.
          </DialogDescription>
        </DialogHeader>

        <Alert className="border-amber-200 bg-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-sm text-amber-900">
            {FNA_INTAKE_CONSENT_TEXT}
          </AlertDescription>
        </Alert>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isSubmitting}
            className="bg-primary text-primary-foreground"
          >
            {isSubmitting ? 'Submitting…' : 'Submit for review'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
