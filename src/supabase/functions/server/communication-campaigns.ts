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
import type { Campaign, CampaignCreate } from './communication-types.ts';
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
): Promise<{ success: boolean; sent: number }> {
  const campaign = await repo.getCampaignById(campaignId);

  if (!campaign) {
    throw new NotFoundError('Campaign not found');
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

  const { getUnsubscribeIndex, isUnsubscribed } = await import('./communication-unsubscribes.ts');
  const unsubscribeIndex = await getUnsubscribeIndex();
  recipientIds = recipientIds.filter((recipientId) => {
    const email = recipientEmailMap.get(recipientId);
    const info = recipientInfoMap.get(recipientId);
    return !isUnsubscribed(unsubscribeIndex, {
      clientId: recipientId,
      email: email || info?.email,
    });
  });
  externalEmails = externalEmails.filter((email) => !isUnsubscribed(unsubscribeIndex, { email }));

  if (recipientIds.length === 0 && externalEmails.length === 0) {
    throw new ValidationError('All recipients are unsubscribed from communication');
  }

  let sent = 0;

  // Send to each client recipient (internal message + email)
  // Merge fields are resolved per-recipient via sendMessage
  for (const recipientId of recipientIds) {
    try {
      const recipientEmail = recipientEmailMap.get(recipientId);
      const recipientInfo = recipientInfoMap.get(recipientId);

      await sendMessage(adminUserId, {
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
