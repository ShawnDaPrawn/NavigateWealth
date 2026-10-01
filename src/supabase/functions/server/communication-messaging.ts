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
  RecipientDeliveryResult,
  SendMessageResult,
  Campaign,
} from './communication-types.ts';
import { generateId } from './communication-service-helpers.ts';
import { deleteCampaign, getCampaign, saveCampaign } from './communication-repo.ts';
import {
  describeDroppedRecipients,
  describeUndeliveredRecipients,
  normalizeEmailList,
} from './email-recipients.ts';
import { classifyDeliveryFailure } from './email-delivery-classification.ts';
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
): Promise<SendMessageResult> {
  log.info('Sending message', { adminUserId });

  // Validate
  if (!data.subject || !data.content) {
    throw new ValidationError('Subject and content are required');
  }

  if (!data.recipients || data.recipients.length === 0) {
    throw new ValidationError('At least one recipient is required');
  }

  // CC HYGIENE — do this BEFORE anything is sent.
  // The CC list arrives from a free-text "comma separated" field, and both
  // providers reject the ENTIRE personalization (so the client gets nothing
  // either) when it contains a blank entry, a malformed address, or a repeat of
  // the To address. Dropping the bad entries and carrying on is the only
  // behaviour where the client still receives their communication.
  const ccNormalized = normalizeEmailList(data.cc, [data.recipientEmail]);
  // The log gets everything that was dropped; the admin only hears about the
  // addresses that actually received nothing. A duplicate was still copied
  // once, and CC'ing the recipient themselves still reaches them as the To.
  if (ccNormalized.dropped.length > 0) {
    log.warn('Dropped unusable CC addresses', {
      dropped: describeDroppedRecipients(ccNormalized.dropped),
    });
  }
  const ccWarning = describeUndeliveredRecipients(ccNormalized.dropped);

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
  const results: RecipientDeliveryResult[] = [];

  // Send to each recipient
  for (const recipientId of data.recipients) {
    const outcome: RecipientDeliveryResult = {
      recipientId,
      recipientEmail: data.recipientEmail,
      portalDelivered: false,
      emailStatus: 'skipped',
    };

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

      // Send email if requested and email address provided
      if (data.sendEmail && data.recipientEmail) {
        try {
          log.info('Sending email notification', {
            recipientEmail: data.recipientEmail,
            ccCount: ccNormalized.accepted.length,
          });

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

          // `throwOnError` is what makes this a real check. Without it sendEmail
          // RETURNS FALSE on a provider rejection, and the previous code
          // discarded that boolean — so a 400 from SendGrid was logged as
          // "Email sent successfully" and stored as sent_via_email: true. That
          // is the reason a communication could appear sent and never arrive.
          await sendEmail({
            to: data.recipientEmail,
            cc: ccNormalized.accepted.length > 0 ? ccNormalized.accepted : undefined,
            subject: resolvedSubject,
            html: createEmailTemplate(resolvedContent, {
              title: resolvedSubject,
            }),
            text: resolvedContent.replace(/<[^>]*>/g, ''),
            attachments: emailAttachments,
            throwOnError: true,
          });

          outcome.emailStatus = 'sent';
          log.success('Email sent successfully', { recipientEmail: data.recipientEmail });
        } catch (emailError) {
          // A terminal classification (bad address, malformed envelope, refused
          // by the provider) is reported as `rejected` so the manager can show
          // it as such — retrying the same payload cannot help. Everything else
          // is `failed` and is worth another attempt.
          const classified = classifyDeliveryFailure(emailError);
          outcome.emailStatus = classified.disposition === 'terminal' ? 'rejected' : 'failed';
          outcome.error = classified.message;

          log.error('Failed to send email, but message was saved to portal', emailError as Error, {
            recipientEmail: data.recipientEmail,
            emailStatus: outcome.emailStatus,
          });
          // Don't throw - we still want to save to portal even if email fails
        }
      }

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
        // Only true when the provider actually accepted it — this drives the
        // "Email" badge on the client profile's history, which used to claim an
        // email had gone out whenever one had merely been attempted.
        sent_via_email: outcome.emailStatus === 'sent',
        email_status: outcome.emailStatus,
        email_error: outcome.error,
        cc: ccNormalized.accepted,
        attachments: storedAttachments, // Use the optimized attachments (with URLs)
      });

      outcome.portalDelivered = true;
      log.success('Message delivered', { recipientId });
    } catch (error) {
      outcome.error = outcome.error || (error instanceof Error ? error.message : String(error));
      log.error('Failed to deliver message', error as Error, { recipientId });
    }

    results.push(outcome);
  }

  const summary = summarizeDelivery(results);

  // Log to history
  await kv.set(`communication_history:${messageId}`, {
    id: messageId,
    sender_id: adminUserId,
    sender_name: data.senderName || 'Navigate Wealth',
    subject: data.subject,
    content: data.content,
    recipients: data.recipients,
    category: data.category,
    sent_at: timestamp,
    sent_via_email: summary.stats.sent > 0,
    cc: ccNormalized.accepted,
    status: summary.status,
    stats: summary.stats,
    results,
    campaign_id: data.campaignId,
    attachments: storedAttachments, // Use optimized attachments here too
  });

  log.success('Message sent', {
    messageId,
    recipientCount: data.recipients.length,
    status: summary.status,
  });

  return {
    success: summary.status !== 'failed' && summary.status !== 'rejected',
    messageId,
    status: summary.status,
    stats: summary.stats,
    results,
    cc: ccNormalized.accepted,
    ccWarning: ccWarning || undefined,
    failureReason: summary.failureReason,
  };
}

