/**
 * Consultation Routes
 *
 * Handles consultation booking requests from the public website.
 * Sends two transactional emails:
 *   1. Admin notification to info@navigatewealth.co with client details + PDF
 *   2. Acknowledgment email to the submitter with booking details
 *
 * Hardened with:
 *   - Zod schema validation
 *   - Honeypot field (silent rejection for bots)
 *   - Email-based rate limiting (5 per hour per email)
 *   - asyncHandler for consistent error handling
 *   - Footer settings for template consistency
 *
 * No auth required — this is a public-facing endpoint.
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createPlainTextEmail, createEmailTemplate, sendEmail, getFooterSettings } from './email-service.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { generateContactPdf, type ContactPdfData } from './contact-pdf-generator.ts';
import { submissionsService } from './submissions-service.ts';
import { asyncHandler } from './error.middleware.ts';
import { ConsultationRequestSchema } from './consultation-validation.ts';
import { formatZodError } from './shared-validation-utils.ts';
import {
  getBlockedEmailDomain,
  getBlockedEmailDomainWarning,
} from '../../../shared/submissions/blockedEmailDomains.ts';

const app = new Hono();
const log = createModuleLogger('consultation');

// ── Date validation helpers (mirrors client-side ConsultationModal rules) ────

/**
 * Get current SAST time regardless of server timezone.
 */
function getCurrentSASTTime(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Johannesburg' }));
}

