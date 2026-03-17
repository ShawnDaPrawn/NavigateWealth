/**
 * Investment Needs Analysis (INA) API Service
 * Handles all API calls for Investment INA
 *
 * Converged in Phase 4 to use shared API client and logger.
 */

import { api, APIError } from '../../../../utils/api';
import { logger } from '../../../../utils/logger';
import type { InvestmentINAInputs, InvestmentINAResults, InvestmentINASession } from './types';

export const InvestmentINAFnaAPI = {
  /**
   * Auto-populate INA inputs from client profile
   */
  async autoPopulateInputs(clientId: string): Promise<InvestmentINAInputs> {
    logger.debug('[InvestmentINAFnaAPI] Auto-populating inputs', { clientId });
    try {
      const response = await api.get<{ success: boolean; data: InvestmentINAInputs }>(
        `/ina/investment/client/${clientId}/auto-populate`
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to auto-populate Investment INA inputs', error);
      throw error;
    }
  },

  /**
   * Calculate INA results
   */
  async calculateINA(
    clientId: string,
    inputs: InvestmentINAInputs
  ): Promise<InvestmentINAResults> {
    logger.debug('[InvestmentINAFnaAPI] Calculating results', { clientId });
    try {
      const response = await api.post<{ success: boolean; data: InvestmentINAResults }>(
        `/ina/investment/client/${clientId}/calculate`,
        inputs
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to calculate Investment INA', error);
      throw error;
    }
  },

  /**
   * Save INA session (draft or published)
   */
  async saveSession(
    clientId: string,
    inputs: InvestmentINAInputs,
    results: InvestmentINAResults | null,
    status: 'draft' | 'published'
  ): Promise<InvestmentINASession> {
    logger.debug('[InvestmentINAFnaAPI] Saving session', { clientId, status });
    try {
      const response = await api.post<{ success: boolean; data: InvestmentINASession }>(
        `/ina/investment/client/${clientId}/save`,
        { inputs, results, status }
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to save Investment INA session', error);
      throw error;
    }
  },

  /**
   * Get all INA sessions for a client
   */
  async getAllSessions(clientId: string): Promise<InvestmentINASession[]> {
    logger.debug('[InvestmentINAFnaAPI] Fetching all sessions', { clientId });
    try {
      const response = await api.get<{ success: boolean; data: InvestmentINASession[] }>(
        `/ina/investment/client/${clientId}/sessions`
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch Investment INA sessions', error);
      throw error;
    }
  },

  /**
   * Get latest published INA session
   */
  async getLatestPublished(clientId: string): Promise<InvestmentINASession | null> {
    logger.debug('[InvestmentINAFnaAPI] Fetching latest published', { clientId });
    try {
      const response = await api.get<{ success: boolean; data: InvestmentINASession | null }>(
        `/ina/investment/client/${clientId}/latest-published`
      );
      return response.data || null;
    } catch (error) {
      const isNotFound =
        (error instanceof APIError && error.statusCode === 404) ||
        (error instanceof Error && error.message?.includes('404'));

      if (isNotFound) {
        logger.debug('No published Investment INA found', { clientId });
        return null;
      }

      logger.warn('Could not fetch latest published Investment INA', error);
      return null;
    }
  },

  /**
   * Get specific INA session by ID
   */
  async getSessionById(sessionId: string): Promise<InvestmentINASession> {
    logger.debug('[InvestmentINAFnaAPI] Fetching session', { sessionId });
    try {
      const response = await api.get<{ success: boolean; data: InvestmentINASession }>(
        `/ina/investment/session/${sessionId}`
      );
      return response.data;
    } catch (error) {
      logger.error('Investment INA session not found', error);
      throw error;
    }
  },

  /**
   * Delete INA session by ID
   */
  async deleteSession(sessionId: string): Promise<void> {
    logger.debug('[InvestmentINAFnaAPI] Deleting session', { sessionId });
    try {
      await api.delete(`/ina/investment/session/${sessionId}`);
    } catch (error) {
      logger.error('Failed to delete Investment INA session', error);
      throw error;
    }
  },

  /**
   * Publish Investment INA session
   */
  async publishSession(sessionId: string): Promise<InvestmentINASession> {
    logger.debug('[InvestmentINAFnaAPI] Publishing session', { sessionId });
    try {
      const response = await api.put<{ success: boolean; data: InvestmentINASession }>(
        `/ina/investment/session/${sessionId}/publish`
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to publish Investment INA session', error);
      throw error;
    }
  },

  /**
   * Unpublish Investment INA session (changes status from published back to draft)
   */
  async unpublishSession(sessionId: string): Promise<InvestmentINASession> {
    logger.debug('[InvestmentINAFnaAPI] Unpublishing session', { sessionId });
    try {
      const response = await api.put<{ success: boolean; data: InvestmentINASession }>(
        `/ina/investment/session/${sessionId}/unpublish`
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to unpublish Investment INA session', error);
      throw error;
    }
  },
};

/**
 * Backward-compatible alias — consumers may import InvestmentINAApiService
 */
export const InvestmentINAApiService = InvestmentINAFnaAPI;
