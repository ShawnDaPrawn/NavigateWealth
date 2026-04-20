/**
 * E-Signature Business Logic Services (KV Store Version)
 * Core business logic for envelope operations using Key-Value store
 */

import * as kv from "./kv_store.tsx";
import { EsignKeys } from "./esign-keys.ts";
import type { 
  EsignDocument, 
  EsignEnvelope, 
  EsignSigner, 
  EsignField, 
  EsignAuditEvent 
} from "./esign-types.ts";
import { createModuleLogger } from "./stderr-logger.ts";
import { getErrMsg } from "./shared-logger-utils.ts";
import { esignPgRepo } from "./esign-postgres-repo.ts";

const log = createModuleLogger('esign-services');

// ==================== AUDIT EVENT LOGGING ====================

/**
 * Log audit event
 */
export async function logAuditEvent(data: {
  envelopeId: string;
  // P2.5 2.8 — admit 'witness' so the signer/sign and signer/reject routes
  // can mark events with a witness footprint when the signer is a witness.
  actorType: 'system' | 'sender_user' | 'signer' | 'witness';
  actorId?: string;
  action: string;
  ip?: string;
  userAgent?: string;
  email?: string;
  phone?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const auditId = crypto.randomUUID();
    const auditEvent: EsignAuditEvent = {
      id: auditId,
      envelope_id: data.envelopeId,
      actor_type: data.actorType,
      actor_id: data.actorId,
      action: data.action,
      at: new Date().toISOString(),
      ip: data.ip,
      user_agent: data.userAgent,
      email: data.email,
      phone: data.phone,
      metadata: data.metadata || {},
    };

    // Store audit event (canonical write)
    await kv.set(EsignKeys.PREFIX_AUDIT + auditId, auditEvent);

    // Add to envelope's audit trail
    const auditKey = EsignKeys.envelopeAudit(data.envelopeId);
    const auditIds = await kv.get(auditKey) || [];
    auditIds.push(auditId);
    await kv.set(auditKey, auditIds);

    // Phase 0.1 — shadow write to Postgres (no-op unless ESIGN_DUAL_WRITE=true).
    // Failures here are logged-and-swallowed by the repo helper; the KV
    // write above is canonical so audit data is never lost.
    void esignPgRepo.insertAudit({
      envelope_id: data.envelopeId,
      actor_type: data.actorType,
      actor_id: data.actorId ?? null,
      email: data.email ?? null,
      action: data.action,
      ip: data.ip ?? null,
      user_agent: data.userAgent ?? null,
      metadata: data.metadata ?? {},
      occurred_at: auditEvent.at,
    });

    log.success(`Audit event logged: ${data.action} for envelope ${data.envelopeId}`);
  } catch (error) {
    log.error('Failed to log audit event:', error);
    // Non-critical, don't throw
  }
}

// ==================== ENVELOPE OPERATIONS ====================

/**
 * Create a new envelope
 */
