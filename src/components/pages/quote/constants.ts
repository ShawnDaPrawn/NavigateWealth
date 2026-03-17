/**
 * Get a Quote Flow — Constants & Service Configuration
 *
 * Centralised config for all quote-eligible services.
 * Provider lists mirror the partnerLogos arrays from each service page.
 *
 * §5.3 — Centralised constants and configuration
 * §5.4 — Provider data sourced from service pages
 */

import {
  allanGrayLogo,
  brightRockLogo,
  capitalLegacyLogo,
  discoveryLogo,
  ewSerfonteinLogo,
  hollardLogo,
  inn8Logo,
  justLogo,
  libertyLogo,
  momentumLogo,
  oldMutualLogo,
  sanlamLogo,
  stanlibLogo,
  sygniaLogo,
} from '../../shared/assets/provider-logos';

import type { QuoteServiceConfig, QuoteServiceId, QuoteProvider } from './types';

// ── Provider registries per service ───────────────────────────────────────────

const RISK_PROVIDERS: QuoteProvider[] = [
  { id: 'discovery', name: 'Discovery', logo: discoveryLogo },
  { id: 'sanlam', name: 'Sanlam', logo: sanlamLogo },
  { id: 'momentum', name: 'Momentum', logo: momentumLogo },
  { id: 'liberty', name: 'Liberty', logo: libertyLogo },
  { id: 'old-mutual', name: 'Old Mutual', logo: oldMutualLogo },
  { id: 'brightrock', name: 'BrightRock', logo: brightRockLogo },
  { id: 'hollard', name: 'Hollard', logo: hollardLogo },
];

const MEDICAL_PROVIDERS: QuoteProvider[] = [
  { id: 'discovery-health', name: 'Discovery Health', logo: discoveryLogo },
  { id: 'momentum-health', name: 'Momentum Health', logo: momentumLogo },
];

const RETIREMENT_PROVIDERS: QuoteProvider[] = [
  { id: 'allan-gray', name: 'Allan Gray', logo: allanGrayLogo },
  { id: 'sygnia', name: 'Sygnia', logo: sygniaLogo },
  { id: 'brightrock', name: 'BrightRock', logo: brightRockLogo },
  { id: 'hollard', name: 'Hollard', logo: hollardLogo },
  { id: 'discovery', name: 'Discovery', logo: discoveryLogo },
  { id: 'liberty', name: 'Liberty', logo: libertyLogo },
  { id: 'stanlib', name: 'Stanlib', logo: stanlibLogo },
  { id: 'inn8', name: 'INN8', logo: inn8Logo },
  { id: 'old-mutual', name: 'Old Mutual', logo: oldMutualLogo },
  { id: 'sanlam', name: 'Sanlam', logo: sanlamLogo },
  { id: 'momentum', name: 'Momentum', logo: momentumLogo },
  { id: 'just', name: 'JUST', logo: justLogo },
  { id: 'capital-legacy', name: 'Capital Legacy', logo: capitalLegacyLogo },
];

const INVESTMENT_PROVIDERS: QuoteProvider[] = [
  { id: 'allan-gray', name: 'Allan Gray', logo: allanGrayLogo },
  { id: 'sygnia', name: 'Sygnia', logo: sygniaLogo },
  { id: 'discovery', name: 'Discovery', logo: discoveryLogo },
  { id: 'liberty', name: 'Liberty', logo: libertyLogo },
  { id: 'stanlib', name: 'Stanlib', logo: stanlibLogo },
  { id: 'inn8', name: 'INN8', logo: inn8Logo },
  { id: 'old-mutual', name: 'Old Mutual', logo: oldMutualLogo },
  { id: 'sanlam', name: 'Sanlam', logo: sanlamLogo },
  { id: 'momentum', name: 'Momentum', logo: momentumLogo },
  { id: 'just', name: 'JUST', logo: justLogo },
];

