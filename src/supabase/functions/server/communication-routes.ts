/**
 * Communication Module - Routes
 *
 * Comprehensive communication system:
 * - Send individual messages
 * - Group management
 * - Campaign creation and scheduling
 * - Inbox and message history
 * - Email templates
 */

import { Hono } from 'npm:hono';
import { requireAuth, requireAdmin } from './auth-mw.ts';
import { asyncHandler } from './error.middleware.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { CommunicationService } from './communication-service.ts';
import { AdminAuditService } from './admin-audit-service.ts';
import {
  SendMessageSchema,
  CreateGroupSchema,
  UpdateGroupSchema,
  CreateTemplateSchema,
  UpdateTemplateSchema,
  EmailFooterSettingsSchema,
  CreateCampaignSchema,
  UnsubscribeRequestSchema,
  ResubscribeRequestSchema,
} from './communication-validation.ts';
import { formatZodError } from './shared-validation-utils.ts';
import type {
  MessageCreate,
  MessageCategory,
  Group,
  GroupCreate,
  CampaignCreate,
  CampaignStatus,
  CommunicationChannel,
  HistoryFilters,
} from './communication-types.ts';

/** Accepted values for the history view's `?channel=` filter. */
const CAMPAIGN_CHANNELS: CommunicationChannel[] = ['email', 'whatsapp', 'portal'];

/** Accepted values for the history view's `?status=` filter. */
const CAMPAIGN_STATUSES: CampaignStatus[] = [
  'draft',
  'scheduled',
  'sending',
  'completed',
  'partial',
  'failed',
  'rejected',
];

const app = new Hono();
const log = createModuleLogger('communication');
const service = new CommunicationService();

// ============================================================================
// MESSAGE SENDING
// ============================================================================

/**
 * POST /communication/send
 * Send individual message
 */
app.post(
  '/send',
  requireAdmin,
  asyncHandler(async (c) => {
    const adminUserId = c.get('userId') as string;
    const body = await c.req.json();
    const parsed = SendMessageSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }

    log.info('Admin: Sending message', { adminUserId });

    // sendDirectMessage, not sendMessage: it additionally files the campaign-
    // shaped history row that makes this individual send visible in the
    // Communication Centre's History view.
    const result = await service.sendDirectMessage(adminUserId, parsed.data as MessageCreate);

    log.success('Message send completed', {
      adminUserId,
      recipients: parsed.data.recipients?.length,
      status: result.status,
    });

    // Audit trail (non-blocking — §12.2)
    AdminAuditService.record({
      actorId: adminUserId,
      actorRole: (c.get('userRole') as string | undefined) || 'admin',
      category: 'communication',
      action: 'message_sent',
      summary:
        `Message sent to ${parsed.data.recipients?.length || 0} recipient(s) — ${result.status}` +
        (result.cc.length > 0 ? ` (cc: ${result.cc.length})` : ''),
      // A send nobody received is not an 'info' event in the audit trail.
      severity: result.status === 'completed' ? 'info' : 'warning',
      entityType: 'communication',
      entityId: result.messageId,
      metadata: {
        recipientCount: parsed.data.recipients?.length,
        status: result.status,
        stats: result.stats,
        ccCount: result.cc.length,
      },
    }).catch(() => {});

    return c.json(result);
  }),
);

/**
 * POST /communication/upload
 * Upload file attachment
 */
app.post(
  '/upload',
  requireAdmin,
  asyncHandler(async (c) => {
    const adminUserId = c.get('userId') as string;
    const formData = await c.req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return c.json({ error: 'No file provided' }, 400);
    }

    log.info('Admin: Uploading file', { adminUserId, fileName: file.name });

    const result = await service.uploadFile(file);

    return c.json(result);
  }),
);

/**
 * GET /communication/history
 * Get communication history (admin)
 */
app.get(
  '/history',
  requireAdmin,
  asyncHandler(async (c) => {
    const filters = {
      startDate: c.req.query('startDate'),
      endDate: c.req.query('endDate'),
      category: c.req.query('category'),
      recipientId: c.req.query('recipientId'),
    };

    const history = await service.getHistory({
      ...filters,
      category: filters.category as MessageCategory | undefined,
    } as HistoryFilters);

    return c.json({ history });
  }),
);

// ============================================================================
// USER INBOX
// ============================================================================

/**
 * GET /communication/inbox
 * Get user's inbox messages
 */
