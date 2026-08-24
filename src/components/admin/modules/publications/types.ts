/**
 * Publications Module - Type Definitions
 * Navigate Wealth Admin Dashboard
 *
 * Comprehensive type system for the Publications module including:
 * - Article types and statuses
 * - Category management types
 * - Content type definitions
 * - Input/Update types for CRUD operations
 * - Filter and search types
 * - Settings and configuration types
 *
 * @module publications/types
 */

// The barrel every consumer imports from — each slice lives under types/.
export * from './types/articles';
export * from './types/taxonomy';
export * from './types/queries';
export * from './types/platform';
export * from './types/api';
export * from './types/constants';
export * from './types/aiContent';
