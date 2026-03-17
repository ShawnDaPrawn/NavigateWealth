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