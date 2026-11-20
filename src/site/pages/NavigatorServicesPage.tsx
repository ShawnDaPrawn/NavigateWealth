/**
 * NavigatorServicesPage — the redesigned Services overview page (/services).
 *
 * The layout is the "Services" board of the Website Redesign canvas. It reads
 * the services and the reasons to choose the firm from servicesPageData.ts
 * and the advice process from adviceProcess.ts, as the live page does; emits
 * the same SEO tags as the live page (which has no structured data); states
 * the FSP number from companyFacts; and links only to routes the site already
 * serves, plus the in-page anchors of its own service index.
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { SEO } from '../../components/seo/SEO';
import { ADVICE_PROCESS } from '../../components/pages/adviceProcess';
import { SERVICES, WHY_US } from '../../components/pages/servicesPageData';
import { COMPANY } from '../../config/companyFacts';
import { SITE_ORIGIN } from '../../utils/siteOrigin';
import { pad2 } from '../sections/format';
import { ServicesCta } from '../sections/ServicesCta';
import { ServicesHero } from '../sections/ServicesHero';
import {
  ChartIcon,
  CircleCheckIcon,
  GlobeIcon,
  HeartIcon,
  RefreshIcon,
  SearchIcon,
  ShieldCheckIcon,
  ZapIcon,
} from '../sections/ServicesIcons';
import { ServicesProcess } from '../sections/ServicesProcess';
import { ServicesReasons } from '../sections/ServicesReasons';
import { ServicesRows, type ServiceRow } from '../sections/ServicesRows';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/services.css';

const CONSULTATION_PATH = '/schedule-consultation';
const QUOTE_PATH = '/get-quote';

/**
 * The live page's SEO tags, word for word. ServicesPage.tsx sets them inline
 * in its JSX, so there is no constant to import; the page's test checks them
 * against that file, so the two cannot drift apart unnoticed.
 */
const SEO_DATA = {
  title: 'Financial Advice Services in South Africa | Navigate Wealth',
  description:
    'Comprehensive wealth management services from Navigate Wealth — financial planning, risk management, retirement planning, investments, medical aid, estate planning, tax planning, and employee benefits.',
  keywords: [
    'financial services',
    'wealth management',
    'risk management',
    'retirement planning',
    'investment management',
    'medical aid',
    'estate planning',
    'tax planning',
    'employee benefits',
    'South Africa',
  ],
  canonicalUrl: `${SITE_ORIGIN}/services`,
};

const ROWS: ServiceRow[] = SERVICES.map((service, i) => ({
  id: service.id,
  no: pad2(i + 1),
  title: service.title,
  description: service.description,
  highlights: service.highlights,
  path: service.path,
  image: service.image,
  imageKey: service.imageKey,
}));

/** The reasons carry lucide icons for the live page; the board draws its own. */
const REASON_ICONS = [GlobeIcon, HeartIcon, ZapIcon, ShieldCheckIcon] as const;
const REASONS = WHY_US.map(({ title, description }, i) => ({
  title,
  description,
  icon: REASON_ICONS[i],
}));

const STEP_ICONS = [SearchIcon, ChartIcon, CircleCheckIcon, RefreshIcon] as const;

const SERVICE_IDS = new Set(SERVICES.map((service) => service.id));

export function NavigatorServicesPage() {
  const { hash } = useLocation();

  // The service index's links jump to their rows natively. A link from
  // another page (/services#tax-planning) arrives before this lazy page has
  // rendered, so the browser finds nothing to jump to; scroll once it has. A
  // frame's delay lets ScrollToTop's route-change reset run first.
  useEffect(() => {
    const id = decodeURIComponent(hash.slice(1));
    if (!SERVICE_IDS.has(id)) return;
    const frame = requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView());
    return () => cancelAnimationFrame(frame);
  }, [hash]);

  return (
    <div className="nw-site nw-base nwsv">
      <SEO
        title={SEO_DATA.title}
        description={SEO_DATA.description}
        keywords={SEO_DATA.keywords}
        canonicalUrl={SEO_DATA.canonicalUrl}
      />

      <ServicesHero
        badge="Comprehensive Wealth Management"
        title="Financial Solutions for"
        accent="Every Stage of Life"
        lead="From investment management to estate planning, we provide independent, unbiased financial advice, compared across the product providers we work with, to find the right solution for your goals."
        primary={{ label: 'Get a Quote', to: QUOTE_PATH }}
        secondary={{ label: 'Book a Free Consultation', to: CONSULTATION_PATH }}
        trust={[
          `FSCA-authorised · FSP ${COMPANY.fspNumber}`,
          'Independent advice',
          'Free first consultation',
        ]}
        services={ROWS}
      />

      <ServicesRows
        index="01"
        title="Our Services"
        lead="Comprehensive wealth management solutions for every stage of your financial journey"
        services={ROWS}
      />

      <ServicesReasons
        index="02"
        kicker="Why us?"
        title="Why Choose Navigate Wealth?"
        lead="We exist to give you access to the best financial products and unbiased advice — because your goals deserve nothing less."
        reasons={REASONS}
      />

      <ServicesProcess
        index="03"
        title="How We Work"
        lead="A simple, transparent process designed to put your financial goals at the centre of every decision."
        steps={ADVICE_PROCESS}
        icons={STEP_ICONS}
      />

      <ServicesCta
        badge="Free initial consultation"
        title="Ready to Take the First Step?"
        lead="Schedule a complimentary, no-obligation consultation to discuss how our services can help you reach your financial goals."
        primary={{ label: 'Book a Free Consultation', to: CONSULTATION_PATH }}
        secondary={{ label: 'Get a Quote', to: QUOTE_PATH }}
      />
    </div>
  );
}

export default NavigatorServicesPage;
