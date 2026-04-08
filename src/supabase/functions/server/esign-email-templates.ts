/**
 * E-Signature Email Templates
 * Professional HTML email templates for e-signature notifications.
 *
 * Exports consumed by:
 *   - esign-routes.tsx  -> createSigningInviteEmail, createOTPEmail
 *   - esign-workflow.ts -> createEnvelopeCompleteEmail, createSigningCompleteEmail
 *
 * @module esign-email-templates
 */

import { createEmailTemplate, createPlainTextEmail } from './email-service.tsx';

// --------------------------------------------------------------------------
// Shared helpers
// --------------------------------------------------------------------------

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-ZA', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (_e) {
    return iso;
  }
}

// --------------------------------------------------------------------------
// 1. Signing Invite Email  (used by esign-routes.tsx)
// --------------------------------------------------------------------------

interface SigningInviteParams {
  signerName: string;
  envelopeTitle: string;
  senderName: string;
  signingLink: string;
  message?: string;
}

export function createSigningInviteEmail(
  params: SigningInviteParams
): { html: string; text: string } {
  const { signerName, envelopeTitle, senderName, signingLink, message } = params;

  const messageBlock = message
    ? '<p style="margin:16px 0;padding:12px 16px;background:#f9fafb;border-left:4px solid #6d28d9;border-radius:4px;">' + message + '</p>'
    : '';

  const bodyHtml =
    '<p>Hello ' + signerName + ',</p>' +
    '<p><strong>' + senderName + '</strong> has sent you a document to sign: <strong>' + envelopeTitle + '</strong></p>' +
    messageBlock +
    '<p>Please click the button below to review and sign the document.</p>';

  const html = createEmailTemplate(bodyHtml, {
    title: 'Document Signature Request',
    subtitle: 'Your signature is required',
    buttonUrl: signingLink,
    buttonLabel: 'Review & Sign Document',
    footerNote: "This signature request was sent via Navigate Wealth's secure e-signature platform.",
  });

  const textParts: string[] = [
    'Hello ' + signerName + ',',
    '',
    senderName + ' has sent you a document to sign: ' + envelopeTitle,
  ];
  if (message) {
    textParts.push('');
    textParts.push('Message: ' + message);
  }
  textParts.push('');
  textParts.push('Review and sign: ' + signingLink);

  const text = createPlainTextEmail(textParts.join('\n'));

  return { html, text };
}

// --------------------------------------------------------------------------
// 2. OTP Verification Email  (used by esign-routes.tsx)
// --------------------------------------------------------------------------

interface OTPEmailParams {
  signerName: string;
  otp: string;
  envelopeTitle: string;
  expiresInMinutes: number;
}

export function createOTPEmail(
  params: OTPEmailParams
): { html: string; text: string } {
  const { signerName, otp, envelopeTitle, expiresInMinutes } = params;

  const bodyHtml =
    '<p>Hello ' + signerName + ',</p>' +
    '<p>Your verification code for signing <strong>' + envelopeTitle + '</strong> is:</p>' +
    '<div style="text-align:center;margin:24px 0;">' +
    '<span style="display:inline-block;font-size:32px;font-weight:700;letter-spacing:8px;padding:16px 32px;background:#f3f4f6;border-radius:8px;color:#111827;">' + otp + '</span>' +
    '</div>' +
    '<p>This code expires in <strong>' + expiresInMinutes + ' minutes</strong>. If you did not request this code, please ignore this email.</p>';

  const html = createEmailTemplate(bodyHtml, {
    title: 'Verification Code',
    subtitle: envelopeTitle,
    footerNote: "This verification code was sent via Navigate Wealth's secure e-signature platform.",
  });

  const text = createPlainTextEmail(
    'Hello ' + signerName + ',\n\n' +
    'Your verification code for signing "' + envelopeTitle + '" is: ' + otp + '\n\n' +
    'This code expires in ' + expiresInMinutes + ' minutes.\n' +
    'If you did not request this code, please ignore this email.'
  );

  return { html, text };
}

// --------------------------------------------------------------------------
// 3. Envelope Complete Email  (used by esign-workflow.ts — sent to sender)
// --------------------------------------------------------------------------

interface EnvelopeCompleteParams {
  senderName: string;
  envelopeTitle: string;
  completedAt: string;
  signers: Array<{ name: string; signedAt: string }>;
  downloadLink: string;
}

