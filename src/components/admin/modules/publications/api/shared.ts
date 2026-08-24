/**
 * What every publications API group shares: module URLs, auth headers, the
 * email-engagement event, and the API error type.
 *
 * Split out of `api.ts` (1,441 lines).
 */
import { publicAnonKey } from '../../../../../utils/supabase/info';
import { getModuleUrl } from '../../../../../utils/api/config';
import { createClient } from '../../../../../utils/supabase/client';

// ============================================================================
// BASE URL CONFIGURATION
// ============================================================================

export const BASE_URL = getModuleUrl('publications');
export const RSS_PROXY_URL = getModuleUrl('rss-proxy');
export const AUTO_CONTENT_URL = getModuleUrl('auto-content');

export const headers = {
  Authorization: `Bearer ${publicAnonKey}`,
  'Content-Type': 'application/json',
};

export const EMAIL_ENGAGEMENT_CHANGED_EVENT = 'publications:email-engagement-changed';

export function notifyEmailEngagementChanged(
  articleId: string,
  reason:
    | 'published'
    | 'retry_queued'
    | 'notification_job_updated'
    | 'notification_campaign_updated',
): void {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent(EMAIL_ENGAGEMENT_CHANGED_EVENT, {
      detail: {
        articleId,
        reason,
      },
    }),
  );
}

/**
 * Get auth headers with user session token for authenticated endpoints.
 * Falls back to anon key if no session is available (§5.1 — client-side auth is UX only).
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token || publicAnonKey;
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  } catch {
    return headers;
  }
}

export async function getMultipartAuthHeaders(): Promise<Record<string, string>> {
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token || publicAnonKey;
    return {
      Authorization: `Bearer ${token}`,
    };
  } catch {
    return {
      Authorization: `Bearer ${publicAnonKey}`,
    };
  }
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * API Error class
 */
export class PublicationsAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: unknown,
  ) {
    super(message);
    this.name = 'PublicationsAPIError';
  }
}

/**
 * Handle API response
 */
export async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new PublicationsAPIError(
      errorData.error || `API request failed with status ${response.status}`,
      response.status,
      errorData,
    );
  }

  const data = await response.json();
  return data.data || data;
}
