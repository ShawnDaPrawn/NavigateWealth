/**
 * EstatePlanningPage — Aligned to RiskManagementPage v3 template
 * via ServicePageTemplate.
 */

import React from 'react';
import { useImagePreload } from '../../hooks/useImagePreload';
import { getSEOData, estatePlanningFAQs } from '../seo/seo-config';
import { ServicePageTemplate, type CoverContent } from '../templates/ServicePageTemplate';
import { Shield, FileText, Users, Building, Heart, Scale, Crown, Briefcase, Search, MessageSquare, CheckCircle2 } from 'lucide-react';
import { capitalLegacyLogo, ewSerfonteinLogo } from '../shared/assets/provider-logos';

import estatePlanningHeroImage from 'figma:asset/5c0f670827aa0d401dd409a6c603459c23b5c4a3.png';
import willsImage from 'figma:asset/8c5fa58881863a67095e8aa29afc660f5cecd4d5.png';
import trustsImage from 'figma:asset/a5b12012f06f21058abb49ed8e43bf599d968395.png';
import successionImage from 'figma:asset/3adf41eeb556dca874c10a95709eda0ec378bf9e.png';
import businessSuccessionImage from 'figma:asset/dc7d1f92bcbe7857fe86f217588dc8719ba5a2f9.png';
const buySellImage = 'https://images.unsplash.com/photo-1710458868515-44426e7c565b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidXklMjBzZWxsJTIwYWdyZWVtZW50fGVufDF8fHx8MTc2MDU2MDIwOXww&ixlib=rb-4.1.0&q=80&w=1080';

const partnerLogos = [
  { id: 'capital-legacy', name: 'Capital Legacy', logo: capitalLegacyLogo, est: '2005' },
  { id: 'ew-serfontein', name: 'EW Serfontein & Associates', logo: ewSerfonteinLogo, est: '1998' },
];

const INDIVIDUAL_TAB_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'wills': FileText,
  'trusts': Shield,
  'succession': Users,
};

const individualToggleOptions = [
  { id: 'wills', label: 'Wills & Testament' },
  { id: 'trusts', label: 'Trust Structures' },
  { id: 'succession', label: 'Succession Planning' },
];

const individualProducts: Record<string, CoverContent> = {
  'wills': {
    title: 'Wills & Testament',
    description: 'Professional will drafting and updates to ensure your wishes are legally documented.',
    benefitsDescription: 'Will drafting ensures your assets are distributed according to your wishes while minimizing legal complications for your beneficiaries. Our comprehensive approach includes guardian appointments, executor selection, and clear asset distribution instructions that comply with South African law.',
    features: [
      { title: 'Legal Drafting', description: 'Professional will preparation by accredited drafters' },
      { title: 'Guardian Appointments', description: 'Nominate guardians for minor children' },
      { title: 'Executor Selection', description: 'Appoint a trusted executor for your estate' },
      { title: 'Regular Updates', description: 'Periodic reviews as circumstances change' },
    ],
    benefits: ['Legal asset distribution', 'Guardian appointments', 'Executor selection', 'Tax-efficient bequests', 'Regular will updates'],
    image: willsImage,
    imageKey: '8c5fa58881863a67095e8aa29afc660f5cecd4d5',
  },
  'trusts': {
    title: 'Trust Structures',
    description: 'Family and inter vivos trusts for asset protection and tax efficiency.',
    benefitsDescription: 'Trust structures provide sophisticated asset protection and tax planning opportunities while ensuring wealth preservation across generations. Our trust solutions offer creditor protection, estate duty savings, and flexible wealth distribution mechanisms.',
    features: [
      { title: 'Asset Protection', description: 'Shield assets from creditor claims' },
      { title: 'Tax Efficiency', description: 'Reduce estate duty and capital gains tax' },
      { title: 'Wealth Preservation', description: 'Multi-generational wealth protection' },
      { title: 'Flexible Distribution', description: 'Customisable beneficiary arrangements' },
    ],
    benefits: ['Asset protection', 'Tax efficiency', 'Creditor protection', 'Wealth preservation', 'Flexible distribution'],
    image: trustsImage,
    imageKey: '689d26eedad1e179b7cb6a7e0aeb42b33aac8696',
  },
  'succession': {
    title: 'Succession Planning',
    description: 'Comprehensive strategies for smooth wealth transfer to beneficiaries.',
    benefitsDescription: 'Succession planning ensures orderly wealth transfer while minimizing taxes and family disputes. Our approach includes generation-skipping strategies, family governance structures, and educational programs for beneficiaries.',
    features: [
      { title: 'Wealth Transfer', description: 'Orderly transfer to the next generation' },
      { title: 'Tax Minimisation', description: 'Reduce tax on wealth transfer' },
      { title: 'Family Governance', description: 'Structured family decision-making' },
      { title: 'Dispute Prevention', description: 'Clear terms to prevent family conflict' },
    ],
    benefits: ['Smooth wealth transfer', 'Tax minimization', 'Family governance', 'Beneficiary preparation', 'Dispute prevention'],
    image: successionImage,
    imageKey: '793671a4751683b2272084a4fbc7762f16d67490',
  },
};

