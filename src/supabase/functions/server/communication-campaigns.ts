/**
 * Campaigns: listing, creation, sending, and the scheduled processor.
 *
 * Split out of `communication-service.ts` (1,387 lines), a stateless class whose
 * `this.` only ever called a sibling method. The class remains as a facade with
 * field assignments; the logger keeps its channel name.
 */
import { createModuleLogger } from './stderr-logger.ts';
import { ValidationError, NotFoundError } from './error.middleware.ts';
import * as repo from './communication-repo.ts';
import type { Campaign, CampaignCreate, CampaignStatus } from './communication-types.ts';
import { resolveAdminDisplayNames, stripHtmlForSearch } from './communication-service-helpers.ts';
import { getAllClients, sendMessage } from './communication-messaging.ts';

const log = createModuleLogger('communication-service');

export interface CampaignSenderOption {
  userId: string;
  label: string;
}

export async function enrichCampaignsWithCreatorNames(campaigns: Campaign[]): Promise<Campaign[]> {
  if (campaigns.length === 0) return campaigns;
  const nameMap = await resolveAdminDisplayNames(campaigns.map((c) => c.createdBy || 'system'));
  return campaigns.map((c) => {
    const key = (c.createdBy || 'system').trim();
    return {
      ...c,
      createdByName: nameMap.get(key) ?? (key === 'system' ? 'System' : key),
    };
  });
}

