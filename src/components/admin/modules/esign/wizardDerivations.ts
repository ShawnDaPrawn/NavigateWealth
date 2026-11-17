/**
 * Pure derivations for the e-sign envelope wizard (EsignModule).
 *
 * Everything here is a plain function of its inputs — no state, no API calls
 * except none at all. The module root (index.tsx) owns the wizard state
 * machine and calls these to map between the template/envelope shapes the
 * server speaks and the SignerFormData/EsignField shapes the wizard edits.
 */
import { logger } from '../../../../utils/logger';
import type {
  EsignEnvelope,
  SignerFormData,
  EsignField,
  EsignTemplateRecord,
  EsignSigner,
} from './types';
import { findRecipientIndex, newRecipientKey, recipientIdOf } from './recipientIdentity';
import { remapFieldReferences } from '../../../../shared/esign/fieldReferences';

/**
 * P4.1 / P4.3 — Template provenance carried through the wizard.
 * When the user picks a template the picker stamps these onto state so the
 * eventual upload can pin the envelope to the exact template snapshot,
 * and the studio can hydrate the field layout without an extra round-trip.
 */
export interface TemplateContext {
  template: EsignTemplateRecord;
  /** Pinned at pick-time so later template edits do not retroactively
   *  rewrite this draft envelope's field layout. */
  version: number;
}

export interface TemplateBuilderContext {
  mode: 'create' | 'edit';
  templateId?: string;
  name: string;
  description?: string;
  category?: string;
}

/**
 * True when the wizard can skip the field studio and send straight away: the
 * chosen template already carries a complete field layout, and we are sending
 * rather than building a template (a builder has nothing to send yet).
 */
export const canExpressSend = (
  templateContext: TemplateContext | null | undefined,
  isTemplateBuilder: boolean | undefined,
): boolean => !isTemplateBuilder && !!templateContext && templateContext.template.fields.length > 0;

export const templateHasSavedDocuments = (
  template: EsignTemplateRecord | null | undefined,
): boolean => Array.isArray(template?.documents) && template.documents.length > 0;

/**
 * A template's recipients are SLOTS to fill for this envelope. Older
 * templates stored the name, email and access code of whoever the source
 * envelope went to; copying them in pre-filled every new envelope with the
 * previous client, so an express send could go to the wrong person. Only the
 * slot (role, order, kind, OTP) is carried; the sender fills in the person.
 */
export const mapTemplateRecipientsToWizard = (template: EsignTemplateRecord): SignerFormData[] =>
  template.recipients.map((recipient, index) => ({
    recipientKey: newRecipientKey(),
    name: '',
    email: '',
    role: recipient.role || 'Signer',
    order: recipient.order ?? index + 1,
    otpRequired: recipient.otpRequired ?? false,
    accessCode: undefined,
    kind: recipient.kind,
    clientId: undefined,
    isSystemClient: false,
  }));

/** The wire shape `esignApi.saveDraftSigners` expects, built from wizard signers. */
export const toDraftSignerPayload = (signers: SignerFormData[]) =>
  signers.map((signer, index) => ({
    // Saved so a resumed draft's fields still point at the right person.
    recipientKey: signer.recipientKey,
    kind: signer.kind,
    name: signer.name,
    email: signer.email,
    phone: signer.phone,
    role: signer.role || 'Signer',
    order: signer.order ?? index + 1,
    otpRequired: signer.otpRequired,
    accessCode: signer.accessCode,
    clientId: signer.clientId,
    isSystemClient: signer.isSystemClient,
    smsOptIn: signer.smsOptIn,
  }));

/**
 * Stamp a template's field layout onto a freshly materialised envelope.
 * Fields whose recipient index has no matching wizard signer are dropped;
 * each surviving field is addressed to the signer's email and mapped onto
 * the live document via `documentMap` (falling back to the envelope's
 * primary document).
 */
export const buildTemplateFieldsForEnvelope = (params: {
  envelope: EsignEnvelope;
  template: EsignTemplateRecord;
  signers: SignerFormData[];
  documentMap?: Record<string, string>;
}): EsignField[] => {
  if (params.template.fields.length === 0) {
    return [];
  }

  const nowIso = new Date().toISOString();
  const primaryDocumentId =
    params.envelope.document?.id ??
    params.envelope.document_id ??
    Object.values(params.documentMap || {})[0];

  // New ids for every template field, by its saved key, so conditional rules
  // and formulas that name another field can be re-pointed (they kept the
  // saved envelope's ids and never matched).
  const idOf = (index: number) => `tpl-${params.envelope.id}-${index}`;
  const keyToId = new Map<string, string>();
  params.template.fields.forEach((f, index) => {
    if (f.key) keyToId.set(f.key, idOf(index));
  });

  return params.template.fields
    .map((templateField, index): EsignField | null => {
      const recipient = params.signers[templateField.recipientIndex];
      if (!recipient) return null;

      return {
        id: idOf(index),
        envelope_id: params.envelope.id,
        document_id:
          (templateField.documentId && params.documentMap?.[templateField.documentId]) ||
          primaryDocumentId,
        signer_id: recipientIdOf(recipient),
        type: templateField.type,
        page: templateField.page,
        x: templateField.x,
        y: templateField.y,
        width: templateField.width,
        height: templateField.height,
        required: templateField.required,
        metadata: remapFieldReferences(templateField.metadata ?? {}, keyToId),
        created_at: nowIso,
        updated_at: nowIso,
      } satisfies EsignField;
    })
    .filter((field): field is EsignField => field !== null);
};

