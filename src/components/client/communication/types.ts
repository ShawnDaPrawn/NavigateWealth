/**
 * Client Communication Module — Types
 *
 * Single source of truth for all client-facing communication types.
 * Guidelines refs: §4.1, §5.2, §9.2, §19.3
 *
 * NOTE on BaseClient (§19.3):
 * The `Communication` type is a *message* entity, not a *client* entity,
 * so it does NOT extend BaseClient. If a client-facing recipient type is
 * introduced in this module (e.g. for recipient display or message
 * composition), it MUST extend BaseClient from `/shared/types/client.ts`.
 */

// ── Inbox Types ─────────────────────────────────────────────────────────────

export type CommunicationCategory =
  | 'General'
  | 'Policy Update'
  | 'Document Required'
  | 'Appointment'
  | 'Important'
  | 'FNA Available';

export type CommunicationPriority = 'normal' | 'high' | 'urgent';
export type SenderRole = 'Adviser' | 'Administrator' | 'System';

export interface Communication {
  id: string;
  from: string;
  fromRole: SenderRole;
  subject: string;
  message: string;
  category: CommunicationCategory;
  timestamp: Date;
  read: boolean;
  priority: CommunicationPriority;
}

// ── Filter Types ────────────────────────────────────────────────────────────

export type DateRangeFilter = 'all' | 'week' | 'month';

export interface CommunicationFilters {
  search: string;
  category: string;        // 'all' | CommunicationCategory
  dateRange: DateRangeFilter;
}

// ── API Response Types ──────────────────────────────────────────────────────

export interface InboxMessageDTO {
  id: string;
  sender_name?: string;
  from?: string;
  sender_role?: string;
  fromRole?: string;
  subject: string;
  content?: string;
  message?: string;
  category?: string;
  created_at?: string;
  timestamp?: string;
  read?: boolean;
  priority?: string;
}

export interface InboxResponse {
  messages: InboxMessageDTO[];
}

// ── Preferences Types ───────────────────────────────────────────────────────

export type NotificationFrequency = 'realtime' | 'daily' | 'weekly';

export interface ChannelPreference {
  email: boolean;
  sms: boolean;
}

export interface CommunicationSettings {
  transactional: ChannelPreference;
  marketing: ChannelPreference;
  frequency: NotificationFrequency;
}

export interface PreferencesResponse {
  success: boolean;
  data?: CommunicationSettings;
  error?: string;
}