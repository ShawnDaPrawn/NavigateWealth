/**
 * LinkedIn Integration — Service Layer
 *
 * Business logic for LinkedIn OAuth 2.0 and Share on LinkedIn (Posts API v202401).
 * All KV access and LinkedIn API calls are encapsulated here.
 *
 * Uses the "Share on LinkedIn" product which provides:
 *   - `w_member_social` scope (no `openid` — that requires a separate product)
 *   - Posts API endpoints: /rest/posts, /rest/images, /rest/documents
 *   - Profile endpoint: /v2/me (basic profile info)
 *
 * KV key patterns:
 *   linkedin:token:{adminUserId}   — stored OAuth token + profile info
 *   linkedin:state:{stateValue}    — ephemeral CSRF state for OAuth flow
 *
 * @module linkedin/service
 */

import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { APIError } from './error.middleware.ts';
import type {
  LinkedInTokenResponse,
  LinkedInStoredToken,
  LinkedInMeResponse,
  LinkedInConnectionStatus,
  ShareResult,
  InitializeImageUploadResponse,
  ShareVisibility,
} from './linkedin-types.ts';

const log = createModuleLogger('linkedin-service');

// ============================================================================
// Constants
// ============================================================================

const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';

// Posts API v202401 endpoints (replaces deprecated UGC API)
const LINKEDIN_POSTS_URL = 'https://api.linkedin.com/rest/posts';
const LINKEDIN_IMAGES_URL = 'https://api.linkedin.com/rest/images';

// Basic profile endpoint — works with w_member_social (no openid required)
const LINKEDIN_ME_URL = 'https://api.linkedin.com/v2/me';

// Required API version header for /rest/* endpoints
const LINKEDIN_API_VERSION = '202401';

// Only request w_member_social — the "Share on LinkedIn" product scope.
// openid/profile/email require the separate "Sign In with LinkedIn using OpenID Connect" product.
const SCOPES = 'w_member_social';

// State tokens expire after 10 minutes
const STATE_TTL_MS = 10 * 60 * 1000;

// ============================================================================
// Helpers
// ============================================================================

function getClientId(): string {
  const id = Deno.env.get('LINKEDIN_CLIENT_ID');
  if (!id) throw new APIError('LinkedIn client ID is not configured', 500, 'LINKEDIN_CONFIG_ERROR');
  return id;
}

function getClientSecret(): string {
  const secret = Deno.env.get('LINKEDIN_CLIENT_SECRET');
  if (!secret) throw new APIError('LinkedIn client secret is not configured', 500, 'LINKEDIN_CONFIG_ERROR');
  return secret;
}

function kvTokenKey(userId: string): string {
  return `linkedin:token:${userId}`;
}

function kvStateKey(state: string): string {
  return `linkedin:state:${state}`;
}

/**
 * Standard headers for the LinkedIn REST API (v202401).
 * All /rest/* endpoints require the LinkedIn-Version header.
 */
function restHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'LinkedIn-Version': LINKEDIN_API_VERSION,
    'X-Restli-Protocol-Version': '2.0.0',
  };
}

// ============================================================================
// Service
// ============================================================================

export class LinkedInService {
  // --------------------------------------------------------------------------
  // OAuth 2.0 Flow
  // --------------------------------------------------------------------------

