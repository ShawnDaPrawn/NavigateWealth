/**
 * E-Signature Template Service
 * CRUD operations for reusable envelope templates stored in KV.
 * Templates capture recipient configurations, field layouts, signing mode,
 * and message — enabling rapid envelope creation from saved patterns.
 */

import * as kv from "./kv_store.tsx";
import { EsignKeys } from "./esign-keys.ts";
import { createModuleLogger } from "./stderr-logger.ts";

const log = createModuleLogger('esign-template-service');

// ============================================================================
// TYPES
// ============================================================================

export interface TemplateRecipient {
  name: string;
  email: string;
  role?: string;
  order: number;
  otpRequired: boolean;
}

export interface TemplateField {
  type: 'signature' | 'initials' | 'text' | 'date' | 'checkbox' | 'attachment';
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  /** Index into the recipients array (not a specific signer ID) */
  recipientIndex: number;
  metadata?: Record<string, unknown>;
}

export interface EsignTemplateRecord {
  id: string;
  name: string;
  description?: string;
  category?: string;
  signingMode: 'sequential' | 'parallel';
  defaultMessage?: string;
  defaultExpiryDays: number;
  recipients: TemplateRecipient[];
  fields: TemplateField[];
  /** Number of times this template has been used to create envelopes */
  usageCount: number;
  /**
   * P4.2 — Monotonically increasing template version. Starts at 1 on
   * create. Every `updateTemplate` snapshots the outgoing record into
   * the history index (`templateVersion(id, prevVersion)`) and bumps
   * this number. Envelopes pin their `template_version` so the exact
   * snapshot stays retrievable even after later edits.
   */
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// CREATE
// ============================================================================

export async function createTemplate(params: {
  name: string;
  description?: string;
  category?: string;
  signingMode?: 'sequential' | 'parallel';
  defaultMessage?: string;
  defaultExpiryDays?: number;
  recipients?: TemplateRecipient[];
  fields?: TemplateField[];
  createdBy: string;
}): Promise<EsignTemplateRecord> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const template: EsignTemplateRecord = {
    id,
    name: params.name.trim(),
    description: params.description?.trim(),
    category: params.category?.trim(),
    signingMode: params.signingMode || 'sequential',
    defaultMessage: params.defaultMessage?.trim(),
    defaultExpiryDays: params.defaultExpiryDays || 30,
    recipients: params.recipients || [],
    fields: params.fields || [],
    usageCount: 0,
    version: 1,
    createdBy: params.createdBy,
    createdAt: now,
    updatedAt: now,
  };

  // Store template record
  await kv.set(EsignKeys.template(id), template);

  // Add to templates list index
  const listKey = EsignKeys.templatesList();
  const templateIds: string[] = (await kv.get(listKey)) || [];
  templateIds.push(id);
  await kv.set(listKey, templateIds);

  log.success(`Template created: "${template.name}" (${id})`);
  return template;
}

// ============================================================================
// READ
// ============================================================================

export async function getTemplate(templateId: string): Promise<EsignTemplateRecord | null> {
  try {
    const template = await kv.get(EsignKeys.template(templateId));
    if (!template) return null;
    // Defensive backfill so callers can rely on `version` always
    // being set without a separate migration script.
    if (typeof (template as EsignTemplateRecord).version !== 'number') {
      (template as EsignTemplateRecord).version = 1;
    }
    return template as EsignTemplateRecord;
  } catch (error) {
    log.error(`Failed to get template ${templateId}:`, error);
    return null;
  }
}

export async function listTemplates(): Promise<EsignTemplateRecord[]> {
  try {
    const listKey = EsignKeys.templatesList();
    const templateIds: string[] = (await kv.get(listKey)) || [];

    if (templateIds.length === 0) return [];

    const templates = await Promise.all(
      templateIds.map((id: string) => kv.get(EsignKeys.template(id)))
    );

    // Filter out deleted/null templates and sort by newest first
    return templates
      .filter(Boolean)
      .sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
        new Date(String(b.created_at || 0)).getTime() - new Date(String(a.created_at || 0)).getTime()
      );
  } catch (error) {
    log.error('Failed to list templates:', error);
    return [];
  }
}

