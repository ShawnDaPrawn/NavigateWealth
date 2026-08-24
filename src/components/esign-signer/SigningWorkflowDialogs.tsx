/**
 * The seven modal dialogs of the signing workflow.
 *
 * JSX moved verbatim out of SigningWorkflow.tsx, which was over the 1,000-line
 * budget. Every value the block closed over is now an explicit prop, so what
 * the dialogs actually depend on is visible at the call site rather than
 * implied by the enclosing scope.
 */
import React from 'react';
import type { SignerSessionData, SignatureData, SignerField } from './types';
import { SignatureDialog } from './steps/SignatureDialog';
import { TextInputDialog } from './steps/TextInputDialog';
import { DateInputDialog } from './steps/DateInputDialog';
import { DropdownDialog } from './steps/DropdownDialog';
import { ConsentDialog } from './steps/ConsentDialog';
import { RejectDialog } from './steps/RejectDialog';
import { PauseDialog } from './steps/PauseDialog';

interface SigningWorkflowDialogsProps {
  /** The session is non-null here: SigningWorkflow early-returns without one. */
  sessionData: SignerSessionData;
  envelope_title: string;

  showSignatureDialog: boolean;
  setShowSignatureDialog: React.Dispatch<React.SetStateAction<boolean>>;
  showTextDialog: boolean;
  setShowTextDialog: React.Dispatch<React.SetStateAction<boolean>>;
  showDateDialog: boolean;
  setShowDateDialog: React.Dispatch<React.SetStateAction<boolean>>;
  showDropdownDialog: boolean;
  setShowDropdownDialog: React.Dispatch<React.SetStateAction<boolean>>;
  showConsentDialog: boolean;
  setShowConsentDialog: React.Dispatch<React.SetStateAction<boolean>>;
  showRejectDialog: boolean;
  setShowRejectDialog: React.Dispatch<React.SetStateAction<boolean>>;
  showPauseDialog: boolean;
  setShowPauseDialog: React.Dispatch<React.SetStateAction<boolean>>;

  currentField: SignerField | null;
  setCurrentField: React.Dispatch<React.SetStateAction<SignerField | null>>;
  signatures: SignatureData[];
  adoptedSignature: string | null;
  adoptedInitials: string | null;

  textInput: string;
  setTextInput: React.Dispatch<React.SetStateAction<string>>;
  dateInput: string;
  setDateInput: React.Dispatch<React.SetStateAction<string>>;
  dropdownValue: string;
  setDropdownValue: React.Dispatch<React.SetStateAction<string>>;
  rejectReason: string;
  setRejectReason: React.Dispatch<React.SetStateAction<string>>;
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;

  consentAccepted: boolean;
  setConsentAccepted: React.Dispatch<React.SetStateAction<boolean>>;
  isSubmitting: boolean;
  completedFields: SignerField[];
  requiredFields: SignerField[];

  handleSignatureSave: (signatureData: string) => void;
  handleTextSave: () => void;
  handleDateSave: () => void;
  handleDropdownSave: () => void;
  handleRejectSubmit: () => void;
  handleFinalSubmit: () => Promise<void>;
  handlePauseConfirm: () => Promise<void>;
}

export function SigningWorkflowDialogs({
  sessionData,
  envelope_title,
  showSignatureDialog,
  setShowSignatureDialog,
  showTextDialog,
  setShowTextDialog,
  showDateDialog,
  setShowDateDialog,
  showDropdownDialog,
  setShowDropdownDialog,
  showConsentDialog,
  setShowConsentDialog,
  showRejectDialog,
  setShowRejectDialog,
  showPauseDialog,
  setShowPauseDialog,
  currentField,
  setCurrentField,
  signatures,
  adoptedSignature,
  adoptedInitials,
  textInput,
  setTextInput,
  dateInput,
  setDateInput,
  dropdownValue,
  setDropdownValue,
  rejectReason,
  setRejectReason,
  error,
  setError,
  consentAccepted,
  setConsentAccepted,
  isSubmitting,
  completedFields,
  requiredFields,
  handleSignatureSave,
  handleTextSave,
  handleDateSave,
  handleDropdownSave,
  handleRejectSubmit,
  handleFinalSubmit,
  handlePauseConfirm,
}: SigningWorkflowDialogsProps) {
  return (
    <>
      <SignatureDialog
        open={showSignatureDialog}
        onOpenChange={setShowSignatureDialog}
        currentField={currentField}
        onCancel={() => {
          setShowSignatureDialog(false);
          setCurrentField(null);
        }}
        onSave={handleSignatureSave}
        signatures={signatures}
        adoptedSignature={adoptedSignature}
        adoptedInitials={adoptedInitials}
        signerName={sessionData.signer_name}
      />

      <TextInputDialog
        open={showTextDialog}
        onOpenChange={(open) => {
          setShowTextDialog(open);
          if (!open) {
            setCurrentField(null);
            setError(null);
          }
        }}
        currentField={currentField}
        textInput={textInput}
        onTextInputChange={setTextInput}
        error={error}
        onSave={handleTextSave}
        onCancel={() => {
          setShowTextDialog(false);
          setCurrentField(null);
          setError(null);
        }}
      />

      <DateInputDialog
        open={showDateDialog}
        onOpenChange={(open) => {
          setShowDateDialog(open);
          if (!open) setCurrentField(null);
        }}
        dateInput={dateInput}
        onDateInputChange={setDateInput}
        onSave={handleDateSave}
        onCancel={() => {
          setShowDateDialog(false);
          setCurrentField(null);
        }}
      />

      <DropdownDialog
        open={showDropdownDialog}
        onOpenChange={(open) => {
          setShowDropdownDialog(open);
          if (!open) setCurrentField(null);
        }}
        currentField={currentField}
        dropdownValue={dropdownValue}
        onDropdownValueChange={setDropdownValue}
        onSave={handleDropdownSave}
        onCancel={() => {
          setShowDropdownDialog(false);
          setCurrentField(null);
        }}
      />

      <ConsentDialog
        open={showConsentDialog}
        onOpenChange={setShowConsentDialog}
        envelopeTitle={envelope_title}
        signerName={sessionData.signer_name}
        completedCount={completedFields.length}
        requiredCount={requiredFields.length}
        consentAccepted={consentAccepted}
        onConsentChange={setConsentAccepted}
        isSubmitting={isSubmitting}
        onSubmit={handleFinalSubmit}
        onCancel={() => {
          setShowConsentDialog(false);
          setConsentAccepted(false);
        }}
      />

      <RejectDialog
        open={showRejectDialog}
        onOpenChange={setShowRejectDialog}
        rejectReason={rejectReason}
        onRejectReasonChange={setRejectReason}
        onSubmit={handleRejectSubmit}
        onCancel={() => setShowRejectDialog(false)}
      />

      <PauseDialog
        open={showPauseDialog}
        onOpenChange={setShowPauseDialog}
        expiresAt={sessionData.expires_at}
        onConfirm={handlePauseConfirm}
        onCancel={() => setShowPauseDialog(false)}
      />
    </>
  );
}
