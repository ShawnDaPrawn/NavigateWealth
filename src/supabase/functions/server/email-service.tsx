/**
 * Email Service — domain email senders (Phase 5c).
 * ============================================================================
 *
 * The SendGrid transport + template/footer engine now lives in email-core.ts;
 * this module owns the ~19 domain `send*` helpers and RE-EXPORTS the core so the
 * email-service.ts proxy keeps the same surface for all importers.
 */
import { createModuleLogger } from './stderr-logger.ts';
import {
  sendEmail,
  createEmailTemplate,
  createPlainTextEmail,
  getFooterSettings,
  getEmailTemplate,
} from './email-core.ts';

export * from './email-core.ts';

const log = createModuleLogger('email-service');

// ============================================================================
// TWO-FACTOR AUTHENTICATION EMAIL
// ============================================================================

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

// ============================================================================
// E-SIGNATURE EMAIL NOTIFICATIONS
// ============================================================================

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

// ============================================================================
// APPLICATION MANAGEMENT EMAIL NOTIFICATIONS
// ============================================================================

/**
 * Send admin notification when new application is submitted
 */
export async function sendAdminApplicationNotification(params: {
  applicationNumber: string;
  clientName: string;
  clientEmail: string;
  applicationType: string;
}): Promise<boolean> {
  const { applicationNumber, clientName, clientEmail, applicationType } = params;

  const footerSettings = await getFooterSettings();

  const html = createEmailTemplate(
    `
      <p>A new application has been submitted and requires review.</p>
      <p><strong>Application Details:</strong></p>
      <ul>
        <li>Application Number: ${applicationNumber}</li>
        <li>Client Name: ${clientName}</li>
        <li>Client Email: ${clientEmail}</li>
        <li>Application Type: ${applicationType}</li>
      </ul>
      <p>Please log in to the admin panel to review this application.</p>
    `,
    {
      title: 'New Application Submitted',
      buttonUrl: 'https://www.navigatewealth.co/admin',
      buttonLabel: 'Review Application',
      footerSettings,
    },
  );

  const text = `
New Application Submitted

Application Details:
- Application Number: ${applicationNumber}
- Client Name: ${clientName}
- Client Email: ${clientEmail}
- Application Type: ${applicationType}

Please log in to the admin panel to review this application.

Admin Panel: https://www.navigatewealth.co/admin
  `.trim();

  return await sendEmail({
    to: 'info@navigatewealth.co',
    subject: `New Application: ${applicationNumber}`,
    html,
    text,
  });
}

/**
 * Send confirmation email to client when their application is submitted.
 * Uses the application_received template.
 */
export async function sendClientApplicationReceivedEmail(params: {
  to: string;
  clientName: string;
  applicationNumber: string;
}): Promise<boolean> {
  const { to, clientName, applicationNumber } = params;

  const footerSettings = await getFooterSettings();

  const html = createEmailTemplate(
    `
      <p>Dear ${clientName},</p>
      <p>Thank you for submitting your application <strong>${applicationNumber}</strong> to Navigate Wealth.</p>
      <p>We have received your application and it is currently being reviewed by our team. We will get back to you shortly with an update on your application status.</p>
      <p>In the meantime, you can check the status of your application by logging in to your account.</p>
    `,
    {
      title: 'Application Received',
      buttonUrl: 'https://www.navigatewealth.co/login',
      buttonLabel: 'Check Application Status',
      footerNote:
        'If you have any questions, contact us at <a href="mailto:info@navigatewealth.co" style="color: #6d28d9;">info@navigatewealth.co</a> or call <a href="tel:+27126672505" style="color: #6d28d9;">(+27) 12-667-2505</a>.',
      footerSettings,
    },
  );

  const text = `
Dear ${clientName},

Thank you for submitting your application ${applicationNumber} to Navigate Wealth.

We have received your application and it is currently being reviewed by our team. We will get back to you shortly with an update on your application status.

In the meantime, you can check the status of your application by logging in at https://www.navigatewealth.co/login.

If you have any questions, contact us at info@navigatewealth.co or call (+27) 12-667-2505.
  `.trim();

  return await sendEmail({
    to,
    subject: `We received your application — ${applicationNumber}`,
    html,
    text,
  });
}

