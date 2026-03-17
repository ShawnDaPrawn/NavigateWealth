import { z } from "npm:zod";

// --- Send Message Schema ---

export const SendMessageSchema = z.object({
  channel: z.enum(['email', 'whatsapp', 'sms']).optional().default('email'),
  subject: z.string().min(1, "Subject is required").max(500),
  content: z.string().min(1, "Content is required"),
  recipients: z.array(z.string().min(1)).min(1, "At least one recipient is required"),
  category: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional().default('normal'),
  senderName: z.string().optional(),
  sendEmail: z.boolean().optional().default(false),
  recipientEmail: z.string().optional(),
  attachments: z.array(z.any()).optional().default([]),
  cc: z.array(z.string()).optional(),
}).passthrough();

// --- Group Schemas ---

export const GroupFilterConfigSchema = z.object({
  productFilters: z.array(z.object({
    provider: z.string().optional(),
    type: z.string().optional(),
  })).optional(),
  netWorthFilters: z.array(z.object({
    min: z.number().optional(),
    max: z.number().optional(),
  })).optional(),
  ageFilters: z.array(z.object({
    min: z.number().optional(),
    max: z.number().optional(),
  })).optional(),
  incomeFilters: z.array(z.object({
    min: z.number().optional(),
    max: z.number().optional(),
  })).optional(),
  dependantCountFilters: z.array(z.object({
    min: z.number().optional(),
    max: z.number().optional(),
  })).optional(),
  retirementAgeFilters: z.array(z.object({
    min: z.number().optional(),
    max: z.number().optional(),
  })).optional(),
  maritalStatusFilters: z.array(z.string()).optional(),
  employmentStatusFilters: z.array(z.string()).optional(),
  genderFilters: z.array(z.string()).optional(),
  countryFilters: z.array(z.string()).optional(),
  occupationFilters: z.array(z.string()).optional(),
  hasAssetsFilter: z.boolean().optional(),
  hasLiabilitiesFilter: z.boolean().optional(),
}).passthrough();

export const CreateGroupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().default(''),
  color: z.string().optional().default('#6d28d9'),
  clientIds: z.array(z.string()).optional().default([]),
  externalContacts: z.array(z.object({
    email: z.string().email(),
    name: z.string().optional(),
    source: z.string().optional().default('manual'),
    subscribedAt: z.string().optional(),
  })).optional().default([]),
  filterConfig: GroupFilterConfigSchema.optional(),
}).passthrough();

export const UpdateGroupSchema = CreateGroupSchema.partial();

// --- Template Schemas ---

export const CreateTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required").max(200),
  subject: z.string().max(500).optional().default(''),
  bodyHtml: z.string().min(1, "Template body is required"),
  category: z.string().max(100).optional(),
  description: z.string().max(1000).optional(),
});

export const UpdateTemplateSchema = CreateTemplateSchema.partial();

// --- Email Footer Schema ---

export const EmailFooterSettingsSchema = z.object({
  companyName: z.string().max(200).optional(),
  address: z.string().max(500).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email().optional().or(z.literal('')),
  website: z.string().max(200).optional(),
  disclaimer: z.string().max(2000).optional(),
  logoUrl: z.string().max(500).optional(),
  enabled: z.boolean().optional(),
}).passthrough(); // Allow additional custom fields

// --- Campaign Schemas ---

export const AttachmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  bucket: z.string(),
  type: z.string(),
  size: z.number(),
});

export const CreateCampaignSchema = z.object({
  id: z.string().optional(),
  subject: z.string().min(1, "Subject is required"),
  bodyHtml: z.string().min(1, "Body is required"),
  channel: z.enum(['email', 'whatsapp']).optional().default('email'),
  recipientType: z.enum(['single', 'multiple', 'group']),
  selectedRecipients: z.array(z.object({
    id: z.string(),
    email: z.string().optional(),
    name: z.string().optional(),
  }).passthrough()).default([]),
  selectedGroup: z.object({
    id: z.string(),
    name: z.string().optional(),
    type: z.string().optional(),
    clientCount: z.number().optional(),
  }).passthrough().optional().nullable(),
  status: z.enum(['draft', 'scheduled', 'sending', 'completed', 'failed']).optional().default('draft'),
  attachments: z.array(AttachmentSchema).optional().default([]),
  scheduling: z.object({
    type: z.enum(['immediate', 'scheduled']),
    startDate: z.string().optional(),
  }).default({ type: 'immediate' }),
  createdAt: z.string().optional(),
}).passthrough();