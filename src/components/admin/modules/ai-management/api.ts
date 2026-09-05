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
  KnowledgeIndexStatus,
  IndexResult,
  KBEntry,
  KBSaveResult,
  CreateKBEntryInput,
  UpdateKBEntryInput,
  KBStats,
  PromptContext,
  PromptVersion,
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
      logger.warn('Agent registry fetch failed — using defaults', {
        error: getErrorMessage(error),
      });
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
      logger.warn(`Agent fetch failed for ${id} — using defaults`, {
        error: getErrorMessage(error),
      });
      return DEFAULT_AGENTS.find((a) => a.id === id) || null;
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
        `${ENDPOINTS.FEEDBACK_LIST}?limit=${limit}`,
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
      const url = status ? `${ENDPOINTS.HANDOFFS_LIST}?status=${status}` : ENDPOINTS.HANDOFFS_LIST;
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
    const response = await api.put<{ handoff: HandoffRequest }>(ENDPOINTS.HANDOFF_UPDATE(id), {
      status,
    });
    return response.handoff;
  },
};

// ============================================================================
// KNOWLEDGE INDEX
// ============================================================================

export const ragIndexApi = {
  /**
   * Get current index status. Returns null only when the request itself
   * fails; an index that has never been built comes back with `indexed: false`
   * so the UI can still show how much is waiting to be indexed.
   */
  async getStatus(): Promise<KnowledgeIndexStatus | null> {
    try {
      const r = await api.get<Partial<KnowledgeIndexStatus>>(ENDPOINTS.RAG_INDEX);
      return {
        indexed: !!r.indexed,
        articles: r.articles ?? [],
        kbEntries: r.kbEntries ?? [],
        totalChunks: r.totalChunks ?? 0,
        lastFullIndex: r.lastFullIndex ?? null,
        lastUpdated: r.lastUpdated ?? r.lastFullIndex ?? null,
        publishedArticleCount: r.publishedArticleCount ?? 0,
        activeKbCount: r.activeKbCount ?? 0,
        pendingArticles: r.pendingArticles ?? 0,
        pendingKbEntries: r.pendingKbEntries ?? 0,
        staleSources: r.staleSources ?? 0,
      };
    } catch (error) {
      logger.error('Failed to fetch knowledge index status', error);
      return null;
    }
  },

  /**
   * Rebuild the whole index: every published article and every live KB entry.
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
   * Create a new KB entry. The server syncs a live entry into Vasco's index
   * before answering and reports how that went alongside the entry.
   */
  async create(input: CreateKBEntryInput): Promise<KBSaveResult> {
    const response = await api.post<KBSaveResult>(ENDPOINTS.KB_LIST, input);
    return { entry: response.entry, index: response.index };
  },

  /**
   * Update an existing KB entry (same index sync as create).
   */
  async update(id: string, input: UpdateKBEntryInput): Promise<KBSaveResult> {
    const response = await api.put<KBSaveResult>(ENDPOINTS.KB_DETAIL(id), input);
    return { entry: response.entry, index: response.index };
  },

  /**
   * Delete a KB entry (hard delete).
   */
  async remove(id: string): Promise<void> {
    await api.delete(ENDPOINTS.KB_DETAIL(id));
  },
};

// ============================================================================
// PROMPTS (Phase 3)
// ============================================================================

export const promptApi = {
  async getBundle(
    agentId: string,
    context: PromptContext,
  ): Promise<{ active: string | null; draft: string | null; versions: PromptVersion[] }> {
    return await api.get(ENDPOINTS.PROMPT_BUNDLE(agentId, context));
  },
  async saveDraft(agentId: string, context: PromptContext, prompt: string): Promise<void> {
    await api.put(ENDPOINTS.PROMPT_DRAFT(agentId, context), { prompt });
  },
  async publish(agentId: string, context: PromptContext): Promise<PromptVersion> {
    const res = await api.post<{ version: PromptVersion }>(
      ENDPOINTS.PROMPT_PUBLISH(agentId, context),
      {},
    );
    return res.version;
  },
  async rollback(
    agentId: string,
    context: PromptContext,
    versionId: string,
  ): Promise<PromptVersion> {
    const res = await api.post<{ version: PromptVersion }>(
      ENDPOINTS.PROMPT_ROLLBACK(agentId, context),
      { versionId },
    );
    return res.version;
  },
  async seedIfMissing(
    agentId: string,
    context: PromptContext,
    seedPrompt: string,
  ): Promise<{ active: string | null; draft: string | null; versions: PromptVersion[] }> {
    return await api.post(ENDPOINTS.PROMPT_SEED(agentId, context), { seedPrompt });
  },
};
