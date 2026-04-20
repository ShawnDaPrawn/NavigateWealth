/**
 * E-Signature Signer Landing Page
 * Standalone page for signers to view and sign documents.
 * Access via unique token link sent via email: /sign?token=...
 * 
 * Flow: loading → otp → signing → complete
 *       loading → waiting (sequential signing)
 *       loading → expired (invalid token)
 *       signing → rejected (signer declines)
 */

import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Loader2, AlertCircle, ShieldCheck, FileText, Lock, Clock, CheckCircle2, User, XCircle } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { OtpVerificationStep } from './OtpVerificationStep';
import { SigningWorkflow } from './SigningWorkflow';
import { SigningCompletePage } from './SigningCompletePage';
import { useSignerSession } from './hooks/useSignerSession';
import { useSignerBranding } from './hooks/useSignerBranding';
import { t, normaliseLang } from './i18n';
import type { SignerOrderSummary } from './types';

type SigningStep = 'loading' | 'expired' | 'otp' | 'signing' | 'waiting' | 'complete' | 'rejected' | 'error';

export function SignerLandingPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [currentStep, setCurrentStep] = useState<SigningStep>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const {
    sessionData,
    loading,
    error,
    validateToken,
    verifyOtp,
    submitSignature,
    rejectDocument,
    resendOtp
  } = useSignerSession();

  // Initial token validation
  useEffect(() => {
    if (!token) {
      setCurrentStep('expired');
      return;
    }

    validateToken(token).then(result => {
      if (result.success && result.data) {
        // Check envelope status first
        if (result.data.envelope_status === 'voided') {
          setErrorMessage('This document has been voided by the sender.');
          setCurrentStep('expired');
          return;
        }

        // Check if already signed
        if (result.data.signer_status === 'signed') {
          setCurrentStep('complete');
        } else if (result.data.signer_status === 'rejected' || result.data.signer_status === 'declined') {
          setCurrentStep('rejected');
        } else if (result.data.is_turn === false) {
          // Sequential signing: not this signer's turn yet
          setCurrentStep('waiting');
        } else if (result.data.otp_required && result.data.signer_status !== 'otp_verified') {
          setCurrentStep('otp');
        } else {
          setCurrentStep('signing');
        }
      } else {
        setErrorMessage(result.error || 'This link has expired or is invalid.');
        setCurrentStep('expired');
      }
    });
  }, [token]);

  const handleOtpVerified = () => {
    setCurrentStep('signing');
  };

  const handleSigningComplete = () => {
    setCurrentStep('complete');
  };

  const handleReject = async (reason: string) => {
    if (!token) return;

    const result = await rejectDocument(token, reason);
    if (result.success) {
      setCurrentStep('rejected');
    }
  };

  // P8.6 / P8.7 — derive firm branding + signer-preferred language
  // once per render. Both fall back to platform defaults when nothing
  // is configured for this firm/signer.
  const branding = useSignerBranding(sessionData?.branding ?? null);
  const lang = normaliseLang(sessionData?.signer_language);

  // ==================== LOADING STATE ====================
  if (currentStep === 'loading') {
    return (
      <main
        role="main"
        aria-label={t('loading.title', lang)}
        className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/30 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <Card className="overflow-hidden shadow-lg border-0">
            <div className="h-1.5" style={branding.stripStyle} />
            <div className="p-8 flex flex-col items-center text-center space-y-5">
              <div className="relative">
                <div
                  className="h-16 w-16 rounded-full flex items-center justify-center"
                  style={{ background: `${branding.accentHex}1a` }}
                >
                  <Loader2
                    className="h-8 w-8 animate-spin"
                    style={{ color: branding.accentHex }}
                    aria-hidden="true"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <h2 className="text-xl font-bold text-gray-900">{t('loading.title', lang)}</h2>
                <p className="text-gray-500 text-sm">
                  {t('loading.subtitle', lang)}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400" role="status" aria-live="polite">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t('loading.secure', lang)}</span>
              </div>
            </div>
          </Card>
        </motion.div>
      </main>
    );
  }

  // ==================== EXPIRED/INVALID TOKEN STATE ====================
  if (currentStep === 'expired') {
    return (
      <main
        role="main"
        aria-label={t('expired.title', lang)}
        className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-red-50/20 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Card className="overflow-hidden shadow-lg border-0">
            <div className="bg-gradient-to-r from-red-400 to-orange-400 h-1.5" />
            <div className="p-8 flex flex-col items-center text-center space-y-5">
              <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-red-600" aria-hidden="true" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-gray-900">{t('expired.title', lang)}</h2>
                <p className="text-gray-500 text-sm leading-relaxed" role="alert">
                  {errorMessage || t('expired.fallback', lang)}
                </p>
              </div>
              <div className="w-full pt-2">
                <Button
                  onClick={() => navigate('/')}
                  variant="outline"
                  className="w-full"
                >
                  {t('expired.return', lang)}
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>
      </main>
    );
  }

  // ==================== REJECTED STATE ====================
  if (currentStep === 'rejected') {
    return (
      <main
        role="main"
        aria-label={t('rejected.title', lang)}
        className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-orange-50/20 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Card className="overflow-hidden shadow-lg border-0">
            <div className="bg-gradient-to-r from-orange-400 to-amber-400 h-1.5" />
            <div className="p-8 flex flex-col items-center text-center space-y-5">
              <div className="h-16 w-16 rounded-full bg-orange-100 flex items-center justify-center">
                <XCircle className="h-8 w-8 text-orange-600" aria-hidden="true" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-gray-900">{t('rejected.title', lang)}</h2>
                <p className="text-gray-500 text-sm leading-relaxed" role="status">
                  {t('rejected.body', lang, {
                    title: sessionData?.envelope_title || 'this document',
                  })}
                </p>
              </div>
              <div className="w-full pt-2">
                <Button
                  onClick={() => navigate('/')}
                  variant="outline"
                  className="w-full"
                >
                  {t('rejected.close', lang)}
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>
      </main>
    );
  }

  // ==================== OTP VERIFICATION ====================
  if (currentStep === 'otp') {
    return (
      <div className="min-h-screen bg-gray-50">
        <OtpVerificationStep
          token={token!}
          sessionData={sessionData}
          onVerified={handleOtpVerified}
          verifyOtp={verifyOtp}
          resendOtp={resendOtp}
        />
      </div>
    );
  }

  // ==================== SIGNING WORKFLOW ====================
  if (currentStep === 'signing') {
    return (
      <SigningWorkflow
        token={token!}
        sessionData={sessionData}
        onComplete={handleSigningComplete}
        onReject={handleReject}
        submitSignature={submitSignature}
      />
    );
  }

  // ==================== WAITING STATE (Sequential Signing) ====================
  if (currentStep === 'waiting') {
    const allSigners: SignerOrderSummary[] = sessionData?.all_signers || [];

    return (
      <main
        role="main"
        aria-label={t('waiting.title', lang)}
        className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-amber-50/20 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg"
        >
          <Card className="overflow-hidden shadow-lg border-0">
            <div className="bg-gradient-to-r from-amber-400 to-yellow-400 h-1.5" />
            <div className="p-6 md:p-8 flex flex-col items-center text-center space-y-5">
              <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center">
                <Clock className="h-8 w-8 text-amber-600" aria-hidden="true" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-gray-900">{t('waiting.title', lang)}</h2>
                <p className="text-gray-500 text-sm leading-relaxed">
                  {t('waiting.body', lang)}
                </p>
              </div>

              {/* Signing order progress */}
              {allSigners.length > 0 && (
                <div className="w-full bg-white border border-gray-100 rounded-xl p-4 text-left space-y-3">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('waiting.order', lang)}</h3>
                  <div className="space-y-2">
                    {allSigners.map((s) => {
                      const isSigned = s.status === 'signed';
                      const isCurrent = s.is_current;
                      return (
                        <div
                          key={s.order}
                          className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${
                            isCurrent
                              ? 'border-amber-300 bg-amber-50'
                              : isSigned
                                ? 'border-green-200 bg-green-50'
                                : 'border-gray-100 bg-gray-50'
                          }`}
                        >
                          <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 ${
                            isSigned
                              ? 'bg-green-100 text-green-700'
                              : isCurrent
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-gray-200 text-gray-500'
                          }`}>
                            {isSigned ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                              s.order
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${
                              isCurrent ? 'text-amber-900' : isSigned ? 'text-green-800' : 'text-gray-600'
                            }`}>
                              {isCurrent ? `${s.name} (You)` : s.name}
                            </p>
                            {s.role && (
                              <p className="text-xs text-gray-500">{s.role}</p>
                            )}
                          </div>
                          <Badge
                            variant="outline"
                            className={`text-[11px] shrink-0 ${
                              isSigned
                                ? 'bg-green-100 text-green-700 border-green-200'
                                : isCurrent
                                  ? 'bg-amber-100 text-amber-700 border-amber-200'
                                  : 'bg-gray-100 text-gray-500 border-gray-200'
                            }`}
                          >
                            {isSigned ? 'Signed' : isCurrent ? 'Waiting' : 'Queued'}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 w-full">
                <p className="text-sm text-blue-800">
                  You will be notified by email at <strong>{sessionData?.signer_email}</strong> when it is your turn to sign.
                </p>
              </div>

              <Button
                onClick={() => navigate('/')}
                variant="outline"
                className="w-full"
              >
                Close
              </Button>
            </div>
          </Card>
        </motion.div>
      </main>
    );
  }

  // ==================== COMPLETE STATE ====================
  if (currentStep === 'complete') {
    return (
      <div className="min-h-screen bg-gray-50">
        <SigningCompletePage
          sessionData={sessionData}
          onClose={() => navigate('/')}
          token={token!}
        />
      </div>
    );
  }

  return null;
}
