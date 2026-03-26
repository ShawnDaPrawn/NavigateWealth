/**
 * Communication Module - Service Layer
 * 
 * Consolidates communication functionality from:
 * - communication-service.ts (business logic)
 * - communication-repo.ts (data access)
 * - communication-validation.ts (validation)
 */

import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { ValidationError, NotFoundError } from './error.middleware.ts';
import { sendEmail, createEmailTemplate, DEFAULT_TEMPLATES } from './email-service.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';

// Import existing communication functionality
import * as repo from './communication-repo.ts';
import { processScheduledCampaigns as processScheduledCampaignsOld, resolveMergeFields } from './communication-business-logic.ts';
import type {
  Message,
  MessageCreate,
  Group,
  GroupCreate,
  Campaign,
  CampaignCreate,
  Template,
  HistoryFilters,
} from './communication-types.ts';

const log = createModuleLogger('communication-service');

// Helper to generate unique ID
function generateId(): string {
  return crypto.randomUUID();
}

function splitFullName(fullName?: string): { firstName: string; surname: string } {
  const value = (fullName || '').trim();
  if (!value) {
    return { firstName: '', surname: '' };
  }

  const [firstName, ...rest] = value.split(/\s+/);
  return {
    firstName: firstName || '',
    surname: rest.join(' ').trim(),
  };
}

export class CommunicationService {
  