// ============================================================================
// UPDATE
// ============================================================================

/**
 * Substantive fields that, when changed, should bump the version. Pure
 * metadata (description, category) doesn't justify a version bump and
 * stays on the live record. Definition tracks the surface that
 * envelopes rely on for legal/structural reproducibility.
 */
const VERSIONED_KEYS = [
  'signingMode',
  'recipients',
  'fields',
  'defaultExpiryDays',
] as const;

function shouldBumpVersion(
  prev: EsignTemplateRecord,
  next: Partial<EsignTemplateRecord>,
): boolean {
  for (const key of VERSIONED_KEYS) {
    if (next[key] === undefined) continue;
    if (JSON.stringify(prev[key]) !== JSON.stringify(next[key])) return true;
  }
  return false;
}

export async function updateTemplate(
  templateId: string,
  updates: Partial<Omit<EsignTemplateRecord, 'id' | 'createdAt' | 'createdBy' | 'usageCount' | 'version'>>
): Promise<EsignTemplateRecord | null> {
  const existing = await getTemplate(templateId);
  if (!existing) {
    log.warn(`Template not found for update: ${templateId}`);
    return null;
  }

  const bump = shouldBumpVersion(existing, updates as Partial<EsignTemplateRecord>);
  if (bump) {
    // Snapshot the outgoing record under its current version before
    // any mutation so envelopes pinned to that version can replay it.
    try {
      await kv.set(EsignKeys.templateVersion(templateId, existing.version ?? 1), existing);
      const idxKey = EsignKeys.templateVersionsIndex(templateId);
      const idx = ((await kv.get(idxKey)) as number[] | null) ?? [];
      const v = existing.version ?? 1;
      if (!idx.includes(v)) idx.push(v);
      await kv.set(idxKey, idx);
    } catch (err) {
      log.warn(`Failed to snapshot template ${templateId} v${existing.version}:`, err);
    }
  }

  const updated: EsignTemplateRecord = {
    ...existing,
    ...updates,
    id: existing.id,
    createdAt: existing.createdAt,
    createdBy: existing.createdBy,
    usageCount: existing.usageCount,
    version: bump ? (existing.version ?? 1) + 1 : (existing.version ?? 1),
    updatedAt: new Date().toISOString(),
  };

  await kv.set(EsignKeys.template(templateId), updated);
  log.success(
    `Template updated: "${updated.name}" (${templateId}) v${existing.version ?? 1}${bump ? ` \u2192 v${updated.version}` : ' (no version bump)'}`,
  );
  return updated;
}

/**
 * P4.2 — Retrieve a specific historical version of a template. Returns
 * the live record when `version === template.version`, otherwise looks
 * up the snapshot. Returns null if neither exists.
 */
export async function getTemplateVersion(
  templateId: string,
  version: number,
): Promise<EsignTemplateRecord | null> {
  const live = await getTemplate(templateId);
  if (live && (live.version ?? 1) === version) return live;
  try {
    const snap = await kv.get(EsignKeys.templateVersion(templateId, version));
    return (snap as EsignTemplateRecord | null) ?? null;
  } catch (err) {
    log.error(`Failed to load template ${templateId} v${version}:`, err);
    return null;
  }
}

/** P4.2 — list available historical versions for a template. */
export async function listTemplateVersions(
  templateId: string,
): Promise<{ version: number; isLive: boolean; record: EsignTemplateRecord | null }[]> {
  const live = await getTemplate(templateId);
  const idxKey = EsignKeys.templateVersionsIndex(templateId);
  const idx = ((await kv.get(idxKey)) as number[] | null) ?? [];
  const versions = new Set<number>(idx);
  if (live) versions.add(live.version ?? 1);
  const ordered = Array.from(versions).sort((a, b) => a - b);
  const records = await Promise.all(
    ordered.map(async (v) => ({
      version: v,
      isLive: !!live && (live.version ?? 1) === v,
      record: await getTemplateVersion(templateId, v),
    })),
  );
  return records;
}

/**
 * Increment usage count when a template is used to create an envelope
 */
