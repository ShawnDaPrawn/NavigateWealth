/**
 * RetirementPlanningPage — Aligned to RiskManagementPage v3 template
 * via ServicePageTemplate.
 */

import image_89c93e439f4cc9d1a730de65d575c3c6f2e060ec from 'figma:asset/89c93e439f4cc9d1a730de65d575c3c6f2e060ec.png';
import image_eae92cb5e7bd56806577215e734f8b397daa3e46 from 'figma:asset/eae92cb5e7bd56806577215e734f8b397daa3e46.png';
import image_4660d44f48d1f87bfd648cf720e5e52343bf1111 from 'figma:asset/4660d44f48d1f87bfd648cf720e5e52343bf1111.png';
import image_623b0c66ffd502c662b87b4c531d9fe340d2de88 from 'figma:asset/623b0c66ffd502c662b87b4c531d9fe340d2de88.png';
import image_9b5a01c260b3e9de54fd63026cbbfdec6cfc0d79 from 'figma:asset/9b5a01c260b3e9de54fd63026cbbfdec6cfc0d79.png';
import image_365200c034a353b5beb7a8f5a03c2a1a537c101b from 'figma:asset/365200c034a353b5beb7a8f5a03c2a1a537c101b.png';
import image_ec64cc77fab63db12f681738be6d7e622f955e8c from 'figma:asset/ec64cc77fab63db12f681738be6d7e622f955e8c.png';
import image_c6ebf07ce2d2b7d5973be0c78b41cc2d3efbcf39 from 'figma:asset/c6ebf07ce2d2b7d5973be0c78b41cc2d3efbcf39.png';
import image_d84d9d4e620a44dabbbe1f028d18b3312e2327c0 from 'figma:asset/d84d9d4e620a44dabbbe1f028d18b3312e2327c0.png';
import React from 'react';
import { useImagePreload } from '../../hooks/useImagePreload';
import { getSEOData } from '../seo/seo-config';
import { ServicePageTemplate, type CoverContent } from '../templates/ServicePageTemplate';
import { PiggyBank, Target, TrendingUp, Calendar, DollarSign, Building, Shield, Briefcase, Users, Search, MessageSquare, CheckCircle2 } from 'lucide-react';
import retirementHeroImage from 'figma:asset/b6c49e3128a8d7c0869121962a0c8a9836a4fef6.png';
import {
  allanGrayLogo, sygniaLogo, discoveryLogo, libertyLogo, stanlibLogo, inn8Logo,
  oldMutualLogo, sanlamLogo, momentumLogo, justLogo, brightRockLogo, hollardLogo, capitalLegacyLogo,
} from '../shared/assets/provider-logos';

const partnerLogos = [
  { id: 'allan-gray', name: 'Allan Gray', logo: allanGrayLogo, est: '1973' },
  { id: 'sygnia', name: 'Sygnia', logo: sygniaLogo, est: '2003' },
  { id: 'brightrock', name: 'BrightRock', logo: brightRockLogo, est: '2011' },
  { id: 'hollard', name: 'Hollard', logo: hollardLogo, est: '1980' },
  { id: 'capital-legacy', name: 'Capital Legacy', logo: capitalLegacyLogo, est: '2005' },
  { id: 'discovery', name: 'Discovery', logo: discoveryLogo, est: '1992' },
  { id: 'liberty', name: 'Liberty', logo: libertyLogo, est: '1957' },
  { id: 'stanlib', name: 'Stanlib', logo: stanlibLogo, est: '1974' },
  { id: 'inn8', name: 'INN8', logo: inn8Logo, est: '2018' },
  { id: 'old-mutual', name: 'Old Mutual', logo: oldMutualLogo, est: '1845' },
  { id: 'sanlam', name: 'Sanlam', logo: sanlamLogo, est: '1918' },
  { id: 'momentum', name: 'Momentum', logo: momentumLogo, est: '1966' },
  { id: 'just', name: 'JUST', logo: justLogo, est: '2012' },
];

const INDIVIDUAL_TAB_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'retirement-annuities': PiggyBank,
  'preservation': Shield,
  'living-annuities': TrendingUp,
  'fixed-annuity': Calendar,
  'blended-annuity': Target,
};

