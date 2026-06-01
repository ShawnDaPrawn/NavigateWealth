/**
 * email-senders-esign.ts — e-signature flow emails (Phase 5c).
 * ============================================================================
 *
 * Extracted verbatim from email-service.tsx; the SendGrid transport + template
 * engine live in email-core.ts. email-service.tsx re-exports this module so the
 * email-service.ts proxy surface is unchanged.
 */
import { createModuleLogger } from './stderr-logger.ts';
import {
  sendEmail,
  createEmailTemplate,
  getFooterSettings,
  getEmailTemplate,
} from './email-core.ts';

const log = createModuleLogger('email-senders-esign');

/**
 * Send e-signature invitation email
 */
export async function sendEsignInvitation(params: {
  to: string;
  recipientName: string;
  senderName: string;
  documentName: string;
  signingUrl: string;
}): Promise<boolean> {
  const { to, recipientName, senderName, documentName, signingUrl } = params;

  // Get template from KV store with fallback to default
  const template = await getEmailTemplate('signature_request');

  // Check if template is enabled
  if (!template.enabled) {
    log.info('Signature request email disabled, skipping send', { to });
    return true; // Return success but don't send
  }

  const footerSettings = await getFooterSettings();

  // Helper to replace variables
  const resolve = (text: string) => {
    return text
      .replace(/\{\{ \.RecipientName \}\}/g, recipientName)
      .replace(/\{\{ \.SenderName \}\}/g, senderName)
      .replace(/\{\{ \.DocumentName \}\}/g, documentName)
      .replace(/\{\{ \.SigningUrl \}\}/g, signingUrl);
  };

  const subject = resolve(template.subject);
  const title = resolve(template.title);
  const subtitle = resolve(template.subtitle);
  const greeting = resolve(template.greeting);
  const bodyContent = resolve(template.bodyHtml);
  const buttonLabel = resolve(template.buttonLabel);
  const buttonUrl = resolve(template.buttonUrl);
  const footerNote = resolve(template.footerNote);

  const html = createEmailTemplate(bodyContent, {
    title,
    subtitle,
    greeting,
    buttonUrl,
    buttonLabel,
    footerNote,
    footerSettings,
  });

  const text = `
${greeting}

${senderName} has sent you a document to sign: ${documentName}

Review and sign: ${signingUrl}

${footerNote}
  `.trim();

  return await sendEmail({ to, subject, html, text });
}

/**
 * Send e-signature reminder email
 */
export async function sendEsignReminder(params: {
  to: string;
  recipientName: string;
  documentName: string;
  signingUrl: string;
}): Promise<boolean> {
  const { to, recipientName, documentName, signingUrl } = params;

  const footerSettings = await getFooterSettings();

  const html = createEmailTemplate(
    `
      <p>Hello ${recipientName},</p>
      <p>This is a friendly reminder that you have a pending signature request for: <strong>${documentName}</strong></p>
      <p>Please click the button below to review and sign the document at your earliest convenience.</p>
    `,
    {
      title: 'Reminder: Signature Request',
      buttonUrl: signingUrl,
      buttonLabel: 'Review & Sign Document',
      footerNote: "This is an automated reminder from Navigate Wealth's e-signature platform.",
      footerSettings,
    },
  );

  const text = `
Hello ${recipientName},

This is a friendly reminder that you have a pending signature request for: ${documentName}

Review and sign: ${signingUrl}

This is an automated reminder from Navigate Wealth's e-signature platform.
  `.trim();

  return await sendEmail({
    to,
    subject: `Reminder: Signature Request for ${documentName}`,
    html,
    text,
  });
}

/**
 * Send e-signature recall notification
 */
export async function sendRecallNotification(params: {
  to?: string;
  recipientName?: string;
  documentName?: string;
  signerEmail?: string;
  signerName?: string;
  envelopeTitle?: string;
  reason?: string;
}): Promise<boolean> {
  // Support both parameter formats for backwards compatibility
  const to = params.to || params.signerEmail!;
  const recipientName = params.recipientName || params.signerName!;
  const documentName = params.documentName || params.envelopeTitle!;

  const footerSettings = await getFooterSettings();

  const html = createEmailTemplate(
    `
      <p>Hello ${recipientName},</p>
      <p>The signature request for <strong>${documentName}</strong> has been recalled by the sender.</p>
      <p>No action is required from you. If you have any questions, please contact Navigate Wealth directly.</p>
    `,
    {
      title: 'Signature Request Recalled',
      footerNote: "This notification was sent via Navigate Wealth's e-signature platform.",
      footerSettings,
    },
  );

  const text = `
Hello ${recipientName},

The signature request for ${documentName} has been recalled by the sender.

No action is required from you. If you have any questions, please contact Navigate Wealth directly.

This notification was sent via Navigate Wealth's e-signature platform.
  `.trim();

  return await sendEmail({
    to,
    subject: `Signature Request Recalled: ${documentName}`,
    html,
    text,
  });
}

/**
 * Send e-signature completion notification
 */
export async function sendCompletionNotification(params: {
  to: string;
  recipientName: string;
  documentName: string;
}): Promise<boolean> {
  const { to, recipientName, documentName } = params;

  const footerSettings = await getFooterSettings();

  const html = createEmailTemplate(
    `
      <p>Hello ${recipientName},</p>
      <p>Great news! The document <strong>${documentName}</strong> has been fully executed.</p>
      <p>All required signatures have been collected. You can access the completed document from your Navigate Wealth portal.</p>
    `,
    {
      title: 'Document Completed',
      buttonUrl: 'https://www.navigatewealth.co/portal',
      buttonLabel: 'View Document',
      footerNote: "This notification was sent via Navigate Wealth's e-signature platform.",
      footerSettings,
    },
  );

  const text = `
Hello ${recipientName},

Great news! The document ${documentName} has been fully executed.

All required signatures have been collected. You can access the completed document from your Navigate Wealth portal.

View portal: https://www.navigatewealth.co/portal

This notification was sent via Navigate Wealth's e-signature platform.
  `.trim();

  return await sendEmail({ to, subject: `Document Completed: ${documentName}`, html, text });
}

/**
 * Wrapper for sendEsignInvitation - maps parameter names used by esign-routes.tsx
 */
export async function sendSigningInvitation(params: {
  signerEmail: string;
  signerName: string;
  envelopeTitle: string;
  signingUrl: string;
  message?: string;
}): Promise<boolean> {
  return await sendEsignInvitation({
    to: params.signerEmail,
    recipientName: params.signerName,
    senderName: 'Navigate Wealth',
    documentName: params.envelopeTitle,
    signingUrl: params.signingUrl,
  });
}

/**
 * Wrapper for sendEsignReminder - maps parameter names used by esign-routes.tsx
 */
export async function sendSigningReminder(params: {
  signerEmail: string;
  signerName: string;
  envelopeTitle: string;
  signingUrl: string;
  expiresAt?: string;
}): Promise<boolean> {
  return await sendEsignReminder({
    to: params.signerEmail,
    recipientName: params.signerName,
    documentName: params.envelopeTitle,
    signingUrl: params.signingUrl,
  });
}

/**
 * Override sendRecallNotification to match the parameter names used by esign-routes.tsx
 */
export async function sendRecallNotificationWrapper(params: {
  signerEmail: string;
  signerName: string;
  envelopeTitle: string;
  reason?: string;
}): Promise<boolean> {
  return await sendRecallNotification({
    to: params.signerEmail,
    recipientName: params.signerName,
    documentName: params.envelopeTitle,
  });
}
