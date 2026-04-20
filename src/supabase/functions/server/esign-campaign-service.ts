/**
 * P4.7 — Bulk-send "campaign" service.
 *
 * Persists the campaign record + per-row status. Envelope dispatch is
 * driven from the client (it loops through rows, calls the standard
 * `/esign/envelopes/upload` and `/esign/envelopes/:id/invites`
 * endpoints, and reports each row's outcome back via
 * `recordCampaignRowResult`). This keeps a single code path for
 * envelope materialisation + invite sending — the campaign layer
 * just adds aggregation, retry tracking, and a kill-switch.
 */

import * as kv from "./kv_store.tsx";
import { EsignKeys } from "./esign-keys.ts";
import { createModuleLogger } from "./stderr-logger.ts";
import { getTemplate } from "./esign-template-service.ts";

const log = createModuleLogger('esign-campaign-service');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CampaignStatus = 'draft' | 'sending' | 'partial' | 'sent' | 'cancelled';

export interface CampaignRecipientResult {
  rowId: string;
  envelopeId: string | null;
  status: 'queued' | 'sent' | 'failed' | 'cancelled';
  errorMessage?: string;
  signers: Array<{ name: string; email: string; role?: string; order: number }>;
}

export interface CampaignRecord {
  id: string;
  firmId: string;
  templateId: string;
  templateVersion: number;
  title: string;
  message?: string;
  expiryDays: number;
  status: CampaignStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  results: CampaignRecipientResult[];
}

export interface CampaignRowInput {
  rowId?: string;
  signers: Array<{ name: string; email: string; role?: string; order?: number }>;
}

// ---------------------------------------------------------------------------
// Create + persist
// ---------------------------------------------------------------------------

export async function createCampaign(params: {
  firmId: string;
  templateId: string;
  title: string;
  message?: string;
  expiryDays?: number;
  createdBy: string;
  rows: CampaignRowInput[];
  templateVersion?: number;
}): Promise<{ campaign?: CampaignRecord; error?: string }> {
  const live = await getTemplate(params.templateId);
  if (!live) return { error: 'Template not found' };
  const pinnedVersion = params.templateVersion ?? live.version ?? 1;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const results: CampaignRecipientResult[] = params.rows.map((row, idx) => ({
    rowId: row.rowId || `${id}:${idx}`,
    envelopeId: null,
    status: 'queued',
    signers: row.signers.map((s, sidx) => ({
      name: s.name,
      email: s.email,
      role: s.role,
      order: s.order ?? sidx + 1,
    })),
  }));

  const campaign: CampaignRecord = {
    id,
    firmId: params.firmId,
    templateId: params.templateId,
    templateVersion: pinnedVersion,
    title: params.title,
    message: params.message,
    expiryDays: params.expiryDays ?? live.defaultExpiryDays ?? 30,
    status: 'sending',
    createdBy: params.createdBy,
    createdAt: now,
    updatedAt: now,
    totalRecipients: results.length,
    sentCount: 0,
    failedCount: 0,
    results,
  };

  await kv.set(EsignKeys.campaign(id), campaign);
  await indexAdd(id);

  return { campaign };
}

async function indexAdd(id: string): Promise<void> {
  try {
    const list = (await kv.get(EsignKeys.campaignsList())) as string[] | null;
    const next = Array.from(new Set([...(list ?? []), id]));
    await kv.set(EsignKeys.campaignsList(), next);
  } catch (err) {
    log.warn('Failed to update campaigns index', err);
  }
}