const individualToggleOptions = [
  { id: 'retirement-annuities', label: 'Retirement Annuities' },
  { id: 'preservation', label: 'Preservation Funds' },
  { id: 'living-annuities', label: 'Living Annuities' },
  { id: 'fixed-annuity', label: 'Fixed / Life Annuity' },
  { id: 'blended-annuity', label: 'Blended Annuity' },
];

const individualProducts: Record<string, CoverContent> = {
  'retirement-annuities': {
    title: 'Retirement Annuities',
    description: 'Tax-efficient long-term retirement savings with maximum annual deductions.',
    benefitsDescription: 'Retirement annuities provide the cornerstone of retirement planning with generous tax deductions and long-term growth potential. These tax-advantaged vehicles allow you to save systematically for retirement while reducing your annual tax liability, ensuring your golden years are financially secure.',
    features: [
      { title: 'Tax Deductions', description: 'Annual deductions up to R350,000' },
      { title: 'Tax-Free Growth', description: 'No tax on investment returns until retirement' },
      { title: 'Flexible Contributions', description: 'Choose your monthly or lump-sum amounts' },
      { title: 'Professional Management', description: 'Expert fund managers optimise your portfolio' },
    ],
    benefits: ['Annual tax deduction up to R350,000', 'Tax-free growth until retirement', 'Flexible contribution options', 'Professional investment management', 'Inflation-beating long-term returns'],
    image: image_9b5a01c260b3e9de54fd63026cbbfdec6cfc0d79,
  },
  'preservation': {
    title: 'Preservation Funds',
    description: 'Preserve and grow your retirement benefits when changing jobs or retiring.',
    benefitsDescription: 'Preservation funds protect your accumulated retirement benefits when leaving employment, ensuring your retirement savings continue to grow tax-efficiently. These vehicles prevent the temptation to cash out retirement savings early, preserving your financial future.',
    features: [
      { title: 'Benefit Preservation', description: 'Protect accumulated retirement savings' },
      { title: 'Tax-Free Growth', description: 'Continue tax-efficient compounding' },
      { title: 'One Withdrawal', description: 'Option for one pre-retirement withdrawal' },
      { title: 'Annuity Conversion', description: 'Convert to living annuity at retirement' },
    ],
    benefits: ['Preserve existing retirement benefits', 'Continue tax-efficient growth', 'No immediate tax implications', 'Professional fund management', 'Option to convert to living annuity'],
    image: image_365200c034a353b5beb7a8f5a03c2a1a537c101b,
  },
  'living-annuities': {
    title: 'Living Annuities',
    description: 'Flexible retirement income with investment choice and control.',
    benefitsDescription: 'Living annuities provide flexible retirement income solutions that allow you to remain invested while drawing a regular income. You maintain control over investment decisions and withdrawal rates, ensuring your retirement capital continues to grow while providing necessary income.',
    features: [
      { title: 'Flexible Drawdowns', description: 'Choose between 2.5% and 17.5% per year' },
      { title: 'Investment Control', description: 'Select your own investment portfolio' },
      { title: 'Capital Growth', description: 'Remaining capital continues to grow' },
      { title: 'Inheritance', description: 'Remaining capital passes to your heirs' },
    ],
    benefits: ['Flexible withdrawal rates (2.5% - 17.5%)', 'Investment choice and control', 'Capital growth potential', 'Inheritance benefits for heirs', 'No prescribed minimum pension'],
    image: image_ec64cc77fab63db12f681738be6d7e622f955e8c,
  },
  'fixed-annuity': {
    title: 'Fixed / Life Annuity',
    description: 'Guaranteed retirement income for life with fixed payment amounts.',
    benefitsDescription: 'Fixed or Life Annuities provide guaranteed income for life, offering peace of mind with predictable monthly payments. These annuities protect against longevity risk, ensuring you never outlive your retirement savings while providing stable, inflation-adjusted income throughout your retirement years.',
    features: [
      { title: 'Guaranteed Income', description: 'Fixed monthly payments for life' },
      { title: 'Longevity Protection', description: 'Never outlive your retirement savings' },
      { title: 'Inflation Options', description: 'Choose inflation-linked increases' },
      { title: 'No Investment Risk', description: 'Income unaffected by market movements' },
    ],
    benefits: ['Guaranteed income for life', 'Protection against longevity risk', 'Fixed monthly payment amounts', 'Optional inflation-linked increases', 'No investment risk exposure'],
    image: image_c6ebf07ce2d2b7d5973be0c78b41cc2d3efbcf39,
  },
  'blended-annuity': {
    title: 'Blended Annuity',
    description: 'Optimal combination of guaranteed income and investment growth potential.',
    benefitsDescription: 'Blended Annuities offer the best of both worlds by combining the security of a Life Annuity with the flexibility and growth potential of a Living Annuity. This hybrid approach provides partial guaranteed income for essential expenses while allowing remaining capital to grow and provide flexible withdrawals, balancing security with opportunity.',
    features: [
      { title: 'Hybrid Structure', description: 'Combines guaranteed and flexible income' },
      { title: 'Essential Cover', description: 'Guaranteed portion covers core expenses' },
      { title: 'Growth Potential', description: 'Flexible portion remains invested' },
      { title: 'Custom Allocation', description: 'Choose your guaranteed vs flexible split' },
    ],
    benefits: ['Mix of guaranteed and flexible income', 'Partial longevity risk protection', 'Investment growth opportunities', 'Customizable allocation percentages', 'Balance between security and flexibility'],
    image: image_d84d9d4e620a44dabbbe1f028d18b3312e2327c0,
  },
};

