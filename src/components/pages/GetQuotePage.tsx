/**
 * GetQuotePage — Quote Gateway (Step 1)
 *
 * Visitors tap a service and are taken straight to /get-quote/:service/contact
 * for contact details and initial lead capture.
 *
 * §7 — Presentation layer: layout, interaction, local UI state only.
 */

import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { SEO, createWebPageSchema } from '../seo/SEO';
import { getSEOData } from '../seo/seo-config';
import { Badge } from '../ui/badge';
import { Shield, Clock, Users, Sparkles, CheckCircle } from 'lucide-react';
import { QUOTE_SERVICES, isValidServiceId } from './quote/constants';
import { ServiceCard } from './quote/components/ServiceCard';
import type { QuoteServiceId } from './quote/types';

export function GetQuotePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const serviceParam = searchParams.get('service');
    if (serviceParam && isValidServiceId(serviceParam)) {
      const will = searchParams.get('will') === 'true' ? '?will=true' : '';
      navigate(`/get-quote/${serviceParam}/contact${will}`, { replace: true });
    }
  }, [searchParams, navigate]);

  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash && isValidServiceId(hash)) {
      navigate(`/get-quote/${hash}/contact`, { replace: true });
    }
  }, [navigate]);

  const goToContact = (serviceId: QuoteServiceId) => {
    navigate(`/get-quote/${serviceId}/contact`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <SEO
        {...getSEOData('get-quote')}
        structuredData={createWebPageSchema(
          getSEOData('get-quote').title,
          getSEOData('get-quote').description,
          getSEOData('get-quote').canonicalUrl,
        )}
      />
      <div className="bg-[#1e2035] relative overflow-hidden">
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
            Tap a category below to go straight to the next step, where you&apos;ll share your details so we can match you
            with the best options from South Africa&apos;s leading financial providers.
          </p>

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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3 mb-4 sm:mb-6">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shrink-0">
              1
            </div>
            <div className="min-w-0">
              <span className="text-sm font-semibold text-gray-900 block">Choose your service</span>
              <span className="text-xs text-gray-500 leading-snug mt-0.5 hidden sm:block">
                Match what you need (e.g. life cover) to the category below.
              </span>
            </div>
          </div>
          <div className="h-px sm:flex-1 bg-gray-200 sm:min-w-[1rem]" />
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-full bg-gray-200 text-gray-500 text-xs font-bold flex items-center justify-center">
              2
            </div>
            <span className="text-sm font-medium text-gray-400">Your details</span>
          </div>
          <div className="h-px sm:flex-1 bg-gray-200 sm:min-w-[1rem]" />
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-full bg-gray-200 text-gray-500 text-xs font-bold flex items-center justify-center">
              3
            </div>
            <span className="text-sm font-medium text-gray-400">Quote details</span>
          </div>
        </div>
        <p className="text-xs text-gray-600 leading-relaxed mb-4 sm:hidden -mt-2">
          Not sure which to pick? Read the labels under each option — for example, life cover and income protection are
          under <strong className="font-semibold text-gray-800">Risk Management</strong>.
        </p>

        <div className="grid grid-cols-1 min-[400px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5 mb-8 lg:max-w-6xl xl:max-w-7xl lg:mx-auto">
          {QUOTE_SERVICES.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              isSelected={false}
              onSelect={() => goToContact(service.id)}
            />
          ))}
        </div>

        <div className="text-center py-8 border-t border-gray-200">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="h-6 w-6 text-primary/70" />
          </div>
          <p className="text-gray-600 max-w-md mx-auto text-sm">
            Tap any category above to enter your details on the next page.
          </p>
        </div>
      </div>
    </div>
  );
}