const BUSINESS_TAB_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'business-succession': Building,
  'buy-sell': Briefcase,
};

const businessToggleOptions = [
  { id: 'business-succession', label: 'Business Succession' },
  { id: 'buy-sell', label: 'Buy-Sell Agreements' },
];

const businessProducts: Record<string, CoverContent> = {
  'business-succession': {
    title: 'Business Succession Planning',
    description: 'Comprehensive strategies for business continuity and ownership transfer.',
    benefitsDescription: 'Business succession planning ensures your company continues to thrive after your departure while protecting stakeholder interests. Our approach includes leadership development, ownership transition strategies, and value preservation mechanisms.',
    features: [
      { title: 'Continuity Planning', description: 'Ensure business survives ownership changes' },
      { title: 'Leadership Development', description: 'Prepare successors for leadership roles' },
      { title: 'Value Preservation', description: 'Protect business value during transition' },
      { title: 'Stakeholder Protection', description: 'Safeguard all stakeholder interests' },
    ],
    benefits: ['Business continuity', 'Leadership development', 'Value preservation', 'Stakeholder protection', 'Tax-efficient transfer'],
    image: businessSuccessionImage,
    imageKey: 'dc7d1f92bcbe7857fe86f217588dc8719ba5a2f9',
  },
  'buy-sell': {
    title: 'Buy-Sell Agreements',
    description: 'Legal frameworks for business ownership transfers funded by insurance.',
    benefitsDescription: 'Buy-sell agreements provide a structured legal framework that defines how business interests are transferred on the death or disability of a partner. Funded by life insurance, these agreements ensure surviving partners can acquire the deceased partner\'s share without financial strain.',
    features: [
      { title: 'Ownership Transfer', description: 'Funded transfer of shares on death or disability' },
      { title: 'Valuation Method', description: 'Pre-agreed business valuation formula' },
      { title: 'Insurance Funding', description: 'Life insurance funds the share purchase' },
      { title: 'Tax Efficiency', description: 'Structured to minimise estate duty and CGT' },
    ],
    benefits: ['Automatic valuation and transfer', 'Prevents external parties gaining control', 'Immediate funds for share purchase', 'Protects surviving partners', 'Maintains business continuity'],
    image: buySellImage,
    imageKey: 'c6ebf07ce2d2b7d5973be0c78b41cc2d3efbcf39',
  },
};

