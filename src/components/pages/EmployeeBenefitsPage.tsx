/**
 * EmployeeBenefitsPage — Aligned to RiskManagementPage v3 template
 * via ServicePageTemplate.
 */

import image_e687c01861aee919fa24cf06bfbd5e069af5249c from 'figma:asset/e687c01861aee919fa24cf06bfbd5e069af5249c.png';
import React from 'react';
import { useImagePreload } from '../../hooks/useImagePreload';
import { getSEOData } from '../seo/seo-config';
import { ServicePageTemplate, type CoverContent } from '../templates/ServicePageTemplate';
import { Users, Heart, Shield, DollarSign, TrendingUp, Building, Award, Briefcase, FileText, Search, MessageSquare, CheckCircle2 } from 'lucide-react';
import employeeBenefitsBusinessImage from 'figma:asset/f7f8a616cb10a78c61dfc9f8e66eeefbfeac413c.png';
import {
  allanGrayLogo, brightRockLogo, capitalLegacyLogo, discoveryLogo, hollardLogo,
  inn8Logo, justLogo, libertyLogo, momentumLogo, oldMutualLogo, sanlamLogo, stanlibLogo, sygniaLogo,
} from '../shared/assets/provider-logos';

import lifeCoverImage from 'figma:asset/95a72733c6fb1b2e130e44b33bbad76a781daa85.png';
import medicalAidImage from 'figma:asset/0eb19d8516137ad854c3e1eff7fd832575e13bbe.png';
import retirementBenefitsImage from 'figma:asset/ba894cd523cb809fc58fbe47532929eda12b50da.png';
import disabilityImage from 'figma:asset/46902e1b4e7cc612eaf07c17fb1352b7bdb1d876.png';
import wellnessImage from 'figma:asset/f4dccabf483213a63e0d519849049eacfd949bcb.png';
import schemeDesignImage from 'figma:asset/cd48e241eab530d5767067af7cde123eed9c55d0.png';
import administrationImage from 'figma:asset/689d26eedad1e179b7cb6a7e0aeb42b33aac8696.png';
import complianceImage from 'figma:asset/842567497fa9b90bb6a11f4a8cd2092a0355be3e.png';

const partnerLogos = [
  { id: 'discovery', name: 'Discovery', logo: discoveryLogo, est: '1992' },
  { id: 'momentum', name: 'Momentum', logo: momentumLogo, est: '1966' },
  { id: 'liberty', name: 'Liberty', logo: libertyLogo, est: '1957' },
  { id: 'brightrock', name: 'BrightRock', logo: brightRockLogo, est: '2011' },
  { id: 'sanlam', name: 'Sanlam', logo: sanlamLogo, est: '1918' },
  { id: 'old-mutual', name: 'Old Mutual', logo: oldMutualLogo, est: '1845' },
  { id: 'allan-gray', name: 'Allan Gray', logo: allanGrayLogo, est: '1973' },
  { id: 'sygnia', name: 'Sygnia', logo: sygniaLogo, est: '2003' },
  { id: 'hollard', name: 'Hollard', logo: hollardLogo, est: '1980' },
  { id: 'stanlib', name: 'Stanlib', logo: stanlibLogo, est: '1974' },
  { id: 'inn8', name: 'INN8', logo: inn8Logo, est: '2018' },
  { id: 'just', name: 'JUST', logo: justLogo, est: '2012' },
  { id: 'capital-legacy', name: 'Capital Legacy', logo: capitalLegacyLogo, est: '2005' },
];

const INDIVIDUAL_TAB_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'life-cover': Heart,
  'medical-aid': Shield,
  'retirement': DollarSign,
  'disability': Users,
  'wellness': TrendingUp,
};

const individualToggleOptions = [
  { id: 'life-cover', label: 'Life Cover' },
  { id: 'medical-aid', label: 'Medical Aid' },
  { id: 'retirement', label: 'Retirement' },
  { id: 'disability', label: 'Disability' },
  { id: 'wellness', label: 'Wellness' },
];

