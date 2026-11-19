/**
 * Static content of the For Advisers page: the services, the practice stages,
 * the trust facts and the transition-support features. Pure data, read by
 * both designs (ForAdvisersPage.tsx and the Navigator redesign), so the copy
 * lives in one place whichever design is live.
 */
import {
  Users,
  Shield,
  Award,
  Calculator,
  Target,
  Building,
  TrendingUp,
  Trophy,
  HandHeart,
  FileText,
  Smartphone,
  HeadphonesIcon,
  Monitor,
  Briefcase,
} from 'lucide-react';
import { TRUST_FACTS } from '@/config/companyFacts';

export const services = [
  {
    title: 'Succession Planning',
    description:
      'Smooth practice transitions that preserve client relationships and unlock ongoing revenue streams.',
    icon: Users,
    link: '/contact?type=advisors',
    features: [
      'Client relationship preservation',
      'Revenue stream continuity',
      'Transition management',
    ],
    accent: 'from-blue-500 to-indigo-600',
    accentLight: 'bg-blue-50 text-blue-600',
  },
  {
    title: 'Legacy Planning',
    description:
      'Structure your firm to honor professional standards and ensure multi-generational continuity.',
    icon: HandHeart,
    link: '/contact?type=advisors',
    features: ['Professional standards', 'Multi-generational solutions', 'Service continuity'],
    accent: 'from-violet-500 to-purple-600',
    accentLight: 'bg-violet-50 text-violet-600',
  },
  {
    title: 'Practice Valuation',
    description:
      'Professional practice appraisals and comprehensive assessments for informed decision-making.',
    icon: Calculator,
    link: '/contact?type=advisors',
    features: ['Professional valuations', 'Market assessments', 'Deal structuring'],
    accent: 'from-amber-500 to-orange-600',
    accentLight: 'bg-amber-50 text-amber-600',
  },
  {
    title: 'Practice Sales',
    description:
      'Comprehensive guidance on valuations, deal structures, and seamless client handovers.',
    icon: Building,
    link: '/contact?type=advisors',
    features: ['Fair valuations', 'Transparent deals', 'Client handovers'],
    accent: 'from-emerald-500 to-teal-600',
    accentLight: 'bg-emerald-50 text-emerald-600',
  },
  {
    title: 'Client Transitions',
    description: 'Seamless client relationship transfers that maintain service quality and trust.',
    icon: Target,
    link: '/contact?type=advisors',
    features: ['Relationship transfers', 'Service quality', 'Trust preservation'],
    accent: 'from-rose-500 to-pink-600',
    accentLight: 'bg-rose-50 text-rose-600',
  },
  {
    title: 'Risk Management',
    description: 'Protect your practice from unforeseen circumstances with comprehensive coverage.',
    icon: Shield,
    link: '/risk-management',
    features: ['Practice protection', 'Key person cover', 'Business continuity'],
    accent: 'from-cyan-500 to-blue-600',
    accentLight: 'bg-cyan-50 text-cyan-600',
  },
];

export const practiceStages = [
  { icon: Briefcase, title: 'Early Career', description: 'Building practice' },
  { icon: TrendingUp, title: 'Growing', description: 'Expanding client base' },
  { icon: Trophy, title: 'Established', description: 'Mature practice' },
  { icon: Target, title: 'Planning Exit', description: 'Succession focus' },
  { icon: Award, title: 'Retirement', description: 'Legacy secured' },
];

// Checkable facts only — see src/config/companyFacts.ts.
export const stats = TRUST_FACTS.slice(0, 3);

export const digitalFeatures = [
  {
    icon: Smartphone,
    title: 'Digital Tools',
    description: 'Track every step of your transition from any device',
  },
  {
    icon: Monitor,
    title: 'Client Portal',
    description: 'Secure access for all parties throughout the handover',
  },
  {
    icon: FileText,
    title: 'Documentation',
    description: 'Complete compliance records and audit trails maintained',
  },
  {
    icon: HeadphonesIcon,
    title: 'Personal Service',
    description: 'Direct support from planning through completion',
  },
];
