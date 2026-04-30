/**
 * ProductQuotePage — Product-Specific Quote (Page 2)
 *
 * Full lead capture form for a specific service. Works as:
 *   1. Continuation from the Quote Gateway (contact details pre-filled)
 *   2. Standalone entry (blank fields — acts as a lead capture landing page)
 *
 * Step 3 of the quote funnel. Requires contact from step 2 (/get-quote/:service/contact);
 * bare /get-quote/:service redirects there. Deep-linked from service pages via
 * /get-quote/:service/contact → submit → this page with router state.
 *
 * §7 — Presentation layer
 * §3.1 — Dependency direction: UI → hooks → API
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useLocation, useNavigate, Link, Navigate } from 'react-router';
import { toast } from 'sonner@2.0.3';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Shield,
  Clock,
  Users,
  Phone,
  Loader2,
  Star,
  Lock,
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { getServiceConfig, isValidServiceId } from './quote/constants';
import { ProviderStrip } from './quote/components/ProviderStrip';
import { TrustBar } from './quote/components/TrustBar';
import { QuoteFormFields } from './quote/components/QuoteFormFields';
import type { QuoteRouterState } from './quote/types';
import { RiskQuoteWizard } from './quote/components/RiskQuoteWizard';
import { MedicalAidQuoteWizard } from './quote/components/MedicalAidQuoteWizard';
import { InvestmentQuoteWizard } from './quote/components/InvestmentQuoteWizard';
import { RetirementQuoteWizard } from './quote/components/RetirementQuoteWizard';
import { EmployeeBenefitsQuoteWizard } from './quote/components/EmployeeBenefitsQuoteWizard';
import { TaxPlanningQuoteWizard } from './quote/components/TaxPlanningQuoteWizard';

// ── Session persistence ───────────────────────────────────────────────────────
const SESSION_KEY = 'nw_product_quote';

function loadSession(service: string): Record<string, string> {
  try {
    const raw = sessionStorage.getItem(`${SESSION_KEY}_${service}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveSession(service: string, data: Record<string, string>) {
  try {
    sessionStorage.setItem(`${SESSION_KEY}_${service}`, JSON.stringify(data));
  } catch { /* non-critical */ }
}

// ── Success screen ────────────────────────────────────────────────────────────

