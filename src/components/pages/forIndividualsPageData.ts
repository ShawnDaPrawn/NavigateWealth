/**
 * Static content of the For Individuals page (/solutions/individuals): the
 * services, the life milestones and the digital features. Pure data, read by
 * both designs (ForIndividualsPage and the Navigator redesign), so the copy
 * lives in one place whichever design is live.
 */
import {
  Heart,
  Shield,
  DollarSign,
  TrendingUp,
  Trophy,
  FileText,
  Briefcase,
  Home,
  Baby,
  GraduationCap,
  Smartphone,
  HeadphonesIcon,
  Monitor,
} from 'lucide-react';

export const services = [
  {
    title: 'Medical Aid & Gap Cover',
    description:
      "Access South Africa's leading medical schemes and products with comprehensive gap cover protection.",
    icon: Heart,
    link: '/medical-aid',
    features: ['Medical scheme comparison', 'Gap cover options', 'Specialist networks'],
    accent: 'from-rose-500 to-pink-600',
    accentLight: 'bg-rose-50 text-rose-600',
  },
  {
    title: 'Life, Disability & Severe Illness Cover',
    description:
      'Protecting your income and your loved ones with comprehensive risk management solutions.',
    icon: Shield,
    link: '/risk-management',
    features: ['Income protection', 'Family security', 'Critical illness cover'],
    accent: 'from-blue-500 to-indigo-600',
    accentLight: 'bg-blue-50 text-blue-600',
  },
  {
    title: 'Retirement Planning',
    description:
      'Build a future you can count on with proven investment platforms and retirement strategies.',
    icon: Trophy,
    link: '/retirement-planning',
    features: ['Investment platforms', 'Retirement annuities', 'Pension funds'],
    accent: 'from-amber-500 to-orange-600',
    accentLight: 'bg-amber-50 text-amber-600',
  },
  {
    title: 'Investments (Local & Offshore)',
    description:
      'Diversify your wealth and hedge against rand depreciation with local and international investments.',
    icon: TrendingUp,
    link: '/investment-management',
    features: ['Local investments', 'Offshore diversification', 'Currency hedging'],
    accent: 'from-emerald-500 to-teal-600',
    accentLight: 'bg-emerald-50 text-emerald-600',
  },
  {
    title: 'Estate Planning',
    description: 'Wills, trusts, and tax-efficient transfer of your legacy to the next generation.',
    icon: FileText,
    link: '/estate-planning',
    features: ['Will drafting', 'Trust structures', 'Tax efficiency'],
    accent: 'from-violet-500 to-purple-600',
    accentLight: 'bg-violet-50 text-violet-600',
  },
  {
    title: 'Tax Planning',
    description:
      'Optimize your tax strategy and minimize liability through expert planning and compliance.',
    icon: DollarSign,
    link: '/tax-planning',
    features: ['Tax optimization', 'SARS compliance', 'Strategic planning'],
    accent: 'from-cyan-500 to-blue-600',
    accentLight: 'bg-cyan-50 text-cyan-600',
  },
];

export const lifeMilestones = [
  { icon: Briefcase, title: 'First Job', description: 'Starting your career' },
  { icon: Home, title: 'First Home', description: 'Purchasing property' },
  { icon: Heart, title: 'Marriage', description: 'Building together' },
  { icon: Baby, title: 'Children', description: 'Growing family' },
  { icon: GraduationCap, title: 'Retirement', description: 'Enjoying freedom' },
];

export const digitalFeatures = [
  {
    icon: Smartphone,
    title: 'Mobile Access',
    description: 'Manage your finances on the go from any device',
  },
  {
    icon: Monitor,
    title: 'Client Portal',
    description: 'View all policies, statements and documents in one place',
  },
  {
    icon: FileText,
    title: 'Document Access',
    description: 'Download and sign documents instantly — no paperwork',
  },
  {
    icon: HeadphonesIcon,
    title: 'Personal Support',
    description: 'Real human advice from a dedicated financial adviser',
  },
];
