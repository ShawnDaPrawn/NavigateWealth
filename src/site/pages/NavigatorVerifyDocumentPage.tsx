/**
 * NavigatorVerifyDocumentPage — the redesigned public document verification
 * page (/verify-document and /verify), the "Verify Document" board of the
 * Website Redesign canvas.
 *
 * It does what the live page (VerifyDocumentPage.tsx) does: a file is accepted
 * only when its name ends in ".pdf"; it is read and hashed with SHA-256 in the
 * browser; only that hex digest goes to the public hash check through the same
 * client call (esignApi.verifyDocumentHash → POST /esign/verify-hash
 * { hash }); and the answer decides the outcome — verified, not found, or the
 * thrown error's own message. Every word is the live page's. Like the live
 * page it sets no SEO tags (the route is kept out of search by the server's
 * headers and robots.txt).
 *
 * As the board draws it: the page's own small header, the computed
 * fingerprint shown with a verified result, an amber result when the
 * envelope's signing is not complete, and a file that is not a PDF answered
 * under the upload area rather than in place of it.
 */
import { useCallback, useState, type ChangeEvent, type DragEvent } from 'react';
import { esignApi } from '../../components/admin/modules/esign';
import { VerifyDocumentCard, type VerificationState } from '../sections/VerifyDocumentCard';
import { VerifyDocumentHeader } from '../sections/VerifyDocumentHeader';
import { VerifyDocumentIcon } from '../sections/VerifyDocumentIcons';
import type { VerificationResult } from '../sections/VerifyDocumentResult';
import { VerifyDocumentSteps } from '../sections/VerifyDocumentSteps';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/verify-document.css';

/** The live page's words. */
const NOT_A_PDF = 'Please upload a PDF file.';
const FAILED = 'Verification failed. Please try again.';

async function computeHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function NavigatorVerifyDocumentPage() {
  const [state, setState] = useState<VerificationState>('idle');
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [hash, setHash] = useState('');
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [pickError, setPickError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setPickError(NOT_A_PDF);
      return;
    }

    setPickError('');
    setFileName(file.name);
    setFileSize(file.size);
    setHash('');
    setResult(null);
    setErrorMsg('');

    // Step 1: Hash locally
    setState('hashing');
    try {
      const digest = await computeHash(file);
      setHash(digest);

      // Step 2: Verify against server
      setState('verifying');
      const response = await esignApi.verifyDocumentHash(digest);

      setResult(response);
      setState(response.verified ? 'verified' : 'not_found');
    } catch (err) {
      console.error('Verification error:', err);
      setErrorMsg(err instanceof Error ? err.message : FAILED);
      setState('error');
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLLabelElement>) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  const reset = () => {
    setState('idle');
    setFileName('');
    setFileSize(0);
    setHash('');
    setResult(null);
    setErrorMsg('');
    setPickError('');
  };

  return (
    <div className="nw-site nwvd">
      <VerifyDocumentHeader />
      <main className="nwvd-main">
        <div className="nwvd-intro">
          <span className="nwvd-badge">
            <VerifyDocumentIcon name="shieldCheck" size={28} />
          </span>
          <h1 className="nwvd-title">Verify Document Integrity</h1>
          <p className="nwvd-lead">
            Upload a PDF document signed through Navigate Wealth to confirm it has not been tampered
            with since signing.
          </p>
        </div>

        <VerifyDocumentCard
          state={state}
          result={result}
          hash={hash}
          fileLabel={`${fileName} (${formatFileSize(fileSize)})`}
          errorMsg={errorMsg}
          pickError={pickError}
          dragOver={dragOver}
          onDragOver={handleDragOver}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onInputChange={handleInputChange}
          onReset={reset}
        />

        <VerifyDocumentSteps />
      </main>
    </div>
  );
}

export default NavigatorVerifyDocumentPage;
