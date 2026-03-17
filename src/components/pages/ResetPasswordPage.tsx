import { Link, useNavigate, useLocation } from 'react-router';
import { useState, useEffect } from 'react';
import { updatePassword } from '../../utils/auth/authService';
import { getSupabaseClient } from '../../utils/supabase/client';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import { Eye, EyeOff, KeyRound, CheckCircle2, XCircle, AlertTriangle, Clock } from 'lucide-react';
import { validatePassword, getPasswordStrengthColor, getPasswordStrengthLabel } from '../../utils/auth/passwordValidation';
import { getUserErrorMessage } from '../../utils/errorUtils';
import { Logo } from '../layout/Logo';
import { copyToClipboard } from '../../utils/clipboard';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as { fromInvite?: boolean } | null;
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [hasValidToken, setHasValidToken] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [isInviteFlow, setIsInviteFlow] = useState(locationState?.fromInvite === true);

  const passwordStrength = validatePassword(newPassword);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  // Verify and establish session from URL hash when component mounts
  useEffect(() => {
    const verifySession = async () => {
      const supabase = getSupabaseClient();
      
      try {
        // Check if we have hash params (from email link)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');
        
        // Detect invite flow from hash type or location state
        if (type === 'invite' || locationState?.fromInvite) {
          setIsInviteFlow(true);
        }

        if (accessToken && (type === 'recovery' || type === 'invite')) {
          // Set the session with the tokens from the URL
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });
          
          if (error || !data.session) {
            setIsExpired(true);
            setHasValidToken(false);
          } else {
            setHasValidToken(true);
            setIsExpired(false);
            
            // Check user_metadata for invite flag
            if (data.session.user.user_metadata?.invited) {
              setIsInviteFlow(true);
            }
            
            // Clean up URL hash
            window.history.replaceState(null, '', window.location.pathname);
          }
        } else {
          // Check if user already has an active session
          const { data: { session }, error: sessionCheckError } = await supabase.auth.getSession();
          
          if (sessionCheckError) {
            setIsExpired(true);
            setHasValidToken(false);
          } else if (session) {
            setHasValidToken(true);
            setIsExpired(false);
            
            // Check user_metadata for invite flag
            if (session.user.user_metadata?.invited) {
              setIsInviteFlow(true);
            }
          } else {
            setIsExpired(true);
            setHasValidToken(false);
          }
        }
      } catch (error: unknown) {
        setIsExpired(true);
        setError(getUserErrorMessage(error));
      } finally {
        setIsVerifying(false);
      }
    };

    verifySession();
  }, [locationState]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    // Check if we have a valid session
    if (!hasValidToken) {
      setError('Auth session missing! Please click the reset link from your email again.');
      return;
    }

    // Validate password
    if (!passwordStrength.isValid) {
      setError('Password does not meet security requirements');
      return;
    }

    // Check passwords match
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      await updatePassword(newPassword);
      setSuccess(true);
      
      // Invited personnel → admin panel; regular users → login
      const redirectTarget = isInviteFlow ? '/admin' : '/login';
      setTimeout(() => {
        navigate(redirectTarget);
      }, 2000);
    } catch (error: unknown) {
      setError(getUserErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading state while verifying session
  if (isVerifying) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8" role="status" aria-label="Verifying reset link">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-700" aria-hidden="true"></div>
            <p className="mt-4 text-gray-600">Verifying reset link...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show expired link message
  if (isExpired) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <Link to="/" className="flex justify-center mb-6">
            <Logo className="high-quality-image" />
          </Link>
          
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            {/* Expired Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <Clock className="h-8 w-8 text-red-600" />
              </div>
            </div>

            {/* Heading */}
            <div className="text-center mb-6">
              <h2 className="text-2xl text-gray-900 mb-2">Reset Link Expired</h2>
              <p className="text-gray-600">
                This password reset link has expired or has already been used.
              </p>
            </div>

            {/* Information Box */}
            <Alert className="mb-6 border-orange-200 bg-orange-50">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800">
                <div className="space-y-2">
                  <p className="font-medium">Password reset links expire after 24 hours for security reasons.</p>
                  <p className="text-sm">Each link can only be used once and becomes invalid after:</p>
                  <ul className="text-sm list-disc list-inside ml-2 space-y-1">
                    <li>24 hours from when it was sent</li>
                    <li>Being used to reset your password</li>
                    <li>A new reset link is requested</li>
                  </ul>
                </div>
              </AlertDescription>
            </Alert>

            {/* Supabase Configuration Warning */}
            <Alert className="mb-6 border-yellow-300 bg-yellow-50">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-900">
                <div className="space-y-2">
                  <p className="font-semibold text-sm">⚠️ Most Common Issue: URLs Not Whitelisted</p>
                  <p className="text-xs">Go to Supabase Dashboard and add these URLs:</p>
                  <div className="mt-2 space-y-1">
                    <code 
                      onClick={() => copyToClipboard(`${window.location.origin}/reset-password`)}
                      className="block bg-yellow-100 px-2 py-1 rounded text-xs cursor-pointer hover:bg-yellow-200 font-mono"
                      title="Click to copy"
                    >
                      {window.location.origin}/reset-password
                    </code>
                    <code 
                      onClick={() => copyToClipboard(`${window.location.origin}/**`)}
                      className="block bg-yellow-100 px-2 py-1 rounded text-xs cursor-pointer hover:bg-yellow-200 font-mono"
                      title="Click to copy"
                    >
                      {window.location.origin}/**
                    </code>
                  </div>
                  <p className="text-xs mt-2">
                    <strong>Location:</strong> Authentication → URL Configuration → Redirect URLs
                  </p>
                  <p className="text-xs font-semibold mt-1 text-red-700">
                    ⚠️ After adding URLs, you MUST request a NEW password reset email!
                  </p>
                </div>
              </AlertDescription>
            </Alert>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button
                onClick={() => navigate('/forgot-password')}
                className="w-full bg-purple-700 hover:bg-purple-800 text-white"
              >
                Request New Reset Link
              </Button>
              
              <Button
                variant="outline"
                onClick={() => navigate('/login')}
                className="w-full border-gray-300"
              >
                Back to Sign In
              </Button>
            </div>

            {/* Help Text */}
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Need help?{' '}
                <Link to="/contact" className="text-purple-700 hover:text-purple-800 hover:underline font-medium">
                  Contact support
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link to="/" className="flex justify-center">
          <h1 className="text-3xl">
            Navigate<span className="text-purple-700">Wealth</span>
          </h1>
        </Link>
        <h2 className="mt-6 text-center text-gray-900">
          {isInviteFlow ? 'Set up your account' : 'Set new password'}
        </h2>
        <p className="mt-2 text-center text-gray-600">
          {isInviteFlow
            ? 'Welcome to Navigate Wealth. Create a secure password to get started.'
            : 'Choose a strong password for your account'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {success && (
            <Alert className="mb-6 border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                {isInviteFlow
                  ? 'Account set up successfully! Redirecting to the admin panel...'
                  : 'Password reset successfully! Redirecting to sign in...'}
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert className="mb-6 border-red-200 bg-red-50">
              <XCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* New Password Field */}
            <div>
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative mt-1">
                <Input
                  id="newPassword"
                  name="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter your new password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>

              {/* Password Strength Indicator */}
              {newPassword.length > 0 && (
                <div className="mt-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Password Strength:</span>
                    <span className={`text-sm font-medium ${getPasswordStrengthColor(passwordStrength.score)}`}>
                      {getPasswordStrengthLabel(passwordStrength.score)}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        passwordStrength.score === 0 || passwordStrength.score === 1
                          ? 'bg-red-500'
                          : passwordStrength.score === 2
                          ? 'bg-orange-500'
                          : passwordStrength.score === 3
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                      }`}
                      style={{ width: `${(passwordStrength.score / 4) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Password Requirements */}
              <div className="mt-3 space-y-1">
                <p className="text-sm text-gray-700">Password must have:</p>
                <ul className="text-sm space-y-1">
                  <li className={`flex items-center gap-2 ${passwordStrength.requirements.minLength ? 'text-green-600' : 'text-gray-500'}`}>
                    {passwordStrength.requirements.minLength ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <span className="h-3 w-3 rounded-full border border-gray-300" />
                    )}
                    At least 12 characters
                  </li>
                  <li className={`flex items-center gap-2 ${passwordStrength.requirements.characterTypes >= 3 ? 'text-green-600' : 'text-gray-500'}`}>
                    {passwordStrength.requirements.characterTypes >= 3 ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <span className="h-3 w-3 rounded-full border border-gray-300" />
                    )}
                    At least 3 of: uppercase, lowercase, numbers, special characters
                  </li>
                  <li className={`flex items-center gap-2 ${passwordStrength.requirements.notCommon ? 'text-green-600' : 'text-gray-500'}`}>
                    {passwordStrength.requirements.notCommon ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <span className="h-3 w-3 rounded-full border border-gray-300" />
                    )}
                    Not a commonly used password
                  </li>
                </ul>
              </div>
            </div>

            {/* Confirm Password Field */}
            <div>
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative mt-1">
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your new password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
              {confirmPassword.length > 0 && (
                <div className="mt-1 flex items-center gap-2">
                  {passwordsMatch ? (
                    <div className="contents">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-green-600">Passwords match</span>
                    </div>
                  ) : (
                    <div className="contents">
                      <XCircle className="h-4 w-4 text-red-600" />
                      <span className="text-sm text-red-600">Passwords do not match</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full bg-purple-700 hover:bg-purple-800"
              disabled={isLoading || !passwordStrength.isValid || !passwordsMatch}
            >
              {isLoading
                ? (isInviteFlow ? 'Setting up account...' : 'Resetting password...')
                : (isInviteFlow ? 'Create Account' : 'Reset password')}
            </Button>
          </form>

          {/* Additional Links */}
          <div className="mt-6 text-center">
            <Link to="/login" className="text-sm text-purple-700 hover:text-purple-800">
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}