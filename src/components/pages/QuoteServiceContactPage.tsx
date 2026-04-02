/**
 * QuoteServiceContactPage — Step 2 of the public quote funnel
 *
 * Per-service contact capture + initial lead submit (stage: 'initial').
 * Shareable URL: /get-quote/:service/contact
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router';
import { toast } from 'sonner@2.0.3';
import { SEO, createWebPageSchema } from '../seo/SEO';
import { getQuoteServiceContactSEO } from '../seo/seo-config';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { ArrowRight, ArrowLeft, CheckCircle, Loader2, FileText } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { WillDraftingFlow } from '../modules/wills/WillDraftingFlow';
import { getServiceConfig, isValidServiceId } from './quote/constants';
import { ProviderStrip } from './quote/components/ProviderStrip';
import { TrustBar } from './quote/components/TrustBar';
import type { QuoteServiceId, QuoteRouterState } from './quote/types';
import {
  loadGatewaySession,
  saveGatewaySession,
  clearGatewaySession,
} from './quote/gatewaySession';

type EstateChoice = 'consultation' | 'will';

export function QuoteServiceContactPage() {
  const { service: serviceParam } = useParams<{ service: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const selectedService: QuoteServiceId | null =
    serviceParam && isValidServiceId(serviceParam) ? serviceParam : null;

  const [estateChoice, setEstateChoice] = useState<EstateChoice>('consultation');

  const saved = loadGatewaySession();
  const [firstName, setFirstName] = useState(saved.firstName ?? '');
  const [lastName, setLastName] = useState(saved.lastName ?? '');
  const [email, setEmail] = useState(saved.email ?? '');
  const [phone, setPhone] = useState(saved.phone ?? '');

  const [website, setWebsite] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showWillDrafting, setShowWillDrafting] = useState(false);

  useEffect(() => {
    const willParam = searchParams.get('will');
    if (willParam === 'true' && selectedService === 'estate-planning') {
      setEstateChoice('will');
    }
  }, [searchParams, selectedService]);

  useEffect(() => {
    saveGatewaySession({ firstName, lastName, email, phone });
  }, [firstName, lastName, email, phone]);

  const selectedConfig = selectedService ? getServiceConfig(selectedService) : null;

  const isFormValid =
    Boolean(firstName.trim() && lastName.trim() && email.trim() && phone.trim() && selectedService);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!isFormValid || !selectedService || !selectedConfig) return;

      if (selectedService === 'estate-planning' && estateChoice === 'will') {
        setShowWillDrafting(true);
        return;
      }

      setIsSubmitting(true);

      try {
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/quote-request/submit`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${publicAnonKey}`,
            },
            body: JSON.stringify({
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              email: email.trim(),
              phone: phone.trim(),
              productName: selectedConfig.label,
              stage: 'initial',
              service: selectedService,
              website,
            }),
          },
        );

        const result = await response.json();

        if (!response.ok) {
          console.error('Quote gateway submission error:', result);
          toast.error(result.error || 'Something went wrong. Please try again.');
          return;
        }

        clearGatewaySession();

        const routerState: QuoteRouterState = {
          contact: {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim(),
            phone: phone.trim(),
          },
          service: selectedService,
          parentSubmissionId: result.submissionId ?? result.submissionEntryId ?? '',
        };

        navigate(`/get-quote/${selectedService}`, { state: routerState });
      } catch (error) {
        console.error('Quote gateway network error:', error);
        toast.error('Unable to submit your request. Please check your connection and try again.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [firstName, lastName, email, phone, selectedService, estateChoice, selectedConfig, navigate, isFormValid, website],
  );

  if (!selectedService || !selectedConfig) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-gray-900">Service Not Found</h1>
          <p className="text-gray-600">The requested service does not exist.</p>
          <Button asChild>
            <Link to="/get-quote">Browse All Services</Link>
          </Button>
        </div>
      </div>
    );
  }

  const seo = getQuoteServiceContactSEO(selectedService);

  if (showWillDrafting) {
    return (
      <WillDraftingFlow
        clientDetails={{
          name: firstName,
          surname: lastName,
          email,
          cellphone: phone,
        }}
        onComplete={() => {
          setShowWillDrafting(false);
          navigate('/get-quote');
        }}
        onBack={() => setShowWillDrafting(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SEO
        {...seo}
        structuredData={createWebPageSchema(seo.title, seo.description, seo.canonicalUrl)}
      />
      <div className="bg-[#1e2035] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-primary/8 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />

        <div className="relative max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-10 sm:py-12">
          <div className="flex items-center gap-2 text-white/50 text-xs mb-5">
            <Link to="/" className="hover:text-white/70 transition-colors">
              Home
            </Link>
            <span>/</span>
            <Link to="/get-quote" className="hover:text-white/70 transition-colors">
              Get a Quote
            </Link>
            <span>/</span>
            <span className="text-white/80">{selectedConfig.label}</span>
          </div>

          <Badge className="bg-primary/20 text-primary-foreground border-primary/30 mb-3 text-xs font-medium px-3 py-1">
            Step 2 of 3 — Your details
          </Badge>
          <h1 className="text-white text-2xl sm:text-3xl font-bold mb-2 tracking-tight">
            {selectedConfig.label} quote
          </h1>
          <p className="text-white/70 max-w-xl text-sm sm:text-base leading-relaxed">
            Tell us who you are so we can prepare your personalised quote. Next step: your specific needs.
          </p>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-8 sm:py-12">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3 mb-6">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
              <CheckCircle className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium text-green-700">Service</span>
          </div>
          <div className="h-px sm:flex-1 bg-gray-200 sm:min-w-[1rem]" />
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shrink-0">
              2
            </div>
            <span className="text-sm font-semibold text-gray-900">Your details</span>
          </div>
          <div className="h-px sm:flex-1 bg-gray-200 sm:min-w-[1rem]" />
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-full bg-gray-200 text-gray-500 text-xs font-bold flex items-center justify-center">
              3
            </div>
            <span className="text-sm font-medium text-gray-400">Quote details</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-primary/5 to-transparent px-6 py-4 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-900">Your Details</h2>
                <p className="text-sm text-gray-600 mt-0.5">
                  Tell us who you are so we can prepare your personalised {selectedConfig.label.toLowerCase()} quote.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5 relative">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="qsc-firstName" className="text-sm font-medium text-gray-700">
                      First name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="qsc-firstName"
                      type="text"
                      placeholder="e.g. John"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      className="bg-white border-gray-300 h-11"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="qsc-lastName" className="text-sm font-medium text-gray-700">
                      Surname <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="qsc-lastName"
                      type="text"
                      placeholder="e.g. Smith"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      className="bg-white border-gray-300 h-11"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="qsc-email" className="text-sm font-medium text-gray-700">
                      Email address <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="qsc-email"
                      type="email"
                      placeholder="e.g. john@email.co.za"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="bg-white border-gray-300 h-11"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="qsc-phone" className="text-sm font-medium text-gray-700">
                      Contact number <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="qsc-phone"
                      type="tel"
                      placeholder="e.g. 082 345 6789"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                      className="bg-white border-gray-300 h-11"
                    />
                  </div>
                </div>

                <div className="absolute opacity-0 h-0 overflow-hidden" aria-hidden="true" tabIndex={-1}>
                  <label htmlFor="qsc-website">Website</label>
                  <input
                    id="qsc-website"
                    name="website"
                    type="text"
                    autoComplete="off"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    tabIndex={-1}
                  />
                </div>

                {selectedService === 'estate-planning' && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">What would you like to do?</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setEstateChoice('consultation')}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                          estateChoice === 'consultation'
                            ? 'border-primary bg-primary/5'
                            : 'border-gray-200 hover:border-primary/30'
                        }`}
                      >
                        <span className="text-sm font-semibold text-gray-900 block">Estate Planning Consultation</span>
                        <span className="text-xs text-gray-500 mt-0.5 block">Trusts, succession, estate duty</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEstateChoice('will')}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                          estateChoice === 'will'
                            ? 'border-primary bg-primary/5'
                            : 'border-gray-200 hover:border-primary/30'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">Draft My Will</span>
                          <Badge className="bg-primary/10 text-primary text-[10px] px-1.5 py-0 h-4">AI-Assisted</Badge>
                        </div>
                        <span className="text-xs text-gray-500 mt-0.5 block">Start your will drafting now</span>
                      </button>
                    </div>
                  </div>
                )}

                {selectedConfig.providers.length > 0 && (
                  <ProviderStrip providers={selectedConfig.providers} className="pt-2" />
                )}

                <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate('/get-quote')}
                    className="w-full sm:w-auto h-10 px-5 border-gray-300 text-gray-700 hover:bg-gray-50 font-medium"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to services
                  </Button>
                  <Button
                    type="submit"
                    disabled={!isFormValid || isSubmitting}
                    className="w-full sm:flex-1 h-12 bg-primary hover:bg-primary/90 text-white font-semibold text-base shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    {isSubmitting ? (
                      <div className="contents">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Submitting...
                      </div>
                    ) : selectedService === 'estate-planning' && estateChoice === 'will' ? (
                      <div className="contents">
                        <FileText className="h-4 w-4 mr-2" />
                        Start Will Drafting
                      </div>
                    ) : (
                      <div className="contents">
                        Continue to Quote Details
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </div>
                    )}
                  </Button>
                </div>

                <p className="text-xs text-gray-400 leading-relaxed text-center">
                  By submitting, you agree to our{' '}
                  <a href="/legal?tab=privacy" className="text-primary/70 hover:text-primary underline">
                    Privacy Policy
                  </a>
                  . Your information is secure and will only be used to prepare your quote.
                </p>
              </form>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-5">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
              <h3 className="text-base font-bold text-gray-900 mb-2">{selectedConfig.label}</h3>
              <p className="text-sm text-gray-600 leading-relaxed mb-4">{selectedConfig.heroDescription}</p>
              <div className="space-y-2.5">
                {[
                  'Independent, unbiased advice',
                  'Compare options from top providers',
                  'No cost, no obligation',
                  'Personalised to your needs',
                ].map((point) => (
                  <div key={point} className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-700">{point}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-br from-primary/5 to-primary/[0.02] rounded-2xl border border-primary/10 p-6">
              <h4 className="text-sm font-bold text-gray-900 mb-3">How It Works</h4>
              <div className="space-y-3">
                {[
                  { step: '1', text: 'Choose your service' },
                  { step: '2', text: 'Share your details (you\'re here!)' },
                  { step: '3', text: 'Tell us your needs and receive your quote' },
                ].map(({ step, text }) => (
                  <div key={step} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {step}
                    </div>
                    <span className="text-sm text-gray-700">{text}</span>
                  </div>
                ))}
              </div>
            </div>

            <TrustBar />
          </div>
        </div>
      </div>
    </div>
  );
}