/**
 * Collapse per-recipient outcomes into the single status the manager shows.
 *
 * A recipient counts as delivered when the portal copy was written AND email
 * either succeeded or was never requested — the portal copy is the part that is
 * always required (the compose form has "Publish to Portal" permanently
 * checked), email is opt-in.
 */
export function summarizeDelivery(results: RecipientDeliveryResult[]): {
  status: 'completed' | 'partial' | 'failed' | 'rejected';
  stats: { sent: number; failed: number; total: number };
  failureReason?: string;
} {
  const total = results.length;
  const delivered = results.filter(
    (r) => r.portalDelivered && r.emailStatus !== 'failed' && r.emailStatus !== 'rejected',
  );
  const sent = delivered.length;
  const failed = total - sent;
  const failureReason = results.find((r) => r.error)?.error;

  if (total === 0 || failed === 0) {
    return { status: 'completed', stats: { sent, failed, total } };
  }
  if (sent > 0) {
    return { status: 'partial', stats: { sent, failed, total }, failureReason };
  }
  // Nothing got through. `rejected` only when every failure was terminal —
  // otherwise it is a plain failure and worth retrying.
  const allRejected = results.every((r) => r.emailStatus === 'rejected');
  return {
    status: allRejected ? 'rejected' : 'failed',
    stats: { sent, failed, total },
    failureReason,
  };
}

/**
 * Send one communication composed on a client profile's Communication tab, and
 * RECORD IT WHERE THE MANAGER LOOKS.
 *
 * Why this wrapper exists: the Communication Centre's History view reads
 * campaign rows (`communication:campaigns:*`). Direct sends only ever wrote
 * `communication_history:*`, which nothing in that view reads — so every
 * individual message an adviser sent from a client profile was invisible in the
 * manager. This writes the same campaign-shaped row a wizard send produces,
 * tagged `origin: 'direct'`, so both kinds of communication appear in one
 * history with one status vocabulary.
 *
 * It deliberately wraps `sendMessage` rather than living inside it:
 * `sendCampaign` fans out to `sendMessage` once PER RECIPIENT, so recording
 * from inside would create one bogus row per campaign recipient.
 */
