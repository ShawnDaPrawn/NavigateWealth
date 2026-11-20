/**
 * NavigatorPressPage — the redesigned press page.
 *
 * Reads the same content as the live press page (PressPage.tsx): the press
 * articles from the same route, the company facts from companyFacts.ts, the
 * media kit list and the request email. It emits the same SEO tags and
 * JSON-LD, and links only to routes the site already serves, to the page's
 * own sections, and to the firm's email address and phone number.
 * The layout is the "Press" board of the Website Redesign canvas. Beyond it:
 * - the boilerplate's copy button really copies, and selects the text when
 *   the clipboard is unavailable;
 * - published press releases, which the board does not draw, use the
 *   Navigator article card, and the list's loading state keeps the empty
 *   state's frame;
 * - the request dialog returns focus to whichever button opened it.
 */
import { useRef, useState, type MouseEvent } from 'react';
import { SEO, createWebPageSchema } from '../../components/seo/SEO';
import { getSEOData } from '../../components/seo/seo-config';
import { COMPANY, FOUNDER } from '../../config/companyFacts';
import { SITE_ORIGIN } from '../../utils/siteOrigin';
import { PressBoilerplate } from '../sections/PressBoilerplate';
import { PressContact, type PressCompanyRow } from '../sections/PressContact';
import { PressFacts, type PressFact } from '../sections/PressFacts';
import { PressHero } from '../sections/PressHero';
import { PressKitDialog } from '../sections/PressKitDialog';
import { PressMediaKit, type PressAsset } from '../sections/PressMediaKit';
import { PressNewsroom } from '../sections/PressNewsroom';
import { pad2 } from '../sections/format';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/press.css';

const CONTACT_SECTION_ID = 'media-contact';

/** The live page's facts strip: checkable facts only (see companyFacts.ts). */
const FACTS: PressFact[] = [
  { value: COMPANY.fspNumber, label: 'FSCA-authorised FSP', icon: 'shield' },
  { value: COMPANY.fscaAuthorisedOn, label: 'Licensed by the FSCA', icon: 'calendar' },
  { value: String(COMPANY.foundedYear), label: 'Company founded', icon: 'building' },
  { value: 'Founder-led', label: `Led by ${FOUNDER.name}`, icon: 'userCheck' },
];

/**
 * The paragraph journalists may quote. Each fact in it is in companyFacts.ts;
 * the closing description is the About page's.
 */
const BOILERPLATE =
  `${COMPANY.tradingName} is the trading name of ${COMPANY.legalName} (registration ` +
  `${COMPANY.registrationNumber}), an independent, founder-led financial advisory practice and ` +
  `an authorised Financial Services Provider (FSP ${COMPANY.fspNumber}) licensed by the ` +
  `${COMPANY.regulator} on ${COMPANY.fscaAuthorisedOn}. Founded in ${COMPANY.foundedYear} by ` +
  `${FOUNDER.name} and based in ${COMPANY.address.city}, ${COMPANY.tradingName} helps ` +
  `individuals and families build, protect, and transfer wealth through comprehensive ` +
  `financial planning and investment management.`;

/** The live page's media kit, with the board's picture for each part. */
const MEDIA_ASSETS: PressAsset[] = [
  {
    title: 'Brand Assets',
    description: 'Logo packages, brand guidelines, and visual identity resources',
    type: 'ZIP',
    media: {
      kind: 'logo',
      src: '/brand-assets/navigate-wealth-primary.svg',
      width: 1576,
      height: 892,
    },
  },
  {
    title: 'Founder Photos',
    description: `High-resolution photography of our founder, ${FOUNDER.name}`,
    type: 'ZIP',
    media: { kind: 'photo', imageKey: FOUNDER.imageKey },
  },
  {
    title: 'Company Fact Sheet',
    description: 'Licensing details, milestones, and company overview',
    type: 'PDF',
    media: { kind: 'icon', icon: 'fileText' },
  },
  {
    title: 'Product Brochures',
    description: 'Comprehensive service and solution overviews',
    type: 'PDF',
    media: { kind: 'icon', icon: 'newspaper' },
  },
];

const COMPANY_ROWS: PressCompanyRow[] = [
  { label: 'Legal entity', value: COMPANY.legalName },
  { label: 'Founder', value: FOUNDER.name },
  { label: 'Founded', value: String(COMPANY.foundedYear) },
  { label: 'FSCA authorised', value: COMPANY.fscaAuthorisedOn },
  { label: 'Headquarters', value: COMPANY.headquarters },
  { label: 'FSP Licence', value: COMPANY.fspNumber, mono: true },
  { label: 'Website', value: 'www.navigatewealth.co', href: SITE_ORIGIN },
];

/** The live MediaAccessModal's link: the firm's mailbox, subject filled in. */
const MEDIA_REQUEST_HREF = `mailto:${COMPANY.email}?subject=${encodeURIComponent('Media kit request')}`;

export function NavigatorPressPage() {
  const seoData = getSEOData('press');
  const [kitOpen, setKitOpen] = useState(false);
  const opener = useRef<HTMLElement | null>(null);

  const openKit = (event: MouseEvent<HTMLButtonElement>) => {
    opener.current = event.currentTarget;
    setKitOpen(true);
  };

  return (
    <div className="nw-site nw-base nwpr2">
      <SEO
        title={seoData.title}
        description={seoData.description}
        keywords={seoData.keywords}
        canonicalUrl={seoData.canonicalUrl}
        ogType={seoData.ogType}
        structuredData={createWebPageSchema(
          seoData.title,
          seoData.description,
          seoData.canonicalUrl,
        )}
      />

      <PressHero
        badge="Press Center"
        title={COMPANY.tradingName}
        accent="Press Centre"
        lead="The latest announcements and company news from Navigate Wealth, an independent, founder-led financial advisory practice."
        onRequestKit={openKit}
        contactHref={`#${CONTACT_SECTION_ID}`}
      />

      <PressFacts facts={FACTS} />

      <PressBoilerplate
        index={pad2(1)}
        title={`About ${COMPANY.tradingName}`}
        note="For use in articles and announcements. The licensing details can be checked on the FSCA's public register."
        text={BOILERPLATE}
      />

      <PressNewsroom
        index={pad2(2)}
        title="Featured News"
        lead="Latest major announcements and company developments."
        contactLink="/contact"
      />

      <PressMediaKit
        index={pad2(3)}
        title="Media Resources"
        lead="Our media kit, with brand assets, founder photos and company information, is sent on request."
        assets={MEDIA_ASSETS}
        onRequest={openKit}
      />

      <PressContact
        id={CONTACT_SECTION_ID}
        index={pad2(4)}
        title="Media Contact"
        lead="For press inquiries, interviews, and additional information, contact us directly."
        email={COMPANY.email}
        phone={COMPANY.phone}
        responseTime="Response time: Within 24 hours during business days"
        company={COMPANY_ROWS}
      />

      <PressKitDialog
        open={kitOpen}
        onOpenChange={setKitOpen}
        returnFocusTo={opener}
        email={COMPANY.email}
        phone={COMPANY.phone.display}
        requestHref={MEDIA_REQUEST_HREF}
      />
    </div>
  );
}

export default NavigatorPressPage;
