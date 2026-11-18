/**
 * Content of the three Solutions pages (/solutions/individuals, /businesses,
 * /advisers), shared by the live design (src/components/pages/For*Page.tsx)
 * and the Navigator design (src/site/pages/NavigatorFor*Page.tsx), so the copy
 * cannot drift between the two while both ship.
 *
 * `accent` / `accentLight` are Tailwind classes only the live design reads.
 */
import {
  Award,
  Baby,
  Briefcase,
  Building,
  Calculator,
  DollarSign,
  FileText,
  Globe,
  GraduationCap,
  HandHeart,
  HeadphonesIcon,
  Heart,
  Home,
  Monitor,
  PieChart,
  Shield,
  Smartphone,
  Target,
  TrendingUp,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface SolutionService {
  title: string;
  description: string;
  icon: LucideIcon;
  link: string;
  features: string[];
  accent: string;
  accentLight: string;
}

export interface SolutionStage {
  icon: LucideIcon;
  title: string;
  description: string;
}

export interface SolutionFeature {
  icon: LucideIcon;
  title: string;
  description: string;
}

export interface SolutionImage {
  src: string;
  alt: string;
}

// ── For Individuals ─────────────────────────────────────────────────────────

export const INDIVIDUAL_SERVICES: SolutionService[] = [
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

export const LIFE_MILESTONES: SolutionStage[] = [
  { icon: Briefcase, title: 'First Job', description: 'Starting your career' },
  { icon: Home, title: 'First Home', description: 'Purchasing property' },
  { icon: Heart, title: 'Marriage', description: 'Building together' },
  { icon: Baby, title: 'Children', description: 'Growing family' },
  { icon: GraduationCap, title: 'Retirement', description: 'Enjoying freedom' },
];

export const INDIVIDUAL_DIGITAL_FEATURES: SolutionFeature[] = [
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

export const INDIVIDUALS_JOURNEY_IMAGE: SolutionImage = {
  src: 'https://images.unsplash.com/photo-1758686254550-c5d8f4de1b3a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmYW1pbHklMjBmaW5hbmNpYWwlMjBwbGFubmluZyUyMGNvbnN1bHRhdGlvbnxlbnwxfHx8fDE3NzE5Mjk5ODF8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
  alt: 'Family financial planning consultation',
};

// ── For Businesses ──────────────────────────────────────────────────────────

export const BUSINESS_SERVICES: SolutionService[] = [
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

export const BUSINESS_STAGES: SolutionStage[] = [
  { icon: Building, title: 'Startup', description: 'Launch phase' },
  { icon: TrendingUp, title: 'Growth', description: 'Scaling up' },
  { icon: Users, title: 'Expansion', description: 'Market presence' },
  { icon: Trophy, title: 'Maturity', description: 'Market leader' },
  { icon: Globe, title: 'Global', description: 'International' },
];

export const BUSINESS_DIGITAL_FEATURES: SolutionFeature[] = [
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

export const BUSINESSES_JOURNEY_IMAGE: SolutionImage = {
  src: 'https://images.unsplash.com/photo-1760346546771-a81d986459ff?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb3Jwb3JhdGUlMjBidXNpbmVzcyUyMHRlYW0lMjBtZWV0aW5nJTIwc3RyYXRlZ3l8ZW58MXx8fHwxNzcxOTMxMTI1fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
  alt: 'Corporate business team discussing financial strategy',
};

// ── For Advisers ────────────────────────────────────────────────────────────

export const ADVISER_SERVICES: SolutionService[] = [
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

export const PRACTICE_STAGES: SolutionStage[] = [
  { icon: Briefcase, title: 'Early Career', description: 'Building practice' },
  { icon: TrendingUp, title: 'Growing', description: 'Expanding client base' },
  { icon: Trophy, title: 'Established', description: 'Mature practice' },
  { icon: Target, title: 'Planning Exit', description: 'Succession focus' },
  { icon: Award, title: 'Retirement', description: 'Legacy secured' },
];

export const ADVISER_DIGITAL_FEATURES: SolutionFeature[] = [
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

export const ADVISERS_JOURNEY_IMAGE: SolutionImage = {
  src: 'https://images.unsplash.com/photo-1770627000564-3feb36aecbcd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzZW5pb3IlMjBmaW5hbmNpYWwlMjBhZHZpc2VyJTIwcHJvZmVzc2lvbmFsJTIwb2ZmaWNlfGVufDF8fHx8MTc3MTkzMTEyNXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
  alt: 'Senior financial adviser in professional office',
};
