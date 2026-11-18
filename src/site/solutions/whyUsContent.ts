/**
 * Content of the Why Us page (/why-us), shared by the live design
 * (src/components/pages/WhyUsPage.tsx) and the Navigator design
 * (src/site/pages/NavigatorWhyUsPage.tsx), so the copy cannot drift between
 * the two while both ship. Facts about the firm come from companyFacts.ts.
 *
 * `gradient` is a Tailwind class only the live design reads.
 */
import {
  Award,
  BarChart3,
  FileCheck,
  Globe,
  Handshake,
  HeadphonesIcon,
  Headset,
  Lightbulb,
  Lock,
  Monitor,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { COMPANY } from '../../config/companyFacts';

export interface CoreValue {
  title: string;
  description: string;
  icon: LucideIcon;
  features: string[];
  gradient: string;
}

export const CORE_VALUES: CoreValue[] = [
  {
    title: 'Independence',
    description:
      "We work for you, not product providers. Our recommendations are based solely on what's best for your financial future.",
    icon: Globe,
    features: [
      'No product provider bias',
      'Access to leading providers',
      'Objective advice always',
      'Your interests first',
    ],
    gradient: 'from-purple-500 to-purple-600',
  },
  {
    title: 'Transparency',
    description:
      'Clear communication about fees, products, and strategies. No hidden costs or complex jargon.',
    icon: FileCheck,
    features: [
      'Upfront fee disclosure',
      'Plain language explanations',
      'Full product transparency',
      'Regular reporting',
    ],
    gradient: 'from-blue-500 to-blue-600',
  },
  {
    title: 'Expertise',
    description:
      'Advice that meets the FSCA’s Fit and Proper standards, backed by continuous professional development.',
    icon: Award,
    features: [
      'FSCA Fit and Proper standards',
      'Continuous professional development',
      'Plain-language advice',
      'Regular plan reviews',
    ],
    gradient: 'from-green-500 to-green-600',
  },
  {
    title: 'Technology',
    description:
      'Modern digital platform combined with personal service for the best of both worlds.',
    icon: Monitor,
    features: [
      '24/7 online portal access',
      'Real-time portfolio tracking',
      'Secure document storage',
      'Mobile friendly',
    ],
    gradient: 'from-orange-500 to-orange-600',
  },
];

export interface Differentiator {
  icon: LucideIcon;
  title: string;
  description: string;
}

export const DIFFERENTIATORS: Differentiator[] = [
  {
    icon: Handshake,
    title: 'Truly Independent',
    description:
      "Unlike tied agents, we're free to recommend products from a range of providers. Our only obligation is to you.",
  },
  {
    icon: HeadphonesIcon,
    title: 'Personal Service',
    description:
      'As a founder-led practice, you deal directly with the person advising you — someone who knows you, your family, and your goals. Real relationships, not call centres.',
  },
  {
    icon: BarChart3,
    title: 'Comprehensive Solutions',
    description:
      'From investments to insurance, retirement to estates - we handle every aspect of your financial life.',
  },
  {
    icon: Lock,
    title: 'Security & Compliance',
    description: `Authorised by the FSCA (FSP ${COMPANY.fspNumber}) and regulated under the FAIS Act. Your personal and financial information is protected with bank-level security.`,
  },
];

export interface ProcessStep {
  number: string;
  title: string;
  description: string;
  icon: LucideIcon;
  details: string[];
}

export const PROCESS_STEPS: ProcessStep[] = [
  {
    number: '01',
    title: 'Discovery & Analysis',
    description:
      'We start by understanding your unique situation, goals, and values through comprehensive consultation.',
    icon: Users,
    details: ['Initial consultation', 'Goals identification', 'Risk profiling', 'Needs analysis'],
  },
  {
    number: '02',
    title: 'Strategy Development',
    description:
      'We research solutions across a range of providers and develop a tailored financial strategy.',
    icon: Lightbulb,
    details: ['Market research', 'Product comparison', 'Strategy formulation', 'Risk assessment'],
  },
  {
    number: '03',
    title: 'Clear Recommendations',
    description:
      'We present transparent recommendations with clear explanations of benefits, costs, and alternatives.',
    icon: FileCheck,
    details: ['Detailed proposals', 'Fee transparency', 'Product comparisons', 'Q&A session'],
  },
  {
    number: '04',
    title: 'Implementation & Support',
    description:
      'We handle all paperwork and provide ongoing support as your needs evolve over time.',
    icon: Headset,
    details: [
      'Application handling',
      'Regular reviews',
      'Portfolio monitoring',
      'Continuous support',
    ],
  },
];

/** "Check Our Credentials" — each line can be confirmed by a third party. */
export const CREDENTIALS: { term: string; detail: string }[] = [
  {
    term: 'FSCA authorisation',
    detail: `FSP ${COMPANY.fspNumber}, granted ${COMPANY.fscaAuthorisedOn}`,
  },
  {
    term: 'Registered company',
    detail: `${COMPANY.legalName}, ${COMPANY.registrationNumber}`,
  },
  { term: 'Office', detail: COMPANY.office },
];
