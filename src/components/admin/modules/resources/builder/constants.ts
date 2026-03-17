/**
 * Form Builder Constants
 *
 * Starter templates, form status configuration, and validation rule config.
 * Guidelines §5.3 — Centralised typed constants.
 */

import type { FormBlock } from './types';
import type { LucideIcon } from 'lucide-react';
import {
  FileText,
  UserCheck,
  ShieldCheck,
  ClipboardList,
  Scale,
  Briefcase,
  Heart,
  Mail,
  FileSignature,
} from 'lucide-react';

// ============================================================================
// FORM STATUS — Lifecycle management (Phase 1)
// ============================================================================

export type FormStatus = 'draft' | 'published' | 'archived';

export const FORM_STATUS_CONFIG: Record<
  FormStatus,
  { label: string; badgeClass: string; dotClass: string; description: string }
> = {
  draft: {
    label: 'Draft',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
    dotClass: 'bg-amber-500',
    description: 'Work in progress — not visible to clients',
  },
  published: {
    label: 'Published',
    badgeClass: 'bg-green-100 text-green-800 border-green-200',
    dotClass: 'bg-green-500',
    description: 'Active and available for use',
  },
  archived: {
    label: 'Archived',
    badgeClass: 'bg-gray-100 text-gray-600 border-gray-200',
    dotClass: 'bg-gray-400',
    description: 'No longer in active use',
  },
} as const;

// ============================================================================
// STARTER TEMPLATES — Phase 1 Template Gallery
// ============================================================================

export interface StarterTemplate {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  category: string;
  tags: string[];
  blocks: FormBlock[];
  /** Approximate page count for preview */
  pageEstimate: number;
}

