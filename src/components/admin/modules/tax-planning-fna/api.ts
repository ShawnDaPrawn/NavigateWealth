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

/** `?clientId=…`, for a session whose id does not name its client. */
function clientQuery(clientId?: string): string {
  return clientId ? `?clientId=${encodeURIComponent(clientId)}` : '';
}

export const TaxPlanningFnaAPI = {
  /**
   * Auto-populate Tax Planning inputs from client profile
   */
  async autoPopulateInputs(clientId: string): Promise<Partial<TaxPlanningInputs>> {
    logger.debug('[TaxPlanningFnaAPI] Auto-populating inputs', { clientId });
    try {
      const response = await api.post<{ success: boolean; data: Partial<TaxPlanningInputs> }>(
        `/tax-planning-fna/client/${clientId}/auto-populate`,
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
    },
  ): Promise<FinalTaxPlan & { id: string }> {
    logger.debug('[TaxPlanningFnaAPI] Saving session', { clientId, status: data.status });
    try {
      const response = await api.post<{ success: boolean; data: FinalTaxPlan & { id: string } }>(
        '/tax-planning-fna/save',
        { clientId, ...data },
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
        `/tax-planning-fna/client/${clientId}`,
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch Tax Planning sessions', error);
      throw error;
    }
  },

  /**
   * Get one Tax Planning session by id
   */
  async getSessionById(sessionId: string): Promise<FinalTaxPlan> {
    logger.debug('[TaxPlanningFnaAPI] Fetching session', { sessionId });
    try {
      const response = await api.get<{ success: boolean; data: FinalTaxPlan }>(
        `/tax-planning-fna/${sessionId}`,
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch Tax Planning session', error);
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
        `/tax-planning-fna/client/${clientId}/latest-published`,
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

      logger.warn('Could not fetch latest published Tax Planning FNA', { error });
      return null;
    }
  },

  /**
   * Delete a Tax Planning session. `clientId` lets the server find a session
   * whose id does not name its client (one made from a client intake).
   */
  async deleteSession(sessionId: string, clientId?: string): Promise<void> {
    logger.debug('[TaxPlanningFnaAPI] Deleting session', { sessionId });
    try {
      await api.delete(`/tax-planning-fna/${sessionId}${clientQuery(clientId)}`);
    } catch (error) {
      logger.error('Failed to delete Tax Planning session', error);
      throw error;
    }
  },

  /** Publish a Tax Planning session, so the client sees it. */
  async publishSession(sessionId: string, clientId?: string): Promise<FinalTaxPlan> {
    logger.debug('[TaxPlanningFnaAPI] Publishing session', { sessionId });
    try {
      const response = await api.put<{ success: boolean; data: FinalTaxPlan }>(
        `/tax-planning-fna/${sessionId}/publish${clientQuery(clientId)}`,
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to publish Tax Planning session', error);
      throw error;
    }
  },

  /** Return a published Tax Planning session to a draft. */
  async unpublishSession(sessionId: string, clientId?: string): Promise<FinalTaxPlan> {
    logger.debug('[TaxPlanningFnaAPI] Unpublishing session', { sessionId });
    try {
      const response = await api.put<{ success: boolean; data: FinalTaxPlan }>(
        `/tax-planning-fna/${sessionId}/unpublish${clientQuery(clientId)}`,
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to unpublish Tax Planning session', error);
      throw error;
    }
  },
};

/**
 * Backward-compatible alias — consumers may import TaxPlanningApiService
 */
export const TaxPlanningApiService = TaxPlanningFnaAPI;
