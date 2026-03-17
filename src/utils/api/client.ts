/**
 * Centralized API Client
 * 
 * Single source of truth for all API calls
 * - Consistent error handling
 * - Automatic token management
 * - TypeScript type safety
 * - Request/response interceptors
 */

import { projectId, publicAnonKey } from '../supabase/info';
import { createClient } from '../supabase/client';

/**
 * Custom event dispatched when the API client detects the auth session is
 * irrecoverably dead (getSession + refreshSession both failed).
 * AuthContext listens for this to clear stale user state and redirect to login.
 */
export const AUTH_SESSION_EXPIRED_EVENT = 'navigate-wealth:session-expired';

/** Debounce guard — only dispatch once per 2s window to prevent event storms
 *  when multiple queries detect the dead session simultaneously. */
let lastSessionExpiredDispatch = 0;

export function dispatchSessionExpired() {
  if (typeof window !== 'undefined') {
    const now = Date.now();
    if (now - lastSessionExpiredDispatch < 2000) return; // skip if fired recently
    lastSessionExpiredDispatch = now;
    window.dispatchEvent(new CustomEvent(AUTH_SESSION_EXPIRED_EVENT));
  }
}

/**
 * API Error Class
 * Defined here to ensure it's always available before use
 */
export class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'APIError';
    // Restore prototype chain for proper instanceof checks
    Object.setPrototypeOf(this, APIError.prototype);
  }
}

