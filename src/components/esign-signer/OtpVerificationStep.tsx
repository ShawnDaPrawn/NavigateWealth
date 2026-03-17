/**
 * OTP Verification Step
 * Handles OTP verification for secure document signing.
 * Features: 6-digit code input with auto-focus, paste support, resend cooldown,
 * branded visual design, and auto-submit on complete.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { ShieldCheck, Loader2, AlertCircle, Mail, ArrowLeft, CheckCircle2, Clock, FileText } from 'lucide-react';
import type { SignerSessionData } from './types';

interface OtpVerificationStepProps {
  token: string;
  sessionData: SignerSessionData | null;
  onVerified: () => void;
  verifyOtp: (token: string, otp: string) => Promise<{ success: boolean; error?: string }>;
  resendOtp: (token: string) => Promise<{ success: boolean; error?: string }>;
}

export function OtpVerificationStep({
  token,
  sessionData,
  onVerified,
  verifyOtp,
  resendOtp
}: OtpVerificationStepProps) {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendSuccess, setResendSuccess] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Cooldown timer for resend
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Auto-submit when all digits are entered
  useEffect(() => {
    const isComplete = otp.every(digit => digit !== '');
    if (isComplete && !isVerifying) {
      handleVerify();
    }
  }, [otp]);

  const handleOtpChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError(null);
    setResendSuccess(false);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pastedData) return;

    const newOtp = pastedData.split('').concat(Array(6).fill('')).slice(0, 6);
    setOtp(newOtp);

    const focusIndex = Math.min(pastedData.length, 5);
    inputRefs.current[focusIndex]?.focus();
  };

  const handleVerify = useCallback(async () => {
    const otpValue = otp.join('');

    if (otpValue.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }

    setIsVerifying(true);
    setError(null);

    const result = await verifyOtp(token, otpValue);

    if (result.success) {
      onVerified();
    } else {
      setError(result.error || 'Invalid verification code. Please try again.');
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }

    setIsVerifying(false);
  }, [otp, token, verifyOtp, onVerified]);

  const handleResendOtp = async () => {
    setError(null);
    setResendSuccess(false);

    try {
      const result = await resendOtp(token);

      if (result.success) {
        setResendCooldown(60);
        setResendSuccess(true);
        // Clear success message after 5s
        setTimeout(() => setResendSuccess(false), 5000);
      } else {
        setError(result.error || 'Failed to resend code');
      }
    } catch (err) {
      setError('An error occurred while resending the code');
    }
  };

  // Mask email for display
  const maskedEmail = sessionData?.signer_email
    ? (() => {
        const [local, domain] = sessionData.signer_email.split('@');
        if (!domain) return sessionData.signer_email;
        const masked = local.length > 2
          ? local[0] + '•'.repeat(Math.min(local.length - 2, 6)) + local[local.length - 1]
          : local;
        return `${masked}@${domain}`;
      })()
    : 'your email';

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gradient-to-br from-gray-50 via-white to-indigo-50/30">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        <Card className="overflow-hidden shadow-xl border-0">
          {/* Header Gradient Band */}
          <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 h-2" />

          <div className="p-6 md:p-8">
            {/* Header */}
            <div className="flex flex-col items-center text-center mb-7">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                className="h-16 w-16 rounded-full bg-indigo-100 flex items-center justify-center mb-4"
              >
                <ShieldCheck className="h-8 w-8 text-indigo-600" />
              </motion.div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1.5">Verify Your Identity</h1>
              <p className="text-sm text-gray-500">
                We've sent a 6-digit verification code to
              </p>
              <p className="text-sm mt-1 font-medium text-gray-800">
                <Mail className="h-3.5 w-3.5 inline mr-1 text-indigo-500 -mt-0.5" />
                {maskedEmail}
              </p>
            </div>

            {/* Document info */}
            {sessionData && (
              <div className="mb-6 p-3.5 bg-gray-50 rounded-lg border border-gray-100 flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
                  <FileText className="h-4.5 w-4.5 text-gray-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-gray-400 uppercase tracking-wide font-medium">Document</p>
                  <p className="text-sm font-medium text-gray-800 truncate">{sessionData.envelope_title}</p>
                </div>
              </div>
            )}

            {/* OTP Input */}
            <div className="mb-5">
              <label className="block text-sm text-gray-600 mb-3 text-center font-medium">
                Enter Verification Code
              </label>
              <div className="flex gap-2.5 justify-center">
                {otp.map((digit, index) => (
                  <Input
                    key={index}
                    ref={el => inputRefs.current[index] = el}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleOtpChange(index, e.target.value)}
                    onKeyDown={e => handleKeyDown(index, e)}
                    onPaste={handlePaste}
                    className={`w-12 h-14 text-center text-xl font-bold rounded-lg border-2 transition-all ${
                      digit
                        ? 'border-indigo-400 bg-indigo-50/50'
                        : 'border-gray-200 focus:border-indigo-500'
                    }`}
                    disabled={isVerifying}
                    autoFocus={index === 0}
                  />
                ))}
              </div>
            </div>

            {/* Error message */}
            {error && !isVerifying && (
              <Alert variant="destructive" className="mb-5">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Resend success */}
            {resendSuccess && (
              <Alert className="mb-5 bg-green-50 border-green-200 text-green-800">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription>A new code has been sent to your email.</AlertDescription>
              </Alert>
            )}

            {/* Verify button (manual, in case auto-submit didn't fire) */}
            <Button
              onClick={handleVerify}
              disabled={!otp.every(d => d !== '') || isVerifying}
              className="w-full mb-4 bg-indigo-600 hover:bg-indigo-700 h-11"
            >
              {isVerifying ? (
                <div className="contents">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verifying...
                </div>
              ) : (
                'Verify & Continue'
              )}
            </Button>

            {/* Resend OTP */}
            <div className="text-center">
              <p className="text-sm text-gray-500 mb-1.5">
                Didn't receive the code?
              </p>
              {resendCooldown > 0 ? (
                <p className="text-sm text-gray-400 flex items-center justify-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  Resend in {resendCooldown}s
                </p>
              ) : (
                <Button
                  onClick={handleResendOtp}
                  variant="ghost"
                  size="sm"
                  className="text-indigo-600 hover:text-indigo-700"
                >
                  Resend Code
                </Button>
              )}
            </div>

            {/* Security note */}
            <div className="mt-7 pt-5 border-t">
              <div className="flex items-start gap-2.5 text-xs text-gray-400">
                <ShieldCheck className="h-4 w-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                <p>
                  This verification code is valid for 10 minutes. Your identity verification ensures the
                  security and integrity of your electronic signature.
                </p>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}