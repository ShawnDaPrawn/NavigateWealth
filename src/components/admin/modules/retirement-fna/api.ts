/**
 * Retirement FNA API Service
 * Handles all API calls for Retirement Needs Analysis
 */

import { api, APIError } from '../../../../utils/api';
import { logger } from '../../../../utils/logger';
import type { RetirementFNASession, RetirementFNAInputs } from './types';

export const RetirementFnaAPI = {
  /**
   * Get all Retirement FNA sessions for a client
   */
  async getAllForClient(clientId: string): Promise<RetirementFNASession[]> {
    logger.debug('[RetirementFnaAPI] Getting all sessions for client', { clientId });
    try {
      const response = await api.get<{ success: boolean; data: RetirementFNASession[] }>(`/retirement-fna/client/${clientId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch Retirement FNA sessions', error);
      throw error;
    }
  },

  /**
   * Get a specific Retirement FNA session
   */
  async getById(fnaId: string): Promise<RetirementFNASession> {
    logger.debug('[RetirementFnaAPI] Getting session', { fnaId });
    try {
      const response = await api.get<{ success: boolean; data: RetirementFNASession }>(`/retirement-fna/${fnaId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch Retirement FNA', error);
      throw error;
    }
  },

  /**
   * Get the latest published Retirement FNA for a client
   */
  async getLatestPublished(clientId: string): Promise<RetirementFNASession | null> {
    logger.debug('[RetirementFnaAPI] Getting latest published', { clientId });
    try {
      const response = await api.get<{ success: boolean; data: RetirementFNASession | null }>(`/retirement-fna/client/${clientId}/latest-published`);
      return response.data || null;
    } catch (error) {
      // Silently return null for 404s/errors as this is often used for checking existence
      const isNotFound = 
        (error instanceof APIError && error.statusCode === 404) ||
        (error instanceof Error && error.message && error.message.includes('404'));

      if (isNotFound) {
        logger.debug('No published Retirement FNA found (might not exist)', { clientId });
        return null;
      }

      logger.warn('Could not fetch latest published Retirement FNA', error);
      return null;
    }
  },

  /**
   * Create a new Retirement FNA session
   */
  async create(clientId: string): Promise<RetirementFNASession> {
    logger.debug('[RetirementFnaAPI] Creating new session', { clientId });
    try {
      const response = await api.post<{ success: boolean; data: RetirementFNASession }>('/retirement-fna/create', { clientId });
      return response.data;
    } catch (error) {
      logger.error('Failed to create Retirement FNA', error);
      throw error;
    }
  },

  /**
   * Update Retirement FNA inputs
   */
  async updateInputs(
    fnaId: string, 
    inputs: Partial<RetirementFNAInputs>
  ): Promise<RetirementFNASession> {
    logger.debug('[RetirementFnaAPI] Updating inputs', { fnaId });
    try {
      const response = await api.put<{ success: boolean; data: RetirementFNASession }>(`/retirement-fna/${fnaId}/inputs`, inputs);
      return response.data;
    } catch (error) {
      logger.error('Failed to update Retirement FNA inputs', error);
      throw error;
    }
  },

  /**
   * Calculate Retirement FNA results
   */
  async calculate(fnaId: string): Promise<RetirementFNASession> {
    logger.debug('[RetirementFnaAPI] Calculating results', { fnaId });
    try {
      const response = await api.post<{ success: boolean; data: RetirementFNASession }>(`/retirement-fna/${fnaId}/calculate`);
      return response.data;
    } catch (error) {
      logger.error('Failed to calculate Retirement FNA', error);
      throw error;
    }
  },

  /**
   * Save Retirement FNA as draft
   */
  async saveDraft(fnaId: string): Promise<RetirementFNASession> {
    logger.debug('[RetirementFnaAPI] Saving draft', { fnaId });
    try {
      const response = await api.put<{ success: boolean; data: RetirementFNASession }>(`/retirement-fna/${fnaId}/draft`);
      return response.data;
    } catch (error) {
      logger.error('Failed to save Retirement FNA draft', error);
      throw error;
    }
  },

  /**
   * Publish Retirement FNA
   */
  async publish(fnaId: string): Promise<RetirementFNASession> {
    logger.debug('[RetirementFnaAPI] Publishing session', { fnaId });
    try {
      const response = await api.put<{ success: boolean; data: RetirementFNASession }>(`/retirement-fna/${fnaId}/publish`);
      return response.data;
    } catch (error) {
      logger.error('Failed to publish Retirement FNA', error);
      throw error;
    }
  },

  /**
   * Unpublish Retirement FNA (changes status from published back to draft)
   */
  async unpublish(fnaId: string): Promise<RetirementFNASession> {
    logger.debug('[RetirementFnaAPI] Unpublishing session', { fnaId });
    try {
      const response = await api.put<{ success: boolean; data: RetirementFNASession }>(`/retirement-fna/${fnaId}/unpublish`);
      return response.data;
    } catch (error) {
      logger.error('Failed to unpublish Retirement FNA', error);
      throw error;
    }
  },

  /**
   * Archive Retirement FNA
   */
  async archive(fnaId: string): Promise<RetirementFNASession> {
    logger.debug('[RetirementFnaAPI] Archiving session', { fnaId });
    try {
      const response = await api.put<{ success: boolean; data: RetirementFNASession }>(`/retirement-fna/${fnaId}/archive`);
      return response.data;
    } catch (error) {
      logger.error('Failed to archive Retirement FNA', error);
      throw error;
    }
  },

  /**
   * Delete Retirement FNA
   */
  async delete(fnaId: string): Promise<void> {
    logger.debug('[RetirementFnaAPI] Deleting session', { fnaId });
    try {
      await api.delete(`/retirement-fna/${fnaId}`);
    } catch (error) {
      logger.error('Failed to delete Retirement FNA', error);
      throw error;
    }
  },

  /**
   * Get auto-populated inputs from client profile
   */
  async getAutoPopulatedInputs(clientId: string): Promise<Partial<RetirementFNAInputs>> {
    logger.debug('[RetirementFnaAPI] Fetching auto-populated inputs', { clientId });
    try {
      const response = await api.get<{ success: boolean; data: Partial<RetirementFNAInputs> }>(`/retirement-fna/client/${clientId}/auto-populate`);
      return response.data;
    } catch (error) {
      logger.error('Failed to auto-populate inputs', error);
      throw error;
    }
  }
};