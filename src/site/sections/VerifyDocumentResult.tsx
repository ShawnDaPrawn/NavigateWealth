/**
 * The verification card's outcomes — verified, not found and failed — as the
 * "Verify Document" board draws them, filled with what the live page shows:
 * the server's own message, the envelope's title, status and dates, each
 * signer, and the file that was checked. The board's fingerprint panel shows
 * the SHA-256 the page computed in the browser, the one value sent.
 */
import { VerifyDocumentIcon } from './VerifyDocumentIcons';

/** The answer from the public hash check (esignApi.verifyDocumentHash). */
export interface VerificationResult {
  verified: boolean;
  matchType?: 'original' | 'signed';
  envelope?: {
    id: string;
    title: string;
    status: string;
    completedAt: string | null;
    createdAt: string;
  };
  signers?: Array<{
    name: string;
    role: string;
    status: string;
    signedAt: string | null;
  }>;
  message: string;
}

/** The live page's date format ("10 Nov 2026, 08:12"); a missing date reads as the board draws it. */
function formatVerifyDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface ActionsProps {
  fileLabel: string;
  label: string;
  onReset: () => void;
}

/** The checked file and the way back to a fresh upload. */
function ResultActions({ fileLabel, label, onReset }: ActionsProps) {
  return (
    <div className="nwvd-actions">
      <span className="nwvd-file nw-mono">{fileLabel}</span>
      <button type="button" className="nw-outline nwvd-again" onClick={onReset}>
        {label}
      </button>
    </div>
  );
}

interface VerifiedProps {
  result: VerificationResult;
  hash: string;
  fileLabel: string;
  onReset: () => void;
}

export function VerifyDocumentVerified({ result, hash, fileLabel, onReset }: VerifiedProps) {
  const envelope = result.envelope;
  // The live page marks any status other than "completed" in amber; the board
  // carries that through the whole banner when signing is not complete.
  const incomplete = !!envelope && envelope.status !== 'completed';
  const tone = incomplete ? 'warn' : 'ok';
  const status = envelope ? envelope.status.charAt(0).toUpperCase() + envelope.status.slice(1) : '';

  return (
    <div className="nwvd-result nwvd-result--verified nw-in">
      <div className={`nwvd-banner nwvd-banner--${tone}`}>
        <span className="nwvd-banner-icon">
          <VerifyDocumentIcon name="checkCircle" size={22} />
        </span>
        <div className="nwvd-banner-copy">
          <div className="nwvd-banner-row">
            <p className="nwvd-banner-title">Document Verified</p>
            {result.matchType ? (
              <span className={`nwvd-match nwvd-match--${result.matchType}`}>
                {result.matchType === 'signed' ? 'Signed Copy' : 'Original'}
              </span>
            ) : null}
          </div>
          <p className="nwvd-banner-text">{result.message}</p>
        </div>
      </div>

      {envelope ? (
        <div>
          <h3 className="nwvd-sub">Document Details</h3>
          <div className="nwvd-details">
            <div className="nwvd-cell nwvd-cell--wide">
              <p className="nwvd-cell-label">Title</p>
              <p className="nwvd-cell-title">{envelope.title}</p>
            </div>
            <div className="nwvd-cell">
              <p className="nwvd-cell-label nwvd-cell-label--pill">Status</p>
              <span className={`nwvd-pill nwvd-pill--${tone}`}>{status}</span>
            </div>
            <div className="nwvd-cell">
              <p className="nwvd-cell-label">Created</p>
              <p className="nwvd-cell-value">{formatVerifyDate(envelope.createdAt)}</p>
            </div>
            <div className="nwvd-cell">
              <p className="nwvd-cell-label">Completed</p>
              <p className="nwvd-cell-value">{formatVerifyDate(envelope.completedAt)}</p>
            </div>
          </div>
        </div>
      ) : null}

      {result.signers && result.signers.length > 0 ? (
        <div>
          <h3 className="nwvd-sub">Signers</h3>
          <ul className="nwvd-signers">
            {result.signers.map((signer, idx) => (
              <li key={idx} className="nwvd-signer">
                <div className="nwvd-signer-who">
                  <span className="nwvd-avatar">
                    <VerifyDocumentIcon name="user" size={15} />
                  </span>
                  <div className="nwvd-signer-copy">
                    <p className="nwvd-signer-name">{signer.name}</p>
                    {signer.role ? <p className="nwvd-signer-role">{signer.role}</p> : null}
                  </div>
                </div>
                {signer.status === 'signed' ? (
                  <span className="nwvd-signed">
                    <VerifyDocumentIcon name="check" size={14} stroke="#15803D" />
                    {signer.signedAt ? formatVerifyDate(signer.signedAt) : 'Signed'}
                  </span>
                ) : (
                  <span className="nwvd-pending">{signer.status}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="nwvd-hash">
        <p className="nwvd-hash-label nw-mono">Fingerprint · SHA-256</p>
        <p className="nwvd-hash-value nw-mono">{hash}</p>
      </div>
      <ResultActions fileLabel={fileLabel} label="Verify Another Document" onReset={onReset} />
    </div>
  );
}

interface NotFoundProps {
  message: string;
  fileLabel: string;
  onReset: () => void;
}

export function VerifyDocumentNotFound({ message, fileLabel, onReset }: NotFoundProps) {
  return (
    <div className="nwvd-result nw-in">
      <div className="nwvd-banner nwvd-banner--danger">
        <span className="nwvd-banner-icon">
          <VerifyDocumentIcon name="shieldAlert" size={22} />
        </span>
        <div>
          <p className="nwvd-banner-title">Verification Failed</p>
          <p className="nwvd-banner-text">{message}</p>
        </div>
      </div>
      <div className="nwvd-reasons">
        <p className="nwvd-reasons-title">Possible reasons:</p>
        <ul className="nwvd-reasons-list">
          <li>The document was modified after signing</li>
          <li>The document was not signed through Navigate Wealth</li>
          <li>The file is a different version of the document</li>
        </ul>
      </div>
      <ResultActions fileLabel={fileLabel} label="Try Another Document" onReset={onReset} />
    </div>
  );
}

interface ErrorProps {
  message: string;
  onReset: () => void;
}

export function VerifyDocumentError({ message, onReset }: ErrorProps) {
  return (
    <div className="nwvd-result nw-in">
      <div className="nwvd-banner nwvd-banner--danger" role="alert">
        <span className="nwvd-banner-icon">
          <VerifyDocumentIcon name="alertCircle" size={22} />
        </span>
        <div>
          <p className="nwvd-banner-title">Error</p>
          <p className="nwvd-banner-text nwvd-banner-text--plain">{message}</p>
        </div>
      </div>
      <button type="button" className="nw-btn nwvd-retry" onClick={onReset}>
        Try Again
      </button>
    </div>
  );
}
