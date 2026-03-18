/**
 * RiskManagementPage — Refactored to use ServicePageTemplate.
 *
 * Originally the canonical hand-built template (v3) that all other service
 * pages were modelled on. Now uses the same ServicePageTemplate they do,
 * ensuring a single source of truth for layout, modals, and section order.
 */

import React from 'react';
import { useImagePreload } from '../../hooks/useImagePreload';
import { getSEOData } from '../seo/seo-config';
import { ServicePageTemplate, type CoverContent } from '../templates/ServicePageTemplate';
import {
  Shield,
  Heart,
  UserCheck,
  Activity,
  Banknote,
  Briefcase,
  Building,
  Crown,
  Users,
  Search,
  MessageSquare,
  CheckCircle2,
} from 'lucide-react';
import {
  discoveryLogo,
  libertyLogo,
  hollardLogo,
  brightRockLogo,
  oldMutualLogo,
  sanlamLogo,
  momentumLogo,
} from '../shared/assets/provider-logos';

import image_654751ca8be2c3a6b86cd56b21742e6d3ec469ec from 'figma:asset/654751ca8be2c3a6b86cd56b21742e6d3ec469ec.png';
import outdoorFamilyImage from 'figma:asset/f9768bc43fd98373704bc54f70b3ea6ec0c8f020.png';
import lifeCoverImage from 'figma:asset/00f21f624e8160ae5a1793de40e7c0e7ba1ee60d.png';
import disabilityCoverImage from 'figma:asset/4edbc4d460d0ae6f679b5227752c118d5306e279.png';
import severeIllnessCoverImage from 'figma:asset/06a90a7204a3a0765a6ffe95ae6db0a382ea2312.png';
import incomeProtectionImage from 'figma:asset/a0ab0fcb56ab81f6626ad7140dbe807624f853ff.png';
import otherBenefitsImage from 'figma:asset/4dff620ccf41d937ddc51c69e7668b15889a633c.png';
import keyPersonImage from 'figma:asset/47655f7ea49b8154455dbaefe83366869b59cabb.png';
import contingentLiabilityImage from 'figma:asset/d4773239f38262d45a5cc90213a838df6446dc6c.png';

// ── Partner logos for marquee ─────────────────────────────────────────────────

const partnerLogos = [
  { id: 'discovery',  name: 'Discovery',  logo: discoveryLogo,  est: '1992' },
  { id: 'sanlam',     name: 'Sanlam',     logo: sanlamLogo,     est: '1918' },
  { id: 'momentum',   name: 'Momentum',   logo: momentumLogo,   est: '1966' },
  { id: 'liberty',    name: 'Liberty',    logo: libertyLogo,    est: '1957' },
  { id: 'old-mutual', name: 'Old Mutual', logo: oldMutualLogo,  est: '1845' },
  { id: 'brightrock', name: 'BrightRock', logo: brightRockLogo, est: '2011' },
  { id: 'hollard',    name: 'Hollard',    logo: hollardLogo,    est: '1980' },
];

// ── Tab icons ─────────────────────────────────────────────────────────────────

const INDIVIDUAL_TAB_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'life-cover':         Heart,
  'disability':         UserCheck,
  'severe-illness':     Activity,
  'income-protection':  Banknote,
  'other-benefits':     Crown,
};

const BUSINESS_TAB_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'buy-sell':             Building,
  'key-person':           Users,
  'contingent-liability': Briefcase,
};

// ── Individual cover data ─────────────────────────────────────────────────────

const individualToggleOptions = [
  { id: 'life-cover',        label: 'Life Cover' },
  { id: 'disability',        label: 'Disability' },
  { id: 'severe-illness',    label: 'Severe Illness' },
  { id: 'income-protection', label: 'Income Protection' },
  { id: 'other-benefits',    label: 'Other Benefits' },
];

