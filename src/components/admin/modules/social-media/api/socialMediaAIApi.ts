/**
 * AI content generation. One slice of the social-media API client —
 * api.ts re-exports the whole surface.
 */
import { logger } from '../../../../../utils/logger';
import { getErrorMessage } from '../../../../../utils/errorUtils';
import type {
  // UTMParameters, // Unused import
  GeneratePostTextInput,
  GeneratePostTextResult,
  AIGenerationRecord,
  GenerateImageInput,
  GenerateImageResult,
  AIImageRecord,
  GenerateBundleInput,
  GenerateBundleResult,
  CustomBrandTemplate,
  CreateCustomTemplateInput,
  UpdateCustomTemplateInput,
  AIAnalyticsSummary,
} from '../types';
import { BASE_URL, getAuthHeaders, handleResponse, type APIResponse } from './apiBase';

const SOCIAL_MEDIA_AI_BASE = `${BASE_URL}/social-media-ai`;

export const socialMediaAIApi = {
  /**
   * Generate platform-specific post text using AI
   */
  async generatePostText(
    input: GeneratePostTextInput,
  ): Promise<APIResponse<GeneratePostTextResult>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${SOCIAL_MEDIA_AI_BASE}/generate-post`, {
        method: 'POST',
        headers,
        body: JSON.stringify(input),
      });
      return handleResponse<GeneratePostTextResult>(response);
    } catch (error) {
      logger.error('AI post text generation failed', error);
      return {
        success: false,
        error: getErrorMessage(error) || 'Failed to generate post text',
      };
    }
  },

  /**
   * Get AI generation history
   */
  async getHistory(limit = 20): Promise<APIResponse<AIGenerationRecord[]>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${SOCIAL_MEDIA_AI_BASE}/history?limit=${limit}`, {
        method: 'GET',
        headers,
      });
      return handleResponse<AIGenerationRecord[]>(response);
    } catch (error) {
      logger.error('Failed to fetch AI generation history', error);
      return {
        success: false,
        error: getErrorMessage(error) || 'Failed to fetch history',
      };
    }
  },

  /**
   * Get a specific generation record
   */
  async getGeneration(generationId: string): Promise<APIResponse<AIGenerationRecord>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${SOCIAL_MEDIA_AI_BASE}/generation/${generationId}`, {
        method: 'GET',
        headers,
      });
      return handleResponse<AIGenerationRecord>(response);
    } catch (error) {
      logger.error('Failed to fetch AI generation record', error);
      return {
        success: false,
        error: getErrorMessage(error) || 'Failed to fetch generation',
      };
    }
  },

  /**
   * Check if AI service is configured
   */
  async getStatus(): Promise<APIResponse<{ configured: boolean }>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${SOCIAL_MEDIA_AI_BASE}/status`, {
        method: 'GET',
        headers,
      });
      return handleResponse<{ configured: boolean }>(response);
    } catch (error) {
      logger.error('Failed to check AI service status', error);
      return {
        success: false,
        error: getErrorMessage(error) || 'Failed to check status',
      };
    }
  },

  /**
   * Generate image using AI
   */
  async generateImage(input: GenerateImageInput): Promise<APIResponse<GenerateImageResult>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${SOCIAL_MEDIA_AI_BASE}/generate-image`, {
        method: 'POST',
        headers,
        body: JSON.stringify(input),
      });
      return handleResponse<GenerateImageResult>(response);
    } catch (error) {
      logger.error('AI image generation failed', error);
      return {
        success: false,
        error: getErrorMessage(error) || 'Failed to generate image',
      };
    }
  },

  /**
   * Get AI image generation history
   */
  async getImageHistory(limit = 20): Promise<APIResponse<AIImageRecord[]>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${SOCIAL_MEDIA_AI_BASE}/image-history?limit=${limit}`, {
        method: 'GET',
        headers,
      });
      return handleResponse<AIImageRecord[]>(response);
    } catch (error) {
      logger.error('Failed to fetch AI image generation history', error);
      return {
        success: false,
        error: getErrorMessage(error) || 'Failed to fetch image history',
      };
    }
  },

  /**
   * Get a specific image generation record
   */
  async getImageGeneration(generationId: string): Promise<APIResponse<AIImageRecord>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${SOCIAL_MEDIA_AI_BASE}/image-generation/${generationId}`, {
        method: 'GET',
        headers,
      });
      return handleResponse<AIImageRecord>(response);
    } catch (error) {
      logger.error('Failed to fetch AI image generation record', error);
      return {
        success: false,
        error: getErrorMessage(error) || 'Failed to fetch image generation',
      };
    }
  },

  /**
   * Generate a bundle of content using AI
   */
  async generateBundle(input: GenerateBundleInput): Promise<APIResponse<GenerateBundleResult>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${SOCIAL_MEDIA_AI_BASE}/generate-bundle`, {
        method: 'POST',
        headers,
        body: JSON.stringify(input),
      });
      return handleResponse<GenerateBundleResult>(response);
    } catch (error) {
      logger.error('AI bundle generation failed', error);
      return {
        success: false,
        error: getErrorMessage(error) || 'Failed to generate bundle',
      };
    }
  },

  /**
   * Create a custom brand template
   */
  async createCustomTemplate(
    input: CreateCustomTemplateInput,
  ): Promise<APIResponse<CustomBrandTemplate>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${SOCIAL_MEDIA_AI_BASE}/templates`, {
        method: 'POST',
        headers,
        body: JSON.stringify(input),
      });
      return handleResponse<CustomBrandTemplate>(response);
    } catch (error) {
      logger.error('Failed to create custom brand template', error);
      return {
        success: false,
        error: getErrorMessage(error) || 'Failed to create template',
      };
    }
  },

  /**
   * Update a custom brand template
   */
  async updateCustomTemplate(
    templateId: string,
    input: UpdateCustomTemplateInput,
  ): Promise<APIResponse<CustomBrandTemplate>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${SOCIAL_MEDIA_AI_BASE}/templates/${templateId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(input),
      });
      return handleResponse<CustomBrandTemplate>(response);
    } catch (error) {
      logger.error('Failed to update custom brand template', error);
      return {
        success: false,
        error: getErrorMessage(error) || 'Failed to update template',
      };
    }
  },

  /**
   * Delete a custom brand template
   */
  async deleteCustomTemplate(templateId: string): Promise<APIResponse<void>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${SOCIAL_MEDIA_AI_BASE}/templates/${templateId}`, {
        method: 'DELETE',
        headers,
      });
      return handleResponse<void>(response);
    } catch (error) {
      logger.error('Failed to delete custom brand template', error);
      return {
        success: false,
        error: getErrorMessage(error) || 'Failed to delete template',
      };
    }
  },

  /**
   * Get a custom brand template
   */
  async getCustomTemplate(templateId: string): Promise<APIResponse<CustomBrandTemplate>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${SOCIAL_MEDIA_AI_BASE}/templates/${templateId}`, {
        method: 'GET',
        headers,
      });
      return handleResponse<CustomBrandTemplate>(response);
    } catch (error) {
      logger.error('Failed to get custom brand template', error);
      return {
        success: false,
        error: getErrorMessage(error) || 'Failed to get template',
      };
    }
  },

  /**
   * Get all custom brand templates
   */
  async getAllCustomTemplates(): Promise<APIResponse<CustomBrandTemplate[]>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${SOCIAL_MEDIA_AI_BASE}/templates`, {
        method: 'GET',
        headers,
      });
      return handleResponse<CustomBrandTemplate[]>(response);
    } catch (error) {
      logger.error('Failed to get all custom brand templates', error);
      return {
        success: false,
        error: getErrorMessage(error) || 'Failed to get templates',
      };
    }
  },

  /**
   * Get AI analytics summary
   */
  async getAIAnalyticsSummary(): Promise<APIResponse<AIAnalyticsSummary>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${SOCIAL_MEDIA_AI_BASE}/analytics`, {
        method: 'GET',
        headers,
      });
      return handleResponse<AIAnalyticsSummary>(response);
    } catch (error) {
      logger.error('Failed to get AI analytics summary', error);
      return {
        success: false,
        error: getErrorMessage(error) || 'Failed to get summary',
      };
    }
  },
};

// ============================================================================
// LinkedIn Integration API
// ============================================================================
