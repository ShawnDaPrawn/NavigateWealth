/**
 * Document Management Routes
 * Handles document uploads, links, and client document history
 */

import { Hono } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import { ZipWriter, Uint8ArrayWriter, Uint8ArrayReader } from "npm:@zip.js/zip.js";
import { sendEmail, createEmailTemplate, getFooterSettings, getEmailTemplate } from './email-service.ts';
import { encodeBase64 } from "jsr:@std/encoding/base64";
import {
  CreateDocumentLinkSchema,
  UpdateDocumentSchema,
} from './documents-validation.ts';
import { formatZodError } from './shared-validation-utils.ts';

const app = new Hono();
const log = createModuleLogger('documents');

// Root handlers
app.get('/', (c) => c.json({ service: 'documents', status: 'active' }));
app.get('', (c) => c.json({ service: 'documents', status: 'active' }));

// Lazy Supabase client — must NOT be top-level to avoid deployment crashes in edge functions.
const getSupabase = () => createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const BUCKET_NAME = 'make-91ed8379-documents';

// Lazy bucket initialization — called on first request, not at module load time.
let bucketInitialized = false;
async function ensureBucket() {
  if (bucketInitialized) return;
  try {
    const supabase = getSupabase();
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(bucket => bucket.name === BUCKET_NAME);
    
    if (!bucketExists) {
      log.info(`📁 Creating storage bucket: ${BUCKET_NAME}`);
      const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: false,
        fileSizeLimit: 52428800, // 50MB
        allowedMimeTypes: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'image/jpeg',
          'image/png',
          'image/gif'
        ]
      });
      
      if (error) {
        if (error.message && error.message.includes('already exists')) {
          log.info('✅ Storage bucket already exists');
        } else {
          log.error('❌ Error creating bucket:', error);
        }
      } else {
        log.info('✅ Storage bucket created successfully');
      }
    } else {
      log.info('✅ Storage bucket already exists');
    }
    bucketInitialized = true;
  } catch (error) {
    const errorMessage = getErrMsg(error);
    if (errorMessage.includes('already exists')) {
      log.info('✅ Storage bucket already exists');
      bucketInitialized = true;
    } else {
      log.warn('⚠️ Error initializing bucket (non-critical):', { error });
    }
  }
}

interface DocumentMetadata {
  id: string;
  userId: string;
  type: 'document' | 'link';
  title: string;
  uploadDate: string;
  productCategory: 'Life' | 'Short-Term' | 'Investment' | 'Medical Aid' | 'Retirement' | 'Estate' | 'General';
  policyNumber: string;
  status: 'new' | 'viewed';
  isFavourite: boolean;
  uploadedBy: string; // Admin user ID who uploaded
  // Grouping
  packId?: string;
  packTitle?: string;
  subcategory?: string;
  // Document specific
  fileName?: string;
  fileSize?: number;
  filePath?: string;
  // Link specific
  url?: string;
  description?: string;
  // Visibility
  isHidden?: boolean;
}

/**
 * GET /documents/:userId
 * Get all documents for a specific user
 */
