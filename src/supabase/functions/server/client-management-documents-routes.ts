import { Hono } from 'npm:hono';
import { ZipWriter, Uint8ArrayWriter, Uint8ArrayReader } from 'npm:@zip.js/zip.js';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import * as kv from './kv_store.tsx';
import { sendEmail } from './email-service.ts';
import { createServiceClient } from './client-management-utils.ts';
import { requireClientAccess } from './client-access.ts';

const app = new Hono();
const log = createModuleLogger('client-management-documents');

/**
 * POST /upload
 * Upload a document to Supabase Storage
 */
app.post('/upload', async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body['file'];
    const userId = body['userId']; // Optional, for folder structure

    if (!file || !(file instanceof File)) {
      return c.json({ error: 'No file uploaded' }, 400);
    }

    if (typeof userId === 'string') {
      const accessDenied = await requireClientAccess(c, userId);
      if (accessDenied) return accessDenied;
    }

    // Create Supabase client
    const supabase = createServiceClient();
    const bucketName = 'make-91ed8379-client-documents';

    // Ensure bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some((b) => b.name === bucketName);

    if (!bucketExists) {
      await supabase.storage.createBucket(bucketName, {
        public: false,
        fileSizeLimit: 6 * 1024 * 1024, // 6MB
        allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'],
      });
    }

    // Generate safe filename
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = userId ? `${userId}/${timestamp}_${safeName}` : `temp/${timestamp}_${safeName}`;

    // Upload file
    const { data, error } = await supabase.storage.from(bucketName).upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

    if (error) {
      log.error('Upload failed', error);
      return c.json({ error: error.message }, 500);
    }

    // Return the path (not Signed URL yet, frontend requests it when needed)
    return c.json({
      success: true,
      path: data.path,
      fileName: file.name,
    });
  } catch (error) {
    log.error('Error in POST /upload', error);
    return c.json(
      {
        error: 'Upload failed',
        details: getErrMsg(error),
      },
      500,
    );
  }
});

/**
 * POST /send-documents
 * Send encrypted documents to client via email
 */
app.post('/send-documents', async (c) => {
  try {
    const body = await c.req.json();
    const { userId } = body;

    if (!userId) {
      return c.json({ error: 'User ID is required' }, 400);
    }

    const accessDenied = await requireClientAccess(c, userId);
    if (accessDenied) return accessDenied;

    log.info('Sending documents for user', { userId });

    const supabase = createServiceClient();

    // Fetch profile to get ID number (password) and email
    const profileKey = `user_profile:${userId}:personal_info`;
    const profile = await kv.get(profileKey);

    if (!profile) {
      return c.json({ error: 'Profile not found' }, 404);
    }

    // Validate requirements
    const idNumber = profile.idNumber;
    const email = profile.email;
    const documents = profile.identityDocuments || [];

    if (!idNumber) {
      return c.json({ error: 'Client ID number is missing (required for password)' }, 400);
    }

    if (!email) {
      return c.json({ error: 'Client email is missing' }, 400);
    }

    const uploadedDocs = documents.filter(
      (d: Record<string, unknown>) => d.fileName && (d.fileUrl || d.path),
    );

    if (uploadedDocs.length === 0) {
      return c.json({ error: 'No uploaded documents found' }, 400);
    }

    // Create ZIP
    const zipWriter = new ZipWriter(new Uint8ArrayWriter());
    const bucketName = 'make-91ed8379-client-documents';

    for (const doc of uploadedDocs) {
      const filePath = doc.fileUrl || doc.path; // Frontend saves path in fileUrl often

      // Download file from Storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from(bucketName)
        .download(filePath);

      if (downloadError) {
        log.error(`Failed to download file ${doc.fileName}`, downloadError);
        continue;
      }

      // Add to ZIP with password
      const fileBuffer = await fileData.arrayBuffer();
      await zipWriter.add(doc.fileName, new Uint8ArrayReader(new Uint8Array(fileBuffer)), {
        password: idNumber,
        level: 9, // Max compression
      });
    }

    const zipBlob = await zipWriter.close();

    // Convert to Base64
    let binary = '';
    const bytes = new Uint8Array(zipBlob);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Zip = btoa(binary);

    // Send Email
    const emailHtml = `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2>Secure Documents Attached</h2>
        <p>Dear ${profile.firstName || 'Client'},</p>
        <p>Your identity documents have been securely uploaded to your profile.</p>
        <p>Please find them attached in an encrypted ZIP file.</p>
        <p><strong>Password:</strong> Your National ID Number</p>
        <br/>
        <p>Best regards,</p>
        <p>Navigate Wealth Team</p>
      </div>
    `;

    const success = await sendEmail({
      to: email,
      subject: 'Secure Document Upload Notification',
      html: emailHtml,
      attachments: [
        {
          content: base64Zip,
          filename: 'identity_documents.zip',
        },
      ],
    });

    if (!success) {
      return c.json({ error: 'Failed to send email' }, 500);
    }

    return c.json({ success: true, message: 'Documents sent successfully' });
  } catch (error) {
    log.error('Error in /send-documents', error);
    return c.json(
      {
        error: 'Failed to send documents',
        details: getErrMsg(error),
      },
      500,
    );
  }
});

export default app;