function SuccessScreen({ serviceName }: { serviceName: string }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
          <CheckCircle className="h-10 w-10 text-green-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Quote Request Received!</h1>
          <p className="text-gray-600 leading-relaxed">
            Thank you for your {serviceName.toLowerCase()} quote request. One of our qualified advisers
            will be in touch within <strong>24 business hours</strong> with a personalised, no-obligation quote.
          </p>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-left space-y-2">
          {[
            'An adviser will review your requirements',
            'We\'ll compare options from our partner providers',
            'You\'ll receive a personalised recommendation',
          ].map((item) => (
            <div key={item} className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-green-800">{item}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild variant="outline">
            <Link to="/get-quote">Request Another Quote</Link>
          </Button>
          <Button asChild>
            <Link to="/">Back to Home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ProductQuotePage() {
  const { service } = useParams<{ service: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  // Router state from Page 1 (may be undefined if standalone entry)
  const routerState = location.state as QuoteRouterState | undefined;

  // Validate service
  const serviceConfig = service && isValidServiceId(service) ? getServiceConfig(service) : null;

  // Contact fields (pre-filled from router state or blank)
  const [firstName, setFirstName] = useState(routerState?.contact?.firstName ?? '');
  const [lastName, setLastName] = useState(routerState?.contact?.lastName ?? '');
  const [email, setEmail] = useState(routerState?.contact?.email ?? '');
  const [phone, setPhone] = useState(routerState?.contact?.phone ?? '');

  // Product-specific fields
  const savedFields = service ? loadSession(service) : {};
  const [productFields, setProductFields] = useState<Record<string, string>>(savedFields);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const hasContactFromGateway = Boolean(routerState?.contact);

  // Persist product fields to sessionStorage
  useEffect(() => {
    if (service) saveSession(service, productFields);
  }, [productFields, service]);

  const handleProductFieldChange = useCallback((fieldId: string, value: string) => {
    setProductFields((prev) => ({ ...prev, [fieldId]: value }));
  }, []);

  // Determine required fields validation
  const requiredProductFields = serviceConfig?.productFields.filter((f) => f.required) ?? [];
  const productFieldsValid = requiredProductFields.every(
    (f) => productFields[f.id]?.trim(),
  );
  const contactValid = firstName.trim() && lastName.trim() && email.trim() && phone.trim();
  const isFormValid = contactValid && productFieldsValid;

  // ── Submit handler ──────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || !service || !serviceConfig) return;

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
            productName: serviceConfig.label,
            stage: 'full',
            service,
            parentSubmissionId: routerState?.parentSubmissionId ?? undefined,
            productDetails: productFields,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        console.error('Product quote submission error:', result);
        toast.error(result.error || 'Something went wrong. Please try again.');
        return;
      }

      // Clear session
      if (service) sessionStorage.removeItem(`${SESSION_KEY}_${service}`);

      setIsSuccess(true);
    } catch (error) {
      console.error('Product quote network error:', error);
      toast.error('Unable to submit your request. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [firstName, lastName, email, phone, service, serviceConfig, productFields, routerState, isFormValid]);

  // ── Invalid service ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!serviceConfig) {
      let el = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute('name', 'robots');
        document.head.appendChild(el);
      }
      el.setAttribute('content', 'noindex, nofollow');
    }
  }, [serviceConfig]);

  if (!serviceConfig) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-gray-900">Service Not Found</h1>
          <p className="text-gray-600">The requested service doesn't exist.</p>
          <Button asChild>
            <Link to="/get-quote">Browse All Services</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Deep links to /get-quote/:service must complete step 2 (contact) first
  if (!routerState?.contact) {
    return <Navigate to={`/get-quote/${service}/contact`} replace />;
  }

  // ── Success state ───────────────────────────────────────────────────────────
  if (isSuccess) {
    return <SuccessScreen serviceName={serviceConfig.label} />;
  }

  // ── Risk Management uses the Phase 2 wizard ────────────────────────────────
  const isRiskManagement = service === 'risk-management';
  const isMedicalAid = service === 'medical-aid';
  const isInvestment = service === 'investment-management';
  const isRetirement = service === 'retirement-planning';
  const isEmployeeBenefits = service === 'employee-benefits';
  const isTaxPlanning = service === 'tax-planning';
  const hasPhase2Wizard = isRiskManagement || isMedicalAid || isInvestment || isRetirement || isEmployeeBenefits || isTaxPlanning;

  // ── Main render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-[#1e2035] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-primary/8 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />

        <div className="relative max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-10 sm:py-14">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-white/50 text-xs mb-5">
            <Link to="/" className="hover:text-white/70 transition-colors">Home</Link>
            <span>/</span>
            <Link to="/get-quote" className="hover:text-white/70 transition-colors">Get a Quote</Link>
            <span>/</span>
            <span className="text-white/80">{serviceConfig.label}</span>
          </div>

          <div className="max-w-2xl">
            <Badge className="bg-primary/20 text-primary-foreground border-primary/30 mb-3 text-xs font-medium px-3 py-1">
              {serviceConfig.providers.length > 0
                ? `Compare from ${serviceConfig.providers.length} trusted partners`
                : 'Expert guidance'}
            </Badge>
            <h1 className="text-white text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 tracking-tight">
              {serviceConfig.label} Quote
            </h1>
            <p className="text-white/70 text-sm sm:text-base leading-relaxed max-w-xl">
              {serviceConfig.heroDescription}
            </p>
          </div>

          {/* Provider logos in hero */}
          {serviceConfig.providers.length > 0 && (
            <div className="mt-6">
              <ProviderStrip providers={serviceConfig.providers} variant="dark" />
            </div>
          )}
        </div>
      </div>

      {/* Step indicator — steps 1–3 of public quote funnel */}
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 pt-8 pb-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
              <CheckCircle className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium text-green-700">Service</span>
          </div>
          <div className="h-px sm:flex-1 bg-primary/30 sm:min-w-[1rem]" />
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
              <CheckCircle className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium text-green-700">Your details</span>
          </div>
          <div className="h-px sm:flex-1 bg-primary/30 sm:min-w-[1rem]" />
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
              3
            </div>
            <span className="text-sm font-semibold text-gray-900">
              {hasPhase2Wizard ? 'Quote wizard' : 'Your quote details'}
            </span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Left: Form (2 cols on lg) */}
          <div className="lg:col-span-2">
            {hasPhase2Wizard ? (
              /* Phase 2 Wizard — collects contact details inline first,
                 then guides through the service-specific wizard steps */
              <div className="space-y-6">
                {/* Contact details card */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                  <div className="p-5 sm:p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-base font-bold text-gray-900">Contact Details</h2>
                        {hasContactFromGateway && (
                          <p className="text-xs text-green-600 mt-0.5 flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" /> Pre-filled from your previous step
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="rq-firstName" className="text-sm font-medium text-gray-700">
                          First name <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="rq-firstName"
                          type="text"
                          placeholder="e.g. John"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          required
                          className="bg-white border-gray-300 h-11"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="rq-lastName" className="text-sm font-medium text-gray-700">
                          Surname <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="rq-lastName"
                          type="text"
                          placeholder="e.g. Smith"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          required
                          className="bg-white border-gray-300 h-11"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="rq-email" className="text-sm font-medium text-gray-700">
                          Email address <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="rq-email"
                          type="email"
                          placeholder="e.g. john@email.co.za"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          className="bg-white border-gray-300 h-11"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="rq-phone" className="text-sm font-medium text-gray-700">
                          Contact number <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="rq-phone"
                          type="tel"
                          placeholder="e.g. 082 345 6789"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          required
                          className="bg-white border-gray-300 h-11"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Phase 2 Wizard */}
                {contactValid ? (
                  isRiskManagement ? (
                    <RiskQuoteWizard
                      firstName={firstName}
                      lastName={lastName}
                      email={email}
                      phone={phone}
                      parentSubmissionId={routerState?.parentSubmissionId}
                      onSuccess={() => setIsSuccess(true)}
                    />
                  ) : isMedicalAid ? (
                    <MedicalAidQuoteWizard
                      firstName={firstName}
                      lastName={lastName}
                      email={email}
                      phone={phone}
                      parentSubmissionId={routerState?.parentSubmissionId}
                      onSuccess={() => setIsSuccess(true)}
                    />
                  ) : isInvestment ? (
                    <InvestmentQuoteWizard
                      firstName={firstName}
                      lastName={lastName}
                      email={email}
                      phone={phone}
                      parentSubmissionId={routerState?.parentSubmissionId}
                      onSuccess={() => setIsSuccess(true)}
                    />
                  ) : isRetirement ? (
                    <RetirementQuoteWizard
                      firstName={firstName}
                      lastName={lastName}
                      email={email}
                      phone={phone}
                      parentSubmissionId={routerState?.parentSubmissionId}
                      onSuccess={() => setIsSuccess(true)}
                    />
                  ) : isEmployeeBenefits ? (
                    <EmployeeBenefitsQuoteWizard
                      firstName={firstName}
                      lastName={lastName}
                      email={email}
                      phone={phone}
                      parentSubmissionId={routerState?.parentSubmissionId}
                      onSuccess={() => setIsSuccess(true)}
                    />
                  ) : isTaxPlanning ? (
                    <TaxPlanningQuoteWizard
                      firstName={firstName}
                      lastName={lastName}
                      email={email}
                      phone={phone}
                      parentSubmissionId={routerState?.parentSubmissionId}
                      onSuccess={() => setIsSuccess(true)}
                    />
                  ) : null
                ) : (
                  <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 text-center">
                    <p className="text-sm text-gray-500">
                      Please fill in all contact details above to start the quote wizard.
                    </p>
                  </div>
                )}
              </div>
            ) : (
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              {/* Contact details section */}
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold text-gray-900">Contact Details</h2>
                    {hasContactFromGateway && (
                      <p className="text-xs text-green-600 mt-0.5 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" /> Pre-filled from your previous step
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="pq-firstName" className="text-sm font-medium text-gray-700">
                      First name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="pq-firstName"
                      type="text"
                      placeholder="e.g. John"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      className="bg-white border-gray-300 h-11"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pq-lastName" className="text-sm font-medium text-gray-700">
                      Surname <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="pq-lastName"
                      type="text"
                      placeholder="e.g. Smith"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      className="bg-white border-gray-300 h-11"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pq-email" className="text-sm font-medium text-gray-700">
                      Email address <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="pq-email"
                      type="email"
                      placeholder="e.g. john@email.co.za"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="bg-white border-gray-300 h-11"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pq-phone" className="text-sm font-medium text-gray-700">
                      Contact number <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="pq-phone"
                      type="tel"
                      placeholder="e.g. 082 345 6789"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                      className="bg-white border-gray-300 h-11"
                    />
                  </div>
                </div>
              </div>

              {/* Product-specific fields */}
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-base font-bold text-gray-900 mb-1">
                  {serviceConfig.label} Details
                </h2>
                <p className="text-sm text-gray-500 mb-4">
                  Help us understand your specific needs so we can match you with the right solution.
                </p>
                <QuoteFormFields
                  fields={serviceConfig.productFields}
                  values={productFields}
                  onChange={handleProductFieldChange}
                />
              </div>

              {/* Submit section */}
              <div className="p-6 bg-gray-50/50">
                <div className="flex flex-col-reverse sm:flex-row items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate(`/get-quote/${service}/contact`)}
                    className="w-full sm:w-auto h-11 px-5 border-gray-300 text-gray-700 hover:bg-gray-50 font-medium"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={!isFormValid || isSubmitting}
                    className="w-full sm:w-auto sm:flex-1 sm:max-w-xs h-11 bg-primary hover:bg-primary/90 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all duration-200"
                  >
                    {isSubmitting ? (
                      <div className="contents">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Submitting...
                      </div>
                    ) : (
                      <div className="contents">
                        Get My {serviceConfig.shortLabel} Quote
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </div>
                    )}
                  </Button>
                </div>

                <p className="text-xs text-gray-400 leading-relaxed text-center mt-4">
                  By submitting, you agree to our{' '}
                  <a href="/legal?tab=privacy" className="text-primary/70 hover:text-primary underline">Privacy Policy</a>.
                  Your information is secure and will only be used to prepare your personalised quote.
                </p>
              </div>
            </form>
            )}
          </div>

          {/* Right: Value props sidebar */}
          <div className="lg:col-span-1 space-y-5">
            {/* Why Navigate Wealth */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
              <h3 className="text-sm font-bold text-gray-900 mb-4">Why Navigate Wealth?</h3>
              <div className="space-y-3">
                {[
                  { icon: Shield, label: 'Independent & Unbiased', desc: 'We\'re not tied to any single provider' },
                  { icon: Users, label: `${serviceConfig.providers.length > 0 ? serviceConfig.providers.length + '+ ' : ''}Trusted Partners`, desc: 'Compare the best options available' },
                  { icon: Clock, label: '24-Hour Response', desc: 'We\'ll contact you within one business day' },
                  { icon: Phone, label: 'Free Consultation', desc: 'No cost, no obligation — ever' },
                  { icon: Star, label: 'Expert Advisers', desc: 'Qualified professionals with years of experience' },
                  { icon: Lock, label: 'Your Data is Secure', desc: 'Strict privacy and POPIA compliance' },
                ].map(({ icon: Ic, label, desc }) => (
                  <div key={label} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Ic className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-gray-900 block leading-tight">{label}</span>
                      <span className="text-xs text-gray-500">{desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Testimonial / social proof */}
            <div className="bg-gradient-to-br from-primary/5 to-primary/[0.02] rounded-2xl border border-primary/10 p-6">
              <div className="flex items-center gap-1 mb-3">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className="h-4 w-4 text-amber-400 fill-amber-400" />
                ))}
              </div>
              <p className="text-sm text-gray-700 italic leading-relaxed mb-3">
                "Navigate Wealth compared multiple options and found us the best cover at a lower premium
                than we were paying. The process was smooth and completely free."
              </p>
              <p className="text-xs font-semibold text-gray-900">— Satisfied client, Johannesburg</p>
            </div>

            {/* Trust bar */}
            <TrustBar />
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProductQuotePage;