app.get(
  '/inbox',
  requireAuth,
  asyncHandler(async (c) => {
    const userId = c.get('userId') as string;

    log.info('Fetching inbox', { userId });

    const messages = await service.getInbox(userId);

    return c.json({ messages });
  }),
);

/**
 * POST /communication/read/:id
 * Mark message as read
 */
app.post(
  '/read/:id',
  requireAuth,
  asyncHandler(async (c) => {
    const userId = c.get('userId') as string;
    const messageId = c.req.param('id')!;

    await service.markAsRead(userId, messageId);

    return c.json({ success: true });
  }),
);

/**
 * DELETE /communication/inbox/:id
 * Delete message from inbox
 */
app.delete(
  '/inbox/:id',
  requireAuth,
  asyncHandler(async (c) => {
    const userId = c.get('userId') as string;
    const messageId = c.req.param('id')!;

    await service.deleteMessage(userId, messageId);

    return c.json({ success: true });
  }),
);

// ============================================================================
// GROUPS
// ============================================================================

/**
 * GET /communication/clients
 * Get all clients for recipient selection
 */
app.get(
  '/clients',
  requireAdmin,
  asyncHandler(async (c) => {
    log.info('Fetching clients for communication');

    const clients = await service.getAllClients();

    return c.json(clients);
  }),
);

/**
 * GET /communication/groups
 * Get all groups
 */
app.get(
  '/groups',
  requireAdmin,
  asyncHandler(async (c) => {
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '100');

    const groups = await service.getAllGroups();

    return c.json({ data: groups, total: groups.length, page, limit });
  }),
);

/**
 * POST /communication/groups
 * Create new group
 */
app.post(
  '/groups',
  requireAdmin,
  asyncHandler(async (c) => {
    const adminUserId = c.get('userId') as string;
    const body = await c.req.json();
    const parsed = CreateGroupSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }

    log.info('Admin: Creating group', { adminUserId, groupName: parsed.data.name });

    const group = await service.createGroup(parsed.data as GroupCreate);

    log.success('Group created', { adminUserId, groupId: group.id });

    AdminAuditService.record({
      actorId: adminUserId,
      actorRole: (c.get('userRole') as string | undefined) || 'admin',
      category: 'communication',
      action: 'group_created',
      summary: `Communication group created: ${parsed.data.name}`,
      severity: 'info',
      entityType: 'group',
      entityId: group.id,
    }).catch(() => {});

    return c.json({ group });
  }),
);

/**
 * PUT /communication/groups/:id
 * Update group
 */
app.put(
  '/groups/:id',
  requireAdmin,
  asyncHandler(async (c) => {
    const adminUserId = c.get('userId') as string;
    const groupId = c.req.param('id')!;
    const body = await c.req.json();
    const parsed = UpdateGroupSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }

    log.info('Admin: Updating group', { adminUserId, groupId });

    const group = await service.updateGroup(groupId, parsed.data as Partial<Group>);

    AdminAuditService.record({
      actorId: adminUserId,
      actorRole: (c.get('userRole') as string | undefined) || 'admin',
      category: 'communication',
      action: 'group_updated',
      summary: `Communication group updated`,
      severity: 'info',
      entityType: 'group',
      entityId: groupId,
    }).catch(() => {});

    return c.json({ group });
  }),
);

/**
 * DELETE /communication/groups/:id
 * Delete group
 */
app.delete(
  '/groups/:id',
  requireAdmin,
  asyncHandler(async (c) => {
    const adminUserId = c.get('userId') as string;
    const groupId = c.req.param('id')!;

    log.warn('Admin: Deleting group', { adminUserId, groupId });

    await service.deleteGroup(groupId);

    AdminAuditService.record({
      actorId: adminUserId,
      actorRole: (c.get('userRole') as string | undefined) || 'admin',
      category: 'communication',
      action: 'group_deleted',
      summary: `Communication group deleted`,
      severity: 'warning',
      entityType: 'group',
      entityId: groupId,
    }).catch(() => {});

    return c.json({ success: true });
  }),
);

// ============================================================================
// GROUP MEMBERSHIP RECALCULATION
// ============================================================================

/**
 * POST /communication/groups/recalculate
 * Manually trigger group membership recalculation
 */
