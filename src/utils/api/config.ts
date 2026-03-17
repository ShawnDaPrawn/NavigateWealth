/**
 * API Configuration
 * Centralized configuration for API endpoints
 */
import { projectId } from '../supabase/info';

export const API_CONFIG = {
  BASE_URL: `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379`
};

export const getModuleUrl = (module: string) => `${API_CONFIG.BASE_URL}/${module}`;
