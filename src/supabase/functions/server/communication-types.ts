/**
 * Communication Module - Unified Type Definitions
 * 
 * Consolidated from:
 * - campaign-types.ts (advanced campaign & group types)
 * - types.ts (message & template types)
 */

// ============================================================================
// GROUP TYPES
// ============================================================================

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

/**
 * External contact — a non-client subscriber (e.g. newsletter sign-up).
 * These exist only inside groups that support external members.
 */
export interface ExternalContact {
  email: string;
  name?: string;
  source: string;        // e.g. 'newsletter', 'contact_form'
  subscribedAt: string;  // ISO timestamp
}

export interface Group {
  id: string;
  name: string;
  description: string;
  color?: string;
  type: 'system' | 'custom';
  clientIds: string[]; // Manual members (existing clients)
  externalContacts?: ExternalContact[]; // Non-client members (newsletter subscribers etc.)
  filterConfig?: GroupFilterConfig; // Dynamic rules
  clientCount: number; // Total calculated count (clients + external)
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface GroupCreate {
  name: string;
  description?: string;
  color?: string;
  type?: 'system' | 'custom';
  clientIds?: string[];
  externalContacts?: ExternalContact[];
  filterConfig?: GroupFilterConfig;
  createdBy?: string;
}

// ============================================================================
// CAMPAIGN TYPES
// ============================================================================

export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'completed' | 'failed';

export interface Campaign {
  id: string;
  subject: string;
  bodyHtml: string;
  channel: 'email' | 'whatsapp';
  recipientType: 'single' | 'multiple' | 'group';
  selectedRecipients: { id: string; email?: string; [key: string]: unknown }[];
  selectedGroup?: { id: string; type: string; [key: string]: unknown };
  status: CampaignStatus;
  attachments?: {
    id: string;
    name: string;
    path: string;
    bucket: string;
    type: string;
    size: number;
  }[];
  scheduling: {
    type: 'immediate' | 'scheduled';
    startDate?: string;
  };
  stats?: {
    sent: number;
    failed: number;
    total: number;
  };
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  /** Resolved at list time for admin UI (not persisted in KV). */
  createdByName?: string;
}

export interface CampaignCreate {
  id?: string;
  subject: string;
  bodyHtml: string;
  channel?: 'email' | 'whatsapp';
  recipientType: 'single' | 'multiple' | 'group';
  selectedRecipients?: { id: string; email?: string; name?: string; [key: string]: unknown }[];
  selectedGroup?: { id: string; name?: string; type?: string; clientCount?: number; [key: string]: unknown };
  scheduling?: {
    type: 'immediate' | 'scheduled';
    startDate?: string;
  };
  createdBy?: string;
}

export interface CachedRecipient {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

// ============================================================================
// MESSAGE TYPES
// ============================================================================

export type MessagePriority = 'low' | 'normal' | 'high' | 'urgent';

export type MessageCategory = 
  | 'General'
  | 'Account'
  | 'Document'
  | 'Compliance'
  | 'Marketing'
  | 'Campaign'
  | 'System';

export interface Message {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  recipient_id: string;
  subject: string;
  content: string;
  category: MessageCategory;
  priority: MessagePriority;
  created_at: string;
  read: boolean;
}

export interface MessageCreate {
  recipients: string[];
  subject: string;
  content: string;
  category?: MessageCategory;
  priority?: MessagePriority;
  senderName?: string;
  sendEmail?: boolean;
  recipientEmail?: string;
  /** Optional recipient name info for merge field resolution */
  recipientFirstName?: string;
  recipientLastName?: string;
  recipientPhone?: string;
  attachments?: Array<{ name: string; content?: string; url?: string; type?: string; [key: string]: unknown }>;
}

// ============================================================================
// TEMPLATE TYPES
// ============================================================================

export interface Template {
  id: string;
  name: string;
  enabled?: boolean;
  subject: string;
  title?: string;
  subtitle?: string;
  greeting?: string;
  content: string; // bodyHtml
  buttonLabel?: string;
  buttonUrl?: string;
  footerNote?: string;
  category?: string;
  createdAt: string;
}

// ============================================================================
// FILTER TYPES
// ============================================================================

export interface HistoryFilters {
  startDate?: string;
  endDate?: string;
  category?: MessageCategory;
  recipientId?: string;
}

// ============================================================================
// COMMUNICATION CLIENT (resolved from Auth + KV)
// ============================================================================

export interface CommunicationClient {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  dateOfBirth?: string;
  netWorth: number;
  products: Array<{ provider?: string; type?: string }>;
  status: string;
  category: string;
  maritalStatus?: string;
  employmentStatus?: string;
  hasEmailOptIn: boolean;
  hasWhatsAppOptIn: boolean;
  metadata: Record<string, unknown>;
  profile: Record<string, unknown>;
}

// Supabase admin client type (minimal shape for communication functions)
export interface SupabaseAdminClient {
  auth: {
    admin: {
      listUsers: () => Promise<{ data: { users: Array<{ id: string; email: string; phone?: string; user_metadata?: Record<string, unknown> }> }; error: unknown }>;
    };
  };
  storage: {
    listBuckets: () => Promise<{ data: Array<{ name: string }> | null }>;
    from: (bucket: string) => {
      download: (path: string) => Promise<{ data: Blob | null; error: unknown }>;
    };
    createBucket: (name: string, options?: Record<string, unknown>) => Promise<unknown>;
  };
}

// Recipient selection config (used by resolveRecipients)
export interface RecipientSelection {
  recipientType: 'single' | 'multiple' | 'group';
  selectedRecipients: Array<{ id: string; [key: string]: unknown }>;
  selectedGroup?: { id: string; type: string; [key: string]: unknown };
}

// Attachment reference (for processAttachments)
export interface AttachmentRef {
  bucket: string;
  path: string;
  name: string;
  type?: string;
}