export async function createEnvelope(params: {
  firmId: string;
  clientId: string;
  title: string;
  documentId: string;
  createdByUserId: string;
  adviceCaseId?: string;
  requestId?: string;
  productId?: string;
  signers: Array<{ name: string; email: string; phone?: string; role?: string; requiresOtp?: boolean; accessCode?: string; clientId?: string }>;
  message?: string;
  expiryDays?: number;
  signingMode?: 'sequential' | 'parallel';
  /** P4.1 / P4.2 — When the envelope is materialised from a saved
   *  template, persist the template id and the exact version that was
   *  in effect so subsequent edits to the template do not retroactively
   *  rewrite the envelope's structure. */
  templateId?: string;
  templateVersion?: number;
  /** P4.7 / P4.8 — bulk-send and packet provenance. Stamped at create
   *  time so the dashboard can group envelopes by campaign/packet run. */
  campaignId?: string;
  packetRunId?: string;
  packetStepIndex?: number;
  /** P6.4 — pin the ECTA consent text version that will be shown to
   *  every signer of this envelope. Stamped at create-time so
   *  subsequent revisions to the active consent text do not mutate
   *  historical envelopes. */
  consentVersion?: string;
  /** P6.5 — optional signing reason/capacity prompt. When present the
   *  signer UI surfaces a read-only capacity block and records the
   *  acknowledgement on the signer record. */
  signingReasonRequired?: boolean;
  signingReasonPrompt?: string;
  /** P6.6 — gate the envelope on a KBA check. `kbaProvider` selects the
   *  adapter at runtime; omitted → uses KBA_PROVIDER env. */
  kbaRequired?: boolean;
  kbaProvider?: string;
}): Promise<{ envelopeId?: string; error?: string }> {
  try {
    const envelopeId = crypto.randomUUID();
    const now = new Date().toISOString();
    
    // Calculate expiry date (default 30 days)
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + (params.expiryDays || 30));

    const envelope: EsignEnvelope = {
      id: envelopeId,
      firm_id: params.firmId,
      client_id: params.clientId,
      title: params.title,
      document_id: params.documentId,
      status: 'draft',
      message: params.message,
      signing_mode: params.signingMode || 'sequential',
      created_by_user_id: params.createdByUserId,
      created_at: now,
      updated_at: now,
      expires_at: expiryDate.toISOString(),
      advice_case_id: params.adviceCaseId,
      request_id: params.requestId,
      product_id: params.productId,
      template_id: params.templateId,
      template_version: params.templateVersion,
      campaign_id: params.campaignId,
      packet_run_id: params.packetRunId,
      packet_step_index: params.packetStepIndex,
      consent_version: params.consentVersion,
      signing_reason_required: params.signingReasonRequired,
      signing_reason_prompt: params.signingReasonPrompt,
      kba_required: params.kbaRequired,
      kba_provider: params.kbaProvider,
    } as EsignEnvelope;

    // Store envelope (canonical write)
    await kv.set(EsignKeys.envelope(envelopeId), envelope);

    // Phase 0.1 — shadow write to Postgres (no-op unless ESIGN_DUAL_WRITE=true).
    void esignPgRepo.upsertEnvelope({
      id: envelopeId,
      firm_id: params.firmId,
      created_by: params.createdByUserId,
      title: params.title,
      message: params.message ?? null,
      status: 'draft',
      signing_mode: envelope.signing_mode,
      expires_at: envelope.expires_at,
      metadata: {
        client_id: params.clientId,
        document_id: params.documentId,
        advice_case_id: params.adviceCaseId,
        request_id: params.requestId,
        product_id: params.productId,
      },
      created_at: now,
      updated_at: now,
    });

    // Add to client's envelope list
    const clientListKey = EsignKeys.clientEnvelopes(params.clientId);
    const clientEnvelopes = await kv.get(clientListKey) || [];
    clientEnvelopes.push(envelopeId);
    await kv.set(clientListKey, clientEnvelopes);

    // Initialize empty arrays for signers, fields, and audits
    await kv.set(EsignKeys.envelopeSigners(envelopeId), []);
    await kv.set(EsignKeys.envelopeFields(envelopeId), []);
    await kv.set(EsignKeys.envelopeAudit(envelopeId), []);

    // Log audit event
    await logAuditEvent({
      envelopeId,
      actorType: 'sender_user',
      actorId: params.createdByUserId,
      action: 'envelope_created',
      metadata: { title: params.title },
    });

    return { envelopeId };
  } catch (error: unknown) {
    log.error('Failed to create envelope:', error);
    return { error: getErrMsg(error) };
  }
}

/**
 * Get envelope with full details (signers, fields, document)
 */