function isWeekend(date: Date): boolean {
  return date.getDay() === 0 || date.getDay() === 6;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Returns the earliest bookable date (mirrors getMinBookingDate in ConsultationModal).
 *
 * Policy: bookings require at least one full business day for scheduling.
 * Today and the next business day are both disabled. The first available
 * date is the second business day from today.
 */
function getMinBookingDate(): Date {
  const today = startOfDay(getCurrentSASTTime());
  let date = addDays(today, 1);

  // Advance past weekends to find the next business day
  while (isWeekend(date)) date = addDays(date, 1);

  // That's the next business day — skip it
  date = addDays(date, 1);

  // Advance past weekends again to land on the first available business day
  while (isWeekend(date)) date = addDays(date, 1);

  return date;
}

/**
 * Validate a booking date + time pair against business rules.
 * Returns null if valid, or an error message string.
 */
function validateBookingDateTime(dateStr: string, timeStr: string): string | null {
  // Parse the date
  const bookingDate = new Date(dateStr + 'T00:00:00');
  if (isNaN(bookingDate.getTime())) {
    return `Invalid date format: ${dateStr}`;
  }

  // Check weekends
  if (isWeekend(bookingDate)) {
    return `Bookings are not available on weekends. Selected: ${dateStr}`;
  }

  // Check minimum booking date (no same-day, no next-business-day)
  const minDate = getMinBookingDate();
  const bookingDayStart = startOfDay(bookingDate);
  const minDayStart = startOfDay(minDate);

  if (bookingDayStart < minDayStart) {
    const minDateStr = minDate.toISOString().split('T')[0];
    return `Booking date is too soon. The earliest available date is ${minDateStr}. Selected: ${dateStr}`;
  }

  // Validate time format and business hours (08:00–16:30)
  if (timeStr) {
    const timeMatch = timeStr.match(/^(\d{2}):(\d{2})$/);
    if (!timeMatch) {
      return `Invalid time format: ${timeStr}. Expected HH:MM`;
    }

    const hour = parseInt(timeMatch[1], 10);
    const minute = parseInt(timeMatch[2], 10);

    if (hour < 8 || (hour === 16 && minute > 30) || hour > 16) {
      return `Booking time must be between 08:00 and 16:30. Selected: ${timeStr}`;
    }
  }

  return null;
}

// Root handlers
app.get('/', (c) => c.json({ service: 'consultation', status: 'active' }));
app.get('', (c) => c.json({ service: 'consultation', status: 'active' }));

// Consultation request endpoint
app.post('/request', asyncHandler(async (c) => {
  const body = await c.req.json();

  // --- Validate via Zod schema --------------------------------------------------
  const parsed = ConsultationRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
  }

  const {
    name, email, phone, meetingType,
    preferredDate1, preferredTime1,
    preferredDate2, preferredTime2,
    preferredDate3, preferredTime3,
    additionalNotes, website,
  } = parsed.data;

  // --- Honeypot check (silent rejection — looks like success to bots) ----------
  if (website && website.length > 0) {
    log.info('Honeypot triggered on consultation request — likely bot', { email });
    return c.json({
      success: true,
      consultationId: crypto.randomUUID(),
      message: 'Consultation request received successfully',
    }, 200);
  }

  const blockedDomain = getBlockedEmailDomain(email);
  if (blockedDomain) {
    log.warn('Blocked consultation request from scam domain', { email, blockedDomain });
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
  const rateLimitKey = `rate_limit:consultation:${email}`;
  const rateData = await kv.get(rateLimitKey);
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;

  if (rateData && Array.isArray(rateData.timestamps)) {
    const recent = rateData.timestamps.filter((t: number) => now - t < oneHour);
    if (recent.length >= 5) {
      log.info('Consultation rate limit exceeded', { email });
      return c.json({
        error: 'Too many requests. Please wait a while before trying again.',
      }, 429);
    }
    await kv.set(rateLimitKey, { timestamps: [...recent, now] });
  } else {
    await kv.set(rateLimitKey, { timestamps: [now] });
  }

  // --- Server-side date validation (mirrors ConsultationModal client rules) ──
  const dateErrors: string[] = [];

  const err1 = validateBookingDateTime(preferredDate1, preferredTime1);
  if (err1) dateErrors.push(`Preferred slot 1: ${err1}`);

  if (preferredDate2 && preferredTime2) {
    const err2 = validateBookingDateTime(preferredDate2, preferredTime2);
    if (err2) dateErrors.push(`Preferred slot 2: ${err2}`);
  }

  if (preferredDate3 && preferredTime3) {
    const err3 = validateBookingDateTime(preferredDate3, preferredTime3);
    if (err3) dateErrors.push(`Preferred slot 3: ${err3}`);
  }

  if (dateErrors.length > 0) {
    log.error('Consultation booking date validation failed', { dateErrors });
    return c.json({
      error: 'Invalid booking date or time',
      details: dateErrors,
    }, 400);
  }

  // --- Persist to KV -----------------------------------------------------------
  const timestamp = new Date().toISOString();
  const consultationId = crypto.randomUUID();

  const consultationData = {
    name, email, phone, meetingType,
    preferredDate1, preferredTime1,
    preferredDate2, preferredTime2,
    preferredDate3, preferredTime3,
    additionalNotes,
  };

  await kv.set(`consultation:${consultationId}`, {
    ...consultationData,
    id: consultationId,
    submittedAt: timestamp,
    status: 'pending',
  });

  // --- Create Submissions Manager entry ----------------------------------------
  let submissionId: string | undefined;
  try {
    const submissionEntry = await submissionsService.create({
      type: 'consultation',
      sourceChannel: 'website_form',
      payload: {
        meetingType,
        preferredDate: preferredDate1,
        preferredTime: preferredTime1,
        phone,
        additionalNotes: additionalNotes || '',
        consultationId,
      },
      submitterName: name,
      submitterEmail: email,
    });
    submissionId = submissionEntry.id;
  } catch (submissionError) {
    log.error('Failed to create submission entry for consultation (non-blocking)', submissionError);
  }

  // --- Send emails (fire-and-forget, do not block the response) ----------------
  const sendgridApiKey = Deno.env.get('SENDGRID_API_KEY');

  if (!sendgridApiKey) {
    log.error('SENDGRID_API_KEY not configured. Emails will not be sent.');
    return c.json({
      error: 'Email service not configured',
      consultationId,
    }, 500);
  }

  // Format preferred times for display
  const preferredTimes: string[] = [];
  if (preferredDate1 && preferredTime1) {
    const date1 = new Date(preferredDate1 + 'T' + preferredTime1);
    preferredTimes.push(date1.toLocaleString('en-ZA', {
      timeZone: 'Africa/Johannesburg',
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }));
  }
  if (preferredDate2 && preferredTime2) {
    const date2 = new Date(preferredDate2 + 'T' + preferredTime2);
    preferredTimes.push(date2.toLocaleString('en-ZA', {
      timeZone: 'Africa/Johannesburg',
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }));
  }
  if (preferredDate3 && preferredTime3) {
    const date3 = new Date(preferredDate3 + 'T' + preferredTime3);
    preferredTimes.push(date3.toLocaleString('en-ZA', {
      timeZone: 'Africa/Johannesburg',
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }));
  }

  const meetingTypeText = meetingType === 'virtual'
    ? 'Virtual Meeting (Video Call)'
    : 'Telephonic Meeting (Phone Call)';

  // Build deep link to the specific submission in the admin Submissions Manager
  const adminSubmissionUrl = submissionId
    ? `https://www.navigatewealth.co/admin?module=submissions&type=consultation&id=${encodeURIComponent(submissionId)}`
    : 'https://www.navigatewealth.co/admin?module=submissions&type=consultation';

  // Fetch admin-configured footer settings for template consistency
  const footerSettings = await getFooterSettings();

  // Client confirmation email content
  const clientContent = `
    <p>Dear ${name},</p>
    <p>Thank you for scheduling a consultation with Navigate Wealth. We have received your request and one of our team members will reach out to you soon to confirm a meeting time.</p>
    
    <div style="background-color: #f8f9fa; padding: 24px; border-radius: 8px; margin: 24px 0;">
      <h2 style="margin-top: 0; font-size: 20px; color: #000;">Your Consultation Details</h2>
      
      <div style="margin: 16px 0;">
        <p style="margin: 8px 0;"><strong>Meeting Type:</strong> ${meetingTypeText}</p>
      </div>
      
      <div style="margin: 16px 0;">
        <p style="margin: 8px 0; font-weight: 600; color: #6d28d9;">Your Preferred Times:</p>
        ${preferredTimes.map((time, index) => `
          <p style="margin: 8px 0; padding-left: 16px;">
            <strong>Option ${index + 1}:</strong> ${time}
          </p>
        `).join('')}
      </div>
      
      ${additionalNotes ? `
        <div style="margin: 16px 0;">
          <p style="margin: 8px 0;"><strong>Your Notes:</strong></p>
          <p style="margin: 8px 0; padding: 12px; background-color: #fff; border-left: 3px solid #6d28d9; border-radius: 4px;">${additionalNotes}</p>
        </div>
      ` : ''}
    </div>
    
    <div style="background-color: #f0fdf4; border: 1px solid #86efac; padding: 20px; border-radius: 8px; margin: 24px 0;">
      <h3 style="margin-top: 0; font-size: 18px; color: #166534;">What Happens Next?</h3>
      <p style="color: #15803d; margin: 8px 0;">&#10003; Our bookings agent will contact you within 24 hours</p>
      <p style="color: #15803d; margin: 8px 0;">&#10003; We'll confirm your appointment time based on your preferences</p>
      <p style="color: #15803d; margin: 8px 0;">&#10003; You'll receive meeting access details for your ${meetingType === 'virtual' ? 'video' : 'phone'} consultation</p>
      <p style="color: #15803d; margin: 8px 0;">&#10003; This consultation is completely free with no obligation</p>
    </div>
    
    <p>If you have any immediate questions or need to make changes to your request, please don't hesitate to contact us at <a href="tel:+27126672505" style="color: #6d28d9;">(+27) 12-667-2505</a> or <a href="mailto:info@navigatewealth.co" style="color: #6d28d9;">info@navigatewealth.co</a>.</p>
    
    <p>We look forward to speaking with you soon!</p>
    
    <p style="margin-top: 24px;">Best regards,<br><strong>The Navigate Wealth Team</strong></p>
  `;

  // Admin notification email content
  const adminContent = `
    <p>A new consultation has been requested. Please review the details below and contact the client within 24 hours to confirm the appointment.</p>
    
    <div style="background-color: #fef3c7; border: 1px solid #fbbf24; padding: 20px; border-radius: 8px; margin: 24px 0;">
      <p style="margin: 0; color: #92400e;"><strong>Action Required:</strong> Contact the client to confirm consultation time</p>
    </div>
    
    <div style="background-color: #f8f9fa; padding: 24px; border-radius: 8px; margin: 24px 0;">
      <h2 style="margin-top: 0; font-size: 20px; color: #000;">Client Information</h2>
      
      <p style="margin: 8px 0;"><strong>Name:</strong> ${name}</p>
      <p style="margin: 8px 0;"><strong>Email:</strong> <a href="mailto:${email}" style="color: #6d28d9;">${email}</a></p>
      <p style="margin: 8px 0;"><strong>Phone:</strong> <a href="tel:${phone}" style="color: #6d28d9;">${phone}</a></p>
      <p style="margin: 8px 0;"><strong>Meeting Type:</strong> ${meetingTypeText}</p>
      <p style="margin: 8px 0;"><strong>Request ID:</strong> ${consultationId}</p>
      ${submissionId ? `<p style="margin: 8px 0;"><strong>Submission ID:</strong> <a href="${adminSubmissionUrl}" style="color: #6d28d9;">${submissionId}</a></p>` : ''}
      <p style="margin: 8px 0;"><strong>Submitted:</strong> ${new Date(timestamp).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg', dateStyle: 'full', timeStyle: 'long' })}</p>
    </div>
    
    <div style="background-color: #f8f9fa; padding: 24px; border-radius: 8px; margin: 24px 0;">
      <h2 style="margin-top: 0; font-size: 20px; color: #000;">Preferred Meeting Times</h2>
      ${preferredTimes.map((time, index) => `
        <p style="margin: 8px 0; padding: 12px; background-color: #fff; border-left: 3px solid #6d28d9; border-radius: 4px;">
          <strong>Option ${index + 1}:</strong> ${time}
        </p>
      `).join('')}
    </div>
    
    ${additionalNotes ? `
      <div style="background-color: #f8f9fa; padding: 24px; border-radius: 8px; margin: 24px 0;">
        <h2 style="margin-top: 0; font-size: 20px; color: #000;">Additional Notes from Client</h2>
        <p style="margin: 8px 0; padding: 16px; background-color: #fff; border-radius: 4px; white-space: pre-wrap;">${additionalNotes}</p>
      </div>
    ` : ''}
    
    <div style="background-color: #eff6ff; border: 1px solid #93c5fd; padding: 20px; border-radius: 8px; margin: 24px 0;">
      <h3 style="margin-top: 0; font-size: 18px; color: #1e40af;">Next Steps</h3>
      <p style="color: #1e3a8a; margin: 8px 0;">1. Review the client's preferred times</p>
      <p style="color: #1e3a8a; margin: 8px 0;">2. Contact the client via phone or email to confirm the appointment</p>
      <p style="color: #1e3a8a; margin: 8px 0;">3. Send calendar invitation and meeting access details</p>
      <p style="color: #1e3a8a; margin: 8px 0;">4. <a href="${adminSubmissionUrl}" style="color: #1e40af; text-decoration: underline;">Update the consultation status</a> in the Submissions Manager</p>
    </div>
  `;

  // --- Generate PDF attachment for admin email ---------------------------------
  let pdfBase64: string | undefined;
  try {
    const pdfData: ContactPdfData = {
      formType: 'consultation',
      title: `Consultation Request — ${name}`,
      submittedAt: timestamp,
      fields: [
        { label: 'Full Name', value: name },
        { label: 'Email', value: email },
        { label: 'Phone', value: phone },
        { label: 'Meeting Type', value: meetingTypeText },
        ...preferredTimes.map((time: string, i: number) => ({
          label: `Preferred Time ${i + 1}`,
          value: time,
        })),
      ],
      message: additionalNotes || undefined,
    };
    pdfBase64 = generateContactPdf(pdfData);
  } catch (pdfError) {
    log.error('Failed to generate consultation PDF (non-blocking)', pdfError);
  }

  // --- Send emails --------------------------------------------------------------
  const emailResults = await Promise.allSettled([
    // Client confirmation email via direct SendGrid (custom from address)
    fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sendgridApiKey}`,
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email }],
          subject: 'Consultation Request Received — Navigate Wealth',
        }],
        from: {
          email: 'noreply@navigatewealth.co',
          name: 'Navigate Wealth',
        },
        reply_to: {
          email: 'info@navigatewealth.co',
          name: 'Navigate Wealth',
        },
        content: [
          {
            type: 'text/plain',
            value: createPlainTextEmail(`Consultation Request Received\n\n${clientContent}`),
          },
          {
            type: 'text/html',
            value: createEmailTemplate(clientContent, {
              title: 'Consultation Request Received',
              buttonUrl: 'https://www.navigatewealth.co/resources',
              buttonLabel: 'Browse Resources',
              footerSettings,
            }),
          },
        ],
        custom_args: {
          type: 'consultation_confirmation',
          source: 'website_form',
        },
      }),
    }).then(async (res) => {
      if (!res.ok) {
        const errorText = await res.text();
        log.error('Client consultation email SendGrid error', { status: res.status, error: errorText });
        return false;
      }
      return true;
    }),

    // Admin notification email via shared sendEmail (no custom headers needed)
    sendEmail({
      to: 'info@navigatewealth.co',
      subject: `New Consultation Request: ${name}`,
      html: createEmailTemplate(adminContent, {
        title: 'New Consultation Request',
        buttonUrl: adminSubmissionUrl,
        buttonLabel: 'View Submission in Admin',
        footerSettings,
      }),
      attachments: pdfBase64
        ? [{
            content: pdfBase64,
            filename: `Consultation_Request_${name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`,
            type: 'application/pdf',
            disposition: 'attachment',
          }]
        : undefined,
    }),
  ]);

  const clientOk = emailResults[0].status === 'fulfilled' && emailResults[0].value === true;
  const adminOk = emailResults[1].status === 'fulfilled' && emailResults[1].value === true;

  if (!clientOk) {
    log.error('Failed to send client consultation confirmation email', { consultationId });
  }
  if (!adminOk) {
    log.error('Failed to send admin notification for consultation', { consultationId });
  }

  log.info('Consultation request processed', { consultationId, submissionId });

  return c.json({
    message: 'Consultation request received successfully',
    success: true,
    consultationId,
    emailsSent: { admin: adminOk, acknowledgment: clientOk },
  }, 200);
}));

export default app;
