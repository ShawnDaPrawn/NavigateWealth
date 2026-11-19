/**
 * What the redesigned Legal pages show around the documents themselves: the
 * hub's four sections, its search, the contact routes, and the document
 * page's small helpers.
 *
 * The documents (name, slug, section and the one-line description) come from
 * the shared registry the live hub, the document page and the server all use,
 * in the registry's order, which is the live hub's order. Each section's
 * heading and description are the live hub's card titles; the tab labels and
 * their short forms are the live hub's tab triggers.
 */
import { COMPANY } from '../../config/companyFacts';
import {
  LEGAL_DOCUMENTS_BY_SLUG,
  LEGAL_DOCUMENTS_REGISTRY,
  LEGAL_SECTION_LABELS,
  type LegalDocumentRegistryEntry,
  type LegalDocumentSection,
} from '../../shared/legal-documents-registry';
import type { LegalIconName } from './LegalIcons';

export interface LegalSectionInfo {
  key: LegalDocumentSection;
  icon: LegalIconName;
  /** The tab's label, and its short form on narrow screens. */
  label: string;
  short: string;
  /** The open section's heading and description. */
  title: string;
  description: string;
  /** The contact card under the list, where the live hub has one. */
  officer?: { kicker: string; title: string };
}

export const LEGAL_SECTIONS: readonly LegalSectionInfo[] = [
  {
    key: 'legal-notices',
    icon: 'scale',
    label: 'Legal Notices',
    short: 'Legal',
    title: 'Legal Notices',
    description: 'Terms of service and legal agreements',
  },
  {
    key: 'privacy-data-protection',
    icon: 'shield',
    label: 'Privacy & Data',
    short: 'Privacy',
    title: 'Privacy & Data Protection',
    description: 'How we collect, use, and protect your personal information',
    officer: { kicker: 'Privacy', title: 'Contact Our Data Protection Officer' },
  },
  {
    key: 'regulatory-disclosures',
    icon: 'fileText',
    label: 'Regulatory',
    short: 'Reg',
    title: 'Regulatory Disclosures',
    description: 'Compliance information and regulatory requirements',
    officer: { kicker: 'Compliance', title: 'Compliance Officer' },
  },
  {
    key: 'other',
    icon: 'archive',
    label: 'Other',
    short: 'Other',
    title: 'Other Legal Information',
    description: 'Additional policies and legal notices',
  },
];

/** The live hub opens on this section when `?section=` is missing or unknown. */
export const DEFAULT_LEGAL_SECTION: LegalDocumentSection = 'legal-notices';

export function isLegalSection(value: string | null | undefined): value is LegalDocumentSection {
  return LEGAL_SECTIONS.some((section) => section.key === value);
}

export function sectionInfo(key: string | null | undefined): LegalSectionInfo | undefined {
  return LEGAL_SECTIONS.find((section) => section.key === key);
}

export function sectionIcon(key: string | null | undefined): LegalIconName {
  return sectionInfo(key)?.icon ?? 'fileText';
}

export function sectionLabel(key: LegalDocumentSection): string {
  return LEGAL_SECTION_LABELS[key];
}

export function sectionDocuments(key: LegalDocumentSection): LegalDocumentRegistryEntry[] {
  return LEGAL_DOCUMENTS_REGISTRY.filter((doc) => doc.section === key);
}

/**
 * The four "Keep reading" cards under a document, as the boards choose them:
 * the other documents in its section, in the registry's order, topped up from
 * the rest of the registry when the section has fewer than four others.
 */
export function relatedDocuments(
  key: LegalDocumentSection,
  currentSlug: string | undefined,
  count = 4,
): LegalDocumentRegistryEntry[] {
  const others = LEGAL_DOCUMENTS_REGISTRY.filter((doc) => doc.slug !== currentSlug);
  const sameSection = others.filter((doc) => doc.section === key);
  const rest = others.filter((doc) => doc.section !== key);
  return [...sameSection, ...rest].slice(0, count);
}

export const LEGAL_DOCUMENT_COUNT = LEGAL_DOCUMENTS_REGISTRY.length;

/** The board's "Most requested" panel. */
export const MOST_REQUESTED: LegalDocumentRegistryEntry[] = [
  'privacy-notice',
  'terms-of-use',
  'complaints-procedure',
  'fais-disclosure',
].map((slug) => LEGAL_DOCUMENTS_BY_SLUG[slug]);

/**
 * The hub's search: a document matches when the words typed appear in its
 * name, its description, its address or its section's name.
 */
export function searchLegalDocuments(query: string): LegalDocumentRegistryEntry[] {
  const term = query.trim().toLowerCase();
  if (!term) return [];
  return LEGAL_DOCUMENTS_REGISTRY.filter(
    (doc) =>
      doc.name.toLowerCase().includes(term) ||
      doc.description.toLowerCase().includes(term) ||
      doc.slug.includes(term) ||
      LEGAL_SECTION_LABELS[doc.section].toLowerCase().includes(term),
  );
}

export function searchSummary(query: string, count: number): string {
  const typed = query.trim();
  if (count === 0) return `No documents match “${typed}”.`;
  return `Showing ${count} ${count === 1 ? 'document' : 'documents'} matching “${typed}”.`;
}

/** The live hub's contact details, written as it writes them. */
export const LEGAL_CONTACT = {
  email: COMPANY.email,
  emailHref: `mailto:${COMPANY.email}`,
  phone: '+27 (0) 12 667 2505',
  phoneHref: COMPANY.phone.tel,
} as const;

/** The firm's registration line printed under each document. */
export const LEGAL_COMPANY_LINE = `${COMPANY.legalName} t/a “${COMPANY.tradingName}” · FSP No. ${COMPANY.fspNumber} · Reg. No. ${COMPANY.registrationNumber}`;

/** The hero's regulatory fact: "FSCA-authorised · FSP 54606". */
export const LEGAL_REGULATOR_LINE = `FSCA-authorised · FSP ${COMPANY.fspNumber}`;

export function legalDocumentHref(slug: string): string {
  return `/legal/${slug}`;
}

export function legalSectionHref(key: string): string {
  return `/legal?section=${key}`;
}
