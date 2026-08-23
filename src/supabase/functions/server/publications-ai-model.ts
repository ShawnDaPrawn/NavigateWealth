/**
 * Types for the publications AI writing service. Moved verbatim from
 * publications-ai-service.ts, which re-exports them.
 */
export type AIAction =
  | 'improve'
  | 'expand'
  | 'summarize'
  | 'continue'
  | 'tone'
  | 'headline'
  | 'excerpt'
  | 'compliance_check'
  | 'seo_optimize'
  | 'generate_callout'
  | 'fix_grammar'
  | 'custom';

export interface AIWritingRequest {
  action: AIAction;
  /** The selected text or primary content to operate on */
  content: string;
  /** Surrounding context to improve quality */
  context?: string;
  /** Target tone for 'tone' action */
  tone?: 'professional' | 'conversational' | 'authoritative' | 'friendly' | 'educational';
  /** Custom user prompt for 'custom' action */
  prompt?: string;
  /** Article metadata for context */
  articleTitle?: string;
  articleExcerpt?: string;
  articleCategory?: string;
}

export interface AIWritingResponse {
  result: string;
  suggestions?: string[];
  warnings?: string[];
  action: AIAction;
  tokensUsed?: number;
}

// ---------------------------------------------------------------------------
// Full Article Generation Types
// ---------------------------------------------------------------------------

export interface GenerateArticleBrief {
  /** Topic or working title */
  topic: string;
  /** Target audience */
  audience: 'advisors' | 'clients' | 'both';
  /** Writing tone */
  tone: 'professional' | 'conversational' | 'authoritative' | 'friendly' | 'educational';
  /** Key points to cover (optional) */
  keyPoints?: string[];
  /** Target word count */
  targetLength: 'short' | 'medium' | 'long';
  /** Category name for context */
  categoryName?: string;
  /** Template body to use as structural guide (optional) */
  templateBody?: string;
  /** Additional instructions (optional) */
  additionalInstructions?: string;
  /** Available category names for auto-detection when no category is explicitly selected */
  availableCategories?: string[];
}

export interface GenerateArticleResult {
  title: string;
  excerpt: string;
  body: string;
  suggestedSlug: string;
  readingTimeMinutes: number;
  suggestedMetaDescription: string;
  tokensUsed: number;
  /** AI-suggested category name (returned when availableCategories was provided) */
  suggestedCategoryName?: string;
  /** Hero image URL sourced from Unsplash based on article topic */
  suggestedHeroImageUrl?: string;
  /** Thumbnail image URL sourced from Unsplash based on article topic */
  suggestedThumbnailUrl?: string;
  /** Unsplash photo ID for stale image tracking */
  unsplashPhotoId?: string;
}

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------
