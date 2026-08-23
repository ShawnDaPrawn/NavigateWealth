/**
 * Sender preferences, webhook subscriptions and in-app notifications.
 *
 * One slice of what used to be the single 1,300-line `esignApi` object. The
 * aggregate in `../api.ts` spreads every slice back together, so consumers
 * keep calling `esignApi.method(...)` unchanged.
 */
import { api } from '../../../../../utils/api/client';

export const notificationsApi = {
  // ==================== P5.2 — SENDER NOTIFICATION PREFERENCES ==================

  async getNotificationPreferences(): Promise<{
    success: boolean;
    preferences: {
      userId: string;
      mode: 'every_event' | 'completion_only' | 'digest' | 'off';
      perEvent?: Record<string, boolean>;
      updated_at: string;
    };
  }> {
    return api.get('/esign/me/notification-prefs');
  },

  async setNotificationPreferences(input: {
    mode?: 'every_event' | 'completion_only' | 'digest' | 'off';
    perEvent?: Record<string, boolean>;
  }): Promise<{
    success: boolean;
    preferences: {
      userId: string;
      mode: 'every_event' | 'completion_only' | 'digest' | 'off';
      perEvent?: Record<string, boolean>;
      updated_at: string;
    };
  }> {
    return api.put('/esign/me/notification-prefs', input);
  },

  // ==================== P5.4 — WEBHOOK SUBSCRIPTIONS ====================

  async listWebhookSubscriptions(): Promise<{
    subscriptions: Array<{
      id: string;
      url: string;
      secret: string;
      events: string[];
      active: boolean;
      description?: string;
      created_at: string;
      updated_at: string;
      last_success_at?: string;
      last_failure_at?: string;
      last_failure_message?: string;
    }>;
  }> {
    return api.get('/esign/webhooks');
  },

  async createWebhookSubscription(input: {
    url: string;
    events: string[];
    description?: string;
  }): Promise<{
    subscription: { id: string; secret: string; url: string; events: string[]; active: boolean };
  }> {
    return api.post('/esign/webhooks', input);
  },

  async updateWebhookSubscription(
    id: string,
    patch: { url?: string; events?: string[]; active?: boolean; description?: string },
  ): Promise<{ subscription: { id: string; url: string; events: string[]; active: boolean } }> {
    return api.patch(`/esign/webhooks/${id}`, patch);
  },

  async rotateWebhookSecret(id: string): Promise<{ subscription: { id: string; secret: string } }> {
    return api.post(`/esign/webhooks/${id}/rotate-secret`);
  },

  async deleteWebhookSubscription(id: string): Promise<{ success: boolean }> {
    return api.delete(`/esign/webhooks/${id}`);
  },

  async listWebhookDeliveries(opts?: {
    status?: 'pending' | 'delivered' | 'failed' | 'dead';
    limit?: number;
  }): Promise<{
    deliveries: Array<{
      id: string;
      subscription_id: string;
      event_type: string;
      envelope_id?: string;
      attempts: number;
      status: 'pending' | 'delivered' | 'failed' | 'dead';
      next_attempt_at: string;
      last_attempt_at?: string;
      last_error?: string;
      response_code?: number;
      created_at: string;
      delivered_at?: string;
    }>;
  }> {
    const qs = new URLSearchParams();
    if (opts?.status) qs.set('status', opts.status);
    if (opts?.limit) qs.set('limit', String(opts.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return api.get(`/esign/webhooks/deliveries${suffix}`);
  },

  async listWebhookDeadLetters(): Promise<{
    deliveries: Array<{
      id: string;
      event_type: string;
      last_error?: string;
      attempts: number;
      created_at: string;
    }>;
  }> {
    return api.get('/esign/webhooks/dead-letters');
  },

  async replayWebhookDelivery(id: string): Promise<{ delivery: { id: string; status: string } }> {
    return api.post(`/esign/webhooks/deliveries/${id}/replay`);
  },

  // ==================== P5.7 — IN-APP NOTIFICATIONS ====================

  async listInAppNotifications(opts?: { limit?: number; unreadOnly?: boolean }): Promise<{
    success: boolean;
    items: Array<{
      id: string;
      user_id: string;
      type: string;
      title: string;
      body: string;
      envelope_id?: string;
      signer_id?: string;
      created_at: string;
      read_at?: string;
      metadata?: Record<string, unknown>;
    }>;
    unread: number;
    total: number;
  }> {
    const qs = new URLSearchParams();
    if (opts?.limit) qs.set('limit', String(opts.limit));
    if (opts?.unreadOnly) qs.set('unreadOnly', 'true');
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return api.get(`/esign/me/notifications${suffix}`);
  },

  async markInAppNotificationRead(id: string): Promise<{ success: boolean }> {
    return api.post(`/esign/me/notifications/${id}/read`);
  },

  async markAllInAppNotificationsRead(): Promise<{ success: boolean; updated: number }> {
    return api.post(`/esign/me/notifications/read-all`);
  },
};
