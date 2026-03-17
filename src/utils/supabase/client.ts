/**
 * Supabase Client
 * Browser-side Supabase client initialization
 * Fixed: Using versioned import to prevent Node.js process module errors
 */

import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js@2.39.3';
import { projectId, publicAnonKey } from './info';

const supabaseUrl = `https://${projectId}.supabase.co`;

// Create a singleton instance to avoid creating multiple clients
let supabaseInstance: SupabaseClient | null = null;

/**
 * Get or create Supabase client singleton
 * Configured with robust auth settings for session persistence and URL detection
 */
export function createClient(): SupabaseClient {
  if (!supabaseInstance) {
    console.log('Creating new Supabase client instance (Singleton)');
    supabaseInstance = createSupabaseClient(supabaseUrl, publicAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      },
      global: {
        headers: {
          'X-Client-Info': 'supabase-js-web',
        },
      },
    });
  }
  return supabaseInstance as SupabaseClient;
}

/**
 * Alias for createClient to support different import styles in the codebase
 */
export const getSupabaseClient = createClient;

/**
 * Get Supabase URL
 */
export function getSupabaseUrl(): string {
  return supabaseUrl;
}

/**
 * Get public anon key
 */
export function getAnonKey(): string {
  return publicAnonKey;
}
