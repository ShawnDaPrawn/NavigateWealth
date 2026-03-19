/**
 * Publications Feature - Constants & Configuration
 * 
 * Central configuration for the Publications feature including API endpoints,
 * validation rules, and default values.
 * 
 * All constants are type-safe and organized by category.
 */

import { projectId, publicAnonKey } from '../../../../utils/supabase/info';

// ==================== API Configuration ====================

/**
 * Base URL for all Publications API endpoints
 */
export const PUBLICATIONS_BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/publications`;

/**
 * API endpoint paths for all Publications operations
 * 
 * @example
 * ```ts
 * const url = PUBLICATIONS_BASE_URL + API_ENDPOINTS.articles;
 * const articleUrl = PUBLICATIONS_BASE_URL + API_ENDPOINTS.articleById('123');
 * ```
 */
export const API_ENDPOINTS = {
  // Articles
  articles: '/articles',
  articleById: (id: string) => `/articles/${id}`,
  articleBySlug: (slug: string) => `/articles/slug/${slug}`,
  articlePublish: (id: string) => `/articles/${id}/publish`,
  articleUnpublish: (id: string) => `/articles/${id}/unpublish`,
  articleSchedule: (id: string) => `/articles/${id}/schedule`,
  articleDuplicate: (id: string) => `/articles/${id}/duplicate`,
  articleViewIncrement: (id: string) => `/articles/${id}/view`,
  
  // Categories
  categories: '/categories',
  categoryById: (id: string) => `/categories/${id}`,
  
  // Types
  types: '/types',
  typeById: (id: string) => `/types/${id}`,
  
  // User Groups
  userGroups: '/user-groups',
  userGroupById: (id: string) => `/user-groups/${id}`,
  
  // Email
  emailNotify: '/email/notify',
  
  // Export/Import
  export: '/export',
  import: '/import',
  
  // Images
  imageUpload: '/images/upload'
} as const;

export const API_HEADERS = {
  'Authorization': `Bearer ${publicAnonKey}`,
  'Content-Type': 'application/json'
} as const;

export const API_HEADERS_MULTIPART = {
  'Authorization': `Bearer ${publicAnonKey}`
  // Content-Type is omitted for multipart/form-data
} as const;

// ==================== Default Values ====================

export const DEFAULT_ARTICLE = {
  title: '',
  subtitle: '',
  slug: '',
  excerpt: '',
  body: '',
  category_id: '',
  type_id: '',
  feature_image_url: '',
  thumbnail_image_url: '',
  author_name: '',
  reading_time_minutes: 5,
  tags: [] as string[],
  status: 'draft' as const,
  is_featured: false,
  scheduled_publish_at: '',
  meta_title: '',
  meta_description: '',
  canonical_url: '',
  press_category: null as null,
};

export const DEFAULT_CATEGORY = {
  name: '',
  description: '',
  icon_key: '',
  sort_order: 0,
  is_active: true
};

export const DEFAULT_TYPE = {
  name: '',
  description: '',
  sort_order: 0,
  is_active: true
};

// ==================== Pagination ====================

export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

// ==================== Validation ====================

export const VALIDATION_RULES = {
  title: {
    minLength: 3,
    maxLength: 200
  },
  subtitle: {
    maxLength: 300
  },
  slug: {
    minLength: 3,
    maxLength: 200,
    pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/
  },
  excerpt: {
    minLength: 10,
    maxLength: 500
  },
  body: {
    minLength: 50
  },
  categoryName: {
    minLength: 2,
    maxLength: 100
  },
  typeName: {
    minLength: 2,
    maxLength: 100
  },
  readingTime: {
    min: 1,
    max: 120
  }
} as const;

// ==================== UI Messages ====================

export const SUCCESS_MESSAGES = {
  articleCreated: 'Article created successfully',
  articleUpdated: 'Article updated successfully',
  articleDeleted: 'Article deleted successfully',
  articlePublished: 'Article published successfully',
  articleUnpublished: 'Article unpublished successfully',
  articleScheduled: 'Article scheduled successfully',
  articleDuplicated: 'Article duplicated successfully',
  
  categoryCreated: 'Category created successfully',
  categoryUpdated: 'Category updated successfully',
  categoryDeleted: 'Category deleted successfully',
  
  typeCreated: 'Type created successfully',
  typeUpdated: 'Type updated successfully',
  typeDeleted: 'Type deleted successfully',
  
  exportComplete: 'Export completed successfully',
  importComplete: 'Import completed successfully',
  
  emailSent: 'Email notifications sent successfully'
} as const;

export const ERROR_MESSAGES = {
  articleCreateFailed: 'Failed to create article',
  articleUpdateFailed: 'Failed to update article',
  articleDeleteFailed: 'Failed to delete article',
  articlePublishFailed: 'Failed to publish article',
  articleUnpublishFailed: 'Failed to unpublish article',
  articleScheduleFailed: 'Failed to schedule article',
  articleDuplicateFailed: 'Failed to duplicate article',
  articleNotFound: 'Article not found',
  
  categoryCreateFailed: 'Failed to create category',
  categoryUpdateFailed: 'Failed to update category',
  categoryDeleteFailed: 'Failed to delete category',
  categoryNotFound: 'Category not found',
  categoryHasArticles: 'Cannot delete category with existing articles',
  
  typeCreateFailed: 'Failed to create type',
  typeUpdateFailed: 'Failed to update type',
  typeDeleteFailed: 'Failed to delete type',
  typeNotFound: 'Type not found',
  typeHasArticles: 'Cannot delete type with existing articles',
  
  exportFailed: 'Export failed',
  importFailed: 'Import failed',
  
  emailSendFailed: 'Failed to send email notifications',
  
  validationFailed: 'Please check all required fields',
  networkError: 'Network error. Please try again.',
  unauthorized: 'You are not authorized to perform this action',
  
  imageUploadFailed: 'Failed to upload image'
} as const;

// ==================== Status Configuration ====================

export const STATUS_LABELS = {
  draft: 'Draft',
  in_review: 'In Review',
  scheduled: 'Scheduled',
  published: 'Published',
  archived: 'Archived'
} as const;

export const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-800 border-gray-200',
  in_review: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  scheduled: 'bg-blue-100 text-blue-800 border-blue-200',
  published: 'bg-green-100 text-green-800 border-green-200',
  archived: 'bg-red-100 text-red-800 border-red-200'
} as const;

// ==================== Category Icons ====================

export const CATEGORY_ICON_MAP = {
  'market-economic': 'TrendingUp',
  'personal-finance': 'PiggyBank',
  'retirement-investment': 'Target',
  'risk-insurance': 'Shield',
  'estate-tax': 'FileText',
  'financial-literacy': 'GraduationCap',
  'global-perspectives': 'Globe',
  'advisers-corner': 'Users'
} as const;

export const CATEGORY_SLUG_MAP = {
  'Market & Economic Insights': 'market-economic',
  'Personal Finance': 'personal-finance',
  'Retirement Planning': 'retirement-investment',
  'Risk & Insurance': 'risk-insurance',
  'Estate & Tax Planning': 'estate-tax',
  'Financial Literacy': 'financial-literacy',
  'Global Markets': 'global-perspectives',
  "Adviser's Corner": 'advisers-corner'
} as const;

// ==================== Local Storage Keys ====================

export const STORAGE_KEYS = {
  draftArticle: 'publications_draft_article',
  editorPreferences: 'publications_editor_preferences',
  listViewFilters: 'publications_list_filters',
  listViewSort: 'publications_list_sort'
} as const;

// ==================== Date Formats ====================

export const DATE_FORMATS = {
  display: 'MMM d, yyyy',
  displayWithTime: 'MMM d, yyyy h:mm a',
  input: 'yyyy-MM-dd',
  inputWithTime: "yyyy-MM-dd'T'HH:mm",
  api: "yyyy-MM-dd'T'HH:mm:ss'Z'"
} as const;

// ==================== Image Upload ====================

export const IMAGE_UPLOAD_CONFIG = {
  maxSizeInMB: 5,
  maxSizeInBytes: 5 * 1024 * 1024,
  acceptedFormats: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  acceptedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif']
} as const;

// ==================== Editor Configuration ====================

export const EDITOR_CONFIG = {
  /** Auto-save interval in milliseconds (30 seconds) */
  autoSaveInterval: 30_000,
  /** Minimum content length before auto-save triggers */
  minAutoSaveLength: 20,
  /** Maximum image upload size in bytes (5 MB) */
  maxImageSize: 5 * 1024 * 1024,
} as const;

// ==================== Press Category Configuration ====================

/**
 * Press category options for the Press page.
 * Maps internal keys to display labels matching the public Press page tabs.
 */
export const PRESS_CATEGORY_OPTIONS = [
  { value: 'company_news', label: 'Company News' },
  { value: 'product_launch', label: 'Product Launch' },
  { value: 'awards', label: 'Awards' },
  { value: 'team_news', label: 'Team News' },
  { value: 'industry_insights', label: 'Industry Insights' },
] as const;

export const PRESS_CATEGORY_LABELS: Record<string, string> = {
  company_news: 'Company News',
  product_launch: 'Product Launch',
  awards: 'Awards',
  team_news: 'Team News',
  industry_insights: 'Industry Insights',
} as const;

// ==================== Newsletter Subscriber Constants ====================

/**
 * Status indicator config for newsletter subscribers.
 * §5.3 — centralised, config-driven status presentation.
 * §8.3 — follows the admin panel colour vocabulary.
 */
export const SUBSCRIBER_STATUS_CONFIG = {
  active: {
    label: 'Active',
    badgeClass: 'bg-green-600 hover:bg-green-700 text-white',
    dotClass: 'bg-green-500',
  },
  pending: {
    label: 'Pending',
    badgeClass: 'bg-amber-500 hover:bg-amber-600 text-white',
    dotClass: 'bg-amber-500',
  },
  unsubscribed: {
    label: 'Unsubscribed',
    badgeClass: 'bg-red-600 hover:bg-red-700 text-white',
    dotClass: 'bg-red-500',
  },
} as const;

/**
 * Human-readable labels for subscriber sources.
 */
export const SUBSCRIBER_SOURCE_LABELS: Record<string, string> = {
  'Footer Newsletter': 'Website',
  'Admin Manual Upload': 'Manual',
  'Admin Bulk Upload': 'Bulk Import',
  unknown: 'Unknown',
} as const;

/**
 * Time-range filter options for the unsubscribed view.
 */
export const UNSUB_TIME_RANGE_OPTIONS = [
  { value: 'all', label: 'All Time' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
] as const;

/**
 * Day-count lookup for time-range filters.
 */
export const UNSUB_TIME_RANGE_DAYS: Record<string, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
} as const;