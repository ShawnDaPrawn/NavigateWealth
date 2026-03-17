/**
 * API Response Types
 * 
 * TypeScript types for API responses
 * - Ensures type safety across frontend
 * - Easy to maintain and update
 */

// Standard API response wrapper
export interface APIResponse<T = unknown> {
  data?: T;
  error?: string;
  code?: string;
  message?: string;
  timestamp?: string;
}

// Pagination
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// List response
export interface ListResponse<T> {
  items: T[];
  total: number;
}

// Success response
export interface SuccessResponse {
  success: boolean;
  message?: string;
}

// Error response
export interface ErrorResponse {
  error: string;
  code: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

// File upload response
export interface UploadResponse {
  url: string;
  filename: string;
  size: number;
  contentType: string;
}

// Export for use in components
export type { APIError } from './client';