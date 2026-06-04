/**
 * documents-email-routes.ts — POST /:userId/email (Phase 7 max-lines split).
 * Extracted verbatim from documents.tsx; mounted via
 * `app.route('/', documentsEmailRoutes)`. Builds an encrypted ZIP of the
 * selected client documents and emails it to the client. Behaviour-preserving;
 * getSupabase is duplicated (repo's per-module lazy-client pattern).
 */
import { Hono } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { ZipWriter, Uint8ArrayWriter, Uint8ArrayReader } from 'npm:@zip.js/zip.js';
import {
  sendEmail,
  createEmailTemplate,
  getFooterSettings,
  getEmailTemplate,
} from './email-service.ts';
import { encodeBase64 } from 'jsr:@std/encoding/base64';
import type { DocumentMetadata } from './documents.tsx';

const log = createModuleLogger('documents-email-routes');

// Lazy Supabase client — must NOT be top-level to avoid deployment crashes in edge functions.
const getSupabase = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const BUCKET_NAME = 'make-91ed8379-documents';

const documentsEmailRoutes = new Hono();

/**
 * POST /documents/:userId/email
 * Email selected documents to client (Encrypted ZIP)
 */
documentsEmailRoutes.post('/:userId/email', async (c) => {
  try {
    const userId = c.req.param('userId')!;
    const {
      documentIds,
      email: providedEmail,
      idNumber: providedIdNumber,
      emailType,
      customMessage,
      isHtml,
      ccAdmin,
      subject: providedSubject,
      source,
      cc: providedCc,
    } = await c.req.json();

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return c.json({ success: false, error: 'No documents selected' }, 400);
    }

    log.info(`📧 Sending ${documentIds.length} documents to user: ${userId}`);

    let email = providedEmail;
    let idNumber = providedIdNumber;
    let firstName = 'Client';

    // Always fetch latest user profile to ensure we use the current ID number for password
    // This handles the case where ID number was updated but frontend state is stale
    try {
      const profileKey = `user_profile:${userId}:personal_info`;
      const profile = await kv.get(profileKey);

      if (profile) {
        // Only use email from profile if not provided in request
        if (!email && profile.email) {
          email = profile.email;
          log.info(`📧 Using email from profile: ${email}`);
        }

        // Always override ID number with DB value to ensure encryption password is correct
        if (profile.idNumber) {
          idNumber = profile.idNumber;
          log.info(
            `🔑 Using ID number from profile for encryption: ${idNumber.substring(0, 4)}...`,
          );
        }
        firstName = profile.firstName || 'Client';
      }
    } catch (err) {
      log.warn('⚠️ Failed to fetch latest profile, falling back to provided details', {
        error: String(err),
      });
    }

    if (!email) {
      log.error('❌ Client email not found in request or profile');
      return c.json({ success: false, error: 'Client email not found' }, 400);
    }

    log.info(`📧 Sending to: ${email} (CC Admin: ${ccAdmin})`);

    // Safety: If admin is CC'd but admin email is same as client email, disable CC to avoid SendGrid error
    if (ccAdmin && email === 'info@navigatewealth.co') {
      log.warn('⚠️ Client email matches admin email. Disabling CC to prevent SendGrid error.');
      ccAdmin = false;
    }

    if (!idNumber) {
      return c.json(
        { success: false, error: 'Client ID number missing (required for password)' },
        400,
      );
    }

    // --------------------------------------------------------------------------------
    // ZIP STRATEGY (Multi-Zip Support)
    // --------------------------------------------------------------------------------
    // 1. Group documents by subcategory
    // 2. Create one Encrypted ZIP per subcategory
    // 3. Attach all ZIPs to the email
    // --------------------------------------------------------------------------------

    const docsBySubcategory: Record<string, DocumentMetadata[]> = {};
    const attachments: { content: string; filename: string; type: string; disposition: string }[] =
      [];

    // 1. Fetch and Group Documents
    for (const docId of documentIds) {
      const docData = await kv.get(`document:${userId}:${docId}`);

      if (!docData || docData.type !== 'document' || !docData.filePath) {
        continue;
      }

      // Use subcategory if available, otherwise fallback to "Documents" (or packTitle if present?)
      // We want to avoid generic "Documents" if possible, but for loose files it's fine.
      // Sanitize key to be safe for filenames
      const rawKey = docData.subcategory || 'Documents';
      // Basic sanitization for map key (display name handled later)
      const key = rawKey;

      if (!docsBySubcategory[key]) {
        docsBySubcategory[key] = [];
      }
      docsBySubcategory[key].push(docData);
    }

    if (Object.keys(docsBySubcategory).length === 0) {
      return c.json({ success: false, error: 'No valid files found to send' }, 400);
    }

    // 2. Generate ZIPs
    for (const [subcatName, docs] of Object.entries(docsBySubcategory)) {
      const zipWriter = new ZipWriter(new Uint8ArrayWriter(), {
        bufferedWrite: true,
        useWebWorkers: false,
        zip64: false,
      });

      // Create a friendly folder name inside the zip
      // e.g. "Compliance" -> "Compliance/"
      const safeSubcatName = subcatName.replace(/[^a-zA-Z0-9\s-_]/g, '').trim() || 'Documents';
      const folderName = `${safeSubcatName}/`; // Folder inside zip matches subcategory name

      let filesAdded = 0;

      for (const docData of docs) {
        // Download file
        const { data: fileData, error: downloadError } = await getSupabase()
          .storage.from(BUCKET_NAME)
          .download(docData.filePath!);

        if (downloadError) {
          log.error(`❌ Failed to download ${docData.fileName}`, downloadError);
          continue;
        }

        const fileBuffer = await fileData.arrayBuffer();

        // Sanitize filename
        const originalName = docData.fileName || `document_${docData.id}.pdf`;
        const lastDotIndex = originalName.lastIndexOf('.');
        let namePart = lastDotIndex !== -1 ? originalName.substring(0, lastDotIndex) : originalName;
        const extPart = lastDotIndex !== -1 ? originalName.substring(lastDotIndex) : '';

        namePart = namePart.replace(/[^a-zA-Z0-9_-]/g, '_');
        if (/^[^a-zA-Z0-9]/.test(namePart)) namePart = 'doc_' + namePart;
        if (namePart.length > 50) namePart = namePart.substring(0, 50);

        // Path inside zip: Subcategory/Filename.ext
        const safeFileName = `${folderName}${namePart}${extPart}`;

        await zipWriter.add(safeFileName, new Uint8ArrayReader(new Uint8Array(fileBuffer)), {
          level: 0, // No compression needed
          password: String(idNumber), // Encrypt this file
          zipCrypto: true, // Standard ZipCrypto for compatibility
        });
        filesAdded++;
      }

      if (filesAdded > 0) {
        const finalZipBlob = await zipWriter.close();
        const base64Zip = encodeBase64(finalZipBlob);

        // Zip filename: Compliance.zip
        const zipFilename = `${safeSubcatName.replace(/\s+/g, '_')}.zip`;

        attachments.push({
          content: base64Zip,
          filename: zipFilename,
          type: 'application/zip',
          disposition: 'attachment',
        });

        log.info(`📦 Generated ZIP: ${zipFilename} (${base64Zip.length} chars)`);
      }
    }

    if (attachments.length === 0) {
      return c.json({ success: false, error: 'Failed to generate any valid ZIP files' }, 500);
    }

    // Get email template and settings
    const footerSettings = await getFooterSettings();
    const templateId =
      emailType === 'resend' ? 'resend_documents_notification' : 'new_documents_notification';
    const template = await getEmailTemplate(templateId);

    // Resolve variables
    const resolve = (text: string) => {
      if (!text) return '';
      let resolved = text.replace(/\{\{ \.Name \}\}/g, firstName || 'Client');

      // Resolve CustomMessage with appropriate defaults
      const defaultMsg =
        emailType === 'resend'
          ? '<p>Please find attached the documents you requested.</p>'
          : '<p>New documents have been uploaded to your profile.</p>';

      let msg = defaultMsg;
      if (customMessage) {
        if (isHtml) {
          msg = customMessage;

          // Fix line spacing for Communication Tab
          if (source === 'communication_tab') {
            // 1. Force tight margins on paragraphs
            msg = msg.replace(/<p>/gi, '<p style="margin: 0 0 10px 0;">');
            // 2. Ensure div based editors don't cause issues
            msg = msg.replace(/<div>/gi, '<div style="margin: 0 0 10px 0;">');
          }
        } else {
          msg = `<p>${customMessage.replace(/\n/g, '<br/>')}</p>`;
        }
      }

      resolved = resolved.replace(/\{\{ \.CustomMessage \}\}/g, msg);

      return resolved;
    };

    let subject = resolve(template.subject);
    const title = resolve(template.title);
    const subtitle = resolve(template.subtitle);
    const bodyContent = resolve(template.bodyHtml);
    let greeting = resolve(template.greeting);
    const buttonLabel = resolve(template.buttonLabel);
    const buttonUrl = resolve(template.buttonUrl);

    // Override for Communication Tab
    if (source === 'communication_tab') {
      // 1. Use custom subject if provided
      if (providedSubject) {
        subject = providedSubject;
      }

      // 2. Remove automatic greeting (user provides it in body)
      greeting = '';
    }

    // Construct plain text version to avoid spam filters
    const customMessageText = customMessage
      ? isHtml
        ? customMessage
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
        : customMessage
      : emailType === 'resend'
        ? 'Please find attached the documents you requested.'
        : 'New documents have been uploaded to your profile.';

    const textBody = `
${title}
${subtitle}

${greeting}

${customMessageText}

They are attached to this email in secure, encrypted ZIP files.
Password: Your National ID Number

Please log in to your portal to view them online.

${buttonLabel}: ${buttonUrl}

${template.footerNote || ''}
    `.trim();

    const emailHtml = createEmailTemplate(bodyContent, {
      title,
      subtitle,
      greeting,
      buttonUrl,
      buttonLabel,
      footerSettings,
    });

    // Prepare CC list
    const finalCc: string[] = [];
    if (ccAdmin) finalCc.push('info@navigatewealth.co');
    if (providedCc && Array.isArray(providedCc)) {
      // Filter out duplicates and the To address
      const uniqueCc = providedCc.filter((c) => c && c !== email && !finalCc.includes(c));
      finalCc.push(...uniqueCc);
    }

    const success = await sendEmail({
      to: email,
      cc: finalCc.length > 0 ? finalCc : undefined,
      subject,
      html: emailHtml,
      text: textBody,
      attachments: attachments,
    });

    if (!success) {
      return c.json({ success: false, error: 'Failed to send email' }, 500);
    }

    return c.json({ success: true, message: 'Documents sent successfully' });
  } catch (error: unknown) {
    log.error('❌ Error sending documents email:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to send email' },
      500,
    );
  }
});

export default documentsEmailRoutes;
