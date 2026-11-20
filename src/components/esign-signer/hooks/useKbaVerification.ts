/**
 * useKbaVerification — the identity-check (KBA) step's state and its verify
 * handler: the identity number, the provider redirect (https only) and the
 * error wording.
 *
 * Moved verbatim out of KbaVerificationStep.tsx so the live step and the
 * Navigator redesign (src/site/sections/ESignVerify.tsx) run the same check
 * and differ only in how the step is drawn.
 */
import { useState } from 'react';
import type { KbaVerificationResult } from '../types';

export interface KbaVerificationOptions {
  token: string;
  onVerified: () => void;
  verifyKba: (token: string, idNumber?: string) => Promise<KbaVerificationResult>;
}

export function useKbaVerification({ token, onVerified, verifyKba }: KbaVerificationOptions) {
  const [idNumber, setIdNumber] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');

  const handleVerify = async () => {
    setIsVerifying(true);
    setError('');

    try {
      const result = await verifyKba(token, idNumber.trim() || undefined);
      if (result.status === 'passed') {
        onVerified();
        return;
      }

      if (result.actionUrl) {
        let providerUrl: URL;
        try {
          providerUrl = new URL(result.actionUrl);
        } catch {
          setError('The identity provider returned an invalid verification link.');
          return;
        }
        if (providerUrl.protocol !== 'https:') {
          setError('The identity provider returned an insecure verification link.');
          return;
        }
        window.location.assign(providerUrl.href);
        return;
      }

      setError(
        result.error ||
          (result.status === 'skipped'
            ? 'Identity verification is not currently available. Please contact the sender.'
            : 'We could not verify your identity. Please check your details and try again.'),
      );
    } finally {
      setIsVerifying(false);
    }
  };

  return { idNumber, setIdNumber, isVerifying, error, handleVerify };
}
