/**
 * Medical FNA API Service
 * Handles all API calls for Medical Financial Needs Analysis
 *
 * Converged in Phase 4 to use shared API client and logger.
 */

import { api, APIError } from '../../../../utils/api';
import { logger } from '../../../../utils/logger';
import type { MedicalFNASession, MedicalFNAInputs, MedicalFNAResults, MedicalFNAAdjustments } from './types';

export const MedicalFnaAPI = {
  /**
   * Get all Medical FNA sessions for a client
   */
  async getClientMedicalFNAs(clientId: string): Promise<MedicalFNASession[]> {
    logger.debug('[MedicalFnaAPI] Fetching client FNAs', { clientId });
    try {
      const response = await api.get<{ success: boolean; data: MedicalFNASession[] }>(
        `/medical-fna/client/${clientId}`
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch client Medical FNAs', error);
      return [];
    }
  },

  /**
   * Get a specific Medical FNA session
   */
  async getMedicalFNA(fnaId: string): Promise<MedicalFNASession> {
    logger.debug('[MedicalFnaAPI] Fetching FNA', { fnaId });
    try {
      const response = await api.get<{ success: boolean; data: MedicalFNASession }>(
        `/medical-fna/${fnaId}`
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch Medical FNA', error);
      throw error;
    }
  },

  /**
   * Get latest published Medical FNA for a client
   */
  async getLatestPublished(clientId: string): Promise<MedicalFNASession | null> {
    logger.debug('[MedicalFnaAPI] Fetching latest published', { clientId });
    try {
      const response = await api.get<{ success: boolean; data: MedicalFNASession | null }>(
        `/medical-fna/client/${clientId}/latest-published`
      );
      return response.data || null;
    } catch (error) {
      const isNotFound =
        (error instanceof APIError && error.statusCode === 404) ||
        (error instanceof Error && error.message?.includes('404'));

      if (isNotFound) {
        logger.debug('No published Medical FNA found', { clientId });
        return null;
      }

      logger.warn('Could not fetch latest published Medical FNA', error);
      return null;
    }
  },

  /**
   * Create a new Medical FNA session (auto-populated from client profile)
   */
  async createMedicalFNA(clientId: string): Promise<MedicalFNASession> {
    logger.debug('[MedicalFnaAPI] Creating Medical FNA', { clientId });
    try {
      const response = await api.post<{ success: boolean; data: MedicalFNASession }>(
        '/medical-fna/create',
        { clientId }
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to create Medical FNA', error);
      throw error;
    }
  },

  /**
   * Update Medical FNA inputs
   */
  async updateMedicalFNAInputs(fnaId: string, inputs: Partial<MedicalFNAInputs>): Promise<MedicalFNASession> {
    logger.debug('[MedicalFnaAPI] Updating inputs', { fnaId });
    try {
      const response = await api.put<{ success: boolean; data: MedicalFNASession }>(
        `/medical-fna/inputs/${fnaId}`,
        inputs
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to update Medical FNA inputs', error);
      throw error;
    }
  },

  /**
   * Update Medical FNA results and adjustments
   */
  async updateMedicalFNAResults(fnaId: string, results: MedicalFNAResults, adjustments: MedicalFNAAdjustments): Promise<MedicalFNASession> {
    logger.debug('[MedicalFnaAPI] Updating results', { fnaId });
    try {
      const response = await api.put<{ success: boolean; data: MedicalFNASession }>(
        `/medical-fna/results/${fnaId}`,
        { results, adjustments }
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to update Medical FNA results', error);
      throw error;
    }
  },

  /**
   * Calculate Medical FNA results (runs calculation engine)
   */
  async calculateMedicalFNA(fnaId: string): Promise<MedicalFNASession> {
    logger.debug('[MedicalFnaAPI] Calculating', { fnaId });
    try {
      const response = await api.post<{ success: boolean; data: MedicalFNASession }>(
        `/medical-fna/calculate/${fnaId}`
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to calculate Medical FNA', error);
      throw error;
    }
  },

  /**
   * Save Medical FNA as draft
   */
  async saveDraft(fnaId: string): Promise<MedicalFNASession> {
    logger.debug('[MedicalFnaAPI] Saving draft', { fnaId });
    try {
      const response = await api.put<{ success: boolean; data: MedicalFNASession }>(
        `/medical-fna/draft/${fnaId}`
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to save Medical FNA draft', error);
      throw error;
    }
  },

  /**
   * Publish Medical FNA (makes it visible to client)
   */
  async publishMedicalFNA(fnaId: string): Promise<MedicalFNASession> {
    logger.debug('[MedicalFnaAPI] Publishing', { fnaId });
    try {
      const response = await api.post<{ success: boolean; data: MedicalFNASession }>(
        `/medical-fna/publish/${fnaId}`
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to publish Medical FNA', error);
      throw error;
    }
  },

  /**
   * Unpublish Medical FNA (changes status from published back to draft)
   */
  async unpublishMedicalFNA(fnaId: string): Promise<MedicalFNASession> {
    logger.debug('[MedicalFnaAPI] Unpublishing', { fnaId });
    try {
      const response = await api.post<{ success: boolean; data: MedicalFNASession }>(
        `/medical-fna/unpublish/${fnaId}`
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to unpublish Medical FNA', error);
      throw error;
    }
  },

  /**
   * Archive a Medical FNA
   */
  async archiveMedicalFNA(fnaId: string): Promise<void> {
    logger.debug('[MedicalFnaAPI] Archiving', { fnaId });
    try {
      await api.put(`/medical-fna/archive/${fnaId}`);
    } catch (error) {
      logger.error('Failed to archive Medical FNA', error);
      throw error;
    }
  },

  /**
   * Delete a Medical FNA
   */
  async deleteMedicalFNA(fnaId: string): Promise<void> {
    logger.debug('[MedicalFnaAPI] Deleting', { fnaId });
    try {
      await api.delete(`/medical-fna/delete/${fnaId}`);
    } catch (error) {
      logger.error('Failed to delete Medical FNA', error);
      throw error;
    }
  },

  /**
   * Auto-populate Medical FNA from client profile
   * Returns partial Medical FNA inputs extracted from client data
   */
  async autoPopulateFromProfile(clientId: string): Promise<Partial<MedicalFNAInputs>> {
    logger.debug('[MedicalFnaAPI] Auto-populating from profile', { clientId });
    try {
      const response = await api.get<{ success: boolean; data: Partial<MedicalFNAInputs> }>(
        `/medical-fna/client/${clientId}/auto-populate`
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to auto-populate Medical FNA', error);
      throw error;
    }
  },
};

/**
 * Backward-compatible alias — consumers may import MedicalFNAApiService
 */
export const MedicalFNAApiService = MedicalFnaAPI;