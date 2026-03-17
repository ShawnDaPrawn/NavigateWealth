// Authentication Module - Clean API exports

// Core Services
export * from './authService';
export * from './profileService';

// Types
export * from './types';

// Constants
export * from './constants';

// Error Handling
export * from './errorHandler';

// Supabase Client
// Re-export from the central Supabase client configuration
export { getSupabaseClient, getSupabaseUrl, getAnonKey } from '../supabase/client';

// Password Validation (re-export existing)
export * from './passwordValidation';

// Security Service (rate limiting, logging)
export * from './securityService';
