/**
 * GetQuotePage — Quote Gateway (Page 1)
 *
 * Low-friction lead capture: client selects a service and enters basic
 * contact details. On submit the server immediately creates a submission
 * so the admin has the lead even if the client abandons before completing
 * the full product-specific form on Page 2.
 *
 * For Estate Planning the client can choose between a general consultation
 * (proceeds to the product quote page) or "Draft My Will" (launches the
 * existing WillDraftingFlow).
 *
 * §7 — Presentation layer: layout, interaction, local UI state only.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { toast } from 'sonner@2.0.3';
import { SEO, createWebPageSchema } from '../seo/SEO';
import { getSEOData } from '../seo/seo-config';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import {
  ArrowRight,
  CheckCircle,
  Shield,
  Clock,
  Users,
  Sparkles,
  Loader2,
  FileText,
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { WillDraftingFlow } from '../modules/wills/WillDraftingFlow';
import { QUOTE_SERVICES, getServiceConfig, isValidServiceId } from './quote/constants';
import { ServiceCard } from './quote/components/ServiceCard';
import { ProviderStrip } from './quote/components/ProviderStrip';
import { TrustBar } from './quote/components/TrustBar';
import type { QuoteServiceId, QuoteContactDetails, QuoteRouterState } from './quote/types';

// ── Session persistence key ───────────────────────────────────────────────────
const SESSION_KEY = 'nw_quote_gateway';

function loadSession(): Partial<QuoteContactDetails> {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveSession(data: Partial<QuoteContactDetails>) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch { /* non-critical */ }
}

// ── Estate planning sub-choice ────────────────────────────────────────────────
type EstateChoice = 'consultation' | 'will';

// ── Component ─────────────────────────────────────────────────────────────────

