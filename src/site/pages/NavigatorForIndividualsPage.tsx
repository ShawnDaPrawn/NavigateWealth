/**
 * /solutions/individuals in the Navigator design. Copy and links come from
 * the live ForIndividualsPage (shared through solutionsContent.ts); the H1
 * leads with the searched-for phrase and keeps the live headline beneath it.
 */
import { Compass } from 'lucide-react';
import { SEO, createWebPageSchema } from '../../components/seo/SEO';
import { getSEOData } from '../../components/seo/seo-config';
import { SolutionPage, type SolutionPageConfig } from '../solutions/SolutionPage';
import { PortalArt } from '../solutions/SolutionArt';
import { pickCommonFaqs } from '../solutions/navigatorContent';
import {
  INDIVIDUAL_DIGITAL_FEATURES,
  INDIVIDUAL_SERVICES,
  INDIVIDUALS_JOURNEY_IMAGE,
  LIFE_MILESTONES,
} from '../solutions/solutionsContent';

const CONFIG: SolutionPageConfig = {
  audience: 'individuals',
  hero: {
    badge: 'Independent Financial Advice',
    heading: { lead: 'Financial Advice for Individuals and Families', accent: 'in South Africa' },
    slogan: 'Financial Planning for Individuals',
    lead: "We help you make smart, confident financial decisions — whether you're starting out, growing your career, protecting your family, or planning for retirement.",
    start: { label: 'Get Started', to: '/signup' },
  },
  journey: {
    kicker: 'Every season',
    title: 'Your Financial Partner in Every Season',
    text: "Life comes with milestones — first job, first home, marriage, children, and eventually retirement. At each stage, your financial needs evolve. We partner with you for the long term, helping you adapt your plan as your life changes. Our independence means we're not tied to one provider, so you get the best product fit for your personal goals.",
    stages: LIFE_MILESTONES,
    image: INDIVIDUALS_JOURNEY_IMAGE,
    badge: {
      icon: Compass,
      label: 'Not tied to one provider',
      value: 'The best product fit for you',
    },
  },
  services: {
    kicker: 'Services',
    title: 'Comprehensive Services',
    lead: 'We provide advice and solutions across every key area of personal finance.',
    items: INDIVIDUAL_SERVICES,
  },
  band: {
    kicker: 'Founder-led · Independent',
    title: 'Independent Advice, Personally Delivered',
    text: 'Navigate Wealth is a founder-led, independent practice. We compare products across the providers we work with, and you receive the personal attention of an adviser who knows your situation.',
    action: 'Schedule a Free Consultation',
  },
  digital: {
    kicker: 'Digital & human',
    title: 'Digital Convenience, Human Touch',
    text: 'Navigate Wealth combines a state-of-the-art digital platform with the reassurance of real-world advice. Through your online client portal you can view policies, access documents, and communicate with us anytime, anywhere.',
    note: "Behind the tech, we're real people who take the time to understand you and guide you — because great financial advice is both smart and personal.",
    features: INDIVIDUAL_DIGITAL_FEATURES,
    art: <PortalArt variant="client" />,
  },
  faqs: pickCommonFaqs([
    'How do I get started with Navigate Wealth?',
    'Is Navigate Wealth an independent financial advisor?',
    'What services does Navigate Wealth offer?',
    'Does Navigate Wealth operate across South Africa?',
  ]),
  closing: {
    title: 'Ready to Take Control of Your Financial Future?',
    text: "Whether you're just starting out or planning for retirement, we're here to help you make smart, confident financial decisions every step of the way.",
  },
  quoteLabel: 'Get a Quote',
  ticks: ['Free consultation', 'No obligation', 'Expert advice'],
};

export function NavigatorForIndividualsPage() {
  const seo = getSEOData('for-individuals');
  return (
    <SolutionPage config={CONFIG}>
      <SEO
        {...seo}
        structuredData={createWebPageSchema(seo.title, seo.description, seo.canonicalUrl)}
      />
    </SolutionPage>
  );
}