const individualProducts: Record<string, CoverContent> = {
  'life-cover': {
    title: 'Life Cover',
    description: 'Comprehensive life insurance to protect your family\'s financial future.',
    benefitsDescription: 'Life cover provides essential financial security for your family by ensuring they can maintain their standard of living, pay off outstanding debts, and secure their future even when you\'re no longer there to provide for them.',
    features: [
      { title: 'Death Benefit',        description: 'Lump-sum payout to beneficiaries' },
      { title: 'Terminal Illness',      description: 'Advanced payment if diagnosed with terminal illness' },
      { title: 'Accidental Death',      description: 'Additional cover for accidental death' },
      { title: 'Family Income Benefit', description: 'Regular monthly payments to your family' },
    ],
    benefits: ['Tax-free payout to beneficiaries', 'Coverage from R100,000 to R50 million', 'Premium can remain level for life', 'Option to increase cover at life events'],
    image: lifeCoverImage,
  },
  'disability': {
    title: 'Disability Cover',
    description: 'Lump-sum payout if you become permanently disabled and unable to work.',
    benefitsDescription: 'Capital Disability cover provides a comprehensive lump-sum payout when permanent disability prevents you from working. This single payment gives you immediate access to significant funds to restructure your life, pay off debts, and adapt your living environment.',
    features: [
      { title: 'Capital Disability',      description: 'Lump-sum payment for permanent disability' },
      { title: 'Occupational Disability', description: 'Cover specific to your occupation' },
      { title: 'Functional Disability',   description: 'Based on loss of specific functions' },
      { title: 'Severe Disability',       description: 'Enhanced payout for total and permanent disability' },
    ],
    benefits: ['Up to 75% of annual income as lump sum', 'Immediate access to substantial capital', 'Covers both physical and mental disabilities', 'Worldwide coverage available'],
    image: disabilityCoverImage,
  },
  'severe-illness': {
    title: 'Severe Illness Cover',
    description: 'Financial support when you\'re diagnosed with a critical illness.',
    benefitsDescription: 'Severe illness cover provides vital financial support when you\'re diagnosed with a major medical condition, allowing you to focus entirely on your recovery without financial stress. This ensures you have access to the best possible care.',
    features: [
      { title: 'Critical Illness List', description: 'Coverage for over 60 critical conditions' },
      { title: 'Early Stage Cover',     description: 'Partial payments for early-stage conditions' },
      { title: 'Survival Benefit',      description: 'Additional payment after surviving 12 months' },
      { title: 'Medical Expenses',      description: 'Cover for treatment and medication costs' },
    ],
    benefits: ['Tax-free lump sum payment', 'No restrictions on how funds are used', 'Covers cancer, heart attack, stroke and more', 'Option for buy-back cover after a claim'],
    image: severeIllnessCoverImage,
  },
  'income-protection': {
    title: 'Income Protection',
    description: 'Monthly income replacement if you can\'t work due to illness or injury.',
    benefitsDescription: 'Income protection acts as a financial safety net, providing regular monthly payments when illness or injury prevents you from working. This ensures you can continue to meet your financial obligations and maintain your lifestyle.',
    features: [
      { title: 'Monthly Benefit',    description: 'Regular income replacement payments' },
      { title: 'Waiting Period',     description: 'Choose from 30 days to 24 months' },
      { title: 'Benefit Period',     description: 'Payments until retirement age if needed' },
      { title: 'Partial Disability', description: 'Proportional benefits for reduced capacity' },
    ],
    benefits: ['Up to 75% of gross monthly income', 'Inflation-linked increases available', 'Covers illness and accidental injury', 'Return to work incentives included'],
    image: incomeProtectionImage,
  },
  'other-benefits': {
    title: 'Other Benefits',
    description: 'Additional protection options to complement your core cover.',
    benefitsDescription: 'Additional benefits provide comprehensive protection beyond basic coverage, ensuring you and your family are protected against a wide range of unexpected events. These supplementary benefits offer immediate financial assistance for specific situations.',
    features: [
      { title: 'Future Insurability',  description: 'Increase cover without medical underwriting' },
      { title: 'Premium Waiver',       description: 'Premiums waived if you can\'t work' },
      { title: 'Funeral Cover',        description: 'Immediate funds for funeral expenses' },
      { title: 'Education Protection', description: 'Funds to continue children\'s education' },
    ],
    benefits: ['Guaranteed insurability at life events', 'No medical questions for increases', 'Immediate access to funeral funds', 'Peace of mind for education costs'],
    image: otherBenefitsImage,
  },
};

const individualImageAltMap: Record<string, string> = {
  'life-cover':         'Happy couple in modern kitchen representing life insurance protection',
  'disability':         'Professional in wheelchair representing disability insurance',
  'severe-illness':     'Doctor consulting with patient representing severe illness coverage',
  'income-protection':  'Piggy bank representing income protection insurance',
  'other-benefits':     'Protective hands representing comprehensive family insurance benefits',
};

// ── Business cover data ───────────────────────────────────────────────────────

const businessToggleOptions = [
  { id: 'buy-sell',             label: 'Buy & Sell' },
  { id: 'key-person',           label: 'Key Person' },
  { id: 'contingent-liability', label: 'Contingent Liability' },
];

