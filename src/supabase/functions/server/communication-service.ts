/**
 * Communication Module - Service Layer
 *
 * Consolidates communication functionality from:
 * - communication-service.ts (business logic)
 * - communication-repo.ts (data access)
 * - communication-validation.ts (validation)
 */

import {
  deleteCommunicationLog,
  deleteMessage,
  getAllClients,
  getHistory,
  getInbox,
  markAsRead,
  sendDirectMessage,
  sendMessage,
} from './communication-messaging.ts';
import {
  _prependSystemGroup,
  createGroup,
  deleteGroup,
  getAllGroups,
  syncNewsletterSubscribersFromGroupUpdate,
  updateGroup,
} from './communication-groups.ts';
import {
  createTemplate,
  deleteTemplate,
  getAllTemplates,
  getFooterSettings,
  getTemplateById,
  saveFooterSettings,
  updateTemplate,
} from './communication-templates.ts';
import {
  buildSenderOptions,
  createCampaign,
  enrichCampaignsWithCreatorNames,
  getAllCampaigns,
  listAllCampaignsWithCreatorNames,
  listCampaigns,
  listCampaignsFiltered,
  sendCampaign,
} from './communication-campaigns.ts';
import {
  listUnsubscribed,
  unsubscribeContact,
  resubscribeContact,
} from './communication-unsubscribes.ts';
import { uploadFile } from './communication-attachments.ts';

export type { CampaignSenderOption } from './communication-campaigns.ts';

export class CommunicationService {
  // implementations in communication-messaging.ts
  deleteCommunicationLog = deleteCommunicationLog;
  deleteMessage = deleteMessage;
  getAllClients = getAllClients;
  getHistory = getHistory;
  getInbox = getInbox;
  markAsRead = markAsRead;
  sendDirectMessage = sendDirectMessage;
  sendMessage = sendMessage;

  // implementations in communication-groups.ts
  createGroup = createGroup;
  deleteGroup = deleteGroup;
  getAllGroups = getAllGroups;
  syncNewsletterSubscribersFromGroupUpdate = syncNewsletterSubscribersFromGroupUpdate;
  updateGroup = updateGroup;

  // implementations in communication-templates.ts
  createTemplate = createTemplate;
  deleteTemplate = deleteTemplate;
  getAllTemplates = getAllTemplates;
  getFooterSettings = getFooterSettings;
  getTemplateById = getTemplateById;
  saveFooterSettings = saveFooterSettings;
  updateTemplate = updateTemplate;

  // implementations in communication-campaigns.ts
  buildSenderOptions = buildSenderOptions;
  createCampaign = createCampaign;
  enrichCampaignsWithCreatorNames = enrichCampaignsWithCreatorNames;
  getAllCampaigns = getAllCampaigns;
  listAllCampaignsWithCreatorNames = listAllCampaignsWithCreatorNames;
  listCampaigns = listCampaigns;
  listCampaignsFiltered = listCampaignsFiltered;
  sendCampaign = sendCampaign;

  // implementations in communication-unsubscribes.ts
  listUnsubscribed = listUnsubscribed;
  unsubscribeContact = unsubscribeContact;
  resubscribeContact = resubscribeContact;

  // implementations in communication-attachments.ts
  uploadFile = uploadFile;
}

import { processScheduledCampaigns as processScheduledCampaignsImpl } from './communication-business-logic.ts';

export async function processScheduledCampaigns() {
  return await processScheduledCampaignsImpl();
}