const individualProducts: Record<string, CoverContent> = {
  'life-cover': {
    title: 'Group Life Cover',
    description: 'Comprehensive life insurance coverage provided through your employer with competitive rates.',
    benefitsDescription: 'Group life cover provides essential financial protection for your family through employer-sponsored life insurance. This cost-effective coverage typically offers multiple times your annual salary as a death benefit, ensuring your family\'s financial security at affordable group rates.',
    features: [
      { title: 'Salary Multiple', description: 'Multiple of annual salary as death benefit' },
      { title: 'Group Rates', description: 'Competitive premiums through group discounting' },
      { title: 'No Underwriting', description: 'No individual medical assessments required' },
      { title: 'Immediate Cover', description: 'Coverage starts from day one of employment' },
    ],
    benefits: ['Multiple of annual salary coverage', 'Competitive group rates', 'No individual underwriting required', 'Immediate coverage upon employment', 'Spouse and child cover options'],
    image: lifeCoverImage,
  },
  'medical-aid': {
    title: 'Group Medical Aid',
    description: 'Comprehensive healthcare coverage for you and your family through group schemes.',
    benefitsDescription: 'Group medical aid provides comprehensive healthcare coverage through your employer at preferential group rates. These schemes typically offer better benefits and lower costs than individual medical aid, ensuring you and your family have access to quality healthcare.',
    features: [
      { title: 'Group Discounts', description: 'Reduced premiums through employer negotiation' },
      { title: 'Comprehensive Benefits', description: 'Hospital, day-to-day, and chronic cover' },
      { title: 'Family Options', description: 'Add dependants at group rates' },
      { title: 'No Waiting Periods', description: 'Immediate cover for employees' },
    ],
    benefits: ['Group discount rates', 'Comprehensive medical benefits', 'Family coverage options', 'No waiting periods', 'Employer contribution support'],
    image: medicalAidImage,
  },
  'retirement': {
    title: 'Group Retirement Benefits',
    description: 'Employer-sponsored retirement savings with tax advantages and employer contributions.',
    benefitsDescription: 'Group retirement benefits provide a foundation for your retirement savings through employer-sponsored pension or provident funds. These tax-efficient vehicles combine your contributions with employer contributions, creating a valuable long-term benefit for your financial future.',
    features: [
      { title: 'Employer Match', description: 'Employer contributes alongside your savings' },
      { title: 'Tax Efficiency', description: 'Tax-deductible contributions' },
      { title: 'Professional Management', description: 'Expert fund management' },
      { title: 'Portability', description: 'Transfer benefits when changing jobs' },
    ],
    benefits: ['Employer contribution matching', 'Tax-efficient retirement savings', 'Professional fund management', 'Group administrative cost savings', 'Portability on job changes'],
    image: retirementBenefitsImage,
  },
  'disability': {
    title: 'Group Disability Benefits',
    description: 'Income protection and disability coverage through your employer benefit scheme.',
    benefitsDescription: 'Group disability benefits provide crucial income protection if you become unable to work due to illness or injury. These benefits typically replace a percentage of your income and may include lump-sum payments for permanent disability.',
    features: [
      { title: 'Income Replacement', description: 'Monthly income if unable to work' },
      { title: 'Lump-Sum Option', description: 'Capital payment for permanent disability' },
      { title: 'Group Rates', description: 'Affordable premiums through group cover' },
      { title: 'Rehab Support', description: 'Assistance to return to work' },
    ],
    benefits: ['Income replacement benefits', 'Lump-sum disability payments', 'Group rate advantages', 'Comprehensive disability definitions', 'Rehabilitation support benefits'],
    image: disabilityImage,
  },
  'wellness': {
    title: 'Employee Wellness Programs',
    description: 'Comprehensive health and wellness initiatives to support your overall wellbeing.',
    benefitsDescription: 'Employee wellness programs focus on preventative care and lifestyle support to improve your health and productivity. These comprehensive programs include health screenings, fitness benefits, mental health support, and wellness education.',
    features: [
      { title: 'Health Screenings', description: 'Regular biometric and health assessments' },
      { title: 'Fitness Benefits', description: 'Gym and fitness programme subsidies' },
      { title: 'Mental Health', description: 'EAP and counselling support' },
      { title: 'Wellness Education', description: 'Health education and coaching' },
    ],
    benefits: ['Preventative health screenings', 'Fitness and gym benefits', 'Mental health support', 'Wellness coaching programs', 'Health education resources'],
    image: wellnessImage,
  },
};

const BUSINESS_TAB_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'scheme-design': Award,
  'administration': Building,
  'compliance': FileText,
};

const businessToggleOptions = [
  { id: 'scheme-design', label: 'Scheme Design' },
  { id: 'administration', label: 'Administration' },
  { id: 'compliance', label: 'Compliance' },
];