// Helper to generate unique IDs for template blocks
let _blockCounter = 0;
const tid = () => `tmpl_${++_blockCounter}_${Date.now().toString(36)}`;

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: 'blank',
    name: 'Blank Form',
    description: 'Start with a clean canvas — build your form from scratch.',
    icon: FileText,
    category: 'Forms',
    tags: ['blank', 'custom'],
    blocks: [],
    pageEstimate: 1,
  },
  {
    id: 'client_consent',
    name: 'Client Consent Form',
    description:
      'Standard consent form for client engagement with personal details, service selection, and signature blocks.',
    icon: UserCheck,
    category: 'Forms',
    tags: ['consent', 'onboarding', 'client'],
    blocks: [
      {
        id: tid(),
        type: 'section_header',
        data: { number: '1.', title: 'CLIENT PERSONAL DETAILS' },
      },
      {
        id: tid(),
        type: 'field_grid',
        data: {
          columns: 2,
          fields: [
            { label: 'Title', placeholder: 'Mr / Mrs / Ms / Dr', key: 'title' },
            { label: 'Full Name', placeholder: 'Enter full name', key: 'fullName', required: true },
            { label: 'ID / Passport Number', placeholder: 'Enter ID number', key: 'idNumber', required: true },
            { label: 'Date of Birth', placeholder: 'DD/MM/YYYY', key: 'dateOfBirth' },
            { label: 'Email Address', placeholder: 'email@example.com', key: 'email', required: true },
            { label: 'Contact Number', placeholder: '000 000 0000', key: 'phone', required: true },
          ],
        },
      },
      {
        id: tid(),
        type: 'section_header',
        data: { number: '2.', title: 'SERVICES REQUESTED' },
      },
      {
        id: tid(),
        type: 'checkbox_table',
        data: {
          columns: ['Yes', 'No'],
          rows: [
            'Financial Needs Analysis',
            'Investment Advisory',
            'Risk Planning',
            'Retirement Planning',
            'Estate Planning',
            'Tax Planning',
          ],
        },
      },
      {
        id: tid(),
        type: 'section_header',
        data: { number: '3.', title: 'CONSENT & DECLARATION' },
      },
      {
        id: tid(),
        type: 'text',
        data: {
          content:
            '<p>I, the undersigned, hereby consent to the collection and processing of my personal information as outlined in the Protection of Personal Information Act (POPIA). I confirm that the information provided is true and correct to the best of my knowledge.</p>',
        },
      },
      {
        id: tid(),
        type: 'signature',
        data: {
          signatories: [
            { label: 'Client Signature', key: 'client' },
            { label: 'Financial Adviser', key: 'adviser' },
          ],
          showDate: true,
        },
      },
    ],
    pageEstimate: 2,
  },
  {
    id: 'kyc_compliance',
    name: 'KYC / FICA Compliance',
    description:
      'Know Your Client form for FICA compliance — includes identity verification, source of funds, and risk profiling.',
    icon: ShieldCheck,
    category: 'Legal',
    tags: ['kyc', 'fica', 'compliance', 'aml'],
    blocks: [
      {
        id: tid(),
        type: 'section_header',
        data: { number: '1.', title: 'IDENTITY VERIFICATION' },
      },
      {
        id: tid(),
        type: 'field_grid',
        data: {
          columns: 2,
          fields: [
            { label: 'Full Legal Name', key: 'legalName', required: true },
            { label: 'ID Number', key: 'idNumber', required: true },
            { label: 'Nationality', key: 'nationality', required: true },
            { label: 'Country of Residence', key: 'countryResidence', required: true },
          ],
        },
      },
      {
        id: tid(),
        type: 'comb_input',
        data: { label: 'South African ID Number', charCount: 13, key: 'saId' },
      },
      {
        id: tid(),
        type: 'section_header',
        data: { number: '2.', title: 'SOURCE OF FUNDS & INCOME' },
      },
      {
        id: tid(),
        type: 'radio_options',
        data: {
          label: 'Primary Source of Income',
          options: ['Employment', 'Self-Employment', 'Investments', 'Inheritance', 'Pension', 'Other'],
          layout: 'vertical',
        },
      },
      {
        id: tid(),
        type: 'field_grid',
        data: {
          columns: 2,
          fields: [
            { label: 'Employer / Business Name', key: 'employerName' },
            { label: 'Occupation / Position', key: 'occupation' },
            { label: 'Annual Income Range', key: 'incomeRange' },
            { label: 'Source of Wealth (if applicable)', key: 'sourceWealth' },
          ],
        },
      },
      {
        id: tid(),
        type: 'section_header',
        data: { number: '3.', title: 'RISK ASSESSMENT' },
      },
      {
        id: tid(),
        type: 'risk_profile',
        data: {
          level: 3,
          labels: ['Very Conservative', 'Conservative', 'Moderate', 'Moderately Aggressive', 'Aggressive'],
        },
      },
      {
        id: tid(),
        type: 'section_header',
        data: { number: '4.', title: 'DECLARATION' },
      },
      {
        id: tid(),
        type: 'compliance_question',
        data: {
          question: 'Is the client a Politically Exposed Person (PEP)?',
          showDetails: true,
          detailsLabel: 'If yes, provide details',
        },
      },
      {
        id: tid(),
        type: 'compliance_question',
        data: {
          question: 'Is the client a Foreign Account Tax Compliance Act (FATCA) reportable person?',
          showDetails: true,
          detailsLabel: 'If yes, provide US Taxpayer ID',
        },
      },
      {
        id: tid(),
        type: 'signature',
        data: {
          signatories: [{ label: 'Client Signature', key: 'client' }],
          showDate: true,
        },
      },
    ],
    pageEstimate: 3,
  },
  {
    id: 'fna_intake',
    name: 'FNA Intake Questionnaire',
    description:
      'Financial Needs Analysis intake form — collects personal, family, income, and existing coverage information.',
    icon: ClipboardList,
    category: 'Forms',
    tags: ['fna', 'intake', 'questionnaire', 'financial'],
    blocks: [
      {
        id: tid(),
        type: 'section_header',
        data: { number: '1.', title: 'PERSONAL INFORMATION' },
      },
      {
        id: tid(),
        type: 'field_grid',
        data: {
          columns: 3,
          fields: [
            { label: 'Full Name', key: 'fullName', required: true },
            { label: 'Date of Birth', key: 'dob', required: true },
            { label: 'Marital Status', key: 'maritalStatus' },
            { label: 'Number of Dependants', key: 'dependants' },
            { label: 'Smoker', key: 'smoker' },
            { label: 'Occupation', key: 'occupation' },
          ],
        },
      },
      {
        id: tid(),
        type: 'section_header',
        data: { number: '2.', title: 'MONTHLY INCOME & EXPENSES' },
      },
      {
        id: tid(),
        type: 'financial_table',
        data: {
          items: [
            { description: 'Gross Monthly Income', value: '' },
            { description: 'Net Monthly Income', value: '' },
            { description: 'Monthly Living Expenses', value: '' },
            { description: 'Monthly Debt Repayments', value: '' },
            { description: 'Monthly Insurance Premiums', value: '' },
            { description: 'Monthly Savings & Investments', value: '' },
          ],
          showTotal: true,
          currencySymbol: 'R',
        },
      },
      {
        id: tid(),
        type: 'section_header',
        data: { number: '3.', title: 'EXISTING COVERAGE' },
      },
      {
        id: tid(),
        type: 'repeater',
        data: {
          title: 'Current Insurance Policies',
          variableName: 'existingPolicies',
          columns: [
            { header: 'Provider', key: 'provider', width: '25%' },
            { header: 'Type', key: 'type', width: '20%' },
            { header: 'Cover Amount', key: 'coverAmount', width: '20%' },
            { header: 'Premium', key: 'premium', width: '15%' },
            { header: 'Policy Number', key: 'policyNumber', width: '20%' },
          ],
          emptyMessage: 'No existing policies listed',
          userPopulated: true,
        },
      },
      {
        id: tid(),
        type: 'section_header',
        data: { number: '4.', title: 'ACKNOWLEDGEMENT' },
      },
      {
        id: tid(),
        type: 'clause_initial',
        data: {
          text: 'I confirm that the information provided above is accurate and complete to the best of my knowledge.',
          initialLabel: 'Initial',
        },
      },
      {
        id: tid(),
        type: 'signature',
        data: {
          signatories: [
            { label: 'Client Signature', key: 'client' },
            { label: 'Financial Adviser', key: 'adviser' },
          ],
          showDate: true,
        },
      },
    ],
    pageEstimate: 3,
  },
  {
    id: 'investment_mandate',
    name: 'Investment Mandate',
    description:
      'Investment instruction template with risk profile, asset allocation, and mandate authorisation.',
    icon: Briefcase,
    category: 'Forms',
    tags: ['investment', 'mandate', 'instruction'],
    blocks: [
      {
        id: tid(),
        type: 'section_header',
        data: { number: '1.', title: 'CLIENT DETAILS' },
      },
      {
        id: tid(),
        type: 'field_grid',
        data: {
          columns: 2,
          fields: [
            { label: 'Full Name', key: 'fullName', required: true },
            { label: 'ID Number', key: 'idNumber', required: true },
            { label: 'Investment Account Number', key: 'accountNumber' },
            { label: 'FICA Status', key: 'ficaStatus' },
          ],
        },
      },
      {
        id: tid(),
        type: 'section_header',
        data: { number: '2.', title: 'INVESTMENT RISK PROFILE' },
      },
      {
        id: tid(),
        type: 'risk_profile',
        data: {
          level: 3,
          labels: ['Conservative', 'Moderate Conservative', 'Moderate', 'Moderate Aggressive', 'Aggressive'],
        },
      },
      {
        id: tid(),
        type: 'section_header',
        data: { number: '3.', title: 'MANDATE DETAILS' },
      },
      {
        id: tid(),
        type: 'financial_table',
        data: {
          items: [
            { description: 'Lump Sum Investment', value: '' },
            { description: 'Monthly Recurring Contribution', value: '' },
            { description: 'Investment Term (years)', value: '' },
          ],
          showTotal: false,
          currencySymbol: 'R',
        },
      },
      {
        id: tid(),
        type: 'section_header',
        data: { number: '4.', title: 'BANK DETAILS FOR DEBIT ORDER' },
      },
      {
        id: tid(),
        type: 'bank_details',
        data: { title: 'Debit Order Banking Details', showAuthorization: true },
      },
      {
        id: tid(),
        type: 'section_header',
        data: { number: '5.', title: 'AUTHORISATION' },
      },
      {
        id: tid(),
        type: 'text',
        data: {
          content:
            '<p>I hereby authorise the investment manager to execute the mandate as specified above in accordance with my risk profile and stated objectives.</p>',
        },
      },
      {
        id: tid(),
        type: 'signature',
        data: {
          signatories: [
            { label: 'Client Signature', key: 'client' },
            { label: 'Financial Adviser', key: 'adviser' },
          ],
          showDate: true,
        },
      },
      {
        id: tid(),
        type: 'witness_signature',
        data: { mainLabel: 'Witness', showWitnesses: true },
      },
    ],
    pageEstimate: 3,
  },
  {
    id: 'beneficiary_nomination',
    name: 'Beneficiary Nomination',
    description:
      'Beneficiary nomination form for policies and funds — includes beneficiary table and declaration.',
    icon: Heart,
    category: 'Forms',
    tags: ['beneficiary', 'nomination', 'estate'],
    blocks: [
      {
        id: tid(),
        type: 'section_header',
        data: { number: '1.', title: 'POLICY HOLDER DETAILS' },
      },
      {
        id: tid(),
        type: 'field_grid',
        data: {
          columns: 2,
          fields: [
            { label: 'Full Name', key: 'fullName', required: true },
            { label: 'ID Number', key: 'idNumber', required: true },
            { label: 'Policy / Fund Number', key: 'policyNumber', required: true },
            { label: 'Product Provider', key: 'provider' },
          ],
        },
      },
      {
        id: tid(),
        type: 'section_header',
        data: { number: '2.', title: 'BENEFICIARY NOMINATIONS' },
      },
      {
        id: tid(),
        type: 'instructional_callout',
        data: {
          text: 'Please ensure that beneficiary percentages total 100%. All beneficiaries must have a valid ID or date of birth.',
          type: 'info',
        },
      },
      {
        id: tid(),
        type: 'beneficiary_table',
        data: { rowCount: 4 },
      },
      {
        id: tid(),
        type: 'section_header',
        data: { number: '3.', title: 'DECLARATION' },
      },
      {
        id: tid(),
        type: 'text',
        data: {
          content:
            '<p>I hereby nominate the above beneficiaries and revoke any previous beneficiary nominations in respect of the policy/fund number stated above. I understand that this nomination is subject to the rules of the fund and applicable legislation.</p>',
        },
      },
      {
        id: tid(),
        type: 'signature',
        data: {
          signatories: [{ label: 'Policy Holder Signature', key: 'policyHolder' }],
          showDate: true,
        },
      },
      {
        id: tid(),
        type: 'witness_signature',
        data: { mainLabel: 'Witness', showWitnesses: true },
      },
    ],
    pageEstimate: 2,
  },
  {
    id: 'record_of_advice',
    name: 'Record of Advice',
    description:
      'FAIS-compliant Record of Advice documenting financial recommendations and client acknowledgements.',
    icon: Scale,
    category: 'Legal',
    tags: ['roa', 'fais', 'advice', 'compliance'],
    blocks: [
      {
        id: tid(),
        type: 'section_header',
        data: { number: '1.', title: 'ADVISER INFORMATION' },
      },
      {
        id: tid(),
        type: 'field_grid',
        data: {
          columns: 2,
          fields: [
            { label: 'Adviser Name', key: 'adviserName', required: true },
            { label: 'FSP Number', key: 'fspNumber', required: true },
            { label: 'Date of Advice', key: 'adviceDate', required: true },
            { label: 'Client Name', key: 'clientName', required: true },
          ],
        },
      },
      {
        id: tid(),
        type: 'section_header',
        data: { number: '2.', title: 'BACKGROUND & FINANCIAL NEEDS' },
      },
      {
        id: tid(),
        type: 'text',
        data: {
          content:
            '<p>Summarise the client\'s background, financial needs, and objectives that formed the basis of this advice:</p>',
        },
      },
      {
        id: tid(),
        type: 'field_grid',
        data: {
          columns: 1,
          fields: [{ label: 'Client Background & Needs', key: 'clientNeeds', required: true }],
        },
      },
      {
        id: tid(),
        type: 'section_header',
        data: { number: '3.', title: 'RECOMMENDATIONS' },
      },
      {
        id: tid(),
        type: 'repeater',
        data: {
          title: 'Products Recommended',
          variableName: 'recommendations',
          columns: [
            { header: 'Product', key: 'product', width: '25%' },
            { header: 'Provider', key: 'provider', width: '20%' },
            { header: 'Reason', key: 'reason', width: '35%' },
            { header: 'Amount', key: 'amount', width: '20%' },
          ],
          emptyMessage: 'No recommendations added yet',
          userPopulated: true,
        },
      },
      {
        id: tid(),
        type: 'section_header',
        data: { number: '4.', title: 'DISCLOSURES' },
      },
      {
        id: tid(),
        type: 'compliance_question',
        data: {
          question: 'Were fees and commissions fully disclosed to the client?',
          showDetails: true,
          detailsLabel: 'Fee structure details',
        },
      },
      {
        id: tid(),
        type: 'compliance_question',
        data: {
          question: 'Was the client advised of replacement risks (Section 8 of FAIS)?',
          showDetails: true,
          detailsLabel: 'Details of replacements',
        },
      },
      {
        id: tid(),
        type: 'section_header',
        data: { number: '5.', title: 'ACKNOWLEDGEMENT & SIGNATURES' },
      },
      {
        id: tid(),
        type: 'text',
        data: {
          content:
            '<p>I, the client, acknowledge that I have received, understood, and agree with the above record of advice provided by my financial adviser. I confirm that the advice was provided in my best interest and that I had the opportunity to ask questions.</p>',
        },
      },
      {
        id: tid(),
        type: 'signature',
        data: {
          signatories: [
            { label: 'Client Signature', key: 'client' },
            { label: 'Financial Adviser', key: 'adviser' },
          ],
          showDate: true,
        },
      },
    ],
    pageEstimate: 3,
  },
  {
    id: 'blank_letter',
    name: 'Blank Letter',
    description: 'Start with a blank letter template with letterhead and signature block.',
    icon: Mail,
    category: 'Letters',
    tags: ['letter', 'blank', 'correspondence'],
    blocks: [],
    pageEstimate: 1,
  },
];

