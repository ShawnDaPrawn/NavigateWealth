export type LegalDocumentSection =
  | 'legal-notices'
  | 'privacy-data-protection'
  | 'regulatory-disclosures'
  | 'other';

export interface LegalDocumentRegistryEntry {
  slug: string;
  name: string;
  section: LegalDocumentSection;
  description: string;
  migrationPriority?: 'high' | 'normal';
}

export const LEGAL_DOCUMENTS_REGISTRY: LegalDocumentRegistryEntry[] = [
  {
    slug: 'legal-conditions',
    name: 'Legal Conditions & Disclosures',
    section: 'legal-notices',
    description: 'Terms, conditions, and disclosures governing the use of Navigate Wealth services.',
  },
  {
    slug: 'terms-of-use',
    name: 'Terms of Use',
    section: 'legal-notices',
    description: 'Terms governing the use of the Navigate Wealth website and platform.',
    migrationPriority: 'high',
  },
  {
    slug: 'website-disclaimer',
    name: 'Website Disclaimer',
    section: 'legal-notices',
    description: 'Disclaimer regarding the information presented on the Navigate Wealth website.',
  },
  {
    slug: 'whistleblowing-policy',
    name: 'Whistleblowing Policy',
    section: 'legal-notices',
    description: 'Policy for reporting unethical or illegal conduct within Navigate Wealth.',
  },
  {
    slug: 'privacy-notice',
    name: 'Privacy Notice',
    section: 'privacy-data-protection',
    description: 'How Navigate Wealth collects, uses, and protects personal information.',
    migrationPriority: 'high',
  },
  {
    slug: 'popia-paia-manual',
    name: 'POPIA and PAIA Manual',
    section: 'privacy-data-protection',
    description: 'Manual in terms of the Protection of Personal Information Act and Promotion of Access to Information Act.',
    migrationPriority: 'high',
  },
  {
    slug: 'data-protection-policy',
    name: 'Data Protection Policy',
    section: 'privacy-data-protection',
    description: 'Internal policy governing the protection of client and company data.',
    migrationPriority: 'high',
  },
  {
    slug: 'cookie-policy',
    name: 'Cookie Policy',
    section: 'privacy-data-protection',
    description: 'How cookies and similar technologies are used on the Navigate Wealth website.',
  },
  {
    slug: 'data-processing-agreement',
    name: 'Data Processing Agreement',
    section: 'privacy-data-protection',
    description: 'Agreement governing the processing of personal data by third-party service providers.',
  },
  {
    slug: 'conflict-of-interest',
    name: 'Conflict of Interest',
    section: 'regulatory-disclosures',
    description: 'Policy on identifying, managing, and disclosing conflicts of interest.',
  },
  {
    slug: 'fais-disclosure',
    name: 'FAIS Disclosure',
    section: 'regulatory-disclosures',
    description: 'Disclosure required under the Financial Advisory and Intermediary Services Act.',
    migrationPriority: 'high',
  },
  {
    slug: 'fsp-license',
    name: 'FSP License Information',
    section: 'regulatory-disclosures',
    description: 'Details of the Financial Services Provider license held by Navigate Wealth.',
  },
  {
    slug: 'risk-disclosures',
    name: 'Risk Disclosures',
    section: 'regulatory-disclosures',
    description: 'Information about risks associated with financial products and services.',
  },
  {
    slug: 'complaints-procedure',
    name: 'Complaints Procedure',
    section: 'regulatory-disclosures',
    description: 'Procedure for lodging and resolving complaints with Navigate Wealth.',
    migrationPriority: 'high',
  },
  {
    slug: 'compliance-report',
    name: 'Regulatory Compliance Report',
    section: 'regulatory-disclosures',
    description: 'Summary of Navigate Wealth\'s regulatory compliance status and reporting.',
  },
  {
    slug: 'paia-manual',
    name: 'PAIA Manual',
    section: 'other',
    description: 'Manual in terms of the Promotion of Access to Information Act.',
  },
  {
    slug: 'disclaimers',
    name: 'Disclaimers',
    section: 'other',
    description: 'General disclaimers applicable to Navigate Wealth services and communications.',
  },
  {
    slug: 'cis-disclaimer',
    name: 'CIS Disclaimer',
    section: 'other',
    description: 'Disclaimer specific to Collective Investment Schemes.',
  },
  {
    slug: 'third-party-services',
    name: 'Third Party Services Policy',
    section: 'other',
    description: 'Policy governing the use of third-party service providers.',
  },
  {
    slug: 'intellectual-property',
    name: 'Intellectual Property Notice',
    section: 'other',
    description: 'Notice regarding intellectual property rights owned by Navigate Wealth.',
  },
  {
    slug: 'aml-policy',
    name: 'Anti-Money Laundering Policy',
    section: 'other',
    description: 'Policy and procedures for the prevention and detection of money laundering.',
  },
];

export const LEGAL_DOCUMENTS_BY_SLUG: Record<string, LegalDocumentRegistryEntry> = Object.fromEntries(
  LEGAL_DOCUMENTS_REGISTRY.map((doc) => [doc.slug, doc]),
);

export const LEGAL_SLUGS = LEGAL_DOCUMENTS_REGISTRY.map((doc) => doc.slug);

export const LEGAL_MIGRATION_PRIORITY_SLUGS = LEGAL_DOCUMENTS_REGISTRY
  .filter((doc) => doc.migrationPriority === 'high')
  .map((doc) => doc.slug);

export const LEGAL_SECTION_LABELS: Record<LegalDocumentSection, string> = {
  'legal-notices': 'Legal Notices',
  'privacy-data-protection': 'Privacy & Data Protection',
  'regulatory-disclosures': 'Regulatory Disclosures',
  other: 'Other Legal Information',
};
