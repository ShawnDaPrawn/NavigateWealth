/** Tabs, Manage tools and figures for the E-Signature home. */
import type { EsignEnvelope } from '../types';
import { EXPIRING_SOON_DAYS } from '../constants';

export const ESIGN_TABS = ['envelopes', 'templates', 'metrics', 'manage'] as const;
export type EsignTab = (typeof ESIGN_TABS)[number];

export const MANAGE_TOOLS = [
  'notifications',
  'webhooks',
  'packets',
  'recovery',
  'audit',
  'retention',
  'branding',
] as const;
export type ManageTool = (typeof MANAGE_TOOLS)[number];

/** Which Manage tools this person may use. */
export type ManageAccess = Record<ManageTool, boolean>;

const PENDING = ['sent', 'viewed', 'partially_signed'];

/** The figures in the stat cards. */
export function computeEnvelopeMetrics(envelopes: EsignEnvelope[], now: Date) {
  const soonThreshold = new Date(now.getTime() + EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000);
  const total = envelopes.length;
  const completed = envelopes.filter((e) => e.status === 'completed').length;
  const draft = envelopes.filter((e) => e.status === 'draft').length;
  const sent = total - draft;
  return {
    total,
    completed,
    draft,
    pending: envelopes.filter((e) => PENDING.includes(e.status)).length,
    expired: envelopes.filter((e) => e.status === 'expired').length,
    expiringSoon: envelopes.filter((e) => {
      if (!PENDING.includes(e.status) || !e.expires_at) return false;
      const expDate = new Date(e.expires_at);
      return expDate > now && expDate <= soonThreshold;
    }).length,
    completionRate: sent > 0 ? Math.round((completed / sent) * 100) : 0,
  };
}
