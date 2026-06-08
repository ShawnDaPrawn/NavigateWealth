import { ShieldCheck, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Checkbox as UICheckbox } from '../../ui/checkbox';
import { Label } from '../../ui/label';

interface ConsentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  envelopeTitle: string;
  signerName: string;
  completedCount: number;
  requiredCount: number;
  consentAccepted: boolean;
  onConsentChange: (accepted: boolean) => void;
  isSubmitting: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}

export function ConsentDialog({
  open,
  onOpenChange,
  envelopeTitle,
  signerName,
  completedCount,
  requiredCount,
  consentAccepted,
  onConsentChange,
  isSubmitting,
  onSubmit,
  onCancel,
}: ConsentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-indigo-600" />
            Confirm your signature
          </DialogTitle>
          <DialogDescription>
            Please review the following before completing your signature.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Document</span>
              <span className="font-medium text-gray-900 truncate max-w-[60%] text-right">
                {envelopeTitle}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Signer</span>
              <span className="font-medium text-gray-900">{signerName}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Fields completed</span>
              <span className="font-medium text-green-700">
                {completedCount} of {requiredCount}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Date</span>
              <span className="font-medium text-gray-900">
                {new Date().toLocaleDateString('en-ZA', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>

          <div className="border rounded-lg p-4 bg-white">
            <h4 className="text-sm font-semibold text-gray-900 mb-2">
              Electronic Signature Consent
            </h4>
            <div className="text-xs text-gray-600 space-y-2 max-h-32 overflow-y-auto pr-2">
              <p>
                By checking the box below and clicking "Submit Signature", I confirm and agree that:
              </p>
              <ol className="list-decimal pl-4 space-y-1">
                <li>I have reviewed the document in its entirety and understand its contents.</li>
                <li>
                  I intend my electronic signature to have the same legal effect as a handwritten
                  signature, in accordance with the Electronic Communications and Transactions Act
                  25 of 2002 (ECTA) of South Africa.
                </li>
                <li>
                  I consent to conducting this transaction electronically and acknowledge that my
                  signature is legally binding.
                </li>
                <li>
                  I understand that a record of this signing, including timestamp, IP address, and
                  device information, will be maintained for audit purposes.
                </li>
              </ol>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
            <UICheckbox
              id="ecta-consent"
              checked={consentAccepted}
              onCheckedChange={(checked) => onConsentChange(checked === true)}
              className="mt-0.5 h-5 w-5"
            />
            <Label
              htmlFor="ecta-consent"
              className="text-sm text-gray-800 cursor-pointer leading-snug"
            >
              I have read and agree to the above. I confirm this is my signature and I intend to
              electronically sign this document.
            </Label>
          </div>
        </div>

        <DialogFooter className="mt-4 flex-col sm:flex-row gap-2">
          <Button variant="outline" className="h-11" onClick={onCancel}>
            Go back
          </Button>
          <Button
            onClick={onSubmit}
            disabled={!consentAccepted || isSubmitting}
            className="bg-indigo-600 hover:bg-indigo-700 h-11"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4 mr-1.5" />
                Submit signature
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