const businessProducts: Record<string, CoverContent> = {
  'scheme-design': {
    title: 'Group Benefit Scheme Design',
    description: 'Customized employee benefit packages tailored to your company\'s needs and culture.',
    benefitsDescription: 'Group benefit scheme design creates comprehensive employee benefit packages that align with your company culture, budget, and strategic objectives. Our approach ensures maximum value for both employer and employees while supporting talent attraction and retention goals.',
    features: [
      { title: 'Custom Design', description: 'Tailored to your company culture and budget' },
      { title: 'Needs Analysis', description: 'Comprehensive employee needs assessment' },
      { title: 'Benchmarking', description: 'Compare against industry standards' },
      { title: 'Tax Optimisation', description: 'Tax-efficient benefit structuring' },
    ],
    benefits: ['Customized benefit package design', 'Budget-aligned solutions', 'Employee needs analysis', 'Competitive benchmarking', 'Tax-efficient structure optimization'],
    image: schemeDesignImage,
  },
  'administration': {
    title: 'Benefit Administration Services',
    description: 'Complete management of your employee benefit programs from enrollment to claims.',
    benefitsDescription: 'Benefit administration services provide comprehensive management of all employee benefit programs, removing the administrative burden from your HR team. Our services include enrollment management, claims processing, compliance monitoring, and employee communication.',
    features: [
      { title: 'Enrollment', description: 'Complete enrollment and onboarding management' },
      { title: 'Claims Processing', description: 'Efficient claims support and resolution' },
      { title: 'Compliance', description: 'Ongoing regulatory compliance monitoring' },
      { title: 'Communication', description: 'Employee benefit education and updates' },
    ],
    benefits: ['Complete enrollment management', 'Claims processing support', 'Compliance monitoring', 'Employee communication', 'Reduced HR administrative burden'],
    image: administrationImage,
  },
  'compliance': {
    title: 'Regulatory Compliance',
    description: 'Ensure your employee benefit programs meet all South African regulatory requirements.',
    benefitsDescription: 'Regulatory compliance services ensure your employee benefit programs meet all legal requirements and industry regulations. Our expertise covers employment equity, POPIA compliance, and benefit legislation to protect your business from regulatory risks.',
    features: [
      { title: 'Employment Law', description: 'Full employment legislation compliance' },
      { title: 'POPIA', description: 'Data protection and privacy compliance' },
      { title: 'Benefit Regulation', description: 'Adherence to benefit legislation' },
      { title: 'Compliance Audits', description: 'Regular regulatory compliance reviews' },
    ],
    benefits: ['Employment legislation compliance', 'POPIA data protection compliance', 'Benefit regulation adherence', 'Regular compliance audits', 'Risk mitigation strategies'],
    image: complianceImage,
  },
};

