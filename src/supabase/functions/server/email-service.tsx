/**
 * Email Service
 * Handles email sending via SendGrid for e-signature notifications and other communications
 */

import * as kv from "./kv_store.tsx";
import { createModuleLogger } from "./stderr-logger.ts";

const log = createModuleLogger('email-service');

// Lazy accessor — never read env vars at module-load time
let _sendgridApiKey: string | undefined;
function getSendGridApiKey(): string | undefined {
  if (_sendgridApiKey === undefined) {
    _sendgridApiKey = Deno.env.get('SENDGRID_API_KEY') || '';
  }
  return _sendgridApiKey || undefined;
}

const SENDGRID_API_URL = 'https://api.sendgrid.com/v3/mail/send';
const FROM_EMAIL = 'info@navigatewealth.co';
const FROM_NAME = 'Navigate Wealth';

// --- Global Footer Settings ---
export interface EmailFooterSettings {
  companyName: string;
  address: string;
  contactEmail: string;
  contactPhone: string;
  socialLinks: {
    linkedin?: string;
    instagram?: string;
    youtube?: string;
    facebook?: string;
    twitter?: string;
  };
  copyrightText: string;
}

export const DEFAULT_FOOTER_SETTINGS: EmailFooterSettings = {
  companyName: 'Navigate Wealth',
  address: 'First Floor, Milestone Place, Block A<br />25 Sovereign Dr, Route 21 Business Park<br />Irene, 0157',
  contactEmail: 'info@navigatewealth.co',
  contactPhone: '',
  socialLinks: {
    linkedin: 'https://www.linkedin.com/company/navigatewealth/',
    instagram: 'https://www.instagram.com/navigate_wealth?igsh=MTh6bTc2emszbXU0MA==',
    youtube: 'https://www.youtube.com/@navigatewealth'
  },
  copyrightText: '© {{Year}} Navigate Wealth. All rights reserved.'
};

export const KV_FOOTER_KEY = 'email_footer_settings';
export const KV_PREFIX_TEMPLATE = 'email_template:';

export interface EmailTemplate {
  id: string;
  name: string;
  enabled: boolean;
  subject: string;
  title: string;
  subtitle: string;
  greeting: string;
  bodyHtml: string;
  buttonLabel: string;
  buttonUrl: string;
  footerNote: string;
  category?: string;
  isSystem?: boolean;
  createdAt?: string;
}

