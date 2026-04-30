/**
 * LinkedIn OAuth Callback Page
 *
 * Handles the redirect from LinkedIn after OAuth authorization.
 * Extracts the code and state from the URL, exchanges them via the server,
 * and redirects back to the admin Social Media module.
 *
 * Route: /auth/linkedin/callback
 *
 * @module pages/LinkedInCallbackPage
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { linkedinApi } from '../admin/modules/social-media/api';
import { Linkedin, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

type CallbackState = 'processing' | 'success' | 'error';

export function LinkedInCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<CallbackState>('processing');
  const [errorMessage, setErrorMessage] = useState('');
  const [profileName, setProfileName] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const oauthState = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // LinkedIn may redirect with an error
    if (error) {
      setState('error');
      setErrorMessage(errorDescription || `LinkedIn authorization failed: ${error}`);
      return;
    }

    if (!code || !oauthState) {
      setState('error');
      setErrorMessage('Missing authorization code or state. Please try connecting again.');
      return;
    }

    // Exchange the code for tokens
    const redirectUri = `${window.location.origin}/auth/linkedin/callback`;

    linkedinApi.handleCallback(code, oauthState, redirectUri)
      .then((res) => {
        if (res.success && res.data) {
          setState('success');
          setProfileName(res.data.profileName || '');
          // Redirect to admin social media module after 2 seconds
          setTimeout(() => {
            navigate('/admin?module=social-media&tab=social-media', { replace: true });
          }, 2000);
        } else {
          setState('error');
          setErrorMessage(res.error || 'Failed to complete LinkedIn connection');
        }
      })
      .catch((err) => {
        console.error('LinkedIn callback error:', err);
        setState('error');
        setErrorMessage('An unexpected error occurred. Please try again.');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border p-8 text-center space-y-6">
        {/* LinkedIn icon */}
        <div
          className="mx-auto h-16 w-16 rounded-2xl flex items-center justify-center"
          style={{ backgroundColor: '#0A66C2' }}
        >
          <Linkedin className="h-8 w-8 text-white" />
        </div>

        {state === 'processing' && (
          <div className="contents">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Connecting LinkedIn</h2>
            <p className="text-sm text-muted-foreground">
              Exchanging authorization code and setting up your connection...
            </p>
          </div>
        )}

        {state === 'success' && (
          <div className="contents">
            <div className="mx-auto h-12 w-12 rounded-full bg-green-50 flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">LinkedIn Connected!</h2>
            <p className="text-sm text-muted-foreground">
              {profileName
                ? `Successfully connected as ${profileName}.`
                : 'Successfully connected your LinkedIn account.'
              }
            </p>
            <p className="text-xs text-muted-foreground">
              Redirecting to the admin panel...
            </p>
          </div>
        )}

        {state === 'error' && (
          <div className="contents">
            <div className="mx-auto h-12 w-12 rounded-full bg-red-50 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Connection Failed</h2>
            <p className="text-sm text-red-600">{errorMessage}</p>
            <button
              onClick={() => navigate('/admin?module=social-media&tab=social-media')}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-white font-medium text-sm hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#0A66C2' }}
            >
              Return to Admin Panel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default LinkedInCallbackPage;