export function EmployeeBenefitsPage() {
  useImagePreload([
    image_e687c01861aee919fa24cf06bfbd5e069af5249c, employeeBenefitsBusinessImage,
    lifeCoverImage, medicalAidImage, retirementBenefitsImage, disabilityImage, wellnessImage,
    schemeDesignImage, administrationImage, complianceImage,
  ]);

  const seoData = getSEOData('employee-benefits');

  return (
    <ServicePageTemplate
      seoData={seoData}
      config={{
        seoKey: 'employee-benefits',
        hero: {
          badgeText: 'Employee Benefits Solutions',
          titleLine1: 'Invest in Your',
          titleLine2: 'Greatest Asset',
          description: 'Tailored employee benefits solutions — from group risk cover and retirement funds to medical aid and wellness programmes.',
          heroImage: image_e687c01861aee919fa24cf06bfbd5e069af5249c,
          heroImageKey: 'employee-benefits-hero',
          heroImageAlt: 'Happy employees representing comprehensive employee benefits and workplace wellbeing',
          statusLabel: 'Benefits Status',
          statusValue: 'Employees & Businesses',
          quoteLink: '/get-quote/employee-benefits',
          heroStyle: 'unified',
          stats: [
            { value: '13+', label: 'Trusted Providers' },
            { value: '5', label: 'Employee Benefits' },
            { value: '3', label: 'Business Solutions' },
          ],
        },
        individuals: {
          badgeText: 'For Employees',
          title: 'Employee Benefits',
          subtitle: 'Comprehensive benefits to protect you and your family through your employer.',
          tabIcons: INDIVIDUAL_TAB_ICONS,
          toggleOptions: individualToggleOptions,
          products: individualProducts,
          imageAltMap: {
            'life-cover': 'Group life cover providing family financial protection',
            'medical-aid': 'Group medical aid with comprehensive healthcare coverage',
            'retirement': 'Group retirement benefits with employer contributions',
            'disability': 'Group disability benefits and income protection',
            'wellness': 'Employee wellness program supporting health and productivity',
          },
          cardIcon: Heart,
          cardLabel: 'Employee Benefits',
          quoteLink: '/get-quote/employee-benefits',
        },
        business: {
          badgeText: 'For Businesses',
          title: 'Business Benefits Solutions',
          subtitle: 'Design, administer, and manage comprehensive employee benefit programs.',
          tabIcons: BUSINESS_TAB_ICONS,
          toggleOptions: businessToggleOptions,
          products: businessProducts,
          imageAltMap: {
            'scheme-design': 'Group benefit scheme design and customization',
            'administration': 'Benefit administration and enrollment management',
            'compliance': 'Regulatory compliance for employee benefits',
          },
          cardIcon: Briefcase,
          cardLabel: 'Business Benefits',
          quoteLink: '/get-quote/employee-benefits',
        },
        partners: {
          logos: partnerLogos,
          heading: "We work with South Africa's leading benefit providers",
          subHeading: 'Trusted Benefits Partners',
        },
        form: {
          specialistType: 'employee benefits',
          selectLabel: 'Benefit Type',
          selectPlaceholder: 'Select benefit type',
          selectFieldName: 'benefitType',
          selectOptions: [
            { value: 'group-life', label: 'Group Life Cover' },
            { value: 'group-medical', label: 'Group Medical Aid' },
            { value: 'group-retirement', label: 'Group Retirement Fund' },
            { value: 'group-disability', label: 'Group Disability Cover' },
            { value: 'wellness', label: 'Wellness Programs' },
            { value: 'scheme-design', label: 'Benefit Scheme Design' },
            { value: 'consultation', label: 'General Consultation' },
          ],
          textareaPlaceholder: 'Tell us about your employee benefits requirements and company size...',
        },
        structuredDataServiceName: 'Employee Benefits',
        structuredDataServiceType: 'Employee Benefits Advisory',
        structuredDataOffers: [
          { name: 'Group Life Cover', description: 'Comprehensive employer-sponsored life insurance at group rates.' },
          { name: 'Group Medical Aid', description: 'Healthcare coverage through group medical schemes.' },
          { name: 'Group Retirement Benefits', description: 'Employer-sponsored retirement savings with tax advantages.' },
          { name: 'Group Disability Benefits', description: 'Income protection and disability coverage through employer schemes.' },
          { name: 'Employee Wellness Programs', description: 'Preventative health and wellness initiatives for employees.' },
          { name: 'Benefit Scheme Design', description: 'Customized employee benefit packages for businesses.' },
          { name: 'Benefit Administration', description: 'Complete management of employee benefit programs.' },
          { name: 'Regulatory Compliance', description: 'Ensure benefits meet all South African regulatory requirements.' },
        ],
        breadcrumbs: [
          { name: 'Home', url: 'https://navigatewealth.co' },
          { name: 'Services', url: 'https://navigatewealth.co/services' },
          { name: 'Employee Benefits' },
        ],
        preloadImages: [],
        approach: {
          serviceName: 'How We Design Your Benefits',
          headerDescription: 'At Navigate Wealth, we follow a proven methodology to design, implement, and manage employee benefit solutions that attract and retain talent.',
          steps: [
            {
              step: '1',
              title: 'Needs Assessment',
              icon: Search,
              description: 'We analyse your workforce demographics, current benefits, budget, and strategic objectives to identify the optimal benefit structure.',
              details: ['Workforce demographics analysis', 'Current benefits audit', 'Budget assessment', 'Industry benchmarking', 'Employee needs survey'],
              color: 'from-blue-500 to-indigo-600',
            },
            {
              step: '2',
              title: 'Solution Design',
              icon: MessageSquare,
              description: 'Based on your needs, we design a comprehensive benefits package with optimal provider selection and cost-effective structuring.',
              details: ['Customised benefit package', 'Provider comparison and selection', 'Cost-benefit analysis', 'Tax-efficient structuring', 'Communication strategy'],
              color: 'from-green-500 to-emerald-600',
            },
            {
              step: '3',
              title: 'Implement & Support',
              icon: CheckCircle2,
              description: 'We manage the full implementation and provide ongoing administration, compliance monitoring, and annual reviews.',
              details: ['Seamless implementation', 'Employee onboarding and education', 'Claims support and resolution', 'Compliance monitoring', 'Annual benefit reviews'],
              color: 'from-purple-500 to-violet-600',
            },
          ],
          summaryCards: [],
          commitmentText: 'We partner with your business to create a benefits strategy that supports your people and your bottom line. Your employees deserve the best.',
        },
      }}
    />
  );
}