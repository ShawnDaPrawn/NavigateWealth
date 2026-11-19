/**
 * NavigatorForAdvisersPage — the redesigned For Advisers page
 * (/solutions/advisers).
 *
 * The layout is the "For Advisers" board of the Website Redesign canvas. The
 * services, practice stages, trust facts and support features are read from
 * forAdvisersPageData.ts, which the live page reads too; the headings and
 * leads repeat the live page's copy word for word (it keeps them inline in
 * its JSX, so there is nothing to import; the page's test checks them against
 * that file). It emits the same SEO tags and WebPage JSON-LD as the live
 * page, states only facts from companyFacts, and links only to routes the
 * site already serves. Where the live page opened the quote and consultation
 * modals, the board links instead: consultations to /schedule-consultation,
 * quotes to /get-quote, and "Get Your Succession Plan" to the contact page
 * with the adviser enquiry preselected (as the live service cards do).
 */
import { Award, Building, FileText, HandHeart, Trophy } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { SEO, createWebPageSchema } from '../../components/seo/SEO';
import { commonFAQs, getSEOData, type FAQEntry } from '../../components/seo/seo-config';
import { companyPanel, solutionItems } from '../../components/layout/navigationData';
import { ADVICE_PROCESS } from '../../components/pages/adviceProcess';
import {
  digitalFeatures,
  practiceStages,
  services,
  stats,
} from '../../components/pages/forAdvisersPageData';
import { getOptimizedFallbackUrl } from '../../utils/optimizedImages';
import { AdvisersCta } from '../sections/AdvisersCta';
import { AdvisersHero, type AdvisersAction, type AdvisersPath } from '../sections/AdvisersHero';
import {
  AwardIcon,
  BuildingIcon,
  FileTextIcon,
  HandHeartIcon,
  TrophyIcon,
  type AdvisersIconType,
} from '../sections/AdvisersIcons';
import { AdvisersJourney } from '../sections/AdvisersJourney';
import { AdvisersPersonal } from '../sections/AdvisersPersonal';
import { AdvisersProcess } from '../sections/AdvisersProcess';
import { AdvisersServices, type AdvisersService } from '../sections/AdvisersServices';
import { AdvisersSupport, type AdvisersRouteStep } from '../sections/AdvisersSupport';
import { FaqRail } from '../sections/FaqRail';
import { pad2 } from '../sections/format';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/for-advisers.css';

const seoData = getSEOData('for-advisers');
const structuredData = createWebPageSchema(
  seoData.title,
  seoData.description,
  seoData.canonicalUrl,
);

const PAGE_PATH = '/solutions/advisers';
const CONSULTATION_PATH = '/schedule-consultation';
/** ?type=advisors preselects the adviser enquiry on the contact page. */
const ADVISER_CONTACT_PATH = '/contact?type=advisors';

const SUCCESSION_PLAN: AdvisersAction = {
  label: 'Get Your Succession Plan',
  to: ADVISER_CONTACT_PATH,
};

/** The live page's assurance line, word for word. */
const ASSURANCES = ['Confidential consultation', 'No obligation', 'Succession expertise'] as const;

/**
 * The board's drawings of the icons lucide-react has since redrawn; every
 * other icon is the shared data's own.
 */
const BOARD_ICONS = new Map<LucideIcon, AdvisersIconType>([
  [Trophy, TrophyIcon],
  [Award, AwardIcon],
  [HandHeart, HandHeartIcon],
  [Building, BuildingIcon],
  [FileText, FileTextIcon],
]);
const boardIcon = (icon: LucideIcon): AdvisersIconType => BOARD_ICONS.get(icon) ?? icon;

const PATHS: AdvisersPath[] = solutionItems.map((item) => ({
  to: item.path,
  label: item.label,
  description: item.description,
  icon: boardIcon(item.icon),
}));

const STAGES = practiceStages.map((stage) => ({
  title: stage.title,
  description: stage.description,
  icon: boardIcon(stage.icon),
}));

const SERVICES: AdvisersService[] = services.map((service, i) => ({
  no: pad2(i + 1),
  title: service.title,
  description: service.description,
  features: service.features,
  to: service.link,
  // The board's card actions: an enquiry for the succession services, the
  // service page for risk management.
  cta: service.link.startsWith('/contact') ? 'Discuss with us' : 'Learn More',
  icon: boardIcon(service.icon),
}));

const FEATURES = digitalFeatures.map((feature) => ({
  title: feature.title,
  description: feature.description,
  icon: boardIcon(feature.icon),
}));