async function indexEnvelope(campaignId: string, envelopeId: string): Promise<void> {
  try {
    const list = (await kv.get(EsignKeys.campaignEnvelopes(campaignId))) as string[] | null;
    const next = Array.from(new Set([...(list ?? []), envelopeId]));
    await kv.set(EsignKeys.campaignEnvelopes(campaignId), next);
  } catch (err) {
    log.warn('Failed to update campaign envelopes index', err);
  }
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function getCampaign(id: string): Promise<CampaignRecord | null> {
  return ((await kv.get(EsignKeys.campaign(id))) as CampaignRecord | null) ?? null;
}

export async function listCampaigns(): Promise<CampaignRecord[]> {
  const ids = ((await kv.get(EsignKeys.campaignsList())) as string[] | null) ?? [];
  const results: CampaignRecord[] = [];
  for (const id of ids) {
    const c = await getCampaign(id);
    if (c) results.push(c);
  }
  results.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
  return results;
}

// ---------------------------------------------------------------------------
// Per-row status update — called by the frontend dispatcher after each
// row's envelope is materialised + invites sent (or fails).
// ---------------------------------------------------------------------------

export async function recordCampaignRowResult(
  campaignId: string,
  rowId: string,
  patch: { envelopeId?: string; status: CampaignRecipientResult['status']; errorMessage?: string },
): Promise<{ campaign?: CampaignRecord; error?: string }> {
  const campaign = await getCampaign(campaignId);
  if (!campaign) return { error: 'Campaign not found' };
  if (campaign.status === 'cancelled') return { campaign };

  const idx = campaign.results.findIndex(r => r.rowId === rowId);
  if (idx < 0) return { error: 'Row not found' };

  const previous = campaign.results[idx];
  // Re-tally counters based on the transition so retries don't
  // double-count.
  if (previous.status === 'sent') campaign.sentCount = Math.max(0, campaign.sentCount - 1);
  if (previous.status === 'failed') campaign.failedCount = Math.max(0, campaign.failedCount - 1);

  campaign.results[idx] = {
    ...previous,
    envelopeId: patch.envelopeId ?? previous.envelopeId,
    status: patch.status,
    errorMessage: patch.errorMessage,
  };

  if (patch.status === 'sent') campaign.sentCount += 1;
  if (patch.status === 'failed') campaign.failedCount += 1;
  if (patch.envelopeId) await indexEnvelope(campaign.id, patch.envelopeId);

  // Roll up overall status.
  const remaining = campaign.results.filter(r => r.status === 'queued').length;
  if (remaining === 0) {
    if (campaign.failedCount === 0) campaign.status = 'sent';
    else if (campaign.sentCount > 0) campaign.status = 'partial';
    else campaign.status = 'cancelled';
  }
  campaign.updatedAt = new Date().toISOString();
  await kv.set(EsignKeys.campaign(campaign.id), campaign);
  return { campaign };
}

// ---------------------------------------------------------------------------
// Cancel (kill-switch). Marks queued rows as cancelled but leaves
// already-sent envelopes alone — the sender can void them
// individually from the dashboard.
// ---------------------------------------------------------------------------

export async function cancelCampaign(id: string): Promise<{ campaign?: CampaignRecord; error?: string }> {
  const campaign = await getCampaign(id);
  if (!campaign) return { error: 'Campaign not found' };
  if (campaign.status === 'sent' || campaign.status === 'cancelled') {
    return { campaign };
  }
  for (const row of campaign.results) {
    if (row.status === 'queued') row.status = 'cancelled';
  }
  campaign.status = 'cancelled';
  campaign.updatedAt = new Date().toISOString();
  await kv.set(EsignKeys.campaign(id), campaign);
  return { campaign };
}

// ---------------------------------------------------------------------------
// CSV parsing (stand-alone — no third-party dep)
// ---------------------------------------------------------------------------

/**
 * Tiny RFC-4180 CSV parser. Supports quoted fields, escaped quotes,
 * CRLF/LF line endings, and a mandatory header row. Does NOT handle
 * multi-line quoted cells (rare in real-world recipient lists).
 */
export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter(l => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const splitLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          cur += ch;
        }
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === ',') {
          out.push(cur);
          cur = '';
        } else cur += ch;
      }
    }
    out.push(cur);
    return out.map(s => s.trim());
  };
  const headers = splitLine(lines[0]).map(h => h.trim().toLowerCase());
  const rows = lines.slice(1).map(splitLine);
  return { headers, rows };
}

/**
 * Map a parsed CSV into per-row signer arrays for a given template.
 * Recognised column shapes (case-insensitive):
 *   • `email`, `name`, `role` — single-recipient template
 *   • `email_1`, `name_1`, `role_1`, `email_2`, ... — multi-recipient
 *   • `<recipientName>_email`, `<recipientName>_name` — keyed by the
 *     template's recipient labels (preferred for clarity)
 */
export function mapCsvToRows(
  headers: string[],
  rows: string[][],
  template: { recipients: Array<{ name: string; email: string; role?: string; order: number }> },
): { rows: CampaignRowInput[]; warnings: string[] } {
  const warnings: string[] = [];
  const recipientCount = template.recipients.length;
  const out: CampaignRowInput[] = [];

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const cell = (key: string): string | undefined => {
      const idx = headers.indexOf(key.toLowerCase());
      if (idx < 0) return undefined;
      return row[idx]?.trim();
    };

    const signers: Array<{ name: string; email: string; role?: string; order?: number }> = [];

    for (let i = 0; i < recipientCount; i++) {
      const tplR = template.recipients[i];
      const labelKey = (tplR.name || `recipient_${i + 1}`).toLowerCase().replace(/\s+/g, '_');
      const indexedEmail = i === 0 && recipientCount === 1
        ? cell('email')
        : cell(`email_${i + 1}`);
      const labelEmail = cell(`${labelKey}_email`);
      const indexedName = i === 0 && recipientCount === 1
        ? cell('name')
        : cell(`name_${i + 1}`);
      const labelName = cell(`${labelKey}_name`);
      const indexedRole = i === 0 && recipientCount === 1
        ? cell('role')
        : cell(`role_${i + 1}`);

      const email = labelEmail || indexedEmail || '';
      const name = labelName || indexedName || tplR.name || '';
      const role = indexedRole || tplR.role;

      if (!email) {
        warnings.push(`Row ${r + 1}: missing email for recipient slot ${i + 1}`);
      }
      signers.push({ email, name, role, order: i + 1 });
    }

    out.push({ rowId: `row-${r + 1}`, signers });
  }

  return { rows: out, warnings };
}
