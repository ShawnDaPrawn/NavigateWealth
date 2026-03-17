/**
 * FNA API Service
 * Handles all backend API calls for FNA feature
 */

import { api, APIError } from '../../../../utils/api';
import { logger } from '../../../../utils/logger';
import type { FNASession, FNAInputs } from './types';

export const FNAAPI = {
  /**
   * Get all FNA sessions for a client
   */
  async getClientFNAs(clientId: string): Promise<FNASession[]> {
    logger.debug('[FNAAPI] Fetching all sessions', { clientId });
    try {
      return await api.get<FNASession[]>(`/fna/client/${clientId}`);
    } catch (error) {
      // Return empty array if endpoint doesn't exist or network error (matching legacy behavior)
      logger.warn('Failed to fetch client FNAs', error);
      return [];
    }
  },

  /**
   * Get a specific FNA session
   */
  async getFNA(fnaId: string): Promise<FNASession> {
    logger.debug('[FNAAPI] Fetching session', { fnaId });
    try {
      return await api.get<FNASession>(`/fna/${fnaId}`);
    } catch (error) {
      logger.error('FNA session not found', error);
      throw error;
    }
  },

  /**
   * Get the latest published FNA for a client
   */
  async getLatestPublishedFNA(clientId: string): Promise<FNASession | null> {
    logger.debug('[FNAAPI] Fetching latest published', { clientId });
    try {
      return await api.get<FNASession | null>(`/fna/client/${clientId}/latest-published`);
    } catch (error) {
      // Silently return null for 404 (not found)
      // Check for status code 404 or "404" in the error message
      const isNotFound = 
        (error instanceof APIError && error.statusCode === 404) ||
        (error instanceof Error && error.message && error.message.includes('404'));
      
      if (isNotFound) {
        logger.debug('No published FNA found for client', { clientId });
        return null;
      }
      
      // For other errors, log warning but still return null to prevent UI crash
      logger.warn('Could not fetch latest published FNA', error);
      return null;
    }
  },

  /**
   * Create a new FNA session (auto-populated from client profile)
   */
  async createFNA(clientId: string): Promise<FNASession> {
    logger.debug('[FNAAPI] Creating session', { clientId });
    try {
      return await api.post<FNASession>('/fna/create', { clientId });
    } catch (error) {
      logger.error('Failed to create FNA session', error);
      throw error;
    }
  },

  /**
   * Update FNA inputs
   */
  async updateFNAInputs(fnaId: string, inputs: Partial<FNAInputs>): Promise<FNASession> {
    logger.debug('[FNAAPI] Updating inputs', { fnaId });
    try {
      return await api.put<FNASession>(`/fna/${fnaId}/inputs`, inputs);
    } catch (error) {
      logger.error('Failed to update FNA inputs', error);
      throw error;
    }
  },

  /**
   * Calculate FNA results (runs calculation engine)
   */
  async calculateFNA(fnaId: string): Promise<FNASession> {
    logger.debug('[FNAAPI] Calculating results', { fnaId });
    try {
      return await api.post<FNASession>(`/fna/${fnaId}/calculate`);
    } catch (error) {
      logger.error('Failed to calculate FNA', error);
      throw error;
    }
  },

  /**
   * Save FNA as draft
   */
  async saveDraft(fnaId: string): Promise<FNASession> {
    logger.debug('[FNAAPI] Saving draft', { fnaId });
    try {
      return await api.put<FNASession>(`/fna/${fnaId}/draft`);
    } catch (error) {
      logger.error('Failed to save FNA draft', error);
      throw error;
    }
  },

  /**
   * Publish FNA (makes it visible to client)
   */
  async publishFNA(fnaId: string): Promise<FNASession> {
    logger.debug('[FNAAPI] Publishing session', { fnaId });
    try {
      return await api.put<FNASession>(`/fna/${fnaId}/publish`);
    } catch (error) {
      logger.error('Failed to publish FNA', error);
      throw error;
    }
  },

  /**
   * Unpublish FNA (changes status from published back to draft)
   */
  async unpublishFNA(fnaId: string): Promise<FNASession> {
    logger.debug('[FNAAPI] Unpublishing session', { fnaId });
    try {
      return await api.put<FNASession>(`/fna/${fnaId}/unpublish`);
    } catch (error) {
      logger.error('Failed to unpublish FNA', error);
      throw error;
    }
  },

  /**
   * Archive an FNA
   */
  async archiveFNA(fnaId: string): Promise<void> {
    logger.debug('[FNAAPI] Archiving session', { fnaId });
    try {
      await api.put(`/fna/${fnaId}/archive`);
    } catch (error) {
      logger.error('Failed to archive FNA', error);
      throw error;
    }
  },

  /**
   * Delete an FNA
   */
  async deleteFNA(fnaId: string): Promise<void> {
    logger.debug('[FNAAPI] Deleting session', { fnaId });
    try {
      await api.delete(`/fna/${fnaId}`);
    } catch (error) {
      logger.error('Failed to delete FNA', error);
      throw error;
    }
  },

  /**
   * Auto-populate FNA from client profile
   * Returns partial FNA inputs extracted from client data
   */
  async autoPopulateFromProfile(clientId: string): Promise<Partial<FNAInputs>> {
    logger.debug('[FNAAPI] Auto-populating from profile', { clientId });
    try {
      return await api.get<Partial<FNAInputs>>(`/fna/client/${clientId}/auto-populate`);
    } catch (error) {
      logger.error('Failed to auto-populate FNA', error);
      throw error;
    }
  }
};
