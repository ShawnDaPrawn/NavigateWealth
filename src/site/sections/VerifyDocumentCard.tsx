/**
 * The verification card — the upload area, the working state and the outcome,
 * as the "Verify Document" board draws them. The card is a polite live region,
 * as on the board, so each stage's title and words are announced.
 */
import type { ChangeEvent, DragEvent } from 'react';
import { VerifyDocumentIcon } from './VerifyDocumentIcons';
import {
  VerifyDocumentError,
  VerifyDocumentNotFound,
  VerifyDocumentVerified,
  type VerificationResult,
} from './VerifyDocumentResult';

export type VerificationState =
  'idle' | 'hashing' | 'verifying' | 'verified' | 'not_found' | 'error';

/** The live page's card titles for each stage. */
const TITLES: Record<VerificationState, string> = {
  idle: 'Upload Document',
  hashing: 'Verifying...',
  verifying: 'Verifying...',
  verified: 'Verification Result',
  not_found: 'Verification Result',
  error: 'Verification Error',
};

interface VerifyDocumentCardProps {
  state: VerificationState;
  result: VerificationResult | null;
  hash: string;
  fileLabel: string;
  errorMsg: string;
  /** The live page's "Please upload a PDF file." for a file that is not a PDF. */
  pickError: string;
  dragOver: boolean;
  onDragOver: (e: DragEvent<HTMLLabelElement>) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent<HTMLLabelElement>) => void;
  onInputChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onReset: () => void;
}

export function VerifyDocumentCard({
  state,
  result,
  hash,
  fileLabel,
  errorMsg,
  pickError,
  dragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onInputChange,
  onReset,
}: VerifyDocumentCardProps) {
  const busy = state === 'hashing' || state === 'verifying';
  return (
    <section className="nwvd-card" aria-live="polite">
      <div className="nwvd-card-head">
        <h2 className="nwvd-card-title">{TITLES[state]}</h2>
        {state === 'idle' ? (
          <p className="nwvd-card-desc">
            Drag and drop a PDF file or click to browse. The file is hashed locally — it is never
            uploaded to our servers.
          </p>
        ) : null}
      </div>
      <div className="nwvd-card-body">
        {state === 'idle' ? (
          <div>
            <label
              className={`nwvd-drop${dragOver ? ' nwvd-drop--over' : ''}`}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            >
              <span className="nwvd-drop-icon">
                <VerifyDocumentIcon name="upload" size={26} />
              </span>
              <span className="nwvd-drop-title">Drop your PDF here or click to browse</span>
              <span className="nwvd-drop-hint nw-mono">PDF files only</span>
              <input
                className="nwvd-file-input"
                type="file"
                accept=".pdf,application/pdf"
                onChange={onInputChange}
                aria-invalid={pickError ? true : undefined}
                aria-describedby={pickError ? 'nwvd-pick-error' : undefined}
              />
            </label>
            {pickError ? (
              <p id="nwvd-pick-error" className="nwvd-pick-error" role="alert">
                {pickError}
              </p>
            ) : null}
          </div>
        ) : null}

        {busy ? (
          <div className="nwvd-busy">
            <div className="nwvd-doc">
              <div className="nwvd-doc-lines" aria-hidden="true">
                <span />
                <span className="nwvd-doc-line--80" />
                <span />
                <span className="nwvd-doc-line--60" />
                <span />
              </div>
              <div className="nwvd-scan" aria-hidden="true" />
            </div>
            <p className="nwvd-busy-text">
              {state === 'hashing'
                ? 'Computing document fingerprint...'
                : 'Checking against signed documents...'}
            </p>
            <span className="nwvd-chip nw-mono">
              <VerifyDocumentIcon name="file" size={13} />
              {fileLabel}
            </span>
          </div>
        ) : null}

        {state === 'verified' && result ? (
          <VerifyDocumentVerified
            result={result}
            hash={hash}
            fileLabel={fileLabel}
            onReset={onReset}
          />
        ) : null}

        {state === 'not_found' && result ? (
          <VerifyDocumentNotFound
            message={result.message}
            fileLabel={fileLabel}
            onReset={onReset}
          />
        ) : null}

        {state === 'error' ? <VerifyDocumentError message={errorMsg} onReset={onReset} /> : null}
      </div>
    </section>
  );
}
