/**
 * Resources Module - Type Definitions
 * Fresh file moved to root to fix bundling issues
 */

// Resource category
export type ResourceCategory = 
  | 'General'
  | 'Market Data'
  | 'Research'
  | 'Education'
  | 'Templates'
  | 'Tools'
  | 'Forms'
  | 'Requests'
  | 'Legal'
  | 'Letters';

// Letter signatory — individual signer on a letter
export interface Signatory {
  name?: string;
  title?: string;
}

// Letter metadata — stored alongside letter-category resources
export interface LetterMeta {
  recipientName?: string;
  recipientTitle?: string;
  recipientCompany?: string;
  recipientAddress?: string;
  subject?: string;
  reference?: string;
  date?: string;
  closing?: string;
  /** Multiple signatories (preferred — replaces legacy singular fields) */
  signatories?: Signatory[];
  /** @deprecated Use signatories[] instead */
  signatoryName?: string;
  /** @deprecated Use signatories[] instead */
  signatoryTitle?: string;
}

// Resource
export interface Resource {
  id: string;
  title: string;
  description?: string;
  category: ResourceCategory | string;
  url?: string;
  fileUrl?: string;
  createdAt: string;
  blocks?: Record<string, unknown>[];
  clientTypes?: string[];
  version?: string;
  letterMeta?: LetterMeta;
  /** Form lifecycle status — Phase 1 form builder */
  status?: 'draft' | 'published' | 'archived';
}

export type LegalDocumentLifecycleStatus = 'draft' | 'published' | 'archived';
export type LegalDocumentRenderMode = 'legacy_resource' | 'versioned_document';
export type LegalDocumentContentFormat = 'legacy_blocks' | 'normalized_rich_text';
export type LegalDocumentSection =
  | 'legal-notices'
  | 'privacy-data-protection'
  | 'regulatory-disclosures'
  | 'other';

export interface LegalDocumentDefinition {
  id: string;
  slug: string;
  title: string;
  section: LegalDocumentSection;
  description: string;
  status: LegalDocumentLifecycleStatus;
  renderMode: LegalDocumentRenderMode;
  migrationPriority?: 'high' | 'normal';
  currentPublishedVersionId: string | null;
  currentDraftVersionId: string | null;
  legacyResourceId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LegalDocumentVersion {
  id: string;
  documentId: string;
  slug: string;
  title: string;
  section: LegalDocumentSection;
  versionNumber: string;
  status: LegalDocumentLifecycleStatus;
  contentFormat: LegalDocumentContentFormat;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  effectiveDate: string | null;
  createdBy: string;
  publishedBy: string | null;
  changeSummary: string | null;
  blocks: Record<string, unknown>[];
  sourceHtml: string | null;
  normalizedContent: Record<string, unknown> | null;
  toc: Array<{ id: string; title: string; level: number }>;
  pdfConfig: {
    pageSize: 'A4' | 'A3';
    orientation: 'portrait' | 'landscape';
  };
}

// Resource filters
export interface ResourceFilters {
  category?: ResourceCategory | string;
}

// RSS Feed Item
export interface RSSItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  guid: string;
}
