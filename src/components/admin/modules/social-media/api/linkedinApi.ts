/**
 * LinkedIn integration. One slice of the social-media API client —
 * api.ts re-exports the whole surface.
 */
import { logger } from '../../../../../utils/logger';
import { getErrorMessage } from '../../../../../utils/errorUtils';
import { BASE_URL, getAuthHeaders, handleResponse, type APIResponse } from './apiBase';

export interface LinkedInConnectionStatus {
  connected: boolean;
  personUrn?: string;
  profileName?: string;
  profileEmail?: string;
  expiresAt?: string;
  connectedAt?: string;
}

export interface LinkedInShareResult {
  postId?: string;
}

const LINKEDIN_BASE = `${BASE_URL}/linkedin`;

export const linkedinApi = {
  /**
   * Get the LinkedIn OAuth authorization URL.
   * The frontend should redirect the user to this URL.
   */
  async getAuthUrl(redirectUri: string): Promise<APIResponse<{ authUrl: string }>> {
    try {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams({ redirectUri });
      const response = await fetch(`${LINKEDIN_BASE}/auth-url?${params.toString()}`, {
        method: 'GET',
        headers,
      });
      return handleResponse<{ authUrl: string }>(response);
    } catch (error) {
      logger.error('Failed to get LinkedIn auth URL', error);
      return {
        success: false,
        error: getErrorMessage(error) || 'Failed to get LinkedIn auth URL',
      };
    }
  },

  /**
   * Exchange the OAuth callback code for tokens.
   */
  async handleCallback(
    code: string,
    state: string,
    redirectUri: string,
  ): Promise<APIResponse<LinkedInConnectionStatus>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${LINKEDIN_BASE}/callback`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ code, state, redirectUri }),
      });
      return handleResponse<LinkedInConnectionStatus>(response);
    } catch (error) {
      logger.error('LinkedIn OAuth callback failed', error);
      return {
        success: false,
        error: getErrorMessage(error) || 'LinkedIn connection failed',
      };
    }
  },

  /**
   * Check LinkedIn connection status.
   */
  async getStatus(): Promise<APIResponse<LinkedInConnectionStatus>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${LINKEDIN_BASE}/status`, {
        method: 'GET',
        headers,
      });
      return handleResponse<LinkedInConnectionStatus>(response);
    } catch (error) {
      logger.error('Failed to check LinkedIn status', error);
      return {
        success: false,
        error: getErrorMessage(error) || 'Failed to check LinkedIn status',
      };
    }
  },

  /**
   * Disconnect LinkedIn.
   */
  async disconnect(): Promise<APIResponse<void>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${LINKEDIN_BASE}/disconnect`, {
        method: 'POST',
        headers,
      });
      return handleResponse<void>(response);
    } catch (error) {
      logger.error('Failed to disconnect LinkedIn', error);
      return {
        success: false,
        error: getErrorMessage(error) || 'Failed to disconnect LinkedIn',
      };
    }
  },

  /**
   * Share a text-only post on LinkedIn.
   */
  async shareText(
    text: string,
    visibility: 'PUBLIC' | 'CONNECTIONS' = 'PUBLIC',
  ): Promise<APIResponse<LinkedInShareResult>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${LINKEDIN_BASE}/share/text`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ text, visibility }),
      });
      return handleResponse<LinkedInShareResult>(response);
    } catch (error) {
      logger.error('LinkedIn text share failed', error);
      return {
        success: false,
        error: getErrorMessage(error) || 'Failed to share on LinkedIn',
      };
    }
  },

  /**
   * Share an article/URL on LinkedIn.
   */
  async shareArticle(
    text: string,
    url: string,
    title?: string,
    description?: string,
    visibility: 'PUBLIC' | 'CONNECTIONS' = 'PUBLIC',
  ): Promise<APIResponse<LinkedInShareResult>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${LINKEDIN_BASE}/share/article`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ text, url, title, description, visibility }),
      });
      return handleResponse<LinkedInShareResult>(response);
    } catch (error) {
      logger.error('LinkedIn article share failed', error);
      return {
        success: false,
        error: getErrorMessage(error) || 'Failed to share article on LinkedIn',
      };
    }
  },

  /**
   * Share an image on LinkedIn.
   */
  async shareImage(
    text: string,
    imageUrl: string,
    title?: string,
    description?: string,
    visibility: 'PUBLIC' | 'CONNECTIONS' = 'PUBLIC',
  ): Promise<APIResponse<LinkedInShareResult>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${LINKEDIN_BASE}/share/image`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ text, imageUrl, title, description, visibility }),
      });
      return handleResponse<LinkedInShareResult>(response);
    } catch (error) {
      logger.error('LinkedIn image share failed', error);
      return {
        success: false,
        error: getErrorMessage(error) || 'Failed to share image on LinkedIn',
      };
    }
  },
};
