/**
 * The signing workspace's dialogs, as the ESign board draws them — one sheet
 * style, a bottom sheet on a phone: adopt a signature or initials, enter a
 * text value, pick a date, pick an option (not on the board; drawn the same
 * way), confirm with the ECTA consent, save for later, and decline.
 *
 * Each opens, closes and saves exactly as the live dialogs do
 * (SigningWorkflowDialogs.tsx): the same state changes on cancel, Escape and
 * save, the same validation, and the consent and decline words verbatim.
 */
import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { SignerField, SignerSessionData } from '../../components/esign-signer/types';
import {
  inputModeByFormat,
  maskSaId,
  placeholderByFormat,
  titleByFormat,
} from '../../components/esign-signer/steps/textFieldFormats';
import { sastIsoDate } from '../../shared/esign/fieldText';
import { ESignAdopt } from './ESignAdopt';

function Sheet({
  open,
  onOpenChange,
  padded = true,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  padded?: boolean;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <div className="nw-site nwes-portal">
          <Dialog.Overlay className="nwes-overlay">
            <Dialog.Content className={`nwes-sheet${padded ? ' nwes-sheet--padded' : ''}`}>
              {children}
            </Dialog.Content>
          </Dialog.Overlay>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Spinner() {
  return <span className="nwes-spin nwes-spin--light" aria-hidden="true" />;
}

/** Everything the dialogs read and change — the live workflow's own state. */
export interface ESignDialogsProps {
  sessionData: SignerSessionData;
  envelope_title: string;
  showSignatureDialog: boolean;
  setShowSignatureDialog: (open: boolean) => void;
  showTextDialog: boolean;
  setShowTextDialog: (open: boolean) => void;
  showDateDialog: boolean;
  setShowDateDialog: (open: boolean) => void;
  showDropdownDialog: boolean;
  setShowDropdownDialog: (open: boolean) => void;
  showConsentDialog: boolean;
  setShowConsentDialog: (open: boolean) => void;
  showRejectDialog: boolean;
  setShowRejectDialog: (open: boolean) => void;
  showPauseDialog: boolean;
  setShowPauseDialog: (open: boolean) => void;
  currentField: SignerField | null;
  setCurrentField: (field: SignerField | null) => void;
  adoptedSignature: string | null;
  adoptedInitials: string | null;
  textInput: string;
  setTextInput: (value: string) => void;
  dateInput: string;
  setDateInput: (value: string) => void;
  dropdownValue: string;
  setDropdownValue: (value: string) => void;
  rejectReason: string;
  setRejectReason: (value: string) => void;
  error: string | null;
  setError: (value: string | null) => void;
  consentAccepted: boolean;
  setConsentAccepted: (value: boolean) => void;
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

export function ESignDialogs(p: ESignDialogsProps) {
  const field = p.currentField;

  // ── Adopt a signature or initials ──
  const adoptTitle =
    field?.type === 'signature'
      ? 'Adopt your signature'
      : field?.type === 'initials'
        ? 'Adopt your initials'
        : 'Sign Document';
  const adoptDescription =
    field?.type === 'signature'
      ? "We'll apply this to every signature spot on this document. You can change any one of them afterwards by tapping it."
      : field?.type === 'initials'
        ? "We'll apply these initials to every initials spot on this document."
        : 'Draw, type, or upload your signature.';

  // ── Text ──
  const meta = (field?.metadata ?? {}) as Record<string, unknown>;
  const fmt = (meta.format as string | undefined) ?? 'free_text';
  const customHelp = typeof meta.helpText === 'string' ? meta.helpText : '';
  const maxLength = typeof meta.maxLength === 'number' ? meta.maxLength : undefined;
  const closeText = () => {
    p.setShowTextDialog(false);
    p.setCurrentField(null);
    p.setError(null);
  };

  // ── Option picker (dropdown and radio) ──
  const isRadio = field?.type === 'radio';
  const options = (field?.metadata?.options as string[] | undefined) || [];

  const today = new Date().toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const expiresOn = p.sessionData.expires_at
    ? new Date(p.sessionData.expires_at).toLocaleDateString('en-ZA', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <>
      <Sheet open={p.showSignatureDialog} onOpenChange={p.setShowSignatureDialog} padded={false}>
        <ESignAdopt
          type={field?.type === 'initials' ? 'initials' : 'signature'}
          title={adoptTitle}
          description={adoptDescription}
          savedSignature={p.adoptedSignature}
          savedInitials={p.adoptedInitials}
          signerName={p.sessionData.signer_name}
          onSave={p.handleSignatureSave}
          onCancel={() => {
            p.setShowSignatureDialog(false);
            p.setCurrentField(null);
          }}
        />
      </Sheet>

      <Sheet
        open={p.showTextDialog}
        onOpenChange={(open) => {
          p.setShowTextDialog(open);
          if (!open) {
            p.setCurrentField(null);
            p.setError(null);
          }
        }}
      >
        <Dialog.Title className="nw-h nwes-dlg-title">
          {titleByFormat[fmt] ?? 'Enter text'}
        </Dialog.Title>
        <Dialog.Description className="nwes-dlg-desc">
          {customHelp ||
            (fmt === 'sa_id'
              ? 'Type your 13-digit South African ID number.'
              : 'Type the requested information for this field.')}
        </Dialog.Description>
        <div className="nwes-dlg-field">
          <label htmlFor="text-field-input" className="nwes-dlg-label">
            Value
          </label>
          <input
            id="text-field-input"
            className={`nwes-input${fmt === 'sa_id' ? ' nwes-input--id' : ''}`}
            inputMode={inputModeByFormat[fmt] ?? 'text'}
            value={fmt === 'sa_id' ? maskSaId(p.textInput) : p.textInput}
            maxLength={maxLength}
            onChange={(e) => {
              if (fmt === 'sa_id') {
                p.setTextInput(e.target.value.replace(/\D/g, '').slice(0, 13));
              } else {
                p.setTextInput(e.target.value);
              }
            }}
            placeholder={placeholderByFormat[fmt] ?? 'Enter text...'}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && p.textInput.trim()) p.handleTextSave();
            }}
            aria-invalid={p.error ? true : undefined}
            aria-describedby={p.error ? 'text-field-error' : undefined}
          />
          {p.error && (
            <p className="nwes-dlg-error" role="alert" id="text-field-error">
              {p.error}
            </p>
          )}
        </div>
        <div className="nwes-dlg-actions nwes-dlg-actions--text">
          <button type="button" className="nw-outline nwes-dlg-btn" onClick={closeText}>
            Cancel
          </button>
          <button
            type="button"
            className="nw-btn nwes-dlg-btn nwes-dlg-btn--wide"
            onClick={p.handleTextSave}
            disabled={!p.textInput.trim()}
          >
            Confirm
          </button>
        </div>
      </Sheet>

      <Sheet
        open={p.showDateDialog}
        onOpenChange={(open) => {
          p.setShowDateDialog(open);
          if (!open) p.setCurrentField(null);
        }}
      >
        <Dialog.Title className="nw-h nwes-dlg-title">Select date</Dialog.Title>
        <Dialog.Description className="nwes-dlg-desc">
          Choose the date for this field.
        </Dialog.Description>
        <div className="nwes-dlg-field">
          <label htmlFor="date-field-input" className="nwes-dlg-label">
            Date
          </label>
          <input
            id="date-field-input"
            className="nwes-input"
            type="date"
            value={p.dateInput}
            onChange={(e) => p.setDateInput(e.target.value)}
            autoFocus
          />
        </div>
        <button
          type="button"
          className="nwes-ghost nwes-today"
          // South African date: the UTC one is yesterday before 02:00 SAST.
          onClick={() => p.setDateInput(sastIsoDate())}
        >
          Use today&apos;s date
        </button>
        <div className="nwes-dlg-actions nwes-dlg-actions--date">
          <button
            type="button"
            className="nw-outline nwes-dlg-btn"
            onClick={() => {
              p.setShowDateDialog(false);
              p.setCurrentField(null);
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="nw-btn nwes-dlg-btn nwes-dlg-btn--wide"
            onClick={p.handleDateSave}
            disabled={!p.dateInput}
          >
            Confirm
          </button>
        </div>
      </Sheet>

      <Sheet
        open={p.showDropdownDialog}
        onOpenChange={(open) => {
          p.setShowDropdownDialog(open);
          if (!open) p.setCurrentField(null);
        }}
      >
        <Dialog.Title className="nw-h nwes-dlg-title">
          {isRadio ? 'Choose one option' : 'Select an option'}
        </Dialog.Title>
        <Dialog.Description className="nwes-dlg-desc">
          {field?.metadata?.placeholder
            ? String(field.metadata.placeholder)
            : 'Choose one of the available options below.'}
        </Dialog.Description>
        <div className="nwes-options" role={isRadio ? 'radiogroup' : undefined}>
          {options.map((option, idx) => {
            const on = p.dropdownValue === option;
            return (
              <button
                key={idx}
                type="button"
                role={isRadio ? 'radio' : undefined}
                aria-checked={isRadio ? on : undefined}
                aria-pressed={isRadio ? undefined : on}
                className={`nwes-option${on ? ' nwes-option--on' : ''}`}
                onClick={() => p.setDropdownValue(option)}
              >
                {isRadio && <span className="nwes-option-dot" aria-hidden="true" />}
                {option}
              </button>
            );
          })}
          {options.length === 0 && (
            <p className="nwes-options-empty">No options configured for this field.</p>
          )}
        </div>
        <div className="nwes-dlg-actions nwes-dlg-actions--date">
          <button
            type="button"
            className="nw-outline nwes-dlg-btn"
            onClick={() => {
              p.setShowDropdownDialog(false);
              p.setCurrentField(null);
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="nw-btn nwes-dlg-btn nwes-dlg-btn--wide"
            onClick={p.handleDropdownSave}
            disabled={!p.dropdownValue}
          >
            Confirm
          </button>
        </div>
      </Sheet>

      <Sheet open={p.showConsentDialog} onOpenChange={p.setShowConsentDialog}>
        <Dialog.Title className="nw-h nwes-dlg-title">Confirm your signature</Dialog.Title>
        <Dialog.Description className="nwes-dlg-desc">
          Please review the following before completing your signature.
        </Dialog.Description>
        <dl className="nwes-consent-facts">
          <div>
            <dt>Document</dt>
            <dd>{p.envelope_title}</dd>
          </div>
          <div>
            <dt>Signer</dt>
            <dd>{p.sessionData.signer_name}</dd>
          </div>
          <div>
            <dt>Fields completed</dt>
            <dd className="nwes-consent-count">
              {p.completedFields.length} of {p.requiredFields.length}
            </dd>
          </div>
          <div>
            <dt>Date</dt>
            <dd>{today}</dd>
          </div>
        </dl>
        <div className="nwes-consent">
          <h3 className="nwes-consent-title">Electronic Signature Consent</h3>
          <p>
            By checking the box below and clicking &quot;Submit Signature&quot;, I confirm and agree
            that:
          </p>
          <ol>
            <li>I have reviewed the document in its entirety and understand its contents.</li>
            <li>
              I intend my electronic signature to have the same legal effect as a handwritten
              signature, in accordance with the Electronic Communications and Transactions Act 25 of
              2002 (ECTA) of South Africa.
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
        <label htmlFor="ecta-consent" className="nwes-consent-check">
          <input
            id="ecta-consent"
            type="checkbox"
            checked={p.consentAccepted}
            onChange={(e) => p.setConsentAccepted(e.target.checked)}
          />
          I have read and agree to the above. I confirm this is my signature and I intend to
          electronically sign this document.
        </label>
        <div className="nwes-dlg-actions nwes-dlg-actions--consent">
          <button
            type="button"
            className="nw-outline nwes-dlg-btn"
            onClick={() => {
              p.setShowConsentDialog(false);
              p.setConsentAccepted(false);
            }}
          >
            Go back
          </button>
          <button
            type="button"
            className="nwes-cta nwes-cta--done nwes-dlg-btn nwes-dlg-btn--main nwes-submit"
            onClick={p.handleFinalSubmit}
            disabled={!p.consentAccepted || p.isSubmitting}
          >
            {p.isSubmitting && <Spinner />}
            {p.isSubmitting ? 'Submitting...' : 'Submit signature'}
          </button>
        </div>
      </Sheet>

      <Sheet open={p.showPauseDialog} onOpenChange={p.setShowPauseDialog}>
        <Dialog.Title className="nw-h nwes-dlg-title">Save &amp; Finish later</Dialog.Title>
        <Dialog.Description className="nwes-dlg-desc nwes-dlg-desc--loose">
          Your filled fields will be saved on this device. You can return to this signing link any
          time before the document expires.
        </Dialog.Description>
        {expiresOn && (
          <p className="nwes-expires">
            This document expires on <strong>{expiresOn}</strong>.
          </p>
        )}
        <div className="nwes-dlg-actions nwes-dlg-actions--consent">
          <button
            type="button"
            className="nw-outline nwes-dlg-btn"
            onClick={() => p.setShowPauseDialog(false)}
          >
            Keep signing
          </button>
          <button
            type="button"
            className="nw-btn nwes-dlg-btn nwes-dlg-btn--wide"
            onClick={p.handlePauseConfirm}
          >
            Save &amp; exit
          </button>
        </div>
      </Sheet>

      <Sheet open={p.showRejectDialog} onOpenChange={p.setShowRejectDialog}>
        <Dialog.Title className="nw-h nwes-dlg-title">Decline to sign</Dialog.Title>
        <Dialog.Description className="nwes-dlg-desc nwes-dlg-desc--loose">
          Are you sure you want to decline this document? This action cannot be undone. The sender
          will be notified of your reason.
        </Dialog.Description>
        <label htmlFor="es-reason" className="nwes-dlg-label nwes-reason-label">
          Reason
        </label>
        <textarea
          id="es-reason"
          className="nwes-input nwes-reason"
          rows={4}
          value={p.rejectReason}
          onChange={(e) => p.setRejectReason(e.target.value)}
          placeholder="Please explain why you are declining..."
        />
        <div className="nwes-dlg-actions nwes-dlg-actions--consent">
          <button
            type="button"
            className="nw-outline nwes-dlg-btn"
            onClick={() => p.setShowRejectDialog(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="nwes-danger nwes-dlg-btn nwes-dlg-btn--wide"
            onClick={p.handleRejectSubmit}
            disabled={!p.rejectReason.trim()}
          >
            Decline document
          </button>
        </div>
      </Sheet>
    </>
  );
}