export const DEFAULT_TEMPLATES: Record<string, EmailTemplate> = {
  invite_user: {
    id: 'invite_user',
    name: 'User Invitation',
    enabled: true,
    subject: 'You have been invited to Navigate Wealth',
    title: 'Welcome to Navigate Wealth',
    subtitle: 'You have been invited to join our platform',
    greeting: 'Hello there,',
    bodyHtml: '<p>You have been invited to join the Navigate Wealth platform. Click the button below to set up your account.</p>',
    buttonLabel: 'Accept Invitation',
    buttonUrl: '{{ .InviteLink }}',
    footerNote: 'This link will expire in 48 hours.'
  },
  welcome_email: {
    id: 'welcome_email',
    name: 'Welcome Email',
    enabled: true,
    subject: 'Welcome to Navigate Wealth',
    title: 'Welcome Aboard!',
    subtitle: 'We are excited to have you with us',
    greeting: 'Hi {{ .Name }},',
    bodyHtml: '<p>Thank you for joining Navigate Wealth. We are here to help you manage your wealth effectively.</p>',
    buttonLabel: 'Go to Dashboard',
    buttonUrl: '{{ .DashboardLink }}',
    footerNote: ''
  },
  application_received: {
    id: 'application_received',
    name: 'Application Received',
    enabled: true,
    subject: 'We received your application',
    title: 'Application Received',
    subtitle: 'Thank you for submitting your application',
    greeting: 'Dear {{ .Name }},',
    bodyHtml: '<p>We have received your application and it is currently being reviewed by our team. We will get back to you shortly.</p>',
    buttonLabel: 'View Application Status',
    buttonUrl: '{{ .ApplicationLink }}',
    footerNote: ''
  },
  application_approved: {
    id: 'application_approved',
    name: 'Application Approved',
    enabled: true,
    subject: 'Your application has been approved',
    title: 'Congratulations!',
    subtitle: 'Your application was successful',
    greeting: 'Dear {{ .Name }},',
    bodyHtml: '<p>We are pleased to inform you that your application has been approved. You can now access all features of your account.</p>',
    buttonLabel: 'Get Started',
    buttonUrl: '{{ .DashboardLink }}',
    footerNote: ''
  },
  password_reset: {
    id: 'password_reset',
    name: 'Password Reset',
    enabled: true,
    subject: 'Reset your password',
    title: 'Password Reset Request',
    subtitle: 'You requested to reset your password',
    greeting: 'Hello,',
    bodyHtml: '<p>We received a request to reset your password. If you did not make this request, please ignore this email.</p>',
    buttonLabel: 'Reset Password',
    buttonUrl: '{{ .ResetLink }}',
    footerNote: 'This link expires in 1 hour.'
  },
  new_documents_notification: {
    id: 'new_documents_notification',
    name: 'New Documents Notification',
    enabled: true,
    subject: 'New Documents Uploaded',
    title: 'New Documents Available',
    subtitle: 'Documents have been added to your profile',
    greeting: 'Dear {{ .Name }},',
    bodyHtml: '{{ .CustomMessage }}<p>They are attached to this email in a secure, encrypted ZIP file.</p><p><strong>Password:</strong> Your National ID Number</p><p>Please log in to your portal to view them online.</p>',
    buttonLabel: 'Login to Portal',
    buttonUrl: 'https://www.navigatewealth.co/login',
    footerNote: ''
  },
  resend_documents_notification: {
    id: 'resend_documents_notification',
    name: 'Resend Documents Notification',
    enabled: true,
    subject: 'Documents Resent',
    title: 'Documents Resent',
    subtitle: 'Documents have been resent to your profile',
    greeting: 'Dear {{ .Name }},',
    bodyHtml: '{{ .CustomMessage }}<p>They are attached to this email in a secure, encrypted ZIP file.</p><p><strong>Password:</strong> Your National ID Number</p><p>Please log in to your portal to view them online.</p>',
    buttonLabel: 'Login to Portal',
    buttonUrl: 'https://www.navigatewealth.co/login',
    footerNote: ''
  },
  general_campaign: {
    id: 'general_campaign',
    name: 'General Communication',
    enabled: true,
    subject: 'Update from Navigate Wealth',
    title: 'Navigate Wealth',
    subtitle: '',
    greeting: '',
    bodyHtml: '<p>This is the base template for all general communication campaigns. The content of your campaigns will be injected here.</p>',
    buttonLabel: '',
    buttonUrl: '',
    footerNote: ''
  },
  calendar_reminder: {
    id: 'calendar_reminder',
    name: 'Calendar Event Reminder',
    enabled: true,
    subject: 'Reminder: {{ .EventTitle }}',
    title: 'Event Reminder',
    subtitle: 'Upcoming Event',
    greeting: 'Hello {{ .Name }},',
    bodyHtml: '<p>This is a reminder that you have an event scheduled for <strong>{{ .TimeFrame }}</strong>.</p><div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;"><h3 style="margin-top: 0; color: #111827;">{{ .EventTitle }}</h3><p style="margin: 5px 0;"><strong>Date:</strong> {{ .EventDate }}</p><p style="margin: 5px 0;"><strong>Time:</strong> {{ .EventTime }}</p><p style="margin: 5px 0;"><strong>Location:</strong> {{ .Location }}</p>{{ .Description }}</div>',
    buttonLabel: 'Join Meeting',
    buttonUrl: '{{ .MeetingLink }}',
    footerNote: 'We look forward to seeing you there.'
  },
  admin_daily_report: {
    id: 'admin_daily_report',
    name: 'Admin Daily Report',
    enabled: true,
    subject: 'Daily Calendar - {{ .Date }}',
    title: 'Daily Calendar Report',
    subtitle: '',
    greeting: 'Good morning,',
    bodyHtml: '<p>Please find attached the calendar for today, <strong>{{ .Date }}</strong>.</p><p>You have <strong>{{ .EventCount }}</strong> event(s) scheduled.</p>',
    buttonLabel: 'View Calendar',
    buttonUrl: 'https://www.navigatewealth.co/admin/calendar',
    footerNote: ''
  },
  request_info_required: {
    id: 'request_info_required',
    name: 'Request Information Required',
    enabled: true,
    subject: 'Action Required: Please complete your information request',
    title: 'Information Request',
    subtitle: 'We need some additional information from you',
    greeting: 'Dear {{ .Name }},',
    bodyHtml: '<p>A new request has been created that requires your input. Please click the button below to view the request and provide the necessary information.</p>',
    buttonLabel: 'Complete Request',
    buttonUrl: '{{ .RequestLink }}',
    footerNote: 'If you have any questions, please contact us.'
  },
  signature_request: {
    id: 'signature_request',
    name: 'E-Signature Request',
    enabled: true,
    subject: 'Signature Request: {{ .DocumentName }}',
    title: 'Document Signature Request',
    subtitle: 'Your signature is required',
    greeting: 'Hello {{ .RecipientName }},',
    bodyHtml: '<p>{{ .SenderName }} has sent you a document to sign: <strong>{{ .DocumentName }}</strong></p><p>Please click the button below to review and sign the document.</p>',
    buttonLabel: 'Review & Sign Document',
    buttonUrl: '{{ .SigningUrl }}',
    footerNote: 'This signature request was sent via Navigate Wealth\'s secure e-signature platform.'
  },
  contact_form_admin: {
    id: 'contact_form_admin',
    name: 'Contact Form — Admin Notification',
    enabled: true,
    subject: 'New Contact Form Submission: {{ .Name }}',
    title: 'New Contact Form Submission',
    subtitle: 'A prospective client has reached out via the website',
    greeting: '',
    bodyHtml: '<p>A new enquiry has been submitted via the website contact form. Please review the details below and respond within 24 hours.</p>',
    buttonLabel: 'View Admin Dashboard',
    buttonUrl: 'https://www.navigatewealth.co/admin',
    footerNote: ''
  },
  contact_form_acknowledgment: {
    id: 'contact_form_acknowledgment',
    name: 'Contact Form — Client Acknowledgment',
    enabled: true,
    subject: 'We received your enquiry — Navigate Wealth',
    title: 'Thank You for Reaching Out',
    subtitle: 'We have received your message',
    greeting: 'Dear {{ .Name }},',
    bodyHtml: '<p>Thank you for contacting Navigate Wealth. We have received your enquiry and one of our team members will be in touch with you shortly.</p><p>If your matter is urgent, please do not hesitate to call us directly.</p>',
    buttonLabel: 'Explore Our Services',
    buttonUrl: 'https://www.navigatewealth.co/services',
    footerNote: 'If you have any immediate questions, contact us at <a href="mailto:info@navigatewealth.co" style="color: #6d28d9;">info@navigatewealth.co</a> or call <a href="tel:+27126672025" style="color: #6d28d9;">012 667 2025</a>.'
  },
  application_invite: {
    id: 'application_invite',
    name: 'Application Invitation',
    enabled: true,
    subject: 'You\'re invited to join Navigate Wealth',
    title: 'You\'re Invited',
    subtitle: 'Create your Navigate Wealth account',
    greeting: 'Dear {{ .Name }},',
    bodyHtml: '<p>You have been personally invited to create an account with <strong>Navigate Wealth</strong>, South Africa\'s trusted independent financial advisory firm.</p><p>Click the button below to set up your account and get started on your financial journey. Our team is ready to assist you every step of the way.</p>',
    buttonLabel: 'Create My Account',
    buttonUrl: '{{ .SetupLink }}',
    footerNote: 'This invitation was sent on behalf of Navigate Wealth. If you did not expect this invitation, you may safely ignore this email.',
    category: 'onboarding',
    isSystem: true,
  },
};

