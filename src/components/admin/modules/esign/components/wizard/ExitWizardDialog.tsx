/**
 * The "you are about to lose this" gate on leaving the send-for-signature
 * wizard.
 *
 * Three ways out, in the order they should be reached for:
 *   - Save as draft — the envelope is created (or updated) and appears on the
 *     dashboard as a Draft, resumable from where it was left.
 *   - Discard       — throw the in-progress work away, explicitly.
 *   - Keep editing  — the default; Escape and the backdrop land here.
 *
 * "Save as draft" hides itself when there is nothing an envelope could be made
 * from (no documents staged and none already uploaded), because a draft with
 * no document is not resumable.
 */
import { AlertTriangle, Loader2, Save } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../../ui/alert-dialog';
import { Button } from '../../../../../ui/button';

interface ExitWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Persist the work as a resumable draft, then leave. */
  onSaveDraft: () => void | Promise<void>;
  /** Leave without saving. */
  onDiscard: () => void;
  /** False when there is no document to build a draft from. */
  canSaveDraft: boolean;
  saving?: boolean;
  /** Wording for the template-builder flow, which saves a template not an envelope. */
  isTemplateBuilder?: boolean;
}

export function ExitWizardDialog({
  open,
  onOpenChange,
  onSaveDraft,
  onDiscard,
  canSaveDraft,
  saving = false,
  isTemplateBuilder = false,
}: ExitWizardDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={saving ? undefined : onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden="true" />
            Leave without sending?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {canSaveDraft
              ? isTemplateBuilder
                ? 'This template is not saved yet. Save it as a draft envelope to pick it up later, or discard what you have done.'
                : 'Nothing has been sent yet. Save this as a draft and it will wait on your dashboard — documents, recipients and settings intact — ready to continue.'
              : 'Nothing has been uploaded yet, so there is no draft to save. The title, message and recipients you have entered will be lost.'}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel disabled={saving} className="mt-0">
            Keep editing
          </AlertDialogCancel>

          <Button
            type="button"
            variant="outline"
            onClick={onDiscard}
            disabled={saving}
            className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
          >
            Discard
          </Button>

          {canSaveDraft && (
            <Button
              type="button"
              onClick={() => void onSaveDraft()}
              disabled={saving}
              className="bg-purple-600 text-white hover:bg-purple-700"
            >
              {saving ? (
                <div className="contents">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving draft…
                </div>
              ) : (
                <div className="contents">
                  <Save className="h-4 w-4" />
                  Save as draft
                </div>
              )}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
