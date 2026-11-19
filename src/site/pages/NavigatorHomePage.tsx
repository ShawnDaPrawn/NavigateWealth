/**
 * NavigatorHomePage — the redesigned home page.
 *
 * Reads the same content as the live home page (homePageData.tsx, the shared
 * FAQs, company facts, provider groups and featured articles), emits the same
 * SEO tags and JSON-LD, and links only to routes the site already serves.
 * The layout is the "Main" board of the Website Redesign canvas. Beyond it:
 * - the hero pauses on hover and focus, and does not rotate under reduced motion;
 * - the FAQ answers stay in the document while collapsed, matching the FAQPage data;
 * - the lead form's errors show beside each field, and its confirmation in place.
 */
import { Globe, Heart, Zap } from 'lucide-react';
import saFlag from 'figma:asset/543ae964645db88228743731ee3eebbbc2e3686e.png';
import { SEO } from '../../components/seo/SEO';
import { commonFAQs } from '../../components/seo/seo-config';
import { solutionItems } from '../../components/layout/navigationData';
import { ADVICE_PROCESS } from '../../components/pages/adviceProcess';
import {
  ENQUIRY_DEFAULT_SERVICE,
  enquiryServiceOptions,
  heroSlides,
  homePageStructuredData,
  providers,
  seoData,
  services,
  whyUs,
} from '../../components/pages/homePageData';
import { PROVIDER_GROUPS } from '../../components/shared/providerGroups';
import { useFeaturedArticles } from '../../components/shared/useFeaturedArticles';
import { COMPANY, TRUST_FACTS } from '../../config/companyFacts';
import { PUBLISHED_REVIEWS } from '../../config/publishedReviews';
import { AudiencePaths } from '../sections/AudiencePaths';
import { EnquiryPanel } from '../sections/EnquiryPanel';
import { FaqRail } from '../sections/FaqRail';
import { HomeHero, type HeroAction, type HeroSlide } from '../sections/HomeHero';
import { InsightCards } from '../sections/InsightCards';
import { PartnerWall } from '../sections/PartnerWall';
import { ProcessSteps } from '../sections/ProcessSteps';
import { ReviewCards } from '../sections/ReviewCards';
import { ServiceCards } from '../sections/ServiceCards';
import { Waypoints } from '../sections/Waypoints';
import { pad2 } from '../sections/format';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/home.css';

const CONSULTATION_PATH = '/schedule-consultation';
const ALL_SERVICES = { label: 'View all services', to: '/services' };

/**
 * Where the redesign's hero actions differ from the live slides: the first
 * slide leads to a consultation, as every Navigator page does, rather than to
 * sign-up; and "Get Quote" reads "Get a Quote", as it does everywhere else.
 */
const HERO_ACTION_OVERRIDES: Record<number, { primary?: HeroAction; secondary?: HeroAction }> = {
  1: { primary: { text: 'Book a Free Consultation', link: CONSULTATION_PATH } },
  2: { secondary: { text: 'Get a Quote', link: '/get-quote' } },
};

const SLIDES: HeroSlide[] = heroSlides.map((slide) => ({
  id: slide.id,
  title: slide.title,
  accent: slide.titleAccent.trim(),
  description: slide.description,
  primary: HERO_ACTION_OVERRIDES[slide.id]?.primary ?? slide.primaryAction,
  secondary: HERO_ACTION_OVERRIDES[slide.id]?.secondary ?? slide.secondaryAction,
}));

const WHY_US_ICONS = [Globe, Heart, Zap] as const;
const WHY_US = whyUs.map((item, i) => ({ ...item, icon: WHY_US_ICONS[i] }));

export function NavigatorHomePage() {
  const { articles, loading } = useFeaturedArticles();

  // Section numbers follow what is on the page. Insights keep their number
  // while loading, so the usual case (articles exist) never renumbers.
  const order = ['services', 'why', 'process', 'partners'];
  if (PUBLISHED_REVIEWS.length > 0) order.push('reviews');
  if (loading || articles.length > 0) order.push('insights');
  order.push('faq');
  const indexOf = (id: string) => {
    const i = order.indexOf(id);
    return i < 0 ? undefined : pad2(i + 1);
  };

  return (
    <div className="nw-site">
      <SEO
        title={seoData.title}
        description={seoData.description}
        keywords={seoData.keywords}
        canonicalUrl={seoData.canonicalUrl}
        ogType={seoData.ogType}
        structuredData={homePageStructuredData}
      />

      <HomeHero
        badge={`Proudly South African · Independent · FSP ${COMPANY.fspNumber}`}
        flagSrc={saFlag}
        slides={SLIDES}
        trustFacts={TRUST_FACTS}
      />

      <AudiencePaths
        title="Tailored guidance for wherever you are."
        paths={solutionItems}
        allLink={ALL_SERVICES}
      />

      <ServiceCards
        index={indexOf('services') ?? ''}
        title="Our Services"
        lead="Comprehensive financial solutions designed to protect and grow your wealth at every stage of life."
        services={services}
        allLink={ALL_SERVICES}
      />

      <Waypoints index={indexOf('why') ?? ''} kicker="Why us?" title="Why us?" points={WHY_US} />

      <ProcessSteps
        index={indexOf('process') ?? ''}
        title="How We Work"
        lead="A simple, transparent process designed to put your financial goals at the centre of every decision."
        steps={ADVICE_PROCESS}
        action={{ label: 'Book a Free Consultation', to: CONSULTATION_PATH }}
      />

      <PartnerWall
        index={indexOf('partners') ?? ''}
        title="Trusted Partners"
        lead="Navigate Wealth works with established South African product providers, so you can compare quality solutions side by side."
        logos={providers}
        groups={PROVIDER_GROUPS}
        consultationLink={CONSULTATION_PATH}
      />

      <ReviewCards index={indexOf('reviews') ?? ''} reviews={PUBLISHED_REVIEWS} />

      <InsightCards
        index={articles.length > 0 ? indexOf('insights') : undefined}
        articles={articles}
        allLink={{ label: 'View all insights', to: '/resources?section=insights' }}
        vascoLink="/ask-vasco"
      />

      <FaqRail
        index={indexOf('faq') ?? ''}
        faqs={commonFAQs}
        lead="Answers to the questions South Africans ask us most about independent financial advice."
        action={{ label: 'Contact Us', to: '/contact', arrow: false }}
      />

      <EnquiryPanel options={enquiryServiceOptions} defaultService={ENQUIRY_DEFAULT_SERVICE} />
    </div>
  );
}

export default NavigatorHomePage;