const EMPLOYEE_BENEFITS_PROVIDERS: QuoteProvider[] = [
  { id: 'discovery', name: 'Discovery', logo: discoveryLogo },
  { id: 'momentum', name: 'Momentum', logo: momentumLogo },
  { id: 'liberty', name: 'Liberty', logo: libertyLogo },
  { id: 'brightrock', name: 'BrightRock', logo: brightRockLogo },
  { id: 'sanlam', name: 'Sanlam', logo: sanlamLogo },
  { id: 'old-mutual', name: 'Old Mutual', logo: oldMutualLogo },
  { id: 'allan-gray', name: 'Allan Gray', logo: allanGrayLogo },
  { id: 'sygnia', name: 'Sygnia', logo: sygniaLogo },
  { id: 'hollard', name: 'Hollard', logo: hollardLogo },
  { id: 'stanlib', name: 'Stanlib', logo: stanlibLogo },
  { id: 'inn8', name: 'INN8', logo: inn8Logo },
  { id: 'just', name: 'JUST', logo: justLogo },
  { id: 'capital-legacy', name: 'Capital Legacy', logo: capitalLegacyLogo },
];

const ESTATE_PROVIDERS: QuoteProvider[] = [
  { id: 'capital-legacy', name: 'Capital Legacy', logo: capitalLegacyLogo },
  { id: 'ew-serfontein', name: 'EW Serfontein & Associates', logo: ewSerfonteinLogo },
];

// Tax planning is in-house — no external provider logos
const TAX_PROVIDERS: QuoteProvider[] = [];

// ── Service configurations ────────────────────────────────────────────────────

