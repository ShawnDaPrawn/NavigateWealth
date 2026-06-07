import { Pen } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { SignatureCanvas } from '../SignatureCanvas';
import type { SignerField, SignatureData } from '../types';

interface SignatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentField: SignerField | null;
  onCancel: () => void;
  onSave: (signatureData: string) => void;
  signatures: SignatureData[];
  adoptedSignature: string | null;
  adoptedInitials: string | null;
  signerName: string;
}

export function SignatureDialog({
  open,
  onOpenChange,
  currentField,
  onCancel,
  onSave,
  signatures,
  adoptedSignature,
  adoptedInitials,
  signerName,
}: SignatureDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pen className="h-5 w-5 text-indigo-600" />
            {currentField?.type === 'signature'
              ? 'Adopt your signature'
              : currentField?.type === 'initials'
                ? 'Adopt your initials'
                : 'Sign Document'}
          </DialogTitle>
          <DialogDescription>
            {currentField?.type === 'signature'
              ? "We'll apply this to every signature spot on this document. You can change any one of them afterwards by tapping it."
              : currentField?.type === 'initials'
                ? "We'll apply these initials to every initials spot on this document."
                : 'Draw, type, or upload your signature.'}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2">
          <SignatureCanvas
            onSave={onSave}
            onCancel={onCancel}
            type={currentField?.type === 'initials' ? 'initials' : 'signature'}
            existingValue={signatures.find((s) => s.field_id === currentField?.id)?.value}
            savedSignature={adoptedSignature}
            savedInitials={adoptedInitials}
            signerName={signerName}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
