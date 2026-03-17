/**
 * Tax Planning FNA API Service
 * Handles all API calls for Tax Planning Financial Needs Analysis
 *
 * Converged in Phase 4 to use shared API client and logger.
 */

import { api, APIError } from '../../../../utils/api';
import { logger } from '../../../../utils/logger';
import type {
  TaxPlanningInputs,
  TaxCalculationResults,
  AdjustmentLog,
  TaxRecommendation,
  FinalTaxPlan,
} from './types';

export const TaxPlanningFnaAPI = {
  /**
   * Auto-populate Tax Planning inputs from client profile
   */
  async autoPopulateInputs(clientId: string): Promise<Partial<TaxPlanningInputs>> {
    logger.debug('[TaxPlanningFnaAPI] Auto-populating inputs', { clientId });
    try {
      const response = await api.post<{ success: boolean; data: Partial<TaxPlanningInputs> }>(
        `/tax-planning-fna/client/${clientId}/auto-populate`
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to auto-populate Tax Planning inputs', error);
      throw error;
    }
  },

  /**
   * Save Tax Planning session
   */
  async saveSession(
    clientId: string,
    data: {
      inputs: TaxPlanningInputs;
      finalResults: TaxCalculationResults;
      adjustments: AdjustmentLog[];
      recommendations: TaxRecommendation[];
      adviserNotes: string;
      status: 'draft' | 'published';
    }
  ): Promise<FinalTaxPlan> {
    logger.debug('[TaxPlanningFnaAPI] Saving session', { clientId, status: data.status });
    try {
      const response = await api.post<{ success: boolean; data: FinalTaxPlan }>(
        '/tax-planning-fna/save',
        { clientId, ...data }
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to save Tax Planning session', error);
      throw error;
    }
  },

  /**
   * Get all Tax Planning sessions for a client
   */
  async getAllSessions(clientId: string): Promise<FinalTaxPlan[]> {
    logger.debug('[TaxPlanningFnaAPI] Fetching all sessions', { clientId });
    try {
      const response = await api.get<{ success: boolean; data: FinalTaxPlan[] }>(
        `/tax-planning-fna/client/${clientId}`
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch Tax Planning sessions', error);
      throw error;
    }
  },

  /**
   * Get latest published Tax Planning session
   */
  async getLatestPublished(clientId: string): Promise<FinalTaxPlan | null> {
    logger.debug('[TaxPlanningFnaAPI] Fetching latest published', { clientId });
    try {
      const response = await api.get<{ success: boolean; data: FinalTaxPlan | null }>(
        `/tax-planning-fna/client/${clientId}/latest-published`
      );
      return response.data || null;
    } catch (error) {
      const isNotFound =
        (error instanceof APIError && error.statusCode === 404) ||
        (error instanceof Error && error.message?.includes('404'));

      if (isNotFound) {
        logger.debug('No published Tax Planning FNA found', { clientId });
        return null;
      }

      logger.warn('Could not fetch latest published Tax Planning FNA', error);
      return null;
    }
  },

  /**
   * Delete Tax Planning session
   * Note: Not yet implemented on the backend — stubbed to prevent breaking consumers
   */
  async deleteSession(sessionId: string): Promise<void> {
    logger.warn('[TaxPlanningFnaAPI] Delete not implemented for Tax Planning sessions', { sessionId });
  },

  /**
   * Publish Tax Planning session
   * Legacy support — use saveSession with status='published' for new code
   */
  async publishSession(sessionId: string): Promise<void> {
    logger.warn('[TaxPlanningFnaAPI] Use saveSession with status="published" instead', { sessionId });
  },

  /**
   * Unpublish Tax Planning session
   * Legacy support — not yet implemented
   */
  async unpublishSession(sessionId: string): Promise<void> {
    logger.warn('[TaxPlanningFnaAPI] Unpublish not yet implemented', { sessionId });
  },
};

/**
 * Backward-compatible alias — consumers may import TaxPlanningApiService
 */
export const TaxPlanningApiService = TaxPlanningFnaAPI;
