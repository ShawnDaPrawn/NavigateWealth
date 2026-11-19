/**
 * NavigatorGetQuotePage — the redesigned first step of the quote flow
 * (/get-quote).
 *
 * The layout is the "GetQuote" board of the Website Redesign canvas. It emits
 * the same SEO tags and WebPage data as the live page (GetQuotePage.tsx),
 * reads the seven services and the trust indicators from the quote flow's own
 * data (quote/constants.ts), sends each service's card exactly where the live
 * page sends it (/get-quote/<service>/contact), takes the FSP number and the
 * phone number from companyFacts, and keeps the live page's two address-bar
 * shortcuts: ?service=<id> (with ?will=true carried over) and #<id> skip
 * straight to that service's contact step.
 *
 * Where the board says more than the live page states, the page uses the
 * live page's words instead: the board's progress card promised that "an
 * adviser replies within one business day"; the live page promises a "24hr
 * response" (as does this page's hero), so the card says "within 24 hours".
 */
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { SEO, createWebPageSchema } from '../../components/seo/SEO';
import { getSEOData } from '../../components/seo/seo-config';
import {
  QUOTE_SERVICES,
  TRUST_INDICATORS,
  isValidServiceId,
} from '../../components/pages/quote/constants';
import { COMPANY } from '../../config/companyFacts';
import { pad2 } from '../sections/format';
import { GetQuoteHero, type GetQuoteHighlight } from '../sections/GetQuoteHero';
import type { GetQuoteIconName } from '../sections/GetQuoteIcons';
import { GetQuoteServices, type GetQuoteServiceCard } from '../sections/GetQuoteServices';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/get-quote.css';

const seoData = getSEOData('get-quote');
const structuredData = createWebPageSchema(
  seoData.title,
  seoData.description,
  seoData.canonicalUrl,
);

const CONSULTATION_PATH = '/schedule-consultation';

/** The live page's contact step for a service. */
const contactPath = (serviceId: string) => `/get-quote/${serviceId}/contact`;

/** The firm's number as the board prints it ("012 667 2505"), from companyFacts. */
const NATIONAL_DIGITS = COMPANY.phone.tel.replace(/\D/g, '').slice(2);
const PHONE_LOCAL = `0${NATIONAL_DIGITS.slice(0, 2)} ${NATIONAL_DIGITS.slice(2, 5)} ${NATIONAL_DIGITS.slice(5)}`;

/**
 * The live page lists these inline in its JSX, so there is no constant to
 * import; the page's test checks them against that file word for word.
 */
const HIGHLIGHTS: GetQuoteHighlight[] = [
  { icon: 'clock', label: '24hr response' },
  { icon: 'users', label: 'Independent advice' },
  { icon: 'shield', label: 'FSCA regulated' },
  { icon: 'sparkles', label: 'Established partners' },
];

const STEPS = [
  {
    label: 'Choose your service',
    hint: 'Match what you need (e.g. life cover) to the category below.',
  },
  { label: 'Your details' },
  { label: 'Quote details' },
];

/** The board's third note promised a reply "within one business day"; see above. */
const NOTES = ['About 2 minutes', 'No obligation', 'An adviser replies within 24 hours'];

/**
 * The quote flow names its icons by lucide component (each service's icon
 * and the trust indicators'); the board draws its own versions of the same.
 */
const ICON_BY_LUCIDE_NAME: Record<string, GetQuoteIconName> = {
  Shield: 'shield',
  Stethoscope: 'stethoscope',
  Target: 'target',
  TrendingUp: 'trendingUp',
  Briefcase: 'briefcase',
  Calculator: 'calculator',
  FileText: 'fileText',
  CheckCircle: 'checkCircle',
  Phone: 'phone',
  Lock: 'lock',
};

const SERVICES: GetQuoteServiceCard[] = QUOTE_SERVICES.map((service, i) => ({
  id: service.id,
  no: pad2(i + 1),
  label: service.label,
  description: service.description,
  chips: service.topicChips ?? [],
  icon: ICON_BY_LUCIDE_NAME[service.icon] ?? 'shield',
  to: contactPath(service.id),
}));

const TRUST = TRUST_INDICATORS.map(({ label, icon }) => ({
  label,
  icon: ICON_BY_LUCIDE_NAME[icon] ?? 'checkCircle',
}));

export function NavigatorGetQuotePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // The live page's shortcuts, unchanged: ?service=<id> (keeping ?will=true)
  // and #<id> go straight to that service's contact step.
  useEffect(() => {
    const serviceParam = searchParams.get('service');
    if (serviceParam && isValidServiceId(serviceParam)) {
      const will = searchParams.get('will') === 'true' ? '?will=true' : '';
      navigate(`${contactPath(serviceParam)}${will}`, { replace: true });
    }
  }, [searchParams, navigate]);

  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash && isValidServiceId(hash)) {
      navigate(contactPath(hash), { replace: true });
    }
  }, [navigate]);

  return (
    <div className="nw-site nwgq">
      <SEO {...seoData} structuredData={structuredData} />

      <GetQuoteHero
        badge="Free, no-obligation quote"
        title="Get Your"
        accent="Personalised Quote"
        lead="Tap a category below to go straight to the next step, where you'll share your details so we can match you with suitable options from the providers we work with."
        highlights={HIGHLIGHTS}
      />

      <GetQuoteServices
        steps={STEPS}
        notes={NOTES}
        hint={
          <>
            Not sure which to pick? Read the labels under each option — for example, life cover and
            income protection are under <strong>Risk Management</strong>.
          </>
        }
        services={SERVICES}
        help={{
          title: 'Not sure where to start?',
          text: "Book a free, no-obligation consultation and we'll help you chart the right course.",
          action: { label: 'Book a Free Consultation', to: CONSULTATION_PATH },
          phone: { display: PHONE_LOCAL, href: COMPANY.phone.tel },
        }}
        footnote="Tap any category above to enter your details on the next page."
        trust={TRUST}
      />
    </div>
  );
}

export default NavigatorGetQuotePage;
