/**
 * E-Signature Workflow Service
 * Orchestrates complex multi-step processes like envelope completion
 */

import { 
  updateEnvelopeStatus, 
  getEnvelopeDetails, 
  getEnvelopeSigners, 
  logAuditEvent 
} from "./esign-services.ts";
import { generateCompletionCertificate } from "./esign-certificates.ts";
import { PDFService } from "./esign-pdf.service.ts";
import type { EsignSigner } from "./esign-types.ts";
import { downloadDocument, uploadSignedDocument, calculateHash } from "./esign-storage.ts";
import { sendEmail } from "./email-service.ts";
import { shouldDeliverSenderEvent } from "./esign-notification-prefs.ts";
import { enqueue as enqueueInAppNotification } from "./esign-inapp-notifications.ts";
import { emitWebhookEvent } from "./webhook-service.ts";
import { createEnvelopeCompleteEmail, createSigningCompleteEmail } from "./esign-email-templates.ts";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { encodeBase64 } from "jsr:@std/encoding/base64";
import { createModuleLogger } from "./stderr-logger.ts";
import { getErrMsg } from "./shared-logger-utils.ts";
import { signAndProtectPdf } from "./esign-pdf-protect.ts";
// P4.8 — completion of envelope N may need to trigger envelope N+1 in a
// packet run. The advancement helper is best-effort and never throws so
// the primary completion flow is unaffected by packet failures.
import { advancePacketRunFromCompletion } from "./esign-packet-service.ts";
import * as kv from "./kv_store.tsx";
import { EsignKeys } from "./esign-keys.ts";
import type { EsignEnvelope } from "./esign-types.ts";

const log = createModuleLogger('esign-workflow');

// Lazy Supabase client for admin operations (e.g. getUserById)
// Must NOT be top-level to avoid deployment crashes in edge functions.
const getSupabase = () => createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

/**
 * Complete an envelope:
 * 1. Mark as completed
 * 2. Generate Certificate
 * 3. Burn-in signatures to PDF
 * 4. Merge Certificate
 * 5. Apply digital signature (PKCS#7 seal) to prevent post-signing tampering
 * 6. Upload final artifact
 * 7. Update envelope with artifact path and sealed hash
 * 8. Email all parties with the signed document
 */