  /**
   * Generate the LinkedIn OAuth authorization URL.
   * Stores a CSRF state token in KV keyed to the admin user.
   */
  async getAuthorizationUrl(adminUserId: string, redirectUri: string): Promise<string> {
    const state = crypto.randomUUID();

    // Store state for CSRF verification — includes userId so we can match on callback
    await kv.set(kvStateKey(state), {
      userId: adminUserId,
      redirectUri,
      createdAt: new Date().toISOString(),
    });

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: getClientId(),
      redirect_uri: redirectUri,
      state,
      scope: SCOPES,
    });

    return `${LINKEDIN_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange the authorization code for tokens, fetch the user profile,
   * and persist everything in KV.
   */
  async handleCallback(
    code: string,
    state: string,
    redirectUri: string,
  ): Promise<LinkedInConnectionStatus> {
    // 1. Verify CSRF state
    const stateData = await kv.get(kvStateKey(state));
    if (!stateData) {
      throw new APIError('Invalid or expired OAuth state. Please try connecting again.', 400, 'LINKEDIN_STATE_INVALID');
    }

    const { userId } = stateData as { userId: string; redirectUri: string; createdAt: string };

    // Check TTL
    const createdAt = new Date((stateData as { createdAt: string }).createdAt).getTime();
    if (Date.now() - createdAt > STATE_TTL_MS) {
      await kv.del(kvStateKey(state));
      throw new APIError('OAuth state has expired. Please try connecting again.', 400, 'LINKEDIN_STATE_EXPIRED');
    }

    // Clean up state immediately
    await kv.del(kvStateKey(state));

    // 2. Exchange code for access token
    const tokenResponse = await fetch(LINKEDIN_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: getClientId(),
        client_secret: getClientSecret(),
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errBody = await tokenResponse.text();
      log.error('LinkedIn token exchange failed', { status: tokenResponse.status, body: errBody });
      throw new APIError('Failed to exchange authorization code with LinkedIn', 502, 'LINKEDIN_TOKEN_ERROR');
    }

    const tokenData: LinkedInTokenResponse = await tokenResponse.json();

    // 3. Fetch basic profile via /v2/me (works with w_member_social, no openid required)
    let profileName = 'LinkedIn User';
    let personId = '';

    try {
      const meResponse = await fetch(LINKEDIN_ME_URL, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });

      if (meResponse.ok) {
        const me: LinkedInMeResponse = await meResponse.json();
        personId = me.id;
        const firstName = me.localizedFirstName || '';
        const lastName = me.localizedLastName || '';
        profileName = [firstName, lastName].filter(Boolean).join(' ') || 'LinkedIn User';
      } else {
        // /v2/me may not be available with w_member_social alone in some configurations.
        // Fall back gracefully — we can still post, we just won't have profile info.
        log.warn('LinkedIn /v2/me returned non-OK, falling back to token-only storage', {
          status: meResponse.status,
        });
      }
    } catch (meErr) {
      log.warn('LinkedIn /v2/me fetch failed, proceeding without profile info', { error: String(meErr) });
    }

    // If /v2/me didn't provide the person ID, we need it for the person URN.
    // Try extracting from the sub field if the token response includes id_token (unlikely without openid).
    // As a last resort, store a placeholder — the first share attempt will reveal the correct URN.
    const personUrn = personId ? `urn:li:person:${personId}` : '';

    // 4. Persist token + profile in KV
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
    const stored: LinkedInStoredToken = {
      accessToken: tokenData.access_token,
      expiresAt,
      refreshToken: tokenData.refresh_token,
      refreshTokenExpiresAt: tokenData.refresh_token_expires_in
        ? new Date(Date.now() + tokenData.refresh_token_expires_in * 1000).toISOString()
        : undefined,
      scope: tokenData.scope,
      personUrn,
      profileName,
      connectedAt: new Date().toISOString(),
    };

    await kv.set(kvTokenKey(userId), stored);

    log.info('LinkedIn connected successfully', { userId, personUrn: stored.personUrn });

    return {
      connected: true,
      personUrn: stored.personUrn,
      profileName: stored.profileName,
      expiresAt: stored.expiresAt,
      connectedAt: stored.connectedAt,
    };
  }

  // --------------------------------------------------------------------------
  // Connection Status
  // --------------------------------------------------------------------------

  /**
   * Check whether LinkedIn is connected for the given admin user.
   */
  async getStatus(adminUserId: string): Promise<LinkedInConnectionStatus> {
    const stored = await kv.get(kvTokenKey(adminUserId)) as LinkedInStoredToken | null;

    if (!stored) {
      return { connected: false };
    }

    // Check if token is expired
    if (new Date(stored.expiresAt) < new Date()) {
      // TODO: implement refresh token flow if refresh_token is available
      return { connected: false };
    }

    return {
      connected: true,
      personUrn: stored.personUrn,
      profileName: stored.profileName,
      profileEmail: stored.profileEmail,
      expiresAt: stored.expiresAt,
      connectedAt: stored.connectedAt,
    };
  }

  /**
   * Disconnect LinkedIn — removes stored tokens.
   */
  async disconnect(adminUserId: string): Promise<void> {
    await kv.del(kvTokenKey(adminUserId));
    log.info('LinkedIn disconnected', { userId: adminUserId });
  }

  // --------------------------------------------------------------------------
  // Internal: Get valid access token
  // --------------------------------------------------------------------------

  private async getAccessToken(adminUserId: string): Promise<{ token: string; personUrn: string }> {
    const stored = await kv.get(kvTokenKey(adminUserId)) as LinkedInStoredToken | null;

    if (!stored) {
      throw new APIError('LinkedIn is not connected. Please connect your account first.', 401, 'LINKEDIN_NOT_CONNECTED');
    }

    if (new Date(stored.expiresAt) < new Date()) {
      throw new APIError('LinkedIn access token has expired. Please reconnect your account.', 401, 'LINKEDIN_TOKEN_EXPIRED');
    }

    // If we don't have a personUrn yet, try fetching it now
    if (!stored.personUrn) {
      const personUrn = await this.resolvePersonUrn(stored.accessToken, adminUserId);
      return { token: stored.accessToken, personUrn };
    }

    return { token: stored.accessToken, personUrn: stored.personUrn };
  }

  /**
   * Resolve the person URN via /v2/me and update the stored token.
   * This is a fallback for cases where /v2/me wasn't available during callback.
   */
  private async resolvePersonUrn(accessToken: string, adminUserId: string): Promise<string> {
    const meResponse = await fetch(LINKEDIN_ME_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!meResponse.ok) {
      throw new APIError(
        'Unable to retrieve LinkedIn profile. The person URN is required to create posts. Please reconnect.',
        502,
        'LINKEDIN_PROFILE_REQUIRED',
      );
    }

    const me: LinkedInMeResponse = await meResponse.json();
    const personUrn = `urn:li:person:${me.id}`;

    // Update stored token with the resolved URN
    const stored = await kv.get(kvTokenKey(adminUserId)) as LinkedInStoredToken | null;
    if (stored) {
      stored.personUrn = personUrn;
      const firstName = me.localizedFirstName || '';
      const lastName = me.localizedLastName || '';
      stored.profileName = [firstName, lastName].filter(Boolean).join(' ') || stored.profileName;
      await kv.set(kvTokenKey(adminUserId), stored);
    }

    return personUrn;
  }

  // --------------------------------------------------------------------------
  // Share: Text (Posts API v202401)
  // --------------------------------------------------------------------------

  async shareText(
    adminUserId: string,
    text: string,
    visibility: ShareVisibility = 'PUBLIC',
  ): Promise<ShareResult> {
    const { token, personUrn } = await this.getAccessToken(adminUserId);

    const body = {
      author: personUrn,
      commentary: text,
      visibility: visibility === 'CONNECTIONS' ? 'CONNECTIONS' : 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: 'PUBLISHED',
    };

    return this.createPost(token, body);
  }

  // --------------------------------------------------------------------------
  // Share: Article / URL (Posts API v202401)
  // --------------------------------------------------------------------------

  async shareArticle(
    adminUserId: string,
    text: string,
    url: string,
    title?: string,
    description?: string,
    visibility: ShareVisibility = 'PUBLIC',
  ): Promise<ShareResult> {
    const { token, personUrn } = await this.getAccessToken(adminUserId);

    const article: Record<string, string> = { source: url };
    if (title) article.title = title;
    if (description) article.description = description;

    const body = {
      author: personUrn,
      commentary: text,
      visibility: visibility === 'CONNECTIONS' ? 'CONNECTIONS' : 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      content: { article },
      lifecycleState: 'PUBLISHED',
    };

    return this.createPost(token, body);
  }

  // --------------------------------------------------------------------------
  // Share: Image (Posts API v202401)
  // --------------------------------------------------------------------------

  async shareImage(
    adminUserId: string,
    text: string,
    imageUrl: string,
    title?: string,
    description?: string,
    visibility: ShareVisibility = 'PUBLIC',
  ): Promise<ShareResult> {
    const { token, personUrn } = await this.getAccessToken(adminUserId);

    // Step 1: Initialize image upload via /rest/images?action=initializeUpload
    const initBody = {
      initializeUploadRequest: {
        owner: personUrn,
      },
    };

    const initRes = await fetch(`${LINKEDIN_IMAGES_URL}?action=initializeUpload`, {
      method: 'POST',
      headers: restHeaders(token),
      body: JSON.stringify(initBody),
    });

    if (!initRes.ok) {
      const errText = await initRes.text();
      log.error('LinkedIn image initializeUpload failed', { status: initRes.status, body: errText });
      throw new APIError('Failed to initialize image upload with LinkedIn', 502, 'LINKEDIN_IMAGE_INIT_ERROR');
    }

    const initData: InitializeImageUploadResponse = await initRes.json();
    const uploadUrl = initData.value.uploadUrl;
    const imageUrn = initData.value.image; // urn:li:image:{id}

    // Step 2: Download the image from the provided URL
    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) {
      throw new APIError('Failed to download image from the provided URL', 400, 'LINKEDIN_IMAGE_DOWNLOAD_ERROR');
    }
    const imageBytes = await imageRes.arrayBuffer();

    // Step 3: Upload image binary to LinkedIn
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
        'LinkedIn-Version': LINKEDIN_API_VERSION,
      },
      body: imageBytes,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      log.error('LinkedIn image upload failed', { status: uploadRes.status, body: errText });
      throw new APIError('Failed to upload image to LinkedIn', 502, 'LINKEDIN_IMAGE_UPLOAD_ERROR');
    }

    // Step 4: Create the post with the uploaded image
    const article: Record<string, string> = {};
    if (title) article.title = title;
    if (description) article.description = description;

    const body: Record<string, unknown> = {
      author: personUrn,
      commentary: text,
      visibility: visibility === 'CONNECTIONS' ? 'CONNECTIONS' : 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      content: {
        media: {
          id: imageUrn,
          ...(title ? { title } : {}),
          ...(description ? { altText: description } : {}),
        },
      },
      lifecycleState: 'PUBLISHED',
    };

    return this.createPost(token, body);
  }

  // --------------------------------------------------------------------------
  // Internal: Create post via Posts API v202401
  // --------------------------------------------------------------------------

  private async createPost(token: string, body: unknown): Promise<ShareResult> {
    const response = await fetch(LINKEDIN_POSTS_URL, {
      method: 'POST',
      headers: restHeaders(token),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      log.error('LinkedIn post creation failed', { status: response.status, body: errText });
      return {
        success: false,
        error: `LinkedIn API error (${response.status}): ${errText}`,
      };
    }

    // The post ID is in the x-restli-id header (or X-RestLi-Id)
    const postId = response.headers.get('x-restli-id') || response.headers.get('X-RestLi-Id') || undefined;

    log.info('LinkedIn post created successfully', { postId });

    return { success: true, postId };
  }
}