export function buildSenderOptions(rows: Campaign[]): CampaignSenderOption[] {
  const senderMap = new Map<string, string>();
  for (const c of rows) {
    const id = (c.createdBy || 'system').trim();
    const label = (c.createdByName || id).trim();
    if (!senderMap.has(id)) senderMap.set(id, label);
  }
  return [...senderMap.entries()]
    .map(([userId, label]) => ({ userId, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export async function listCampaignsFiltered(options: {
  page: number;
  limit: number;
  search?: string;
  channel?: 'email' | 'whatsapp';
  recipientType?: 'single' | 'multiple' | 'group';
  createdBy?: string;
  status?: CampaignStatus;
  /** `direct` = individual client messages, `campaign` = Communication Centre sends. */
  origin?: 'campaign' | 'direct';
}): Promise<{
  campaigns: Campaign[];
  total: number;
  page: number;
  limit: number;
  senderOptions: CampaignSenderOption[];
}> {
  const page = Math.max(1, options.page);
  const limit = Math.min(100, Math.max(1, options.limit));

  const all = await repo.getAllCampaigns();
  let rows = await enrichCampaignsWithCreatorNames(all);
  rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const senderOptions = buildSenderOptions(rows);

  if (options.channel === 'email' || options.channel === 'whatsapp') {
    rows = rows.filter((c) => c.channel === options.channel);
  }

  if (
    options.recipientType === 'single' ||
    options.recipientType === 'multiple' ||
    options.recipientType === 'group'
  ) {
    rows = rows.filter((c) => c.recipientType === options.recipientType);
  }

  if (options.createdBy) {
    const want = options.createdBy.trim();
    rows = rows.filter((c) => (c.createdBy || 'system').trim() === want);
  }

  if (options.status) {
    rows = rows.filter((c) => c.status === options.status);
  }

  if (options.origin) {
    // Rows written before `origin` existed are all Communication Centre
    // campaigns, so an absent value reads as 'campaign'.
    rows = rows.filter((c) => (c.origin || 'campaign') === options.origin);
  }

  const q = options.search?.trim().toLowerCase();
  if (q) {
    rows = rows.filter((c) => {
      const subj = (c.subject || '').toLowerCase();
      const body = stripHtmlForSearch(c.bodyHtml || '');
      const name = (c.createdByName || '').toLowerCase();
      const byId = (c.createdBy || '').toLowerCase();
      const groupName =
        typeof c.selectedGroup?.name === 'string' ? c.selectedGroup.name.toLowerCase() : '';
      return (
        subj.includes(q) ||
        body.includes(q) ||
        name.includes(q) ||
        byId.includes(q) ||
        groupName.includes(q)
      );
    });
  }

  const total = rows.length;
  const offset = (page - 1) * limit;
  const campaigns = rows.slice(offset, offset + limit);

  return { campaigns, total, page, limit, senderOptions };
}

export async function listCampaigns(options: { page: number; limit: number }): Promise<{
  campaigns: Campaign[];
  total: number;
  page: number;
  limit: number;
  senderOptions: CampaignSenderOption[];
}> {
  return await listCampaignsFiltered({
    page: options.page,
    limit: options.limit,
  });
}

export async function listAllCampaignsWithCreatorNames(): Promise<{
  campaigns: Campaign[];
  total: number;
  page: number;
  limit: number;
  senderOptions: CampaignSenderOption[];
}> {
  const all = await repo.getAllCampaigns();
  const enriched = await enrichCampaignsWithCreatorNames(all);
  enriched.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return {
    campaigns: enriched,
    total: enriched.length,
    page: 1,
    limit: enriched.length,
    senderOptions: buildSenderOptions(enriched),
  };
}

export async function getAllCampaigns(): Promise<Campaign[]> {
  return await repo.getAllCampaigns();
}

export async function createCampaign(adminUserId: string, data: CampaignCreate): Promise<Campaign> {
  log.info('Creating campaign', { adminUserId, subject: data.subject });

  const campaign = await repo.createCampaign({
    ...data,
    createdBy: adminUserId,
  });

  log.success('Campaign created', { campaignId: campaign.id });

  return campaign;
}

export async function sendCampaign(
  campaignId: string,
  adminUserId: string,
): Promise<{ success: boolean; sent: number; status: CampaignStatus }> {
  const campaign = await repo.getCampaignById(campaignId);

  if (!campaign) {
    throw new NotFoundError('Campaign not found');
  }

  // Direct sends are filed as campaign rows so they show up in the manager's
  // history (see sendDirectMessage). They are a record of something already
  // delivered, not a draft — re-"sending" one would silently mail the client
  // again.
  if (campaign.origin === 'direct') {
    throw new ValidationError(
      'This is a record of an individual communication that has already been sent, not a campaign',
    );
  }

  log.info('Sending campaign', {
    campaignId,
    selectedGroup: campaign.selectedGroup?.id,
    recipientType: campaign.recipientType,
  });

  // Resolve recipients
  let recipientIds: string[] = [];
  let externalEmails: string[] = [];

  if (campaign.recipientType === 'group' && campaign.selectedGroup?.id) {
    if (campaign.selectedGroup.id === 'sys_all') {
      const allClients = await getAllClients();
      recipientIds = allClients.map((c) => c.id);
    } else {
      const group = await repo.getGroupById(campaign.selectedGroup.id);

      if (!group) {
        throw new ValidationError('Group not found');
      }

      // If this is a dynamic group, recalculate membership at send-time
      // so the campaign goes to the latest matching clients (§12.3 downstream guards).
      const hasFilters =
        group.filterConfig &&
        Object.values(group.filterConfig).some((v) =>
          Array.isArray(v) ? v.length > 0 : v !== undefined,
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
          log.success('Dynamic group recalculated for send', {
            groupId: group.id,
            memberCount: group.clientCount,
          });
        } catch (err) {
          log.error(
            'Failed to recalculate group before send — using stale membership',
            err as Error,
          );
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
  const recipientInfoMap = new Map<
    string,
    { firstName: string; lastName: string; email: string; phone?: string }
  >();
  if (campaign.selectedRecipients) {
    for (const r of campaign.selectedRecipients) {
      if (r.id && r.email) {
        recipientEmailMap.set(r.id, r.email as string);
      }
      if (r.id) {
        recipientInfoMap.set(r.id, {
          firstName: (r.firstName || r.name?.toString().split(' ')[0] || '') as string,
          lastName: (r.lastName ||
            r.surname ||
            r.name?.toString().split(' ').slice(1).join(' ') ||
            '') as string,
          email: (r.email || '') as string,
          phone: (r.phone || '') as string,
        });
      }
    }
  }

  // If we're sending to a group and don't have emails from selectedRecipients,
  // fetch all clients to resolve emails and name info
  if (
    recipientIds.length > 0 &&
    (recipientEmailMap.size < recipientIds.length || recipientInfoMap.size < recipientIds.length)
  ) {
    try {
      const allClients = await getAllClients();
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
  let rejected = 0;
  let firstFailure: string | undefined;

  // Send to each client recipient (internal message + email)
  // Merge fields are resolved per-recipient via sendMessage
  for (const recipientId of recipientIds) {
    try {
      const recipientEmail = recipientEmailMap.get(recipientId);
      const recipientInfo = recipientInfoMap.get(recipientId);

      const result = await sendMessage(adminUserId, {
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
        // Tags the per-recipient history entry as belonging to this campaign so
        // it is not mistaken for a standalone communication.
        campaignId,
      });

      // Count what actually got through, not merely what did not throw.
      // sendMessage swallows email failures by design (the portal copy is still
      // written), so the old `sent++` here counted rejected sends as successes
      // and every campaign finished 'completed'.
      if (result.status === 'completed') {
        sent++;
      } else {
        if (result.status === 'rejected') rejected++;
        firstFailure = firstFailure || result.failureReason;
        log.warn('Recipient did not receive campaign', {
          recipientId,
          status: result.status,
        });
      }
    } catch (error) {
      firstFailure = firstFailure || (error instanceof Error ? error.message : String(error));
      log.error('Failed to send to recipient', error as Error, { recipientId });
    }
  }

  // Send to external contacts (direct email only — no internal message)
  if (externalEmails.length > 0) {
    const { sendEmail: sendEmailFn, createEmailTemplate: createEmailTemplateFn } =
      await import('./email-service.ts');

    for (const extEmail of externalEmails) {
      try {
        const unsubscribeLink = `https://www.navigatewealth.co/newsletter/unsubscribe?email=${encodeURIComponent(extEmail)}`;
        const html = createEmailTemplateFn(campaign.bodyHtml, {
          title: campaign.subject,
          unsubscribeLink,
        });

        const result = await sendEmailFn({
          to: extEmail,
          subject: campaign.subject,
          html,
        });

        if (result) {
          sent++;
        } else {
          firstFailure = firstFailure || `The email provider rejected ${extEmail}`;
          log.warn('External contact did not receive campaign', { email: extEmail });
        }
      } catch (error) {
        firstFailure = firstFailure || (error instanceof Error ? error.message : String(error));
        log.error('Failed to send to external contact', error as Error, { email: extEmail });
      }
    }
  }

  const totalRecipients = recipientIds.length + externalEmails.length;
  const failed = totalRecipients - sent;

  // Status now reflects the run. It used to be hardcoded 'completed', so a
  // campaign where every address bounced still showed a green badge in the
  // manager and nobody had any way to tell from the UI that it had not landed.
  const status: CampaignStatus =
    failed === 0
      ? 'completed'
      : sent > 0
        ? 'partial'
        : rejected === totalRecipients
          ? 'rejected'
          : 'failed';

  await repo.updateCampaign(campaignId, {
    status,
    failureReason: failed > 0 ? firstFailure : undefined,
    stats: {
      sent,
      failed,
      total: totalRecipients,
    },
  });

  log.success('Campaign send completed', { campaignId, sent, totalRecipients, status });

  return {
    success: sent > 0,
    sent,
    status,
  };
}
