/**
 * Signing Complete Page
 * Professional success page shown after document is signed.
 * Branded with Navigate Wealth identity, download option, and clear next-steps.
 */

import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { CheckCircle2, Download, Mail, Home, Shield, Clock, FileText, Loader2 } from 'lucide-react';
import type { SignerSessionData } from './types';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface SigningCompletePageProps {
  sessionData: SignerSessionData | null;
  onClose: () => void;
  token: string;
}

export function SigningCompletePage({ sessionData, onClose, token }: SigningCompletePageProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    // Hide confetti after animation completes
    const timer = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleDownload = async () => {
    if (!token) return;
    setIsDownloading(true);

    try {
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/esign/signer/download/${encodeURIComponent(token)}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `${sessionData?.envelope_title || 'signed_document'}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(blobUrl);
        document.body.removeChild(a);
      }
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const signedDate = new Date().toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gradient-to-br from-gray-50 via-white to-indigo-50/30">
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-2xl"
      >
        <Card className="overflow-hidden shadow-xl border-0">
          {/* Header Gradient Band */}
          <div className="bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 h-2" />

          <div className="p-6 md:p-10">
            <div className="text-center space-y-6">
              {/* Success Icon with Animation */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 15 }}
                className="flex justify-center"
              >
                <div className="relative">
                  <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle2 className="h-12 w-12 text-green-600" />
                  </div>
                  {/* Pulse ring */}
                  <div className="absolute inset-0 rounded-full bg-green-200/50 animate-ping" style={{ animationDuration: '2s', animationIterationCount: 3 }} />
                </div>
              </motion.div>

              {/* Success Message */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="space-y-2"
              >
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                  Document Signed Successfully
                </h1>
                <p className="text-gray-600 text-base">
                  Thank you for signing{' '}
                  <span className="font-semibold text-gray-800">
                    {sessionData?.envelope_title || 'the document'}
                  </span>
                </p>
              </motion.div>

              {/* Signing Summary */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-gray-50 rounded-xl p-4 max-w-md mx-auto"
              >
                <div className="space-y-2.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" />
                      Signed by
                    </span>
                    <span className="font-medium text-gray-900">{sessionData?.signer_name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      Date & Time
                    </span>
                    <span className="font-medium text-gray-900">{signedDate}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5" />
                      Status
                    </span>
                    <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Signed
                    </Badge>
                  </div>
                </div>
              </motion.div>

              {/* Information Cards */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="grid md:grid-cols-2 gap-3 my-6"
              >
                <div className="flex items-start gap-3 p-4 bg-white border border-gray-100 rounded-lg text-left">
                  <div className="h-9 w-9 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                    <Mail className="h-4.5 w-4.5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-0.5">Email Confirmation</h3>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      A confirmation with the signed document has been sent to your email.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-white border border-gray-100 rounded-lg text-left">
                  <div className="h-9 w-9 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                    <Shield className="h-4.5 w-4.5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-0.5">Legally Binding</h3>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Your e-signature is legally binding under the ECTA and securely stored.
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Next Steps */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="border-t pt-5 space-y-3"
              >
                <h3 className="text-sm font-semibold text-gray-700">What happens next?</h3>
                <div className="text-left space-y-2.5 max-w-md mx-auto">
                  {[
                    'The sender will be notified that you have signed the document',
                    'If other signers are required, they will receive their signing invitations',
                    'Once all parties have signed, you will receive the final completed document',
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <div className="h-5 w-5 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-[10px] font-bold text-indigo-700">{i + 1}</span>
                      </div>
                      <p className="text-sm text-gray-600">{step}</p>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Action Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="flex flex-col sm:flex-row gap-3 justify-center pt-4"
              >
                <Button
                  onClick={handleDownload}
                  variant="outline"
                  className="gap-2"
                  disabled={isDownloading}
                >
                  {isDownloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Download Copy
                </Button>
                <Button
                  onClick={onClose}
                  className="gap-2 bg-indigo-600 hover:bg-indigo-700"
                >
                  <Home className="h-4 w-4" />
                  Close
                </Button>
              </motion.div>

              {/* Footer */}
              <div className="pt-4 border-t">
                <p className="text-xs text-gray-400">
                  If you have any questions about this document, please contact the sender directly.
                </p>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}