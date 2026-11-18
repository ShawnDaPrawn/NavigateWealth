/**
 * /solutions/businesses in the Navigator design. Copy and links come from
 * the live ForBusinessesPage (shared through solutionsContent.ts); the H1
 * leads with the searched-for phrase. The live headline, "Financial Solutions
 * for Businesses", is all inside the H1, so no separate slogan repeats it.
 */
import { BarChart3, Building } from 'lucide-react';
import { SEO, createWebPageSchema } from '../../components/seo/SEO';
import { getSEOData } from '../../components/seo/seo-config';
import { SolutionPage, type SolutionPageConfig } from '../solutions/SolutionPage';
import { PortalArt } from '../solutions/SolutionArt';
import { pickCommonFaqs } from '../solutions/navigatorContent';
import {
  BUSINESS_DIGITAL_FEATURES,
  BUSINESS_SERVICES,
  BUSINESS_STAGES,
  BUSINESSES_JOURNEY_IMAGE,
} from '../solutions/solutionsContent';

const CONFIG: SolutionPageConfig = {
  audience: 'businesses',
  hero: {
    badge: 'Corporate Financial Solutions',
    badgeIcon: Building,
    heading: { lead: 'Financial Solutions for', accent: 'South African Businesses' },
    lead: 'We partner with businesses of all sizes to deliver comprehensive financial solutions that drive stability and growth — from employee benefits and cash management to risk protection and tax optimization.',
    start: { label: 'Get Started', to: '/signup' },
  },
  journey: {
    kicker: 'Every stage',
    title: 'Your Strategic Financial Partner at Every Stage',
    text: "Every business has unique financial challenges and opportunities. Whether you're a startup looking to establish financial foundations, a growing company needing employee benefits, or an established enterprise seeking to optimize corporate treasury — we provide the expertise and solutions to support your journey at every stage.",
    stages: BUSINESS_STAGES,
    image: BUSINESSES_JOURNEY_IMAGE,
    badge: {
      icon: BarChart3,
      label: 'Provider comparison',
      value: 'Options compared across our partners',
    },
  },
  services: {
    kicker: 'Services',
    title: 'Comprehensive Business Solutions',
    lead: 'Integrated financial services across every key area of business finance.',
    items: BUSINESS_SERVICES,
  },
  band: {
    kicker: 'Founder-led · Independent',
    title: 'Independent Advice with Personal Service',
    text: 'As a founder-led, independent practice, we compare solutions across the providers we work with and give your business the direct attention and tailored advice it deserves.',
    action: 'Schedule a Business Consultation',
  },
  digital: {
    kicker: 'Technology & partnership',
    title: 'Modern Technology, Expert Partnership',
    text: 'Navigate Wealth combines cutting-edge financial technology with deep business expertise. Through our dedicated business portal, you can manage policies, access reports, and communicate with your adviser.',
    note: 'We provide strategic guidance and proactive support so you can focus on what matters most — your business.',
    features: BUSINESS_DIGITAL_FEATURES,
    art: <PortalArt variant="business" />,
  },
  faqs: pickCommonFaqs([
    'What services does Navigate Wealth offer?',
    'Is Navigate Wealth an independent financial advisor?',
    'How do I get started with Navigate Wealth?',
    'Does Navigate Wealth operate across South Africa?',
  ]),
  closing: {
    title: 'Ready to Optimize Your Business Finances?',
    text: "Whether you're looking to enhance employee benefits, plan your business's tax, or develop a comprehensive risk management strategy, we are here to help you succeed.",
  },
  quoteLabel: 'Get Your Business Quote',
  ticks: ['Free consultation', 'No obligation', 'Business expertise'],
};

export function NavigatorForBusinessesPage() {
  const seo = getSEOData('for-businesses');
  return (
    <SolutionPage config={CONFIG}>
      <SEO
        {...seo}
        structuredData={createWebPageSchema(seo.title, seo.description, seo.canonicalUrl)}
      />
    </SolutionPage>
  );
}