export async function completeEnvelope(envelopeId: string): Promise<{ success: boolean; error?: string }> {
  try {
    log.info(`Starting completion workflow for envelope ${envelopeId}`);

    // 1. Mark as completed (if not already)
    // We do this first to prevent race conditions or double completion
    // But we might want to check status first
    const envelope = await getEnvelopeDetails(envelopeId);
    if (!envelope) throw new Error('Envelope not found');

    if (envelope.status !== 'completed') {
        await updateEnvelopeStatus(envelopeId, 'completed', {
            completed_at: new Date().toISOString(),
        });
    }

    // 2. Generate Certificate
    // This also saves the certificate PDF to storage
    const certResult = await generateCompletionCertificate(envelopeId);
    if (!certResult.success || !certResult.pdfBuffer) {
        throw new Error(`Failed to generate certificate: ${certResult.error}`);
    }

    // 3. Prepare for Burn-in
    // Get original document
    const documentPath = envelope.document?.storage_path;
    if (!documentPath) throw new Error('Original document path not found');

    const originalPdfBuffer = await downloadDocument(documentPath);
    if (!originalPdfBuffer) throw new Error('Failed to download original document');

    // Get signers (for burn-in data)
    const signers = await getEnvelopeSigners(envelopeId);

    // Burn-in signatures
    const { pdfBuffer: burnedPdfBuffer } = await PDFService.burnIn(
        originalPdfBuffer,
        envelope.fields || [],
        signers
    );

    // 4. Merge Certificate
    const finalPdfBuffer = await PDFService.mergeCertificate(
        burnedPdfBuffer,
        certResult.pdfBuffer
    );

    // 5. Apply digital signature (PKCS#7 cryptographic seal)
    // This embeds an invisible digital signature that Adobe Reader/Acrobat
    // will display in the Signature Panel. Any modification to the PDF
    // after this point will invalidate the signature.
    const sealedPdfBuffer = await signAndProtectPdf(finalPdfBuffer, {
        reason: `All ${signers.length} signer(s) completed — document sealed`,
        envelopeId,
        envelopeTitle: envelope.title,
    });

    // Compute hash of the final sealed PDF so the /verify page can match it
    const sealedHash = await calculateHash(sealedPdfBuffer);

    // Log audit event for the digital seal
    await logAuditEvent({
        envelopeId,
        actorType: 'system',
        action: 'digital_signature_applied',
        metadata: {
            signerCount: signers.length,
            pdfSizeBytes: sealedPdfBuffer.length,
        },
    });

    // 6. Upload final artifact
    const { path: signedDocPath, error: uploadError } = await uploadSignedDocument(
        envelopeId,
        sealedPdfBuffer
    );

    if (uploadError) throw new Error(`Failed to upload signed document: ${uploadError}`);

    // 7. Update envelope with artifact path and sealed hash
    await updateEnvelopeStatus(envelopeId, 'completed', {
        signed_document_path: signedDocPath,
        signed_document_hash: sealedHash,
    });

    log.success(`Envelope ${envelopeId} completion workflow finished. Artifact: ${signedDocPath}`);

    // 7.5 P4.8 — If the envelope was spawned from a packet run, advance
    //     the run so step N+1 sends automatically. We re-read the
    //     envelope record so we hit the canonical packet provenance
    //     instead of relying on the (possibly stale) `envelope`
    //     reference taken at the top of the workflow.
    try {
      const fresh = (await kv.get(EsignKeys.envelope(envelopeId))) as EsignEnvelope | null;
      if (fresh?.packet_run_id != null && typeof fresh.packet_step_index === 'number') {
        await advancePacketRunFromCompletion(envelopeId, fresh.packet_run_id, fresh.packet_step_index);
      }
    } catch (packetErr) {
      log.warn(`Packet advancement failed for envelope ${envelopeId}: ${getErrMsg(packetErr)}`);
    }

    // 8. Email all parties with the signed document
    try {
        log.info(`Sending completion emails for envelope ${envelopeId}...`);

        const attachmentContent = encodeBase64(sealedPdfBuffer);
        const attachmentName = envelope.document?.original_filename?.replace('.pdf', '_signed.pdf') || 'signed_document.pdf';
        
        const attachments = [{
             content: attachmentContent,
             filename: attachmentName,
             type: 'application/pdf',
             disposition: 'attachment'
        }];

        // Email Sender (Admin/User)
        let senderEmail = '';
        let senderName = 'Sender';
        if (envelope.created_by_user_id) {
             const { data: userData } = await getSupabase().auth.admin.getUserById(envelope.created_by_user_id);
             senderEmail = userData?.user?.email || '';
             senderName = userData?.user?.user_metadata?.full_name || userData?.user?.user_metadata?.name || 'Sender';
        }

        if (senderEmail) {
            const { html, text } = createEnvelopeCompleteEmail({
                senderName: senderName,
                envelopeTitle: envelope.title,
                completedAt: new Date().toISOString(),
                signers: signers.map((s: EsignSigner) => ({ name: s.name, signedAt: s.signed_at || new Date().toISOString() })),
                downloadLink: 'https://www.navigatewealth.co/portal' // TODO: Deep link to envelope
            });

            // P5.2 — completion is terminal; `completion_only` senders MUST
            // still see it. Only `off` and `digest` affect it (and even
            // digest-mode gets a full email because completion carries the
            // signed document attachment that must land immediately).
            const decision = await shouldDeliverSenderEvent(
                envelope.created_by_user_id,
                'envelope.completed',
            );
            if (decision.mode === 'off') {
                log.info(`Completion email suppressed for ${senderEmail} (mode=off)`);
            } else {
                await sendEmail({
                    to: senderEmail,
                    subject: `Completed: ${envelope.title}`,
                    html,
                    text,
                    attachments
                });
            }
        }

        // Email Signers
        for (const signer of signers) {
             if (!signer.email) continue;
             
             const { html, text } = createSigningCompleteEmail({
                 signerName: signer.name,
                 envelopeTitle: envelope.title,
                 signedAt: signer.signed_at || new Date().toISOString(),
                 certificateAvailable: true
             });

             await sendEmail({
                 to: signer.email,
                 subject: `Completed: ${envelope.title}`,
                 html,
                 text,
                 attachments
             });
        }
        
        log.success(`Completion emails sent for envelope ${envelopeId}`);

        // P5.4 — fan-out envelope.completed to firm webhooks.
        void emitWebhookEvent({
            firmId: envelope.firm_id || 'standalone',
            eventType: 'envelope.completed',
            envelopeId,
            payload: {
                envelope: { id: envelope.id, title: envelope.title, status: 'completed' },
                signers: signers.map((s: EsignSigner) => ({
                    id: s.id,
                    name: s.name,
                    email: s.email,
                    signed_at: s.signed_at,
                })),
                completed_at: new Date().toISOString(),
            },
        });

        // P5.7 — bell-UI copy for the sender. Unconditional; the bell is
        // a complete log of envelope activity regardless of email prefs.
        if (envelope.created_by_user_id) {
            void enqueueInAppNotification({
                userId: envelope.created_by_user_id,
                type: 'envelope.completed',
                title: 'Envelope completed',
                body: `"${envelope.title}" was signed by all ${signers.length} recipient(s).`,
                envelopeId,
                metadata: { signer_count: signers.length },
            });
        }

    } catch (emailError) {
        log.error('Failed to send completion emails:', emailError);
        // Don't fail the workflow, just log it
        await logAuditEvent({
            envelopeId,
            actorType: 'system',
            action: 'email_failed',
            metadata: { error: String(emailError) }
        });
    }

    return { success: true };

  } catch (error: unknown) {
    log.error(`Completion workflow failed for envelope ${envelopeId}:`, error);
    
    const errMsg = getErrMsg(error);
    // Log failure
    await logAuditEvent({
        envelopeId,
        actorType: 'system',
        action: 'completion_failed',
        metadata: { error: errMsg }
    });

    return { success: false, error: errMsg };
  }
}