const BUSINESS_TAB_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'pension-funds': Building,
  'provident-funds': DollarSign,
  'group-ras': Users,
  'annuity-products': Calendar,
};

const businessToggleOptions = [
  { id: 'pension-funds', label: 'Pension Funds' },
  { id: 'provident-funds', label: 'Provident Funds' },
  { id: 'group-ras', label: 'Group RAs' },
  { id: 'annuity-products', label: 'Annuity Products' },
];

const businessProducts: Record<string, CoverContent> = {
  'pension-funds': {
    title: 'Pension Funds',
    description: 'Traditional employer-sponsored retirement benefits with defined contributions and tax advantages.',
    benefitsDescription: 'Pension funds provide structured retirement benefits for employees through employer and employee contributions. These funds offer tax-deductible contributions, professional fund management, and mandatory preservation rules that ensure employees build substantial retirement savings while providing employers with valuable retention tools.',
    features: [
      { title: 'Tax-Deductible', description: 'Employer contributions are tax-deductible' },
      { title: 'Preservation Rules', description: 'Mandatory preservation at resignation' },
      { title: 'Trustee Governance', description: 'Professional trustee oversight' },
      { title: 'Retention Tool', description: 'Valuable employee retention benefit' },
    ],
    benefits: ['Tax-deductible employer contributions', 'Mandatory preservation at resignation', 'Professional trustee governance', 'Competitive investment returns', 'Employee retention benefits'],
    image: image_623b0c66ffd502c662b87b4c531d9fe340d2de88,
  },
  'provident-funds': {
    title: 'Provident Funds',
    description: 'Flexible retirement savings allowing employees full access to accumulated benefits.',
    benefitsDescription: 'Provident funds offer greater flexibility than pension funds by allowing employees to access their full accumulated benefit at retirement or resignation. This flexibility makes them attractive to employees while still providing valuable retirement savings and tax benefits for long-term contributors, with options for preservation and continued growth.',
    features: [
      { title: 'Full Access', description: 'Full benefit access at retirement' },
      { title: 'Flexible Withdrawal', description: 'Options at resignation' },
      { title: 'Tax Benefits', description: 'Tax-efficient employee benefits' },
      { title: 'Preservation Option', description: 'Optional preservation opportunities' },
    ],
    benefits: ['Full benefit access at retirement', 'Flexible withdrawal options at resignation', 'Tax-efficient employee benefits', 'Optional preservation opportunities', 'Simplified benefit communication'],
    image: image_4660d44f48d1f87bfd648cf720e5e52343bf1111,
  },
  'group-ras': {
    title: 'Group Retirement Annuities (RAs)',
    description: 'Employer-facilitated retirement savings with individual ownership and maximum flexibility.',
    benefitsDescription: 'Group Retirement Annuities combine the convenience of employer-facilitated contributions with individual policy ownership. These arrangements offer employees maximum flexibility and portability, as they own their policies individually while benefiting from group discounts and simplified payroll deductions arranged by their employer.',
    features: [
      { title: 'Individual Ownership', description: 'Employees own their own policies' },
      { title: 'Full Portability', description: 'Take your policy when you leave' },
      { title: 'Group Discounts', description: 'Reduced fees through group rates' },
      { title: 'Payroll Deductions', description: 'Convenient employer facilitation' },
    ],
    benefits: ['Individual policy ownership', 'Maximum portability between jobs', 'Group discount rates', 'Payroll deduction convenience', 'Annual tax deductions up to R350,000'],
    image: image_eae92cb5e7bd56806577215e734f8b397daa3e46,
  },
  'annuity-products': {
    title: 'Annuity Products',
    description: 'Income solutions for retiring employees including living, life, and blended annuities.',
    benefitsDescription: 'Annuity products provide retiring employees with various income options to convert their accumulated retirement savings into sustainable retirement income. Options include living annuities for flexibility and growth, life annuities for guaranteed income, or blended solutions combining security with opportunity, tailored to each retiree\'s needs and risk appetite.',
    features: [
      { title: 'Living Annuities', description: 'Flexible income with investment control' },
      { title: 'Life Annuities', description: 'Guaranteed income for life' },
      { title: 'Blended Options', description: 'Combine guarantees with flexibility' },
      { title: 'Professional Planning', description: 'Tailored retirement income advice' },
    ],
    benefits: ['Multiple income solution options', 'Living annuities with flexibility', 'Life annuities with guarantees', 'Blended annuity combinations', 'Professional retirement income planning'],
    image: image_89c93e439f4cc9d1a730de65d575c3c6f2e060ec,
  },
};