export async function incrementUsageCount(templateId: string): Promise<void> {
  const existing = await getTemplate(templateId);
  if (!existing) return;

  existing.usageCount = (existing.usageCount || 0) + 1;
  existing.updatedAt = new Date().toISOString();
  await kv.set(EsignKeys.template(templateId), existing);
}

// ============================================================================
// DELETE
// ============================================================================

export async function deleteTemplate(templateId: string): Promise<boolean> {
  try {
    const existing = await getTemplate(templateId);
    if (!existing) return false;

    // Remove from KV
    await kv.del(EsignKeys.template(templateId));

    // Remove from list index
    const listKey = EsignKeys.templatesList();
    const templateIds: string[] = (await kv.get(listKey)) || [];
    const filtered = templateIds.filter((id: string) => id !== templateId);
    await kv.set(listKey, filtered);

    log.success(`Template deleted: "${existing.name}" (${templateId})`);
    return true;
  } catch (error) {
    log.error(`Failed to delete template ${templateId}:`, error);
    return false;
  }
}

// ============================================================================
// SAVE FROM ENVELOPE
// ============================================================================

/**
 * Create a template from an existing envelope's configuration.
 * Extracts recipients (generalised — emails kept as defaults but editable),
 * fields (mapped to recipient indices), signing mode, and message.
 */
export async function createTemplateFromEnvelope(params: {
  envelopeId: string;
  name: string;
  description?: string;
  category?: string;
  createdBy: string;
}): Promise<EsignTemplateRecord | null> {
  try {
    // Fetch envelope
    const envelope = await kv.get(EsignKeys.envelope(params.envelopeId));
    if (!envelope) {
      log.error(`Envelope not found: ${params.envelopeId}`);
      return null;
    }

    // Fetch signers
    const signerIds: string[] = (await kv.get(EsignKeys.envelopeSigners(params.envelopeId))) || [];
    const signers = (
      await Promise.all(signerIds.map((id: string) => kv.get(EsignKeys.PREFIX_SIGNER + id)))
    ).filter(Boolean) as EsignSigner[];

    // Build signer index map: signer.id -> index
    const signerIndexMap = new Map<string, number>();
    signers.forEach((s: EsignSigner, i: number) => {
      signerIndexMap.set(s.id, i);
    });

    // Fetch fields
    const rawFieldList = (await kv.get(EsignKeys.envelopeFields(params.envelopeId))) || [];
    let fieldObjects: EsignField[] = [];

    if (Array.isArray(rawFieldList)) {
      const fieldIds = rawFieldList.filter((item: unknown) => typeof item === 'string') as string[];
      const legacyFields = rawFieldList.filter(
        (item: unknown) => typeof item === 'object' && item !== null && (item as EsignField).id
      ) as EsignField[];
      const fetched = await Promise.all(
        fieldIds.map((id: string) => kv.get(EsignKeys.field(id)))
      );
      fieldObjects = [...fetched.filter(Boolean), ...legacyFields];
    }

    // Map to template recipients
    const templateRecipients: TemplateRecipient[] = signers.map((s: EsignSigner, i: number) => ({
      name: s.name || '',
      email: s.email || '',
      role: s.role || '',
      order: s.order ?? i + 1,
      otpRequired: s.otp_required ?? false,
    }));

    // Map to template fields (replace signer_id with recipientIndex)
    const templateFields: TemplateField[] = fieldObjects.map((f: EsignField) => {
      const recipientIndex = f.signer_id ? (signerIndexMap.get(f.signer_id) ?? 0) : 0;
      return {
        type: f.type,
        page: f.page,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
        required: f.required ?? true,
        recipientIndex,
        metadata: f.metadata,
      };
    });

    return await createTemplate({
      name: params.name,
      description: params.description,
      category: params.category,
      signingMode: envelope.signing_mode || 'sequential',
      defaultMessage: envelope.message || undefined,
      defaultExpiryDays: 30,
      recipients: templateRecipients,
      fields: templateFields,
      createdBy: params.createdBy,
    });
  } catch (error) {
    log.error('Failed to create template from envelope:', error);
    return null;
  }
}