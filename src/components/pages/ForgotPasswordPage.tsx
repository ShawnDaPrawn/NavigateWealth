import { sendPasswordResetEmail } from '../../utils/auth/authService';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import { Mail, ArrowLeft, CheckCircle2, XCircle, Shield, CheckCircle, Lock, Key, Clock, AlertCircle } from 'lucide-react';
import { getUserErrorMessage } from '../../utils/errorUtils';
import { useNavigate, Link } from 'react-router';
import { useState } from 'react';

const carouselSlides = [
  {
    id: 1,
    title: "Secure password recovery",
    subtitle: "Our advanced security measures ensure your account remains protected during the reset process.",
    content: (
      <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6 space-y-4">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 bg-white/30 rounded-full flex items-center justify-center">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-white font-semibold">Bank-Level Security</div>
            <div className="text-white/70 text-sm">Multi-layered protection</div>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center space-x-3 p-3 bg-white/10 rounded-lg">
            <CheckCircle className="h-4 w-4 text-white/80" />
            <span className="text-white/90 text-sm">256-bit SSL encryption</span>
          </div>
          <div className="flex items-center space-x-3 p-3 bg-white/10 rounded-lg">
            <CheckCircle className="h-4 w-4 text-white/80" />
            <span className="text-white/90 text-sm">Encrypted reset tokens</span>
          </div>
          <div className="flex items-center space-x-3 p-3 bg-white/10 rounded-lg">
            <CheckCircle className="h-4 w-4 text-white/80" />
            <span className="text-white/90 text-sm">Secure email delivery</span>
          </div>
          <div className="flex items-center space-x-3 p-3 bg-white/10 rounded-lg">
            <CheckCircle className="h-4 w-4 text-white/80" />
            <span className="text-white/90 text-sm">Identity verification</span>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 2,
    title: "Time-limited access tokens",
    subtitle: "Reset links expire automatically to prevent unauthorized access, keeping your account secure.",
    content: (
      <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6 space-y-4">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 bg-white/30 rounded-full flex items-center justify-center">
            <Clock className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-white font-semibold">Smart Expiration</div>
            <div className="text-white/70 text-sm">Automatic security timeout</div>
          </div>
        </div>
        <div className="space-y-3">
          <div className="bg-white/10 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-white/80 text-sm">Reset Token Validity</span>
              <span className="text-white font-semibold">15 Minutes</span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-2">
              <div className="bg-white/60 h-2 rounded-full w-3/4"></div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <div className="text-white font-semibold text-lg">✓</div>
              <div className="text-white/70 text-xs">Single Use</div>
            </div>
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <div className="text-white font-semibold text-lg">🔒</div>
              <div className="text-white/70 text-xs">Auto-Expire</div>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 3,
    title: "Multi-layer security protection",
    subtitle: "Multiple security checkpoints ensure only you can access your account recovery options.",
    content: (
      <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6 space-y-4">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 bg-white/30 rounded-full flex items-center justify-center">
            <Lock className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-white font-semibold">Verification Steps</div>
            <div className="text-white/70 text-sm">Multiple security layers</div>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 bg-white/30 rounded-full flex items-center justify-center mt-0.5">
              <span className="text-white font-semibold text-xs">1</span>
            </div>
            <div>
              <div className="text-white/90 text-sm font-medium">Email Verification</div>
              <div className="text-white/70 text-xs">Confirm account ownership</div>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 bg-white/30 rounded-full flex items-center justify-center mt-0.5">
              <span className="text-white font-semibold text-xs">2</span>
            </div>
            <div>
              <div className="text-white/90 text-sm font-medium">Secure Token</div>
              <div className="text-white/70 text-xs">Encrypted access key</div>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 bg-white/30 rounded-full flex items-center justify-center mt-0.5">
              <span className="text-white font-semibold text-xs">3</span>
            </div>
            <div>
              <div className="text-white/90 text-sm font-medium">New Password</div>
              <div className="text-white/70 text-xs">Create secure credentials</div>
            </div>
          </div>
        </div>
      </div>
    )
  }
];

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [currentSlide, setCurrentSlide] = useState(0);
  
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!email) {
      setError('Please enter your email address.');
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    
    setIsLoading(true);

    try {
      // Simulate API call
      await sendPasswordResetEmail(email);
      setIsSubmitted(true);
    } catch (error: unknown) {
      setError(getUserErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    navigate('/login');
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % carouselSlides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + carouselSlides.length) % carouselSlides.length);
  };

  if (isSubmitted) {
    return (
      <div className="flex flex-col lg:flex-row lg:min-h-screen">
        {/* Left Side - Success Message */}
        <div className="flex-1 flex flex-col justify-start lg:justify-center px-4 sm:px-6 lg:px-20 xl:px-24 bg-white py-8">
          <div className="mx-auto w-full max-w-md">
            {/* Success Message */}
            <div className="space-y-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              
              <div className="space-y-2 text-center">
                <h2 className="text-gray-900">Check Your Email</h2>
                <p className="text-gray-600">
                  We've sent a password reset link to <span className="text-gray-900">{email}</span>
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-3">
                  Didn't receive the email? Check your spam folder or try again.
                </p>
                <p className="text-xs text-gray-500">
                  The reset link will expire in 15 minutes for security reasons.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setIsSubmitted(false)}
                className="w-full border-gray-300"
              >
                Send Another Link
              </Button>
              <Button
                onClick={handleBackToLogin}
                className="w-full bg-purple-700 hover:bg-purple-800"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Login
              </Button>
            </div>
          </div>
        </div>

        {/* Right Column - Feature Showcase (Hidden on mobile) */}
        <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-purple-700 to-purple-900 relative overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-20 right-20 w-72 h-72 bg-white rounded-full blur-3xl"></div>
            <div className="absolute bottom-20 left-20 w-96 h-96 bg-white rounded-full blur-3xl"></div>
          </div>
          
          <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20 text-white">
            <div className="space-y-6">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto">
                <Mail className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-white text-center">
                Reset link sent securely
              </h2>
              <p className="text-purple-100 text-center">
                Your password reset request has been processed with our highest security standards.
              </p>
            </div>

            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6 mt-8">
              <div className="space-y-4">
                <div className="flex items-center justify-between text-white">
                  <span className="text-sm">Security Level</span>
                  <span>Maximum</span>
                </div>
                <div className="w-full bg-white/20 rounded-full h-2">
                  <div className="bg-white h-2 rounded-full w-full"></div>
                </div>
                <div className="text-center">
                  <p className="text-purple-100 text-sm">Your account is protected with bank-level security</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row lg:min-h-screen">
      {/* Left Column - Reset Form */}
      <div className="flex-1 flex flex-col justify-start lg:justify-center px-4 sm:px-6 lg:px-20 xl:px-24 bg-white py-8">
        <div className="mx-auto w-full max-w-md">
          {/* Header */}
          <div className="mb-8">
            <h2 className="text-gray-900 font-bold text-[20px]">Reset Password</h2>
            <p className="mt-2 text-gray-600">
              Enter your email address and we'll send you a link to reset your password
            </p>
          </div>

          {/* Reset Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert className="border-red-200 bg-red-50" role="alert">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1"
                required
                disabled={isLoading}
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-purple-700 hover:bg-purple-800"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" aria-hidden="true"></span>
                  Sending Reset Link...
                </span>
              ) : (
                'Send Reset Link'
              )}
            </Button>
            
            <Button
              type="button"
              variant="outline"
              onClick={handleBackToLogin}
              className="w-full border-gray-300"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Login
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <Link to="/signup" className="text-purple-700 hover:text-purple-800">
                Sign up
              </Link>
            </p>
          </div>

          {/* Security Notice */}
          <div className="mt-4 text-center">
            <p className="text-xs text-gray-500">
              For security reasons, we'll only send reset links to registered email addresses
            </p>
          </div>
        </div>
      </div>

      {/* Right Column - Feature Showcase (Hidden on mobile) */}
      <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-purple-700 to-purple-900 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 right-20 w-72 h-72 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-20 w-96 h-96 bg-white rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20 text-white bg-[rgba(49,54,83,0.9)]">
          <h1 className="text-white mb-4">Secure Account Recovery</h1>
          <p className="text-xl text-purple-100 mb-12">
            We take your security seriously with industry-leading protection measures.
          </p>

          <div className="space-y-8">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-white mb-1 text-[15px]">Bank-Level Encryption</h3>
                <p className="text-purple-100 text-[12px]">
                  256-bit SSL encryption protects your data and reset tokens at all times.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <Clock className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-white mb-1 text-[15px]">Time-Limited Tokens</h3>
                <p className="text-purple-100 text-[12px]">
                  Reset links expire after 15 minutes to prevent unauthorized access.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <Lock className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-white mb-1 text-[15px]">Verified Access Only</h3>
                <p className="text-purple-100 text-[12px]">
                  Only registered email addresses can receive password reset links.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
