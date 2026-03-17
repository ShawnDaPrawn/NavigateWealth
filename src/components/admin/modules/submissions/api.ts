/**
 * Submissions Manager — API Layer
 *
 * Data boundary for all submission operations. Follows §5.1 — this is
 * the only layer that communicates with the server. No business logic lives
 * here; it simply maps server responses to typed application models.
 */

import { api } from '../../../../utils/api/client';
import type {
  Submission,
  CreateSubmissionInput,
  UpdateSubmissionInput,
  SubmissionsFilters,
} from './types';

export const submissionsApi = {
  /**
   * Fetch all submissions with optional type/status filters.
   */
  async list(filters?: SubmissionsFilters): Promise<Submission[]> {
    const params = new URLSearchParams();
    if (filters?.type) params.append('type', filters.type);
    if (filters?.status) params.append('status', filters.status);
    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await api.get<{ success: boolean; data: Submission[] }>(
      `/submissions${query}`
    );
    return response.data || [];
  },

  /**
   * Fetch a single submission by ID.
   */
  async getById(id: string): Promise<Submission> {
    const response = await api.get<{ success: boolean; data: Submission }>(
      `/submissions/${id}`
    );
    return response.data;
  },

  /**
   * Create a new submission.
   * Called by website form components once they are complete.
   */
  async create(input: CreateSubmissionInput): Promise<Submission> {
    const response = await api.post<{ success: boolean; data: Submission }>(
      '/submissions',
      input
    );
    return response.data;
  },

  /**
   * Update a submission's status, notes, or payload.
   */
  async update(id: string, input: UpdateSubmissionInput): Promise<Submission> {
    const response = await api.patch<{ success: boolean; data: Submission }>(
      `/submissions/${id}`,
      input
    );
    return response.data;
  },

  /**
   * Fetch the count of 'new' submissions for the nav badge.
   */
  async countNew(): Promise<number> {
    const response = await api.get<{ success: boolean; count: number }>(
      '/submissions/count/new'
    );
    return response.count ?? 0;
  },

  /**
   * Hard delete a submission.
   */
  async delete(id: string): Promise<void> {
    await api.delete<void>(`/submissions/${id}`);
  },

  /**
   * Send a branded invitation email to a client directing them
   * to a specific submission form (quote, consultation, will, etc.).
   */
  async sendInvite(params: {
    recipientEmail: string;
    recipientName?: string;
    inviteTypeId: string;
    formUrl: string;
    emailSubject: string;
    emailBody: string;
    emailButtonLabel: string;
    personalMessage?: string;
  }): Promise<{ success: boolean; message?: string; error?: string }> {
    const response = await api.post<{ success: boolean; message?: string; error?: string }>(
      '/submissions/invite',
      params
    );
    return response;
  },
};