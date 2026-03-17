import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '../ui/button';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { Logo } from '../layout/Logo';
import { useAuth } from '../auth/AuthContext';

export default function VerificationSuccessPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    // Determine where to redirect based on authentication status
    const getRedirectPath = () => {
      if (isAuthenticated && user) {
        // User is authenticated, redirect to application flow
        if (user.applicationStatus === 'incomplete') {
          return !user.accountType ? '/account-type' : '/application';
        }
        return '/dashboard';
      }
      // User is not authenticated, redirect to login
      return '/login';
    };

    // Start countdown
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          const redirectPath = getRedirectPath();
          console.log(`✅ Redirecting to ${redirectPath}`);
          navigate(redirectPath, { replace: true });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate, isAuthenticated, user]);

  // Determine the call-to-action based on authentication status
  const ctaPath = isAuthenticated && user 
    ? (user.applicationStatus === 'incomplete' 
        ? (!user.accountType ? '/account-type' : '/application')
        : '/dashboard')
    : '/login';
  
  const ctaText = isAuthenticated ? 'Continue to Application' : 'Continue to Login';

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Logo */}
        <div className="text-center">
          <Link to="/" className="inline-block">
            <Logo size="lg" />
          </Link>
        </div>

        {/* Success Card */}
        <div className="mt-8 bg-white py-12 px-4 shadow-xl sm:rounded-2xl sm:px-10 border border-purple-100">
          {/* Success Icon */}
          <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-green-100 animate-bounce-once">
            <CheckCircle2 className="h-12 w-12 text-green-600" />
          </div>

          {/* Success Message */}
          <div className="mt-6 text-center">
            <h2 className="text-gray-900">
              Email Verified Successfully!
            </h2>
            <p className="mt-3 text-gray-600">
              Your email has been successfully verified. You can now log in to access your Navigate Wealth account.
            </p>
          </div>

          {/* Divider */}
          <div className="mt-8 border-t border-gray-200 pt-8">
            {/* Login Button */}
            <Link to={ctaPath}>
              <Button 
                className="w-full bg-purple-700 hover:bg-purple-800 flex items-center justify-center gap-2 group"
              >
                <span>{ctaText}</span>
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>

            {/* Auto-redirect Notice */}
            <p className="mt-4 text-center text-sm text-gray-500">
              Redirecting automatically in {countdown} second{countdown !== 1 ? 's' : ''}...
            </p>
          </div>

          {/* Additional Help */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="text-center space-y-3">
              <p className="text-sm text-gray-600">
                Need help getting started?
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link 
                  to="/help" 
                  className="text-sm text-purple-700 hover:text-purple-800 underline"
                >
                  Visit Help Center
                </Link>
                <span className="hidden sm:inline text-gray-300">•</span>
                <Link 
                  to="/contact" 
                  className="text-sm text-purple-700 hover:text-purple-800 underline"
                >
                  Contact Support
                </Link>
              </div>
            </div>
          </div>

          {/* Security Notice */}
          <div className="mt-6 bg-purple-50 border border-purple-100 rounded-lg p-4">
            <p className="text-xs text-gray-700 text-center">
              🔒 Your account is now active and secured. For your security, please use a strong password and enable two-factor authentication in your account settings.
            </p>
          </div>
        </div>

        {/* Back to Home Link */}
        <div className="mt-6 text-center">
          <Link 
            to="/" 
            className="text-sm text-gray-600 hover:text-gray-900 underline"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
