import type { LetterMeta } from './templates/LetterheadPdfLayout';
import type { FormBlock } from './builder/types';
// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

export enum ResourceCategory {
  FORMS = 'Forms',
  TEMPLATES = 'Templates',
  REQUESTS = 'Requests',
  LETTERS = 'Letters',
  TRAINING = 'Training',
  KNOWLEDGE_BASE = 'Knowledge Base',
  CALCULATORS = 'Calculators',
}

export enum ResourceType {
  FORM = 'Form',
  TEMPLATE = 'Template',
  VIDEO = 'Video',
  DOCUMENT = 'Document',
  COURSE = 'Course',
  ARTICLE = 'Article',
  CALCULATOR = 'Calculator',
}

export enum TrainingDifficulty {
  BEGINNER = 'Beginner',
  INTERMEDIATE = 'Intermediate',
  ADVANCED = 'Advanced',
}

// ============================================================================
// FORM DEFINITIONS
// ============================================================================

/**
 * Form definition interface
 * Represents a template/form that can be rendered dynamically
 */
export interface FormDefinition {
  id: string;
  name: string;
  category: string;
  description: string;
  version: string;
  lastUpdated: string;
  downloads: number;
  size: string;
  isPopular: boolean;
  fields: string[];
  clientTypes: string[];
  renderer: 'dynamic' | 'letter' | 'custom';
  previewComponent?: React.ComponentType<{ data?: Record<string, unknown>; blocks?: FormBlock[] }>;
  blocks?: FormBlock[];
  letterMeta?: LetterMeta;
  /** Form lifecycle status — Phase 1 form builder (§9.3 synced with server) */
  status?: 'draft' | 'published' | 'archived';
}

/**
 * Form filter options
 */
export interface FormFilters {
  search: string;
  category: string;
  clientType: string;
  sortBy: 'name' | 'lastUpdated' | 'downloads';
  sortDirection: 'asc' | 'desc';
  /** Phase 1 — Status filter */
  status?: string;
}

// ============================================================================
// TRAINING RESOURCES
// ============================================================================

/**
 * Training resource (videos, courses, documents)
 */
export interface TrainingResource {
  id: string;
  title: string;
  type: 'video' | 'document' | 'course';
  category: string;
  duration?: string;
  description: string;
  difficulty: TrainingDifficulty;
  views: number;
  rating: number;
  lastUpdated: string;
  thumbnailUrl?: string;
  url?: string;
  tags?: string[];
}

/**
 * Training filters
 */
export interface TrainingFilters {
  search: string;
  type: 'all' | 'video' | 'document' | 'course';
  category: string;
  difficulty: 'all' | TrainingDifficulty;
}

// ============================================================================
// KNOWLEDGE BASE
// ============================================================================

/**
 * Knowledge base article
 */
export interface KnowledgeArticle {
  id: string;
  title: string;
  category: 'Client Relations' | 'Communication' | 'Calculations' | string;
  description: string;
  tags: string[];
  views: number;
  helpful: number;
  lastUpdated: string;
  content?: string;
  author?: string;
}

/**
 * Knowledge base filters
 */
export interface KnowledgeFilters {
  search: string;
  category: string;
  tags: string[];
}

// ============================================================================
// CALCULATORS
// ============================================================================

/**
 * Calculator definition
 */
export interface Calculator {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  component: React.ComponentType<Record<string, unknown>>;
  inputs: CalculatorInput[];
}

/**
 * Calculator input field
 */
export interface CalculatorInput {
  id: string;
  label: string;
  type: 'number' | 'currency' | 'percentage' | 'date';
  defaultValue?: string | number | boolean | null;
  min?: number;
  max?: number;
  required: boolean;
}

/**
 * Calculator result
 */
