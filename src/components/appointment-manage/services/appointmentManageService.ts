/**
 * Appointment Manage Service
 * API service for the public (tokenized, no-login) appointment manage page.
 * Mirrors esignSignerService: direct fetch with the public anon key.
 */

import { projectId, publicAnonKey } from '../../../utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/appointments`;

export type MeetingKind = 'virtual' | 'in_person' | 'phone';

export interface PublicAppointment {
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  meeting_kind: MeetingKind;
  join_url: string | null;
  location: string | null;
  status: 'confirmed' | 'reschedule_requested' | 'cancelled' | 'completed';
  advisor_name: string;
  has_open_reschedule_request: boolean;
}

export interface ProposedTime {
  start_at: string;
  end_at: string;
}

interface ServiceResult<T = undefined> {
  success: boolean;
  data?: T;
  error?: string;
}

async function post<T>(path: string, body: Record<string, unknown>): Promise<ServiceResult<T>> {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${publicAnonKey}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        success: false,
        error: data.error || data.message || 'Something went wrong. Please try again.',
      };
    }
    return { success: true, data: data as T };
  } catch (error) {
    console.error('Appointment manage request failed:', error);
    return { success: false, error: 'Network error. Please check your connection.' };
  }
}

export const appointmentManageService = {
  getAppointment(token: string) {
    return post<PublicAppointment>('/public/manage', { token });
  },

  requestReschedule(token: string, proposedTimes: ProposedTime[], note?: string) {
    return post('/public/reschedule-request', {
      token,
      proposed_times: proposedTimes,
      note: note || null,
    });
  },

  cancel(token: string, reason?: string) {
    return post('/public/cancel', { token, reason: reason || null });
  },
};
