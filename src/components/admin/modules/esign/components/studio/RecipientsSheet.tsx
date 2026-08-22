/**
 * Quick-edit for the envelope recipients.
 *
 *
 * Split out of `PrepareFormStudio.tsx` (1,529 lines), whose `return` held the
 * toolbar, recipient strip, bulk-action bar, canvas and five dialogs together.
 * Presentational — it owns no state.
 */
import type { Dispatch, SetStateAction } from 'react';
import type { SignerFormData } from '../../types';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../../../../../ui/sheet';
import { RecipientsManager } from '../RecipientsManager';

interface RecipientsSheetProps {
  handleRecipientsSave: (next: SignerFormData[]) => void | Promise<void>;
  setShowRecipients: Dispatch<SetStateAction<boolean>>;
  showRecipients: boolean;
  signers: SignerFormData[];
}

export function RecipientsSheet({
  handleRecipientsSave,
  setShowRecipients,
  showRecipients,
  signers,
}: RecipientsSheetProps) {
  return (
    <Sheet open={showRecipients} onOpenChange={setShowRecipients}>
      <SheetContent side="right" className="w-full sm:max-w-[520px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Recipients</SheetTitle>
          <SheetDescription>
            Reorder, add or remove recipients without leaving the studio. Changes save automatically
            when you close this panel.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4">
          <RecipientsManager
            signers={signers}
            onChange={(next) => {
              // Persist on every change so the studio's `signers` prop and
              // the legend stay in sync without a "Save recipients" button.
              void handleRecipientsSave(next);
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
