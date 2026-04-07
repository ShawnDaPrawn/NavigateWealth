import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { SEO } from '../seo/SEO';
import { ConsultationModal } from '../modals/ConsultationModal';
import { trackConsultationFlowStarted } from '../../utils/analytics';
import { Button } from '../ui/button';
import { Calendar, Mail, Phone } from 'lucide-react';

const CANONICAL = 'https://navigatewealth.co/schedule-consultation';

/** Matches `Navigation` inner container — logo through Get Started alignment */
const SITE_PAGE_WRAP = 'max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12';

/**
 * Dedicated entry for “schedule a consultation” (email invites, campaigns).
 * Reuses ConsultationModal; transactional page uses noindex. UTMs stay on the URL for attribution.
 */
export function ScheduleConsultationPage() {
  const location = useLocation();
  const [modalOpen, setModalOpen] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const attribution: Record<string, string> = {};
    sp.forEach((value, key) => {
      if (
        key.startsWith('utm_') ||
        key === 'gclid' ||
        key === 'fbclid' ||
        key === 'msclkid'
      ) {
        attribution[key] = value;
      }
    });
    trackConsultationFlowStarted({
      page_path: location.pathname,
      page_location: window.location.href,
      ...attribution,
    });
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (modalOpen) {
      document.body.classList.add('schedule-consultation-modal-open');
    } else {
      document.body.classList.remove('schedule-consultation-modal-open');
    }
    return () => document.body.classList.remove('schedule-consultation-modal-open');
  }, [modalOpen]);

  const contactHref = `/contact${location.search || ''}`;

  const handleModalOpenChange = (open: boolean) => {
    setModalOpen(open);
    if (!open) {
      setDismissed(true);
    }
  };

  const showFallback = dismissed;

  return (
    <div className="contents">
      <SEO
        title="Schedule a consultation | Navigate Wealth"
        description="Book a complimentary consultation with a Navigate Wealth financial adviser."
        canonicalUrl={CANONICAL}
        robotsContent="noindex, follow"
      />

      <div
        className={
          showFallback
            ? 'min-h-screen bg-gradient-to-b from-gray-50 to-white'
            : 'min-h-screen bg-white'
        }
      >
        <ConsultationModal open={modalOpen} onOpenChange={handleModalOpenChange} />

        {/* While booking: empty canvas so the dimmed area stays clean (nav remains from MainLayout) */}
        {!showFallback && <div className="min-h-[calc(100dvh-5rem)] w-full bg-white" aria-hidden="true" />}

        {showFallback && (
          <div className={`${SITE_PAGE_WRAP} py-10 sm:py-14 lg:py-16`}>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between lg:gap-10 mb-8 lg:mb-10">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">
                  Consultation
                </p>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight">
                  Schedule your free consultation
                </h1>
                <p className="text-gray-600 mt-2 text-base sm:text-lg leading-relaxed">
                  Choose a time that works for you — no obligation.
                </p>
              </div>
              <Button variant="outline" size="default" className="shrink-0 w-full sm:w-auto" asChild>
                <Link to={contactHref}>Full contact page</Link>
              </Button>
            </div>

            <section
              className="rounded-3xl border border-gray-200 bg-white shadow-xl overflow-hidden"
              aria-labelledby="consultation-fallback-heading"
            >
              <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 px-6 sm:px-8 py-6 sm:py-8 border-b border-gray-100">
                <h2 id="consultation-fallback-heading" className="text-xl sm:text-2xl font-bold text-gray-900">
                  Other ways to reach us
                </h2>
                <p className="text-sm sm:text-base text-gray-600 mt-2 max-w-3xl leading-relaxed">
                  Prefer not to book online? Reach our team directly or send a message from the full
                  contact page — your campaign parameters stay in the link.
                </p>
              </div>

              <div className="px-6 sm:px-8 py-8 space-y-8">
                <ul className="grid sm:grid-cols-2 gap-4 text-sm">
                  <li className="flex gap-4 rounded-2xl border border-gray-100 bg-gray-50/90 p-5 sm:p-6">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                      <Phone className="h-5 w-5" aria-hidden />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Phone</p>
                      <a href="tel:+27126672505" className="text-primary font-medium hover:underline mt-0.5 inline-block">
                        +27 (0)12 667 2505
                      </a>
                    </div>
                  </li>
                  <li className="flex gap-4 rounded-2xl border border-gray-100 bg-gray-50/90 p-5 sm:p-6">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                      <Mail className="h-5 w-5" aria-hidden />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Email</p>
                      <a
                        href="mailto:info@navigatewealth.co"
                        className="text-primary font-medium hover:underline mt-0.5 inline-block break-all"
                      >
                        info@navigatewealth.co
                      </a>
                    </div>
                  </li>
                </ul>

                <div className="flex flex-col sm:flex-row gap-3 sm:items-center pt-2 border-t border-gray-100">
                  <Button asChild size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto">
                    <Link to={contactHref}>Open full contact form</Link>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={() => {
                      setDismissed(false);
                      setModalOpen(true);
                    }}
                    className="gap-2 w-full sm:w-auto"
                  >
                    <Calendar className="h-4 w-4 shrink-0" aria-hidden />
                    Continue scheduling online
                  </Button>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