class APIClient {
  private baseURL = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379`;

  // Mutex for session refresh: prevents concurrent refreshSession() calls from
  // racing each other when multiple queries fire simultaneously with an expired token.
  private refreshPromise: Promise<string | null> | null = null;

  // Tracks whether the client has ever successfully obtained a real auth token.
  // Used to distinguish "user was never logged in" (don't dispatch session-expired)
  // from "user was logged in but session died" (dispatch session-expired).
  private hadAuthenticatedSession = false;
  
  /**
   * Get authorization token from Supabase session.
   * Proactively refreshes expired tokens before returning them, and deduplicates
   * concurrent refresh attempts so only one refreshSession() call is in-flight.
   */
  private async getAuthToken(): Promise<string> {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        // No session from getSession() — this can happen when:
        // 1. The user genuinely isn't logged in (anon key is appropriate)
        // 2. The session is being loaded/refreshed asynchronously
        // 3. The stored session expired and getSession() cleared it
        // Try refreshSession() as a fallback — if a refresh_token exists in
        // storage, Supabase can mint a new access_token even when getSession()
        // returns null.
        const freshToken = await this.refreshToken(supabase);
        if (freshToken) {
          return freshToken;
        }
        // Both getSession and refresh failed — but this may simply mean the user
        // was never authenticated (no refresh_token in storage). Only dispatch
        // session-expired if we previously had a working session (i.e. the API
        // client had returned a real token before).
        if (this.hadAuthenticatedSession) {
          dispatchSessionExpired();
          this.hadAuthenticatedSession = false;
        }
        return publicAnonKey;
      }

      // We have a valid session — track that fact so we can detect expiry later
      this.hadAuthenticatedSession = true;

      // Check if the access token is expired (or within 60s of expiry)
      const expiresAt = session.expires_at; // unix seconds
      if (expiresAt && Date.now() / 1000 > expiresAt - 60) {
        // Token is expired or about to expire — refresh it
        const freshToken = await this.refreshToken(supabase);
        if (freshToken) return freshToken;
        // Refresh failed for an expired token — session is dead
        dispatchSessionExpired();
        this.hadAuthenticatedSession = false;
        return publicAnonKey;
      }

      return session.access_token;
    } catch (error) {
      console.error('Failed to get auth token, falling back to anon key:', error);
      // Fallback to anon key if session retrieval fails
      return publicAnonKey;
    }
  }

  /**
   * Refresh the Supabase session, deduplicating concurrent calls.
   * Returns the new access_token or null if refresh failed.
   */
  private async refreshToken(supabase: ReturnType<typeof createClient>): Promise<string | null> {
    // If a refresh is already in-flight, wait for it instead of firing another
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const { data: { session }, error } = await supabase.auth.refreshSession();
        if (error || !session) {
          // "Auth session missing!" is expected when the user was never logged in
          // (no refresh_token in storage). Only log as an error for genuine failures.
          const isExpected = error?.message?.includes('Auth session missing');
          if (!isExpected) {
            console.error('Session refresh failed:', error?.message || 'No session returned');
          }
          return null;
        }
        // Successful refresh — mark that we have an authenticated session
        this.hadAuthenticatedSession = true;
        return session.access_token;
      } catch (err) {
        console.error('Session refresh threw:', err);
        return null;
      } finally {
        // Clear the mutex after a short delay so back-to-back calls within the
        // same tick still coalesce, but subsequent calls after the refresh
        // completes will re-evaluate freshness.
        setTimeout(() => { this.refreshPromise = null; }, 500);
      }
    })();

    return this.refreshPromise;
  }
  
  /**
   * Make HTTP request
   */
  private async request<T>(
    method: string,
    endpoint: string,
    data?: unknown,
    options?: RequestInit,
    isRetry = false
  ): Promise<T> {
    // Ensure endpoint starts with a slash
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${this.baseURL}${normalizedEndpoint}`;
    const token = await this.getAuthToken();
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options?.headers,
    };
    
    const config: RequestInit = {
      method,
      headers,
      ...options,
    };
    
    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      if (data instanceof FormData) {
        config.body = data;
        // Remove Content-Type to let browser set boundary
        // We cast to any/Record to manipulate the headers object
        if (headers && typeof headers === 'object' && !Array.isArray(headers) && !(headers instanceof Headers)) {
            delete (headers as Record<string, string>)['Content-Type'];
        }
      } else {
        config.body = JSON.stringify(data);
      }
    }
    
    // Retry logic for network errors
    const maxRetries = 3;
    const baseDelay = 1000;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, config);
        
        // Handle 204 No Content
        if (response.status === 204) {
          return {} as T;
        }

        // Handle 401 Unauthorized - Attempt Refresh & Retry (only on first attempt)
        if (response.status === 401 && !isRetry && attempt === 0) {
          const supabase = createClient();
          const freshToken = await this.refreshToken(supabase);
          
          if (freshToken) {
            return this.request<T>(method, endpoint, data, options, true);
          }
          // Refresh failed on a 401 — session is confirmed dead
          dispatchSessionExpired();
        }
        
        // Handle non-JSON responses (like file downloads)
        const contentType = response.headers.get('content-type');
        const isJson = contentType?.includes('application/json');
        
        if (!isJson) {
          if (!response.ok) {
            const textResponse = await response.text();
            // Extract a clean error message instead of dumping raw HTML
            const isCloudflareError = textResponse.includes('cloudflare') || textResponse.includes('cf-error');
            const cleanMessage = isCloudflareError
              ? `Server temporarily unavailable (Cloudflare ${response.status}). Please try again.`
              : `Server returned ${response.status}: ${response.statusText}`;
            throw new APIError(
              cleanMessage,
              response.status,
              isCloudflareError ? 'CLOUDFLARE_ERROR' : 'NON_JSON_ERROR',
              { responseText: textResponse.substring(0, 200) }
            );
          }
          return response as unknown as T; // Return raw Response for file downloads
        }
        
        // Try to parse JSON response
        let responseData;
        try {
          responseData = await response.json();
        } catch (jsonError) {
          // If JSON parsing fails, throw a more helpful error
          throw new APIError(
            `Failed to parse server response as JSON`,
            response.status,
            'JSON_PARSE_ERROR',
            { originalError: jsonError }
          );
        }
        
        if (!response.ok) {
          const errorMessage = responseData?.error || responseData?.message || `${response.status} ${response.statusText}`;
          // Truncate details if they contain HTML (e.g. Cloudflare error pages forwarded by server)
          let details = responseData?.details;
          if (typeof details === 'string' && details.includes('<!DOCTYPE')) {
            details = 'Server encountered a transient error. Please try again.';
          }
          const fullMessage = details
            ? `${errorMessage}\n\nDetails: ${typeof details === 'string' ? details.substring(0, 200) : JSON.stringify(details).substring(0, 200)}`
            : errorMessage;
          
          throw new APIError(
            fullMessage,
            response.status,
            responseData?.code,
            responseData
          );
        }
        
        return responseData as T;

      } catch (error) {
        // If it's a network error (TypeError) and we haven't exhausted retries, wait and retry
        // Don't retry if it's an APIError (already processed response) unless it's a transient server error
        const isNetworkError = error instanceof TypeError && error.message === 'Failed to fetch';
        const isServerBusy = error instanceof APIError && (error.statusCode === 500 || error.statusCode === 502 || error.statusCode === 503 || error.statusCode === 504);
        
        if ((isNetworkError || isServerBusy) && attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // If we've exhausted retries or it's a different error, throw
        if (error instanceof APIError) {
          throw error;
        }
        
        // Network error or other unexpected error
        throw new APIError(
          'Network error. Please check your connection.',
          0,
          'NETWORK_ERROR',
          error // Pass original error as details
        );
      }
    }
    
    // Should be unreachable
    throw new Error('Request failed after retries');
  }
  
  /**
   * GET request
   */
  async get<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>('GET', endpoint, undefined, options);
  }
  
  /**
   * POST request
   */
  async post<T>(endpoint: string, data?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>('POST', endpoint, data, options);
  }
  
  /**
   * PUT request
   */
  async put<T>(endpoint: string, data?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>('PUT', endpoint, data, options);
  }
  
  /**
   * PATCH request
   */
  async patch<T>(endpoint: string, data?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>('PATCH', endpoint, data, options);
  }
  
  /**
   * DELETE request
   */
  async delete<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>('DELETE', endpoint, undefined, options);
  }
}

// Export singleton instance
export const api = new APIClient();

// Export alias for compatibility
export { APIError as APIClientError };