/**
 * Product Management Module - Main Index
 */

export { ProductManagementModule } from './ProductManagementModule';
export * from './types';
export * from './api';
export * from '../../../../shared/product-keys';

// --- public API used by other modules and by code outside admin/modules ---
export { ProductManagementSkeleton } from './components/ProductManagementSkeleton';
export { DEFAULT_SCHEMAS } from './defaults';