export async function sendDirectMessage(
  adminUserId: string,
  data: MessageCreate,
): Promise<SendMessageResult> {
  const result = await sendMessage(adminUserId, data);

  try {
    const now = new Date().toISOString();
    const campaign: Campaign = {
      id: result.messageId,
      subject: data.subject,
      bodyHtml: data.content,
      // "Send Email" is optional on the compose form; the portal copy is not.
      // Filing a portal-only message as `email` made the manager show it with
      // an Email badge for a message no provider ever saw.
      channel: data.sendEmail && data.recipientEmail ? 'email' : 'portal',
      recipientType: data.recipients.length > 1 ? 'multiple' : 'single',
      selectedRecipients: data.recipients.map((id) => ({
        id,
        email: id === data.recipients[0] ? data.recipientEmail : undefined,
        name:
          `${data.recipientFirstName || ''} ${data.recipientLastName || ''}`.trim() || undefined,
      })),
      status: result.status,
      attachments: [],
      scheduling: { type: 'immediate' },
      stats: result.stats,
      origin: 'direct',
      cc: result.cc,
      failureReason: result.failureReason,
      createdAt: now,
      updatedAt: now,
      createdBy: adminUserId,
    };

    // Through the repository, not a raw kv.set — `communication:campaigns:*` is
    // its namespace and it owns the key shape.
    await saveCampaign(campaign);
  } catch (error) {
    // The message HAS been sent by this point. A failure to file the history
    // row must not turn a delivered communication into an error for the admin.
    log.error('Failed to record direct communication in history', error as Error, {
      messageId: result.messageId,
    });
  }

  return result;
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

  // One round trip, not one per recipient plus one for the history entry — a
  // message sent to 200 clients used to cost 201 sequential deletes.
  await kv.mdel([
    ...logsToDelete.map((logEntry) => `communication_log:${logEntry.recipient_id}:${messageId}`),
    `communication_history:${messageId}`,
  ]);

  // A direct send also has a campaign-shaped row so the Communication Centre
  // can list it (see sendDirectMessage). Without this the admin deletes the
  // message from the client profile, is told it worked, and the manager keeps
  // showing it forever. Guarded on `origin` so passing a real campaign's id
  // here can never delete that campaign.
  const directRow = await getCampaign(messageId);
  if (directRow?.origin === 'direct') {
    await deleteCampaign(messageId);
    log.info('Deleted direct communication history row', { messageId });
  }

  log.success('Communication log deleted', { messageId, deletedCount: logsToDelete.length });
}

export async function getAllClients(): Promise<SimpleClient[]> {
  log.info('Fetching all clients for communication');

  try {
    const { ClientsService } = await import('./client-management-service.ts');
    const clientsService = new ClientsService();
    const allClients = await clientsService.getAllClients();

    let isOptedOut = (_opts: { clientId?: string | null; email?: string | null }) => false;
    try {
      const { getUnsubscribeIndex, isUnsubscribed } =
        await import('./communication-unsubscribes.ts');
      const unsubscribeIndex = await getUnsubscribeIndex();
      isOptedOut = (opts) => isUnsubscribed(unsubscribeIndex, opts);
    } catch (err) {
      log.warn('Failed to load communication unsubscribe list', { error: String(err) });
    }

    const activeClients: SimpleClient[] = allClients
      .filter((c) => !c.deleted && !c.suspended)
      .map((c) => {
        const id = (c.id || '') as string;
        const email = (c.email || '') as string;
        const optedOut = isOptedOut({ clientId: id, email });
        return {
          id,
          name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || email || '',
          firstName: (c.firstName || '') as string,
          lastName: (c.lastName || '') as string,
          surname: (c.lastName || '') as string,
          email,
          accountType: (c.accountType || 'Standard') as string,
          status: c.deleted ? 'closed' : c.suspended ? 'suspended' : 'active',
          hasEmailOptIn: !optedOut,
          hasWhatsAppOptIn: false,
        };
      });

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
