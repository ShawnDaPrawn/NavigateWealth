/**
 * NavigatorScheduleConsultationPage — the redesigned "Book a free
 * consultation" page (/schedule-consultation and /contact/consultation; old
 * /contact?subject=consultation links are sent here by the contact page). The
 * layout is the "Schedule Consultation" board of the Website Redesign canvas.
 *
 * It keeps everything the live page (ScheduleConsultationPage.tsx) does: the
 * same SEO tags, the same "consultation_flow_started" analytics event with
 * the visitor's UTM and click-id parameters, and the same link to the full
 * contact page carrying the query string. Bookings go through BookingWizard,
 * which offers and sends exactly what the live booking does. The firm's
 * phone, email, office, hours and languages come from companyFacts.
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { SEO } from '../../components/seo/SEO';
import { COMPANY } from '../../config/companyFacts';
import { trackConsultationFlowStarted } from '../../utils/analytics';
import { SITE_ORIGIN } from '../../utils/siteOrigin';
import { WHATSAPP_HREF } from '../siteLinks';
import { BookingHero } from '../sections/BookingHero';
import { BookingRoutes } from '../sections/BookingRoutes';
import { BookingWizard } from '../sections/BookingWizard';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/schedule-consultation.css';

/** The live page's SEO, word for word. */
const SEO_TITLE = 'Schedule a consultation | Navigate Wealth';
const SEO_DESCRIPTION =
  'Book a complimentary consultation with a Navigate Wealth financial adviser.';
const CANONICAL = `${SITE_ORIGIN}/schedule-consultation`;

/** "+27 (0)12 667 2505", as the board prints the companyFacts number. */
const NATIONAL_DIGITS = COMPANY.phone.tel.replace(/\D/g, '').slice(2);
const PHONE_INTERNATIONAL = `+27 (0)${NATIONAL_DIGITS.slice(0, 2)} ${NATIONAL_DIGITS.slice(2, 5)} ${NATIONAL_DIGITS.slice(5)}`;

const HOURS = `Monday – Friday, ${COMPANY.officeHours.open} – ${COMPANY.officeHours.close}`;
const NOTICE = "Bookings require at least one full business day's notice.";

const NEXT_STEPS = [
  'We receive your request and send a confirmation to your email.',
  'We contact you within 24 hours on business days to confirm your appointment.',
  `We meet — in person at our ${COMPANY.address.city} office, by video or by phone, in ${COMPANY.languages.join(' or ')}.`,
] as const;

const MARKS = [
  { label: 'Free consultation', icon: 'shield' },
  { label: 'No obligation', icon: 'checkCircle' },
  { label: 'Expert advice', icon: 'sparkles' },
] as const;

/** Click ids the live page passes on with the analytics event, beside utm_*. */
const CLICK_IDS = ['gclid', 'fbclid', 'msclkid'];

export function NavigatorScheduleConsultationPage() {
  const location = useLocation();

  // The live page's analytics, unchanged: one event per visit, with attribution.
  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const attribution: Record<string, string> = {};
    sp.forEach((value, key) => {
      if (key.startsWith('utm_') || CLICK_IDS.includes(key)) {
        attribution[key] = value;
      }
    });
    trackConsultationFlowStarted({
      page_path: location.pathname,
      page_location: window.location.href,
      ...attribution,
    });
  }, [location.pathname, location.search]);

  // Campaign parameters stay on the link to the full contact form.
  const contactHref = `/contact${location.search || ''}`;

  return (
    <div className="nw-site nwbk">
      <SEO title={SEO_TITLE} description={SEO_DESCRIPTION} canonicalUrl={CANONICAL} />

      <BookingHero
        badge="Consultation"
        title="Schedule Your"
        accent="Free Consultation"
        lead="Book a complimentary session, in person or online. Choose a time that works for you — no obligation."
        marks={MARKS}
        hours={HOURS}
        notice={NOTICE}
      />

      <BookingWizard
        hours={HOURS}
        notice={NOTICE}
        phoneDisplay={COMPANY.phone.display}
        phoneHref={COMPANY.phone.tel}
        whatsappHref={WHATSAPP_HREF}
        nextSteps={NEXT_STEPS}
      />

      <BookingRoutes
        phone={{ display: PHONE_INTERNATIONAL, href: COMPANY.phone.tel }}
        email={COMPANY.email}
        contactHref={contactHref}
        bookingHref="#booking"
      />
    </div>
  );
}

export default NavigatorScheduleConsultationPage;
