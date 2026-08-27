/**
 * Publications Module - API Client
 * Navigate Wealth Admin Dashboard
 *
 * Centralized API client for the Publications module with:
 * - Articles CRUD operations
 * - Categories management
 * - Content types management
 * - Initialization and settings
 * - Error handling and type safety
 *
 * @module publications/api
 */

import { publicAnonKey } from '../../../../utils/supabase/info';
import { getModuleUrl } from '../../../../utils/api/config';
import { logger } from '../../../../utils/logger';
import type { NewsItem } from './types';
import type {
  SubscriberListResponse,
  SubscriberMutationResponse,
  UpdateSubscriberInput,
  BulkUploadResponse,
} from './types';
import { RSS_PROXY_URL, getAuthHeaders, handleResponse } from './api/shared';
import { ArticlesAPI } from './api/articles';
import { CategoriesAPI, ContentTypesAPI } from './api/taxonomy';
import { StatsAPI, InitializationAPI, SettingsAPI } from './api/platform';
import { AIWritingAPI, TemplatesAPI, VersionsAPI, AutoContentAPI } from './api/aiContent';

// Re-exported so consumers keep importing every group from this module.
export { PublicationsAPIError } from './api/shared';
export { ArticlesAPI } from './api/articles';
export { CategoriesAPI, ContentTypesAPI } from './api/taxonomy';
export { StatsAPI, InitializationAPI, SettingsAPI } from './api/platform';
export { AIWritingAPI, TemplatesAPI, VersionsAPI, AutoContentAPI } from './api/aiContent';

// ============================================================================
// AGGREGATED API EXPORT
// ============================================================================

/**
 * Complete Publications API
 * Aggregated namespace for all API operations
 */
export const PublicationsAPI = {
  Articles: ArticlesAPI,
  Categories: CategoriesAPI,
  Types: ContentTypesAPI,
  Stats: StatsAPI,
  Init: InitializationAPI,
  Settings: SettingsAPI,
  AI: AIWritingAPI,
  Templates: TemplatesAPI,
  Versions: VersionsAPI,
  AutoContent: AutoContentAPI,
};

/**
 * Parse RSS Feed via Proxy
 * Used by Market News feature
 */
export async function fetchRSSFeed(url: string): Promise<NewsItem[]> {
  try {
    const proxyUrl = `${RSS_PROXY_URL}?url=${encodeURIComponent(url)}`;

    const response = await fetch(proxyUrl, {
      signal: AbortSignal.timeout(20000),
      headers: {
        Authorization: `Bearer ${publicAnonKey}`,
      },
    });

    if (!response.ok) {
      logger.warn(`RSS fetch failed for ${url}: ${response.status}`);
      return [];
    }

    const data = await response.json();

    if (data.status === 'ok' && data.items) {
      return data.items.map((item: Record<string, unknown>) => ({
        title: typeof item.title === 'string' ? item.title : 'Untitled',
        pubDate: typeof item.pubDate === 'string' ? item.pubDate : new Date().toISOString(),
        author: typeof item.author === 'string' ? item.author : data.feed?.title || 'Investing.com',
        link: typeof item.link === 'string' ? item.link : '#',
        image: getRSSImage(item),
        description: typeof item.description === 'string' ? item.description : '',
        source: data.feed?.title || 'News',
      }));
    }

    return [];
  } catch (error) {
    logger.error(`RSS feed fetch failed for ${url}`, error);
    return [];
  }
}

function getRSSImage(item: Record<string, unknown>): string {
  if (
    typeof item.enclosure === 'object' &&
    item.enclosure &&
    'link' in item.enclosure &&
    typeof item.enclosure.link === 'string'
  ) {
    return item.enclosure.link;
  }
  if (typeof item.thumbnail === 'string') {
    return item.thumbnail;
  }
  // No remote fallback. Feed thumbnails are blocked by the CSP (an allowlist
  // cannot express "whatever URL a feed supplies"), and a hard-coded remote
  // fallback would be the ONE image that still loaded — so every card would
  // show the same stock picture instead of an honest "no preview". MarketNewsTab
  // renders a local placeholder when this is empty.
  return '';
}

// ============================================================================
// NEWSLETTER SUBSCRIBERS API (§5.1 — data boundary)
// ============================================================================

const NEWSLETTER_URL = getModuleUrl('newsletter');

/**
 * Newsletter Subscribers API namespace.
 * Uses dynamic auth headers because newsletter admin routes require authentication (§5.1).
 */
export const NewsletterAPI = {
  /** GET /newsletter/admin/subscribers */
  async getSubscribers(): Promise<SubscriberListResponse> {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${NEWSLETTER_URL}/admin/subscribers`, { headers: authHeaders });
    return handleResponse<SubscriberListResponse>(response);
  },

  /** POST /newsletter/admin/add */
  async addSubscriber(input: {
    email: string;
    firstName: string;
    surname: string;
  }): Promise<SubscriberMutationResponse> {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${NEWSLETTER_URL}/admin/add`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(input),
    });
    return handleResponse<SubscriberMutationResponse>(response);
  },

  /** POST /newsletter/admin/bulk */
  async bulkAdd(
    subscribers: {
      email: string;
      firstName?: string;
      surname?: string;
    }[],
  ): Promise<BulkUploadResponse> {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${NEWSLETTER_URL}/admin/bulk`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ subscribers }),
    });
    return handleResponse<BulkUploadResponse>(response);
  },

  /** POST /newsletter/admin/remove */
  async removeSubscriber(email: string): Promise<SubscriberMutationResponse> {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${NEWSLETTER_URL}/admin/remove`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ email }),
    });
    return handleResponse<SubscriberMutationResponse>(response);
  },

  /** POST /newsletter/admin/resubscribe */
  async resubscribe(email: string): Promise<SubscriberMutationResponse> {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${NEWSLETTER_URL}/admin/resubscribe`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ email }),
    });
    return handleResponse<SubscriberMutationResponse>(response);
  },

  /** POST /newsletter/admin/update */
  async updateSubscriber(input: UpdateSubscriberInput): Promise<SubscriberMutationResponse> {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${NEWSLETTER_URL}/admin/update`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(input),
    });
    return handleResponse<SubscriberMutationResponse>(response);
  },
};

export default PublicationsAPI;
