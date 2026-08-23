/**
 * Direct messages: send, history, inbox, read/delete, and the client list.
 *
 * Split out of `communication-service.ts` (1,387 lines), a stateless class whose
 * `this.` only ever called a sibling method. The class remains as a facade with
 * field assignments; the logger keeps its channel name.
 */
import { createModuleLogger } from './stderr-logger.ts';
import * as kv from './kv_store.tsx';
import { ValidationError } from './error.middleware.ts';
import { sendEmail, createEmailTemplate } from './email-service.ts';
import { resolveMergeFields } from './communication-business-logic.ts';
import type {
  Message,
  MessageCreate,
  HistoryFilters,
  CachedRecipient,
} from './communication-types.ts';
import { generateId } from './communication-service-helpers.ts';
import type {
  CommHistoryEntry,
  CommLogEntry,
  SimpleClient,
  StoredAttachment,
} from './communication-service-helpers.ts';
import { uploadFile } from './communication-attachments.ts';

const log = createModuleLogger('communication-service');

export async function sendMessage(
  adminUserId: string,
  data: MessageCreate,
): Promise<{ success: boolean; messageId: string }> {
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
              const uploaded = await uploadFile(file);
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
      const hasMergePlaceholders = /\{\{(first_name|surname|full_name|email|phone)\}\}/.test(
        data.subject + data.content,
      );

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
            const pi =
              ((profile as Record<string, unknown>).personalInformation as Record<
                string,
                unknown
              >) || {};
            mergeRecipient = {
              firstName: (pi.firstName as string) || '',
              lastName: (pi.lastName as string) || (pi.surname as string) || '',
              email:
                data.recipientEmail || ((profile as Record<string, unknown>).email as string) || '',
              phone: (pi.cellphoneNumber as string) || '',
            };
          }
        } catch (_kvErr) {
          log.warn('Failed to look up recipient profile for merge fields', { recipientId });
        }
      }

      const hasMergeData = mergeRecipient.firstName || mergeRecipient.lastName;
      const resolvedSubject = hasMergeData
        ? resolveMergeFields(data.subject, mergeRecipient as unknown as CachedRecipient)
        : data.subject;
      const resolvedContent = hasMergeData
        ? resolveMergeFields(data.content, mergeRecipient as unknown as CachedRecipient)
        : data.content;

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
        attachments: storedAttachments, // Use the optimized attachments (with URLs)
      });

      // Send email if requested and email address provided
      if (data.sendEmail && data.recipientEmail) {
        try {
          log.info('Sending email notification', { recipientEmail: data.recipientEmail });

          // Prepare attachments for SendGrid
          // For SendGrid, we need the CONTENT (base64)
          // If we successfully uploaded and replaced content with URL in storedAttachments,
          // we should still use the ORIGINAL data.attachments for the email sending.
          const emailAttachments = data.attachments?.map((att) => ({
            content: att.content?.split(',')[1] || att.content || '', // Remove data URL prefix if present
            filename: att.name,
            type: att.type || 'application/octet-stream',
            disposition: 'attachment',
          }));

          await sendEmail({
            to: data.recipientEmail,
            subject: resolvedSubject,
            html: createEmailTemplate(resolvedContent, {
              title: resolvedSubject,
            }),
            text: resolvedContent.replace(/<[^>]*>/g, ''),
            attachments: emailAttachments,
          });

          log.success('Email sent successfully', { recipientEmail: data.recipientEmail });
        } catch (emailError) {
          log.error('Failed to send email, but message was saved to portal', emailError as Error, {
            recipientEmail: data.recipientEmail,
          });
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
    attachments: storedAttachments, // Use optimized attachments here too
  });

  log.success('Message sent', { messageId, recipientCount: data.recipients.length });

  return {
    success: true,
    messageId,
  };
}

export async function getHistory(filters?: Partial<HistoryFilters>): Promise<CommHistoryEntry[]> {
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
      h.recipients?.includes(filters.recipientId!),
    );
  }

  if (filters?.startDate) {
    filtered = filtered.filter(
      (h: CommHistoryEntry) => new Date(h.sent_at || '') >= new Date(filters.startDate!),
    );
  }

  if (filters?.endDate) {
    filtered = filtered.filter(
      (h: CommHistoryEntry) => new Date(h.sent_at || '') <= new Date(filters.endDate!),
    );
  }

  // Sort by sent date (newest first)
  filtered.sort(
    (a: CommHistoryEntry, b: CommHistoryEntry) =>
      new Date(b.sent_at || '').getTime() - new Date(a.sent_at || '').getTime(),
  );

  return filtered;
}

export async function getInbox(userId: string): Promise<Message[]> {
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
      log.error('Failed to clean up expired inbox messages', err as Error, {
        userId,
        count: expiredKeys.length,
      });
    });
    log.info('Cleaning up expired inbox messages', { userId, expiredCount: expiredKeys.length });
  }

  // Sort by created date (newest first)
  active.sort(
    (a: Message, b: Message) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return active;
}

export async function markAsRead(userId: string, messageId: string): Promise<void> {
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

export async function deleteMessage(userId: string, messageId: string): Promise<void> {
  const key = `communication_log:${userId}:${messageId}`;
  await kv.del(key);
  log.success('Message deleted', { userId, messageId });
}

export async function deleteCommunicationLog(messageId: string): Promise<void> {
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

export async function getAllClients(): Promise<SimpleClient[]> {
  log.info('Fetching all clients for communication');

  try {
    const { ClientsService } = await import('./client-management-service.ts');
    const clientsService = new ClientsService();
    const allClients = await clientsService.getAllClients();

    // Filter out deleted/suspended clients and map to SimpleClient shape
    const activeClients: SimpleClient[] = allClients
      .filter((c) => !c.deleted && !c.suspended)
      .map((c) => ({
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

    log.success('Fetched clients via ClientsService', {
      total: allClients.length,
      active: activeClients.length,
    });

    return activeClients;
  } catch (error) {
    log.error('Failed to fetch clients via ClientsService', error as Error);
    throw error;
  }
}
