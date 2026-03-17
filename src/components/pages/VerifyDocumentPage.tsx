/**
 * Public Document Verification Page
 *
 * Allows anyone to upload a completed PDF and verify its integrity
 * against the stored SHA-256 hash without needing Adobe Acrobat.
 *
 * Accessible at /verify (no auth required).
 */

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  ShieldCheck,
  ShieldAlert,
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  User,
  Calendar,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react';
import { esignApi } from '../admin/modules/esign/api';

type VerificationState = 'idle' | 'hashing' | 'verifying' | 'verified' | 'not_found' | 'error';

interface VerificationResult {
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

export function VerifyDocumentPage() {
  const [state, setState] = useState<VerificationState>('idle');
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<number>(0);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [dragOver, setDragOver] = useState(false);

  const computeHash = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  };

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMsg('Please upload a PDF file.');
      setState('error');
      return;
    }

    setFileName(file.name);
    setFileSize(file.size);
    setResult(null);
    setErrorMsg('');

    // Step 1: Hash locally
    setState('hashing');
    try {
      const hash = await computeHash(file);

      // Step 2: Verify against server
      setState('verifying');
      const response = await esignApi.verifyDocumentHash(hash);

      setResult(response);
      setState(response.verified ? 'verified' : 'not_found');
    } catch (err) {
      console.error('Verification error:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Verification failed. Please try again.');
      setState('error');
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const reset = () => {
    setState('idle');
    setFileName('');
    setFileSize(0);
    setResult(null);
    setErrorMsg('');
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-ZA', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-purple-50/30">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-purple-600 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Navigate Wealth</h1>
              <p className="text-xs text-gray-500">Document Verification</p>
            </div>
          </div>
          <a
            href="/"
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to site
          </a>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Intro */}
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
            Verify Document Integrity
          </h2>
          <p className="text-gray-600 max-w-lg mx-auto text-sm sm:text-base">
            Upload a PDF document signed through Navigate Wealth to confirm it has not been
            tampered with since signing.
          </p>
        </div>

        {/* Upload / Result Card */}
        <Card className="shadow-lg border-0 ring-1 ring-gray-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              {state === 'idle' && 'Upload Document'}
              {(state === 'hashing' || state === 'verifying') && 'Verifying...'}
              {state === 'verified' && 'Verification Result'}
              {state === 'not_found' && 'Verification Result'}
              {state === 'error' && 'Verification Error'}
            </CardTitle>
            {state === 'idle' && (
              <CardDescription>
                Drag and drop a PDF file or click to browse. The file is hashed locally — it is
                never uploaded to our servers.
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {/* Upload Zone */}
            {state === 'idle' && (
              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-10 cursor-pointer transition-colors ${
                  dragOver
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-300 hover:border-purple-400 hover:bg-gray-50'
                }`}
              >
                <Upload className="h-10 w-10 text-gray-400 mb-3" />
                <p className="text-sm font-medium text-gray-700 mb-1">
                  Drop your PDF here or click to browse
                </p>
                <p className="text-xs text-gray-500">PDF files only</p>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleInputChange}
                  className="sr-only"
                />
              </label>
            )}

            {/* Loading State */}
            {(state === 'hashing' || state === 'verifying') && (
              <div className="flex flex-col items-center py-10">
                <Loader2 className="h-10 w-10 animate-spin text-purple-600 mb-4" />
                <p className="text-sm font-medium text-gray-700 mb-1">
                  {state === 'hashing'
                    ? 'Computing document fingerprint...'
                    : 'Checking against signed documents...'}
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
                  <FileText className="h-3.5 w-3.5" />
                  <span>
                    {fileName} ({formatFileSize(fileSize)})
                  </span>
                </div>
              </div>
            )}

            {/* Verified */}
            {state === 'verified' && result && (
              <div className="space-y-5">
                <div className="flex items-start gap-4 p-4 bg-green-50 rounded-xl border border-green-200">
                  <ShieldCheck className="h-8 w-8 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-green-800">Document Verified</p>
                      {result.matchType && (
                        <Badge className={result.matchType === 'signed'
                          ? 'bg-green-100 text-green-800 text-xs'
                          : 'bg-blue-100 text-blue-800 text-xs'
                        }>
                          {result.matchType === 'signed' ? 'Signed Copy' : 'Original'}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-green-700">{result.message}</p>
                  </div>
                </div>

                {/* Envelope Details */}
                {result.envelope && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-gray-700">Document Details</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-0.5">Title</p>
                        <p className="font-medium text-gray-900">{result.envelope.title}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-0.5">Status</p>
                        <Badge
                          className={
                            result.envelope.status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-amber-100 text-amber-800'
                          }
                        >
                          {result.envelope.status.charAt(0).toUpperCase() +
                            result.envelope.status.slice(1)}
                        </Badge>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-0.5">Created</p>
                        <p className="font-medium text-gray-900">
                          {formatDate(result.envelope.createdAt)}
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-0.5">Completed</p>
                        <p className="font-medium text-gray-900">
                          {formatDate(result.envelope.completedAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Signers */}
                {result.signers && result.signers.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-gray-700">Signers</h4>
                    <div className="space-y-2">
                      {result.signers.map((signer, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between bg-gray-50 rounded-lg p-3"
                        >
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-400" />
                            <div>
                              <p className="text-sm font-medium text-gray-900">{signer.name}</p>
                              {signer.role && (
                                <p className="text-xs text-gray-500">{signer.role}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {signer.status === 'signed' ? (
                              <div className="flex items-center gap-1.5">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                <span className="text-xs text-gray-500">
                                  {signer.signedAt ? formatDate(signer.signedAt) : 'Signed'}
                                </span>
                              </div>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                {signer.status}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* File info */}
                <div className="flex items-center gap-2 text-xs text-gray-500 pt-2 border-t">
                  <FileText className="h-3.5 w-3.5" />
                  <span>
                    {fileName} ({formatFileSize(fileSize)})
                  </span>
                </div>

                <Button onClick={reset} variant="outline" className="w-full">
                  Verify Another Document
                </Button>
              </div>
            )}

            {/* Not Found */}
            {state === 'not_found' && result && (
              <div className="space-y-5">
                <div className="flex items-start gap-4 p-4 bg-red-50 rounded-xl border border-red-200">
                  <ShieldAlert className="h-8 w-8 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-800 mb-1">Verification Failed</p>
                    <p className="text-sm text-red-700">{result.message}</p>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-amber-800">
                      <p className="font-medium mb-1">Possible reasons:</p>
                      <ul className="list-disc list-inside space-y-1 text-xs text-amber-700">
                        <li>The document was modified after signing</li>
                        <li>The document was not signed through Navigate Wealth</li>
                        <li>The file is a different version of the document</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-500 pt-2 border-t">
                  <FileText className="h-3.5 w-3.5" />
                  <span>
                    {fileName} ({formatFileSize(fileSize)})
                  </span>
                </div>

                <Button onClick={reset} variant="outline" className="w-full">
                  Try Another Document
                </Button>
              </div>
            )}

            {/* Error */}
            {state === 'error' && (
              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 bg-red-50 rounded-xl border border-red-200">
                  <XCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-800 mb-1">Error</p>
                    <p className="text-sm text-red-700">{errorMsg}</p>
                  </div>
                </div>
                <Button onClick={reset} variant="outline" className="w-full">
                  Try Again
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* How It Works */}
        <div className="mt-8 text-center">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">How it works</h3>
          <div className="grid grid-cols-3 gap-4">
            {[
              {
                step: '1',
                title: 'Upload',
                desc: 'Drop your signed PDF into the verification area',
              },
              {
                step: '2',
                title: 'Hash',
                desc: 'A SHA-256 fingerprint is computed locally in your browser',
              },
              {
                step: '3',
                title: 'Verify',
                desc: 'The fingerprint is matched against our signing records',
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="h-8 w-8 rounded-full bg-purple-100 text-purple-700 font-bold text-sm flex items-center justify-center mx-auto mb-2">
                  {item.step}
                </div>
                <p className="text-sm font-medium text-gray-800">{item.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-8">
          Your file never leaves your device. Only the computed hash is sent for verification.
        </p>
      </main>
    </div>
  );
}

export default VerifyDocumentPage;