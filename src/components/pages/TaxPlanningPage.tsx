/**
 * TaxPlanningPage — Aligned to RiskManagementPage v3 template
 * via ServicePageTemplate.
 */

import { profinLogo } from '../shared/assets/provider-logos';
import React from 'react';
import { useImagePreload } from '../../hooks/useImagePreload';
import { getSEOData } from '../seo/seo-config';
import { ServicePageTemplate, type CoverContent } from '../templates/ServicePageTemplate';
import { Calculator, Shield, FileText, Building, PiggyBank, DollarSign, Briefcase, Target, Search, MessageSquare, CheckCircle2 } from 'lucide-react';

import taxPlanningHeroImage from 'figma:asset/7f33deddff0f6240cb18dcef045f830436c30355.png';
import personalTaxImage from 'figma:asset/92b794db8aaf43fddd94915592627908c2f21176.png';
const investmentTaxImage = 'https://images.unsplash.com/photo-1727072206145-bf6f47befe9b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbnZlc3RtZW50JTIwdGF4JTIwc3RyYXRlZ3l8ZW58MXx8fHwxNzYwNTYwMjA1fDA&ixlib=rb-4.1.0&q=80&w=1080';
import retirementTaxImage from 'figma:asset/3d217dec77363c6bc2c7322ec7ce8c6e59f53f53.png';
import estateTaxImage from 'figma:asset/e7d418f9f6e2453bebdad7920dc5d338fc768fd4.png';
import individualComplianceImage from 'figma:asset/db05bf347ddb2b3ee326a6593ba2e53e220a8b57.png';
import corporateTaxImage from 'figma:asset/f418e978309128b782201b6c4f142b6e0a20d482.png';
import payrollTaxImage from 'figma:asset/74818eb79f7881c1d63c16c0c2426eec343dfd42.png';
import complianceTaxImage from 'figma:asset/793671a4751683b2272084a4fbc7762f16d67490.png';

const partnerLogos = [
  { id: 'profin', name: 'Profin Accounting', logo: profinLogo, est: '2010' },
];

const INDIVIDUAL_TAB_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'personal': Calculator,
  'investment': DollarSign,
  'retirement': PiggyBank,
  'estate': Shield,
  'compliance': FileText,
};

const individualToggleOptions = [
  { id: 'personal', label: 'Personal Tax' },
  { id: 'investment', label: 'Investment Tax' },
  { id: 'retirement', label: 'Retirement Tax' },
  { id: 'estate', label: 'Estate Tax' },
  { id: 'compliance', label: 'Tax Compliance' },
];