app.get('/:userId', async (c) => {
  try {
    const userId = c.req.param('userId');
    log.info(`📄 Fetching documents for user: ${userId}`);

    // Get document metadata from KV store
    const documents = await kv.getByPrefix(`document:${userId}:`);
    
    // Filter out null/undefined values and ensure all documents have valid data
    // Note: getByPrefix returns an array of values directly, not {key, value} objects
    const validDocuments = documents
      .filter(doc => doc && doc.id)
      .filter(doc => doc !== null && doc !== undefined)
      .filter(doc => !doc.isHidden); // Filter out hidden documents (e.g. from communication tab)
    
    log.info(`✅ Found ${validDocuments.length} documents for user ${userId}`);
    
    return c.json({
      success: true,
      count: validDocuments.length,
      documents: validDocuments
    });
  } catch (error) {
    log.error('❌ Error fetching documents:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ success: false, error: errorMessage }, 500);
  }
});

/**
 * POST /documents/:userId/upload
 * Upload a document file for a user
 */
app.post('/:userId/upload', async (c) => {
  try {
    const userId = c.req.param('userId');
    
    // Wrap formData() in try/catch — the native parser uses forEach()
    // internally, which throws if the body is not valid multipart/form-data
    // (e.g. missing/malformed Content-Type boundary, already-consumed stream).
    let formData: FormData;
    try {
      formData = await c.req.formData();
    } catch (parseErr: unknown) {
      log.error('Failed to parse multipart form data:', parseErr);
      return c.json({
        success: false,
        error: 'Invalid form data. Ensure the request uses multipart/form-data encoding.',
      }, 400);
    }
    
    const file = formData.get('file') as File;
    const title = formData.get('title') as string;
    const productCategory = formData.get('productCategory') as string;
    const policyNumber = formData.get('policyNumber') as string;
    const uploadedBy = formData.get('uploadedBy') as string;
    const packId = formData.get('packId') as string;
    const packTitle = formData.get('packTitle') as string;
    const subcategory = formData.get('subcategory') as string;
    const isHidden = formData.get('isHidden') === 'true';

    if (!file) {
      return c.json({ success: false, error: 'No file provided' }, 400);
    }

    log.info(`📤 Uploading document: ${file.name} for user: ${userId}`);

    // Generate unique file path
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${userId}/${timestamp}_${sanitizedFileName}`;

    // Upload file to Supabase Storage
    const fileBuffer = await file.arrayBuffer();
    const { data: uploadData, error: uploadError } = await getSupabase().storage
      .from(BUCKET_NAME)
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      log.error('❌ Upload error:', uploadError);
      return c.json({ success: false, error: uploadError.message }, 500);
    }

    log.info('✅ File uploaded to storage:', { filePath });

    // Create document metadata
    const documentId = `doc_${timestamp}`;
    const metadata: DocumentMetadata = {
      id: documentId,
      userId,
      type: 'document',
      title: title || file.name.replace(/\.[^/.]+$/, ''),
      fileName: file.name,
      fileSize: file.size,
      filePath,
      uploadDate: new Date().toISOString(),
      productCategory: (productCategory as string) || 'General',
      policyNumber: policyNumber || '',
      status: 'new',
      isFavourite: false,
      uploadedBy,
      packId: packId || undefined,
      packTitle: packTitle || undefined,
      subcategory: subcategory || undefined,
      isHidden
    };

    // Store metadata in KV
    await kv.set(`document:${userId}:${documentId}`, metadata);

    log.info('✅ Document metadata saved');

    return c.json({
      success: true,
      document: metadata
    });
  } catch (error: unknown) {
    log.error('❌ Error uploading document:', error);
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed to upload document' }, 500);
  }
});

/**
 * POST /documents/:userId/link
 * Create a link reference for a user
 */
app.post('/:userId/link', async (c) => {
  try {
    const userId = c.req.param('userId');
    const body = await c.req.json();
    
    const parsed = CreateDocumentLinkSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ success: false, error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }
    const { title, url, description, productCategory, policyNumber, uploadedBy } = parsed.data;

    log.info(`🔗 Creating link for user: ${userId} - ${title}`);

    const timestamp = Date.now();
    const linkId = `link_${timestamp}`;
    
    const metadata: DocumentMetadata = {
      id: linkId,
      userId,
      type: 'link',
      title,
      url,
      description: description || '',
      uploadDate: new Date().toISOString(),
      productCategory: productCategory || 'General',
      policyNumber: policyNumber || '',
      status: 'new',
      isFavourite: false,
      uploadedBy
    };

    // Store metadata in KV
    await kv.set(`document:${userId}:${linkId}`, metadata);

    log.info('✅ Link metadata saved');

    return c.json({
      success: true,
      document: metadata
    });
  } catch (error: unknown) {
    log.error('❌ Error creating link:', error);
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed to create link' }, 500);
  }
});

/**
 * GET /documents/:userId/:documentId/download
 * Get a signed URL for downloading a document
 */
app.get('/:userId/:documentId/download', async (c) => {
  try {
    const userId = c.req.param('userId');
    const documentId = c.req.param('documentId');

    log.info(`⬇️ Generating download URL for: ${documentId}`);

    // Get document metadata
    const docData = await kv.get(`document:${userId}:${documentId}`);
    
    if (!docData || !docData.filePath) {
      return c.json({ success: false, error: 'Document not found' }, 404);
    }

    // Generate signed URL (valid for 1 hour)
    const { data: signedUrlData, error: signedUrlError } = await getSupabase().storage
      .from(BUCKET_NAME)
      .createSignedUrl(docData.filePath, 3600);

    if (signedUrlError) {
      log.error('❌ Signed URL error:', signedUrlError);
      return c.json({ success: false, error: signedUrlError.message }, 500);
    }

    log.info('✅ Signed URL generated');

    return c.json({
      success: true,
      url: signedUrlData.signedUrl,
      fileName: docData.fileName
    });
  } catch (error: unknown) {
    log.error('❌ Error generating download URL:', error);
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed to generate download URL' }, 500);
  }
});

/**
 * PATCH /documents/:userId/:documentId
 * Update document metadata (mark as viewed, toggle favorite, etc.)
 */
app.patch('/:userId/:documentId', async (c) => {
  try {
    const userId = c.req.param('userId');
    const documentId = c.req.param('documentId');
    const body = await c.req.json();
    const parsed = UpdateDocumentSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ success: false, error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }
    const updates = parsed.data;

    log.info(`✏️ Updating document: ${documentId}`, updates);

    // Get existing document
    const existingDoc = await kv.get(`document:${userId}:${documentId}`);
    
    if (!existingDoc) {
      return c.json({ success: false, error: 'Document not found' }, 404);
    }

    // Merge updates
    const updatedDoc = {
      ...existingDoc,
      ...updates
    };

    // Save updated document
    await kv.set(`document:${userId}:${documentId}`, updatedDoc);

    log.info('✅ Document updated');

    return c.json({
      success: true,
      document: updatedDoc
    });
  } catch (error: unknown) {
    log.error('❌ Error updating document:', error);
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed to update document' }, 500);
  }
});

/**
 * POST /documents/:userId/email
 * Email selected documents to client (Encrypted ZIP)
 */
app.post('/:userId/email', async (c) => {
  try {
    const userId = c.req.param('userId');
    const { documentIds, email: providedEmail, idNumber: providedIdNumber, emailType, customMessage, isHtml, ccAdmin, subject: providedSubject, source, cc: providedCc } = await c.req.json();

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
          log.info(`🔑 Using ID number from profile for encryption: ${idNumber.substring(0, 4)}...`);
        }
        firstName = profile.firstName || 'Client';
      }
    } catch (err) {
      log.warn('⚠️ Failed to fetch latest profile, falling back to provided details', err);
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
      return c.json({ success: false, error: 'Client ID number missing (required for password)' }, 400);
    }

    // --------------------------------------------------------------------------------
    // ZIP STRATEGY (Multi-Zip Support)
    // --------------------------------------------------------------------------------
    // 1. Group documents by subcategory
    // 2. Create one Encrypted ZIP per subcategory
    // 3. Attach all ZIPs to the email
    // --------------------------------------------------------------------------------

    const docsBySubcategory: Record<string, DocumentMetadata[]> = {};
    const attachments: { content: string; filename: string; type: string; disposition: string }[] = [];

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
        zip64: false
      });
      
      // Create a friendly folder name inside the zip
      // e.g. "Compliance" -> "Compliance/"
      const safeSubcatName = subcatName.replace(/[^a-zA-Z0-9\s-_]/g, '').trim() || 'Documents';
      const folderName = `${safeSubcatName}/`; // Folder inside zip matches subcategory name

      let filesAdded = 0;

      for (const docData of docs) {
        // Download file
        const { data: fileData, error: downloadError } = await getSupabase().storage
          .from(BUCKET_NAME)
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
          zipCrypto: true // Standard ZipCrypto for compatibility
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
          disposition: 'attachment'
        });
        
        log.info(`📦 Generated ZIP: ${zipFilename} (${base64Zip.length} chars)`);
      }
    }

    if (attachments.length === 0) {
      return c.json({ success: false, error: 'Failed to generate any valid ZIP files' }, 500);
    }

    // Get email template and settings
    const footerSettings = await getFooterSettings();
    const templateId = emailType === 'resend' ? 'resend_documents_notification' : 'new_documents_notification';
    const template = await getEmailTemplate(templateId);

    // Resolve variables
    const resolve = (text: string) => {
      if (!text) return '';
      let resolved = text.replace(/\{\{ \.Name \}\}/g, firstName || 'Client');

      // Resolve CustomMessage with appropriate defaults
      let defaultMsg = '';
      if (emailType === 'resend') {
         defaultMsg = '<p>Please find attached the documents you requested.</p>';
      } else {
         defaultMsg = '<p>New documents have been uploaded to your profile.</p>';
      }

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
      ? (isHtml ? customMessage.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : customMessage)
      : (emailType === 'resend' 
          ? 'Please find attached the documents you requested.' 
          : 'New documents have been uploaded to your profile.');

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
    
    const emailHtml = createEmailTemplate(
      bodyContent,
      {
        title,
        subtitle,
        greeting,
        buttonUrl,
        buttonLabel,
        footerSettings
      }
    );

    // Prepare CC list
    const finalCc: string[] = [];
    if (ccAdmin) finalCc.push('info@navigatewealth.co');
    if (providedCc && Array.isArray(providedCc)) {
      // Filter out duplicates and the To address
      const uniqueCc = providedCc.filter(c => c && c !== email && !finalCc.includes(c));
      finalCc.push(...uniqueCc);
    }

    const success = await sendEmail({
      to: email,
      cc: finalCc.length > 0 ? finalCc : undefined,
      subject,
      html: emailHtml,
      text: textBody,
      attachments: attachments
    });

    if (!success) {
      return c.json({ success: false, error: 'Failed to send email' }, 500);
    }

    return c.json({ success: true, message: 'Documents sent successfully' });

  } catch (error: unknown) {
    log.error('❌ Error sending documents email:', error);
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed to send email' }, 500);
  }
});

/**
 * DELETE /documents/:userId/:documentId
 * Delete a document (both metadata and file if applicable)
 */
app.delete('/:userId/:documentId', async (c) => {
  try {
    const userId = c.req.param('userId');
    const documentId = c.req.param('documentId');

    log.info(`🗑️ Deleting document: ${documentId}`);

    // Get document metadata
    const docData = await kv.get(`document:${userId}:${documentId}`);
    
    if (!docData) {
      // Idempotent: If document is already gone, return success
      log.info('⚠️ Document not found, assuming already deleted');
      return c.json({
        success: true,
        message: 'Document deleted successfully'
      });
    }

    // If it's a file document, delete from storage
    if (docData.type === 'document' && docData.filePath) {
      const { error: deleteError } = await getSupabase().storage
        .from(BUCKET_NAME)
        .remove([docData.filePath]);

      if (deleteError) {
        log.warn('⚠️ Error deleting file from storage:', deleteError);
        // Continue anyway to delete metadata
      } else {
        log.info('✅ File deleted from storage');
      }
    }

    // Delete metadata from KV
    await kv.del(`document:${userId}:${documentId}`);

    log.info('✅ Document metadata deleted');

    return c.json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error: unknown) {
    log.error('❌ Error deleting document:', error);
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed to delete document' }, 500);
  }
});

export default app;