/**
 * Send client approval email
 */
export async function sendClientApprovalEmail(params: {
  to: string;
  clientName: string;
  applicationNumber: string;
}): Promise<boolean> {
  const { to, clientName, applicationNumber } = params;

  const footerSettings = await getFooterSettings();

  const html = createEmailTemplate(
    `
      <p>Dear ${clientName},</p>
      <p>Congratulations! Your application <strong>${applicationNumber}</strong> has been approved.</p>
      <p>You now have full access to your Navigate Wealth client portal. Log in to explore your personalized financial dashboard, track your investments, and access our comprehensive suite of financial planning tools.</p>
      <p>Our team is here to support you every step of the way on your financial journey.</p>
    `,
    {
      title: 'Application Approved!',
      buttonUrl: 'https://www.navigatewealth.co/login',
      buttonLabel: 'Access Your Portal',
      footerNote:
        'If you have any questions, contact us at <a href="mailto:info@navigatewealth.co" style="color: #6d28d9;">info@navigatewealth.co</a> or call <a href="tel:+27126672505" style="color: #6d28d9;">(+27) 12-667-2505</a>.',
      footerSettings,
    },
  );

  const text = `
Dear ${clientName},

Congratulations! Your application ${applicationNumber} has been approved.

You now have full access to your Navigate Wealth client portal. Log in to explore your personalized financial dashboard, track your investments, and access our comprehensive suite of financial planning tools.

Access your portal: https://www.navigatewealth.co/login

Our team is here to support you every step of the way on your financial journey.

If you have any questions, contact us at info@navigatewealth.co or call (+27) 12-667-2505.
  `.trim();

  return await sendEmail({
    to,
    subject: 'Your Navigate Wealth Application Has Been Approved!',
    html,
    text,
  });
}

/**
 * Send client decline email
 */
export async function sendClientDeclineEmail(params: {
  to: string;
  clientName: string;
  applicationNumber: string;
  reason?: string;
}): Promise<boolean> {
  const { to, clientName, applicationNumber, reason } = params;

  const footerSettings = await getFooterSettings();

  const reasonText = reason ? `<p><strong>Reason:</strong> ${reason}</p>` : '';

  const html = createEmailTemplate(
    `
      <p>Dear ${clientName},</p>
      <p>Thank you for your interest in Navigate Wealth. After careful review, we are unable to approve your application <strong>${applicationNumber}</strong> at this time.</p>
      ${reasonText}
      <p>If you have any questions or would like to discuss this decision, please don't hesitate to contact us. We're here to help and may be able to provide guidance on alternative options.</p>
    `,
    {
      title: 'Application Status Update',
      buttonUrl: 'https://www.navigatewealth.co/contact',
      buttonLabel: 'Contact Us',
      footerNote:
        'Reach us at <a href="mailto:info@navigatewealth.co" style="color: #6d28d9;">info@navigatewealth.co</a> or call <a href="tel:+27126672505" style="color: #6d28d9;">(+27) 12-667-2505</a>.',
      footerSettings,
    },
  );

  const reasonTextPlain = reason ? `\n\nReason: ${reason}` : '';

  const text = `
Dear ${clientName},

Thank you for your interest in Navigate Wealth. After careful review, we are unable to approve your application ${applicationNumber} at this time.${reasonTextPlain}

If you have any questions or would like to discuss this decision, please don't hesitate to contact us. We're here to help and may be able to provide guidance on alternative options.

Contact us: https://www.navigatewealth.co/contact
Email: info@navigatewealth.co
Phone: (+27) 12-667-2505
  `.trim();

  return await sendEmail({ to, subject: 'Application Status Update', html, text });
}

/**
 * Send admin notification when application is approved
 */
