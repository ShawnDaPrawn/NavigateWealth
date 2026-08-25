/**
 * Static content of the marketing home page: SEO/structured data, the
 * services preview cards, the provider logo roster, and the hero slides.
 * Pure data — referenced by HomePage and its section components.
 */
import { createOrganizationSchema, createWebPageSchema, createFAQSchema } from '../seo/SEO';
import { getSEOData, commonFAQs } from '../seo/seo-config';
import { createWebSiteSchema } from '../seo/SEO';
import medicalAidImage from 'figma:asset/0e2b917f64eba502a24068ea5244bd25b0dfc9d5.png';
import familyImage from 'figma:asset/8a93f2fa219696290136738d0dc439f43b6c6235.png';
import consultationImage from 'figma:asset/b0b37f186d8c48117bede379a79e329626b6ac95.png';
import investmentConsultationImage from 'figma:asset/fc6a85769d1248cdde73b1d2252674e730f0655a.png';
import estatePlanningImage from 'figma:asset/482a45127e501f4b3cecd244241cff6024f47011.png';
import {
  allanGrayLogo,
  brightRockLogo,
  capitalLegacyLogo,
  discoveryLogo,
  hollardLogo,
  libertyLogo,
  momentumLogo,
  oldMutualLogo,
  sanlamLogo,
  stanlibLogo,
  sygniaLogo,
  justLogo,
} from '../shared/assets/provider-logos';
// WORKAROUND: consultationImage reused as retirementPlanningImage — same asset hash.
// If a distinct retirement image is added in Figma, replace this alias.
const retirementPlanningImage = consultationImage;
import taxPlanningImage from 'figma:asset/7f33deddff0f6240cb18dcef045f830436c30355.png';
import southAfricanCurrencyImage from 'figma:asset/1f32a99aadd795f3c7f5c530f916c758d6ccb6f0.png';
import employeeBenefitsTeamImage from 'figma:asset/dc2935371f93dc2f6da2f85cfa093001ca172d63.png';
import {
  Shield,
  Target,
  TrendingUp,
  FileText,
  Calculator,
  Briefcase,
  Gift,
  Stethoscope,
} from 'lucide-react';

export const seoData = getSEOData('home');

// Combined structured data for homepage
export const homePageStructuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    createOrganizationSchema(),
    createWebSiteSchema(),
    createWebPageSchema(seoData.title, seoData.description, seoData.canonicalUrl!),
    createFAQSchema(commonFAQs),
  ],
};

export const services = [
  {
    title: 'Risk Management',
    description:
      "Protect your family's financial future with comprehensive risk management solutions tailored to your needs.",
    icon: Shield,
    image: familyImage,
    imageKey: 'risk-management-family',
    link: '/risk-management',
  },
  {
    title: 'Retirement Planning',
    description:
      'Build wealth for retirement with strategies designed to maintain your lifestyle and financial independence.',
    icon: Target,
    image: retirementPlanningImage,
    imageKey: 'retirement-planning',
    link: '/retirement-planning',
  },
  {
    title: 'Investment Management',
    description:
      'Grow your wealth with carefully selected local and offshore investments tailored to your risk profile.',
    icon: TrendingUp,
    image: investmentConsultationImage,
    imageKey: 'investment-consultation',
    link: '/investment-management',
  },
  {
    title: 'Estate Planning',
    description:
      'Preserve your legacy and minimize taxes with comprehensive wills, trusts, and tailored estate strategies.',
    icon: FileText,
    image: estatePlanningImage,
    imageKey: 'estate-planning',
    link: '/estate-planning',
  },
  {
    title: 'Tax Planning',
    description:
      'Minimize tax liabilities and ensure compliance with expert strategies that optimize your tax position.',
    icon: Calculator,
    image: taxPlanningImage,
    imageKey: 'tax-planning',
    link: '/tax-planning',
  },
  {
    title: 'Employee Benefits',
    description:
      'Attract and retain top talent with comprehensive employee benefit plans that enhance company culture.',
    icon: Briefcase,
    image: employeeBenefitsTeamImage,
    imageKey: 'employee-benefits',
    link: '/employee-benefits',
  },
  {
    title: 'Cashback',
    description:
      'Earn monthly cashback rewards on all policies and get rewarded for smart financial planning decisions.',
    icon: Gift,
    image: southAfricanCurrencyImage,
    imageKey: 'financial-planning',
    link: '/services',
  },
  {
    title: 'Medical Aid',
    description:
      "Access quality healthcare with comprehensive medical aid schemes tailored to your family's needs.",
    icon: Stethoscope,
    image: medicalAidImage,
    imageKey: 'medical-aid',
    link: '/medical-aid',
  },
];

export const providers = [
  { name: 'Discovery', logo: discoveryLogo },
  { name: 'Old Mutual', logo: oldMutualLogo },
  { name: 'Sanlam', logo: sanlamLogo },
  { name: 'Liberty', logo: libertyLogo },
  { name: 'Momentum', logo: momentumLogo },
  { name: 'Allan Gray', logo: allanGrayLogo },
  { name: 'BrightRock', logo: brightRockLogo },
  { name: 'Hollard', logo: hollardLogo },
  { name: 'Stanlib', logo: stanlibLogo },
  { name: 'Capital Legacy', logo: capitalLegacyLogo },
  { name: 'Sygnia', logo: sygniaLogo },
  { name: 'JUST', logo: justLogo },
];

export const heroSlides = [
  {
    id: 1,
    title: 'Secure Your Financial',
    titleAccent: ' Future.',
    description:
      'Create a financial future that matches your ambition with personal, comprehensive solutions designed with you in mind.',
    primaryAction: {
      text: 'Get Started',
      link: '/signup',
    },
    secondaryAction: {
      text: 'Our Services',
      link: '/services',
    },
  },
  {
    id: 2,
    title: 'Secure Your Retirement With',
    titleAccent: ' Confidence.',
    description:
      'Build wealth systematically with retirement strategies designed to maintain your lifestyle and financial independence for years to come.',
    primaryAction: {
      text: 'Plan My Retirement',
      link: '/retirement-planning',
    },
    secondaryAction: {
      text: 'Get Quote',
      link: '/get-quote',
    },
  },
  {
    id: 3,
    title: 'Grow Your Wealth With',
    titleAccent: ' Expert Guidance.',
    description:
      'Maximize returns with carefully selected local and offshore investments, tailored to your risk profile and financial goals.',
    primaryAction: {
      text: 'Explore Investments',
      link: '/investment-management',
    },
    secondaryAction: {
      text: 'Contact Adviser',
      link: '/contact',
    },
  },
  {
    id: 4,
    title: 'Protect What Matters',
    titleAccent: ' Most.',
    description:
      "Safeguard your family's financial future with comprehensive risk management solutions tailored to your unique needs and circumstances.",
    primaryAction: {
      text: 'Protect My Family',
      link: '/risk-management',
    },
    secondaryAction: {
      text: 'Learn More',
      link: '/services',
    },
  },
];
