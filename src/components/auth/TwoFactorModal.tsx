import React, { useState, useRef, useEffect } from 'react';
import { X, Mail, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';

interface TwoFactorModalProps {
  email: string;
  onVerified: () => void;
  onCancel: () => void;
  verifyCode: (code: string) => Promise<{ success: boolean; error?: string }>;
  resendCode: () => Promise<{ success: boolean; error?: string }>;
  /** Controls the header copy. Defaults to 'login' (login-time verification). */
  context?: 'login' | 'settings';
}

export function TwoFactorModal({ email, onVerified, onCancel, verifyCode, resendCode, context = 'login' }: TwoFactorModalProps) {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Start countdown timer for resend
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCountdown]);

  // Auto-focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleCodeChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    setError('');

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits are entered
    if (index === 5 && value && newCode.every(digit => digit !== '')) {
      handleVerify(newCode.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    
    if (pastedData.length === 6) {
      const newCode = pastedData.split('');
      setCode(newCode);
      inputRefs.current[5]?.focus();
      
      // Auto-submit pasted code
      handleVerify(pastedData);
    }
  };

  const handleVerify = async (codeToVerify?: string) => {
    const finalCode = codeToVerify || code.join('');
    
    if (finalCode.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }

    setIsVerifying(true);
    setError('');

    try {
      const result = await verifyCode(finalCode);
      if (result.success) {
        // Success!
        onVerified();
      } else {
        throw new Error(result.error || 'Verification failed');
      }
    } catch (err) {
      console.error('❌ 2FA verification error:', err);
      setError(err instanceof Error ? err.message : 'Verification failed');
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCountdown > 0) return;

    setIsResending(true);
    setError('');

    try {
      const result = await resendCode();
      if (result.success) {
        // Start countdown (60 seconds)
        setResendCountdown(60);
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      } else {
        throw new Error(result.error || 'Failed to resend code');
      }
    } catch (err) {
      console.error('❌ Error resending code:', err);
      setError(err instanceof Error ? err.message : 'Failed to resend code');
    } finally {
      setIsResending(false);
    }
  };

  // Mask email (show first 2 chars and domain)
  const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, '$1***$3');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative animate-in fade-in zoom-in duration-200">
        {/* Close button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          disabled={isVerifying}
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="mx-auto w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
            <Mail className="h-6 w-6 text-purple-700" />
          </div>
          <h2 className="text-gray-900 mb-2">
            {context === 'login' ? 'Two-Factor Authentication' : 'Verify Your Email'}
          </h2>
          <p className="text-sm text-gray-600">
            {context === 'login'
              ? <>We've sent a 6-digit verification code to your email to confirm your identity:<br /><span className="font-medium text-gray-900">{maskedEmail}</span></>
              : <>To activate two-factor authentication, we've sent a 6-digit verification code to your email address:<br /><span className="font-medium text-gray-900">{maskedEmail}</span></>
            }
          </p>
          <p className="text-xs text-gray-500 mt-2">
            We currently only support 2FA via email.
          </p>
        </div>

        {/* Error alert */}
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Code input */}
        <div className="mb-6">
          <label className="block text-sm text-gray-700 mb-3 text-center">
            Enter 6-digit code
          </label>
          <div className="flex gap-2 justify-center" onPaste={handlePaste}>
            {code.map((digit, index) => (
              <input
                key={index}
                ref={el => inputRefs.current[index] = el}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleCodeChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                disabled={isVerifying}
                className={`
                  w-12 h-14 text-center text-xl font-semibold
                  border-2 rounded-lg
                  transition-all duration-200
                  ${digit 
                    ? 'border-purple-700 bg-purple-50' 
                    : 'border-gray-300 bg-white'
                  }
                  ${isVerifying ? 'opacity-50 cursor-not-allowed' : 'hover:border-purple-400'}
                  focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent
                `}
              />
            ))}
          </div>
        </div>

        {/* Verify button */}
        <Button
          onClick={() => handleVerify()}
          disabled={isVerifying || code.some(digit => !digit)}
          className="w-full bg-gradient-to-r from-purple-700 to-purple-800 hover:from-purple-800 hover:to-purple-900 mb-4"
        >
          {isVerifying ? (
            <div className="contents">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Verifying...
            </div>
          ) : (
            'Verify Code'
          )}
        </Button>

        {/* Resend code */}
        <div className="text-center text-sm">
          <span className="text-gray-600">Didn't receive the code? </span>
          {resendCountdown > 0 ? (
            <span className="text-gray-500">
              Resend in {resendCountdown}s
            </span>
          ) : (
            <button
              onClick={handleResendCode}
              disabled={isResending}
              className="text-purple-700 hover:text-purple-800 font-medium inline-flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isResending ? (
                <div className="contents">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Sending...
                </div>
              ) : (
                <div className="contents">
                  <RefreshCw className="h-3 w-3" />
                  Resend code
                </div>
              )}
            </button>
          )}
        </div>

        {/* Help text */}
        <p className="text-xs text-gray-500 text-center mt-4">
          The code expires in 5 minutes. Check your inbox and spam folder.
        </p>
      </div>
    </div>
  );
}