const businessProducts: Record<string, CoverContent> = {
  'buy-sell': {
    title: 'Buy & Sell Agreements',
    description: 'Ensures smooth transfer of ownership on death or disability of a business partner.',
    benefitsDescription: 'Buy & Sell agreements provide essential business continuity protection by ensuring that surviving partners can acquire the deceased partner\'s share without financial strain. This coverage eliminates potential disputes and protects the business from external parties gaining unwanted control.',
    features: [
      { title: 'Ownership Transfer',  description: 'Funded transfer of shares on death or disability' },
      { title: 'Valuation Agreement', description: 'Pre-agreed business valuation method' },
      { title: 'Trigger Events',      description: 'Cover for death, disability and critical illness' },
      { title: 'Tax Efficiency',      description: 'Structured to minimise estate duty and CGT' },
    ],
    benefits: ['Automatic valuation and transfer process', 'Prevents external parties gaining control', 'Immediate funds for share purchase', 'Protects surviving partners\' interests', 'Maintains business continuity'],
    image: image_654751ca8be2c3a6b86cd56b21742e6d3ec469ec,
  },
  'key-person': {
    title: 'Key Person Insurance',
    description: 'Covers financial loss from death or disability of a key employee or business owner.',
    benefitsDescription: 'Key Person insurance recognises that certain individuals are critical to your business success. When these key people are unable to work, this coverage compensates your business for lost revenue, recruitment costs, and training expenses, maintaining operational stability.',
    features: [
      { title: 'Revenue Protection',  description: 'Compensates for lost profits and income' },
      { title: 'Recruitment Costs',   description: 'Funds to hire and train a replacement' },
      { title: 'Loan Security',       description: 'Protects against business loan defaults' },
      { title: 'Business Continuity', description: 'Maintains operations during transition' },
    ],
    benefits: ['Compensation for lost revenue and profits', 'Funds for recruitment and training costs', 'Protection against business loan defaults', 'Maintains stakeholder confidence', 'Covers operational disruptions'],
    image: keyPersonImage,
  },
  'contingent-liability': {
    title: 'Contingent Liability Cover',
    description: 'Settles business debts and obligations if an owner or guarantor passes away.',
    benefitsDescription: 'Contingent Liability cover protects your business and remaining owners from inherited financial obligations when a business owner or guarantor dies, ensuring that business debts and loans are settled without threatening operations.',
    features: [
      { title: 'Debt Settlement',     description: 'Automatic repayment of guaranteed debts' },
      { title: 'Personal Guarantees', description: 'Covers personally signed loan guarantees' },
      { title: 'Business Loans',      description: 'Protects against bank and creditor claims' },
      { title: 'Asset Protection',    description: 'Prevents forced liquidation of assets' },
    ],
    benefits: ['Automatic settlement of guaranteed debts', 'Protects surviving owners from liability', 'Maintains business credit rating', 'Prevents forced asset liquidation', 'Ensures business stability'],
    image: contingentLiabilityImage,
  },
};

const businessImageAltMap: Record<string, string> = {
  'buy-sell':             'Business risk management strategy meeting',
  'key-person':           'Key person selection representing key person insurance',
  'contingent-liability': 'Hands protecting assets representing contingent liability coverage',
};

// ── Main page ─────────────────────────────────────────────────────────────────

