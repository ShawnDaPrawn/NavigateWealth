/**
 * Media uploads. One slice of the social-media API client —
 * api.ts re-exports the whole surface.
 */
import { logger } from '../../../../../utils/logger';
import { getErrorMessage } from '../../../../../utils/errorUtils';
import type {
  MediaFile,
  // UTMParameters, // Unused import
} from '../types';
import {
  SOCIAL_MEDIA_BASE,
  getAuthHeaders,
  handleResponse,
  get,
  del,
  type APIResponse,
} from './apiBase';

export const mediaApi = {
  /**
   * Upload media file
   */
  async upload(file: File, alt?: string): Promise<APIResponse<MediaFile>> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (alt) formData.append('alt', alt);

      const headers = await getAuthHeaders();
      // Remove Content-Type so browser sets it with multipart boundary
      delete (headers as Record<string, string>)['Content-Type'];
      const response = await fetch(`${SOCIAL_MEDIA_BASE}/media/upload`, {
        method: 'POST',
        headers,
        body: formData,
      });

      return handleResponse<MediaFile>(response);
    } catch (error) {
      logger.error('Upload failed', error);
      return {
        success: false,
        error: getErrorMessage(error) || 'Upload failed',
      };
    }
  },

  /**
   * Delete media file
   */
  async delete(mediaId: string): Promise<APIResponse<void>> {
    return del<void>(`${SOCIAL_MEDIA_BASE}/media/${mediaId}`);
  },

  /**
   * Get media metadata
   */
  async getMetadata(mediaId: string): Promise<APIResponse<MediaFile>> {
    return get<MediaFile>(`${SOCIAL_MEDIA_BASE}/media/${mediaId}`);
  },
};

// ============================================================================
// AI Content Generation API
// ============================================================================