const individualProducts: Record<string, CoverContent> = {
  'personal': {
    title: 'Personal Tax Planning',
    description: 'Comprehensive personal tax optimization strategies to minimize your annual tax liability.',
    benefitsDescription: 'Personal tax planning focuses on maximizing legitimate deductions, utilizing tax-efficient investment structures, and implementing strategic timing of income and expenses. Our approach ensures you comply with all SARS requirements while minimizing your annual tax burden through careful planning and strategic decision-making.',
    features: [
      { title: 'Deduction Maximisation', description: 'Identify and claim all allowable deductions' },
      { title: 'Tax-Efficient Structures', description: 'Optimise investment and income structures' },
      { title: 'Strategic Timing', description: 'Plan income and expenses for best tax outcome' },
      { title: 'SARS Compliance', description: 'Full compliance with all SARS requirements' },
    ],
    benefits: ['Maximize allowable deductions', 'Optimize tax-efficient investments', 'Strategic income and expense timing', 'SARS compliance assurance', 'Year-round tax advisory support'],
    image: personalTaxImage,
  },
  'investment': {
    title: 'Investment Tax Strategies',
    description: 'Tax-efficient investment structures and capital gains optimization strategies.',
    benefitsDescription: 'Investment tax strategies focus on structuring your investment portfolio to minimize tax implications while maximizing after-tax returns. Our approach includes capital gains tax planning, offshore investment structuring, and utilizing tax-advantaged investment vehicles to optimize your wealth accumulation.',
    features: [
      { title: 'CGT Planning', description: 'Capital gains tax optimisation strategies' },
      { title: 'Tax-Free Vehicles', description: 'Utilise TFSAs and endowments' },
      { title: 'Offshore Structuring', description: 'International investment tax planning' },
      { title: 'Portfolio Efficiency', description: 'Tax-efficient portfolio construction' },
    ],
    benefits: ['Capital gains tax optimization', 'Tax-efficient investment structures', 'Offshore investment planning', 'Tax-advantaged vehicle utilization', 'Portfolio tax efficiency analysis'],
    image: investmentTaxImage,
  },
  'retirement': {
    title: 'Retirement Tax Planning',
    description: 'Maximize retirement contributions and optimize tax benefits for your future.',
    benefitsDescription: 'Retirement tax planning ensures you maximize tax deductions on retirement contributions while structuring your retirement savings for optimal tax efficiency. Our strategies help you take full advantage of retirement annuity deductions and plan for tax-efficient retirement income.',
    features: [
      { title: 'Contribution Limits', description: 'Maximise allowable RA deductions' },
      { title: 'Tax-Free Growth', description: 'Optimise tax-sheltered retirement growth' },
      { title: 'Income Planning', description: 'Tax-efficient retirement income strategies' },
      { title: 'Preservation Strategy', description: 'Optimal preservation fund planning' },
    ],
    benefits: ['Maximize retirement deductions', 'Optimize retirement contributions', 'Tax-efficient retirement structuring', 'Future income tax planning', 'Preservation fund strategies'],
    image: retirementTaxImage,
  },
  'estate': {
    title: 'Estate Tax Planning',
    description: 'Minimize estate duty and optimize succession planning for your heirs.',
    benefitsDescription: 'Estate tax planning focuses on minimizing estate duty and ensuring smooth wealth transfer to future generations. Our strategies include utilizing annual exemptions, implementing trust structures, and optimizing donation strategies to reduce the overall tax burden on your estate.',
    features: [
      { title: 'Estate Duty', description: 'Minimise estate duty exposure' },
      { title: 'Trust Structures', description: 'Optimise trust arrangements for tax' },
      { title: 'Donation Strategy', description: 'Strategic use of annual exemptions' },
      { title: 'Succession Planning', description: 'Tax-efficient wealth transfer' },
    ],
    benefits: ['Estate duty minimization', 'Trust structure optimization', 'Donation strategy planning', 'Succession planning support', 'Annual exemption utilization'],
    image: estateTaxImage,
  },
  'compliance': {
    title: 'Tax Compliance & Returns',
    description: 'Professional tax return preparation and comprehensive SARS compliance management.',
    benefitsDescription: 'Tax compliance services ensure accurate and timely submission of all tax returns while maintaining full compliance with SARS regulations. Our comprehensive approach includes ongoing compliance monitoring, professional return preparation, and proactive communication with SARS when necessary.',
    features: [
      { title: 'Return Preparation', description: 'Professional annual return filing' },
      { title: 'Timely Submission', description: 'Never miss a SARS deadline' },
      { title: 'Compliance Monitoring', description: 'Ongoing regulatory compliance checks' },
      { title: 'Audit Support', description: 'SARS audit representation and support' },
    ],
    benefits: ['Professional return preparation', 'Timely submission assurance', 'SARS compliance monitoring', 'Audit support and representation', 'Ongoing regulatory updates'],
    image: individualComplianceImage,
  },
};

const BUSINESS_TAB_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'corporate': Building,
  'payroll': Target,
  'structures': Briefcase,
};

const businessToggleOptions = [
  { id: 'corporate', label: 'Corporate Tax' },
  { id: 'payroll', label: 'VAT & Payroll' },
  { id: 'structures', label: 'Tax Structures' },
];