export function RiskManagementPage() {
  const seoData = getSEOData('risk-management');

  useImagePreload([
    outdoorFamilyImage,
    lifeCoverImage, disabilityCoverImage, severeIllnessCoverImage,
    incomeProtectionImage, otherBenefitsImage,
    image_654751ca8be2c3a6b86cd56b21742e6d3ec469ec, keyPersonImage, contingentLiabilityImage,
  ]);

  return (
    <ServicePageTemplate
      seoData={seoData}
      config={{
        seoKey: 'risk-management',

        hero: {
          badgeText: 'Risk Management Solutions',
          titleLine1: 'Protecting What',
          titleLine2: 'Matters Most',
          description: 'Comprehensive risk cover for individuals and businesses. We search the market to find you the best protection at the right price — tailored to your life.',
          heroImage: outdoorFamilyImage,
          heroImageKey: 'risk-hero',
          heroImageAlt: 'Happy family outdoors representing family protection and financial security',
          statusLabel: 'Cover Status',
          statusValue: 'Individuals & Businesses',
          stats: [
            { value: '7+', label: 'Trusted Insurers' },
            { value: '5',  label: 'Cover Types' },
            { value: '3',  label: 'Business Solutions' },
          ],
          quoteLink: '/get-quote/risk-management',
          heroStyle: 'unified',
        },

        individuals: {
          badgeText: 'For Individuals',
          title: 'Risk Cover for Individuals',
          subtitle: 'Tailored protection for you and your family — across every stage of life.',
          tabIcons: INDIVIDUAL_TAB_ICONS,
          toggleOptions: individualToggleOptions,
          products: individualProducts,
          imageAltMap: individualImageAltMap,
          cardIcon: Shield,
          cardLabel: 'Personal Cover',
          quoteLink: '/get-quote/risk-management',
          ariaLabel: 'Risk cover for individuals',
        },

        business: {
          badgeText: 'For Businesses',
          title: 'Risk Cover for Businesses',
          subtitle: 'Safeguarding business continuity, key personnel, and financial obligations — so nothing derails your business.',
          tabIcons: BUSINESS_TAB_ICONS,
          toggleOptions: businessToggleOptions,
          products: businessProducts,
          imageAltMap: businessImageAltMap,
          cardIcon: Briefcase,
          cardLabel: 'Business Cover',
          quoteLink: '/get-quote/risk-management',
          ariaLabel: 'Risk cover for businesses',
        },

        partners: {
          logos: partnerLogos,
        },

        form: {
          specialistType: 'risk management',
          selectLabel: 'Cover Required',
          selectPlaceholder: 'Select your need',
          selectOptions: [
            { value: 'life-cover',         label: 'Life Cover' },
            { value: 'disability-cover',   label: 'Disability Cover' },
            { value: 'severe-illness',     label: 'Severe Illness Cover' },
            { value: 'income-protection',  label: 'Income Protection' },
            { value: 'business-cover',     label: 'Business Cover' },
            { value: 'comprehensive',      label: 'Comprehensive Cover' },
          ],
          textareaPlaceholder: 'Tell us about your risk management requirements and family situation...',
          selectFieldName: 'coverRequired',
        },

        structuredDataOffers: [
          { name: 'Life Cover',               description: 'Lump-sum payout to beneficiaries on death or terminal illness diagnosis.' },
          { name: 'Disability Cover',          description: 'Once-off capital lump sum if permanently disabled and unable to work.' },
          { name: 'Severe Illness Cover',      description: 'Tax-free lump sum on diagnosis of a covered critical illness.' },
          { name: 'Income Protection',         description: 'Monthly income replacement of up to 75% if unable to work.' },
          { name: 'Buy & Sell Agreements',     description: 'Business continuity cover funding ownership transfer on death or disability.' },
          { name: 'Key Person Insurance',      description: 'Protects the business against financial loss from the death or disability of a key employee.' },
          { name: 'Contingent Liability Cover', description: 'Settles guaranteed business debts if an owner or guarantor dies.' },
        ],
        structuredDataServiceType: 'Insurance Advisory',
        structuredDataServiceName: 'Risk Management Insurance',
        breadcrumbs: [
          { name: 'Home',     url: 'https://navigatewealth.co' },
          { name: 'Services', url: 'https://navigatewealth.co/services' },
          { name: 'Risk Management' },
        ],
        preloadImages: [],

        approach: {
          serviceName: 'How We Protect You',
          headerDescription: 'At Navigate Wealth, we follow a proven 3-step methodology to ensure you receive the most appropriate risk management solution that aligns with your needs and budget.',
          steps: [
            {
              step: '1',
              title: 'Ascertain Needs',
              icon: Search,
              description: 'Comprehensive assessment of your unique risk profile, financial situation, and protection requirements.',
              details: [
                'Comprehensive financial analysis',
                'Risk tolerance evaluation',
                'Life stage assessment',
                'Dependency analysis',
                'Current coverage review',
              ],
              color: 'from-blue-500 to-indigo-600',
            },
            {
              step: '2',
              title: 'Provide Advice and Solutions',
              icon: MessageSquare,
              description: 'Tailored risk management solutions with multiple provider options, designed around your specific needs.',
              details: [
                'Customized solution design',
                'Provider comparison analysis',
                'Cost-benefit evaluation',
                'Product feature matching',
                'Implementation roadmap',
              ],
              color: 'from-green-500 to-emerald-600',
            },
            {
              step: '3',
              title: 'Implement Recommendation',
              icon: CheckCircle2,
              description: 'Full explanation, terms review, and ongoing support commitment before any implementation.',
              details: [
                'Detailed explanation of benefits',
                'Terms and conditions review',
                'Premium structure clarification',
                'Claims process walkthrough',
                'Ongoing support commitment',
              ],
              color: 'from-purple-500 to-violet-600',
            },
          ],
          summaryCards: [],
          commitmentText: 'We only proceed when you fully understand your chosen solution and are completely satisfied with your decision. Your peace of mind is our priority.',
        },
      }}
    />
  );
}