/**
 * Map fields to include signerIndex for the backend. Fields carry a
 * recipient id in `signer_id` (see recipientIdentity.ts); the invite payload
 * wants the recipient's index in the wizard's list. A prefill binding's data
 * source travels the same way, as `prefill.source_index`.
 *
 * Unknown recipients still fall back to 0 for older callers, but the studio's
 * pre-send check refuses to send a field that matches no recipient.
 */
export const attachSignerIndexes = (fields: EsignField[], signers: SignerFormData[]) =>
  fields.map((f) => {
    const signerIndex = findRecipientIndex(signers, f.signer_id);
    const meta = (f.metadata ?? {}) as Record<string, unknown>;
    const prefill = meta.prefill as { source?: string } | undefined;
    const sourceIndex = prefill?.source ? findRecipientIndex(signers, prefill.source) : -1;
    return {
      ...f,
      signerIndex: signerIndex >= 0 ? signerIndex : 0,
      ...(sourceIndex >= 0
        ? { metadata: { ...meta, prefill: { ...prefill, source_index: sourceIndex } } }
        : {}),
    };
  });

/** The signer shape `sendInvites` expects, built from wizard signers. */
export const toInviteSignerPayload = (signers: SignerFormData[]) =>
  signers.map((s) => ({
    name: s.name,
    email: s.email,
    phone: s.phone,
    role: s.role,
    // Without `kind` a "receives a copy" recipient was sent a signing link
    // and the envelope could not complete until they acted.
    kind: s.kind,
    order: s.order,
    otpRequired: s.otpRequired,
    accessCode: s.accessCode,
    clientId: s.clientId,
    smsOptIn: s.smsOptIn,
  }));

/**
 * Reconstruct wizard signers for a resumed envelope from the best available
 * source:
 *   a) Real signer records (created during invite flow — present if envelope was sent)
 *   b) draft_signers stored on the envelope record (persisted when moving recipients → prepare)
 *   c) Empty array (shouldn't happen for a properly created draft)
 */
export const signersFromResumedEnvelope = (fullEnvelope: EsignEnvelope): SignerFormData[] => {
  const realSigners = fullEnvelope.signers || [];
  const draftSigners = fullEnvelope.draft_signers || [];

  if (realSigners.length > 0) {
    // Sent envelopes or envelopes that already went through invite
    return realSigners.map((s: EsignSigner & { requires_otp?: boolean }) => ({
      name: s.name,
      email: s.email,
      phone: s.phone || undefined,
      role: s.role || 'Signer',
      kind: s.kind,
      order: s.order,
      otpRequired: s.otp_required ?? s.requires_otp ?? false,
      accessCode: s.access_code || undefined,
      clientId: s.client_id || undefined,
      isSystemClient: !!s.client_id,
    }));
  }

  if (draftSigners.length > 0) {
    // Draft envelope resumed via "Continue Editing" — signers not yet
    // created as real records, but persisted as lightweight form data
    // Only a SAVED recipient key is restored. Inventing one here would not be
    // saved back, so the next resume would invent another and every field
    // placed in between would lose its recipient. A draft from before keys
    // existed keeps resolving by email; its recipients get keys the next
    // time the list is edited, and those are saved with the draft.
    const signers = draftSigners.map(
      (s: {
        recipientKey?: string;
        name: string;
        email: string;
        phone?: string;
        role?: string;
        kind?: SignerFormData['kind'];
        order?: number;
        otpRequired?: boolean;
        accessCode?: string;
        clientId?: string;
        isSystemClient?: boolean;
        smsOptIn?: boolean;
      }) => ({
        recipientKey: s.recipientKey,
        name: s.name,
        email: s.email,
        phone: s.phone || undefined,
        role: s.role || 'Signer',
        kind: s.kind,
        order: s.order,
        otpRequired: s.otpRequired ?? false,
        accessCode: s.accessCode || undefined,
        clientId: s.clientId || undefined,
        isSystemClient: s.isSystemClient ?? !!s.clientId,
        smsOptIn: s.smsOptIn,
      }),
    );
    logger.info(`Restored ${signers.length} draft signer(s) for envelope ${fullEnvelope.id}`);
    return signers;
  }

  logger.warn(
    `No signers or draft_signers found for envelope ${fullEnvelope.id} — prepare studio will have no recipients`,
  );
  return [];
};

/**
 * Days until `expiresAtIso`, measured from `referenceMs`, rounded up.
 * Falls back when the timestamp is absent, unparseable, or in the past.
 * (Resume measures from now; a settings save measures from the envelope's
 * created_at so a re-send keeps the originally chosen window.)
 */
export const deriveExpiryDays = (
  expiresAtIso: string | undefined,
  referenceMs: number,
  fallback: number,
): number => {
  if (!expiresAtIso) return fallback;
  const diffMs = new Date(expiresAtIso).getTime() - referenceMs;
  const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  return Number.isFinite(diffDays) && diffDays > 0 ? diffDays : fallback;
};