export async function getEmailTemplate(id: string): Promise<EmailTemplate> {
  const defaultTemplate = DEFAULT_TEMPLATES[id];
  if (!defaultTemplate) {
    throw new Error(`Unknown template ID: ${id}`);
  }

  // Fetch the custom template from KV (written by communication-service)
  const customTemplate = await kv.get(`${KV_PREFIX_TEMPLATE}${id}`);

  // If custom template exists, merge it with default (custom takes precedence)
  // Ensure we handle both cases where it might be a string (legacy) or object
  let templateData = customTemplate;
  if (typeof customTemplate === 'string') {
    try {
      templateData = JSON.parse(customTemplate);
    } catch (e) {
      log.warn(`Failed to parse template data for ${id}`, e);
      templateData = {};
    }
  }

  // Merge default with custom data
  return {
    ...defaultTemplate,
    ...(templateData || {}),
    id // Ensure ID is preserved
  };
}

export async function getFooterSettings(): Promise<EmailFooterSettings> {
  try {
    const data = await kv.get(KV_FOOTER_KEY);
    if (data) return { ...DEFAULT_FOOTER_SETTINGS, ...data };
  } catch (e) {
    log.warn('Failed to fetch footer settings', e);
  }
  return DEFAULT_FOOTER_SETTINGS;
}