const businessProducts: Record<string, CoverContent> = {
  'corporate': {
    title: 'Corporate Tax Strategies',
    description: 'Comprehensive corporate tax optimization to minimize business tax liability.',
    benefitsDescription: 'Corporate tax strategies focus on optimizing your business tax structure through strategic planning, expense optimization, and timing strategies. Our approach ensures maximum deductions while maintaining full compliance with corporate tax regulations and SARS requirements.',
    features: [
      { title: 'Tax Minimisation', description: 'Reduce corporate tax liability legally' },
      { title: 'Expense Optimisation', description: 'Strategic expense and deduction planning' },
      { title: 'Structure Review', description: 'Optimal corporate structure for tax' },
      { title: 'SARS Compliance', description: 'Full corporate tax compliance' },
    ],
    benefits: ['Corporate tax liability minimization', 'Strategic expense optimization', 'Deduction maximization strategies', 'Corporate structure optimization', 'SARS compliance management'],
    image: corporateTaxImage,
  },
  'payroll': {
    title: 'VAT & Payroll Tax Management',
    description: 'Professional management of VAT, PAYE, UIF, and SDL obligations.',
    benefitsDescription: 'VAT and payroll tax management provides comprehensive handling of all employment-related taxes and VAT obligations. Our services include accurate PAYE calculations, VAT return preparation, and compliance with UIF and SDL requirements, ensuring your business meets all statutory obligations.',
    features: [
      { title: 'PAYE Calculations', description: 'Accurate monthly PAYE processing' },
      { title: 'VAT Returns', description: 'Professional VAT return preparation' },
      { title: 'UIF & SDL', description: 'Statutory compliance management' },
      { title: 'Monthly Submissions', description: 'Timely statutory submissions' },
    ],
    benefits: ['Accurate PAYE calculations', 'VAT return preparation', 'UIF and SDL compliance', 'Monthly submission management', 'Payroll tax optimization'],
    image: payrollTaxImage,
  },
  'structures': {
    title: 'Tax-Efficient Business Structures',
    description: 'Design optimal business structures for maximum tax efficiency.',
    benefitsDescription: 'Tax-efficient business structuring involves designing the optimal legal and operational framework for your business to minimize tax liability while supporting operational requirements. Our approach includes entity selection, shareholding structures, and intercompany arrangements.',
    features: [
      { title: 'Entity Selection', description: 'Optimal legal entity for your business' },
      { title: 'Shareholding', description: 'Tax-efficient shareholding structures' },
      { title: 'Intercompany', description: 'Optimised intercompany arrangements' },
      { title: 'Growth Planning', description: 'Tax-efficient future growth planning' },
    ],
    benefits: ['Optimal entity structure design', 'Shareholding optimization', 'Intercompany arrangement planning', 'Operational tax efficiency', 'Future growth tax planning'],
    image: complianceTaxImage,
  },
};