export function RetirementPlanningPage() {
  useImagePreload([
    retirementHeroImage,
    image_9b5a01c260b3e9de54fd63026cbbfdec6cfc0d79, image_365200c034a353b5beb7a8f5a03c2a1a537c101b,
    image_ec64cc77fab63db12f681738be6d7e622f955e8c, image_c6ebf07ce2d2b7d5973be0c78b41cc2d3efbcf39,
    image_d84d9d4e620a44dabbbe1f028d18b3312e2327c0, image_623b0c66ffd502c662b87b4c531d9fe340d2de88,
    image_4660d44f48d1f87bfd648cf720e5e52343bf1111, image_eae92cb5e7bd56806577215e734f8b397daa3e46,
    image_89c93e439f4cc9d1a730de65d575c3c6f2e060ec,
  ]);

  const seoData = getSEOData('retirement-planning');

  return (
    <ServicePageTemplate
      seoData={seoData}
      config={{
        seoKey: 'retirement-planning',
        hero: {
          badgeText: 'Retirement Planning Solutions',
          titleLine1: 'Secure Your',
          titleLine2: 'Financial Future',
          description: 'Comprehensive retirement planning for individuals and businesses — from retirement annuities to pension funds, tailored to your goals.',
          heroImage: retirementHeroImage,
          heroImageKey: 'retirement-hero',
          heroImageAlt: 'Happy retired couple enjoying financial freedom representing retirement planning success',
          statusLabel: 'Retirement Status',
          statusValue: 'Individuals & Businesses',
          quoteLink: '/get-quote/retirement-planning',
          heroStyle: 'unified',
          stats: [
            { value: '13+', label: 'Trusted Providers' },
            { value: '5', label: 'Individual Products' },
            { value: '4', label: 'Business Solutions' },
          ],
        },
        individuals: {
          badgeText: 'For Individuals',
          title: 'Retirement Solutions for Individuals',
          subtitle: 'Tailored retirement planning across every stage of your career and beyond.',
          tabIcons: INDIVIDUAL_TAB_ICONS,
          toggleOptions: individualToggleOptions,
          products: individualProducts,
          imageAltMap: {
            'retirement-annuities': 'Retirement annuity savings growth and tax deductions',
            'preservation': 'Preservation fund protecting accumulated retirement benefits',
            'living-annuities': 'Living annuity providing flexible retirement income',
            'fixed-annuity': 'Fixed annuity guaranteed income for life',
            'blended-annuity': 'Blended annuity combining security with flexibility',
          },
          cardIcon: PiggyBank,
          cardLabel: 'Personal Retirement',
          quoteLink: '/get-quote/retirement-planning',
        },
        business: {
          badgeText: 'For Businesses',
          title: 'Retirement Solutions for Businesses',
          subtitle: 'Structured retirement benefits that attract and retain talented employees.',
          tabIcons: BUSINESS_TAB_ICONS,
          toggleOptions: businessToggleOptions,
          products: businessProducts,
          imageAltMap: {
            'pension-funds': 'Employer pension fund structured retirement benefits',
            'provident-funds': 'Provident fund flexible employee retirement savings',
            'group-ras': 'Group retirement annuity with individual ownership',
            'annuity-products': 'Annuity products for retiring employees',
          },
          cardIcon: Briefcase,
          cardLabel: 'Business Retirement',
          quoteLink: '/get-quote/retirement-planning',
        },
        partners: {
          logos: partnerLogos,
          heading: "We work with South Africa's leading retirement providers",
          subHeading: 'Trusted Retirement Partners',
        },
        form: {
          specialistType: 'retirement planning',
          selectLabel: 'Retirement Goal',
          selectPlaceholder: 'Select retirement goal',
          selectFieldName: 'retirementGoal',
          selectOptions: [
            { value: 'retirement-annuity', label: 'Retirement Annuity' },
            { value: 'preservation-fund', label: 'Preservation Fund' },
            { value: 'living-annuity', label: 'Living Annuity' },
            { value: 'pension-fund', label: 'Pension/Provident Fund' },
            { value: 'retirement-income', label: 'Retirement Income Planning' },
            { value: 'consultation', label: 'General Consultation' },
          ],
          textareaPlaceholder: 'Tell us about your retirement goals and current savings situation...',
        },
        structuredDataServiceName: 'Retirement Planning',
        structuredDataServiceType: 'Retirement Planning Advisory',
        structuredDataOffers: [
          { name: 'Retirement Annuities', description: 'Tax-efficient long-term retirement savings with annual deductions.' },
          { name: 'Preservation Funds', description: 'Preserve and grow retirement benefits when changing jobs.' },
          { name: 'Living Annuities', description: 'Flexible retirement income with investment choice and control.' },
          { name: 'Fixed / Life Annuity', description: 'Guaranteed retirement income for life.' },
          { name: 'Blended Annuity', description: 'Combination of guaranteed income and investment growth.' },
          { name: 'Pension Funds', description: 'Employer-sponsored retirement benefits with tax advantages.' },
          { name: 'Provident Funds', description: 'Flexible retirement savings with full benefit access.' },
          { name: 'Group Retirement Annuities', description: 'Employer-facilitated savings with individual ownership.' },
        ],
        breadcrumbs: [
          { name: 'Home', url: 'https://navigatewealth.co' },
          { name: 'Services', url: 'https://navigatewealth.co/services' },
          { name: 'Retirement Planning' },
        ],
        preloadImages: [],
        approach: {
          serviceName: 'How We Plan Your Retirement',
          headerDescription: 'At Navigate Wealth, we follow a proven methodology to ensure your retirement strategy provides the income and security you need for a comfortable retirement.',
          steps: [
            {
              step: '1',
              title: 'Assess Your Position',
              icon: Search,
              description: 'We analyse your current financial position, retirement goals, desired lifestyle, and existing provisions to identify gaps.',
              details: ['Current savings analysis', 'Retirement income needs assessment', 'Gap analysis and projections', 'Risk appetite evaluation', 'Tax position review'],
              color: 'from-blue-500 to-indigo-600',
            },
            {
              step: '2',
              title: 'Design Your Strategy',
              icon: MessageSquare,
              description: 'Based on your profile, we design a comprehensive retirement strategy with optimal product allocation and provider selection.',
              details: ['Customised retirement roadmap', 'Product and provider comparison', 'Tax-efficient structuring', 'Contribution optimisation', 'Risk management integration'],
              color: 'from-green-500 to-emerald-600',
            },
            {
              step: '3',
              title: 'Implement & Review',
              icon: CheckCircle2,
              description: 'We implement your strategy and provide ongoing monitoring with annual reviews to keep you on track for a secure retirement.',
              details: ['Seamless implementation', 'Annual performance reviews', 'Strategy adjustments', 'Pre-retirement planning', 'Retirement income optimisation'],
              color: 'from-purple-500 to-violet-600',
            },
          ],
          summaryCards: [],
          commitmentText: 'We only proceed when you fully understand your retirement strategy and are completely satisfied with the plan. Your retirement security is our priority.',
        },
      }}
    />
  );
}