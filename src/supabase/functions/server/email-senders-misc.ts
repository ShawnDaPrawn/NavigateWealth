/**
 * email-senders-misc.ts — 2FA, request-info, and contact-form emails (Phase 5c).
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
  createPlainTextEmail,
  getFooterSettings,
  getEmailTemplate,
} from './email-core.ts';
import { escapeHtml } from './shared-validation-utils.ts';

const log = createModuleLogger('email-senders-misc');

/**
 * Send a 2FA verification code email to the user.
 * Used during 2FA activation (security settings) and login-time verification.
 */
export async function sendTwoFactorEmail(to: string, code: string): Promise<boolean> {
  const footerSettings = await getFooterSettings();

  const html = createEmailTemplate(
    `
      <p>You requested a two-factor authentication code for your Navigate Wealth account.</p>
      <div style="background-color: #f3f4f6; padding: 24px; border-radius: 8px; margin: 24px 0; text-align: center;">
        <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;">Your verification code is:</p>
        <p style="margin: 0; font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #111827;">${code}</p>
      </div>
      <p>This code expires in <strong>5 minutes</strong>. If you did not request this code, please ignore this email or contact support.</p>
      <p style="color: #d97706; background-color: #fffbeb; padding: 12px; border-radius: 6px; border: 1px solid #fcd34d;">
        <strong>Security Tip:</strong> Never share this code with anyone. Navigate Wealth will never ask you for this code via phone or chat.
      </p>
    `,
    {
      title: 'Two-Factor Authentication',
      subtitle: 'Verification Code',
      footerNote:
        'If you did not request this code, you can safely ignore this email. Your account is secure.',
      footerSettings,
    },
  );

  const text = `
Your Navigate Wealth two-factor authentication code is: ${code}

This code expires in 5 minutes.

If you did not request this code, please ignore this email or contact support.

Security Tip: Never share this code with anyone. Navigate Wealth will never ask you for this code via phone or chat.
  `.trim();

  return await sendEmail({
    to,
    subject: `${code} — Your Navigate Wealth Verification Code`,
    html,
    text,
  });
}

/**
 * Send request information required email
 */
export async function sendRequestInfoEmail(params: {
  to: string;
  clientName: string;
  requestTitle: string;
  requestLink: string;
}): Promise<boolean> {
  const { to, clientName, requestTitle, requestLink } = params;

  // Check if template is enabled
  const template = await getEmailTemplate('request_info_required');
  if (!template.enabled) {
    return true;
  }

  const footerSettings = await getFooterSettings();

  // Helper to replace variables
  const resolve = (text: string) => {
    return text
      .replace('{{ .Name }}', clientName)
      .replace('{{ .RequestLink }}', requestLink)
      .replace('{{ .RequestTitle }}', requestTitle);
  };

  const subject = resolve(template.subject);
  const bodyContent = resolve(template.bodyHtml);

  // Create HTML
  const html = createEmailTemplate(bodyContent, {
    title: resolve(template.title),
    subtitle: resolve(template.subtitle),
    buttonUrl: resolve(template.buttonUrl),
    buttonLabel: resolve(template.buttonLabel),
    footerNote: resolve(template.footerNote),
    footerSettings,
  });

  // Create Text
  const text = createPlainTextEmail(
    bodyContent.replace(/<[^>]*>?/gm, ''),
    '', // No unsubscribe link for transactional
  );

  return await sendEmail({
    to,
    subject,
    html,
    text,
  });
}

export interface ContactFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  service?: string;
  message?: string;
  clientType?: string;
}

/**
 * Send admin notification when someone submits the website contact form.
 * Sends to info@navigatewealth.co with the full client details.
 * Optionally attaches a PDF summary of the contact details.
 */