  /**
   * Send individual message
   */
  async sendMessage(adminUserId: string, data: MessageCreate): Promise<{ success: boolean; messageId: string }> {
    log.info('Sending message', { adminUserId });
    
    // Validate
    if (!data.subject || !data.content) {
      throw new ValidationError('Subject and content are required');
    }
    
    if (!data.recipients || data.recipients.length === 0) {
      throw new ValidationError('At least one recipient is required');
    }

    // STORAGE OPTIMIZATION:
    // Process attachments: If they are base64, upload them to storage once and reuse the URL.
    // This prevents saving large base64 strings in KV for every recipient.
    let storedAttachments: StoredAttachment[] = [];
    if (data.attachments && data.attachments.length > 0) {
      try {
        const uploadPromises = data.attachments.map(async (att: StoredAttachment) => {
          // If it has content (base64) and NO url, we upload it
          if (att.content && !att.url) {
            try {
              // Parse Data URL
              const matches = att.content.match(/^data:(.+);base64,(.+)$/);
              if (matches) {
                const contentType = matches[1];
                const b64Data = matches[2];
                
                // Convert base64 to File
                const binaryStr = atob(b64Data);
                const bytes = new Uint8Array(binaryStr.length);
                for (let i = 0; i < binaryStr.length; i++) {
                  bytes[i] = binaryStr.charCodeAt(i);
                }
                const blob = new Blob([bytes], { type: contentType });
                const file = new File([blob], att.name, { type: contentType });
                
                // Upload
                const uploaded = await this.uploadFile(file);
                return uploaded; // Contains URL
              }
            } catch (err) {
              log.error(`Failed to optimize attachment ${att.name}`, err as Error);
            }
          }
          // Fallback: return original (or if it already has URL)
          return att;
        });
        
        storedAttachments = await Promise.all(uploadPromises);
      } catch (e) {
        log.error('Error processing attachments', e as Error);
        storedAttachments = data.attachments; // Fallback to original
      }
    }
    
    const messageId = generateId();
    const timestamp = new Date().toISOString();
    
    // Send to each recipient
    for (const recipientId of data.recipients) {
      try {
        // Store message in recipient's inbox
        const messageKey = `communication_log:${recipientId}:${messageId}`;
        
        // Detect if content contains merge field placeholders
        const hasMergePlaceholders = /\{\{(first_name|surname|full_name|email|phone)\}\}/.test(data.subject + data.content);
        
        // Resolve merge fields — use provided info, or look up from KV if placeholders detected
        let mergeRecipient = {
          firstName: data.recipientFirstName || '',
          lastName: data.recipientLastName || '',
          email: data.recipientEmail || '',
          phone: data.recipientPhone || '',
        };
        
        if (hasMergePlaceholders && !mergeRecipient.firstName && !mergeRecipient.lastName) {
          // Fallback: look up recipient profile from KV for merge field resolution
          try {
            const profile = await kv.get(`user_profile:${recipientId}:personal_info`);
            if (profile && typeof profile === 'object') {
              const pi = (profile as Record<string, unknown>).personalInformation as Record<string, unknown> || {};
              mergeRecipient = {
                firstName: (pi.firstName as string) || '',
                lastName: (pi.lastName as string) || (pi.surname as string) || '',
                email: data.recipientEmail || (profile as Record<string, unknown>).email as string || '',
                phone: (pi.cellphoneNumber as string) || '',
              };
            }
          } catch (kvErr) {
            log.warn('Failed to look up recipient profile for merge fields', { recipientId });
          }
        }
        
        const hasMergeData = mergeRecipient.firstName || mergeRecipient.lastName;
        const resolvedSubject = hasMergeData ? resolveMergeFields(data.subject, mergeRecipient) : data.subject;
        const resolvedContent = hasMergeData ? resolveMergeFields(data.content, mergeRecipient) : data.content;
        
        await kv.set(messageKey, {
          id: messageId,
          sender_id: adminUserId,
          sender_name: data.senderName || 'Navigate Wealth',
          sender_role: 'Admin',
          recipient_id: recipientId,
          subject: resolvedSubject,
          content: resolvedContent,
          category: data.category || 'General',
          priority: data.priority || 'normal',
          created_at: timestamp,
          read: false,
          sent_via_email: data.sendEmail && !!data.recipientEmail,
          attachments: storedAttachments // Use the optimized attachments (with URLs)
        });
        
        // Send email if requested and email address provided
        if (data.sendEmail && data.recipientEmail) {
          try {
            log.info('Sending email notification', { recipientEmail: data.recipientEmail });
            
            // Prepare attachments for SendGrid
            // For SendGrid, we need the CONTENT (base64)
            // If we successfully uploaded and replaced content with URL in storedAttachments,
            // we should still use the ORIGINAL data.attachments for the email sending.
            const emailAttachments = data.attachments?.map(att => ({
              content: att.content?.split(',')[1] || att.content, // Remove data URL prefix if present
              filename: att.name,
              type: att.type || 'application/octet-stream',
              disposition: 'attachment'
            }));
            
            await sendEmail({
              to: data.recipientEmail,
              subject: resolvedSubject,
              html: createEmailTemplate(resolvedContent, {
                title: resolvedSubject,
              }),
              text: resolvedContent.replace(/<[^>]*>/g, ''),
              attachments: emailAttachments
            });
            
            log.success('Email sent successfully', { recipientEmail: data.recipientEmail });
          } catch (emailError) {
            log.error('Failed to send email, but message was saved to portal', emailError as Error, { recipientEmail: data.recipientEmail });
            // Don't throw - we still want to save to portal even if email fails
          }
        }
        
        log.success('Message delivered', { recipientId });
      } catch (error) {
        log.error('Failed to deliver message', error as Error, { recipientId });
      }
    }
    
    // Log to history
    await kv.set(`communication_history:${messageId}`, {
      id: messageId,
      sender_id: adminUserId,
      subject: data.subject,
      content: data.content,
      recipients: data.recipients,
      category: data.category,
      sent_at: timestamp,
      sent_via_email: data.sendEmail && !!data.recipientEmail,
      attachments: storedAttachments // Use optimized attachments here too
    });
    
    log.success('Message sent', { messageId, recipientCount: data.recipients.length });
    
    return {
      success: true,
      messageId,
    };
  }
  
  /**
   * Get communication history
   */
  async getHistory(filters?: Partial<HistoryFilters>): Promise<CommHistoryEntry[]> {
    const history = await kv.getByPrefix('communication_history:');
    
    if (!history || history.length === 0) {
      return [];
    }
    
    let filtered = history;
    
    // Apply filters
    if (filters?.category) {
      filtered = filtered.filter((h: CommHistoryEntry) => h.category === filters.category);
    }
    
    if (filters?.recipientId) {
      filtered = filtered.filter((h: CommHistoryEntry) => 
        h.recipients?.includes(filters.recipientId!)
      );
    }
    
    if (filters?.startDate) {
      filtered = filtered.filter((h: CommHistoryEntry) => 
        new Date(h.sent_at || '') >= new Date(filters.startDate!)
      );
    }
    
    if (filters?.endDate) {
      filtered = filtered.filter((h: CommHistoryEntry) => 
        new Date(h.sent_at || '') <= new Date(filters.endDate!)
      );
    }
    
    // Sort by sent date (newest first)
    filtered.sort((a: CommHistoryEntry, b: CommHistoryEntry) =>
      new Date(b.sent_at || '').getTime() - new Date(a.sent_at || '').getTime()
    );
    
    return filtered;
  }
  
