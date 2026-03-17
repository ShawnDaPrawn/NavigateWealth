import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { CheckCircle, XCircle, Loader2, Mail } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

export function NewsletterConfirmPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'already'>('loading');
  const [message, setMessage] = useState('');
  
  const token = searchParams.get('token');
  const email = searchParams.get('email');

  useEffect(() => {
    const confirmSubscription = async () => {
      if (!token || !email) {
        setStatus('error');
        setMessage('Invalid confirmation link. Please check your email for the correct link.');
        return;
      }

      try {
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/newsletter/confirm?token=${token}&email=${encodeURIComponent(email)}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`
            }
          }
        );

        const data = await response.json();

        if (!response.ok) {
          if (data.error === 'Confirmation link expired') {
            setStatus('error');
            setMessage('This confirmation link has expired. Please subscribe again to receive a new confirmation email.');
          } else {
            setStatus('error');
            setMessage(data.error || 'Failed to confirm subscription. Please try again or contact support.');
          }
          return;
        }

        if (data.alreadyConfirmed) {
          setStatus('already');
          setMessage('Your subscription was already confirmed. You\'re all set!');
        } else {
          setStatus('success');
          setMessage('Thank you for confirming your subscription! You\'ll now receive our newsletter with financial insights and updates.');
        }
      } catch (error) {
        console.error('Confirmation error:', error);
        setStatus('error');
        setMessage('An error occurred while confirming your subscription. Please try again later.');
      }
    };

    confirmSubscription();
  }, [token, email]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50 flex items-center justify-center px-4 py-12">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-8 text-center">
          {status === 'loading' && (
            <div className="contents">
              <Loader2 className="h-16 w-16 text-primary mx-auto mb-4 animate-spin" />
              <h1 className="text-2xl mb-2">Confirming Your Subscription</h1>
              <p className="text-muted-foreground">Please wait while we process your confirmation...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="contents">
              <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
              <h1 className="text-2xl mb-2">You're In!</h1>
              <p className="text-muted-foreground mb-6">{message}</p>
              <div className="space-y-3">
                <Button asChild className="w-full">
                  <Link to="/resources">Explore Resources</Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/">Return to Homepage</Link>
                </Button>
              </div>
            </div>
          )}

          {status === 'already' && (
            <div className="contents">
              <Mail className="h-16 w-16 text-blue-600 mx-auto mb-4" />
              <h1 className="text-2xl mb-2">Already Confirmed</h1>
              <p className="text-muted-foreground mb-6">{message}</p>
              <div className="space-y-3">
                <Button asChild className="w-full">
                  <Link to="/resources">Explore Resources</Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/">Return to Homepage</Link>
                </Button>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="contents">
              <XCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />
              <h1 className="text-2xl mb-2">Confirmation Failed</h1>
              <p className="text-muted-foreground mb-6">{message}</p>
              <div className="space-y-3">
                <Button asChild variant="outline" className="w-full">
                  <Link to="/">Return to Homepage</Link>
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                Need help? Contact us at{' '}
                <a href="mailto:info@navigatewealth.co" className="text-primary hover:underline">
                  info@navigatewealth.co
                </a>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}