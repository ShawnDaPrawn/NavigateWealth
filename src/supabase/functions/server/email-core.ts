/**
 * email-core.ts — SendGrid transport + template/footer engine (Phase 5c).
 * ============================================================================
 *
 * Extracted verbatim from email-service.tsx: the lazy SendGrid key, the
 * `sendEmail` transport (with overloads), the HTML/plain-text template builders
 * (createEmailTemplate / createPlainTextEmail), and the footer/template registry
 * (getEmailTemplate / getFooterSettings + DEFAULT_TEMPLATES / DEFAULT_FOOTER_SETTINGS).
 * The domain `send*` helpers in email-service.tsx import from here; email-service
 * re-exports this module so the email-service.ts proxy surface is unchanged.
 */
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';

const log = createModuleLogger('email-core');

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
  address:
    'First Floor, Milestone Place, Block A<br />25 Sovereign Dr, Route 21 Business Park<br />Irene, 0157',
  contactEmail: 'info@navigatewealth.co',
  contactPhone: '',
  socialLinks: {
    linkedin: 'https://www.linkedin.com/company/navigatewealth/',
    instagram: 'https://www.instagram.com/navigate_wealth?igsh=MTh6bTc2emszbXU0MA==',
    youtube: 'https://www.youtube.com/@navigatewealth',
  },
  copyrightText: '© {{Year}} Navigate Wealth. All rights reserved.',
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
    bodyHtml:
      '<p>You have been invited to join the Navigate Wealth platform. Click the button below to set up your account.</p>',
    buttonLabel: 'Accept Invitation',
    buttonUrl: '{{ .InviteLink }}',
    footerNote: 'This link will expire in 48 hours.',
  },
  welcome_email: {
    id: 'welcome_email',
    name: 'Welcome Email',
    enabled: true,
    subject: 'Welcome to Navigate Wealth',
    title: 'Welcome Aboard!',
    subtitle: 'We are excited to have you with us',
    greeting: 'Hi {{ .Name }},',
    bodyHtml:
      '<p>Thank you for joining Navigate Wealth. We are here to help you manage your wealth effectively.</p>',
    buttonLabel: 'Go to Dashboard',
    buttonUrl: '{{ .DashboardLink }}',
    footerNote: '',
  },
  application_received: {
    id: 'application_received',
    name: 'Application Received',
    enabled: true,
    subject: 'We received your application',
    title: 'Application Received',
    subtitle: 'Thank you for submitting your application',
    greeting: 'Dear {{ .Name }},',
    bodyHtml:
      '<p>We have received your application and it is currently being reviewed by our team. We will get back to you shortly.</p>',
    buttonLabel: 'View Application Status',
    buttonUrl: '{{ .ApplicationLink }}',
    footerNote: '',
  },
  application_approved: {
    id: 'application_approved',
    name: 'Application Approved',
    enabled: true,
    subject: 'Your application has been approved',
    title: 'Congratulations!',
    subtitle: 'Your application was successful',
    greeting: 'Dear {{ .Name }},',
    bodyHtml:
      '<p>We are pleased to inform you that your application has been approved. You can now access all features of your account.</p>',
    buttonLabel: 'Get Started',
    buttonUrl: '{{ .DashboardLink }}',
    footerNote: '',
  },
  password_reset: {
    id: 'password_reset',
    name: 'Password Reset',
    enabled: true,
    subject: 'Reset your password',
    title: 'Password Reset Request',
    subtitle: 'You requested to reset your password',
    greeting: 'Hello,',
    bodyHtml:
      '<p>We received a request to reset your password. If you did not make this request, please ignore this email.</p>',
    buttonLabel: 'Reset Password',
    buttonUrl: '{{ .ResetLink }}',
    footerNote: 'This link expires in 1 hour.',
  },
  new_documents_notification: {
    id: 'new_documents_notification',
    name: 'New Documents Notification',
    enabled: true,
    subject: 'New Documents Uploaded',
    title: 'New Documents Available',
    subtitle: 'Documents have been added to your profile',
    greeting: 'Dear {{ .Name }},',
    bodyHtml:
      '{{ .CustomMessage }}<p>They are attached to this email in a secure, encrypted ZIP file.</p><p><strong>Password:</strong> Your National ID Number</p><p>Please log in to your portal to view them online.</p>',
    buttonLabel: 'Login to Portal',
    buttonUrl: 'https://www.navigatewealth.co/login',
    footerNote: '',
  },
  resend_documents_notification: {
    id: 'resend_documents_notification',
    name: 'Resend Documents Notification',
    enabled: true,
    subject: 'Documents Resent',
    title: 'Documents Resent',
    subtitle: 'Documents have been resent to your profile',
    greeting: 'Dear {{ .Name }},',
    bodyHtml:
      '{{ .CustomMessage }}<p>They are attached to this email in a secure, encrypted ZIP file.</p><p><strong>Password:</strong> Your National ID Number</p><p>Please log in to your portal to view them online.</p>',
    buttonLabel: 'Login to Portal',
    buttonUrl: 'https://www.navigatewealth.co/login',
    footerNote: '',
  },
  general_campaign: {
    id: 'general_campaign',
    name: 'General Communication',
    enabled: true,
    subject: 'Update from Navigate Wealth',
    title: 'Navigate Wealth',
    subtitle: '',
    greeting: '',
    bodyHtml:
      '<p>This is the base template for all general communication campaigns. The content of your campaigns will be injected here.</p>',
    buttonLabel: '',
    buttonUrl: '',
    footerNote: '',
  },
  calendar_reminder: {
    id: 'calendar_reminder',
    name: 'Calendar Event Reminder',
    enabled: true,
    subject: 'Reminder: {{ .EventTitle }}',
    title: 'Event Reminder',
    subtitle: 'Upcoming Event',
    greeting: 'Hello {{ .Name }},',
    bodyHtml:
      '<p>This is a reminder that you have an event scheduled for <strong>{{ .TimeFrame }}</strong>.</p><div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;"><h3 style="margin-top: 0; color: #111827;">{{ .EventTitle }}</h3><p style="margin: 5px 0;"><strong>Date:</strong> {{ .EventDate }}</p><p style="margin: 5px 0;"><strong>Time:</strong> {{ .EventTime }}</p><p style="margin: 5px 0;"><strong>Location:</strong> {{ .Location }}</p>{{ .Description }}</div>',
    buttonLabel: 'Join Meeting',
    buttonUrl: '{{ .MeetingLink }}',
    footerNote: 'We look forward to seeing you there.',
  },
  admin_daily_report: {
    id: 'admin_daily_report',
    name: 'Admin Daily Report',
    enabled: true,
    subject: 'Daily Calendar - {{ .Date }}',
    title: 'Daily Calendar Report',
    subtitle: '',
    greeting: 'Good morning,',
    bodyHtml:
      '<p>Please find attached the calendar for today, <strong>{{ .Date }}</strong>.</p><p>You have <strong>{{ .EventCount }}</strong> event(s) scheduled.</p>',
    buttonLabel: 'View Calendar',
    buttonUrl: 'https://www.navigatewealth.co/admin/calendar',
    footerNote: '',
  },
  request_info_required: {
    id: 'request_info_required',
    name: 'Request Information Required',
    enabled: true,
    subject: 'Action Required: Please complete your information request',
    title: 'Information Request',
    subtitle: 'We need some additional information from you',
    greeting: 'Dear {{ .Name }},',
    bodyHtml:
      '<p>A new request has been created that requires your input. Please click the button below to view the request and provide the necessary information.</p>',
    buttonLabel: 'Complete Request',
    buttonUrl: '{{ .RequestLink }}',
    footerNote: 'If you have any questions, please contact us.',
  },
  signature_request: {
    id: 'signature_request',
    name: 'E-Signature Request',
    enabled: true,
    subject: 'Signature Request: {{ .DocumentName }}',
    title: 'Document Signature Request',
    subtitle: 'Your signature is required',
    greeting: 'Hello {{ .RecipientName }},',
    bodyHtml:
      '<p>{{ .SenderName }} has sent you a document to sign: <strong>{{ .DocumentName }}</strong></p><p>Please click the button below to review and sign the document.</p>',
    buttonLabel: 'Review & Sign Document',
    buttonUrl: '{{ .SigningUrl }}',
    footerNote:
      "This signature request was sent via Navigate Wealth's secure e-signature platform.",
  },
  contact_form_admin: {
    id: 'contact_form_admin',
    name: 'Contact Form — Admin Notification',
    enabled: true,
    subject: 'New Contact Form Submission: {{ .Name }}',
    title: 'New Contact Form Submission',
    subtitle: 'A prospective client has reached out via the website',
    greeting: '',
    bodyHtml:
      '<p>A new enquiry has been submitted via the website contact form. Please review the details below and respond within 24 hours.</p>',
    buttonLabel: 'View Admin Dashboard',
    buttonUrl: 'https://www.navigatewealth.co/admin',
    footerNote: '',
  },
  contact_form_acknowledgment: {
    id: 'contact_form_acknowledgment',
    name: 'Contact Form — Client Acknowledgment',
    enabled: true,
    subject: 'We received your enquiry — Navigate Wealth',
    title: 'Thank You for Reaching Out',
    subtitle: 'We have received your message',
    greeting: 'Dear {{ .Name }},',
    bodyHtml:
      '<p>Thank you for contacting Navigate Wealth. We have received your enquiry and one of our team members will be in touch with you shortly.</p><p>If your matter is urgent, please do not hesitate to call us directly.</p>',
    buttonLabel: 'Explore Our Services',
    buttonUrl: 'https://www.navigatewealth.co/services',
    footerNote:
      'If you have any immediate questions, contact us at <a href="mailto:info@navigatewealth.co" style="color: #6d28d9;">info@navigatewealth.co</a> or call <a href="tel:+27126672025" style="color: #6d28d9;">012 667 2025</a>.',
  },
  application_invite: {
    id: 'application_invite',
    name: 'Application Invitation',
    enabled: true,
    subject: "You're invited to join Navigate Wealth",
    title: "You're Invited",
    subtitle: 'Create your Navigate Wealth account',
    greeting: 'Dear {{ .Name }},',
    bodyHtml:
      "<p>You have been personally invited to create an account with <strong>Navigate Wealth</strong>, South Africa's trusted independent financial advisory firm.</p><p>Click the button below to set up your account and get started on your financial journey. Our team is ready to assist you every step of the way.</p>",
    buttonLabel: 'Create My Account',
    buttonUrl: '{{ .SetupLink }}',
    footerNote:
      'This invitation was sent on behalf of Navigate Wealth. If you did not expect this invitation, you may safely ignore this email.',
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
      log.warn(`Failed to parse template data for ${id}`, { error: e instanceof Error ? e.message : String(e) });
      templateData = {};
    }
  }

  // Merge default with custom data
  return {
    ...defaultTemplate,
    ...(templateData || {}),
    id, // Ensure ID is preserved
  };
}

