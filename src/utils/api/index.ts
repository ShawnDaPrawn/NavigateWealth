/**
 * API Module - Centralized Exports
 * 
 * Import everything you need from one place:
 * import { api, APIError } from '@/utils/api';
 * 
 * NOTE: ENDPOINTS has been deprecated and removed.
 * Each module defines its own ENDPOINTS in its local constants.ts
 * (Guidelines §5.3).
 */

export { api, APIClientError as APIError } from './client';
export type * from './types';