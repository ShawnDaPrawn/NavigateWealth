/**
 * "Document Signed Successfully" — the signing page's completed state, as the
 * ESign board draws it: an ink header with the logo and a tick, then the
 * document, the confirmation email, the ECTA line, the next steps and the
 * two actions.
 *
 * "Download Copy" is the live page's own download (useSignedCopyDownload):
 * the same request for the signed PDF, saved under the document's title.
 * The words are the live page's.
 */
import type { SignerSessionData } from '../../components/esign-signer/types';
import { useSignedCopyDownload } from '../../components/esign-signer/hooks/useSignedCopyDownload';
import reversedLogo from 'figma:asset/8dc2892f50ecc4c5f692fd5ad52639699e2e4656.png';
import { HomeLink } from './ESignCard';
import { ESignIcon } from './ESignIcons';

const NEXT_STEPS = [
  'The sender will be notified that you have signed the document',
  'If other signers are required, they will receive their signing invitations',
  'Once all parties have signed, you will receive the final completed document',
];

interface ESignCompleteProps {
  sessionData: SignerSessionData | null;
  token: string;
  onClose: () => void;
}

export function ESignComplete({ sessionData, token, onClose }: ESignCompleteProps) {
  const { isDownloading, handleDownload, notice } = useSignedCopyDownload({ sessionData, token });

  return (
    <div className="nw-site nwes">
      <main className="nwes-donepage" aria-label="Signing complete">
        <div className="nwes-done">
          <div className="nwes-done-head">
            <div className="nwes-done-grid" aria-hidden="true" />
            <div className="nwes-done-headin">
              <img className="nwes-done-logo" src={reversedLogo} alt="Navigate Wealth" />
              <div className="nwes-done-tick">
                <ESignIcon name="check" size={34} />
              </div>
              <h1 className="nw-h nwes-done-title">Document Signed Successfully</h1>
            </div>
          </div>
          <div className="nwes-done-body">
            <div className="nwes-done-doc">
              <div className="nwes-done-dochead">
                <span className="nwes-doc-icon">
                  <ESignIcon name="file" size={17} />
                </span>
                <span className="nwes-done-doctitle">{sessionData?.envelope_title}</span>
              </div>
              <dl className="nwes-done-facts">
                <div className="nwes-done-fact nwes-done-fact--rule">
                  <dt>Signed by</dt>
                  <dd className="nwes-done-who">{sessionData?.signer_name}</dd>
                </div>
                <div className="nwes-done-fact">
                  <dt>Status</dt>
                  <dd>
                    <span className="nwes-done-chip">Signed</span>
                  </dd>
                </div>
              </dl>
            </div>

            <div className="nwes-done-mail">
              <ESignIcon name="mail" size={18} stroke="#1D4ED8" className="nwes-done-mailicon" />
              <div>
                <h2 className="nwes-done-mailtitle">Email Confirmation</h2>
                <p className="nwes-done-mailtext">
                  A confirmation with the signed document has been sent to your email.
                </p>
              </div>
            </div>

            <p className="nwes-done-legal">
              <ESignIcon name="shieldCheck" size={16} stroke="#15803D" />
              <span>Your e-signature is legally binding under the ECTA and securely stored.</span>
            </p>

            <div>
              <h2 className="nwes-done-nexttitle">What happens next?</h2>
              <ol className="nwes-done-next">
                {NEXT_STEPS.map((step, index) => (
                  <li key={step}>
                    <span className="nwes-done-step">{index + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            <div className="nwes-done-actions">
              <button
                type="button"
                className="nw-btn nwes-done-action"
                onClick={handleDownload}
                disabled={isDownloading}
                aria-busy={isDownloading || undefined}
              >
                {isDownloading ? (
                  <span className="nwes-spin" aria-hidden="true" />
                ) : (
                  <ESignIcon name="download" size={16} />
                )}
                Download Copy
              </button>
              <HomeLink className="nw-outline nwes-done-action" onNavigate={onClose}>
                Close
              </HomeLink>
            </div>

            {notice ? (
              <p
                role={notice.tone === 'error' ? 'alert' : 'status'}
                className={`nwes-done-notice${notice.tone === 'error' ? ' nwes-done-notice--error' : ''}`}
              >
                {notice.text}
              </p>
            ) : null}

            <p className="nwes-done-foot">
              If you have any questions about this document, please contact the sender directly.
            </p>
            <p className="nwes-done-verify">
              Received a signed copy? <a href="/verify">Verify that it is authentic</a>.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
