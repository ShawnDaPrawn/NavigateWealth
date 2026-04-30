import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { SEO } from '../seo/SEO';

export function NewsletterUnsubscribePage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'initial' | 'loading' | 'success' | 'error'>('initial');
  const [message, setMessage] = useState('');
  
  const email = searchParams.get('email');
  const seoProps = {
    title: 'Newsletter Unsubscribe | Navigate Wealth',
    description: 'Newsletter unsubscribe page for Navigate Wealth.',
    canonicalUrl: 'https://www.navigatewealth.co/newsletter/unsubscribe',
    robotsContent: 'noindex, nofollow',
  };

  const handleUnsubscribe = async () => {
    if (!email) {
      setStatus('error');
      setMessage('Invalid unsubscribe link. Please use the link from your email.');
      return;
    }

    setStatus('loading');

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/newsletter/unsubscribe?email=${encodeURIComponent(email)}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setStatus('error');
        setMessage(data.error || 'Failed to unsubscribe. Please try again or contact support.');
        return;
      }

      if (data.notFound) {
        setStatus('error');
        setMessage('Subscription not found. You may have already unsubscribed.');
      } else {
        setStatus('success');
        setMessage('You have been successfully unsubscribed from our newsletter. We\'re sorry to see you go!');
      }
    } catch (error) {
      console.error('Unsubscribe error:', error);
      setStatus('error');
      setMessage('An error occurred while unsubscribing. Please try again later.');
    }
  };

  return (
    <>
      <SEO {...seoProps} />
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center px-4 py-12">
        <Card className="max-w-md w-full">
        {status === 'initial' && (
          <div className="contents">
            <CardHeader className="text-center">
              <CardTitle>Unsubscribe from Newsletter</CardTitle>
              <CardDescription>
                We're sorry to see you go! Click the button below to unsubscribe from Navigate Wealth's newsletter.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              {email && (
                <p className="text-sm text-muted-foreground mb-6">
                  Email: <strong>{email}</strong>
                </p>
              )}
              <div className="space-y-3">
                <Button 
                  onClick={handleUnsubscribe} 
                  variant="destructive" 
                  className="w-full"
                  disabled={!email}
                >
                  Unsubscribe
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/">Keep Subscription & Return Home</Link>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-6">
                You can always resubscribe later by signing up again on our website.
              </p>
            </CardContent>
          </div>
        )}

        {status === 'loading' && (
          <CardContent className="pt-8 pb-8 text-center">
            <Loader2 className="h-16 w-16 text-primary mx-auto mb-4 animate-spin" />
            <h2 className="text-xl mb-2">Processing Unsubscribe</h2>
            <p className="text-muted-foreground">Please wait...</p>
          </CardContent>
        )}

        {status === 'success' && (
          <CardContent className="pt-8 pb-8 text-center">
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-xl mb-2">Unsubscribed Successfully</h2>
            <p className="text-muted-foreground mb-6">{message}</p>
            <div className="space-y-3">
              <Button asChild className="w-full">
                <Link to="/">Return to Homepage</Link>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Changed your mind? You can always resubscribe from our website footer.
            </p>
          </CardContent>
        )}

        {status === 'error' && (
          <CardContent className="pt-8 pb-8 text-center">
            <XCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />
            <h2 className="text-xl mb-2">Unsubscribe Failed</h2>
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
          </CardContent>
        )}
        </Card>
      </div>
    </>
  );
}

export default NewsletterUnsubscribePage;
