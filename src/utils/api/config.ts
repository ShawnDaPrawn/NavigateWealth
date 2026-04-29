/**
 * API Configuration
 * Centralized configuration for API endpoints
 */
import { supabaseUrl } from '../supabase/info';

export const API_CONFIG = {
  BASE_URL: `${supabaseUrl}/functions/v1/make-server-91ed8379`
};

export const getModuleUrl = (module: string) => `${API_CONFIG.BASE_URL}/${module}`;