export async function sendContactFormAdminNotification(
  data: ContactFormData,
  pdfBase64?: string,
): Promise<boolean> {
  const template = await getEmailTemplate('contact_form_admin');

  if (!template.enabled) {
    log.info('Contact form admin notification disabled, skipping');
    return true;
  }

  const footerSettings = await getFooterSettings();
  const fullName = `${data.firstName} ${data.lastName}`.trim();
  const timestamp = new Date().toLocaleString('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    dateStyle: 'full',
    timeStyle: 'long',
  });

  const clientTypeLabel = data.clientType
    ? data.clientType.charAt(0).toUpperCase() + data.clientType.slice(1)
    : 'Not specified';

  const normalizedPhone = data.phone?.trim();
  const hasPhone = Boolean(normalizedPhone);

  // SECURITY (SECURITY-AUDIT S10): every value below comes from an anonymous
  // website visitor and is interpolated into the HTML of the staff notification
  // email. Validation caps the length of these fields but permits any character,
  // so each one is escaped here. The plain-text body and the PDF attachment
  // deliberately keep the raw values.
  const safeFullName = escapeHtml(fullName);
  const safeEmail = escapeHtml(data.email);
  const safePhone = normalizedPhone ? escapeHtml(normalizedPhone) : '';
  const safeClientTypeLabel = escapeHtml(clientTypeLabel);
  const safeService = data.service ? escapeHtml(data.service) : '';
  const safeMessage = data.message ? escapeHtml(data.message) : '';

  const resolve = (text: string) => text.replace(/\{\{ \.Name \}\}/g, safeFullName);

  const detailsHtml = `
    ${resolve(template.bodyHtml)}
    <div style="background-color: #f8f9fa; padding: 24px; border-radius: 8px; margin: 24px 0;">
      <h3 style="margin-top: 0; font-size: 18px; color: #111827;">Contact Details</h3>
      <p style="margin: 8px 0;"><strong>Name:</strong> ${safeFullName}</p>
      <p style="margin: 8px 0;"><strong>Email:</strong> <a href="mailto:${safeEmail}" style="color: #6d28d9;">${safeEmail}</a></p>
      ${
        hasPhone
          ? `<p style="margin: 8px 0;"><strong>Phone:</strong> <a href="tel:${safePhone}" style="color: #6d28d9;">${safePhone}</a></p>`
          : `<p style="margin: 8px 0;"><strong>Phone:</strong> Not provided</p>`
      }
      <p style="margin: 8px 0;"><strong>Client Type:</strong> ${safeClientTypeLabel}</p>
      ${safeService ? `<p style="margin: 8px 0;"><strong>Service Interest:</strong> ${safeService}</p>` : ''}
      <p style="margin: 8px 0;"><strong>Submitted:</strong> ${timestamp}</p>
    </div>
    ${
      data.message
        ? `
      <div style="background-color: #f8f9fa; padding: 24px; border-radius: 8px; margin: 24px 0;">
        <h3 style="margin-top: 0; font-size: 18px; color: #111827;">Message</h3>
        <p style="margin: 8px 0; padding: 16px; background-color: #fff; border-left: 3px solid #6d28d9; border-radius: 4px; white-space: pre-wrap;">${safeMessage}</p>
      </div>
    `
        : ''
    }
    <div style="background-color: #fef3c7; border: 1px solid #fbbf24; padding: 16px; border-radius: 8px; margin: 24px 0;">
      <p style="margin: 0; color: #92400e;"><strong>Action Required:</strong> Please respond to this enquiry within 24 hours.</p>
    </div>
  `;

  const subject = resolve(template.subject);

  const html = createEmailTemplate(detailsHtml, {
    title: resolve(template.title),
    subtitle: resolve(template.subtitle),
    buttonUrl: resolve(template.buttonUrl),
    buttonLabel: resolve(template.buttonLabel),
    footerNote: resolve(template.footerNote),
    footerSettings,
  });

  const text = `
New Contact Form Submission

Name: ${fullName}
Email: ${data.email}
Phone: ${hasPhone ? normalizedPhone : 'Not provided'}
Client Type: ${clientTypeLabel}
${data.service ? `Service Interest: ${data.service}` : ''}
Submitted: ${timestamp}
${data.message ? `\nMessage:\n${data.message}` : ''}

Please respond to this enquiry within 24 hours.

Admin Dashboard: https://www.navigatewealth.co/admin
  `.trim();

  return await sendEmail({
    to: 'info@navigatewealth.co',
    subject,
    html,
    text,
    attachments: pdfBase64
      ? [
          {
            content: pdfBase64,
            filename: `Contact_Enquiry_${data.firstName}_${data.lastName}_${new Date().toISOString().slice(0, 10)}.pdf`,
            type: 'application/pdf',
            disposition: 'attachment',
          },
        ]
      : undefined,
  });
}

/**
 * Send acknowledgment email to the person who submitted the contact form.
 */
export async function sendContactFormAcknowledgment(data: ContactFormData): Promise<boolean> {
  const template = await getEmailTemplate('contact_form_acknowledgment');

  if (!template.enabled) {
    log.info('Contact form acknowledgment disabled, skipping');
    return true;
  }

  const footerSettings = await getFooterSettings();
  const fullName = `${data.firstName} ${data.lastName}`.trim();

  const resolve = (text: string) => text.replace(/\{\{ \.Name \}\}/g, escapeHtml(fullName));

  const bodyContent = `
    ${resolve(template.bodyHtml)}
    <div style="background-color: #f0fdf4; border: 1px solid #86efac; padding: 20px; border-radius: 8px; margin: 24px 0;">
      <h3 style="margin-top: 0; font-size: 18px; color: #166534;">What Happens Next?</h3>
      <p style="color: #15803d; margin: 8px 0;">&#10003; A member of our team will review your enquiry</p>
      <p style="color: #15803d; margin: 8px 0;">&#10003; We will contact you within 24 business hours</p>
      <p style="color: #15803d; margin: 8px 0;">&#10003; There is no obligation — this is a complimentary consultation</p>
    </div>
    <p>Best regards,<br><strong>The Navigate Wealth Team</strong></p>
  `;

  const subject = resolve(template.subject);

  const html = createEmailTemplate(bodyContent, {
    title: resolve(template.title),
    subtitle: resolve(template.subtitle),
    greeting: resolve(template.greeting),
    buttonUrl: resolve(template.buttonUrl),
    buttonLabel: resolve(template.buttonLabel),
    footerNote: resolve(template.footerNote),
    footerSettings,
  });

  const text = `
Dear ${fullName},

Thank you for contacting Navigate Wealth. We have received your enquiry and one of our team members will be in touch with you shortly.

What Happens Next?
- A member of our team will review your enquiry
- We will contact you within 24 business hours
- There is no obligation — this is a complimentary consultation

If your matter is urgent, please call us directly at 012 667 2025 or email info@navigatewealth.co.

Best regards,
The Navigate Wealth Team
  `.trim();

  return await sendEmail({
    to: data.email,
    subject,
    html,
    text,
  });
}
