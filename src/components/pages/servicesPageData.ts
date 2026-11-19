/**
 * Static content of the Services overview page (/services): the eight
 * services and the four reasons to choose the firm. Pure data, read by both
 * designs — the live ServicesPage and the Navigator redesign — so the copy
 * lives in one place whichever design is live.
 *
 * The advice process comes from adviceProcess.ts, which the home page shares.
 */
import type React from 'react';
import {
  TrendingUp,
  Shield,
  Target,
  Calculator,
  Briefcase,
  Heart,
  Users,
  Globe,
  Zap,
  FileText,
  Stethoscope,
} from 'lucide-react';

// Figma asset images — same images used on Homepage for visual consistency
import familyImage from 'figma:asset/8a93f2fa219696290136738d0dc439f43b6c6235.png';
import consultationImage from 'figma:asset/b0b37f186d8c48117bede379a79e329626b6ac95.png';
import investmentConsultationImage from 'figma:asset/fc6a85769d1248cdde73b1d2252674e730f0655a.png';
import estatePlanningImage from 'figma:asset/482a45127e501f4b3cecd244241cff6024f47011.png';
import taxPlanningImage from 'figma:asset/7f33deddff0f6240cb18dcef045f830436c30355.png';
import employeeBenefitsTeamImage from 'figma:asset/dc2935371f93dc2f6da2f85cfa093001ca172d63.png';
import medicalAidImage from 'figma:asset/0e2b917f64eba502a24068ea5244bd25b0dfc9d5.png';
import southAfricanCurrencyImage from 'figma:asset/1f32a99aadd795f3c7f5c530f916c758d6ccb6f0.png';

// ── Service data ─────────────────────────────────────────────────────────────

export interface ServiceItem {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  highlights: string[];
  image: string;
  imageKey?: string;
  path: string;
  badge?: string;
  quoteSlug: string;
}

export const SERVICES: ServiceItem[] = [
  {
    id: 'risk-management',
    icon: Shield,
    title: 'Risk Management',
    description:
      'Risk management is arguably the most important part of robust financial planning. We highlight how much coverage you require and search the market to provide the best option.',
    highlights: ['Life Cover', 'Income Protection', 'Disability Cover', 'Severe Illness Cover'],
    image: familyImage,
    imageKey: 'risk-management-family',
    path: '/risk-management',
    quoteSlug: 'risk-management',
  },
  {
    id: 'medical-aid',
    icon: Stethoscope,
    title: 'Medical Aid',
    description:
      "Access quality healthcare with comprehensive medical aid schemes tailored to your family's needs and budget, from major medical to full cover options.",
    highlights: ['Hospital Plans', 'Comprehensive Cover', 'Gap Cover', 'Day-to-day Benefits'],
    image: medicalAidImage,
    imageKey: 'medical-aid',
    path: '/medical-aid',
    quoteSlug: 'medical-aid',
  },
  {
    id: 'retirement-planning',
    icon: Target,
    title: 'Retirement Planning',
    description:
      'Secure your future with tailored retirement strategies designed to help you maintain your lifestyle and financial independence in retirement.',
    highlights: ['Retirement Annuities', 'Pension Funds', 'Living Annuities', 'Preservation Funds'],
    image: consultationImage,
    imageKey: 'retirement-planning',
    path: '/retirement-planning',
    quoteSlug: 'retirement-planning',
  },
  {
    id: 'investment-management',
    icon: TrendingUp,
    title: 'Investment Management',
    description:
      'We offer a broad range of carefully selected local and offshore investment products for strategic diversification and long-term growth.',
    highlights: ['Unit Trusts', 'Offshore Investments', 'Tax-Free Savings', 'Portfolio Management'],
    image: investmentConsultationImage,
    imageKey: 'investment-consultation',
    path: '/investment-management',
    quoteSlug: 'investment-management',
  },
  {
    id: 'employee-benefits',
    icon: Briefcase,
    title: 'Employee Benefits',
    description:
      'Tailored benefit plans for businesses to attract and retain top talent with group risk, retirement, and healthcare solutions.',
    highlights: [
      'Group Risk Cover',
      'Retirement Funds',
      'Healthcare Benefits',
      'Wellness Programs',
    ],
    image: employeeBenefitsTeamImage,
    imageKey: 'employee-benefits',
    path: '/employee-benefits',
    quoteSlug: 'employee-benefits',
  },
  {
    id: 'tax-planning',
    icon: Calculator,
    title: 'Tax Planning',
    description:
      'Advanced strategies to minimise liabilities and ensure compliance, leveraging tax-efficient structures and allowances.',
    highlights: [
      'Tax Optimisation',
      'Tax-Free Savings',
      'Estate Duty Planning',
      'Profin partnership',
    ],
    image: taxPlanningImage,
    imageKey: 'tax-planning',
    path: '/tax-planning',
    quoteSlug: 'tax-planning',
  },
  {
    id: 'estate-planning',
    icon: FileText,
    title: 'Estate Planning',
    description:
      "Preserve your legacy and minimise taxes through wills, trusts, and tailored strategies to protect your family's future.",
    highlights: ['Will Drafting', 'Trust Structures', 'Estate Duty', 'Beneficiary Nominations'],
    image: estatePlanningImage,
    imageKey: 'estate-planning',
    path: '/estate-planning',
    quoteSlug: 'estate-planning',
  },
  {
    id: 'financial-planning',
    icon: Users,
    title: 'Financial Planning',
    description:
      'Holistic financial planning that aligns all aspects of your financial life with your personal goals through a comprehensive needs analysis.',
    highlights: [
      'Financial Needs Analysis',
      'Goal Setting',
      'Cash Flow Planning',
      'Debt Management',
    ],
    image: southAfricanCurrencyImage,
    imageKey: 'financial-planning',
    path: '/financial-planning',
    quoteSlug: 'financial-planning',
  },
];

export const WHY_US = [
  {
    icon: Globe,
    title: 'Fiercely Independent',
    description:
      'We are not tied to any single provider. Our independence means unbiased advice and a choice of products across the providers we work with.',
  },
  {
    icon: Heart,
    title: 'Client-First Philosophy',
    description:
      'Every recommendation is tailored to your goals, values, and timeline, with all fees and commissions disclosed upfront.',
  },
  {
    icon: Zap,
    title: 'Technology-Enabled',
    description:
      'We integrate modern technology to streamline onboarding, real-time portfolio monitoring, and transparent reporting.',
  },
  {
    icon: Shield,
    title: 'FSCA Regulated',
    description:
      'Authorised by the FSCA under FSP 54606, we operate under the FAIS Act and its General Code of Conduct.',
  },
];