export function createEnvelopeCompleteEmail(
  params: EnvelopeCompleteParams
): { html: string; text: string } {
  const { senderName, envelopeTitle, completedAt, signers, downloadLink } = params;

  let signerRows = '';
  for (let i = 0; i < signers.length; i++) {
    const s = signers[i];
    signerRows +=
      '<tr>' +
      '<td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">' + s.name + '</td>' +
      '<td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">' + formatDate(s.signedAt) + '</td>' +
      '</tr>';
  }

  const bodyHtml =
    '<p>Hello ' + senderName + ',</p>' +
    '<p>All signatures have been collected for <strong>' + envelopeTitle + '</strong>. The document was completed on <strong>' + formatDate(completedAt) + '</strong>.</p>' +
    '<table style="width:100%;border-collapse:collapse;margin:16px 0;">' +
    '<thead><tr style="background:#f9fafb;">' +
    '<th style="text-align:left;padding:8px 12px;border-bottom:2px solid #e5e7eb;">Signer</th>' +
    '<th style="text-align:left;padding:8px 12px;border-bottom:2px solid #e5e7eb;">Signed At</th>' +
    '</tr></thead>' +
    '<tbody>' + signerRows + '</tbody>' +
    '</table>' +
    '<p>A copy of the fully executed document with a completion certificate is attached to this email. You can also access it from your portal.</p>' +
    '<div style="margin-top:20px;padding:12px 16px;background:#f3f4f6;border-radius:8px;border-left:3px solid #7c3aed;">' +
    '<p style="margin:0;font-size:13px;color:#4b5563;">' +
    '<strong style="color:#7c3aed;">Verify this document</strong><br>' +
    'You can independently verify the integrity of the attached PDF at any time by uploading it to our ' +
    '<a href="https://www.navigatewealth.co/verify" style="color:#7c3aed;text-decoration:underline;">Document Verification</a> page.' +
    '</p></div>';

  const html = createEmailTemplate(bodyHtml, {
    title: 'Document Completed',
    subtitle: envelopeTitle,
    buttonUrl: downloadLink,
    buttonLabel: 'View in Portal',
    footerNote: "This notification was sent via Navigate Wealth's secure e-signature platform. Verify document integrity at navigatewealth.co/verify",
  });

  const signerLines: string[] = [];
  for (let i = 0; i < signers.length; i++) {
    const s = signers[i];
    signerLines.push('  - ' + s.name + ' (signed ' + formatDate(s.signedAt) + ')');
  }

  const text = createPlainTextEmail(
    'Hello ' + senderName + ',\n\n' +
    'All signatures have been collected for "' + envelopeTitle + '".\n' +
    'Completed: ' + formatDate(completedAt) + '\n\n' +
    'Signers:\n' + signerLines.join('\n') + '\n\n' +
    'View in portal: ' + downloadLink + '\n\n' +
    'Verify document integrity: https://www.navigatewealth.co/verify'
  );

  return { html, text };
}

// --------------------------------------------------------------------------
// 4. Signing Complete Email  (used by esign-workflow.ts — sent to each signer)
// --------------------------------------------------------------------------

interface SigningCompleteParams {
  signerName: string;
  envelopeTitle: string;
  signedAt: string;
  certificateAvailable: boolean;
}

export function createSigningCompleteEmail(
  params: SigningCompleteParams
): { html: string; text: string } {
  const { signerName, envelopeTitle, signedAt, certificateAvailable } = params;

  const certNote = certificateAvailable
    ? '<p>A completion certificate has been generated and is included with the attached document.</p>'
    : '';

  const bodyHtml =
    '<p>Hello ' + signerName + ',</p>' +
    '<p>The document <strong>' + envelopeTitle + '</strong> has been fully executed. All required signatures were collected.</p>' +
    '<p>Your signature was recorded on <strong>' + formatDate(signedAt) + '</strong>.</p>' +
    certNote +
    '<p>A copy of the completed document is attached to this email for your records.</p>' +
    '<div style="margin-top:20px;padding:12px 16px;background:#f3f4f6;border-radius:8px;border-left:3px solid #7c3aed;">' +
    '<p style="margin:0;font-size:13px;color:#4b5563;">' +
    '<strong style="color:#7c3aed;">Verify this document</strong><br>' +
    'You can independently verify the integrity of the attached PDF at any time by uploading it to our ' +
    '<a href="https://www.navigatewealth.co/verify" style="color:#7c3aed;text-decoration:underline;">Document Verification</a> page.' +
    '</p></div>';

  const html = createEmailTemplate(bodyHtml, {
    title: 'Document Completed',
    subtitle: envelopeTitle,
    buttonUrl: 'https://www.navigatewealth.co/portal',
    buttonLabel: 'View in Portal',
    footerNote: "This notification was sent via Navigate Wealth's secure e-signature platform. Verify document integrity at navigatewealth.co/verify",
  });

  const certLine = certificateAvailable
    ? '\nA completion certificate is included with the attached document.\n'
    : '';

  const text = createPlainTextEmail(
    'Hello ' + signerName + ',\n\n' +
    'The document "' + envelopeTitle + '" has been fully executed.\n' +
    'Your signature was recorded on ' + formatDate(signedAt) + '.\n' +
    certLine + '\n' +
    'A copy of the completed document is attached to this email.\n\n' +
    'View in portal: https://www.navigatewealth.co/portal\n\n' +
    'Verify document integrity: https://www.navigatewealth.co/verify'
  );

  return { html, text };
}