export function GetQuotePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Service selection
  const [selectedService, setSelectedService] = useState<QuoteServiceId | null>(null);
  const [estateChoice, setEstateChoice] = useState<EstateChoice>('consultation');

  // Contact form
  const saved = loadSession();
  const [firstName, setFirstName] = useState(saved.firstName ?? '');
  const [lastName, setLastName] = useState(saved.lastName ?? '');
  const [email, setEmail] = useState(saved.email ?? '');
  const [phone, setPhone] = useState(saved.phone ?? '');

  // Honeypot (anti-bot) — hidden field, must stay empty
  const [website, setWebsite] = useState('');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showWillDrafting, setShowWillDrafting] = useState(false);

  // Pre-select from URL params (?service=risk-management or #risk-management)
  useEffect(() => {
    const serviceParam = searchParams.get('service');
    if (serviceParam && isValidServiceId(serviceParam)) {
      setSelectedService(serviceParam);
    }
    // Support ?will=true to auto-select the will drafting sub-choice
    const willParam = searchParams.get('will');
    if (willParam === 'true') {
      setEstateChoice('will');
    }
  }, [searchParams]);

  // Also handle hash fragments from legacy links (#risk-management)
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash && isValidServiceId(hash) && !selectedService) {
      setSelectedService(hash);
    }
  }, []);

  // Persist contact details to sessionStorage on change
  useEffect(() => {
    saveSession({ firstName, lastName, email, phone });
  }, [firstName, lastName, email, phone]);

  const selectedConfig = selectedService ? getServiceConfig(selectedService) : null;

  const isFormValid = firstName.trim() && lastName.trim() && email.trim() && phone.trim() && selectedService;

  // ── Submit handler ──────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || !selectedService) return;

    // Estate planning → Will drafting flow
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
            productName: selectedConfig?.label ?? selectedService,
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

      // Clear session
      sessionStorage.removeItem(SESSION_KEY);

      // Navigate to product quote page with contact details in router state
      const routerState: QuoteRouterState = {
        contact: { firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), phone: phone.trim() },
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
  }, [firstName, lastName, email, phone, selectedService, estateChoice, selectedConfig, navigate, isFormValid]);

  // ── Will drafting flow ──────────────────────────────────────────────────────
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
          setSelectedService(null);
        }}
        onBack={() => setShowWillDrafting(false)}
      />
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <SEO {...getSEOData('get-quote')} structuredData={createWebPageSchema(getSEOData('get-quote').title, getSEOData('get-quote').description, getSEOData('get-quote').canonicalUrl)} />
      {/* Hero */}
      <div className="bg-[#1e2035] relative overflow-hidden">
        {/* Decorative orbs */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-primary/8 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />

        <div className="relative max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-12 sm:py-16 lg:py-20 text-center">
          <Badge className="bg-primary/20 text-primary-foreground border-primary/30 mb-4 text-xs font-medium px-3 py-1">
            Free, no-obligation quote
          </Badge>
          <h1 className="text-white text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 tracking-tight">
            Get Your Personalised Quote
          </h1>
          <p className="text-white/70 max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
            Select the service you need, share your details, and we'll match you with the best
            options from South Africa's leading financial providers.
          </p>

          {/* Trust points */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-6">
            {[
              { icon: Clock, label: '24hr response' },
              { icon: Users, label: 'Independent advice' },
              { icon: Shield, label: 'FSCA regulated' },
              { icon: Sparkles, label: 'Best-in-class partners' },
            ].map(({ icon: Ic, label }) => (
              <span key={label} className="flex items-center gap-1.5 text-white/60 text-xs">
                <Ic className="h-3.5 w-3.5" />
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-8 sm:py-12">
        {/* Step indicator */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">1</div>
            <span className="text-sm font-semibold text-gray-900">Choose your service</span>
          </div>
          <div className="h-px flex-1 bg-gray-200" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gray-200 text-gray-500 text-xs font-bold flex items-center justify-center">2</div>
            <span className="text-sm font-medium text-gray-400">Product details</span>
          </div>
        </div>

        {/* Service cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 sm:gap-4 mb-8">
          {QUOTE_SERVICES.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              isSelected={selectedService === service.id}
              onSelect={() => setSelectedService(service.id)}
            />
          ))}
        </div>

        {/* Selected service — contact form + info */}
        {selectedConfig && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
            {/* Left: Form (3 cols) */}
            <div className="lg:col-span-3">
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-primary/5 to-transparent px-6 py-4 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-gray-900">Your Details</h2>
                  <p className="text-sm text-gray-600 mt-0.5">
                    Tell us who you are so we can prepare your personalised {selectedConfig.label.toLowerCase()} quote.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="firstName" className="text-sm font-medium text-gray-700">
                        First name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="firstName"
                        type="text"
                        placeholder="e.g. John"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required
                        className="bg-white border-gray-300 h-11"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="lastName" className="text-sm font-medium text-gray-700">
                        Surname <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="lastName"
                        type="text"
                        placeholder="e.g. Smith"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        required
                        className="bg-white border-gray-300 h-11"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                        Email address <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="e.g. john@email.co.za"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="bg-white border-gray-300 h-11"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="phone" className="text-sm font-medium text-gray-700">
                        Contact number <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="e.g. 082 345 6789"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        required
                        className="bg-white border-gray-300 h-11"
                      />
                    </div>
                  </div>

                  {/* Honeypot — hidden from real users, traps bots */}
                  <div className="absolute opacity-0 h-0 overflow-hidden" aria-hidden="true" tabIndex={-1}>
                    <label htmlFor="website">Website</label>
                    <input
                      id="website"
                      name="website"
                      type="text"
                      autoComplete="off"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      tabIndex={-1}
                    />
                  </div>

                  {/* Estate planning sub-choice */}
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

                  {/* Provider strip for selected service */}
                  {selectedConfig.providers.length > 0 && (
                    <ProviderStrip
                      providers={selectedConfig.providers}
                      className="pt-2"
                    />
                  )}

                  {/* Submit */}
                  <Button
                    type="submit"
                    disabled={!isFormValid || isSubmitting}
                    className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-semibold text-base shadow-lg hover:shadow-xl transition-all duration-200"
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

                  <p className="text-xs text-gray-400 leading-relaxed text-center">
                    By submitting, you agree to our{' '}
                    <a href="/legal?tab=privacy" className="text-primary/70 hover:text-primary underline">Privacy Policy</a>.
                    Your information is secure and will only be used to prepare your quote.
                  </p>
                </form>
              </div>
            </div>

            {/* Right: Value props (2 cols) */}
            <div className="lg:col-span-2 space-y-5">
              {/* Service description card */}
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
                <h3 className="text-base font-bold text-gray-900 mb-2">{selectedConfig.label}</h3>
                <p className="text-sm text-gray-600 leading-relaxed mb-4">
                  {selectedConfig.heroDescription}
                </p>
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

              {/* How it works */}
              <div className="bg-gradient-to-br from-primary/5 to-primary/[0.02] rounded-2xl border border-primary/10 p-6">
                <h4 className="text-sm font-bold text-gray-900 mb-3">How It Works</h4>
                <div className="space-y-3">
                  {[
                    { step: '1', text: 'Share your details (you\'re here!)' },
                    { step: '2', text: 'Tell us about your specific needs' },
                    { step: '3', text: 'Receive a personalised quote within 24 hours' },
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

              {/* Trust bar */}
              <TrustBar />
            </div>
          </div>
        )}

        {/* Empty state when no service selected */}
        {!selectedConfig && (
          <div className="text-center py-12 sm:py-16">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="h-8 w-8 text-primary/60" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Select a service to get started</h3>
            <p className="text-gray-500 max-w-md mx-auto text-sm">
              Choose from our comprehensive range of financial services above, and we'll guide you through getting a personalised quote.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}