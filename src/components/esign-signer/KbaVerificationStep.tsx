import { useState } from 'react';
import { AlertCircle, FileText, Loader2, ShieldCheck } from 'lucide-react';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import type { KbaVerificationResult, SignerSessionData } from './types';

interface KbaVerificationStepProps {
  token: string;
  sessionData: SignerSessionData | null;
  onVerified: () => void;
  verifyKba: (token: string, idNumber?: string) => Promise<KbaVerificationResult>;
}

export function KbaVerificationStep({
  token,
  sessionData,
  onVerified,
  verifyKba,
}: KbaVerificationStepProps) {
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

  return (
    <main className="min-h-screen flex items-center justify-center p-4" aria-label="Identity check">
      <Card className="w-full max-w-md overflow-hidden border-0 shadow-lg">
        <div className="h-1.5 bg-gradient-to-r from-indigo-500 to-purple-500" />
        <div className="p-6 md:p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100">
              <ShieldCheck className="h-7 w-7 text-indigo-700" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Verify your identity</h1>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              The sender requires an identity check before this document can be opened.
            </p>
          </div>

          {sessionData?.envelope_title && (
            <div className="mb-5 flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <FileText className="h-5 w-5 shrink-0 text-indigo-600" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Document
                </p>
                <p className="truncate text-sm font-semibold text-gray-900">
                  {sessionData.envelope_title}
                </p>
              </div>
            </div>
          )}

          <label htmlFor="kba-id-number" className="mb-2 block text-sm font-medium text-gray-700">
            South African ID or passport number
          </label>
          <Input
            id="kba-id-number"
            value={idNumber}
            onChange={(event) => setIdNumber(event.target.value)}
            autoComplete="off"
            disabled={isVerifying}
            placeholder="Enter your identity number"
          />
          <p className="mt-2 text-xs text-gray-500">
            Your identity number is sent securely to the configured verification provider and is not
            included in the signing audit log.
          </p>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button className="mt-6 w-full" onClick={handleVerify} disabled={isVerifying}>
            {isVerifying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Verifying identity…
              </>
            ) : (
              'Verify identity'
            )}
          </Button>
        </div>
      </Card>
    </main>
  );
}
