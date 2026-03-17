/**
 * AI Management Module — API Layer
 *
 * Data boundary for the AI Agent Management module.
 * All server communication goes through the centralised api client.
 *
 * Guidelines: §5.1
 */

import { api } from '../../../../utils/api/client';
import { logger } from '../../../../utils/logger';
import { getErrorMessage } from '../../../../utils/errorUtils';
import { ENDPOINTS, DEFAULT_AGENTS } from './constants';
import type {
  AIAgentConfig,
  VascoConfig,
  AnalyticsSummary,
  FeedbackEntry,
  HandoffRequest,
  HandoffStatus,
  ArticleIndex,
  IndexResult,
  KBEntry,
  CreateKBEntryInput,
  UpdateKBEntryInput,
  KBStats,
} from './types';

// ============================================================================
// AGENT REGISTRY
// ============================================================================

export const agentApi = {
  /**
   * Get all registered agents.
   * Phase 1: Returns default agents merged with any KV-stored overrides.
   */
  async getAgents(): Promise<AIAgentConfig[]> {
    try {
      const response = await api.get<{ agents: AIAgentConfig[] }>(ENDPOINTS.AGENTS_LIST);
      return response.agents;
    } catch (error) {
      // Fallback to defaults if backend route not yet available
      logger.warn('Agent registry fetch failed — using defaults', { error: getErrorMessage(error) });
      return DEFAULT_AGENTS;
    }
  },

  /**
   * Get a single agent config by ID.
   */
  async getAgent(id: string): Promise<AIAgentConfig | null> {
    try {
      const response = await api.get<{ agent: AIAgentConfig }>(ENDPOINTS.AGENT_DETAIL(id));
      return response.agent;
    } catch (error) {
      logger.warn(`Agent fetch failed for ${id} — using defaults`, { error: getErrorMessage(error) });
      return DEFAULT_AGENTS.find(a => a.id === id) || null;
    }
  },
};

// ============================================================================
// VASCO CONFIG (Feature Flag)
// ============================================================================

export const vascoConfigApi = {
  /**
   * Get Vasco feature flag config.
   */
  async getConfig(): Promise<VascoConfig> {
    try {
      const response = await api.get<{ config: VascoConfig }>(ENDPOINTS.VASCO_CONFIG);
      return response.config;
    } catch (error) {
      logger.error('Failed to fetch Vasco config', error);
      return { enabled: false, updatedAt: new Date().toISOString(), updatedBy: 'system' };
    }
  },

  /**
   * Toggle Vasco feature flag.
   */
  async updateConfig(enabled: boolean): Promise<VascoConfig> {
    const response = await api.put<{ config: VascoConfig }>(ENDPOINTS.VASCO_CONFIG, { enabled });
    return response.config;
  },
};

// ============================================================================
// ANALYTICS
// ============================================================================

export const analyticsApi = {
  /**
   * Get analytics summary (last 7 days).
   */
  async getSummary(): Promise<AnalyticsSummary> {
    try {
      const response = await api.get<AnalyticsSummary>(ENDPOINTS.ANALYTICS_SUMMARY);
      return response;
    } catch (error) {
      logger.error('Failed to fetch analytics summary', error);
      throw error;
    }
  },
};

// ============================================================================
// FEEDBACK
// ============================================================================

export const feedbackApi = {
  /**
   * Get recent feedback entries.
   */
  async getRecent(limit = 50): Promise<FeedbackEntry[]> {
    try {
      const response = await api.get<{ feedback: FeedbackEntry[] }>(
        `${ENDPOINTS.FEEDBACK_LIST}?limit=${limit}`
      );
      return response.feedback;
    } catch (error) {
      logger.error('Failed to fetch feedback', error);
      throw error;
    }
  },
};

// ============================================================================
// HANDOFFS
// ============================================================================

export const handoffApi = {
  /**
   * Get all handoff requests.
   */
  async getAll(status?: HandoffStatus): Promise<HandoffRequest[]> {
    try {
      const url = status
        ? `${ENDPOINTS.HANDOFFS_LIST}?status=${status}`
        : ENDPOINTS.HANDOFFS_LIST;
      const response = await api.get<{ handoffs: HandoffRequest[] }>(url);
      return response.handoffs;
    } catch (error) {
      logger.error('Failed to fetch handoffs', error);
      throw error;
    }
  },

  /**
   * Update a handoff request status.
   */
  async updateStatus(id: string, status: HandoffStatus): Promise<HandoffRequest> {
    const response = await api.put<{ handoff: HandoffRequest }>(
      ENDPOINTS.HANDOFF_UPDATE(id),
      { status }
    );
    return response.handoff;
  },
};

// ============================================================================
// RAG INDEX
// ============================================================================

export const ragIndexApi = {
  /**
   * Get current index status.
   */
  async getStatus(): Promise<ArticleIndex | null> {
    try {
      const response = await api.get<{
        indexed: boolean;
        articles: ArticleIndex['articles'];
        totalChunks: number;
        lastFullIndex: string | null;
      }>(ENDPOINTS.RAG_INDEX);
      if (!response.indexed || !response.lastFullIndex) return null;
      return {
        articles: response.articles,
        totalChunks: response.totalChunks,
        lastFullIndex: response.lastFullIndex,
      };
    } catch (error) {
      logger.error('Failed to fetch RAG index status', error);
      return null;
    }
  },

  /**
   * Trigger full re-indexing.
   */
  async triggerReindex(): Promise<IndexResult> {
    const response = await api.post<IndexResult>(ENDPOINTS.RAG_INDEX, {});
    return response;
  },

  /**
   * Clear the article index.
   */
  async clearIndex(): Promise<void> {
    await api.delete(ENDPOINTS.RAG_INDEX);
  },
};

// ============================================================================
// KNOWLEDGE BASE (Phase 2)
// ============================================================================

export const kbApi = {
  /**
   * Get all KB entries.
   */
  async getAll(): Promise<KBEntry[]> {
    try {
      const response = await api.get<{ entries: KBEntry[] }>(ENDPOINTS.KB_LIST);
      return response.entries;
    } catch (error) {
      logger.error('Failed to fetch KB entries', error);
      throw error;
    }
  },

  /**
   * Get KB summary stats.
   */
  async getStats(): Promise<KBStats> {
    try {
      const response = await api.get<{ stats: KBStats }>(ENDPOINTS.KB_STATS);
      return response.stats;
    } catch (error) {
      logger.error('Failed to fetch KB stats', error);
      throw error;
    }
  },

  /**
   * Get a single KB entry by ID.
   */
  async getEntry(id: string): Promise<KBEntry> {
    const response = await api.get<{ entry: KBEntry }>(ENDPOINTS.KB_DETAIL(id));
    return response.entry;
  },

  /**
   * Create a new KB entry.
   */
  async create(input: CreateKBEntryInput): Promise<KBEntry> {
    const response = await api.post<{ entry: KBEntry }>(ENDPOINTS.KB_LIST, input);
    return response.entry;
  },

  /**
   * Update an existing KB entry.
   */
  async update(id: string, input: UpdateKBEntryInput): Promise<KBEntry> {
    const response = await api.put<{ entry: KBEntry }>(ENDPOINTS.KB_DETAIL(id), input);
    return response.entry;
  },

  /**
   * Delete a KB entry (hard delete).
   */
  async remove(id: string): Promise<void> {
    await api.delete(ENDPOINTS.KB_DETAIL(id));
  },
};