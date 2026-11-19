/**
 * NavigatorForBusinessesPage — the redesigned For Businesses page
 * (/solutions/businesses).
 *
 * The layout is the "ForBusinesses" board of the Website Redesign canvas. It
 * reads the live page's copy from forBusinessesPageData.ts, the advice
 * process from adviceProcess.ts, the solutions pages from the navigation
 * data and the FAQs from the shared FAQ set; emits the same SEO tags and
 * JSON-LD as the live page; states only the checkable facts in
 * companyFacts.ts; and links only to routes the site already serves.
 *
 * The headings and paragraphs typed below are the live page's own copy
 * (src/components/pages/ForBusinessesPage.tsx, where they sit inline in the
 * JSX rather than in its data module), word for word; the action labels,
 * section labels, figure caption and solutions panel are the board's.
 */
import employeeBenefitsTeamImage from 'figma:asset/dc2935371f93dc2f6da2f85cfa093001ca172d63.png';
import { SEO, createWebPageSchema } from '../../components/seo/SEO';
import { commonFAQs, getSEOData } from '../../components/seo/seo-config';
import { solutionItems } from '../../components/layout/navigationData';
import { ADVICE_PROCESS } from '../../components/pages/adviceProcess';
import {
  businessStages,
  digitalFeatures,
  services,
  stats,
} from '../../components/pages/forBusinessesPageData';
import { BusinessesBand } from '../sections/BusinessesBand';
import { BusinessesCta } from '../sections/BusinessesCta';
import { BusinessesHero } from '../sections/BusinessesHero';
import {
  BuildingIcon,
  CalculatorIcon,
  FileTextIcon,
  GlobeIcon,
  HeadphonesIcon,
  MonitorIcon,
  PieChartIcon,
  ShieldIcon,
  SmartphoneIcon,
  TrendingUpIcon,
  TrophyIcon,
  UsersIcon,
  type BusinessesIcon,
} from '../sections/BusinessesIcons';
import { BusinessesPortal } from '../sections/BusinessesPortal';
import { BusinessesProcess } from '../sections/BusinessesProcess';
import { BusinessesServices } from '../sections/BusinessesServices';
import { BusinessesStages } from '../sections/BusinessesStages';
import { FaqRail } from '../sections/FaqRail';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/for-businesses.css';

const PAGE_PATH = '/solutions/businesses';
const CONSULTATION_PATH = '/schedule-consultation';
const QUOTE_PATH = '/get-quote';
/** The board's photograph is the Employee Benefits team image (homePageData.tsx). */
const STAGE_IMAGE_KEY = 'employee-benefits';
const CHECKS = ['Free consultation', 'No obligation', 'Business expertise'] as const;

/** The board's icon for each item, in the order the shared data lists them. */
const SERVICE_ICONS: readonly BusinessesIcon[] = [
  UsersIcon,
  ShieldIcon,
  PieChartIcon,
  CalculatorIcon,
];
const STAGE_ICONS: readonly BusinessesIcon[] = [
  BuildingIcon,
  TrendingUpIcon,
  UsersIcon,
  TrophyIcon,
  GlobeIcon,
];
const FEATURE_ICONS: readonly BusinessesIcon[] = [
  SmartphoneIcon,
  MonitorIcon,
  FileTextIcon,
  HeadphonesIcon,
];

const SERVICES = services.map(({ title, description, link, features }, i) => ({
  title,
  description,
  link,
  features,
  icon: SERVICE_ICONS[i],
}));
const STAGES = businessStages.map(({ title, description }, i) => ({
  title,
  description,
  icon: STAGE_ICONS[i],
}));
const FEATURES = digitalFeatures.map(({ title, description }, i) => ({
  title,
  description,
  icon: FEATURE_ICONS[i],
}));
/** The board shows the first four of the shared questions. */
const FAQS = commonFAQs.slice(0, 4);

export function NavigatorForBusinessesPage() {
  const seo = getSEOData('for-businesses');

  return (
    <div className="nw-site nwfb">
      <SEO
        {...seo}
        structuredData={createWebPageSchema(seo.title, seo.description, seo.canonicalUrl)}
      />

      <BusinessesHero
        pill="Corporate Financial Solutions"
        title="Financial Solutions"
        accent="for Businesses"
        lead="We partner with businesses of all sizes to deliver comprehensive financial solutions that drive stability and growth — from employee benefits and cash management to risk protection and tax optimization."
        primary={{ label: 'Book a Free Consultation', to: CONSULTATION_PATH }}
        secondary={{ label: 'Get a Quote', to: QUOTE_PATH }}
        checks={CHECKS}
        routes={solutionItems}
        currentPath={PAGE_PATH}
        facts={stats}
      />

      <BusinessesStages
        kicker="01 — Every stage"
        title="Your Strategic Financial Partner at Every Stage"
        lead="Every business has unique financial challenges and opportunities. Whether you're a startup looking to establish financial foundations, a growing company needing employee benefits, or an established enterprise seeking to optimize corporate treasury — we provide the expertise and solutions to support your journey at every stage."
        stages={STAGES}
        image={{
          src: employeeBenefitsTeamImage,
          imageKey: STAGE_IMAGE_KEY,
          alt: 'Corporate business team discussing financial strategy',
        }}
        caption={{ label: 'Provider comparison', text: 'Options compared across our partners' }}
      />

      <BusinessesServices
        kicker="02 — Services"
        title="Comprehensive Business Solutions"
        lead="Integrated financial services across every key area of business finance."
        action={{ label: 'Get Your Business Quote', to: QUOTE_PATH }}
        services={SERVICES}
      />

      <BusinessesBand
        kicker="Founder-led · Independent"
        title="Independent Advice with Personal Service"
        lead="As a founder-led, independent practice, we compare solutions across the providers we work with and give your business the direct attention and tailored advice it deserves."
        action={{ label: 'Schedule a Business Consultation', to: CONSULTATION_PATH }}
      />

      <BusinessesPortal
        kicker="03 — Technology & partnership"
        title="Modern Technology, Expert Partnership"
        lead="Navigate Wealth combines cutting-edge financial technology with deep business expertise. Through our dedicated business portal, you can manage policies, access reports, and communicate with your adviser."
        body="We provide strategic guidance and proactive support so you can focus on what matters most — your business."
        features={FEATURES}
      />

      <BusinessesProcess
        kicker="04 — Process"
        title="How We Work"
        lead="A simple, transparent process designed to put your financial goals at the centre of every decision."
        steps={ADVICE_PROCESS}
      />

      <FaqRail
        id="faq"
        index="05"
        faqs={FAQS}
        lead="Answers to the questions South Africans ask us most about independent financial advice."
        action={{ label: 'Contact Us', to: '/contact' }}
      />

      <BusinessesCta
        title="Ready to Optimize Your Business Finances?"
        lead="Whether you're looking to enhance employee benefits, plan your business's tax, or develop a comprehensive risk management strategy, we are here to help you succeed."
        primary={{ label: 'Get Your Business Quote', to: QUOTE_PATH }}
        secondary={{ label: 'Book Consultation', to: CONSULTATION_PATH }}
        checks={CHECKS}
      />
    </div>
  );
}

export default NavigatorForBusinessesPage;
