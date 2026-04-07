// Domain Types
import type { BaseClient } from '../../../../shared/types';

export type CommunicationChannel = 'email' | 'whatsapp';
export type RecipientType = 'single' | 'multiple' | 'group';
export type GroupType = 'system' | 'custom';
export type SchedulingType = 'immediate' | 'scheduled';
export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually' | 'custom';
export type EndConditionType = 'never' | 'after_occurrences' | 'on_date';

// Client Types
// Extends BaseClient (§9.2). `surname` kept for backward compat with existing templates.
export interface Client extends BaseClient {
  surname: string;
  status?: string;
  category?: string;
  advisorId?: string;
  lastContacted?: Date;
  hasEmailOptIn: boolean;
  hasWhatsAppOptIn: boolean;
}

// Group Types
export interface GroupFilterConfig {
  productFilters?: {
    provider?: string;
    type?: string;
  }[];
  netWorthFilters?: {
    min?: number;
    max?: number;
  }[];
  ageFilters?: {
    min?: number;
    max?: number;
  }[];
  maritalStatusFilters?: string[];
  employmentStatusFilters?: string[];
  genderFilters?: string[];
  countryFilters?: string[];
  incomeFilters?: {
    min?: number;
    max?: number;
  }[];
  occupationFilters?: string[];
  dependantCountFilters?: {
    min?: number;
    max?: number;
  }[];
  retirementAgeFilters?: {
    min?: number;
    max?: number;
  }[];
  hasAssetsFilter?: boolean;
  hasLiabilitiesFilter?: boolean;
}

export interface ExternalContact {
  email: string;
  name?: string;
  source: string;
  subscribedAt: string;
}

export interface ClientGroup {
  id: string;
  name: string;
  description: string;
  color?: string;
  type: GroupType;
  clientIds: string[];
  externalContacts?: ExternalContact[];
  filterConfig?: GroupFilterConfig;
  clientCount: number;
  createdAt?: Date;
  updatedAt?: Date;
  criteria?: Record<string, unknown>;
}

// Template Types
export interface EmailTemplate {
  id: string;
  name: string;
  enabled: boolean;
  subject: string;
  title: string;
  subtitle: string;
  greeting: string;
  bodyHtml: string;
  buttonLabel: string;
  buttonUrl: string;
  footerNote: string;
  category?: string;
  createdAt?: string;
  isSystem?: boolean; // Merged from simpler type
}

export interface EmailFooterSettings {
  companyName: string;
  address: string;
  contactEmail: string;
  contactPhone: string;
  socialLinks: {
    linkedin?: string;
    instagram?: string;
    youtube?: string;
    facebook?: string;
    twitter?: string;
  };
  copyrightText: string;
}

// File/Attachment Types
export interface AttachmentFile {
  id: string;
  name: string;
  path: string;
  size: number;
  type: string;
  url?: string;
}

// Scheduling Types
export interface SchedulingConfig {
  type: SchedulingType;
  startDate?: Date;
  time?: string;
  isRecurring?: boolean;
  recurringFrequency?: RecurringFrequency;
  customInterval?: number;
  endCondition?: EndConditionType;
  endOccurrences?: number;
  endDate?: Date;
}

// Draft/Campaign Types
export interface CommunicationDraft {
  id?: string;
  step: number;
  channel: CommunicationChannel;
  recipientType: RecipientType;
  selectedRecipients: Client[];
  selectedGroup?: ClientGroup;
  subject: string;
  title?: string;
  bodyHtml: string;
  attachments: AttachmentFile[];
  scheduling: SchedulingConfig;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CommunicationPayload {
  channel: CommunicationChannel;
  recipient_ids: string[];
  group_id?: string;
  subject?: string;
  title?: string;
  body_html?: string;
  attachments: AttachmentFile[];
  scheduling: SchedulingConfig;
}

export interface CommunicationCampaign {
  id: string;
  name: string;
  subject: string;
  status: string;
  sentAt?: string;
  stats?: {
    sent: number;
    opened: number;
    clicked: number;
  };
}

export interface BackendCampaign {
  id: string;
  subject: string;
  bodyHtml: string;
  channel: CommunicationChannel;
  recipientType: RecipientType;
  selectedRecipients: Array<{ id: string; email?: string; name?: string; [key: string]: unknown }>;
  selectedGroup?: { id: string; name: string; type?: string; clientCount?: number; [key: string]: unknown };
  status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'failed';
  attachments?: Array<{ id: string; name: string; path: string; type: string; size: number }>;
  stats?: { sent: number; failed: number; total: number };
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  createdByName?: string;
}

// Log/History Types
export interface CommunicationLog {
  id: string;
  subject: string;
  category: string;
  created_at: string;
  read: boolean;
  sender_name?: string;
  body?: string;
  content?: string;
  sent_via_email: boolean;
  attachments?: AttachmentFile[];
}

/** Paginated communication history from GET /communication/campaigns */
export interface CampaignHistorySenderOption {
  userId: string;
  label: string;
}

export interface CampaignHistoryPageResult {
  entries: ActivityLogEntry[];
  total: number;
  page: number;
  limit: number;
  senderOptions: CampaignHistorySenderOption[];
}

export interface ActivityLogEntry {
  id: string;
  timestamp: Date;
  userId: string;
  userName: string;
  channel: CommunicationChannel;
  recipientType: RecipientType;
  recipientCount: number;
  /** Group name when recipientType is `group` (from campaign.selectedGroup). */
  groupName?: string;
  subject?: string;
  messagePreview: string;
  /** Longer plain-text body preview for detail panel. */
  messagePreviewFull?: string;
  attachmentCount: number;
  templateUsed?: string;
  status: 'sent' | 'scheduled' | 'draft' | 'failed' | 'completed' | 'sending';
}

export interface CommunicationMessage {
  id: string;
  subject: string;
  content: string;
  from: string;
  receivedAt: string;
  isRead: boolean;
}

// Request/Response Types
export interface MessageCreate {
  recipients: string[];
  subject: string;
  content: string;
  category?: string;
  priority?: string;
  senderName?: string;
  sendEmail?: boolean;
  recipientEmail?: string;
  attachments?: AttachmentFile[];
  cc?: string[];
}

export interface SendMessageResponse {
  success: boolean;
  messageId: string;
}

export interface SendCampaignResponse {
  success: boolean;
  sent: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  eligibleRecipients: Client[];
  ineligibleRecipients: Array<{ client: Client; reason: string }>;
}