interface EmailParams {
  to: string;
  cc?: string[]; // Added CC support
  subject: string;
  html: string;
  text?: string;
  attachments?: SendGridAttachment[];
}

interface SendGridAttachment {
  content: string; // Base64 encoded content
  filename: string;
  type?: string;
  disposition?: string;
}

/**
 * Send email via SendGrid (new signature for e-signature system)
 */
export async function sendEmail(params: EmailParams): Promise<boolean>;
/**
 * Send email via SendGrid (legacy signature for backwards compatibility)
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text?: string,
  attachments?: SendGridAttachment[]
): Promise<void>;
/**
 * Implementation
 */
export async function sendEmail(
  paramsOrTo: EmailParams | string,
  subject?: string,
  html?: string,
  text?: string,
  attachments?: SendGridAttachment[]
): Promise<boolean | void> {
  const sendgridApiKey = getSendGridApiKey();
  if (!sendgridApiKey) {
    if (typeof paramsOrTo === 'object') return false;
    throw new Error('SENDGRID_API_KEY not configured');
  }

  // Normalize parameters
  let to: string;
  let cc: string[] | undefined;
  let finalSubject: string;
  let finalHtml: string;
  let finalText: string;
  let finalAttachments: SendGridAttachment[] = [];

  if (typeof paramsOrTo === 'object') {
    // New signature
    to = paramsOrTo.to;
    cc = paramsOrTo.cc;
    finalSubject = paramsOrTo.subject;
    finalHtml = paramsOrTo.html;
    // Improve text generation: remove style/script tags first, then strip tags, then collapse whitespace
    finalText = paramsOrTo.text || paramsOrTo.html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    finalAttachments = paramsOrTo.attachments || [];
  } else {
    // Legacy signature
    to = paramsOrTo;
    finalSubject = subject!;
    finalHtml = html!;
    finalText = text || html!
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    finalAttachments = attachments || [];
  }

  try {
    const personalizations: Record<string, unknown> = {
      to: [{ email: to }],
      subject: finalSubject,
    };

    if (cc && cc.length > 0) {
      personalizations.cc = cc.map(email => ({ email }));
    }

    const body: Record<string, unknown> = {
      personalizations: [personalizations],
      from: {
        email: FROM_EMAIL,
        name: FROM_NAME,
      },
      content: [
        {
          type: 'text/plain',
          value: finalText,
        },
        {
          type: 'text/html',
          value: finalHtml,
        },
      ],
    };

    // Add attachments if provided
    if (finalAttachments.length > 0) {
      body.attachments = finalAttachments;
    }

    const response = await fetch(SENDGRID_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sendgridApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      log.error('SendGrid error:', error);
      if (typeof paramsOrTo === 'object') return false;
      throw new Error(`SendGrid error: ${error}`);
    }

    // Log success details
    const messageId = response.headers.get('x-message-id');
    log.info(`✅ Email sent successfully via SendGrid. MessageID: ${messageId || 'unknown'}`);

    if (typeof paramsOrTo === 'object') return true;
  } catch (error: unknown) {
    log.error('Failed to send email:', error);
    if (typeof paramsOrTo === 'object') return false;
    throw error;
  }
}

import { BASE_EMAIL_TEMPLATE } from "./email_base_html.ts";

/**
 * Create HTML email template with Navigate Wealth branding
 */
