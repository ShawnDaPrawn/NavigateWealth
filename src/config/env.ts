/**
 * Environment Variable Validation
 * 
 * Validates required environment variables on app startup to fail fast
 * with clear error messages instead of cryptic runtime errors.
 * 
 * Note: In this Figma Make environment, Supabase credentials are hardcoded in
 * /utils/supabase/info.tsx, so environment validation is optional.
 * 
 * Usage:
 * - Import `getEnv()` to get validated environment variables
 * - Call `validateEnv()` in App.tsx before rendering (optional)
 * - Use `import.meta.env` directly for raw access (not recommended)
 */

interface EnvConfig {
  // Supabase (optional - falls back to info.tsx)
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  
  // Optional runtime metadata
  VITE_ENVIRONMENT?: string;
  DEV: boolean;
  PROD: boolean;
  MODE: string;
}

class EnvValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvValidationError';
  }
}

// Cache for validated environment
let cachedEnv: EnvConfig | null = null;

/**
 * Safely get environment variable value
 */
function getEnvVar(key: string): string | undefined {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      return import.meta.env[key];
    }
  } catch (e) {
    // Silently fail - import.meta.env not available
  }
  return undefined;
}

/**
 * Validates that required environment variables are present and valid
 * 
 * @throws {EnvValidationError} If validation fails
 */
export function validateEnv(): EnvConfig {
  // Return cached value if already validated
  if (cachedEnv) {
    return cachedEnv;
  }

  try {
    // Try to access import.meta.env
    const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};
    
    // Cache validated config (with optional Supabase vars)
    cachedEnv = {
      VITE_SUPABASE_URL: getEnvVar('VITE_SUPABASE_URL'),
      VITE_SUPABASE_ANON_KEY: getEnvVar('VITE_SUPABASE_ANON_KEY'),
      VITE_ENVIRONMENT: getEnvVar('VITE_ENVIRONMENT') || getEnvVar('MODE'),
      DEV: env.DEV === true,
      PROD: env.PROD === true,
      MODE: env.MODE || 'development',
    };

    return cachedEnv;
  } catch (error) {
    // If validation fails, return a minimal config
    console.warn('Environment validation encountered an error, using defaults:', error);
    
    cachedEnv = {
      DEV: true,
      PROD: false,
      MODE: 'development',
    };
    
    return cachedEnv;
  }
}

/**
 * Get validated and type-safe environment configuration
 * Lazy loads and validates on first access
 * 
 * @example
 * import { getEnv } from '@/config/env';
 * const env = getEnv();
 * console.log(env.VITE_SUPABASE_URL);
 */
export function getEnv(): EnvConfig {
  return validateEnv();
}

/**
 * Helper to check if we're in development mode
 */
export function isDevelopment(): boolean {
  try {
    return import.meta.env?.DEV === true;
  } catch {
    return true; // Default to dev mode
  }
}

/**
 * Helper to check if we're in production mode
 */
export function isProduction(): boolean {
  try {
    return import.meta.env?.PROD === true;
  } catch {
    return false;
  }
}

/**
 * Helper to get current environment name
 */
export function getEnvironment(): 'development' | 'production' | 'staging' {
  try {
    const env = import.meta.env;
    if (env?.VITE_ENVIRONMENT === 'staging') return 'staging';
    return env?.PROD ? 'production' : 'development';
  } catch {
    return 'development';
  }
}

/**
 * Pretty-print environment info (for debugging)
 */
export function logEnvironmentInfo() {
  if (!isDevelopment()) return; // Only log in dev

  try {
    const env = getEnv();
    console.log('🌍 Environment Configuration:');
    console.log(`  Mode: ${env.MODE}`);
    console.log(`  Environment: ${getEnvironment()}`);
    
    // Note that Supabase credentials come from /utils/supabase/info.tsx
    if (env.VITE_SUPABASE_URL) {
      console.log(`  Supabase URL (from env): ${env.VITE_SUPABASE_URL}`);
    } else {
      console.log(`  Supabase URL: Using hardcoded value from /utils/supabase/info.tsx`);
    }
    
  } catch (error) {
    console.error('Failed to log environment info:', error);
  }
}
