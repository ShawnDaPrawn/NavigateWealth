import { projectId } from '../../../../utils/supabase/info';

export const ENDPOINTS = {
  CLIENTS: 'communication/clients',
  GROUPS: 'communication/groups',
  TEMPLATES: 'communication/templates',
  CAMPAIGNS: 'communication/campaigns',
  UPLOAD: 'communication/upload',
  SEND_DIRECT: 'communication/send',
  INBOX: 'communication/inbox',
  EMAIL_FOOTER: 'communication/email-footer',
  LOGS: 'communication/logs',
  READ_MESSAGE: (id: string) => `communication/read/${id}`,
  GROUP_BY_ID: (id: string) => `communication/groups/${id}`,
  CAMPAIGN_SEND: (id: string) => `communication/campaigns/${id}/send`,
  MESSAGE_BY_ID: (id: string) => `communication/inbox/${id}`,
  CLIENT_LOGS: (clientId: string) => `clients/${clientId}/communication`,
} as const;

export const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379`;
