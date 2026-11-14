/**
 * Partner advertisers — the practice's referral partners (admin CRUD).
 */
import { api } from '../../../../../utils/api';
import type { PartnerInput, SocialPartner } from '../types';

const BASE = '/social-partners';

export const partnersApi = {
  async list(): Promise<SocialPartner[]> {
    const res = await api.get<{ success: boolean; data: SocialPartner[] }>(BASE);
    return res.data;
  },
  async create(input: PartnerInput): Promise<SocialPartner> {
    const res = await api.post<{ success: boolean; data: SocialPartner }>(BASE, input);
    return res.data;
  },
  async update(id: string, patch: Partial<PartnerInput>): Promise<SocialPartner> {
    const res = await api.put<{ success: boolean; data: SocialPartner }>(`${BASE}/${id}`, patch);
    return res.data;
  },
  async remove(id: string): Promise<void> {
    await api.delete(`${BASE}/${id}`);
  },
};
