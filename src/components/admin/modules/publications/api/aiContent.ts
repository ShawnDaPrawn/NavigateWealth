/**
 * AI writing, templates, versions and auto-content.
 *
 * Split out of `api.ts` (1,441 lines); `api.ts` still re-exports every group,
 * because consumers import the aggregate from there.
 */
import { getModuleUrl } from '../../../../../utils/api/config';
import type { AIWritingRequest, AIWritingResponse } from '../types';
import type {
  ContentTemplate,
  CreateTemplateInput,
  UpdateTemplateInput,
  ArticleVersion,
} from '../types';
import type { GenerateArticleBrief, GenerateArticleResult } from '../types';
import type {
  PipelineId,
  PipelineConfig,
  PipelineRunLog,
  PipelineTriggerResult,
  CalendarEvent,
  ContentSource,
  CreateContentSourceInput,
  DiscoveredFeed,
} from '../types';
import { AUTO_CONTENT_URL, BASE_URL, getAuthHeaders, handleResponse } from './shared';

// ============================================================================
// AI WRITING API
// ============================================================================

const AI_BASE_URL = getModuleUrl('publications-ai');

/**
 * AI Writing API namespace
 * AI-powered content generation and transformation (Phase 3)
 */
export const AIWritingAPI = {
  /**
   * Generate or transform content using AI
   */
  async generate(request: AIWritingRequest): Promise<AIWritingResponse> {
    const response = await fetch(`${AI_BASE_URL}/generate`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(request),
    });
    return handleResponse<AIWritingResponse>(response);
  },

  /**
   * Generate a complete article from a structured brief (Phase 5)
   */
  async generateArticle(brief: GenerateArticleBrief): Promise<GenerateArticleResult> {
    const response = await fetch(`${AI_BASE_URL}/generate-article`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(brief),
    });
    return handleResponse<GenerateArticleResult>(response);
  },
};

// ============================================================================
// CONTENT TEMPLATES API (Phase 4)
// ============================================================================

export const TemplatesAPI = {
  async getTemplates(): Promise<ContentTemplate[]> {
    const response = await fetch(`${BASE_URL}/templates`, { headers: await getAuthHeaders() });
    return handleResponse<ContentTemplate[]>(response);
  },

  async getTemplate(id: string): Promise<ContentTemplate> {
    const response = await fetch(`${BASE_URL}/templates/${id}`, {
      headers: await getAuthHeaders(),
    });
    return handleResponse<ContentTemplate>(response);
  },

  async createTemplate(input: CreateTemplateInput): Promise<ContentTemplate> {
    const response = await fetch(`${BASE_URL}/templates`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(input),
    });
    return handleResponse<ContentTemplate>(response);
  },

  async updateTemplate(id: string, input: UpdateTemplateInput): Promise<ContentTemplate> {
    const response = await fetch(`${BASE_URL}/templates/${id}`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify(input),
    });
    return handleResponse<ContentTemplate>(response);
  },

  async deleteTemplate(id: string): Promise<void> {
    const response = await fetch(`${BASE_URL}/templates/${id}`, {
      method: 'DELETE',
      headers: await getAuthHeaders(),
    });
    await handleResponse<void>(response);
  },

  async seedDefaults(): Promise<ContentTemplate[]> {
    const response = await fetch(`${BASE_URL}/templates/seed`, {
      method: 'POST',
      headers: await getAuthHeaders(),
    });
    return handleResponse<ContentTemplate[]>(response);
  },
};

// ============================================================================
// VERSION HISTORY API (Phase 4)
// ============================================================================

export const VersionsAPI = {
  async getVersions(articleId: string): Promise<ArticleVersion[]> {
    const response = await fetch(`${BASE_URL}/versions/${articleId}`, {
      headers: await getAuthHeaders(),
    });
    return handleResponse<ArticleVersion[]>(response);
  },

  async createVersion(articleId: string, editedBy?: string): Promise<ArticleVersion> {
    const response = await fetch(`${BASE_URL}/versions/${articleId}`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ edited_by: editedBy || 'system' }),
    });
    return handleResponse<ArticleVersion>(response);
  },

  async restoreVersion(articleId: string, versionId: string): Promise<unknown> {
    const response = await fetch(`${BASE_URL}/versions/${articleId}/${versionId}/restore`, {
      method: 'POST',
      headers: await getAuthHeaders(),
    });
    return handleResponse(response);
  },
};

// ============================================================================
// AUTO CONTENT API (Phase 5)
// ============================================================================

