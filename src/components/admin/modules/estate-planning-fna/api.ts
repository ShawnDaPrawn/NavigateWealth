/**
 * Estate Planning FNA API Service
 * Handles all API interactions for Estate Planning FNA
 */

import { api, APIError } from '../../../../utils/api';
import { logger } from '../../../../utils/logger';
import type { EstatePlanningInputs, EstatePlanningSession, EstatePlanningResults } from './types';

export const EstatePlanningAPI = {
  /**
   * Auto-populate Estate Planning inputs from client profile
   */
  async autoPopulateInputs(clientId: string): Promise<Partial<EstatePlanningInputs>> {
    logger.debug('[EstatePlanningAPI] Auto-populating inputs', { clientId });
    try {
      const response = await api.get<{ success: boolean; data: Partial<EstatePlanningInputs> }>(
        `/estate-planning-fna/client/${clientId}/auto-populate`
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to auto-populate Estate Planning inputs', error);
      throw error;
    }
  },

  /**
   * Save Estate Planning session
   */
  async saveSession(
    clientId: string,
    inputs: EstatePlanningInputs,
    results: EstatePlanningResults | null,
    status: 'draft' | 'published',
    adviserNotes: string = ''
  ): Promise<EstatePlanningSession> {
    logger.debug('[EstatePlanningAPI] Saving session', { clientId, status });
    try {
      const response = await api.post<{ success: boolean; data: EstatePlanningSession }>(
        '/estate-planning-fna/save',
        {
          clientId,
          inputs,
          results,
          status,
          adviserNotes,
        }
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to save Estate Planning session', error);
      throw error;
    }
  },

  /**
   * Get all Estate Planning sessions for a client
   */
  async getAllSessions(clientId: string): Promise<EstatePlanningSession[]> {
    logger.debug('[EstatePlanningAPI] Fetching all sessions', { clientId });
    try {
      const response = await api.get<{ success: boolean; data: EstatePlanningSession[] }>(
        `/estate-planning-fna/client/${clientId}/sessions`
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch Estate Planning sessions', error);
      throw error;
    }
  },

  /**
   * Get latest published Estate Planning session
   */
  async getLatestPublished(clientId: string): Promise<EstatePlanningSession | null> {
    logger.debug('[EstatePlanningAPI] Fetching latest published', { clientId });
    try {
      const response = await api.get<{ success: boolean; data: EstatePlanningSession | null }>(
        `/estate-planning-fna/client/${clientId}/latest-published`
      );
      return response.data || null;
    } catch (error) {
      // Silently return null for 404s/errors as this is often used for checking existence
      const isNotFound = 
        (error instanceof APIError && error.statusCode === 404) ||
        (error instanceof Error && error.message && error.message.includes('404'));

      if (isNotFound) {
        logger.debug('No published Estate Planning FNA found (might not exist)', { clientId });
        return null;
      }

      logger.warn('Could not fetch latest published Estate Planning FNA', error);
      return null;
    }
  },

  /**
   * Get specific Estate Planning session by ID
   */
  async getSessionById(sessionId: string): Promise<EstatePlanningSession> {
    logger.debug('[EstatePlanningAPI] Fetching session', { sessionId });
    try {
      const response = await api.get<{ success: boolean; data: EstatePlanningSession }>(
        `/estate-planning-fna/session/${sessionId}`
      );
      return response.data;
    } catch (error) {
      logger.error('Estate Planning session not found', error);
      throw error;
    }
  },

  /**
   * Delete Estate Planning session by ID
   */
  async deleteSession(sessionId: string): Promise<void> {
    logger.debug('[EstatePlanningAPI] Deleting session', { sessionId });
    try {
      await api.delete(`/estate-planning-fna/session/${sessionId}`);
    } catch (error) {
      logger.error('Failed to delete Estate Planning session', error);
      throw error;
    }
  },

  /**
   * Publish Estate Planning session
   */
  async publishSession(sessionId: string): Promise<EstatePlanningSession> {
    logger.debug('[EstatePlanningAPI] Publishing session', { sessionId });
    try {
      const response = await api.put<{ success: boolean; data: EstatePlanningSession }>(
        `/estate-planning-fna/session/${sessionId}/publish`
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to publish Estate Planning session', error);
      throw error;
    }
  },

  /**
   * Unpublish Estate Planning session (changes status from published back to draft)
   */
  async unpublishSession(sessionId: string): Promise<EstatePlanningSession> {
    logger.debug('[EstatePlanningAPI] Unpublishing session', { sessionId });
    try {
      const response = await api.put<{ success: boolean; data: EstatePlanningSession }>(
        `/estate-planning-fna/session/${sessionId}/unpublish`
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to unpublish Estate Planning session', error);
      throw error;
    }
  }
};