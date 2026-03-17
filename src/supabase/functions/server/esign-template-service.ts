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
  type: 'signature' | 'initials' | 'text' | 'date' | 'checkbox';
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
    return template || null;
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

export async function updateTemplate(
  templateId: string,
  updates: Partial<Omit<EsignTemplateRecord, 'id' | 'createdAt' | 'createdBy' | 'usageCount'>>
): Promise<EsignTemplateRecord | null> {
  const existing = await getTemplate(templateId);
  if (!existing) {
    log.warn(`Template not found for update: ${templateId}`);
    return null;
  }

  const updated: EsignTemplateRecord = {
    ...existing,
    ...updates,
    id: existing.id,
    createdAt: existing.createdAt,
    createdBy: existing.createdBy,
    usageCount: existing.usageCount,
    updatedAt: new Date().toISOString(),
  };

  await kv.set(EsignKeys.template(templateId), updated);
  log.success(`Template updated: "${updated.name}" (${templateId})`);
  return updated;
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