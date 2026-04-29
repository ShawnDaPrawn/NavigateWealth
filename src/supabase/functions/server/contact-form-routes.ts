/**
 * Contact Form Routes
 *
 * Handles contact form submissions from the public website.
 * Sends two transactional emails:
 *   1. Admin notification to info@navigatewealth.co with the client details
 *   2. Acknowledgment email to the submitter
 *
 * No auth required — this is a public-facing endpoint.
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import {
  sendContactFormAdminNotification,
  sendContactFormAcknowledgment,
  type ContactFormData,
} from './email-service.ts';
import { generateContactPdf, type ContactPdfData } from './contact-pdf-generator.ts';
import { ContactFormSubmitSchema } from './contact-form-validation.ts';
import { formatZodError } from './shared-validation-utils.ts';
import { submissionsService } from './submissions-service.ts';
import { asyncHandler } from './error.middleware.ts';
import {
  getBlockedEmailDomain,
  getBlockedEmailDomainWarning,
} from '../../../shared/submissions/blockedEmailDomains.ts';
import {
  getBlockedClientIp,
  getBlockedIpAddressWarning,
} from '../../../shared/submissions/blockedIpAddresses.ts';

const app = new Hono();
const log = createModuleLogger('contact-form');

// Health check
app.get('/', (c) => c.json({ service: 'contact-form', status: 'active' }));

/**
 * POST /contact-form/submit
 *
 * Accepts the contact form payload, persists it in KV,
 * and fires both transactional emails.
 */
app.post('/submit', asyncHandler(async (c) => {
  const blockedIpAddress = getBlockedClientIp((headerName) => c.req.header(headerName));
  if (blockedIpAddress) {
    log.warn('Blocked contact form submission from abusive IP address', { blockedIpAddress });
    return c.json(
      {
        error: getBlockedIpAddressWarning(blockedIpAddress),
        warning: true,
        blockedIpAddress,
      },
      403,
    );
  }

  const body = await c.req.json();

  // --- Validate required fields via Zod schema --------------------------------
  const parsed = ContactFormSubmitSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
  }

  const { firstName, lastName, email, phone, service, message, clientType, website } =
    parsed.data;

  // --- Honeypot check (silent rejection — looks like success to bots) ----------
  if (website && website.length > 0) {
    log.info('Honeypot triggered on contact form — likely bot', { email });
    return c.json({
      success: true,
      submissionId: crypto.randomUUID(),
      message: 'Your enquiry has been received. We will be in touch shortly.',
      emailsSent: { admin: true, acknowledgment: true },
    }, 200);
  }

  const blockedDomain = getBlockedEmailDomain(email);
  if (blockedDomain) {
    log.warn('Blocked contact form submission from scam domain', { email, blockedDomain });
    return c.json(
      {
        error: getBlockedEmailDomainWarning(blockedDomain),
        warning: true,
        blockedDomain,
      },
      403,
    );
  }

  // --- Rate limit: max 5 submissions per email per hour -------------------------
  const rateLimitKey = `rate_limit:contact:${email.toLowerCase()}`;
  const rateData = await kv.get(rateLimitKey);
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;

  if (rateData && Array.isArray(rateData.timestamps)) {
    const recent = rateData.timestamps.filter((t: number) => now - t < oneHour);
    if (recent.length >= 5) {
      log.info('Contact form rate limit exceeded', { email });
      return c.json({
        error: 'Too many submissions. Please wait a while before trying again.',
      }, 429);
    }
    // Update with new timestamp
    await kv.set(rateLimitKey, { timestamps: [...recent, now] });
  } else {
    await kv.set(rateLimitKey, { timestamps: [now] });
  }

  // --- Persist to KV -----------------------------------------------------------
  const submissionId = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  const submission = {
    id: submissionId,
    firstName,
    lastName,
    email,
    phone,
    service: service || '',
    message: message || '',
    clientType: clientType || '',
    submittedAt: timestamp,
    status: 'new',
  };

  await kv.set(`contact_form:${submissionId}`, submission);
  log.info('Contact form submission stored', { submissionId });

  // --- Create Submissions Manager entry so it appears in the admin kanban board ---
  let submissionEntryId: string | undefined;
  try {
    const submissionEntry = await submissionsService.create({
      type: 'contact',
      sourceChannel: 'website_form',
      payload: {
        service: service || '',
        message: message || '',
        clientType: clientType || '',
        phone,
        contactFormId: submissionId,
      },
      submitterName: `${firstName} ${lastName}`.trim(),
      submitterEmail: email,
    });
    submissionEntryId = submissionEntry.id;
  } catch (subError) {
    log.error('Failed to create submission entry for contact form (non-blocking)', subError);
  }

  // --- Send emails (fire-and-forget, do not block the response) ----------------
  const contactData: ContactFormData = {
    firstName,
    lastName,
    email,
    phone,
    service,
    message,
    clientType,
  };

  // --- Generate PDF attachment for admin email ---------------------------------
  let pdfBase64: string | undefined;
  try {
    const clientTypeLabel = clientType
      ? clientType.charAt(0).toUpperCase() + clientType.slice(1)
      : 'Not specified';

    const pdfData: ContactPdfData = {
      formType: 'contact',
      title: `Contact Enquiry — ${firstName} ${lastName}`,
      submittedAt: timestamp,
      fields: [
        { label: 'Full Name', value: `${firstName} ${lastName}` },
        { label: 'Email', value: email },
        { label: 'Phone', value: phone },
        { label: 'Client Type', value: clientTypeLabel },
        ...(service ? [{ label: 'Service Interest', value: service }] : []),
      ],
      message: message || undefined,
    };
    pdfBase64 = generateContactPdf(pdfData);
  } catch (pdfError) {
    log.error('Failed to generate contact form PDF (non-blocking)', pdfError);
  }

  const emailResults = await Promise.allSettled([
    sendContactFormAdminNotification(contactData, pdfBase64),
    sendContactFormAcknowledgment(contactData),
  ]);

  const adminEmailOk =
    emailResults[0].status === 'fulfilled' && emailResults[0].value === true;
  const clientEmailOk =
    emailResults[1].status === 'fulfilled' && emailResults[1].value === true;

  if (!adminEmailOk) {
    log.error('Failed to send admin notification email for contact form submission', {
      submissionId,
      reason:
        emailResults[0].status === 'rejected'
          ? (emailResults[0] as PromiseRejectedResult).reason
          : 'sendEmail returned false',
    });
  }
  if (!clientEmailOk) {
    log.error('Failed to send client acknowledgment email for contact form submission', {
      submissionId,
      reason:
        emailResults[1].status === 'rejected'
          ? (emailResults[1] as PromiseRejectedResult).reason
          : 'sendEmail returned false',
    });
  }

  return c.json(
    {
      success: true,
      submissionId,
      message: 'Your enquiry has been received. We will be in touch shortly.',
      emailsSent: {
        admin: adminEmailOk,
        acknowledgment: clientEmailOk,
      },
    },
    200,
  );
}));

export default app;
