/**
 * Analytics — aggregated Buffer metrics for the stat cards.
 */
import { api } from '../../../../../utils/api';
import type { SocialAnalyticsSummary } from '../types';

const BASE = '/social-marketing';

export const analyticsApi = {
  async getSummary(days = 30): Promise<SocialAnalyticsSummary> {
    const res = await api.get<{ success: boolean; data: SocialAnalyticsSummary }>(
      `${BASE}/analytics?days=${days}`,
    );
    return res.data;
  },
};
