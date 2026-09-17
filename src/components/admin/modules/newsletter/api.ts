/**
 * Newsletter — API layer.
 *
 * All calls go through the shared api client (token refresh, retry,
 * APIError typing) — never raw fetch (raw-fetch ratchet) and never the
 * anon key as a bearer. The PDF goes up as multipart FormData, which the
 * client sends as-is (it drops the JSON content type so the browser sets
 * the boundary).
 */
import { api } from '../../../../utils/api/client';
import { ENDPOINTS } from './constants';
import type {
  CampaignListResult,
  CreateCampaignInput,
  NewsletterCampaign,
  NewsletterCampaignStats,
  NewsletterDashboardSummary,
  NewsletterListView,
  ProcessResult,
  RecipientPageResult,
  TestSendResult,
  UpdateCampaignInput,
} from './types';

export const newsletterStudioApi = {
  async getDashboard(): Promise<NewsletterDashboardSummary> {
    const response = await api.get<{ data: NewsletterDashboardSummary }>(ENDPOINTS.DASHBOARD);
    return response.data;
  },

  async getCampaigns(
    params: {
      page?: number;
      limit?: number;
      status?: string;
      search?: string;
    } = {},
  ): Promise<CampaignListResult> {
    const q = new URLSearchParams();
    q.set('page', String(params.page ?? 1));
    q.set('limit', String(params.limit ?? 100));
    if (params.status && params.status !== 'all') q.set('status', params.status);
    if (params.search?.trim()) q.set('search', params.search.trim());
    const response = await api.get<Partial<CampaignListResult>>(
      `${ENDPOINTS.CAMPAIGNS}?${q.toString()}`,
    );
    return {
      campaigns: response.campaigns ?? [],
      total: response.total ?? 0,
      page: response.page ?? 1,
      limit: response.limit ?? 100,
      statusCounts: {
        draft: 0,
        scheduled: 0,
        queued: 0,
        sending: 0,
        paused: 0,
        finished: 0,
        cancelled: 0,
        ...(response.statusCounts ?? {}),
      },
    };
  },

  async getCampaign(id: string): Promise<NewsletterCampaign> {
    const response = await api.get<{ campaign: NewsletterCampaign }>(ENDPOINTS.CAMPAIGN(id));
    return response.campaign;
  },

  async createCampaign(input: CreateCampaignInput): Promise<NewsletterCampaign> {
    const response = await api.post<{ campaign: NewsletterCampaign }>(ENDPOINTS.CAMPAIGNS, input);
    return response.campaign;
  },

  async updateCampaign(id: string, patch: UpdateCampaignInput): Promise<NewsletterCampaign> {
    const response = await api.put<{ campaign: NewsletterCampaign }>(ENDPOINTS.CAMPAIGN(id), patch);
    return response.campaign;
  },

  async deleteCampaign(id: string): Promise<void> {
    await api.delete(ENDPOINTS.CAMPAIGN(id));
  },

  /** Upload or replace the newsletter PDF. */
  async uploadPdf(id: string, file: File): Promise<NewsletterCampaign> {
    const form = new FormData();
    form.append('file', file, file.name);
    const response = await api.post<{ campaign: NewsletterCampaign }>(
      ENDPOINTS.CAMPAIGN_PDF(id),
      form,
    );
    return response.campaign;
  },

  /** A short-lived signed URL for previewing the PDF (open it in a new tab). */
  async getPdfUrl(id: string): Promise<{ url: string; fileName: string }> {
    const response = await api.get<{ url: string; fileName: string }>(ENDPOINTS.CAMPAIGN_PDF(id));
    return { url: response.url, fileName: response.fileName };
  },

  async sendTest(id: string, emails: string[]): Promise<TestSendResult[]> {
    const response = await api.post<{ results: TestSendResult[] }>(ENDPOINTS.CAMPAIGN_TEST(id), {
      emails,
    });
    return response.results ?? [];
  },

  async scheduleCampaign(id: string, scheduledAt: string): Promise<NewsletterCampaign> {
    const response = await api.post<{ campaign: NewsletterCampaign }>(
      ENDPOINTS.CAMPAIGN_SCHEDULE(id),
      { scheduledAt },
    );
    return response.campaign;
  },

  async sendCampaignNow(id: string): Promise<NewsletterCampaign> {
    const response = await api.post<{ campaign: NewsletterCampaign }>(
      ENDPOINTS.CAMPAIGN_SEND_NOW(id),
    );
    return response.campaign;
  },

  /** Retry a newsletter the processor stopped on a provider fault. */
  async resumeCampaign(id: string): Promise<NewsletterCampaign> {
    const response = await api.post<{ campaign: NewsletterCampaign }>(
      ENDPOINTS.CAMPAIGN_RESUME(id),
    );
    return response.campaign;
  },

  async cancelCampaign(id: string): Promise<NewsletterCampaign> {
    const response = await api.post<{ campaign: NewsletterCampaign }>(
      ENDPOINTS.CAMPAIGN_CANCEL(id),
    );
    return response.campaign;
  },

  /** Put this newsletter on the public website, or refresh what is already there. */
  async publishToWebsite(id: string, issueMonth?: string): Promise<NewsletterCampaign> {
    const data = await api.post<{ campaign: NewsletterCampaign }>(
      ENDPOINTS.CAMPAIGN_PUBLISH(id),
      issueMonth ? { issueMonth } : {},
    );
    return data.campaign;
  },

  /** Take this newsletter off the public website. The campaign itself is untouched. */
  async unpublishFromWebsite(id: string): Promise<NewsletterCampaign> {
    const data = await api.delete<{ campaign: NewsletterCampaign }>(ENDPOINTS.CAMPAIGN_PUBLISH(id));
    return data.campaign;
  },

  async getRecipients(
    id: string,
    params: { page?: number; limit?: number; status?: string } = {},
  ): Promise<RecipientPageResult> {
    const q = new URLSearchParams();
    q.set('page', String(params.page ?? 1));
    q.set('limit', String(params.limit ?? 50));
    if (params.status && params.status !== 'all') q.set('status', params.status);
    const response = await api.get<RecipientPageResult>(
      `${ENDPOINTS.CAMPAIGN_RECIPIENTS(id)}?${q.toString()}`,
    );
    return {
      recipients: response.recipients ?? [],
      total: response.total ?? 0,
      page: response.page ?? 1,
      limit: response.limit ?? 50,
    };
  },

  async getStats(id: string): Promise<NewsletterCampaignStats> {
    const response = await api.get<{ stats: NewsletterCampaignStats }>(
      ENDPOINTS.CAMPAIGN_STATS(id),
    );
    return response.stats;
  },

  async getLists(): Promise<NewsletterListView[]> {
    const response = await api.get<{ lists: NewsletterListView[] }>(ENDPOINTS.LISTS);
    return response.lists ?? [];
  },

  /** Best-effort accelerator tick; cron remains the authoritative driver. */
  async process(): Promise<ProcessResult> {
    const response = await api.post<{ result: ProcessResult }>(ENDPOINTS.PROCESS, {});
    return response.result;
  },

  /** Public click-through ping used by the click page (no session required). */
  async trackClick(campaignId: string, token: string, linkId: string): Promise<string> {
    const response = await api.post<{ url: string }>(ENDPOINTS.TRACK_CLICK, {
      campaignId,
      token,
      linkId,
    });
    return response.url;
  },
};
