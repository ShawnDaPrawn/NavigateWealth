/**
 * NavigatorContactPage — the redesigned contact page.
 *
 * The layout is the "Contact" board of the Website Redesign canvas. It emits
 * the same SEO tags and ContactPage data as the live page (ContactPage.tsx),
 * reads the three audiences from the module both designs share
 * (contactPageData.ts), takes the firm's address, phone, email and hours from
 * companyFacts, and sends enquiries exactly as the live page does. It keeps
 * the live page's two address-bar behaviours: ?type=business|advisors opens
 * on that audience (the Solutions pages link this way), and the old
 * ?subject=consultation invite links go to the consultation booking.
 *
 * Where the board says more than the firm can stand behind, the page uses the
 * live page's words instead: replies "within 24 hours on business days" (the
 * board promised one business day), and the confirmation email is called a
 * confirmation, which is what the server sends (the board called it a copy).
 */
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { SEO, createContactPageSchema } from '../../components/seo/SEO';
import { getSEOData } from '../../components/seo/seo-config';
import { clientTypes, type ClientTypeKey } from '../../components/pages/contactPageData';
import { COMPANY } from '../../config/companyFacts';
import { SITE_ORIGIN } from '../../utils/siteOrigin';
import { WHATSAPP_HREF } from '../siteLinks';
import { ContactEnquiry, type EnquiryType } from '../sections/ContactEnquiry';
import { ContactHero } from '../sections/ContactHero';
import { ContactRoutes, type ContactRoute } from '../sections/ContactRoutes';
import { pad2 } from '../sections/format';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/contact.css';

const seoData = getSEOData('contact');
const contactPageStructuredData = createContactPageSchema();

const CONSULTATION_HREF = '/schedule-consultation';

/**
 * The firm's number, from companyFacts, in the two forms the board prints:
 * "012 667 2505" and "+27 (0)12 667 2505".
 */
const NATIONAL_DIGITS = COMPANY.phone.tel.replace(/\D/g, '').slice(2);
const GROUPED = `${NATIONAL_DIGITS.slice(0, 2)} ${NATIONAL_DIGITS.slice(2, 5)} ${NATIONAL_DIGITS.slice(5)}`;
const PHONE_LOCAL = `0${GROUPED}`;
const PHONE_INTERNATIONAL = `+27 (0)${GROUPED}`;

/** "navigatewealth.co", as the board prints the site's address. */
const WEBSITE = new URL(SITE_ORIGIN).hostname.replace(/^www\./, '');

/**
 * The live page builds each message placeholder inline from the audience
 * ("Tell us about your financial goals or …"); repeated here, word for word.
 */
const MESSAGE_TOPIC: Record<ClientTypeKey, string> = {
  individuals: 'financial goals',
  business: 'business needs',
  advisors: 'advisory requirements',
};

const AUDIENCES = Object.keys(clientTypes) as ClientTypeKey[];

const ENQUIRY_TYPES: EnquiryType[] = AUDIENCES.map((key, i) => ({
  key,
  code: `Enquiry · ${pad2(i + 1)}`,
  label: clientTypes[key].label,
  description: clientTypes[key].description,
  services: clientTypes[key].services,
  messagePlaceholder: `Tell us about your ${MESSAGE_TOPIC[key]} or any specific questions you have...`,
}));

const ROUTES: ContactRoute[] = [
  {
    title: 'Book a Free Consultation',
    text: 'Free initial consultation',
    icon: 'calendar',
    tone: 'ink',
    to: CONSULTATION_HREF,
  },
  { title: 'Get a Quote', text: 'No obligation', icon: 'fileText', tone: 'info', to: '/get-quote' },
  {
    title: 'WhatsApp',
    text: 'Chat to Navigate Wealth on WhatsApp',
    icon: 'message',
    tone: 'success',
    to: WHATSAPP_HREF,
    external: true,
  },
  {
    title: 'Ask Vasco',
    text: 'Get answers from our AI financial guide, any time.',
    icon: 'compass',
    tone: 'ink',
    to: '/ask-vasco',
  },
];

const CARD_DETAILS = [
  { label: 'Direct Line', value: PHONE_INTERNATIONAL },
  { label: 'Email Direct', value: COMPANY.email },
  { label: 'Website', value: WEBSITE },
];

function isAudience(value: string | null): value is ClientTypeKey {
  return value !== null && (AUDIENCES as string[]).includes(value);
}

export function NavigatorContactPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [audience, setAudience] = useState<ClientTypeKey>('individuals');

  // ?type=business|advisors preselects the audience (used by the Solutions pages).
  useEffect(() => {
    const type = new URLSearchParams(location.search).get('type');
    if (isAudience(type)) setAudience(type);
  }, [location.search]);

  // Legacy invite links used ?subject=consultation — send them to the dedicated flow (UTMs preserved).
  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    if (sp.get('subject') !== 'consultation') return;
    sp.delete('subject');
    const rest = sp.toString();
    navigate(`${CONSULTATION_HREF}${rest ? `?${rest}` : ''}`, { replace: true });
  }, [location.search, navigate]);

  return (
    <div className="nw-site nw-base nwct">
      <SEO
        title={seoData.title}
        description={seoData.description}
        keywords={seoData.keywords}
        canonicalUrl={seoData.canonicalUrl}
        ogType={seoData.ogType}
        structuredData={contactPageStructuredData}
      />

      <ContactHero
        badge="Get In Touch"
        title="Contact"
        accent="Us"
        lead={`Ready to take control of your financial future? Schedule a complimentary consultation, in person at our ${COMPANY.address.city} office or online, in ${COMPANY.languages.join(' or ')}.`}
        phone={{ display: PHONE_LOCAL, href: COMPANY.phone.tel }}
        email={COMPANY.email}
        address={COMPANY.addressOneLine}
        hours={COMPANY.officeHours.label}
        languages={COMPANY.languages.join(' or ')}
      />

      <ContactRoutes routes={ROUTES} />

      <ContactEnquiry
        kicker="Get In Touch"
        title="How Can We Help?"
        lead="Select the option that best describes you so we can prepare for your enquiry."
        types={ENQUIRY_TYPES}
        active={audience}
        onSelect={(key) => {
          if (isAudience(key)) setAudience(key);
        }}
        details={CARD_DETAILS}
        consultationHref={CONSULTATION_HREF}
      />
    </div>
  );
}

export default NavigatorContactPage;
