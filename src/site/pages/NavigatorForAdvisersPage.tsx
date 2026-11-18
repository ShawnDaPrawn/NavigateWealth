/**
 * /solutions/advisers in the Navigator design. Copy and links come from the
 * live ForAdvisersPage (shared through solutionsContent.ts). The H1 leads with
 * what advisers search for ("succession planning for financial advisers"); the
 * live headline, "Succession Planning for Advisers", is all inside it, so no
 * separate slogan repeats it.
 */
import { Briefcase, Lock } from 'lucide-react';
import { SEO, createWebPageSchema } from '../../components/seo/SEO';
import { getSEOData } from '../../components/seo/seo-config';
import { SolutionPage, type SolutionPageConfig } from '../solutions/SolutionPage';
import { TransitionArt } from '../solutions/SolutionArt';
import { pickCommonFaqs } from '../solutions/navigatorContent';
import {
  ADVISER_DIGITAL_FEATURES,
  ADVISER_SERVICES,
  ADVISERS_JOURNEY_IMAGE,
  PRACTICE_STAGES,
} from '../solutions/solutionsContent';

const CONFIG: SolutionPageConfig = {
  audience: 'advisers',
  hero: {
    badge: 'Succession & Practice Management',
    badgeIcon: Briefcase,
    heading: { lead: 'Succession Planning for Financial Advisers', accent: 'in South Africa' },
    lead: "We specialise in succession planning for financial advisers looking to secure the future of their practice — ensuring smooth transitions that preserve client relationships and honour the professional standards you've built.",
    start: { label: 'Get Started', to: '/contact' },
  },
  journey: {
    kicker: 'Your practice journey',
    title: 'Supporting Your Practice Journey at Every Stage',
    text: "From building your early career practice to planning your retirement legacy, every adviser faces unique challenges and opportunities. We provide expert guidance and tailored solutions that evolve with your practice, ensuring your life's work creates lasting value for you, your clients, and the next generation of advisers.",
    stages: PRACTICE_STAGES,
    image: ADVISERS_JOURNEY_IMAGE,
    badge: {
      icon: Lock,
      label: 'Confidential consultation',
      value: "Your life's work, handled with care",
    },
  },
  services: {
    kicker: 'Services',
    title: 'Comprehensive Succession & Advisory Services',
    lead: 'Specialised services across every aspect of practice management and succession.',
    items: ADVISER_SERVICES,
  },
  band: {
    kicker: 'Confidential · Personal',
    title: 'Practice Transitions, Handled Personally',
    text: 'We focus on succession planning and practice transitions, so your transition is handled with the professionalism and care your practice deserves.',
    action: 'Schedule a Confidential Consultation',
  },
  digital: {
    kicker: 'End-to-end support',
    title: 'Comprehensive Support Throughout Your Transition',
    text: 'Navigate Wealth provides end-to-end support throughout your succession journey. From initial planning and valuation through to final client handovers, we make sure every detail is managed professionally.',
    note: "Focus on your next chapter with complete confidence — we handle the complexity so you don't have to.",
    features: ADVISER_DIGITAL_FEATURES,
    art: <TransitionArt />,
  },
  faqs: pickCommonFaqs([
    'Is Navigate Wealth an independent financial advisor?',
    'How do I get started with Navigate Wealth?',
    'Does Navigate Wealth operate across South Africa?',
  ]),
  closing: {
    title: "Ready to Secure Your Practice's Future?",
    text: "Whether you're planning retirement, considering a practice sale, or structuring legacy solutions, we are here to guide you through every step of the process.",
  },
  quoteLabel: 'Get Your Succession Plan',
  ticks: ['Confidential consultation', 'No obligation', 'Succession expertise'],
};

export function NavigatorForAdvisersPage() {
  const seo = getSEOData('for-advisers');
  return (
    <SolutionPage config={CONFIG}>
      <SEO
        {...seo}
        structuredData={createWebPageSchema(seo.title, seo.description, seo.canonicalUrl)}
      />
    </SolutionPage>
  );
}