app.post(
  '/groups/recalculate',
  requireAdmin,
  asyncHandler(async (c) => {
    const adminUserId = c.get('userId') as string;

    log.info('Admin: Manually triggering group recalculation', { adminUserId });

    const { fetchMatcherClients, recalculateAllGroupMemberships } =
      await import('./communication-repo.ts');
    const { syncAutoProviderGroups } = await import('./provider-group-service.ts');

    // Reuse a single client fetch for both the provider-group sync and the
    // full membership recalculation.
    const matcherClients = await fetchMatcherClients();
    const providerSync = await syncAutoProviderGroups(matcherClients);
    await recalculateAllGroupMemberships(matcherClients);

    log.success('Group recalculation complete', { adminUserId, providerSync });

    return c.json({
      success: true,
      message: 'Group memberships recalculated successfully',
      providerGroups: providerSync,
    });
  }),
);

/**
 * GET /communication/groups/debug
 * Debug endpoint to inspect group and client data
 */
app.get(
  '/groups/debug',
  requireAdmin,
  asyncHandler(async (c) => {
    const { getAllGroups, fetchMatcherClients } = await import('./communication-repo.ts');

    const allGroups = await getAllGroups();
    const matcherClients = await fetchMatcherClients();

    return c.json({
      groups: allGroups.map((g) => ({
        id: g.id,
        name: g.name,
        filterConfig: g.filterConfig,
        clientIds: g.clientIds,
        clientCount: g.clientCount,
        updatedAt: g.updatedAt,
      })),
      clients: matcherClients.map((c) => ({
        id: c.id,
        gender: c.gender,
        country: c.country,
        maritalStatus: c.maritalStatus,
        employmentStatus: c.employmentStatus,
        occupation: c.occupation,
        age: c.age,
        income: c.income,
        netWorth: c.netWorth,
        dependants: c.dependants,
        retirementAge: c.retirementAge,
        products: c.products,
      })),
      summary: {
        groupCount: allGroups.length,
        clientCount: matcherClients.length,
        clientsWithProducts: matcherClients.filter((c) => c.products && c.products.length > 0)
          .length,
        groupsWithFilters: allGroups.filter(
          (g) => g.filterConfig && Object.keys(g.filterConfig).length > 0,
        ).length,
      },
    });
  }),
);

// ============================================================================
// TEMPLATES
// ============================================================================

/**
 * GET /communication/templates
 * Get all email templates
 */
app.get(
  '/templates',
  requireAdmin,
  asyncHandler(async (c) => {
    const templates = await service.getAllTemplates();

    return c.json({ templates });
  }),
);

/**
 * POST /communication/templates
 * Create new template
 */
app.post(
  '/templates',
  requireAdmin,
  asyncHandler(async (c) => {
    const adminUserId = c.get('userId') as string;
    const body = await c.req.json();
    const parsed = CreateTemplateSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }

    log.info('Admin: Creating template', { adminUserId, templateName: parsed.data.name });

    const template = await service.createTemplate(parsed.data);

    log.success('Template created', { adminUserId, templateId: template.id });

    AdminAuditService.record({
      actorId: adminUserId,
      actorRole: (c.get('userRole') as string | undefined) || 'admin',
      category: 'communication',
      action: 'template_created',
      summary: `Email template created: ${parsed.data.name}`,
      severity: 'info',
      entityType: 'template',
      entityId: template.id,
    }).catch(() => {});

    return c.json({ template });
  }),
);

/**
 * GET /communication/templates/:id
 * Get template by ID
 */
app.get(
  '/templates/:id',
  requireAdmin,
  asyncHandler(async (c) => {
    const templateId = c.req.param('id')!;
    const template = await service.getTemplateById(templateId);

    if (!template) {
      return c.json({ error: 'Template not found' }, 404);
    }

    return c.json({ template });
  }),
);

/**
 * PUT /communication/templates/:id
 * Update template
 */
app.put(
  '/templates/:id',
  requireAdmin,
  asyncHandler(async (c) => {
    const adminUserId = c.get('userId') as string;
    const templateId = c.req.param('id')!;
    const body = await c.req.json();
    const parsed = UpdateTemplateSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }

    log.info('Admin: Updating template', { adminUserId, templateId });

    const template = await service.updateTemplate(templateId, parsed.data);

    AdminAuditService.record({
      actorId: adminUserId,
      actorRole: (c.get('userRole') as string | undefined) || 'admin',
      category: 'communication',
      action: 'template_updated',
      summary: `Email template updated`,
      severity: 'info',
      entityType: 'template',
      entityId: templateId,
    }).catch(() => {});

    return c.json({ template });
  }),
);

