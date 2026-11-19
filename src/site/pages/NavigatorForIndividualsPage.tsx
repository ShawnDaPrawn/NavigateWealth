/**
 * NavigatorForIndividualsPage — the redesigned For Individuals page
 * (/solutions/individuals).
 *
 * The layout is the "ForIndividuals" board of the Website Redesign canvas. It
 * emits the same SEO tags and JSON-LD as the live page, reads the services,
 * life milestones and digital features from forIndividualsPageData.ts (shared
 * with the live page), states only the checkable facts in companyFacts.ts,
 * takes its FAQs from the shared FAQ source and its steps from the shared
 * advice process, and links only to routes the site already serves.
 *
 * The prose below repeats the live page's copy word for word: the live page
 * keeps it inline in its JSX, so there is no module to import it from. The
 * page's test checks each passage against that file, so the two cannot drift
 * apart unnoticed.
 */
import { SEO, createWebPageSchema } from '../../components/seo/SEO';
import { commonFAQs, getSEOData } from '../../components/seo/seo-config';
import { solutionItems, solutionsPanel } from '../../components/layout/navigationData';
import { ADVICE_PROCESS } from '../../components/pages/adviceProcess';
import {
  digitalFeatures,
  lifeMilestones,
  services,
} from '../../components/pages/forIndividualsPageData';
import { TRUST_FACTS } from '../../config/companyFacts';
import { getOptimizedFallbackUrl } from '../../utils/optimizedImages';
import { FaqRail } from '../sections/FaqRail';
import { IndividualsCta } from '../sections/IndividualsCta';
import { IndividualsDigital } from '../sections/IndividualsDigital';
import { IndividualsHero } from '../sections/IndividualsHero';
import { IndividualsIndependent } from '../sections/IndividualsIndependent';
import { IndividualsProcess } from '../sections/IndividualsProcess';
import { IndividualsSeasons } from '../sections/IndividualsSeasons';
import { IndividualsServices } from '../sections/IndividualsServices';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/for-individuals.css';

const PAGE_PATH = '/solutions/individuals';
const CONSULTATION_PATH = '/schedule-consultation';
const QUOTE_PATH = '/get-quote';
const REASSURANCES = ['Free consultation', 'No obligation', 'Expert advice'] as const;

/** The board shows the photograph the Solutions menu uses. */
const PHOTO = {
  src: getOptimizedFallbackUrl(solutionsPanel.image.key),
  imageKey: solutionsPanel.image.key,
  alt: 'Family financial planning consultation',
};

/** The board's four questions, in its order, from the site's one FAQ source. */
const FAQ_QUESTIONS = [
  'How do I get started with Navigate Wealth?',
  'Is Navigate Wealth an independent financial advisor?',
  'What services does Navigate Wealth offer?',
  'Does Navigate Wealth operate across South Africa?',
];
const FAQS = FAQ_QUESTIONS.flatMap((question) =>
  commonFAQs.filter((faq) => faq.question === question),
);

export function NavigatorForIndividualsPage() {
  const seo = getSEOData('for-individuals');

  return (
    <div className="nw-site nwfi">
      <SEO
        {...seo}
        structuredData={createWebPageSchema(seo.title, seo.description, seo.canonicalUrl)}
      />

      <IndividualsHero
        badge="Independent Financial Advice"
        title="Financial Planning"
        accent="for Individuals"
        lead="We help you make smart, confident financial decisions — whether you're starting out, growing your career, protecting your family, or planning for retirement."
        primary={{ label: 'Book a Free Consultation', to: CONSULTATION_PATH }}
        secondary={{ label: 'Get a Quote', to: QUOTE_PATH }}
        checks={REASSURANCES}
        routes={solutionItems}
        currentPath={PAGE_PATH}
        facts={TRUST_FACTS.slice(0, 3)}
      />

      <IndividualsSeasons
        index="01"
        kicker="Every season"
        title="Your Financial Partner in Every Season"
        lead="Life comes with milestones — first job, first home, marriage, children, and eventually retirement. At each stage, your financial needs evolve. We partner with you for the long term, helping you adapt your plan as your life changes. Our independence means we're not tied to one provider, so you get the best product fit for your personal goals."
        milestones={lifeMilestones}
        photo={PHOTO}
        caption={{ label: TRUST_FACTS[1].label, text: 'The best product fit for you' }}
      />

      <IndividualsServices
        index="02"
        title="Comprehensive Services"
        lead="We provide advice and solutions across every key area of personal finance."
        services={services}
        action={{ label: 'Get a Quote', to: QUOTE_PATH }}
      />

      <IndividualsIndependent
        kicker="Founder-led · Independent"
        title="Independent Advice, Personally Delivered"
        lead="Navigate Wealth is a founder-led, independent practice. We compare products across the providers we work with, and you receive the personal attention of an adviser who knows your situation."
        action={{ label: 'Schedule a Free Consultation', to: CONSULTATION_PATH }}
      />

      <IndividualsDigital
        index="03"
        kicker="Digital & human"
        title="Digital Convenience, Human Touch"
        lead="Navigate Wealth combines a state-of-the-art digital platform with the reassurance of real-world advice. Through your online client portal you can view policies, access documents, and communicate with us anytime, anywhere."
        body="Behind the tech, we're real people who take the time to understand you and guide you — because great financial advice is both smart and personal."
        features={digitalFeatures}
      />

      <IndividualsProcess
        index="04"
        title="How We Work"
        lead="A simple, transparent process designed to put your financial goals at the centre of every decision."
        steps={ADVICE_PROCESS}
      />

      <div className="nwfi-faq">
        <FaqRail
          index="05"
          faqs={FAQS}
          lead="Answers to the questions South Africans ask us most about independent financial advice."
          action={{ label: 'Contact Us', to: '/contact' }}
        />
      </div>

      <IndividualsCta
        title="Ready to Take Control of Your Financial Future?"
        lead="Whether you're just starting out or planning for retirement, we're here to help you make smart, confident financial decisions every step of the way."
        primary={{ label: 'Get a Quote', to: QUOTE_PATH }}
        secondary={{ label: 'Book Consultation', to: CONSULTATION_PATH }}
        checks={REASSURANCES}
      />
    </div>
  );
}

export default NavigatorForIndividualsPage;
