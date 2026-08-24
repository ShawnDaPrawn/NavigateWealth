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

export const templateHasSavedDocuments = (
  template: EsignTemplateRecord | null | undefined,
): boolean => Array.isArray(template?.documents) && template.documents.length > 0;

export const mapTemplateRecipientsToWizard = (template: EsignTemplateRecord): SignerFormData[] =>
  template.recipients.map((recipient, index) => ({
    name: recipient.name || '',
    email: recipient.email || '',
    role: recipient.role || 'Signer',
    order: recipient.order ?? index + 1,
    otpRequired: recipient.otpRequired ?? false,
    accessCode: recipient.accessCode,
    kind: recipient.kind,
    clientId: undefined,
    isSystemClient: false,
  }));

/** The wire shape `esignApi.saveDraftSigners` expects, built from wizard signers. */
export const toDraftSignerPayload = (signers: SignerFormData[]) =>
  signers.map((signer, index) => ({
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

  return params.template.fields
    .map((templateField, index): EsignField | null => {
      const recipient = params.signers[templateField.recipientIndex];
      if (!recipient) return null;

      return {
        id: `tpl-${params.envelope.id}-${index}`,
        envelope_id: params.envelope.id,
        document_id:
          (templateField.documentId && params.documentMap?.[templateField.documentId]) ||
          primaryDocumentId,
        signer_id: recipient.email,
        type: templateField.type,
        page: templateField.page,
        x: templateField.x,
        y: templateField.y,
        width: templateField.width,
        height: templateField.height,
        required: templateField.required,
        metadata: templateField.metadata ?? {},
        created_at: nowIso,
        updated_at: nowIso,
      } satisfies EsignField;
    })
    .filter((field): field is EsignField => field !== null);
};

/**
 * Map fields to include signerIndex for the backend. Fields carry the
 * signer's email in `signer_id`; the invite payload wants the signer's
 * index in the wizard's signer list (unknown emails fall back to 0).
 */
export const attachSignerIndexes = (fields: EsignField[], signers: SignerFormData[]) =>
  fields.map((f) => {
    const signerIndex = signers.findIndex((s) => s.email === f.signer_id);
    return {
      ...f,
      signerIndex: signerIndex >= 0 ? signerIndex : 0,
    };
  });

/** The signer shape `sendInvites` expects, built from wizard signers. */
export const toInviteSignerPayload = (signers: SignerFormData[]) =>
  signers.map((s) => ({
    name: s.name,
    email: s.email,
    phone: s.phone,
    role: s.role,
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
      role: s.role || 'Signer',
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
    const signers = draftSigners.map(
      (s: {
        name: string;
        email: string;
        role?: string;
        order?: number;
        otpRequired?: boolean;
        accessCode?: string;
        clientId?: string;
        isSystemClient?: boolean;
      }) => ({
        name: s.name,
        email: s.email,
        role: s.role || 'Signer',
        order: s.order,
        otpRequired: s.otpRequired ?? false,
        accessCode: s.accessCode || undefined,
        clientId: s.clientId || undefined,
        isSystemClient: s.isSystemClient ?? !!s.clientId,
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