export function EstatePlanningPage() {
  useImagePreload([
    estatePlanningHeroImage,
    willsImage, trustsImage, successionImage,
    businessSuccessionImage, buySellImage,
  ]);

  const seoData = getSEOData('estate-planning');

  return (
    <ServicePageTemplate
      seoData={seoData}
      config={{
        seoKey: 'estate-planning',
        hero: {
          badgeText: 'Estate Planning Solutions',
          titleLine1: 'Protect Your',
          titleLine2: 'Legacy',
          description: 'Comprehensive estate planning for individuals and businesses — wills, trusts, succession planning, and business continuity from accredited specialists.',
          heroImage: estatePlanningHeroImage,
          heroImageKey: 'estate-hero',
          heroImageAlt: 'Estate planning consultation representing wealth transfer and legacy protection',
          statusLabel: 'Estate Planning',
          statusValue: 'Individuals & Businesses',
          quoteLink: '/get-quote/estate-planning/contact',
          heroStyle: 'unified',
          stats: [
            { value: '2+', label: 'Trusted Partners' },
            { value: '3', label: 'Individual Services' },
            { value: '2', label: 'Business Solutions' },
          ],
        },
        individuals: {
          badgeText: 'For Individuals',
          title: 'Estate Planning for Individuals',
          subtitle: 'Ensure your wishes are honoured and your family is protected.',
          tabIcons: INDIVIDUAL_TAB_ICONS,
          toggleOptions: individualToggleOptions,
          products: individualProducts,
          imageAltMap: {
            'wills': 'Professional will drafting and testament preparation',
            'trusts': 'Trust structure design for asset protection',
            'succession': 'Succession planning for smooth wealth transfer',
          },
          cardIcon: Heart,
          cardLabel: 'Personal Estate',
          quoteLink: '/get-quote/estate-planning/contact',
        },
        business: {
          badgeText: 'For Businesses',
          title: 'Estate Planning for Businesses',
          subtitle: 'Ensure business continuity and smooth ownership transfer.',
          tabIcons: BUSINESS_TAB_ICONS,
          toggleOptions: businessToggleOptions,
          products: businessProducts,
          imageAltMap: {
            'business-succession': 'Business succession planning and ownership continuity',
            'buy-sell': 'Buy-sell agreement for business partner ownership transfer',
          },
          cardIcon: Briefcase,
          cardLabel: 'Business Estate',
          quoteLink: '/get-quote/estate-planning/contact',
        },
        partners: {
          logos: partnerLogos,
          heading: 'We work with trusted estate planning partners',
          subHeading: 'Trusted Estate Partners',
        },
        form: {
          specialistType: 'estate planning',
          selectLabel: 'Estate Need',
          selectPlaceholder: 'Select your need',
          selectFieldName: 'estateNeed',
          selectOptions: [
            { value: 'will-drafting', label: 'Will Drafting' },
            { value: 'trust-setup', label: 'Trust Structure Setup' },
            { value: 'succession', label: 'Succession Planning' },
            { value: 'business-succession', label: 'Business Succession' },
            { value: 'buy-sell', label: 'Buy-Sell Agreement' },
            { value: 'estate-review', label: 'Estate Plan Review' },
            { value: 'consultation', label: 'General Consultation' },
          ],
          textareaPlaceholder: 'Tell us about your estate planning requirements and family situation...',
        },
        structuredDataServiceName: 'Estate Planning',
        structuredDataServiceType: 'Estate Planning Advisory',
        structuredDataOffers: [
          { name: 'Wills & Testament', description: 'Professional will drafting and updates.' },
          { name: 'Trust Structures', description: 'Family and inter vivos trusts for asset protection.' },
          { name: 'Succession Planning', description: 'Comprehensive wealth transfer strategies.' },
          { name: 'Business Succession Planning', description: 'Strategies for business continuity and ownership transfer.' },
          { name: 'Buy-Sell Agreements', description: 'Legal frameworks for business ownership transfers.' },
        ],
        breadcrumbs: [
          { name: 'Home', url: 'https://www.navigatewealth.co' },
          { name: 'Services', url: 'https://www.navigatewealth.co/services' },
          { name: 'Estate Planning' },
        ],
        preloadImages: [],
        faqs: estatePlanningFAQs,
        approach: {
          serviceName: 'How We Protect Your Legacy',
          headerDescription: 'At Navigate Wealth, we follow a proven methodology to ensure your estate plan comprehensively protects your family and preserves your legacy.',
          steps: [
            {
              step: '1',
              title: 'Estate Assessment',
              icon: Search,
              description: 'We conduct a thorough review of your assets, liabilities, family structure, and existing estate plan to identify gaps and opportunities.',
              details: ['Asset and liability audit', 'Family structure analysis', 'Existing will and trust review', 'Estate duty exposure assessment', 'Beneficiary mapping'],
              color: 'from-blue-500 to-indigo-600',
            },
            {
              step: '2',
              title: 'Plan Design',
              icon: MessageSquare,
              description: 'Based on your assessment, we design a comprehensive estate plan with optimal structures for tax efficiency and family protection.',
              details: ['Will drafting and updates', 'Trust structure recommendations', 'Succession strategy design', 'Estate duty minimisation', 'Liquidity planning'],
              color: 'from-green-500 to-emerald-600',
            },
            {
              step: '3',
              title: 'Implement & Maintain',
              icon: CheckCircle2,
              description: 'We implement your estate plan and provide ongoing reviews to ensure it remains aligned with your changing circumstances.',
              details: ['Document execution', 'Trust establishment', 'Annual estate reviews', 'Life event adjustments', 'Executor briefing'],
              color: 'from-purple-500 to-violet-600',
            },
          ],
          summaryCards: [],
          commitmentText: 'We ensure your estate plan is comprehensive, legally sound, and updated as your life evolves. Protecting your family is our commitment.',
        },
      }}
    />
  );
}