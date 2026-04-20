/**
 * P6.7 — One-click evidence-pack exporter.
 *
 * Produces a single ZIP containing everything legal/discovery would
 * ever ask for when defending a signed document:
 *
 *   /signed.pdf                    — sealed + certificate-merged artifact
 *   /certificate.pdf               — standalone completion certificate
 *   /audit.json                    — raw audit trail (immutable history)
 *   /manifest.json                 — envelope + signer metadata snapshot
 *   /consent.txt                   — verbatim consent text (with version)
 *   /attachments/<id>-<filename>   — every signer-uploaded attachment
 *
 * The ZIP is generated fully in-memory with `@zip.js/zip.js` (the same
 * dependency used by the documents module) and returned as a Uint8Array
 * so the route handler can stream it directly to the caller.
 *
 * Requires an envelope in the `completed` status — anything earlier
 * simply won't have a sealed artifact or certificate to ship.
 */

import { ZipWriter, Uint8ArrayWriter, Uint8ArrayReader, TextReader } from 'npm:@zip.js/zip.js';
import * as kv from './kv_store.tsx';
import { EsignKeys } from './esign-keys.ts';
import {
  getEnvelopeDetails,
  getEnvelopeSigners,
  getAuditTrail,
} from './esign-services.ts';
import {
  downloadDocument,
  downloadCertificate,
  downloadAttachment,
} from './esign-storage.ts';
import { getCertificate } from './esign-certificates.ts';
import { getConsentByVersion } from './esign-consent-registry.ts';
import { createModuleLogger } from './stderr-logger.ts';

const log = createModuleLogger('esign-evidence-export');

export interface EvidencePack {
  zip: Uint8Array;
  filename: string;
}

function safeFilename(input: string, fallback: string): string {
  const trimmed = (input || '').trim().replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  return trimmed || fallback;
}

/**
 * Generate an evidence pack for a completed envelope. Callers must
 * already have authorised the request (per-firm scoping is checked by
 * the route handler, not here).
 */
export async function buildEvidencePack(envelopeId: string): Promise<EvidencePack | null> {
  const envelope = await getEnvelopeDetails(envelopeId);
  if (!envelope) {
    log.warn(`Evidence pack requested for missing envelope ${envelopeId}`);
    return null;
  }
  if (envelope.status !== 'completed') {
    throw new Error(`Envelope ${envelopeId} is ${envelope.status}; evidence pack requires status=completed`);
  }

  const signers = await getEnvelopeSigners(envelopeId);
  const audit = await getAuditTrail(envelopeId);
  const consent = envelope.consent_version
    ? await getConsentByVersion(envelope.consent_version as string)
    : null;

  // ── Pull the sealed signed PDF ─────────────────────────────────────
  let signedPdf: Uint8Array | null = null;
  if (envelope.signed_document_path) {
    signedPdf = await downloadDocument(envelope.signed_document_path as string);
    if (!signedPdf) {
      log.warn(`Signed PDF missing from storage for envelope ${envelopeId}`);
    }
  }

  // ── Pull the standalone certificate ────────────────────────────────
  const certInfo = await getCertificate(envelopeId);
  let certPdf: Uint8Array | null = null;
  if (certInfo.exists && certInfo.storagePath) {
    certPdf = await downloadCertificate(certInfo.storagePath);
  }

  // ── Discover attachments via audit events and field metadata ───────
  // Attachment records live at EsignKeys.envelopeAttachments(envelopeId).
  const attachments: Array<{ path: string; originalName: string; attachmentId: string }> = [];
  try {
    const attIndex = (await kv.get(EsignKeys.envelopeAttachments(envelopeId))) as unknown;
    if (Array.isArray(attIndex)) {
      for (const rec of attIndex) {
        if (rec && typeof rec === 'object') {
          const r = rec as Record<string, unknown>;
          const path = typeof r.storage_path === 'string' ? r.storage_path : (typeof r.path === 'string' ? r.path : '');
          const originalName = typeof r.original_filename === 'string' ? r.original_filename : (typeof r.filename === 'string' ? r.filename : 'attachment.bin');
          const attachmentId = typeof r.id === 'string' ? r.id : crypto.randomUUID();
          if (path) attachments.push({ path, originalName, attachmentId });
        }
      }
    }
  } catch (err) {
    log.warn('Failed to read attachments index; continuing without:', err);
  }

  // ── Shape manifest + audit JSON ────────────────────────────────────
  const manifest = {
    envelope: {
      id: envelope.id,
      title: envelope.title,
      status: envelope.status,
      firm_id: envelope.firm_id,
      client_id: envelope.client_id,
      created_at: envelope.created_at,
      sent_at: envelope.sent_at,
      completed_at: envelope.completed_at,
      signed_document_hash: envelope.signed_document_hash,
      consent_version: envelope.consent_version,
      signing_reason_required: envelope.signing_reason_required,
      signing_reason_prompt: envelope.signing_reason_prompt,
      kba_required: envelope.kba_required,
      kba_provider: envelope.kba_provider,
      template_id: envelope.template_id,
      template_version: envelope.template_version,
    },
    signers: signers.map((s) => ({
      id: s.id,
      name: s.name,
      email: s.email,
      role: s.role,
      phone: s.phone,
      status: s.status,
      signed_at: s.signed_at,
      ip_address: s.ip_address,
      user_agent: s.user_agent,
      consent_version: s.consent_version,
      consent_accepted_at: s.consent_accepted_at,
      signing_reason: s.signing_reason,
      signature_telemetry: s.signature_telemetry,
      kba: s.kba,
    })),
    attachments: attachments.map(({ path, originalName, attachmentId }) => ({
      id: attachmentId,
      storage_path: path,
      original_filename: originalName,
    })),
    generated_at: new Date().toISOString(),
  };

  // ── Write ZIP ──────────────────────────────────────────────────────
  const zipWriter = new ZipWriter(new Uint8ArrayWriter());

  const addBinary = async (name: string, bytes: Uint8Array) => {
    await zipWriter.add(name, new Uint8ArrayReader(bytes));
  };
  const addText = async (name: string, text: string) => {
    await zipWriter.add(name, new TextReader(text));
  };

  if (signedPdf) {
    await addBinary('signed.pdf', signedPdf);
  } else {
    // Fall back to the original document if the sealed version is missing.
    if (envelope.document?.storage_path) {
      const original = await downloadDocument(envelope.document.storage_path as string);
      if (original) await addBinary('original.pdf', original);
    }
  }

  if (certPdf) {
    await addBinary('certificate.pdf', certPdf);
  }

  await addText('audit.json', JSON.stringify(audit, null, 2));
  await addText('manifest.json', JSON.stringify(manifest, null, 2));

  if (consent) {
    const consentBlob =
      `Consent version: ${consent.id}\n` +
      `Published at: ${consent.published_at}\n` +
      (consent.summary ? `Summary: ${consent.summary}\n` : '') +
      '\n' +
      consent.text +
      '\n';
    await addText('consent.txt', consentBlob);
  }

  for (const a of attachments) {
    const bytes = await downloadAttachment(a.path);
    if (!bytes) continue;
    const safeName = safeFilename(a.originalName, `${a.attachmentId}.bin`);
    await addBinary(`attachments/${a.attachmentId}-${safeName}`, bytes);
  }

  const zipBytes = await zipWriter.close();

  const title = safeFilename(envelope.title as string, 'envelope');
  const filename = `evidence_${title}_${envelope.id}.zip`;

  log.success(`Built evidence pack for envelope ${envelopeId} (${zipBytes.length} bytes)`);

  return { zip: zipBytes, filename };
}
