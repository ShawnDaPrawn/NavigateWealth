/**
 * Utility functions for Documents/History module
 */

import { 
  URL_REGEX, 
  FILE_CONSTRAINTS, 
  CATEGORY_CONFIG, 
  DATE_RANGE_OPTIONS,
  DOCUMENT_TYPES
} from './constants';
import { DocumentItem, DocumentFilters, DocumentStats } from './types';

/**
 * Validates a URL string
 */
export function isValidUrl(url: string): boolean {
  return URL_REGEX.test(url);
}

/**
 * Validates a file before upload
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > FILE_CONSTRAINTS.MAX_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size must be less than ${FILE_CONSTRAINTS.MAX_SIZE_MB}MB`,
    };
  }

  // Check file type
  if (!FILE_CONSTRAINTS.ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid file type. Allowed types: PDF, Word, Excel, JPG, PNG, GIF',
    };
  }

  return { valid: true };
}

/**
 * Formats file size from bytes to human-readable string
 */
export function formatFileSize(bytes: number | undefined): string {
  if (!bytes) return '';
  
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Formats date to localized string
 */
export function formatDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Gets category styling configuration
 */
export function getCategoryConfig(category: string) {
  return CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG] || CATEGORY_CONFIG['General'];
}

/**
 * Filters documents based on search query, category, and date range
 */
export function filterDocuments(
  documents: DocumentItem[],
  filters: DocumentFilters
): DocumentItem[] {
  let filtered = [...documents];

  // Search filter
  if (filters.searchQuery) {
    const query = filters.searchQuery.toLowerCase();
    filtered = filtered.filter(item =>
      item.title.toLowerCase().includes(query) ||
      (item.fileName && item.fileName.toLowerCase().includes(query)) ||
      (item.url && item.url.toLowerCase().includes(query)) ||
      (item.description && item.description.toLowerCase().includes(query)) ||
      item.policyNumber.toLowerCase().includes(query)
    );
  }

  // Category filter
  if (filters.categoryFilter !== 'all') {
    filtered = filtered.filter(item => item.productCategory === filters.categoryFilter);
  }

  // Date range filter
  if (filters.dateRangeFilter !== 'all') {
    const rangeOption = DATE_RANGE_OPTIONS.find(r => r.value === filters.dateRangeFilter);
    if (rangeOption && 'days' in rangeOption) {
      const now = new Date();
      const cutoffDate = new Date(now.getTime() - (rangeOption.days * 24 * 60 * 60 * 1000));
      filtered = filtered.filter(item => new Date(item.uploadDate) >= cutoffDate);
    }
  }

  // Sort by upload date, newest first
  return filtered.sort((a, b) =>
    new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()
  );
}

/**
 * Calculates document statistics
 */
export function calculateStats(documents: DocumentItem[]): DocumentStats {
  return {
    totalItems: documents.length,
    totalDocs: documents.filter(d => d.type === DOCUMENT_TYPES.DOCUMENT).length,
    totalLinks: documents.filter(d => d.type === DOCUMENT_TYPES.LINK).length,
    newItems: documents.filter(d => d.status === 'new').length,
    favouriteItems: documents.filter(d => d.isFavourite).length,
  };
}

/**
 * Sorts documents by a specific field
 */
export function sortDocuments(
  documents: DocumentItem[],
  sortBy: 'date' | 'title' | 'category',
  order: 'asc' | 'desc' = 'desc'
): DocumentItem[] {
  const sorted = [...documents];

  switch (sortBy) {
    case 'date':
      sorted.sort((a, b) => {
        const comparison = new Date(a.uploadDate).getTime() - new Date(b.uploadDate).getTime();
        return order === 'asc' ? comparison : -comparison;
      });
      break;
    case 'title':
      sorted.sort((a, b) => {
        const comparison = a.title.localeCompare(b.title);
        return order === 'asc' ? comparison : -comparison;
      });
      break;
    case 'category':
      sorted.sort((a, b) => {
        const comparison = a.productCategory.localeCompare(b.productCategory);
        return order === 'asc' ? comparison : -comparison;
      });
      break;
  }

  return sorted;
}

/**
 * Groups documents by category
 */
export function groupByCategory(documents: DocumentItem[]): Record<string, DocumentItem[]> {
  return documents.reduce((groups, doc) => {
    const category = doc.productCategory;
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(doc);
    return groups;
  }, {} as Record<string, DocumentItem[]>);
}

/**
 * Sanitizes filename for storage
 */
export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9.-]/g, '_');
}

/**
 * Generates a unique document ID
 */
export function generateDocumentId(type: 'document' | 'link'): string {
  const timestamp = Date.now();
  const prefix = type === 'document' ? 'doc' : 'link';
  return `${prefix}_${timestamp}`;
}

/**
 * Creates a file path for storage
 */
export function createFilePath(userId: string, filename: string): string {
  const timestamp = Date.now();
  const sanitized = sanitizeFilename(filename);
  return `${userId}/${timestamp}_${sanitized}`;
}

/**
 * Extracts filename from a file path
 */
export function extractFilename(filePath: string): string {
  const parts = filePath.split('/');
  const filename = parts[parts.length - 1];
  // Remove timestamp prefix if present
  return filename.replace(/^\d+_/, '');
}

/**
 * Checks if a document is new (uploaded within last 7 days)
 */
export function isRecentDocument(uploadDate: string): boolean {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return new Date(uploadDate) >= sevenDaysAgo;
}

/**
 * Gets file extension from filename
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? `.${parts[parts.length - 1]}` : '';
}

/**
 * Validates file extension
 */
export function isValidFileExtension(filename: string): boolean {
  const ext = getFileExtension(filename).toLowerCase();
  return FILE_CONSTRAINTS.ALLOWED_EXTENSIONS.includes(ext);
}

/**
 * Debounces a function call
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Creates a safe display name for a document
 */
export function getDisplayName(document: DocumentItem): string {
  if (document.type === 'link') {
    return document.title;
  }
  return document.fileName || document.title;
}

/**
 * Determines icon color based on document type
 */
export function getDocumentTypeColor(type: 'document' | 'link'): string {
  return type === 'link' ? 'text-purple-600' : 'text-red-600';
}

/**
 * Determines background color based on document type
 */
export function getDocumentTypeBgColor(type: 'document' | 'link'): string {
  return type === 'link' ? 'bg-purple-50' : 'bg-red-50';
}