export function createEmailTemplate(
  content: string,
  options: {
    title?: string;
    subtitle?: string;
    greeting?: string;
    buttonUrl?: string;
    buttonLabel?: string;
    unsubscribeLink?: string;
    footerNote?: string;
    footerSettings?: EmailFooterSettings;
  } = {}
): string {
  const {
    title = 'Navigate Wealth',
    subtitle = '',
    greeting = '',
    buttonUrl,
    buttonLabel,
    unsubscribeLink,
    footerNote,
    footerSettings = DEFAULT_FOOTER_SETTINGS,
  } = options;

  let template = BASE_EMAIL_TEMPLATE;
  const year = new Date().getFullYear();

  // Prepare data for replacement
  const data: Record<string, string | number> = {
    Title: title,
    Subtitle: subtitle,
    Greeting: greeting,
    BodyHtml: content,
    Year: year,
  };

  if (buttonUrl) data.ButtonURL = buttonUrl;
  if (buttonLabel) data.ButtonLabel = buttonLabel;
  if (footerNote) data.FooterNote = footerNote;

  // Handle Unsubscribe Link (User template doesn't have a placeholder for this, so we append it if needed, or inject it)
  // The user template provided DOES NOT have an Unsubscribe slot.
  // We will respect the standard and NOT add it unless we hack it in, or if the user didn't include it.
  // Wait, my previous code added it. The user's template does NOT have it.
  // Strict adherence means I should probably DROP it if it's not in the template.
  // However, `unsubscribeLink` is passed in options.
  // If I want to support it, I might need to append it to the body or footer.
  // User said "adhere to this UI standard". The standard has no unsubscribe link.
  // I will omit it for now to be safe, OR I could append it to the footer note if present.
  
  if (unsubscribeLink) {
    // Append a small, inconspicuous unsubscribe link just before the final closing tags.
    // Injected after the Go-template rendering to avoid template interference.
    const unsubHtml = `<tr><td style="padding:8px 32px 16px 32px; text-align:center;"><a href="${unsubscribeLink}" style="font-size:11px; color:#9ca3af; text-decoration:underline;">Unsubscribe</a></td></tr>`;
    // Insert before the closing </table></body></html>
    template = template.replace(
      /(<\/table>\s*<\/body>\s*<\/html>\s*)$/i,
      `${unsubHtml}$1`
    );
    // If the pattern didn't match, try inserting before </body>
    if (!template.includes(unsubHtml)) {
      template = template.replace(
        /(<\/body>)/i,
        `<div style="text-align:center; padding:8px 0;"><a href="${unsubscribeLink}" style="font-size:11px; color:#9ca3af; text-decoration:underline;">Unsubscribe</a></div>$1`
      );
    }
  }

  // Helper to render the Go-like template syntax with JS
  
  // 1. Handle Conditionals: {{ if .Key }} ... {{ end }}
  // We support nested replacement inside the block, but not nested ifs.
  template = template.replace(/\{\{ if \.([a-zA-Z0-9_]+) \}\}([\s\S]*?)\{\{ end \}\}/g, (_match, key, blockContent) => {
    // If data[key] is truthy (and not empty string), return blockContent. Else empty string.
    if (data[key]) {
      return blockContent;
    }
    return '';
  });

  // 2. Handle Simple Replacements: {{ .Key }}
  template = template.replace(/\{\{ \.([a-zA-Z0-9_]+) \}\}/g, (_match, key) => {
    return data[key] !== undefined ? String(data[key]) : '';
  });

  return template;
}

/**
 * Create plain text email with optional unsubscribe link
 */
export function createPlainTextEmail(content: string, unsubscribeLink?: string): string {
  const unsubscribeText = unsubscribeLink
    ? `\n\n---\nUnsubscribe: ${unsubscribeLink}`
    : '';

  return `
${content}
${unsubscribeText}

---
© ${new Date().getFullYear()} Navigate Wealth. All rights reserved.
Navigate Wealth | South Africa's Independent Financial Advisory Firm
  `.trim();
}

// ============================================================================
// TWO-FACTOR AUTHENTICATION EMAIL
// ============================================================================

/**
 * Send a 2FA verification code email to the user.
 * Used during 2FA activation (security settings) and login-time verification.
 */
