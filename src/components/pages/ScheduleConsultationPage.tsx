import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { SEO } from '../seo/SEO';
import { ConsultationModal } from '../modals/ConsultationModal';
import { trackConsultationFlowStarted } from '../../utils/analytics';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Calendar, Mail, Phone } from 'lucide-react';

const CANONICAL = 'https://navigatewealth.co/schedule-consultation';

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

  const contactHref = `/contact${location.search || ''}`;

  const handleModalOpenChange = (open: boolean) => {
    setModalOpen(open);
    if (!open) {
      setDismissed(true);
    }
  };

  return (
    <div className="contents">
      <SEO
        title="Schedule a consultation | Navigate Wealth"
        description="Book a complimentary consultation with a Navigate Wealth financial adviser."
        canonicalUrl={CANONICAL}
        robotsContent="noindex, follow"
      />

      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm">
          <div className="max-w-screen-lg mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-primary">Consultation</p>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900">
                Schedule your free consultation
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Choose a time that works for you — no obligation.
              </p>
            </div>
            <Button variant="outline" size="sm" className="shrink-0 self-start sm:self-center" asChild>
              <Link to={contactHref}>Full contact page</Link>
            </Button>
          </div>
        </header>

        <ConsultationModal open={modalOpen} onOpenChange={handleModalOpenChange} />

        {dismissed && (
          <section
            className="max-w-screen-lg mx-auto px-4 sm:px-6 py-10 sm:py-14"
            aria-labelledby="consultation-fallback-heading"
          >
            <Card className="border-gray-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle id="consultation-fallback-heading" className="text-xl">
                  Other ways to reach us
                </CardTitle>
                <p className="text-sm text-gray-600 font-normal pt-1">
                  Prefer not to book online? Reach our team directly or send a message from the full
                  contact page — your campaign parameters stay in the link.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <ul className="grid sm:grid-cols-2 gap-4 text-sm">
                  <li className="flex gap-3 rounded-xl border border-gray-100 bg-gray-50/80 p-4">
                    <Phone className="h-5 w-5 text-primary shrink-0 mt-0.5" aria-hidden />
                    <div>
                      <p className="font-medium text-gray-900">Phone</p>
                      <a href="tel:+27126672505" className="text-primary hover:underline">
                        +27 (0)12 667 2505
                      </a>
                    </div>
                  </li>
                  <li className="flex gap-3 rounded-xl border border-gray-100 bg-gray-50/80 p-4">
                    <Mail className="h-5 w-5 text-primary shrink-0 mt-0.5" aria-hidden />
                    <div>
                      <p className="font-medium text-gray-900">Email</p>
                      <a href="mailto:info@navigatewealth.co" className="text-primary hover:underline">
                        info@navigatewealth.co
                      </a>
                    </div>
                  </li>
                </ul>
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                  <Button asChild className="bg-primary">
                    <Link to={contactHref}>Open full contact form</Link>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setDismissed(false);
                      setModalOpen(true);
                    }}
                    className="gap-2"
                  >
                    <Calendar className="h-4 w-4" aria-hidden />
                    Continue scheduling online
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>
        )}
      </div>
    </div>
  );
}