export const QUOTE_SERVICES: QuoteServiceConfig[] = [
  {
    id: 'risk-management',
    label: 'Risk Management',
    shortLabel: 'Risk',
    icon: 'Shield',
    description: 'Life cover, disability, severe illness & income protection',
    heroDescription: 'Protect what matters most with comprehensive risk management solutions. Our independent advisers compare options from South Africa\'s leading insurers to find the best cover for your unique needs and budget.',
    providers: RISK_PROVIDERS,
    accentColor: '#6d28d9',
    productFields: [
      {
        id: 'coverType',
        label: 'Type of cover needed',
        type: 'select',
        required: true,
        options: [
          { value: 'life-cover', label: 'Life Cover' },
          { value: 'disability', label: 'Disability Cover' },
          { value: 'severe-illness', label: 'Severe Illness Cover' },
          { value: 'income-protection', label: 'Income Protection' },
          { value: 'comprehensive', label: 'Comprehensive Package' },
          { value: 'business-risk', label: 'Business Risk / Key Person' },
        ],
      },
      {
        id: 'smoker',
        label: 'Smoker status',
        type: 'select',
        required: true,
        options: [
          { value: 'non-smoker', label: 'Non-smoker' },
          { value: 'smoker', label: 'Smoker' },
        ],
      },
      {
        id: 'age',
        label: 'Current age',
        type: 'number',
        placeholder: 'e.g. 35',
        required: true,
      },
      {
        id: 'monthlyIncome',
        label: 'Gross monthly income (R)',
        type: 'text',
        placeholder: 'e.g. 45 000',
        required: false,
      },
    ],
  },
  {
    id: 'medical-aid',
    label: 'Medical Aid',
    shortLabel: 'Medical',
    icon: 'Stethoscope',
    description: 'Medical schemes, gap cover & health insurance',
    heroDescription: 'Find the right medical aid for you and your family. We compare plans across South Africa\'s leading medical schemes to match your healthcare needs, budget, and preferred hospital network.',
    providers: MEDICAL_PROVIDERS,
    accentColor: '#0891b2',
    productFields: [
      {
        id: 'coverageType',
        label: 'Coverage type',
        type: 'select',
        required: true,
        options: [
          { value: 'individual', label: 'Individual' },
          { value: 'individual-spouse', label: 'Individual + Spouse' },
          { value: 'family', label: 'Family' },
          { value: 'parent', label: 'Parent(s) Only' },
        ],
      },
      {
        id: 'dependants',
        label: 'Number of dependants',
        type: 'select',
        required: true,
        options: [
          { value: '0', label: '0' },
          { value: '1', label: '1' },
          { value: '2', label: '2' },
          { value: '3', label: '3' },
          { value: '4', label: '4' },
          { value: '5+', label: '5+' },
        ],
      },
      {
        id: 'currentScheme',
        label: 'Current medical scheme (if any)',
        type: 'text',
        placeholder: 'e.g. Discovery Health',
        required: false,
      },
      {
        id: 'monthlyBudget',
        label: 'Monthly budget (R)',
        type: 'text',
        placeholder: 'e.g. 5 000',
        required: false,
      },
    ],
  },
  {
    id: 'retirement-planning',
    label: 'Retirement Planning',
    shortLabel: 'Retirement',
    icon: 'Target',
    description: 'Retirement annuities, pensions & living annuities',
    heroDescription: 'Build a secure financial future with tailored retirement planning. From retirement annuities to living annuities, we\'ll help you create a plan that ensures you can maintain your lifestyle in retirement.',
    providers: RETIREMENT_PROVIDERS,
    accentColor: '#059669',
    productFields: [
      {
        id: 'age',
        label: 'Current age',
        type: 'number',
        placeholder: 'e.g. 35',
        required: true,
      },
      {
        id: 'retirementAge',
        label: 'Target retirement age',
        type: 'number',
        placeholder: 'e.g. 65',
        required: true,
      },
      {
        id: 'monthlyContribution',
        label: 'Monthly contribution budget (R)',
        type: 'text',
        placeholder: 'e.g. 5 000',
        required: false,
      },
      {
        id: 'existingFunds',
        label: 'Existing retirement savings (R)',
        type: 'text',
        placeholder: 'e.g. 500 000',
        required: false,
      },
    ],
  },
  {
    id: 'investment-management',
    label: 'Investment Management',
    shortLabel: 'Investments',
    icon: 'TrendingUp',
    description: 'Unit trusts, offshore, tax-free savings & more',
    heroDescription: 'Grow your wealth with professional investment management. Our experienced advisers create diversified strategies aligned with your risk tolerance, time horizon, and financial goals.',
    providers: INVESTMENT_PROVIDERS,
    accentColor: '#7c3aed',
    productFields: [
      {
        id: 'investmentType',
        label: 'Investment type',
        type: 'select',
        required: true,
        options: [
          { value: 'lump-sum', label: 'Lump Sum Investment' },
          { value: 'monthly', label: 'Monthly Recurring' },
          { value: 'both', label: 'Both Lump Sum & Monthly' },
          { value: 'tax-free', label: 'Tax-Free Savings' },
          { value: 'offshore', label: 'Offshore Investment' },
        ],
      },
      {
        id: 'investmentAmount',
        label: 'Investment amount (R)',
        type: 'text',
        placeholder: 'e.g. 100 000',
        required: true,
      },
      {
        id: 'investmentHorizon',
        label: 'Investment horizon',
        type: 'select',
        required: true,
        options: [
          { value: '1-3', label: '1–3 years' },
          { value: '3-5', label: '3–5 years' },
          { value: '5-10', label: '5–10 years' },
          { value: '10+', label: '10+ years' },
        ],
      },
      {
        id: 'riskAppetite',
        label: 'Risk appetite',
        type: 'select',
        required: false,
        options: [
          { value: 'conservative', label: 'Conservative' },
          { value: 'moderate', label: 'Moderate' },
          { value: 'aggressive', label: 'Aggressive' },
        ],
      },
    ],
  },
  {
    id: 'employee-benefits',
    label: 'Employee Benefits',
    shortLabel: 'Group Benefits',
    icon: 'Briefcase',
    description: 'Group life, retirement funds & employee wellness',
    heroDescription: 'Attract and retain top talent with comprehensive employee benefit solutions. From group life cover to retirement funds, we\'ll design a benefits package that meets your company\'s needs and budget.',
    providers: EMPLOYEE_BENEFITS_PROVIDERS,
    accentColor: '#d97706',
    productFields: [
      {
        id: 'companyName',
        label: 'Company name',
        type: 'text',
        placeholder: 'e.g. ABC Company (Pty) Ltd',
        required: true,
      },
      {
        id: 'employeeCount',
        label: 'Number of employees',
        type: 'select',
        required: true,
        options: [
          { value: '1-10', label: '1–10' },
          { value: '11-50', label: '11–50' },
          { value: '51-100', label: '51–100' },
          { value: '101-500', label: '101–500' },
          { value: '500+', label: '500+' },
        ],
      },
      {
        id: 'industry',
        label: 'Industry',
        type: 'text',
        placeholder: 'e.g. Financial Services',
        required: false,
      },
      {
        id: 'benefitsRequired',
        label: 'Benefits required',
        type: 'select',
        required: true,
        options: [
          { value: 'group-life', label: 'Group Life Cover' },
          { value: 'group-retirement', label: 'Group Retirement Fund' },
          { value: 'group-medical', label: 'Group Medical Aid' },
          { value: 'group-disability', label: 'Group Disability' },
          { value: 'comprehensive', label: 'Comprehensive Package' },
          { value: 'wellness', label: 'Wellness Programme' },
        ],
      },
    ],
  },
  {
    id: 'tax-planning',
    label: 'Tax Planning',
    shortLabel: 'Tax',
    icon: 'Calculator',
    description: 'Tax optimisation, structuring & compliance',
    heroDescription: 'Minimise your tax liability and maximise your wealth with strategic tax planning. Our qualified professionals help you navigate complex tax regulations and identify opportunities for tax-efficient investing.',
    providers: TAX_PROVIDERS,
    accentColor: '#0284c7',
    productFields: [
      {
        id: 'employmentType',
        label: 'Employment type',
        type: 'select',
        required: true,
        options: [
          { value: 'salaried', label: 'Salaried Employee' },
          { value: 'self-employed', label: 'Self-Employed / Sole Prop' },
          { value: 'company-director', label: 'Company Director' },
          { value: 'retired', label: 'Retired' },
        ],
      },
      {
        id: 'annualIncome',
        label: 'Estimated annual income (R)',
        type: 'text',
        placeholder: 'e.g. 750 000',
        required: true,
      },
      {
        id: 'primaryConcern',
        label: 'Primary concern',
        type: 'select',
        required: true,
        options: [
          { value: 'reduce-tax', label: 'Reduce current tax' },
          { value: 'tax-efficient-investing', label: 'Tax-efficient investing' },
          { value: 'estate-duty', label: 'Estate duty planning' },
          { value: 'cgt', label: 'Capital gains tax' },
          { value: 'offshore', label: 'Offshore structuring' },
          { value: 'general', label: 'General tax review' },
        ],
      },
      {
        id: 'taxYear',
        label: 'Tax year',
        type: 'select',
        required: false,
        options: [
          { value: '2025-2026', label: '2025/2026 (Current)' },
          { value: '2026-2027', label: '2026/2027 (Upcoming)' },
        ],
      },
    ],
  },
  {
    id: 'estate-planning',
    label: 'Estate Planning',
    shortLabel: 'Estate',
    icon: 'FileText',
    description: 'Wills, trusts & succession planning',
    heroDescription: 'Protect your legacy and ensure your loved ones are taken care of. From trusts to estate duty planning, we\'ll help you create a strategy that preserves and transfers your wealth effectively.',
    providers: ESTATE_PROVIDERS,
    accentColor: '#9333ea',
    productFields: [
      {
        id: 'estateNeed',
        label: 'Estate planning need',
        type: 'select',
        required: true,
        options: [
          { value: 'trust-setup', label: 'Trust Structure Setup' },
          { value: 'succession', label: 'Succession Planning' },
          { value: 'estate-duty', label: 'Estate Duty Planning' },
          { value: 'business-succession', label: 'Business Succession' },
          { value: 'buy-sell', label: 'Buy-Sell Agreement' },
          { value: 'general', label: 'General Consultation' },
        ],
      },
      {
        id: 'hasWill',
        label: 'Do you have a current will?',
        type: 'select',
        required: true,
        options: [
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' },
          { value: 'outdated', label: 'Yes, but outdated' },
        ],
      },
      {
        id: 'estimatedEstateValue',
        label: 'Estimated estate value (R)',
        type: 'text',
        placeholder: 'e.g. 5 000 000',
        required: false,
      },
      {
        id: 'hasTrust',
        label: 'Do you have existing trust structures?',
        type: 'select',
        required: false,
        options: [
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' },
          { value: 'considering', label: 'Considering it' },
        ],
      },
    ],
  },
];

// ── Lookup helpers ────────────────────────────────────────────────────────────

export function getServiceConfig(serviceId: string): QuoteServiceConfig | undefined {
  return QUOTE_SERVICES.find((s) => s.id === serviceId);
}

export function isValidServiceId(id: string): id is QuoteServiceId {
  return QUOTE_SERVICES.some((s) => s.id === id);
}

// ── Trust indicators ──────────────────────────────────────────────────────────

export const TRUST_INDICATORS = [
  { label: 'FSP 54606', icon: 'Shield' },
  { label: 'FSCA Regulated', icon: 'CheckCircle' },
  { label: 'Free Consultation', icon: 'Phone' },
  { label: 'No Obligation', icon: 'Lock' },
] as const;