/**
 * DELETE /communication/templates/:id
 * Delete template
 */
app.delete(
  '/templates/:id',
  requireAdmin,
  asyncHandler(async (c) => {
    const adminUserId = c.get('userId') as string;
    const templateId = c.req.param('id')!;

    log.warn('Admin: Deleting template', { adminUserId, templateId });

    await service.deleteTemplate(templateId);

    AdminAuditService.record({
      actorId: adminUserId,
      actorRole: (c.get('userRole') as string | undefined) || 'admin',
      category: 'communication',
      action: 'template_deleted',
      summary: `Email template deleted`,
      severity: 'warning',
      entityType: 'template',
      entityId: templateId,
    }).catch(() => {});

    return c.json({ success: true });
  }),
);

// ============================================================================
// EMAIL FOOTER SETTINGS
// ============================================================================

/**
 * GET /communication/email-footer
 * Get global email footer settings
 */
app.get(
  '/email-footer',
  requireAdmin,
  asyncHandler(async (c) => {
    const settings = await service.getFooterSettings();

    return c.json(settings);
  }),
);

/**
 * POST /communication/email-footer
 * Save global email footer settings
 */
app.post(
  '/email-footer',
  requireAdmin,
  asyncHandler(async (c) => {
    const adminUserId = c.get('userId') as string;
    const body = await c.req.json();
    const parsed = EmailFooterSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }

    log.info('Admin: Saving email footer settings', { adminUserId });

    await service.saveFooterSettings(parsed.data);

    log.success('Email footer settings saved', { adminUserId });

    AdminAuditService.record({
      actorId: adminUserId,
      actorRole: (c.get('userRole') as string | undefined) || 'admin',
      category: 'configuration',
      action: 'email_footer_updated',
      summary: 'Email footer settings updated',
      severity: 'info',
      entityType: 'configuration',
    }).catch(() => {});

    return c.json({ success: true });
  }),
);

// ============================================================================
// CAMPAIGNS
// ============================================================================

/**
 * GET /communication/campaigns
 * - Default: paginated + optional filters (search, channel, recipientType, createdBy) + senderOptions.
 * - ?all=1 — full list (use sparingly; for exports / legacy callers).
 */
app.get(
  '/campaigns',
  requireAdmin,
  asyncHandler(async (c) => {
    if (c.req.query('all') === '1') {
      const result = await service.listAllCampaignsWithCreatorNames();
      return c.json(result);
    }

    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10) || 1);
    const limitParsed = parseInt(c.req.query('limit') || '50', 10);
    const limit = Math.min(100, Math.max(1, Number.isFinite(limitParsed) ? limitParsed : 50));

    const search = c.req.query('search')?.trim() || undefined;
    const channelRaw = c.req.query('channel')?.trim();
    const channel = CAMPAIGN_CHANNELS.includes(channelRaw as CommunicationChannel)
      ? (channelRaw as CommunicationChannel)
      : undefined;
    const rtRaw = c.req.query('recipientType')?.trim();
    const recipientType =
      rtRaw === 'single' || rtRaw === 'multiple' || rtRaw === 'group' ? rtRaw : undefined;
    const createdBy = c.req.query('createdBy')?.trim() || undefined;
    const statusRaw = c.req.query('status')?.trim();
    const status = CAMPAIGN_STATUSES.includes(statusRaw as CampaignStatus)
      ? (statusRaw as CampaignStatus)
      : undefined;
    const originRaw = c.req.query('origin')?.trim();
    const origin = originRaw === 'direct' || originRaw === 'campaign' ? originRaw : undefined;

    const result = await service.listCampaignsFiltered({
      page,
      limit,
      search,
      channel,
      recipientType,
      createdBy,
      status,
      origin,
    });

    return c.json(result);
  }),
);

/**
 * POST /communication/campaigns
 * Create new campaign
 */
app.post(
  '/campaigns',
  requireAdmin,
  asyncHandler(async (c) => {
    const adminUserId = c.get('userId') as string;
    const body = await c.req.json();
    const parsed = CreateCampaignSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }

    log.info('Admin: Creating campaign', { adminUserId });

    const campaign = await service.createCampaign(adminUserId, parsed.data as CampaignCreate);

    log.success('Campaign created', { adminUserId, campaignId: campaign.id });

    AdminAuditService.record({
      actorId: adminUserId,
      actorRole: (c.get('userRole') as string | undefined) || 'admin',
      category: 'communication',
      action: 'campaign_created',
      summary: `Campaign created`,
      severity: 'info',
      entityType: 'campaign',
      entityId: campaign.id,
    }).catch(() => {});

    return c.json({ campaign });
  }),
);