export async function getFooterSettings(): Promise<EmailFooterSettings> {
  try {
    const data = await kv.get(KV_FOOTER_KEY);
    if (data) return { ...DEFAULT_FOOTER_SETTINGS, ...data };
  } catch (e) {
    log.warn('Failed to fetch footer settings', { error: e instanceof Error ? e.message : String(e) });
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
  attachments?: SendGridAttachment[],
): Promise<void>;
/**
 * Implementation
 */
export async function sendEmail(
  paramsOrTo: EmailParams | string,
  subject?: string,
  html?: string,
  text?: string,
  attachments?: SendGridAttachment[],
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
    finalText =
      paramsOrTo.text ||
      paramsOrTo.html
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
    finalText =
      text ||
      html!
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
      personalizations.cc = cc.map((email) => ({ email }));
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
        Authorization: `Bearer ${sendgridApiKey}`,
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

import { BASE_EMAIL_TEMPLATE } from './email_base_html.ts';

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
  } = {},
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
    template = template.replace(/(<\/table>\s*<\/body>\s*<\/html>\s*)$/i, `${unsubHtml}$1`);
    // If the pattern didn't match, try inserting before </body>
    if (!template.includes(unsubHtml)) {
      template = template.replace(
        /(<\/body>)/i,
        `<div style="text-align:center; padding:8px 0;"><a href="${unsubscribeLink}" style="font-size:11px; color:#9ca3af; text-decoration:underline;">Unsubscribe</a></div>$1`,
      );
    }
  }

  // Helper to render the Go-like template syntax with JS

  // 1. Handle Conditionals: {{ if .Key }} ... {{ end }}
  // We support nested replacement inside the block, but not nested ifs.
  template = template.replace(
    /\{\{ if \.([a-zA-Z0-9_]+) \}\}([\s\S]*?)\{\{ end \}\}/g,
    (_match, key, blockContent) => {
      // If data[key] is truthy (and not empty string), return blockContent. Else empty string.
      if (data[key]) {
        return blockContent;
      }
      return '';
    },
  );

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
  const unsubscribeText = unsubscribeLink ? `\n\n---\nUnsubscribe: ${unsubscribeLink}` : '';

  return `
${content}
${unsubscribeText}

---
© ${new Date().getFullYear()} Navigate Wealth. All rights reserved.
Navigate Wealth | South Africa's Independent Financial Advisory Firm
  `.trim();
}