export function TaxPlanningPage() {
  useImagePreload([
    taxPlanningHeroImage,
    personalTaxImage, investmentTaxImage, retirementTaxImage, estateTaxImage, individualComplianceImage,
    corporateTaxImage, payrollTaxImage, complianceTaxImage,
  ]);

  const seoData = getSEOData('tax-planning');

  return (
    <ServicePageTemplate
      seoData={seoData}
      config={{
        seoKey: 'tax-planning',
        hero: {
          badgeText: 'Tax Planning Solutions',
          titleLine1: 'Maximize Your',
          titleLine2: 'Tax Efficiency',
          description: 'Expert tax planning strategies to minimize your tax burden and maximize your wealth — for individuals and businesses.',
          heroImage: taxPlanningHeroImage,
          heroImageAlt: 'Professional tax planning consultation representing strategic tax optimisation',
          statusLabel: 'Tax Planning',
          statusValue: 'Individuals & Businesses',
          quoteLink: '/get-quote/tax-planning',
          heroStyle: 'unified',
          stats: [
            { value: '1+', label: 'Trusted Partner' },
            { value: '5', label: 'Individual Services' },
            { value: '3', label: 'Business Solutions' },
          ],
        },
        individuals: {
          badgeText: 'For Individuals',
          title: 'Tax Planning for Individuals',
          subtitle: 'Strategic tax optimization to minimize your personal tax liability.',
          tabIcons: INDIVIDUAL_TAB_ICONS,
          toggleOptions: individualToggleOptions,
          products: individualProducts,
          imageAltMap: {
            'personal': 'Personal tax planning and deduction optimization',
            'investment': 'Investment tax strategy and capital gains planning',
            'retirement': 'Retirement tax planning and contribution optimization',
            'estate': 'Estate tax planning and duty minimization',
            'compliance': 'Tax compliance and SARS return preparation',
          },
          cardIcon: Calculator,
          cardLabel: 'Personal Tax',
          quoteLink: '/get-quote/tax-planning',
        },
        business: {
          badgeText: 'For Businesses',
          title: 'Tax Planning for Businesses',
          subtitle: 'Comprehensive corporate tax optimization and compliance management.',
          tabIcons: BUSINESS_TAB_ICONS,
          toggleOptions: businessToggleOptions,
          products: businessProducts,
          imageAltMap: {
            'corporate': 'Corporate tax strategy and business optimization',
            'payroll': 'VAT and payroll tax management for businesses',
            'structures': 'Tax-efficient business structure design',
          },
          cardIcon: Briefcase,
          cardLabel: 'Business Tax',
          quoteLink: '/get-quote/tax-planning',
        },
        partners: {
          logos: partnerLogos,
          heading: 'We work with trusted tax and accounting partners',
          subHeading: 'Trusted Tax Partners',
        },
        form: {
          specialistType: 'tax planning',
          selectLabel: 'Tax Need',
          selectPlaceholder: 'Select your need',
          selectFieldName: 'taxNeed',
          selectOptions: [
            { value: 'personal-tax', label: 'Personal Tax Planning' },
            { value: 'investment-tax', label: 'Investment Tax Strategy' },
            { value: 'retirement-tax', label: 'Retirement Tax Planning' },
            { value: 'estate-tax', label: 'Estate Tax Planning' },
            { value: 'corporate-tax', label: 'Corporate Tax Strategy' },
            { value: 'compliance', label: 'Tax Compliance & Returns' },
            { value: 'consultation', label: 'General Consultation' },
          ],
          textareaPlaceholder: 'Tell us about your tax planning requirements...',
        },
        structuredDataServiceName: 'Tax Planning & Optimisation',
        structuredDataServiceType: 'Tax Advisory',
        structuredDataOffers: [
          { name: 'Personal Tax Planning', description: 'Comprehensive personal tax optimization strategies.' },
          { name: 'Investment Tax Strategies', description: 'Tax-efficient investment structures and CGT optimization.' },
          { name: 'Retirement Tax Planning', description: 'Maximize retirement contributions and tax benefits.' },
          { name: 'Estate Tax Planning', description: 'Minimize estate duty and optimize succession planning.' },
          { name: 'Tax Compliance & Returns', description: 'Professional tax return preparation and SARS compliance.' },
          { name: 'Corporate Tax Strategies', description: 'Corporate tax optimization and compliance.' },
          { name: 'VAT & Payroll Tax Management', description: 'Professional management of VAT, PAYE, UIF, and SDL.' },
          { name: 'Tax-Efficient Business Structures', description: 'Design optimal business structures for tax efficiency.' },
        ],
        breadcrumbs: [
          { name: 'Home', url: 'https://navigatewealth.co' },
          { name: 'Services', url: 'https://navigatewealth.co/services' },
          { name: 'Tax Planning' },
        ],
        preloadImages: [],
        approach: {
          serviceName: 'How We Optimise Your Tax',
          headerDescription: 'At Navigate Wealth, we follow a structured approach to ensure your tax strategy is comprehensive, compliant, and optimised for your financial situation.',
          steps: [
            {
              step: '1',
              title: 'Review & Analyse',
              icon: Search,
              description: 'We conduct a thorough review of your current tax position, income structure, and existing deductions to identify opportunities.',
              details: ['Current tax position analysis', 'Income structure review', 'Deduction audit', 'Investment tax efficiency assessment', 'Compliance status check'],
              color: 'from-blue-500 to-indigo-600',
            },
            {
              step: '2',
              title: 'Strategy & Solutions',
              icon: MessageSquare,
              description: 'We design tailored tax strategies using legitimate optimisation structures, deductions, and timing strategies.',
              details: ['Customised tax strategy', 'Deduction maximisation plan', 'Tax-efficient restructuring', 'Investment vehicle recommendations', 'Compliance roadmap'],
              color: 'from-green-500 to-emerald-600',
            },
            {
              step: '3',
              title: 'Implement & Monitor',
              icon: CheckCircle2,
              description: 'We implement your tax strategy and provide ongoing monitoring to ensure continued compliance and optimisation.',
              details: ['Strategy implementation', 'Return preparation and filing', 'SARS communication management', 'Annual review and adjustment', 'Regulatory change updates'],
              color: 'from-purple-500 to-violet-600',
            },
          ],
          summaryCards: [],
          commitmentText: 'We ensure full SARS compliance while maximising every legitimate tax benefit available to you. Your financial wellbeing guides our approach.',
        },
      }}
    />
  );
}