export const AutoContentAPI = {
  async getConfigs(): Promise<PipelineConfig[]> {
    const response = await fetch(`${AUTO_CONTENT_URL}/configs`, {
      headers: await getAuthHeaders(),
    });
    return handleResponse<PipelineConfig[]>(response);
  },

  async getConfig(id: PipelineId): Promise<PipelineConfig> {
    const response = await fetch(`${AUTO_CONTENT_URL}/configs/${id}`, {
      headers: await getAuthHeaders(),
    });
    return handleResponse<PipelineConfig>(response);
  },

  async updateConfig(id: PipelineId, updates: Partial<PipelineConfig>): Promise<PipelineConfig> {
    const response = await fetch(`${AUTO_CONTENT_URL}/configs/${id}`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    return handleResponse<PipelineConfig>(response);
  },

  async triggerPipeline(id: PipelineId): Promise<PipelineTriggerResult> {
    const response = await fetch(`${AUTO_CONTENT_URL}/trigger/${id}`, {
      method: 'POST',
      headers: await getAuthHeaders(),
    });
    return handleResponse<PipelineTriggerResult>(response);
  },

  async triggerAll(): Promise<PipelineTriggerResult[]> {
    const response = await fetch(`${AUTO_CONTENT_URL}/trigger-all`, {
      method: 'POST',
      headers: await getAuthHeaders(),
    });
    return handleResponse<PipelineTriggerResult[]>(response);
  },

  /**
   * Process pipelines that are due based on their scheduleIntervalHours.
   * Called by the client-side auto-content poller. Idempotent — safe to call repeatedly.
   */
  async processDue(): Promise<{
    processed: PipelineTriggerResult[];
    skippedCount: number;
    totalArticlesGenerated: number;
  }> {
    const response = await fetch(`${AUTO_CONTENT_URL}/process-due`, {
      method: 'POST',
      headers: await getAuthHeaders(),
    });
    return handleResponse<{
      processed: PipelineTriggerResult[];
      skippedCount: number;
      totalArticlesGenerated: number;
    }>(response);
  },

  async triggerSource(
    sourceId: string,
  ): Promise<{ results: PipelineTriggerResult[]; totalGenerated: number; sourceName: string }> {
    const response = await fetch(`${AUTO_CONTENT_URL}/trigger-source/${sourceId}`, {
      method: 'POST',
      headers: await getAuthHeaders(),
    });
    return handleResponse<{
      results: PipelineTriggerResult[];
      totalGenerated: number;
      sourceName: string;
    }>(response);
  },

  async getRunHistory(id: PipelineId, limit?: number): Promise<PipelineRunLog[]> {
    const params = limit ? `?limit=${limit}` : '';
    const response = await fetch(`${AUTO_CONTENT_URL}/history/${id}${params}`, {
      headers: await getAuthHeaders(),
    });
    return handleResponse<PipelineRunLog[]>(response);
  },

  async getCalendarEvents(): Promise<CalendarEvent[]> {
    const response = await fetch(`${AUTO_CONTENT_URL}/calendar-events`, {
      headers: await getAuthHeaders(),
    });
    return handleResponse<CalendarEvent[]>(response);
  },

  async addCalendarEvent(event: Omit<CalendarEvent, 'id'>): Promise<CalendarEvent> {
    const response = await fetch(`${AUTO_CONTENT_URL}/calendar-events`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(event),
    });
    return handleResponse<CalendarEvent>(response);
  },

  async updateCalendarEvent(id: string, updates: Partial<CalendarEvent>): Promise<CalendarEvent> {
    const response = await fetch(`${AUTO_CONTENT_URL}/calendar-events/${id}`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    return handleResponse<CalendarEvent>(response);
  },

  async deleteCalendarEvent(id: string): Promise<void> {
    const response = await fetch(`${AUTO_CONTENT_URL}/calendar-events/${id}`, {
      method: 'DELETE',
      headers: await getAuthHeaders(),
    });
    await handleResponse<void>(response);
  },

  // ── Content Sources ─────────────────────────────────────────────

  async getContentSources(): Promise<ContentSource[]> {
    const response = await fetch(`${AUTO_CONTENT_URL}/sources`, {
      headers: await getAuthHeaders(),
    });
    return handleResponse<ContentSource[]>(response);
  },

  async addContentSource(input: CreateContentSourceInput): Promise<ContentSource> {
    const response = await fetch(`${AUTO_CONTENT_URL}/sources`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(input),
    });
    return handleResponse<ContentSource>(response);
  },

  async updateContentSource(id: string, updates: Partial<ContentSource>): Promise<ContentSource> {
    const response = await fetch(`${AUTO_CONTENT_URL}/sources/${id}`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    return handleResponse<ContentSource>(response);
  },

  async deleteContentSource(id: string): Promise<void> {
    const response = await fetch(`${AUTO_CONTENT_URL}/sources/${id}`, {
      method: 'DELETE',
      headers: await getAuthHeaders(),
    });
    await handleResponse<void>(response);
  },

  // ── Feed Discovery ───────────────────────────────────────────────

  /**
   * Discover RSS/Atom feeds from a webpage URL.
   * If the URL is already an RSS feed, returns it directly.
   * Otherwise parses the HTML for <link rel="alternate"> feed tags
   * and probes common feed paths as a fallback.
   */
  async discoverFeeds(url: string): Promise<DiscoveredFeed[]> {
    const response = await fetch(`${AUTO_CONTENT_URL}/sources/discover-feeds`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ url }),
    });
    return handleResponse<DiscoveredFeed[]>(response);
  },
};
