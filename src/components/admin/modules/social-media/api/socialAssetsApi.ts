/**
 * Social automation — the Assets tab's view of the routine-driven pipeline.
 *
 * Reads batches/assets the routines wrote, the settings (including the kill
 * switch) and the playbooks the routines follow; the two jobs can be run on
 * demand from the UI.
 */
import { api } from '../../../../../utils/api';
import type {
  RenderImagesReport,
  SocialAsset,
  SocialAssetBatch,
  SocialAssetPatch,
  SocialAutomationPlaybook,
  SocialAutomationSettings,
  SocialAutomationSettingsPatch,
  SocialBatchSummary,
  SocialJobName,
  SyncBufferReport,
} from '../types';

const BASE = '/social-assets';

export interface AssetListFilters {
  week?: string;
  channel?: string;
  state?: string;
  limit?: number;
}

export const socialAssetsApi = {
  async listBatches(limit = 12): Promise<SocialBatchSummary[]> {
    const res = await api.get<{ success: boolean; batches: SocialBatchSummary[] }>(
      `${BASE}/batches?limit=${limit}`,
    );
    return res.batches ?? [];
  },

  async getBatch(weekKey: string): Promise<{ batch: SocialAssetBatch; assets: SocialAsset[] }> {
    const res = await api.get<{ success: boolean; batch: SocialAssetBatch; assets: SocialAsset[] }>(
      `${BASE}/batches/${encodeURIComponent(weekKey)}`,
    );
    return { batch: res.batch, assets: res.assets ?? [] };
  },

  async listAssets(filters: AssetListFilters = {}): Promise<SocialAsset[]> {
    const params = new URLSearchParams();
    if (filters.week) params.set('week', filters.week);
    if (filters.channel) params.set('channel', filters.channel);
    if (filters.state) params.set('state', filters.state);
    if (filters.limit) params.set('limit', String(filters.limit));
    const query = params.toString();
    const res = await api.get<{ success: boolean; assets: SocialAsset[] }>(
      query ? `${BASE}/assets?${query}` : `${BASE}/assets`,
    );
    return res.assets ?? [];
  },

  async updateAsset(assetId: string, patch: SocialAssetPatch): Promise<SocialAsset> {
    const res = await api.patch<{ success: boolean; asset: SocialAsset }>(
      `${BASE}/assets/${assetId}`,
      patch,
    );
    return res.asset;
  },

  async getSettings(): Promise<SocialAutomationSettings> {
    const res = await api.get<{ success: boolean; settings: SocialAutomationSettings }>(
      `${BASE}/settings`,
    );
    return res.settings;
  },

  async updateSettings(patch: SocialAutomationSettingsPatch): Promise<SocialAutomationSettings> {
    const res = await api.put<{ success: boolean; settings: SocialAutomationSettings }>(
      `${BASE}/settings`,
      patch,
    );
    return res.settings;
  },

  async listPlaybooks(): Promise<SocialAutomationPlaybook[]> {
    const res = await api.get<{ success: boolean; playbooks: SocialAutomationPlaybook[] }>(
      `${BASE}/playbooks`,
    );
    return res.playbooks ?? [];
  },

  async updatePlaybook(
    id: SocialAutomationPlaybook['id'],
    patch: { title?: string; instructions?: string },
  ): Promise<SocialAutomationPlaybook> {
    const res = await api.put<{ success: boolean; playbook: SocialAutomationPlaybook }>(
      `${BASE}/playbooks/${id}`,
      patch,
    );
    return res.playbook;
  },

  /** Run a job now (live, not a dry run) — the admin equivalent of the cron tick. */
  async runJob(job: SocialJobName): Promise<RenderImagesReport | SyncBufferReport> {
    const res = await api.post<{ success: boolean; report: RenderImagesReport | SyncBufferReport }>(
      `${BASE}/jobs/${job}`,
      { dryRun: false },
    );
    return res.report;
  },
};