/**
 * POST /communication/campaigns/:id/send
 * Send campaign immediately
 */
app.post(
  '/campaigns/:id/send',
  requireAdmin,
  asyncHandler(async (c) => {
    const adminUserId = c.get('userId') as string;
    const campaignId = c.req.param('id')!;

    log.info('Admin: Sending campaign', { adminUserId, campaignId });

    const result = await service.sendCampaign(campaignId, adminUserId);

    log.success('Campaign sent', { adminUserId, campaignId });

    AdminAuditService.record({
      actorId: adminUserId,
      actorRole: (c.get('userRole') as string | undefined) || 'admin',
      category: 'communication',
      action: 'campaign_sent',
      summary: `Campaign sent`,
      severity: 'warning',
      entityType: 'campaign',
      entityId: campaignId,
    }).catch(() => {});

    return c.json(result);
  }),
);

// ============================================================================
// COMMUNICATION LOGS (Admin)
// ============================================================================

/**
 * DELETE /communication/logs/:id
 * Delete communication log (admin only)
 * Removes the communication from all recipients and history
 */
app.delete(
  '/logs/:id',
  requireAdmin,
  asyncHandler(async (c) => {
    const adminUserId = c.get('userId') as string;
    const messageId = c.req.param('id')!;

    log.warn('Admin: Deleting communication log', { adminUserId, messageId });

    await service.deleteCommunicationLog(messageId);

    AdminAuditService.record({
      actorId: adminUserId,
      actorRole: (c.get('userRole') as string | undefined) || 'admin',
      category: 'communication',
      action: 'communication_log_deleted',
      summary: `Communication log entry deleted`,
      severity: 'warning',
      entityType: 'communication',
      entityId: messageId,
    }).catch(() => {});

    return c.json({ success: true });
  }),
);

// ============================================================================
// UNSUBSCRIBES
// ============================================================================

/**
 * GET /communication/unsubscribed
 * List contacts manually unsubscribed from communication campaigns
 */
app.get(
  '/unsubscribed',
  requireAdmin,
  asyncHandler(async (c) => {
    const contacts = await service.listUnsubscribed();
    return c.json({ contacts });
  }),
);

/**
 * POST /communication/unsubscribe
 * Manually unsubscribe a contact from communication campaigns
 */
app.post(
  '/unsubscribe',
  requireAdmin,
  asyncHandler(async (c) => {
    const adminUserId = c.get('userId') as string;
    const body = await c.req.json();
    const parsed = UnsubscribeRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }

    const result = await service.unsubscribeContact({
      email: parsed.data.email,
      clientId: parsed.data.clientId,
      name: parsed.data.name,
      adminUserId,
    });

    AdminAuditService.record({
      actorId: adminUserId,
      actorRole: (c.get('userRole') as string | undefined) || 'admin',
      category: 'communication',
      action: 'contact_unsubscribed',
      summary: result.alreadyUnsubscribed
        ? 'Communication unsubscribe already in place'
        : 'Contact unsubscribed from communication',
      severity: 'warning',
      entityType: 'communication_unsubscribe',
      entityId: parsed.data.clientId,
    }).catch(() => {});

    return c.json({
      success: true,
      alreadyUnsubscribed: result.alreadyUnsubscribed,
      contact: result.contact,
    });
  }),
);

/**
 * POST /communication/resubscribe
 * Restore a previously unsubscribed contact to the campaign audience
 */
app.post(
  '/resubscribe',
  requireAdmin,
  asyncHandler(async (c) => {
    const adminUserId = c.get('userId') as string;
    const body = await c.req.json();
    const parsed = ResubscribeRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }

    const result = await service.resubscribeContact({
      email: parsed.data.email,
      clientId: parsed.data.clientId,
      adminUserId,
    });

    AdminAuditService.record({
      actorId: adminUserId,
      actorRole: (c.get('userRole') as string | undefined) || 'admin',
      category: 'communication',
      action: 'contact_resubscribed',
      summary: 'Contact re-subscribed to communication',
      severity: 'info',
      entityType: 'communication_unsubscribe',
      entityId: parsed.data.clientId,
    }).catch(() => {});

    return c.json({ success: true, alreadySubscribed: result.alreadySubscribed });
  }),
);

export default app;