// ============================================================================
// VALIDATION RULE TYPES — Phase 2
// ============================================================================

export type ValidationRuleType =
  | 'required'
  | 'min_length'
  | 'max_length'
  | 'min_value'
  | 'max_value'
  | 'pattern'
  | 'email'
  | 'phone'
  | 'id_number';

export interface ValidationRule {
  type: ValidationRuleType;
  value?: string | number;
  message: string;
}

export const VALIDATION_RULE_PRESETS: Record<
  string,
  { label: string; rules: ValidationRule[] }
> = {
  sa_id: {
    label: 'SA ID Number',
    rules: [
      { type: 'required', message: 'ID number is required' },
      { type: 'pattern', value: '^\\d{13}$', message: 'Must be a valid 13-digit SA ID number' },
    ],
  },
  email: {
    label: 'Email Address',
    rules: [
      { type: 'required', message: 'Email is required' },
      { type: 'email', message: 'Must be a valid email address' },
    ],
  },
  phone: {
    label: 'Phone Number',
    rules: [
      { type: 'required', message: 'Phone number is required' },
      { type: 'phone', message: 'Must be a valid phone number' },
    ],
  },
  currency: {
    label: 'Currency Amount',
    rules: [
      { type: 'required', message: 'Amount is required' },
      { type: 'min_value', value: 0, message: 'Amount must be positive' },
    ],
  },
  percentage: {
    label: 'Percentage',
    rules: [
      { type: 'min_value', value: 0, message: 'Must be at least 0%' },
      { type: 'max_value', value: 100, message: 'Must be at most 100%' },
    ],
  },
} as const;

// ============================================================================
// CONDITIONAL LOGIC — Phase 2
// ============================================================================

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_empty'
  | 'is_empty'
  | 'greater_than'
  | 'less_than';

export interface VisibilityCondition {
  /** The field key to evaluate */
  fieldKey: string;
  /** Comparison operator */
  operator: ConditionOperator;
  /** Value to compare against (not needed for is_empty / not_empty) */
  value?: string | number;
}

export interface BlockVisibilityRule {
  /** When true, block shows if ANY condition matches; when false, ALL must match */
  matchAny: boolean;
  conditions: VisibilityCondition[];
}
