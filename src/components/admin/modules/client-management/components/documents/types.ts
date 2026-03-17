/**
 * TypeScript type definitions for Documents/History module
 */

import { DocumentType, DocumentStatus, ProductCategory } from './constants';

/**
 * Document metadata interface
 */
export interface DocumentItem {
  id: string;
  userId: string;
  type: DocumentType;
  title: string;
  uploadDate: string;
  productCategory: ProductCategory;
  policyNumber: string;
  status: DocumentStatus;
  isFavourite: boolean;
  uploadedBy: string;
  // Document specific fields
  fileName?: string;
  fileSize?: number;
  filePath?: string;
  // Link specific fields
  url?: string;
  description?: string;
}

/**
 * Document upload request payload
 */
export interface DocumentUploadPayload {
  file: File;
  title: string;
  productCategory: ProductCategory;
  policyNumber: string;
  uploadedBy: string;
}

/**
 * Link creation request payload
 */
export interface LinkCreationPayload {
  title: string;
  url: string;
  description?: string;
  productCategory: ProductCategory;
  policyNumber: string;
  uploadedBy: string;
}

/**
 * Document update payload (for PATCH requests)
 */
export interface DocumentUpdatePayload {
  status?: DocumentStatus;
  isFavourite?: boolean;
  title?: string;
  policyNumber?: string;
  productCategory?: ProductCategory;
}

/**
 * API response for fetching documents
 */
export interface FetchDocumentsResponse {
  success: boolean;
  count: number;
  documents: DocumentItem[];
}

/**
 * API response for document operations
 */
export interface DocumentOperationResponse {
  success: boolean;
  document?: DocumentItem;
  message?: string;
  error?: string;
}

/**
 * API response for download URL generation
 */
export interface DownloadUrlResponse {
  success: boolean;
  url?: string;
  fileName?: string;
  error?: string;
}

/**
 * Document filter state
 */
export interface DocumentFilters {
  searchQuery: string;
  categoryFilter: string;
  dateRangeFilter: string;
}

/**
 * Document statistics
 */
export interface DocumentStats {
  totalItems: number;
  totalDocs: number;
  totalLinks: number;
  newItems: number;
  favouriteItems: number;
}

/**
 * Upload form state
 */
export interface UploadFormState {
  type: DocumentType;
  // Document fields
  selectedFile: File | null;
  documentTitle: string;
  // Link fields
  linkTitle: string;
  linkUrl: string;
  linkDescription: string;
  // Common fields
  productCategory: ProductCategory;
  policyNumber: string;
}
