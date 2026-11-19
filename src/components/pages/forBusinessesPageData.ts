/**
 * Static content of the For Businesses page (/solutions/businesses): the
 * service cards, the business stages, the trust strip and the digital
 * platform features. Pure data, read by both designs (ForBusinessesPage and
 * src/site/pages/NavigatorForBusinessesPage), so the copy lives in one place
 * whichever design is live.
 */
import {
  Building,
  Shield,
  Users,
  Calculator,
  Globe,
  TrendingUp,
  Trophy,
  FileText,
  Smartphone,
  HeadphonesIcon,
  Monitor,
  PieChart,
} from 'lucide-react';
import { TRUST_FACTS } from '@/config/companyFacts';

export const services = [
  {
    title: 'Employee Benefits',
    description:
      'Comprehensive group health plans, retirement schemes, and employee benefit packages.',
    icon: Users,
    link: '/employee-benefits',
    features: ['Group health insurance', 'Retirement benefits', 'Wellness programs'],
    accent: 'from-blue-500 to-indigo-600',
    accentLight: 'bg-blue-50 text-blue-600',
  },
  {
    title: 'Risk Management',
    description: 'Comprehensive business insurance and risk protection strategies.',
    icon: Shield,
    link: '/risk-management',
    features: ['Business insurance', 'Key person cover', 'Professional indemnity'],
    accent: 'from-rose-500 to-pink-600',
    accentLight: 'bg-rose-50 text-rose-600',
  },
  {
    title: 'Investment Solutions',
    description: 'Corporate treasury management and investment portfolio optimization.',
    icon: PieChart,
    link: '/investment-management',
    features: ['Corporate treasury', 'Investment portfolios', 'Asset allocation'],
    accent: 'from-violet-500 to-purple-600',
    accentLight: 'bg-violet-50 text-violet-600',
  },
  {
    title: 'Tax Planning',
    description: 'Corporate tax optimization, compliance, and strategic tax planning.',
    icon: Calculator,
    link: '/tax-planning',
    features: ['Corporate tax strategy', 'SARS compliance', 'Tax optimization'],
    accent: 'from-amber-500 to-orange-600',
    accentLight: 'bg-amber-50 text-amber-600',
  },
];

export const businessStages = [
  { icon: Building, title: 'Startup', description: 'Launch phase' },
  { icon: TrendingUp, title: 'Growth', description: 'Scaling up' },
  { icon: Users, title: 'Expansion', description: 'Market presence' },
  { icon: Trophy, title: 'Maturity', description: 'Market leader' },
  { icon: Globe, title: 'Global', description: 'International' },
];

// Checkable facts only — see src/config/companyFacts.ts.
export const stats = TRUST_FACTS.slice(0, 3);

export const digitalFeatures = [
  {
    icon: Smartphone,
    title: 'Mobile Access',
    description: 'Manage your business finances from any device, anywhere',
  },
  {
    icon: Monitor,
    title: 'Dashboard',
    description: 'Real-time insights into your corporate portfolio and benefits',
  },
  {
    icon: FileText,
    title: 'Reporting',
    description: 'Detailed analytics and compliance reporting on demand',
  },
  {
    icon: HeadphonesIcon,
    title: 'Dedicated Support',
    description: 'One adviser who knows your business, for proactive guidance',
  },
];
