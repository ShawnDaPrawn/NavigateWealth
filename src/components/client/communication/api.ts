/**
 * Client Communication Module — API Layer
 *
 * Data boundary for all client-facing communication endpoints.
 * Guidelines refs: §5.1 (API layer), §3.2 (three-tier architecture)
 *
 * Raw API responses are mapped to stable application-level models here.
 * Raw errors never escape this layer.
 */

import { api } from '../../../utils/api';
import { createClient } from '../../../utils/supabase/client';
import { projectId } from '../../../utils/supabase/info';
import type {
  Communication,
  InboxResponse,
  CommunicationSettings,
} from './types';

// ── Inbox API ───────────────────────────────────────────────────────────────

/**
 * Fetch the current user's inbox messages.
 * Maps backend DTO fields to the stable `Communication` model.
 */
export async function fetchInbox(): Promise<Communication[]> {
  const response = await api.get<InboxResponse>('/communication/inbox');
  const messages = response.messages || [];

  return messages.map((msg) => ({
    id: msg.id,
    from: msg.sender_name || msg.from || 'Navigate Wealth',
    fromRole: (msg.sender_role || msg.fromRole || 'System') as Communication['fromRole'],
    subject: msg.subject,
    message: msg.content || msg.message || '',
    category: (msg.category || 'General') as Communication['category'],
    timestamp: new Date(msg.created_at || msg.timestamp || Date.now()),
    read: msg.read || false,
    priority: (msg.priority || 'normal') as Communication['priority'],
  }));
}

/**
 * Mark a single message as read.
 */
export async function markAsRead(messageId: string): Promise<void> {
  await api.post(`/communication/read/${messageId}`);
}

// ── Preferences API ─────────────────────────────────────────────────────────

/**
 * Helper: get the current user's access token via Supabase session.
 */
async function getAccessToken(): Promise<string | null> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

/**
 * Fetch the user's communication preferences.
 */
export async function fetchPreferences(): Promise<CommunicationSettings | null> {
  const token = await getAccessToken();
  if (!token) return null;

  const res = await fetch(
    `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/client-portal/comm-prefs`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const json = await res.json();

  if (!json.success || !json.data) return null;

  return {
    transactional: json.data.transactional ?? { email: true, sms: true },
    marketing: json.data.marketing ?? { email: false, sms: false },
    frequency: json.data.frequency ?? 'realtime',
  };
}

/**
 * Persist updated communication preferences.
 */
export async function updatePreferences(
  preferences: CommunicationSettings,
): Promise<void> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not authenticated — cannot save preferences.');
  }

  const res = await fetch(
    `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/client-portal/comm-prefs`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(preferences),
    },
  );
  const json = await res.json();

  if (!res.ok) {
    throw new Error(json.error || 'Failed to save communication preferences.');
  }
}