export async function getEnvelopeDetails(envelopeId: string): Promise<Record<string, unknown> | null> {
  try {
    // Fetch envelope
    const envelope = await kv.get(EsignKeys.envelope(envelopeId));
    if (!envelope) {
      return null;
    }

    // Fetch document
    const document = await kv.get(EsignKeys.PREFIX_DOCUMENT + envelope.document_id);

    // Fetch signers — guard against corrupt non-array KV values
    const rawSignerIds = await kv.get(EsignKeys.envelopeSigners(envelopeId));
    const signerIds = Array.isArray(rawSignerIds) ? rawSignerIds : [];
    const signers = await Promise.all(
      signerIds.map((id: string) => kv.get(EsignKeys.PREFIX_SIGNER + id))
    );

    // Fetch fields — guard against corrupt non-array KV values
    const rawFieldListRaw = await kv.get(EsignKeys.envelopeFields(envelopeId));
    const rawFieldList = Array.isArray(rawFieldListRaw) ? rawFieldListRaw : [];
    
    // Handle legacy/corrupt data where fields might be stored directly in the list
    let validFieldIds: string[] = [];
    let legacyFields: EsignField[] = [];
    
    if (Array.isArray(rawFieldList)) {
      validFieldIds = rawFieldList.filter((item: unknown) => typeof item === 'string') as string[];
      legacyFields = rawFieldList.filter((item: unknown) => typeof item === 'object' && item !== null && (item as EsignField).id) as EsignField[];
    }

    const fetchedFields = await Promise.all(
      validFieldIds.map((id: string) => kv.get(EsignKeys.field(id)))
    );

    const allFields = [...fetchedFields.filter(Boolean), ...legacyFields];

    return {
      ...envelope,
      document,
      signers: signers.filter(Boolean),
      fields: allFields,
    };
  } catch (error: unknown) {
    log.error('Failed to get envelope details:', error);
    throw error;
  }
}

/**
 * Get all envelopes for a client.
 *
 * Sources (merged & deduplicated):
 *  1. esign:client:{clientId}:envelopes — explicit client_id linkage
 *  2. esign:signer-email:{email}:envelopes — signer-email index (catches
 *     envelopes sent from the standalone E-Sign page where the client was
 *     added as a signer without an explicit client_id link)
 */