export async function sendAdminApprovalNotification(params: {
  applicationNumber: string;
  clientName: string;
  approvedBy: string;
}): Promise<boolean> {
  const { applicationNumber, clientName, approvedBy } = params;

  const footerSettings = await getFooterSettings();

  const html = createEmailTemplate(
    `
      <p>An application has been approved.</p>
      <p><strong>Details:</strong></p>
      <ul>
        <li>Application Number: ${applicationNumber}</li>
        <li>Client Name: ${clientName}</li>
        <li>Approved By: ${approvedBy}</li>
        <li>Timestamp: ${new Date().toLocaleString()}</li>
      </ul>
    `,
    {
      title: 'Application Approved',
      buttonUrl: 'https://www.navigatewealth.co/admin',
      buttonLabel: 'View Admin Panel',
      footerSettings,
    },
  );

  const text = `
Application Approved

Details:
- Application Number: ${applicationNumber}
- Client Name: ${clientName}
- Approved By: ${approvedBy}
- Timestamp: ${new Date().toLocaleString()}

View Admin Panel: https://www.navigatewealth.co/admin
  `.trim();

  return await sendEmail({
    to: 'info@navigatewealth.co',
    subject: `Application Approved: ${applicationNumber}`,
    html,
    text,
  });
}

// ============================================================================
// USER AUTHENTICATION EMAIL NOTIFICATIONS
// ============================================================================

/**
 * Send admin notification when new user signs up
 */
export async function sendAdminSignupNotification(params: {
  userEmail: string;
  userName: string;
  timestamp: string;
}): Promise<boolean> {
  const { userEmail, userName, timestamp } = params;

  const footerSettings = await getFooterSettings();

  const html = createEmailTemplate(
    `
      <p>A new user has signed up on the Navigate Wealth platform.</p>
      <p><strong>User Details:</strong></p>
      <ul>
        <li>Name: ${userName}</li>
        <li>Email: ${userEmail}</li>
        <li>Signup Time: ${timestamp}</li>
      </ul>
      <p>Please review the user's application in the admin panel.</p>
    `,
    {
      title: 'New User Signup',
      buttonUrl: 'https://www.navigatewealth.co/admin',
      buttonLabel: 'View Admin Panel',
      footerSettings,
    },
  );

  const text = `
New User Signup

User Details:
- Name: ${userName}
- Email: ${userEmail}
- Signup Time: ${timestamp}

Please review the user's application in the admin panel.

Admin Panel: https://www.navigatewealth.co/admin
  `.trim();

  return await sendEmail({
    to: 'info@navigatewealth.co',
    subject: 'New User Signup',
    html,
    text,
  });
}

/**
 * Send welcome email to admin-onboarded client upon application approval.
 * Includes a password-setup link so the client can set their own password.
 */
export async function sendAdminOnboardedWelcomeEmail(params: {
  to: string;
  clientName: string;
  applicationNumber: string;
  passwordResetLink: string;
}): Promise<boolean> {
  const { to, clientName, applicationNumber, passwordResetLink } = params;

  const footerSettings = await getFooterSettings();

  const html = createEmailTemplate(
    `
      <p>Dear ${clientName},</p>
      <p>Welcome to <strong>Navigate Wealth</strong>! Your financial adviser has created an account for you, and your application <strong>${applicationNumber}</strong> has been approved.</p>
      <p>To get started, please set up your password by clicking the button below. Once you've set your password, you'll be asked to review and accept our Terms &amp; Conditions before accessing your personalised financial portal.</p>
      <p style="margin-top:24px;"><strong>What you'll find in your portal:</strong></p>
      <ul>
        <li>Your personalised financial dashboard</li>
        <li>Investment and retirement tracking</li>
        <li>Secure document management</li>
        <li>Direct communication with your adviser</li>
      </ul>
    `,
    {
      title: 'Welcome to Navigate Wealth',
      subtitle: 'Your account is ready',
      buttonUrl: passwordResetLink,
      buttonLabel: 'Set Your Password',
      footerNote:
        'This link will expire in 24 hours. If it has expired, visit <a href="https://www.navigatewealth.co/forgot-password" style="color: #6d28d9;">navigatewealth.co/forgot-password</a> to request a new one.<br/><br/>If you did not expect this email, please contact us at <a href="mailto:info@navigatewealth.co" style="color: #6d28d9;">info@navigatewealth.co</a>.',
      footerSettings,
    },
  );

  const text = `
Dear ${clientName},

Welcome to Navigate Wealth! Your financial adviser has created an account for you, and your application ${applicationNumber} has been approved.

To get started, please set up your password by visiting the link below:
${passwordResetLink}

Once you've set your password, you'll be asked to review and accept our Terms & Conditions before accessing your personalised financial portal.

What you'll find in your portal:
- Your personalised financial dashboard
- Investment and retirement tracking
- Secure document management
- Direct communication with your adviser

This link will expire in 24 hours. If it has expired, visit https://www.navigatewealth.co/forgot-password to request a new one.

If you did not expect this email, please contact us at info@navigatewealth.co.
  `.trim();

  return await sendEmail({
    to,
    subject: 'Welcome to Navigate Wealth — Set Up Your Account',
    html,
    text,
  });
}

