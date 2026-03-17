/**
 * Risk Planning FNA API Service
 * Handles all API calls for Risk Planning Financial Needs Analysis
 *
 * Converged in Phase 4 to use shared API client and logger.
 */

import { api, APIError } from '../../../../utils/api';
import { logger } from '../../../../utils/logger';
import type { PublishedFNA, InformationGatheringInput } from './types';

export const RiskPlanningFnaAPI = {
  /**
   * Get client profile data to auto-populate FNA
   */
  async getClientProfile(clientId: string): Promise<Record<string, unknown> | null> {
    logger.debug('[RiskPlanningFnaAPI] Fetching client profile', { clientId });
    try {
      const response = await api.get<{ success: boolean; data: Record<string, unknown> }>(
        `/risk-planning-fna/client-profile/${clientId}`
      );
      return response.data || null;
    } catch (error) {
      const isNotFound =
        (error instanceof APIError && error.statusCode === 404) ||
        (error instanceof Error && error.message?.includes('404'));

      if (isNotFound) {
        logger.debug('No client profile found for Risk Planning FNA', { clientId });
        return null;
      }

      logger.warn('Failed to fetch client profile for Risk Planning FNA', error);
      return null;
    }
  },

  /**
   * Get latest published FNA for a client
   */
  async getLatestPublished(clientId: string): Promise<PublishedFNA | null> {
    logger.debug('[RiskPlanningFnaAPI] Fetching latest published', { clientId });
    try {
      const response = await api.get<{ success: boolean; data: PublishedFNA | null }>(
        `/risk-planning-fna/client/${clientId}/latest`
      );
      return response.data || null;
    } catch (error) {
      const isNotFound =
        (error instanceof APIError && error.statusCode === 404) ||
        (error instanceof Error && error.message?.includes('404'));

      if (isNotFound) {
        logger.debug('No published Risk Planning FNA found', { clientId });
        return null;
      }

      logger.warn('Could not fetch latest published Risk Planning FNA', error);
      return null;
    }
  },

  /**
   * Create new FNA draft
   */
  async create(clientId: string, inputData: Partial<InformationGatheringInput>): Promise<PublishedFNA> {
    logger.debug('[RiskPlanningFnaAPI] Creating new FNA', { clientId });
    try {
      const response = await api.post<{ success: boolean; data: PublishedFNA }>(
        '/risk-planning-fna/create',
        { clientId, inputData }
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to create Risk Planning FNA', error);
      throw error;
    }
  },

  /**
   * Update existing FNA
   */
  async update(fnaId: string, updates: Partial<PublishedFNA>): Promise<PublishedFNA> {
    logger.debug('[RiskPlanningFnaAPI] Updating FNA', { fnaId });
    try {
      const response = await api.put<{ success: boolean; data: PublishedFNA }>(
        `/risk-planning-fna/update/${fnaId}`,
        updates
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to update Risk Planning FNA', error);
      throw error;
    }
  },

  /**
   * Publish FNA (lock calculations)
   */
  async publish(fnaId: string): Promise<PublishedFNA> {
    logger.debug('[RiskPlanningFnaAPI] Publishing FNA', { fnaId });
    try {
      const response = await api.post<{ success: boolean; data: PublishedFNA }>(
        `/risk-planning-fna/publish/${fnaId}`
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to publish Risk Planning FNA', error);
      throw error;
    }
  },

  /**
   * Unpublish FNA (return to draft)
   */
  async unpublish(fnaId: string): Promise<PublishedFNA> {
    logger.debug('[RiskPlanningFnaAPI] Unpublishing FNA', { fnaId });
    try {
      const response = await api.post<{ success: boolean; data: PublishedFNA }>(
        `/risk-planning-fna/unpublish/${fnaId}`
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to unpublish Risk Planning FNA', error);
      throw error;
    }
  },

  /**
   * Delete FNA (soft delete / archive)
   */
  async delete(fnaId: string): Promise<void> {
    logger.debug('[RiskPlanningFnaAPI] Deleting FNA', { fnaId });
    try {
      await api.delete(`/risk-planning-fna/archive/${fnaId}`);
    } catch (error) {
      logger.error('Failed to delete Risk Planning FNA', error);
      throw error;
    }
  },

  /**
   * Archive FNA (alias for delete)
   */
  async archive(fnaId: string): Promise<void> {
    return RiskPlanningFnaAPI.delete(fnaId);
  },

  /**
   * Hard delete FNA (permanent deletion)
   * Use with caution — this cannot be undone
   */
  async hardDelete(fnaId: string): Promise<void> {
    logger.debug('[RiskPlanningFnaAPI] Hard deleting FNA', { fnaId });
    try {
      await api.delete(`/risk-planning-fna/hard-delete/${fnaId}`);
    } catch (error) {
      logger.error('Failed to hard delete Risk Planning FNA', error);
      throw error;
    }
  },

  /**
   * Get FNA by ID
   */
  async getById(fnaId: string): Promise<PublishedFNA> {
    logger.debug('[RiskPlanningFnaAPI] Fetching FNA by ID', { fnaId });
    try {
      const response = await api.get<{ success: boolean; data: PublishedFNA }>(
        `/risk-planning-fna/${fnaId}`
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch Risk Planning FNA', error);
      throw error;
    }
  },

  /**
   * List all FNAs for a client
   */
  async listForClient(clientId: string): Promise<PublishedFNA[]> {
    logger.debug('[RiskPlanningFnaAPI] Listing FNAs for client', { clientId });
    try {
      const response = await api.get<{ success: boolean; data: PublishedFNA[] }>(
        `/risk-planning-fna/client/${clientId}/list`
      );
      return response.data || [];
    } catch (error) {
      logger.error('Failed to list Risk Planning FNAs', error);
      throw error;
    }
  },
};