export interface CalculatorResult {
  id: string;
  label: string;
  value: string | number;
  format: 'currency' | 'percentage' | 'number' | 'text';
  description?: string;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

/**
 * Create resource request
 */
export interface CreateResourceRequest {
  title: string;
  category: string;
  description?: string;
  blocks?: FormBlock[];
  clientTypes?: string[];
  version?: string;
}

/**
 * Update resource request
 */
export interface UpdateResourceRequest {
  id: string;
  title?: string;
  category?: string;
  description?: string;
  blocks?: FormBlock[];
  clientTypes?: string[];
  version?: string;
  /** Form lifecycle status — Phase 1 form builder */
  status?: 'draft' | 'published' | 'archived';
}

/**
 * Resource response from API
 */
export interface ResourceResponse {
  id: string;
  title: string;
  category: string;
  description?: string;
  blocks?: FormBlock[];
  clientTypes?: string[];
  version: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  letterMeta?: LetterMeta;
  /** Form lifecycle status — Phase 1 form builder (§9.3 synced with server) */
  status?: 'draft' | 'published' | 'archived';
}

export type LegalDocumentLifecycleStatus = 'draft' | 'published' | 'archived';
export type LegalDocumentRenderMode = 'legacy_resource' | 'versioned_document';
export type LegalDocumentSection =
  | 'legal-notices'
  | 'privacy-data-protection'
  | 'regulatory-disclosures'
  | 'other';

export interface LegalDocumentDefinitionResponse {
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

export interface LegalDocumentVersionResponse {
  id: string;
  documentId: string;
  slug: string;
  title: string;
  section: LegalDocumentSection;
  versionNumber: string;
  status: LegalDocumentLifecycleStatus;
  contentFormat: 'legacy_blocks' | 'normalized_rich_text';
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  effectiveDate: string | null;
  createdBy: string;
  publishedBy: string | null;
  changeSummary: string | null;
  blocks: FormBlock[];
  sourceHtml: string | null;
  normalizedContent: Record<string, unknown> | null;
  toc: Array<{ id: string; title: string; level: number }>;
  pdfConfig: {
    pageSize: 'A4' | 'A3';
    orientation: 'portrait' | 'landscape';
  };
}

export interface LegalDocumentDetailResponse {
  definition: LegalDocumentDefinitionResponse;
  versions: LegalDocumentVersionResponse[];
  currentPublishedVersion: LegalDocumentVersionResponse | null;
  currentDraftVersion: LegalDocumentVersionResponse | null;
}

export interface LegalDocumentMigrationBatchResponse {
  migrated: string[];
  skipped: string[];
  failed: Array<{ slug: string; error: string }>;
}

export interface LegalDocumentAuditEntry {
  id: string;
  timestamp: string;
  actorId: string;
  actorRole: string;
  category: string;
  action: string;
  summary: string;
  severity: 'info' | 'warning' | 'critical';
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

export interface UpsertLegalDocumentDraftRequest {
  versionNumber: string;
  effectiveDate?: string | null;
  changeSummary?: string | null;
  sourceHtml: string;
  pdfConfig?: {
    pageSize: 'A4' | 'A3';
    orientation: 'portrait' | 'landscape';
  };
}

/**
 * List resources filters (API)
 */
export interface ListResourcesFilters {
  category?: string[];
  search?: string;
  clientType?: string;
  limit?: number;
  offset?: number;
}

// ============================================================================
// UI STATE TYPES
// ============================================================================

/**
 * Resources module state
 */
export interface ResourcesModuleState {
  // Forms
  forms: FormDefinition[];
  selectedForms: string[];
  formFilters: FormFilters;
  previewingForm: FormDefinition | null;
  
  // Training
  trainingResources: TrainingResource[];
  trainingFilters: TrainingFilters;
  
  // Knowledge Base
  knowledgeArticles: KnowledgeArticle[];
  knowledgeFilters: KnowledgeFilters;
  
  // UI State
  activeTab: 'forms' | 'training' | 'knowledge' | 'tools';
  loading: boolean;
  error: string | null;
}

/**
 * Form builder state
 */
export interface FormBuilderState {
  isOpen: boolean;
  formToEdit: FormDefinition | null;
  blocks: FormBlock[];
  isDirty: boolean;
}

/**
 * Delete modal state
 */
export interface DeleteModalState {
  isOpen: boolean;
  formToDelete: FormDefinition | null;
  confirmation: string;
}

// ============================================================================
// FORM RENDERER PROPS
// ============================================================================

/**
 * Dynamic form renderer props
 */
export interface DynamicFormRendererProps {
  data?: Record<string, unknown>;
  blocks?: FormBlock[];
  formName?: string;
}

/**
 * Preview data for form rendering
 */
export interface FormPreviewData {
  client?: {
    name?: string;
    idNumber?: string;
    email?: string;
    address?: string;
    phone?: string;
  };
  personalInformation?: {
    firstName?: string;
    lastName?: string;
    idNumber?: string;
    dateOfBirth?: string;
    gender?: string;
  };
  adviser?: {
    name?: string;
    email?: string;
    phone?: string;
    licenseNumber?: string;
  };
  [key: string]: unknown;
}

// ============================================================================
// HELPER TYPES
// ============================================================================

/**
 * Category statistics
 */
export interface CategoryStats {
  category: string;
  count: number;
  popular: number;
}

/**
 * Client type statistics
 */
export interface ClientTypeStats {
  type: string;
  count: number;
}

/**
 * Resource statistics
 */
export interface ResourceStats {
  totalForms: number;
  totalTraining: number;
  totalKnowledge: number;
  totalCalculators: number;
  popularForms: number;
  recentlyUpdated: number;
}
