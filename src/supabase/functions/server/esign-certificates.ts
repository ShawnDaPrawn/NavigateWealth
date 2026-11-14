/**
 * E-Signature Certificate Generation Service (KV Store Version)
 * Generates completion certificates for fully signed envelopes.
 *
 * This module gathers the evidence; `esign-certificate-pdf.ts` draws it in the
 * Navigate Wealth certificate of completion standard (14 Nov 2026).
 */

import * as kv from './kv_store.tsx';
import { uploadCertificate, calculateHash } from './esign-storage.ts';
import { getEnvelopeDetails, getAuditTrail } from './esign-services.ts';
import type { EsignSigner, EsignAuditEvent } from './esign-types.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { getConsentByVersion } from './esign-consent-registry.ts';
import {
  clientProfiles,
  clientProfileId,
  personnelProfiles,
} from './repositories/client-adviser-repository.ts';
import { renderCertificatePdf } from './esign-certificate-pdf.ts';
import type { CertificateData, CertificateSigner } from './esign-certificate-pdf.ts';

const log = createModuleLogger('esign-certificates');

// ============================================================================
// NAMES — who sent it and who the client is
// ============================================================================

/** The client's full name from their profile, or null when there is none. */
async function resolveClientName(clientId: string | undefined): Promise<string | null> {
  if (!clientId || clientId === 'standalone') return null;
  try {
    const raw = (await clientProfiles.get(clientProfileId(clientId))) as Record<
      string,
      unknown
    > | null;
    if (!raw) return null;
    const personal =
      raw.personalInformation && typeof raw.personalInformation === 'object'
        ? (raw.personalInformation as Record<string, unknown>)
        : {};
    const p = { ...personal, ...raw };
    const first = String(p.firstName || p.profile_first_name || '').trim();
    const last = String(p.lastName || p.profile_last_name || '').trim();
    const full = `${first} ${last}`.trim() || String(p.fullName || '').trim();
    return full || null;
  } catch (error) {
    log.warn('Client name lookup failed for certificate', { error: String(error) });
    return null;
  }
}

/** The sending staff member's name and email from their personnel profile. */
async function resolveSender(
  userId: string | undefined,
): Promise<{ name: string | null; email: string | null }> {
  if (!userId) return { name: null, email: null };
  try {
    const profile = await personnelProfiles.get(userId);
    if (!profile) return { name: null, email: null };
    const name = `${profile.firstName || ''} ${profile.lastName || ''}`.trim();
    return { name: name || null, email: profile.email || null };
  } catch (error) {
    log.warn('Sender lookup failed for certificate', { error: String(error) });
    return { name: null, email: null };
  }
}

// ============================================================================
// DATA FETCHING
// ============================================================================

/**
 * Gather everything the certificate states, from the envelope, its signers and
 * its audit trail. Returns null when there is nothing to certify.
 */