  /**
   * Get user inbox
   * 
   * Returns messages from the last 60 days only. Messages older than 60 days
   * are automatically cleaned up to maintain portal performance and comply
   * with the client portal retention policy.
   */
  async getInbox(userId: string): Promise<Message[]> {
    const prefix = `communication_log:${userId}:`;
    const messages = await kv.getByPrefix(prefix);
    
    if (!messages || messages.length === 0) {
      return [];
    }
    
    // 60-day retention policy — filter out expired messages and clean up KV
    const RETENTION_MS = 60 * 24 * 60 * 60 * 1000; // 60 days in milliseconds
    const cutoff = new Date(Date.now() - RETENTION_MS);
    const active: Message[] = [];
    const expiredKeys: string[] = [];
    
    for (const msg of messages) {
      const createdAt = new Date(msg.created_at);
      if (createdAt >= cutoff) {
        active.push(msg);
      } else {
        // Collect expired message keys for cleanup
        expiredKeys.push(`communication_log:${userId}:${msg.id}`);
      }
    }
    
    // Async cleanup of expired messages (fire-and-forget, don't block response)
    if (expiredKeys.length > 0) {
      kv.mdel(expiredKeys).catch((err: unknown) => {
        log.error('Failed to clean up expired inbox messages', err as Error, { userId, count: expiredKeys.length });
      });
      log.info('Cleaning up expired inbox messages', { userId, expiredCount: expiredKeys.length });
    }
    
    // Sort by created date (newest first)
    active.sort((a: Message, b: Message) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    
    return active;
  }
  
  /**
   * Mark message as read
   */
  async markAsRead(userId: string, messageId: string): Promise<void> {
    const key = `communication_log:${userId}:${messageId}`;
    const message = await kv.get(key);
    
    if (message) {
      message.read = true;
      await kv.set(key, message);
      log.success('Message marked as read', { userId, messageId });
    } else {
      log.warn('Message not found for read receipt', { userId, messageId });
    }
  }
  
  /**
   * Delete message from inbox
   */
  async deleteMessage(userId: string, messageId: string): Promise<void> {
    const key = `communication_log:${userId}:${messageId}`;
    await kv.del(key);
    log.success('Message deleted', { userId, messageId });
  }
  
  /**
   * Delete communication log (admin function)
   * Deletes the communication log from all recipients
   */
  async deleteCommunicationLog(messageId: string): Promise<void> {
    log.info('Deleting communication log', { messageId });
    
    // Get all communication logs with this messageId
    const allLogs = await kv.getByPrefix('communication_log:');
    
    // Filter to find all instances of this message
    const logsToDelete = allLogs.filter((log: CommLogEntry) => log.id === messageId);
    
    // Delete each instance
    for (const logEntry of logsToDelete) {
      const key = `communication_log:${logEntry.recipient_id}:${messageId}`;
      await kv.del(key);
      log.info('Deleted log entry', { recipientId: logEntry.recipient_id, messageId });
    }
    
    // Also delete from history
    await kv.del(`communication_history:${messageId}`);
    
    log.success('Communication log deleted', { messageId, deletedCount: logsToDelete.length });
  }
  
  /**
   * Get all clients for recipient selection
   * 
   * Uses ClientsService (Supabase Auth + KV profiles) to fetch real client data.
   * Cross-references security entries to exclude deleted/suspended clients (§12.3).
   */
  async getAllClients(): Promise<SimpleClient[]> {
    log.info('Fetching all clients for communication');
    
    try {
      const { ClientsService } = await import('./client-management-service.ts');
      const clientsService = new ClientsService();
      const allClients = await clientsService.getAllClients();
      
      // Filter out deleted/suspended clients and map to SimpleClient shape
      const activeClients: SimpleClient[] = allClients
        .filter((c: Record<string, unknown>) => !c.deleted && !c.suspended)
        .map((c: Record<string, unknown>) => ({
          id: (c.id || '') as string,
          name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || (c.email as string) || '',
          firstName: (c.firstName || '') as string,
          lastName: (c.lastName || '') as string,
          surname: (c.lastName || '') as string,
          email: (c.email || '') as string,
          accountType: (c.accountType || 'Standard') as string,
          status: c.deleted ? 'closed' : c.suspended ? 'suspended' : 'active',
          hasEmailOptIn: true,
          hasWhatsAppOptIn: false,
        }));
      
      log.success('Fetched clients via ClientsService', { total: allClients.length, active: activeClients.length });
      
      return activeClients;
    } catch (error) {
      log.error('Failed to fetch clients via ClientsService', error as Error);
      throw error;
    }
  }
  
  /**
   * Get all groups
   * 
   * Automatically recalculates dynamic group membership if the data
   * is stale (older than RECALC_STALE_MS). This ensures group counts
   * stay accurate when clients are added/removed or policies change,
   * without requiring a cron job.
   */
  async getAllGroups(): Promise<Group[]> {
    const customGroups = await repo.getAllGroups();
    
    // ── Auto-recalculate stale dynamic groups ──────────────────────────
    const RECALC_STALE_MS = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();
    const dynamicGroups = customGroups.filter(g => {
      if (!g.filterConfig) return false;
      return Object.values(g.filterConfig).some(v =>
        Array.isArray(v) ? v.length > 0 : v !== undefined
      );
    });

    const needsRecalc = dynamicGroups.some(g => {
      const updatedAt = g.updatedAt ? new Date(g.updatedAt).getTime() : 0;
      return (now - updatedAt) > RECALC_STALE_MS;
    });

    if (needsRecalc && dynamicGroups.length > 0) {
      try {
        log.info('Dynamic groups are stale — auto-recalculating membership', {
          staleGroupCount: dynamicGroups.length,
        });
        await repo.recalculateAllGroupMemberships();
        // Re-fetch after recalculation so counts are fresh
        const refreshed = await repo.getAllGroups();
        return this._prependSystemGroup(refreshed);
      } catch (err) {
        log.error('Auto-recalculation failed, returning stale data', err as Error);
      }
    }

    return this._prependSystemGroup(customGroups);
  }

  /** Prepend the built-in "All Clients" system group. */
  private async _prependSystemGroup(customGroups: Group[]): Promise<Group[]> {
    // Count all clients for the system "All Clients" group
    let clientCount = 0;
    try {
      const allClients = await this.getAllClients();
      clientCount = allClients.length;
    } catch (err) {
      log.warn('Failed to count clients for All Clients group', { error: String(err) });
    }
    
    // Prepend the built-in "All Clients" system group
    const allClientsGroup: Group = {
      id: 'sys_all',
      name: 'All Clients',
      description: 'Every client currently on the platform',
      type: 'system',
      clientIds: [],
      clientCount,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'system',
    };
    
    return [allClientsGroup, ...customGroups];
  }
  
  /**
   * Create group
   */
  async createGroup(data: GroupCreate): Promise<Group> {
    log.info('Creating group', { 
      groupName: data.name,
      filterConfig: data.filterConfig,
      clientIds: data.clientIds
    });
    
    const group = await repo.createGroup(data);
    
    log.success('Group created', { 
      groupId: group.id,
      storedFilterConfig: group.filterConfig
    });
    
    return group;
  }
  
  /**
   * Update group
   */
  async updateGroup(groupId: string, updates: Partial<Group>): Promise<Group> {
    // Prevent modification of system groups
    if (groupId === 'sys_all') {
      throw new ValidationError('System groups cannot be modified');
    }
    
    log.info('Updating group', {
      groupId,
      updates: {
        name: updates.name,
        filterConfig: updates.filterConfig,
        clientIds: updates.clientIds
      }
    });

    const previousGroup =
      groupId === 'sys_newsletter_contacts' && updates.externalContacts !== undefined
        ? await repo.getGroupById(groupId)
        : null;

    const group = await repo.updateGroup(groupId, updates);

    if (groupId === 'sys_newsletter_contacts' && updates.externalContacts !== undefined) {
      await this.syncNewsletterSubscribersFromGroupUpdate(
        previousGroup?.externalContacts || [],
        group.externalContacts || [],
      );
    }
    
    log.success('Group updated', { 
      groupId,
      updatedFilterConfig: group.filterConfig
    });
    
    return group;
  }
  
  /**
   * Delete group
   */
  async deleteGroup(groupId: string): Promise<void> {
    // Prevent deletion of system groups
    if (groupId === 'sys_all') {
      throw new ValidationError('System groups cannot be deleted');
    }
    
    await repo.deleteGroup(groupId);
    
    log.warn('Group deleted', { groupId });
  }

  private async syncNewsletterSubscribersFromGroupUpdate(
    previousContacts: Array<{ email: string; name?: string; subscribedAt?: string }>,
    nextContacts: Array<{ email: string; name?: string; subscribedAt?: string }>,
  ): Promise<void> {
    const now = new Date().toISOString();

    const previousMap = new Map<string, { email: string; name?: string; subscribedAt?: string }>();
    const nextMap = new Map<string, { email: string; name?: string; subscribedAt?: string }>();

    for (const contact of previousContacts) {
      const email = (contact.email || '').trim().toLowerCase();
      if (!email || !email.includes('@')) continue;
      previousMap.set(email, { ...contact, email });
    }

    for (const contact of nextContacts) {
      const email = (contact.email || '').trim().toLowerCase();
      if (!email || !email.includes('@')) continue;
      nextMap.set(email, { ...contact, email });
    }

    for (const [email] of previousMap) {
      if (nextMap.has(email)) continue;
      const key = `newsletter:${email}`;
      const existing = (await kv.get(key)) as Record<string, unknown> | null;
      if (!existing) continue;

      await kv.set(key, {
        ...existing,
        email,
        active: false,
        unsubscribedAt: now,
        removedBy: 'admin',
      });
    }

    for (const [email, contact] of nextMap) {
      const key = `newsletter:${email}`;
      const existing = (await kv.get(key)) as Record<string, unknown> | null;
      const split = splitFullName(contact.name);
      const existingFirstName = typeof existing?.firstName === 'string' ? existing.firstName : '';
      const existingSurname = typeof existing?.surname === 'string' ? existing.surname : '';
      const resolvedFirstName = split.firstName || existingFirstName;
      const resolvedSurname = split.surname || existingSurname;
      const resolvedName =
        contact.name?.trim() ||
        `${resolvedFirstName} ${resolvedSurname}`.trim() ||
        (typeof existing?.name === 'string' ? existing.name : '');

      await kv.set(key, {
        ...(existing || {}),
        email,
        firstName: resolvedFirstName,
        surname: resolvedSurname,
        name: resolvedName,
        source: typeof existing?.source === 'string' ? existing.source : 'Admin Manual Upload',
        subscribedAt:
          (typeof existing?.subscribedAt === 'string' ? existing.subscribedAt : undefined) ||
          contact.subscribedAt ||
          now,
        confirmedAt:
          (typeof existing?.confirmedAt === 'string' ? existing.confirmedAt : undefined) || now,
        confirmed: true,
        active: true,
        unsubscribedAt: null,
        removedBy: null,
      });
    }
  }
  
  /**
   * Get all templates
   */
  async getAllTemplates(): Promise<Template[]> {
    const kvTemplates = await kv.getByPrefix('email_template:');
    
    // If no templates in KV store, seed with defaults
    if (!kvTemplates || kvTemplates.length === 0) {
      log.info('No templates found in KV store, seeding defaults');
      
      const defaultTemplates = Object.values(DEFAULT_TEMPLATES).map(dt => ({
        id: dt.id,
        name: dt.name,
        subject: dt.subject,
        content: dt.bodyHtml,
        title: dt.title,
        subtitle: dt.subtitle,
        greeting: dt.greeting,
        buttonLabel: dt.buttonLabel,
        buttonUrl: dt.buttonUrl,
        footerNote: dt.footerNote,
        enabled: dt.enabled,
        category: dt.id === 'general_campaign' ? 'marketing' : 'transactional',
        isSystem: true,
        createdAt: new Date().toISOString(),
      }));
      
      // Save default templates to KV store
      for (const template of defaultTemplates) {
        await kv.set(`email_template:${template.id}`, template);
      }
      
      log.success('Seeded default templates', { count: defaultTemplates.length });
      
      return defaultTemplates;
    }
    
    // Check if any default templates are missing and add them
    const existingIds = new Set(kvTemplates.map((t: Template) => t.id));
    const missingTemplates: Template[] = [];
    
    for (const [id, dt] of Object.entries(DEFAULT_TEMPLATES)) {
      if (!existingIds.has(id)) {
        const newTemplate: Template = {
          id: dt.id,
          name: dt.name,
          subject: dt.subject,
          content: dt.bodyHtml,
          title: dt.title,
          subtitle: dt.subtitle,
          greeting: dt.greeting,
          buttonLabel: dt.buttonLabel,
          buttonUrl: dt.buttonUrl,
          footerNote: dt.footerNote,
          enabled: dt.enabled,
          category: dt.id === 'general_campaign' ? 'marketing' : 'transactional',
          isSystem: true,
          createdAt: new Date().toISOString(),
        };
        
        await kv.set(`email_template:${id}`, newTemplate);
        missingTemplates.push(newTemplate);
        log.info('Added missing default template', { templateId: id, name: dt.name });
      }
    }
    
    if (missingTemplates.length > 0) {
      log.success('Added missing default templates', { count: missingTemplates.length });
      // Refresh the list
      return await kv.getByPrefix('email_template:') || [];
    }
    
    return kvTemplates || [];
  }
  
  /**
   * Get template by ID
   */
  async getTemplateById(id: string): Promise<Template | null> {
    return await kv.get(`email_template:${id}`);
  }

  /**
   * Create template
   */
  async createTemplate(data: Partial<Template>): Promise<Template> {
    const templateId = generateId();
    
    const template: Template = {
      id: templateId,
      name: data.name!,
      subject: data.subject!,
      content: data.content!,
      title: data.title,
      subtitle: data.subtitle,
      greeting: data.greeting,
      buttonLabel: data.buttonLabel,
      buttonUrl: data.buttonUrl,
      footerNote: data.footerNote,
      enabled: data.enabled ?? true,
      category: data.category,
      createdAt: new Date().toISOString(),
    };
    
    await kv.set(`email_template:${templateId}`, template);
    
    log.success('Template created', { templateId });
    
    return template;
  }

  /**
   * Update template
   */
  async updateTemplate(id: string, updates: Partial<Template>): Promise<Template> {
    const template = await this.getTemplateById(id);
    
    if (!template) {
      throw new NotFoundError('Template not found');
    }
    
    const updatedTemplate: Template = {
      ...template,
      ...updates,
      id, // Ensure ID doesn't change
      createdAt: template.createdAt // Ensure createdAt doesn't change
    };
    
    await kv.set(`email_template:${id}`, updatedTemplate);
    
    log.success('Template updated', { templateId: id });
    
    return updatedTemplate;
  }

  /**
   * Delete template
   */
  async deleteTemplate(id: string): Promise<void> {
    await kv.del(`email_template:${id}`);
    log.success('Template deleted', { templateId: id });
  }

  /**
   * Get email footer settings
   */
  async getFooterSettings(): Promise<Record<string, unknown>> {
    const settings = await kv.get('email_footer_settings');
    
    if (!settings) {
      // Return default settings
      return {
        companyName: 'Navigate Wealth',
        address: '',
        contactEmail: '',
        contactPhone: '',
        socialLinks: {},
        copyrightText: '© 2026 Navigate Wealth. All rights reserved.'
      };
    }
    
    return settings;
  }

  /**
   * Save email footer settings
   */
  async saveFooterSettings(settings: Record<string, unknown>): Promise<void> {
    await kv.set('email_footer_settings', settings);
    log.success('Email footer settings saved');
  }
  
  /**
   * Get all campaigns
   */
  async getAllCampaigns(): Promise<Campaign[]> {
    return await repo.getAllCampaigns();
  }
  
  /**
   * Create campaign
   */
  async createCampaign(adminUserId: string, data: CampaignCreate): Promise<Campaign> {
    log.info('Creating campaign', { adminUserId, subject: data.subject });
    
    const campaign = await repo.createCampaign({
      ...data,
      createdBy: adminUserId,
    });
    
    log.success('Campaign created', { campaignId: campaign.id });
    
    return campaign;
  }
  
  /**
   * Upload file
   */
  async uploadFile(file: File): Promise<StoredAttachment> {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    const BUCKET_NAME = 'make-91ed8379-communication';
    
    // Ensure bucket exists
    try {
        const { data: buckets } = await supabase.storage.listBuckets();
        const bucketExists = buckets?.some(b => b.name === BUCKET_NAME);
        if (!bucketExists) {
            await supabase.storage.createBucket(BUCKET_NAME, {
                public: true,
                fileSizeLimit: 10485760 // 10MB
            });
        }
    } catch (e) {
        log.warn('Bucket check failed', e);
    }

    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `${timestamp}_${sanitizedName}`;
    
    const fileBuffer = await file.arrayBuffer();
    
    const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(path, fileBuffer, {
            contentType: file.type,
            upsert: false
        });
        
    if (error) {
        throw new Error(`Upload failed: ${error.message}`);
    }
    
    const { data: { publicUrl } } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(path);
        
    return {
        id: crypto.randomUUID(),
        name: file.name,
        path: path,
        bucket: BUCKET_NAME,
        type: file.type,
        size: file.size,
        url: publicUrl
    };
  }

  /**
   * Send campaign
   */
  async sendCampaign(campaignId: string): Promise<{ success: boolean; sent: number }> {
    const campaign = await repo.getCampaignById(campaignId);
    
    if (!campaign) {
      throw new NotFoundError('Campaign not found');
    }
    
    log.info('Sending campaign', { campaignId, selectedGroup: campaign.selectedGroup?.id, recipientType: campaign.recipientType });
    
    // Resolve recipients
    let recipientIds: string[] = [];
    let externalEmails: string[] = [];
    
    if (campaign.recipientType === 'group' && campaign.selectedGroup?.id) {
      if (campaign.selectedGroup.id === 'sys_all') {
        const allClients = await this.getAllClients();
        recipientIds = allClients.map((c) => c.id);
      } else {
        const group = await repo.getGroupById(campaign.selectedGroup.id);
        
        if (!group) {
          throw new ValidationError('Group not found');
        }

        // If this is a dynamic group, recalculate membership at send-time
        // so the campaign goes to the latest matching clients (§12.3 downstream guards).
        const hasFilters = group.filterConfig &&
          Object.values(group.filterConfig).some(v =>
            Array.isArray(v) ? v.length > 0 : v !== undefined
          );

        if (hasFilters) {
          try {
            log.info('Recalculating dynamic group before campaign send', { groupId: group.id });
            const { fetchMatcherClients } = await import('./communication-repo.ts');
            const { recalculateSingleGroupMembership } = await import('./group-matcher.ts');
            const matcherClients = await fetchMatcherClients();
            const recalculated = recalculateSingleGroupMembership(group, matcherClients);
            group.clientIds = (recalculated.clientIds || []) as string[];
            group.clientCount = group.clientIds.length + (group.externalContacts?.length || 0);
            await repo.saveGroup(group);
            log.success('Dynamic group recalculated for send', { groupId: group.id, memberCount: group.clientCount });
          } catch (err) {
            log.error('Failed to recalculate group before send — using stale membership', err as Error);
          }
        }

        recipientIds = group.clientIds || [];

        if (group.externalContacts && group.externalContacts.length > 0) {
          externalEmails = group.externalContacts.map((c) => c.email);
        }

        if (recipientIds.length === 0 && externalEmails.length === 0) {
          throw new ValidationError('Group has no members');
        }
      }
    } else if (campaign.recipientType === 'multiple' && campaign.selectedRecipients) {
      recipientIds = campaign.selectedRecipients.map((r) => r.id as string);
    } else if (campaign.recipientType === 'single' && campaign.selectedRecipients?.[0]) {
      recipientIds = [campaign.selectedRecipients[0].id];
    }
    
    if (recipientIds.length === 0 && externalEmails.length === 0) {
      throw new ValidationError('No recipients found for campaign');
    }

    // Build a recipientId → email lookup from campaign.selectedRecipients
    const recipientEmailMap = new Map<string, string>();
    const recipientInfoMap = new Map<string, { firstName: string; lastName: string; email: string; phone?: string }>();
    if (campaign.selectedRecipients) {
      for (const r of campaign.selectedRecipients) {
        if (r.id && r.email) {
          recipientEmailMap.set(r.id, r.email as string);
        }
        if (r.id) {
          recipientInfoMap.set(r.id, {
            firstName: (r.firstName || r.name?.toString().split(' ')[0] || '') as string,
            lastName: (r.lastName || r.surname || r.name?.toString().split(' ').slice(1).join(' ') || '') as string,
            email: (r.email || '') as string,
            phone: (r.phone || '') as string,
          });
        }
      }
    }

    // If we're sending to a group and don't have emails from selectedRecipients,
    // fetch all clients to resolve emails and name info
    if (recipientIds.length > 0 && (recipientEmailMap.size < recipientIds.length || recipientInfoMap.size < recipientIds.length)) {
      try {
        const allClients = await this.getAllClients();
        for (const client of allClients) {
          if (client.email && !recipientEmailMap.has(client.id)) {
            recipientEmailMap.set(client.id, client.email);
          }
          if (!recipientInfoMap.has(client.id)) {
            recipientInfoMap.set(client.id, {
              firstName: client.firstName || '',
              lastName: client.lastName || client.surname || '',
              email: client.email || '',
            });
          }
        }
      } catch (err) {
        log.error('Failed to resolve client emails for campaign', err as Error);
      }
    }
    
    let sent = 0;
    
    // Send to each client recipient (internal message + email)
    // Merge fields are resolved per-recipient via sendMessage
    for (const recipientId of recipientIds) {
      try {
        const recipientEmail = recipientEmailMap.get(recipientId);
        const recipientInfo = recipientInfoMap.get(recipientId);
        
        await this.sendMessage('system', {
          recipients: [recipientId],
          subject: campaign.subject,
          content: campaign.bodyHtml,
          category: 'Campaign',
          senderName: 'Navigate Wealth',
          sendEmail: !!recipientEmail,
          recipientEmail: recipientEmail,
          recipientFirstName: recipientInfo?.firstName,
          recipientLastName: recipientInfo?.lastName,
          recipientPhone: recipientInfo?.phone,
        });
        
        sent++;
      } catch (error) {
        log.error('Failed to send to recipient', error as Error, { recipientId });
      }
    }

    // Send to external contacts (direct email only — no internal message)
    if (externalEmails.length > 0) {
      const { sendEmail: sendEmailFn, createEmailTemplate: createEmailTemplateFn } = await import('./email-service.ts');

      for (const extEmail of externalEmails) {
        try {
          const unsubscribeLink = `https://navigatewealth.co/newsletter/unsubscribe?email=${encodeURIComponent(extEmail)}`;
          const html = createEmailTemplateFn(campaign.bodyHtml, {
            title: campaign.subject,
            unsubscribeLink,
          });

          const result = await sendEmailFn({
            to: extEmail,
            subject: campaign.subject,
            html,
          });

          if (result) sent++;
        } catch (error) {
          log.error('Failed to send to external contact', error as Error, { email: extEmail });
        }
      }
    }

    const totalRecipients = recipientIds.length + externalEmails.length;
    
    // Update campaign status
    await repo.updateCampaign(campaignId, {
      status: 'completed',
      stats: {
        sent,
        failed: totalRecipients - sent,
        total: totalRecipients,
      },
    });
    
    log.success('Campaign sent', { campaignId, sent, totalRecipients });
    
    return {
      success: true,
      sent,
    };
  }
}

// Export scheduled task processor
export async function processScheduledCampaigns() {
  return await processScheduledCampaignsOld();
}

// Interfaces for type safety
interface StoredAttachment {
  name: string;
  url?: string;
  content?: string;
  type?: string;
  [key: string]: unknown;
}

interface CommHistoryEntry {
  category?: string;
  recipients?: string[];
  sent_at?: string;
  [key: string]: unknown;
}

interface CommLogEntry {
  id?: string;
  recipient_id?: string;
  [key: string]: unknown;
}

interface KvUser {
  id?: string;
  role?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  account_type?: string;
  status?: string;
  [key: string]: unknown;
}

interface SimpleClient {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  surname: string;
  email: string;
  accountType: string;
  status: string;
  hasEmailOptIn: boolean;
  hasWhatsAppOptIn: boolean;
}