export async function sendTwoFactorEmail(
  to: string,
  code: string,
): Promise<boolean> {
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
      footerNote: 'If you did not request this code, you can safely ignore this email. Your account is secure.',
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

  const html = createEmailTemplate(
    bodyContent,
    {
      title,
      subtitle,
      greeting,
      buttonUrl,
      buttonLabel,
      footerNote,
      footerSettings
    }
  );

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
      footerNote: 'This is an automated reminder from Navigate Wealth\'s e-signature platform.',
      footerSettings
    }
  );

  const text = `
Hello ${recipientName},

This is a friendly reminder that you have a pending signature request for: ${documentName}

Review and sign: ${signingUrl}

This is an automated reminder from Navigate Wealth's e-signature platform.
  `.trim();

  return await sendEmail({ to, subject: `Reminder: Signature Request for ${documentName}`, html, text });
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
      footerNote: 'This notification was sent via Navigate Wealth\'s e-signature platform.',
      footerSettings
    }
  );

  const text = `
Hello ${recipientName},

The signature request for ${documentName} has been recalled by the sender.

No action is required from you. If you have any questions, please contact Navigate Wealth directly.

This notification was sent via Navigate Wealth's e-signature platform.
  `.trim();

  return await sendEmail({ to, subject: `Signature Request Recalled: ${documentName}`, html, text });
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
      footerNote: 'This notification was sent via Navigate Wealth\'s e-signature platform.',
      footerSettings
    }
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
      footerSettings
    }
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
      footerNote: 'If you have any questions, contact us at <a href="mailto:info@navigatewealth.co" style="color: #6d28d9;">info@navigatewealth.co</a> or call <a href="tel:+27126672505" style="color: #6d28d9;">(+27) 12-667-2505</a>.',
      footerSettings
    }
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
      footerNote: 'If you have any questions, contact us at <a href="mailto:info@navigatewealth.co" style="color: #6d28d9;">info@navigatewealth.co</a> or call <a href="tel:+27126672505" style="color: #6d28d9;">(+27) 12-667-2505</a>.',
      footerSettings
    }
  );

  const text = `
Dear ${clientName},

Congratulations! Your application ${applicationNumber} has been approved.

You now have full access to your Navigate Wealth client portal. Log in to explore your personalized financial dashboard, track your investments, and access our comprehensive suite of financial planning tools.

Access your portal: https://www.navigatewealth.co/login

Our team is here to support you every step of the way on your financial journey.

If you have any questions, contact us at info@navigatewealth.co or call (+27) 12-667-2505.
  `.trim();

  return await sendEmail({ to, subject: 'Your Navigate Wealth Application Has Been Approved!', html, text });
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

  const reasonText = reason
    ? `<p><strong>Reason:</strong> ${reason}</p>`
    : '';

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
      footerNote: 'Reach us at <a href="mailto:info@navigatewealth.co" style="color: #6d28d9;">info@navigatewealth.co</a> or call <a href="tel:+27126672505" style="color: #6d28d9;">(+27) 12-667-2505</a>.',
      footerSettings
    }
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
      footerSettings
    }
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
      footerSettings
    }
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
      footerNote: 'This link will expire in 24 hours. If it has expired, visit <a href="https://www.navigatewealth.co/forgot-password" style="color: #6d28d9;">navigatewealth.co/forgot-password</a> to request a new one.<br/><br/>If you did not expect this email, please contact us at <a href="mailto:info@navigatewealth.co" style="color: #6d28d9;">info@navigatewealth.co</a>.',
      footerSettings,
    }
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
  const html = createEmailTemplate(
    bodyContent,
    {
      title: resolve(template.title),
      subtitle: resolve(template.subtitle),
      buttonUrl: resolve(template.buttonUrl),
      buttonLabel: resolve(template.buttonLabel),
      footerNote: resolve(template.footerNote),
      footerSettings
    }
  );

  // Create Text
  const text = createPlainTextEmail(
    bodyContent.replace(/<[^>]*>?/gm, ''),
    '' // No unsubscribe link for transactional
  );

  return await sendEmail({
    to,
    subject,
    html,
    text
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
  pdfBase64?: string
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

  const resolve = (text: string) =>
    text.replace(/\{\{ \.Name \}\}/g, fullName);

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
    ${data.message ? `
      <div style="background-color: #f8f9fa; padding: 24px; border-radius: 8px; margin: 24px 0;">
        <h3 style="margin-top: 0; font-size: 18px; color: #111827;">Message</h3>
        <p style="margin: 8px 0; padding: 16px; background-color: #fff; border-left: 3px solid #6d28d9; border-radius: 4px; white-space: pre-wrap;">${data.message}</p>
      </div>
    ` : ''}
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

  const resolve = (text: string) =>
    text.replace(/\{\{ \.Name \}\}/g, fullName);

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