/** The board's illustration of a transition's route. Decorative. */
const ROUTE: { label: string; badge: string; steps: AdvisersRouteStep[] } = {
  label: 'Transition route',
  badge: 'All parties · Secure',
  steps: [
    { label: 'Initial planning', status: 'Complete', state: 'done' },
    { label: 'Practice valuation', status: 'Complete', state: 'done' },
    { label: 'Deal structuring', status: 'In progress', state: 'current' },
    { label: 'Client handovers', status: 'Next', state: 'next' },
  ],
};

/** The three questions of the shared FAQ set that the board shows. */
const FAQ_QUESTIONS = [
  'Is Navigate Wealth an independent financial advisor?',
  'How do I get started with Navigate Wealth?',
  'Does Navigate Wealth operate across South Africa?',
];
const FAQS = FAQ_QUESTIONS.map((q) => commonFAQs.find((f) => f.question === q)).filter(
  (f): f is FAQEntry => f !== undefined,
);

export function NavigatorForAdvisersPage() {
  return (
    <div className="nw-site nwfa">
      <SEO
        title={seoData.title}
        description={seoData.description}
        keywords={seoData.keywords}
        canonicalUrl={seoData.canonicalUrl}
        ogType={seoData.ogType}
        structuredData={structuredData}
      />

      <AdvisersHero
        badge="Succession & Practice Management"
        title="Succession Planning"
        accent="for Advisers"
        lead="We specialise in succession planning for financial advisers looking to secure the future of their practice — ensuring smooth transitions that preserve client relationships and honour the professional standards you've built."
        primary={{ label: 'Book a Free Consultation', to: CONSULTATION_PATH }}
        secondary={{ label: 'Get a Quote', to: '/get-quote' }}
        assurances={ASSURANCES}
        pathsKicker="Choose your course"
        pathsLabel="Solutions"
        paths={PATHS}
        current={PAGE_PATH}
        facts={stats}
      />

      <AdvisersJourney
        index="01"
        kicker="Your practice journey"
        title="Supporting Your Practice Journey at Every Stage"
        lead="From building your early career practice to planning your retirement legacy, every adviser faces unique challenges and opportunities. We provide expert guidance and tailored solutions that evolve with your practice, ensuring your life's work creates lasting value for you, your clients, and the next generation of advisers."
        stages={STAGES}
        photo={{
          src: getOptimizedFallbackUrl(companyPanel.image.key),
          imageKey: companyPanel.image.key,
          alt: companyPanel.image.alt,
        }}
        caption={{
          label: 'Confidential consultation',
          text: "Your life's work, handled with care",
        }}
      />

      <AdvisersServices
        index="02"
        kicker="Services"
        title="Comprehensive Succession & Advisory Services"
        lead="Specialised services across every aspect of practice management and succession."
        action={SUCCESSION_PLAN}
        services={SERVICES}
      />

      <AdvisersPersonal
        kicker="Confidential · Personal"
        title="Practice Transitions, Handled Personally"
        lead="We focus on succession planning and practice transitions, so your transition is handled with the professionalism and care your practice deserves."
        action={{ label: 'Schedule a Confidential Consultation', to: CONSULTATION_PATH }}
      />

      <AdvisersSupport
        index="03"
        kicker="End-to-end support"
        title="Comprehensive Support Throughout Your Transition"
        lead="Navigate Wealth provides end-to-end support throughout your succession journey. From initial planning and valuation through to final client handovers, we make sure every detail is managed professionally."
        note="Focus on your next chapter with complete confidence — we handle the complexity so you don't have to."
        route={ROUTE}
        features={FEATURES}
      />

      <AdvisersProcess
        index="04"
        title="How We Work"
        lead="A simple, transparent process designed to put your financial goals at the centre of every decision."
        steps={ADVICE_PROCESS}
      />

      <div className="nwfa-faq">
        <FaqRail
          index="05"
          faqs={FAQS}
          lead="Answers to the questions South Africans ask us most about independent financial advice."
          action={{ label: 'Contact Us', to: ADVISER_CONTACT_PATH }}
        />
      </div>

      <AdvisersCta
        title="Ready to Secure Your Practice's Future?"
        lead="Whether you're planning retirement, considering a practice sale, or structuring legacy solutions, we are here to guide you through every step of the process."
        primary={SUCCESSION_PLAN}
        secondary={{ label: 'Book Consultation', to: CONSULTATION_PATH }}
        assurances={ASSURANCES}
      />
    </div>
  );
}

export default NavigatorForAdvisersPage;
