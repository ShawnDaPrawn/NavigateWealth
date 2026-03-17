import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Alert, AlertDescription } from '../ui/alert';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { getSupabaseClient } from '../../utils/supabase/client';
import { AUTH_ROUTES } from '../../utils/auth/constants';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your email...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const supabase = getSupabaseClient();
        
        const fullUrl = window.location.href;
        const hash = window.location.hash;
        const search = window.location.search;
        
        console.log('🔍 AUTH CALLBACK - Full URL:', fullUrl);
        console.log('🔍 AUTH CALLBACK - Hash:', hash);
        console.log('🔍 AUTH CALLBACK - Search params:', search);
        
        // Check for PKCE code in query params
        const searchParams = new URLSearchParams(search);
        const code = searchParams.get('code');
        const type = searchParams.get('type');
        
        // Check for implicit flow tokens in hash
        const hashParams = new URLSearchParams(hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const tokenHash = hashParams.get('token_hash');
        const hashType = hashParams.get('type');
        
        // Detect if this is a personnel invite callback
        const isInvite = type === 'invite' || hashType === 'invite' || hashType === 'recovery';
        
        console.log('🔍 AUTH CALLBACK - Auth data:', { 
          hasCode: !!code, 
          hasAccessToken: !!accessToken,
          hasTokenHash: !!tokenHash,
          type: type || hashType,
          isInvite,
        });
        
        /**
         * Determine where to send the user after a successful auth exchange.
         * Personnel invites go to /reset-password so the user can set their password.
         * Regular signups go to /application.
         */
        const getSuccessRedirect = (session: { user: { user_metadata?: Record<string, unknown> } } | null) => {
          if (isInvite || session?.user?.user_metadata?.invited) {
            return '/reset-password';
          }
          return '/application';
        };

        if (code) {
          // PKCE flow - exchange code for session
          console.log('✅ AUTH CALLBACK - PKCE code found, exchanging for session...');
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          
          if (error) {
            console.error('❌ AUTH CALLBACK - Error exchanging code:', error);
            throw error;
          }
          
          if (data.session) {
            console.log('✅ AUTH CALLBACK - Session created from code!');
            console.log('✅ AUTH CALLBACK - User:', data.session.user.email);
            console.log('✅ AUTH CALLBACK - Email confirmed:', data.session.user.email_confirmed_at);
            
            const redirectPath = getSuccessRedirect(data.session);

            if (isInvite || data.session.user.user_metadata?.invited) {
              setStatus('success');
              setMessage('Welcome! Redirecting you to set up your account password...');
              setTimeout(() => {
                console.log('➡️ AUTH CALLBACK - Invited user, redirecting to', redirectPath);
                navigate(redirectPath, { replace: true, state: { fromInvite: true } });
              }, 1500);
            } else {
              setStatus('success');
              setMessage('Email verified successfully! Redirecting to application...');
              setTimeout(() => {
                console.log('➡️ AUTH CALLBACK - Redirecting to', redirectPath);
                navigate(redirectPath, { replace: true });
              }, 1500);
            }
          }
        } else if (accessToken) {
          // Implicit flow - tokens already in URL
          console.log('✅ AUTH CALLBACK - Access token found in hash!');
          const refreshToken = hashParams.get('refresh_token');
          
          if (refreshToken) {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            
            if (error) {
              console.error('❌ AUTH CALLBACK - Error setting session:', error);
              throw error;
            }
            
            if (data.session) {
              console.log('✅ AUTH CALLBACK - Session set from tokens!');
              console.log('✅ AUTH CALLBACK - User:', data.session.user.email);

              const redirectPath = getSuccessRedirect(data.session);

              if (isInvite || data.session.user.user_metadata?.invited) {
                setStatus('success');
                setMessage('Welcome! Redirecting you to set up your account password...');
                setTimeout(() => {
                  console.log('➡️ AUTH CALLBACK - Invited user, redirecting to', redirectPath);
                  navigate(redirectPath, { replace: true, state: { fromInvite: true } });
                }, 1500);
              } else {
                setStatus('success');
                setMessage('Email verified successfully! Redirecting to application...');
                setTimeout(() => {
                  console.log('➡️ AUTH CALLBACK - Redirecting to', redirectPath);
                  navigate(redirectPath, { replace: true });
                }, 1500);
              }
            }
          }
        } else if (tokenHash) {
          // Email verification with token_hash (newer Supabase flow)
          console.log('✅ AUTH CALLBACK - Token hash found, verifying...');
          
          const verifyType = hashType || type;
          if (verifyType === 'invite') {
            // Invite flow via token_hash — check for session and redirect to password setup
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              console.log('✅ AUTH CALLBACK - Invite session found via token_hash!');
              setStatus('success');
              setMessage('Welcome! Redirecting you to set up your account password...');
              setTimeout(() => {
                navigate('/reset-password', { replace: true, state: { fromInvite: true } });
              }, 1500);
            } else {
              console.log('⚠️ AUTH CALLBACK - Invite token verified but no session');
              setStatus('success');
              setMessage('Invitation verified! Please set your password to continue.');
              setTimeout(() => {
                navigate('/reset-password', { replace: true, state: { fromInvite: true } });
              }, 2000);
            }
          } else if (verifyType === 'email' || verifyType === 'signup') {
            // The URL itself is the verification - Supabase will handle it
            // Just check if we now have a session
            const { data: { session } } = await supabase.auth.getSession();
            
            if (session) {
              console.log('✅ AUTH CALLBACK - Session found after token verification!');
              setStatus('success');
              setMessage('Email verified successfully! Redirecting...');
              
              setTimeout(() => {
                console.log('➡️ AUTH CALLBACK - Redirecting to /verification-success');
                navigate('/verification-success', { replace: true });
              }, 1500);
            } else {
              // Email verified but no session - user needs to login
              console.log('✅ AUTH CALLBACK - Email verified, no session. Redirecting to login...');
              setStatus('success');
              setMessage('Email verified successfully! Please sign in to continue.');
              
              setTimeout(() => {
                console.log('➡️ AUTH CALLBACK - Redirecting to /login');
                navigate('/login', { 
                  replace: true,
                  state: { 
                    message: 'Your email has been verified! Please sign in to continue.',
                    verified: true
                  } 
                });
              }, 2000);
            }
          }
        } else {
          // No auth data in URL - check for errors
          console.log('⚠️ AUTH CALLBACK - No auth data in URL');
          
          const errorInHash = hashParams.get('error');
          const errorInSearch = searchParams.get('error');
          const errorDescription = hashParams.get('error_description') || searchParams.get('error_description');
          
          if (errorInHash || errorInSearch) {
            console.error('❌ AUTH CALLBACK - Error in URL:', errorInHash || errorInSearch, errorDescription);
            throw new Error(errorDescription || errorInHash || errorInSearch || 'Authentication failed');
          }
          
          // Check if maybe there's already an active session
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            console.log('✅ AUTH CALLBACK - Active session found!');
            console.log('➡️ AUTH CALLBACK - Redirecting to /verification-success');
            navigate('/verification-success', { replace: true });
          } else {
            // Email was verified but no session was created
            // This is normal for Supabase email verification flow
            console.log('✅ AUTH CALLBACK - Email verification completed (no session needed)');
            
            setStatus('success');
            setMessage('Email verified successfully! Please sign in to continue.');
            
            // Redirect to login page
            setTimeout(() => {
              console.log('➡️ AUTH CALLBACK - Redirecting to /login');
              navigate('/login', { 
                replace: true,
                state: { 
                  message: 'Your email has been verified! Please sign in to continue.',
                  verified: true
                } 
              });
            }, 2000);
            return;
          }
        }

      } catch (err) {
        console.error('❌ AUTH CALLBACK - Verification error:', err);
        setStatus('error');
        
        if (err instanceof Error) {
          if (err.message.includes('expired')) {
            setMessage('This verification link has expired. Please request a new verification email.');
          } else if (err.message.includes('invalid')) {
            setMessage('This verification link is invalid. Please request a new verification email.');
          } else {
            setMessage(err.message || 'Verification failed. Please try again.');
          }
        } else {
          setMessage('An unexpected error occurred. Please try again.');
        }

        // Redirect to verify-email page after 5 seconds
        setTimeout(() => {
          console.log('➡️ AUTH CALLBACK - Redirecting to /verify-email after error');
          navigate('/verify-email', { replace: true });
        }, 5000);
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h1 className="text-3xl">
            Navigate<span className="text-purple-700">Wealth</span>
          </h1>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {status === 'loading' && (
            <div className="text-center" role="status" aria-label="Verifying email">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-purple-100">
                <Loader2 className="h-8 w-8 text-purple-700 animate-spin" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-gray-900">Verifying your email</h3>
              <p className="mt-2 text-gray-600">Please wait while we confirm your account...</p>
            </div>
          )}

          {status === 'success' && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                {message}
              </AlertDescription>
            </Alert>
          )}

          {status === 'error' && (
            <div className="contents">
              <Alert className="mb-6 border-red-200 bg-red-50">
                <XCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  {message}
                </AlertDescription>
              </Alert>

              <div className="mt-6 space-y-3 text-center">
                <p className="text-sm text-gray-600">
                  You'll be redirected to the verification page in a moment...
                </p>
                <a 
                  href="/verify-email" 
                  className="text-sm text-purple-700 hover:text-purple-800 underline"
                >
                  Or click here to go now
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}