async function fetchEnvelopeData(
  envelopeId: string,
  certificateId: string,
  issuedAt: string,
): Promise<CertificateData | null> {
  try {
    const envelope = await getEnvelopeDetails(envelopeId);

    if (!envelope) {
      log.error('Envelope not found');
      return null;
    }

    // Only signers who actually signed, in signing order.
    const signedSigners = (envelope.signers || [])
      .filter((s: EsignSigner) => s.status === 'signed')
      .sort((a: EsignSigner, b: EsignSigner) => (a.order || 0) - (b.order || 0));

    if (signedSigners.length === 0) {
      log.error('No signed signers found');
      return null;
    }

    const auditEvents = await getAuditTrail(envelopeId);
    const sameEmail = (e: EsignAuditEvent, email: string) =>
      (e.email || '').toLowerCase() === (email || '').toLowerCase();

    // Evidence per signer. IP and user agent prefer the `signed` audit event —
    // the contemporaneous observation — over the signer record, which can be
    // updated later.
    const signers: CertificateSigner[] = signedSigners.map((signer: EsignSigner, index) => {
      const mine = auditEvents.filter((e: EsignAuditEvent) => sameEmail(e, signer.email));
      const signEvent = mine.find((e) => e.action === 'signed');
      const viewedEvent = mine.find((e) => e.action === 'viewed');
      const otpVerified = mine.find((e) => e.action === 'otp_verified');
      const otpChannels = new Set<string>();
      for (const ev of mine) {
        if (ev.action === 'otp_sent' || ev.action === 'otp_resent') {
          const ch =
            (ev.metadata?.channel as string | undefined) ||
            (ev.metadata?.method as string | undefined) ||
            'email';
          otpChannels.add(ch);
        }
      }

      let time_to_sign_ms: number | undefined;
      const first = signer.invite_sent_at || viewedEvent?.at;
      if (first && signer.signed_at) {
        const a = new Date(first).getTime();
        const b = new Date(signer.signed_at).getTime();
        if (Number.isFinite(a) && Number.isFinite(b) && b >= a) {
          time_to_sign_ms = b - a;
        }
      }

      return {
        order: index + 1,
        name: signer.name,
        email: signer.email,
        role: signer.role,
        kind: signer.kind,
        phone: signer.phone,
        signed_at: signer.signed_at || new Date().toISOString(),
        invite_sent_at: signer.invite_sent_at,
        viewed_at: signer.viewed_at || viewedEvent?.at,
        consent_accepted_at: signer.consent_accepted_at,
        otp_verified_at: signer.requires_otp ? otpVerified?.at : undefined,
        ip_address: signEvent?.ip || signer.ip_address,
        user_agent: signEvent?.user_agent || signer.user_agent,
        time_to_sign_ms,
        // Channels are listed only for an OTP-gated signer: listing them for
        // an ungated one would overstate the assurance of their signature.
        otp_methods: signer.requires_otp ? Array.from(otpChannels) : [],
        requires_otp: Boolean(signer.requires_otp),
        sms_invite: Boolean(signer.sms_opt_in && signer.phone),
        signature_data: signer.signature_data,
        signature_telemetry: signer.signature_telemetry,
        consent_version: signer.consent_version,
        signing_reason: signer.signing_reason,
        kba:
          signer.kba && signer.kba.status !== 'skipped'
            ? {
                provider: signer.kba.provider,
                status: signer.kba.status,
                reference: signer.kba.reference,
              }
            : undefined,
      };
    });

    // The consent text the signers saw, pinned at send time.
    const consent = envelope.consent_version
      ? await getConsentByVersion(envelope.consent_version as string)
      : null;

    const [clientName, sender] = await Promise.all([
      resolveClientName(envelope.client_id),
      resolveSender(envelope.created_by_user_id),
    ]);

    // Fallbacks keep the certificate truthful when a profile is missing: the
    // client is the signer linked to the envelope's client, and an unknown
    // sender is the firm rather than an invented person.
    const linkedSigner = signedSigners.find(
      (s: EsignSigner) => s.client_id && s.client_id === envelope.client_id,
    );

    const firstSendEvent = auditEvents.find(
      (e: EsignAuditEvent) =>
        e.action === 'esign_invites_sent' || e.action === 'sent' || e.action === 'invite_sent',
    );

    return {
      certificate_id: certificateId,
      envelope_id: envelope.id,
      title: envelope.title,
      created_at: envelope.created_at,
      sent_at: envelope.sent_at || firstSendEvent?.at,
      completed_at: envelope.completed_at || new Date().toISOString(),
      expires_at: envelope.expires_at,
      issued_at: issuedAt,
      client_name: clientName || linkedSigner?.name || undefined,
      sender_name: sender.name || 'Navigate Wealth',
      sender_email: sender.email || undefined,
      signing_mode: envelope.signing_mode,
      signing_reason_prompt: envelope.signing_reason_required
        ? envelope.signing_reason_prompt || 'Signed in capacity as disclosed by the signer'
        : undefined,
      document: envelope.document
        ? {
            filename: envelope.document.original_filename,
            page_count: envelope.document.page_count,
            hash: envelope.document.hash,
          }
        : undefined,
      consent: consent ? { id: consent.id, text: consent.text } : undefined,
      signers,
      audit_events: auditEvents.map((e: EsignAuditEvent) => ({
        action: e.action,
        at: e.at,
        actor_type: e.actor_type,
        email: e.email,
        ip: e.ip,
        metadata: e.metadata,
      })),
    };
  } catch (error) {
    log.error('Fetch envelope data exception:', error);
    return null;
  }
}

