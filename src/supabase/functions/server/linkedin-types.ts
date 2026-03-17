/**
 * LinkedIn Integration — Type Definitions
 *
 * Types for the LinkedIn OAuth 2.0 flow and Share on LinkedIn (Posts API v202401).
 *
 * The app uses the "Share on LinkedIn" product which grants `w_member_social` scope
 * and exposes the versioned REST API endpoints:
 *   /rest/posts         — create posts (text, article, image)
 *   /rest/images        — initialise + upload images
 *   /rest/documents     — initialise + upload documents
 *
 * @module linkedin/types
 */

// ============================================================================
// OAuth Types
// ============================================================================

export interface LinkedInTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope: string;
}

export interface LinkedInStoredToken {
  accessToken: string;
  expiresAt: string; // ISO date string
  refreshToken?: string;
  refreshTokenExpiresAt?: string;
  scope: string;
  personUrn: string;
  profileName: string;
  profileEmail?: string;
  connectedAt: string;
}

// ============================================================================
// Profile Types
// ============================================================================

/**
 * Response from LinkedIn /v2/me endpoint.
 * Available with `w_member_social` scope (no `openid` required).
 */
export interface LinkedInMeResponse {
  id: string;
  localizedFirstName?: string;
  localizedLastName?: string;
  vanityName?: string;
}

/**
 * Legacy OpenID Connect userinfo response — kept for reference.
 * Requires `openid profile email` scopes which need the separate
 * "Sign In with LinkedIn using OpenID Connect" product.
 */
export interface LinkedInProfile {
  sub: string;
  name: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  email_verified?: boolean;
  picture?: string;
  locale?: { country: string; language: string };
}

export interface LinkedInConnectionStatus {
  connected: boolean;
  personUrn?: string;
  profileName?: string;
  profileEmail?: string;
  expiresAt?: string;
  connectedAt?: string;
}

// ============================================================================
// Share / Posts API Types (v202401)
// ============================================================================

export type ShareVisibility = 'PUBLIC' | 'CONNECTIONS';
export type ShareMediaCategory = 'NONE' | 'ARTICLE' | 'IMAGE' | 'VIDEO';

export interface ShareTextInput {
  text: string;
  visibility?: ShareVisibility;
}

export interface ShareArticleInput {
  text: string;
  url: string;
  title?: string;
  description?: string;
  visibility?: ShareVisibility;
}

export interface ShareImageInput {
  text: string;
  imageUrl: string;       // URL of the image to upload (could be a signed URL from storage)
  title?: string;
  description?: string;
  visibility?: ShareVisibility;
}

export interface ShareResult {
  success: boolean;
  postId?: string;
  error?: string;
}

// ============================================================================
// Image Upload Types (Posts API v202401)
// ============================================================================

/**
 * Response from POST /rest/images?action=initializeUpload
 */
export interface InitializeImageUploadResponse {
  value: {
    uploadUrlExpiresAt: number;
    uploadUrl: string;
    image: string; // urn:li:image:{id}
  };
}

/**
 * @deprecated — UGC registerUpload response. Kept for reference only.
 * The app now uses the Posts API /rest/images endpoint.
 */
export interface RegisterUploadResponse {
  value: {
    uploadMechanism: {
      'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': {
        headers: Record<string, string>;
        uploadUrl: string;
      };
    };
    mediaArtifact: string;
    asset: string;
  };
}