export async function getClientEnvelopes(clientId: string, clientEmail?: string): Promise<EsignEnvelope[]> {
  try {
    // Source 1: envelopes explicitly linked to this client_id
    const rawEnvelopeIds = await kv.get(EsignKeys.clientEnvelopes(clientId));
    const clientLinkedIds: string[] = Array.isArray(rawEnvelopeIds) ? rawEnvelopeIds : [];

    // Source 2: envelopes where the client's email appears as a signer
    let emailLinkedIds: string[] = [];
    if (clientEmail) {
      const rawEmailIds = await kv.get(EsignKeys.signerEmailEnvelopes(clientEmail));
      emailLinkedIds = Array.isArray(rawEmailIds) ? rawEmailIds : [];
    }

    // Merge & deduplicate
    const envelopeIdSet = new Set([...clientLinkedIds, ...emailLinkedIds]);
    const envelopeIds = Array.from(envelopeIdSet);

    const envelopes = await Promise.all(
      envelopeIds.map(async (envelopeId: string) => {
        const envelope = await kv.get(EsignKeys.envelope(envelopeId));
        if (!envelope) return null;
        // P6.8 — hide soft-deleted envelopes from client-facing lists.
        if ((envelope as { deleted_at?: string }).deleted_at) return null;

        // Get document details
        const document = await kv.get(EsignKeys.PREFIX_DOCUMENT + envelope.document_id);

        // Get signers — guard against corrupt KV values
        const rawSignerIds = await kv.get(EsignKeys.envelopeSigners(envelopeId));
        const signerIds = Array.isArray(rawSignerIds) ? rawSignerIds : [];
        const signers = await Promise.all(
          signerIds.map((id: string) => kv.get(EsignKeys.PREFIX_SIGNER + id))
        );

        // Get fields — guard against corrupt KV values
        const rawFieldIds = await kv.get(EsignKeys.envelopeFields(envelopeId));
        const fieldIds = Array.isArray(rawFieldIds) ? rawFieldIds : [];
        
        let validFieldIds: string[] = fieldIds.filter((item: unknown) => typeof item === 'string') as string[];
        
        const fields = await Promise.all(
          validFieldIds.map((id: string) => kv.get(EsignKeys.field(id)))
        );

        // Calculate counts
        const totalSigners = signers.filter(Boolean).length;
        const signedCount = signers.filter((s: EsignSigner) => s && s.status === 'signed').length;

        // Get recent audit events
        const auditIds = await kv.get(EsignKeys.envelopeAudit(envelopeId)) || [];
        const recentAuditIds = auditIds.slice(-5); // Last 5 events
        const auditEvents = await Promise.all(
          recentAuditIds.map((id: string) => kv.get(EsignKeys.PREFIX_AUDIT + id))
        );

        return {
          ...envelope,
          document,
          signers: signers.filter(Boolean),
          fields: fields.filter(Boolean),
          totalSigners,
          signedCount,
          audit_events: auditEvents.filter(Boolean),
        };
      })
    );

    return envelopes.filter(Boolean).sort((a: EsignEnvelope, b: EsignEnvelope) => 
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
  } catch (error: unknown) {
    log.error('Failed to get client envelopes:', error);
    throw error;
  }
}

/**
 * Get all envelopes (admin only)
 */
export async function getAllEnvelopes(status?: string): Promise<Record<string, unknown>[]> {
  try {
    // Get all values with prefix esign:envelope:
    const allValues = await kv.getByPrefix(EsignKeys.PREFIX_ENVELOPE);
    
    // Filter for actual envelope objects (not signers/fields/audits arrays)
    // Envelopes are objects with specific properties like document_id and status
    const envelopes = allValues.filter((item: Record<string, unknown>) => 
      item && 
      typeof item === 'object' &&
      !Array.isArray(item) &&
      item.id && 
      item.status && 
      item.document_id
    );

    // P6.8 — exclude soft-deleted envelopes from the default listing.
    // The recovery-bin route is the only caller that should see them.
    let filtered = envelopes.filter((e: Record<string, unknown>) => !e.deleted_at);
    if (status) {
      filtered = filtered.filter((e: EsignEnvelope) => e.status === status);
    }
    
    // Enrich with signers/recipients and document info for display in list
    const enrichedEnvelopes = await Promise.all(
      filtered.map(async (envelope: EsignEnvelope) => {
        // Fetch signers — guard against corrupt KV values
        const rawSIds = await kv.get(EsignKeys.envelopeSigners(envelope.id));
        const signerIds = Array.isArray(rawSIds) ? rawSIds : [];
        const signers = await Promise.all(
          signerIds.map((id: string) => kv.get(EsignKeys.PREFIX_SIGNER + id))
        );
        const validSigners = signers.filter(Boolean);

        // Fetch document
        const document = envelope.document_id 
          ? await kv.get(EsignKeys.PREFIX_DOCUMENT + envelope.document_id) 
          : null;

        // Fetch recent audit events (last 10 for display) — guard against corrupt KV values
        const rawAIds = await kv.get(EsignKeys.envelopeAudit(envelope.id));
        const auditIds = Array.isArray(rawAIds) ? rawAIds : [];
        const recentAuditIds = auditIds.slice(-10);
        const auditEvents = await Promise.all(
          recentAuditIds.map((id: string) => kv.get(EsignKeys.PREFIX_AUDIT + id))
        );
        
        return {
          ...envelope,
          document,
          signers: validSigners,
          recipients: validSigners.map((s: EsignSigner) => ({
            id: s.id,
            name: s.name,
            email: s.email,
            status: s.status,
            role: s.role,
            signed_at: s.signed_at,
            otp_required: s.requires_otp,
          })),
          audit_events: auditEvents.filter(Boolean),
          totalSigners: validSigners.length,
          signedCount: validSigners.filter((s: EsignSigner) => s.status === 'signed').length,
          createdAt: envelope.created_at,
          updatedAt: envelope.updated_at
        };
      })
    );

    return enrichedEnvelopes.sort((a: Record<string, unknown>, b: Record<string, unknown>) => 
      new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime()
    );
  } catch (error: unknown) {
    log.error('Failed to get all envelopes:', error);
    return [];
  }
}

/**
 * Update envelope status
 */
export async function updateEnvelopeStatus(
  envelopeId: string,
  status: EsignEnvelope['status'],
  additionalFields?: Partial<EsignEnvelope>
): Promise<void> {
  try {
    const envelope = await kv.get(EsignKeys.envelope(envelopeId));
    if (!envelope) {
      throw new Error('Envelope not found');
    }

    const updated = {
      ...envelope,
      status,
      updated_at: new Date().toISOString(),
      ...additionalFields,
    };

    await kv.set(EsignKeys.envelope(envelopeId), updated);

    // Log status change
    await logAuditEvent({
      envelopeId,
      actorType: 'system',
      action: 'status_changed',
      metadata: { from: envelope.status, to: status },
    });
  } catch (error: unknown) {
    log.error('Failed to update envelope status:', error);
    throw error;
  }
}

// ==================== SIGNER OPERATIONS ====================

/**
 * Add signers to envelope
 */
export async function addSignersToEnvelope(
  envelopeId: string,
  signers: Array<{
    name: string;
    email: string;
    phone?: string;
    role?: string;
    // P2.5 2.8 — caller can mark a recipient as a witness (or cc-only) so the
    // audit trail and Postgres mirror tag attestations correctly.
    kind?: 'signer' | 'witness' | 'cc';
    requiresOtp?: boolean;
    accessCode?: string;
    clientId?: string;
    // P5.1 — opt-in for SMS channel (OTP + invite + reminder). Off by
    // default to honour POPIA; only respected when `phone` is also set.
    smsOptIn?: boolean;
  }>
): Promise<{ signerIds: string[]; error?: string }> {
  try {
    const signerIds: string[] = [];
    const rawExistingIds = await kv.get(EsignKeys.envelopeSigners(envelopeId));
    const existingSignerIds = Array.isArray(rawExistingIds) ? rawExistingIds : [];

    for (let i = 0; i < signers.length; i++) {
      const signerData = signers[i];
      const signerId = crypto.randomUUID();
      const accessToken = crypto.randomUUID();

      const signer: EsignSigner = {
        id: signerId,
        envelope_id: envelopeId,
        client_id: signerData.clientId,
        name: signerData.name,
        email: signerData.email,
        phone: signerData.phone,
        order: existingSignerIds.length + i + 1,
        role: signerData.role,
        kind: signerData.kind ?? 'signer',
        status: 'pending',
        access_code: signerData.accessCode,
        access_token: accessToken,
        requires_otp: signerData.requiresOtp,
        otp_verified: false,
        sms_opt_in: signerData.smsOptIn === true && !!signerData.phone,
        created_at: new Date().toISOString(),
      };

      // Store signer (canonical write)
      await kv.set(EsignKeys.PREFIX_SIGNER + signerId, signer);
      
      // Map token to signer
      await kv.set(EsignKeys.signerToken(accessToken), signerId);

      // Phase 0.1 — shadow write to Postgres.
      void esignPgRepo.upsertSigner({
        id: signerId,
        envelope_id: envelopeId,
        email: signerData.email,
        name: signerData.name,
        phone: signerData.phone ?? null,
        role: signerData.role ?? null,
        kind: signerData.kind ?? 'signer',
        signing_order: signer.order,
        status: 'pending',
        access_token: accessToken,
        otp_required: !!signerData.requiresOtp,
        access_code: signerData.accessCode ?? null,
        client_id: signerData.clientId ?? null,
        is_system_client: !!signerData.clientId,
      });

      // If signer is a system client, link envelope to their client envelope list
      // so it appears on their client management page
      if (signerData.clientId) {
        const clientListKey = EsignKeys.clientEnvelopes(signerData.clientId);
        const clientEnvelopes = await kv.get(clientListKey) || [];
        if (!clientEnvelopes.includes(envelopeId)) {
          clientEnvelopes.push(envelopeId);
          await kv.set(clientListKey, clientEnvelopes);
        }
        log.info(`Linked envelope ${envelopeId} to system client ${signerData.clientId}`);
      }

      // Maintain signer-email → envelope index for cross-origin envelope discovery.
      // This ensures envelopes appear on a client's profile even when sent from
      // the standalone E-Sign page without an explicit client_id link.
      if (signerData.email) {
        const emailKey = EsignKeys.signerEmailEnvelopes(signerData.email);
        const emailEnvelopes = await kv.get(emailKey) || [];
        if (!emailEnvelopes.includes(envelopeId)) {
          emailEnvelopes.push(envelopeId);
          await kv.set(emailKey, emailEnvelopes);
        }
      }

      signerIds.push(signerId);
    }

    // Update envelope's signer list
    const updatedSignerIds = [...existingSignerIds, ...signerIds];
    await kv.set(EsignKeys.envelopeSigners(envelopeId), updatedSignerIds);

    return { signerIds };
  } catch (error: unknown) {
    log.error('Failed to add signers:', error);
    return { signerIds: [], error: getErrMsg(error) };
  }
}

/**
 * Get envelope signers
 */
export async function getEnvelopeSigners(envelopeId: string): Promise<EsignSigner[]> {
  try {
    const rawIds = await kv.get(EsignKeys.envelopeSigners(envelopeId));
    const signerIds = Array.isArray(rawIds) ? rawIds : [];
    const signers = await Promise.all(
      signerIds.map((id: string) => kv.get(EsignKeys.PREFIX_SIGNER + id))
    );
    return signers.filter(Boolean).sort((a: EsignSigner, b: EsignSigner) => (a.order || 0) - (b.order || 0));
  } catch (error: unknown) {
    log.error('Failed to get signers:', error);
    return [];
  }
}

/**
 * Get signer by token
 */
export async function getSignerByToken(token: string): Promise<EsignSigner | null> {
  try {
    const signerId = await kv.get(EsignKeys.signerToken(token));
    if (!signerId) return null;

    const signer = await kv.get(EsignKeys.PREFIX_SIGNER + signerId);
    return signer || null;
  } catch (error: unknown) {
    log.error('Failed to get signer by token:', error);
    return null;
  }
}

/**
 * P5.6 — Rotate a signer's access token.
 *
 * Used on recall, resend-invite, and immediately after a successful
 * submission so stale invite links cannot be replayed. The previous token
 * mapping is deleted, a fresh UUID is minted and indexed, and the signer
 * record is bumped with `token_rotated_at` + `token_rotation_count` for
 * audit visibility.
 *
 * Callers that need the new URL should read `signer.access_token` from
 * the returned record and rebuild the signing URL.
 */
export async function rotateSignerToken(
  signerId: string,
  reason: string,
): Promise<EsignSigner | null> {
  try {
    const signer = await kv.get(EsignKeys.PREFIX_SIGNER + signerId);
    if (!signer) return null;

    const oldToken = signer.access_token;
    const newToken = crypto.randomUUID();
    const now = new Date().toISOString();

    if (oldToken) {
      try { await kv.del(EsignKeys.signerToken(oldToken)); } catch { /* best-effort */ }
    }
    await kv.set(EsignKeys.signerToken(newToken), signerId);

    const updated: EsignSigner = {
      ...signer,
      access_token: newToken,
      token_rotated_at: now,
      token_rotation_count: ((signer.token_rotation_count as number | undefined) ?? 0) + 1,
    };
    await kv.set(EsignKeys.PREFIX_SIGNER + signerId, updated);

    await logAuditEvent({
      envelopeId: signer.envelope_id,
      actorType: 'system',
      actorId: signerId,
      action: 'signer_token_rotated',
      email: signer.email,
      metadata: { reason, rotation: updated.token_rotation_count },
    });

    return updated;
  } catch (error: unknown) {
    log.error('Failed to rotate signer token:', error);
    return null;
  }
}

/**
 * Update signer status
 */
export async function updateSignerStatus(
  signerId: string,
  status: EsignSigner['status'],
  additionalFields?: Partial<EsignSigner>
): Promise<void> {
  try {
    const signer = await kv.get(EsignKeys.PREFIX_SIGNER + signerId);
    if (!signer) {
      throw new Error('Signer not found');
    }

    const updated = {
      ...signer,
      status,
      ...additionalFields,
    };

    await kv.set(EsignKeys.PREFIX_SIGNER + signerId, updated);

    // Log status change
    await logAuditEvent({
      envelopeId: signer.envelope_id,
      actorType: 'signer',
      actorId: signerId,
      action: 'signer_status_changed',
      email: signer.email,
      metadata: { from: signer.status, to: status },
    });
  } catch (error: unknown) {
    log.error('Failed to update signer status:', error);
    throw error;
  }
}

// ==================== FIELD OPERATIONS ====================

/**
 * Add fields to envelope
 */
export async function addFieldsToEnvelope(
  envelopeId: string,
  fields: Array<{
    signerId: string;
    type: EsignField['type'];
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
    required: boolean;
  }>
): Promise<{ fieldIds: string[]; error?: string }> {
  try {
    const fieldIds: string[] = [];

    for (const fieldData of fields) {
      const fieldId = crypto.randomUUID();

      const field: EsignField = {
        id: fieldId,
        envelope_id: envelopeId,
        signer_id: fieldData.signerId,
        type: fieldData.type,
        page: fieldData.page,
        x: fieldData.x,
        y: fieldData.y,
        width: fieldData.width,
        height: fieldData.height,
        required: fieldData.required,
        created_at: new Date().toISOString(),
      };

      // Store field
      await kv.set(EsignKeys.field(fieldId), field);
      fieldIds.push(fieldId);
    }

    // Update envelope's field list — guard against corrupt KV values
    const existingRawList = await kv.get(EsignKeys.envelopeFields(envelopeId));
    const existingFieldIds = Array.isArray(existingRawList) 
      ? existingRawList.filter((item: unknown) => typeof item === 'string') 
      : [];
      
    const updatedFieldIds = [...existingFieldIds, ...fieldIds];
    await kv.set(EsignKeys.envelopeFields(envelopeId), updatedFieldIds);

    return { fieldIds };
  } catch (error: unknown) {
    log.error('Failed to add fields:', error);
    return { fieldIds: [], error: getErrMsg(error) };
  }
}

/**
 * Update field value
 */
export async function updateFieldValue(
  fieldId: string,
  value: string
): Promise<void> {
  try {
    const field = await kv.get(EsignKeys.field(fieldId));
    if (!field) {
      throw new Error('Field not found');
    }

    const updated = {
      ...field,
      value,
    };

    await kv.set(EsignKeys.field(fieldId), updated);
  } catch (error: unknown) {
    log.error('Failed to update field value:', error);
    throw error;
  }
}

// ==================== DOCUMENT OPERATIONS ====================

/**
 * Create document record
 */
export async function createDocument(document: EsignDocument): Promise<void> {
  try {
    await kv.set(EsignKeys.PREFIX_DOCUMENT + document.id, document);
  } catch (error: unknown) {
    log.error('Failed to create document:', error);
    throw error;
  }
}

// ==================== COMPLETION & VALIDATION ====================

/**
 * Check if envelope is complete (all signers signed)
 */
export async function checkEnvelopeCompletion(envelopeId: string): Promise<boolean> {
  try {
    const signers = await getEnvelopeSigners(envelopeId);
    
    if (signers.length === 0) return false;
    
    const allSigned = signers.every((s: EsignSigner) => 
      s.status === 'signed' || s.status === 'declined'
    );
    
    const anySigned = signers.some((s: EsignSigner) => s.status === 'signed');
    
    // Complete if all required signers have acted and at least one signed
    return allSigned && anySigned;
  } catch (error: unknown) {
    log.error('Failed to check completion:', error);
    return false;
  }
}

// ==================== AUDIT TRAIL ====================

/**
 * Get audit trail for envelope
 */
export async function getAuditTrail(envelopeId: string): Promise<EsignAuditEvent[]> {
  try {
    const rawAuditIds = await kv.get(EsignKeys.envelopeAudit(envelopeId));
    const auditIds = Array.isArray(rawAuditIds) ? rawAuditIds : [];
    const auditEvents = await Promise.all(
      auditIds.map((id: string) => kv.get(EsignKeys.PREFIX_AUDIT + id))
    );
    
    return auditEvents.filter(Boolean).sort((a: EsignAuditEvent, b: EsignAuditEvent) => 
      new Date(b.at).getTime() - new Date(a.at).getTime()
    );
  } catch (error: unknown) {
    log.error('Failed to get audit trail:', error);
    return [];
  }
}

// ==================== ADMIN OPERATIONS ====================

/**
 * Clear all E-Signature data (Admin only)
 * WARNING: This is a destructive operation!
 */
export async function clearAllEsignData(): Promise<void> {
  try {
    log.warn('STARTING FULL E-SIGN DATA WIPE');

    // 1. Get all envelopes to identify related data
    const allEnvelopeValues = await kv.getByPrefix(EsignKeys.PREFIX_ENVELOPE);
    const envelopes = allEnvelopeValues.filter((item: Record<string, unknown>) => 
      item && 
      typeof item === 'object' &&
      !Array.isArray(item) &&
      item.id && 
      item.status
    );

    log.info(`Deleting ${envelopes.length} envelopes...`);

    // 2. Delete Envelopes and their association lists
    for (const env of envelopes) {
      await kv.del(EsignKeys.envelope(env.id));
      await kv.del(EsignKeys.envelopeSigners(env.id));
      await kv.del(EsignKeys.envelopeFields(env.id));
      await kv.del(EsignKeys.envelopeAudit(env.id));
    }

    // 3. Delete Signers
    const signers = await kv.getByPrefix(EsignKeys.PREFIX_SIGNER);
    log.info(`Deleting ${signers.length} signers...`);
    for (const s of signers) {
      if (s && s.id) {
        await kv.del(EsignKeys.PREFIX_SIGNER + s.id);
        // Delete token if exists
        if (s.access_token) {
          await kv.del(EsignKeys.signerToken(s.access_token));
        }
      }
    }

    // 4. Delete Fields
    const fields = await kv.getByPrefix(EsignKeys.PREFIX_FIELD);
    log.info(`Deleting ${fields.length} fields...`);
    for (const f of fields) {
      if (f && f.id) await kv.del(EsignKeys.field(f.id));
    }
    
    // 5. Delete Documents
    const documents = await kv.getByPrefix(EsignKeys.PREFIX_DOCUMENT);
    log.info(`Deleting ${documents.length} documents...`);
    for (const d of documents) {
      if (d && d.id) await kv.del(EsignKeys.PREFIX_DOCUMENT + d.id);
    }

    // 6. Delete Audits
    const audits = await kv.getByPrefix(EsignKeys.PREFIX_AUDIT);
    log.info(`Deleting ${audits.length} audit events...`);
    for (const a of audits) {
      if (a && a.id) await kv.del(EsignKeys.PREFIX_AUDIT + a.id);
    }

    // 7. Clear Client Lists
    const clientIds = new Set(envelopes.map((e: Record<string, unknown>) => e.client_id as string).filter(Boolean));
    log.info(`Clearing lists for ${clientIds.size} clients...`);
    for (const clientId of clientIds) {
      await kv.del(EsignKeys.clientEnvelopes(clientId));
    }

    log.success('FULL E-SIGN DATA WIPE COMPLETE');
  } catch (error) {
    log.error('Failed to clear all data:', error);
    throw error;
  }
}