// ============================================================================
// PUBLIC EXPORTS
// ============================================================================

/**
 * Generate and store completion certificate
 */
export async function generateCompletionCertificate(
  envelopeId: string,
): Promise<{ success: boolean; certificateId?: string; error?: string; pdfBuffer?: Uint8Array }> {
  try {
    log.info(`Generating completion certificate for envelope ${envelopeId}...`);

    // Check if certificate already exists
    const existingCert = await kv.get(`esign:certificate:${envelopeId}`);

    // The certificate ID and issue time are printed on every page, so they
    // are settled before the PDF is drawn: an existing record keeps its own.
    const certificateId: string = existingCert?.id ?? crypto.randomUUID();
    const issuedAt: string = existingCert?.generated_at ?? new Date().toISOString();

    // Fetch envelope data (needed for PDF generation regardless of existing cert)
    const envelopeData = await fetchEnvelopeData(envelopeId, certificateId, issuedAt);

    if (!envelopeData) {
      return { success: false, error: 'Failed to fetch envelope data' };
    }

    // Always generate fresh PDF buffer (ensures latest template is used)
    const certificateBuffer = await renderCertificatePdf(envelopeData);

    if (existingCert) {
      log.info(
        `Certificate record already exists for envelope ${envelopeId}, returning fresh PDF buffer`,
      );
      return { success: true, certificateId: existingCert.id, pdfBuffer: certificateBuffer };
    }

    // Calculate hash
    const hash = await calculateHash(certificateBuffer);

    // Upload to storage
    const { path, error: uploadError } = await uploadCertificate(envelopeId, certificateBuffer);

    if (uploadError || !path) {
      return { success: false, error: uploadError || 'Failed to upload certificate' };
    }

    // Create certificate record
    const certificate = {
      id: certificateId,
      envelope_id: envelopeId,
      storage_path: path,
      hash: hash,
      generated_at: issuedAt,
    };

    // Store certificate record
    await kv.set(`esign:certificate:${envelopeId}`, certificate);

    log.success(`Certificate generated successfully: ${certificateId}`);
    return { success: true, certificateId, pdfBuffer: certificateBuffer };
  } catch (error) {
    log.error('Generate certificate exception:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Check if envelope is eligible for certificate generation
 */
export async function isEligibleForCertificate(envelopeId: string): Promise<boolean> {
  try {
    const envelope = await kv.get(`esign:envelope:${envelopeId}`);

    if (!envelope) {
      return false;
    }

    return envelope.status === 'completed';
  } catch (error) {
    log.error('Check eligibility exception:', error);
    return false;
  }
}

/**
 * Get certificate if it exists
 */
export async function getCertificate(envelopeId: string): Promise<{
  exists: boolean;
  certificateId?: string;
  storagePath?: string;
  hash?: string;
  generatedAt?: string;
}> {
  try {
    const certificate = await kv.get(`esign:certificate:${envelopeId}`);

    if (!certificate) {
      return { exists: false };
    }

    return {
      exists: true,
      certificateId: certificate.id,
      storagePath: certificate.storage_path,
      hash: certificate.hash,
      generatedAt: certificate.generated_at,
    };
  } catch (error) {
    log.error('Get certificate exception:', error);
    return { exists: false };
  }
}

/**
 * Auto-generate certificate when envelope completes
 * Called by the signing service after all signers complete
 */
export async function autoGenerateCertificateIfComplete(envelopeId: string): Promise<void> {
  try {
    const eligible = await isEligibleForCertificate(envelopeId);

    if (eligible) {
      log.info(`Auto-generating certificate for envelope ${envelopeId}...`);
      await generateCompletionCertificate(envelopeId);
    }
  } catch (error) {
    log.error('Auto-generate certificate exception:', error);
    // Non-critical, don't throw
  }
}
