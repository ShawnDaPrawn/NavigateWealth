/**
 * HTTP plumbing for the social-media API slices: base URLs, auth headers,
 * response handling, and the typed get/post/put/del helpers.
 */
import { projectId, publicAnonKey } from '../../../../../utils/supabase/info';
import { logger } from '../../../../../utils/logger';
import { getErrorMessage } from '../../../../../utils/errorUtils';

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends APIResponse<T[]> {
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Profile API Types

export const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379`;
export const SOCIAL_MEDIA_BASE = `${BASE_URL}/social-marketing`;

const defaultHeaders = {
  Authorization: `Bearer ${publicAnonKey}`,
  'Content-Type': 'application/json',
};

// ============================================================================
// Helper Functions
// ============================================================================

/** Retrieve session token for authenticated requests */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const { createClient } = await import('../../../../../utils/supabase/client');
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (token) {
      return {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };
    }
  } catch {
    // Fall through to default headers
  }
  return defaultHeaders;
}

export async function handleResponse<T>(response: Response): Promise<APIResponse<T>> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    return {
      success: false,
      error: errorData.error || `HTTP ${response.status}: ${response.statusText}`,
    };
  }

  const data = await response.json();
  return {
    success: true,
    data: data.data || data,
  };
}

export async function get<T>(url: string): Promise<APIResponse<T>> {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });
    return handleResponse<T>(response);
  } catch (error) {
    logger.error('API GET failed', error, { url });
    return {
      success: false,
      error: getErrorMessage(error) || 'Network error',
    };
  }
}

export async function post<T>(url: string, body?: unknown): Promise<APIResponse<T>> {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(response);
  } catch (error) {
    logger.error('API POST failed', error, { url });
    return {
      success: false,
      error: getErrorMessage(error) || 'Network error',
    };
  }
}

export async function put<T>(url: string, body?: unknown): Promise<APIResponse<T>> {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(url, {
      method: 'PUT',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(response);
  } catch (error) {
    logger.error('API PUT failed', error, { url });
    return {
      success: false,
      error: getErrorMessage(error) || 'Network error',
    };
  }
}

export async function del<T>(url: string): Promise<APIResponse<T>> {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(url, {
      method: 'DELETE',
      headers,
    });
    return handleResponse<T>(response);
  } catch (error) {
    logger.error('API DELETE failed', error, { url });
    return {
      success: false,
      error: getErrorMessage(error) || 'Network error',
    };
  }
}

// ============================================================================
// Social Profiles API
// ============================================================================