// ==================== WRAPPER FUNCTIONS FOR ESIGN-ROUTES COMPATIBILITY ====================

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

// ============================================================================
// CONTACT FORM EMAIL NOTIFICATIONS
// ============================================================================

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

  const resolve = (text: string) => text.replace(/\{\{ \.Name \}\}/g, fullName);

  const detailsHtml = `
    ${resolve(template.bodyHtml)}
    <div style="background-color: #f8f9fa; padding: 24px; border-radius: 8px; margin: 24px 0;">
      <h3 style="margin-top: 0; font-size: 18px; color: #111827;">Contact Details</h3>
      <p style="margin: 8px 0;"><strong>Name:</strong> ${fullName}</p>
      <p style="margin: 8px 0;"><strong>Email:</strong> <a href="mailto:${data.email}" style="color: #6d28d9;">${data.email}</a></p>
      ${
        hasPhone
          ? `<p style="margin: 8px 0;"><strong>Phone:</strong> <a href="tel:${normalizedPhone}" style="color: #6d28d9;">${normalizedPhone}</a></p>`
          : `<p style="margin: 8px 0;"><strong>Phone:</strong> Not provided</p>`
      }
      <p style="margin: 8px 0;"><strong>Client Type:</strong> ${clientTypeLabel}</p>
      ${data.service ? `<p style="margin: 8px 0;"><strong>Service Interest:</strong> ${data.service}</p>` : ''}
      <p style="margin: 8px 0;"><strong>Submitted:</strong> ${timestamp}</p>
    </div>
    ${
      data.message
        ? `
      <div style="background-color: #f8f9fa; padding: 24px; border-radius: 8px; margin: 24px 0;">
        <h3 style="margin-top: 0; font-size: 18px; color: #111827;">Message</h3>
        <p style="margin: 8px 0; padding: 16px; background-color: #fff; border-left: 3px solid #6d28d9; border-radius: 4px; white-space: pre-wrap;">${data.message}</p>
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

  const resolve = (text: string) => text.replace(/\{\{ \.Name \}\}/g, fullName);

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

// ============================================================================
// APPLICATION INVITE EMAIL
// ============================================================================

/**
 * Send an invitation email to a prospective client inviting them to create
 * their Navigate Wealth account. Uses the `application_invite` transactional
 * template and the base email HTML layout.
 */
export async function sendApplicationInviteEmail(params: {
  to: string;
  clientName: string;
  setupLink: string;
  applicationNumber: string;
}): Promise<boolean> {
  const { to, clientName, setupLink, applicationNumber } = params;

  const template = await getEmailTemplate('application_invite');

  if (!template.enabled) {
    log.info('Application invite email disabled, skipping', { to });
    return true;
  }

  const footerSettings = await getFooterSettings();

  const resolve = (text: string) =>
    text
      .replace(/\{\{ \.Name \}\}/g, clientName)
      .replace(/\{\{ \.SetupLink \}\}/g, setupLink)
      .replace(/\{\{ \.ApplicationNumber \}\}/g, applicationNumber);

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

You have been personally invited to create an account with Navigate Wealth, South Africa's trusted independent financial advisory firm.

Click the link below to set up your account and get started on your financial journey:
${setupLink}

Our team is ready to assist you every step of the way.

${footerNote}
  `.trim();

  return await sendEmail({ to, subject, html, text });
}
