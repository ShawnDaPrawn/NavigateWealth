import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Separator } from '../ui/separator';
import { Shield, FileText, Lock, CheckCircle } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { api } from '../../utils/api/client';
import { createClient } from '../../utils/supabase/client';

interface FirstLoginTermsGateProps {
  children: React.ReactNode;
}

/**
 * FirstLoginTermsGate
 *
 * Wraps portal content and forces admin-onboarded clients to accept
 * Terms & Conditions on their first login before accessing the dashboard.
 *
 * Checks `user_metadata.mustAcceptTerms` flag set during admin onboarding.
 * Once accepted, clears the flag and records the acceptance timestamp.
 */
export function FirstLoginTermsGate({ children }: FirstLoginTermsGateProps) {
  const { user, refreshUser } = useAuth();
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [popiaConsent, setPopiaConsent] = useState(false);
  const [faisAcknowledged, setFaisAcknowledged] = useState(false);
  const [disclosureAcknowledged, setDisclosureAcknowledged] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mustAcceptTerms, setMustAcceptTerms] = useState<boolean | null>(null);

  // Check metadata on mount
  React.useEffect(() => {
    checkTermsRequired();
  }, [user?.id]);

  const checkTermsRequired = async () => {
    if (!user?.id) {
      setMustAcceptTerms(false);
      return;
    }

    try {
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (authUser?.user_metadata?.mustAcceptTerms === true) {
        setMustAcceptTerms(true);
      } else {
        setMustAcceptTerms(false);
      }
    } catch {
      setMustAcceptTerms(false);
    }
  };

  const handleAcceptTerms = async () => {
    if (!termsAccepted || !popiaConsent || !faisAcknowledged || !disclosureAcknowledged) {
      toast.error('Please accept all required consents before proceeding');
      return;
    }

    setIsSubmitting(true);
    try {
      // Update user metadata to clear mustAcceptTerms
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        data: {
          mustAcceptTerms: false,
          termsAcceptedAt: new Date().toISOString(),
          termsAcceptedVersion: '1.0',
        },
      });

      if (error) throw error;

      // Also update the user profile in KV to record consent
      try {
        const profileKey = `user_profile:${user!.id}:personal_info`;
        const profileRes = await api.get<{ data: Record<string, unknown> }>(`/profile/personal-info?key=${encodeURIComponent(profileKey)}`);
        const existingProfile = profileRes?.data || {};

        await api.post('/profile/personal-info', {
          key: profileKey,
          data: {
            ...existingProfile,
            _termsConsent: {
              termsAccepted: true,
              popiaConsent: true,
              faisAcknowledged: true,
              disclosureAcknowledged: true,
              acceptedAt: new Date().toISOString(),
              acceptedVersion: '1.0',
            },
          },
        });
      } catch {
        // Non-blocking — metadata update is the important one
      }

      setMustAcceptTerms(false);
      toast.success('Terms accepted. Welcome to Navigate Wealth!');

      // Refresh user context
      if (refreshUser) await refreshUser();
    } catch (error: unknown) {
      console.error('Terms acceptance error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save your consent. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Still checking
  if (mustAcceptTerms === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="h-12 w-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-600">Loading your account...</p>
        </div>
      </div>
    );
  }

  // No gate needed
  if (!mustAcceptTerms) {
    return <div className="contents">{children}</div>;
  }

  // T&Cs acceptance screen
  const allChecked = termsAccepted && popiaConsent && faisAcknowledged && disclosureAcknowledged;

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gray-50">
      <Card className="max-w-2xl w-full shadow-lg">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto h-14 w-14 rounded-full bg-purple-100 flex items-center justify-center mb-3">
            <Shield className="h-7 w-7 text-purple-700" />
          </div>
          <CardTitle className="text-xl">Welcome to Navigate Wealth</CardTitle>
          <CardDescription className="text-sm">
            Before you can access your financial portal, please review and accept
            the following terms and conditions.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Terms & Conditions */}
          <div className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors">
            <Checkbox
              id="terms"
              checked={termsAccepted}
              onCheckedChange={(c) => setTermsAccepted(c === true)}
              className="mt-0.5"
            />
            <label htmlFor="terms" className="cursor-pointer text-sm leading-snug">
              <span className="font-medium text-gray-900 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-purple-600" />
                Terms and Conditions
              </span>
              <span className="text-gray-500 block mt-0.5">
                I have read and accept Navigate Wealth's Terms and Conditions governing the use of
                financial advisory services and the client portal.
              </span>
            </label>
          </div>

          {/* POPIA Consent */}
          <div className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors">
            <Checkbox
              id="popia"
              checked={popiaConsent}
              onCheckedChange={(c) => setPopiaConsent(c === true)}
              className="mt-0.5"
            />
            <label htmlFor="popia" className="cursor-pointer text-sm leading-snug">
              <span className="font-medium text-gray-900 flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-purple-600" />
                POPIA Consent
              </span>
              <span className="text-gray-500 block mt-0.5">
                I consent to Navigate Wealth processing my personal information in accordance with
                the Protection of Personal Information Act (POPIA). I understand my information will
                be used to provide personalised financial advice and services.
              </span>
            </label>
          </div>

          {/* FAIS Disclosure */}
          <div className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors">
            <Checkbox
              id="fais"
              checked={faisAcknowledged}
              onCheckedChange={(c) => setFaisAcknowledged(c === true)}
              className="mt-0.5"
            />
            <label htmlFor="fais" className="cursor-pointer text-sm leading-snug">
              <span className="font-medium text-gray-900 flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-purple-600" />
                FAIS Disclosure
              </span>
              <span className="text-gray-500 block mt-0.5">
                I acknowledge Navigate Wealth's disclosure under the Financial Advisory and
                Intermediary Services Act. I understand that Navigate Wealth is an authorised
                Financial Services Provider.
              </span>
            </label>
          </div>

          {/* Electronic Communication */}
          <div className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors">
            <Checkbox
              id="disclosure"
              checked={disclosureAcknowledged}
              onCheckedChange={(c) => setDisclosureAcknowledged(c === true)}
              className="mt-0.5"
            />
            <label htmlFor="disclosure" className="cursor-pointer text-sm leading-snug">
              <span className="font-medium text-gray-900 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-purple-600" />
                Electronic Communication Consent
              </span>
              <span className="text-gray-500 block mt-0.5">
                I consent to receiving electronic communications from Navigate Wealth regarding my
                account, financial products, and advisory services.
              </span>
            </label>
          </div>

          <Separator />

          <Button
            className="w-full"
            size="lg"
            onClick={handleAcceptTerms}
            disabled={!allChecked || isSubmitting}
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Accept &amp; Continue to Dashboard
              </span>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}