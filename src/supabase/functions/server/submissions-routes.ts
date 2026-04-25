/**
 * Submissions Routes
 * Navigate Wealth Admin Server
 *
 * Thin dispatcher for the Submissions Manager module.
 * All business logic lives in submissions-service.ts.
 *
 * Route prefix: /submissions  (mounted in mount-modules.ts)
 *
 * Per §14.2: static maintenance paths are registered before /:id to
 * prevent path collisions.
 *
 * Per §4.2: routes are thin dispatchers — they parse input, call the
 * service, and return responses. Validation schemas live in
 * submissions-validation.ts.
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { submissionsService } from './submissions-service.ts';
import { requireAuth } from './auth-mw.ts';
import { asyncHandler } from './error.middleware.ts';
import { sendEmail, createEmailTemplate, getFooterSettings } from './email-service.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { formatZodError } from './shared-validation-utils.ts';
import {
  CreateSubmissionSchema,
  UpdateSubmissionSchema,
  InviteEmailSchema,
  SubmissionListQuerySchema,
} from './submissions-validation.ts';
import {
  getBlockedEmailDomain,
  getBlockedEmailDomainWarning,
} from '../../../shared/submissions/blockedEmailDomains.ts';

const log = createModuleLogger('submissions-routes');
const app = new Hono();

// ── POST /submissions/invite ───────────────────────────────────────────────────
// Send a branded invitation email directing a client to a specific form.
// Registered before /:id to prevent path collision (§14.2).
app.post('/invite', requireAuth, asyncHandler(async (c) => {
  const body = await c.req.json();

  const parsed = InviteEmailSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
  }

  const { recipientEmail, recipientName, inviteTypeId, formUrl, emailSubject, emailBody, emailButtonLabel, personalMessage } = parsed.data;

  const greeting = recipientName
    ? `Dear ${recipientName},`
    : 'Dear Client,';

  // Build body content — include personal message if provided
  let bodyContent = emailBody || '<p>We\'d like to invite you to complete a form on our website.</p>';
  if (personalMessage && personalMessage.trim()) {
    bodyContent = `<p style="padding: 12px 16px; background: #f3f4f6; border-left: 3px solid #6d28d9; border-radius: 4px; margin-bottom: 16px; font-style: italic; color: #374151;">${personalMessage.replace(/\n/g, '<br />')}</p>${bodyContent}`;
  }

  const footerSettings = await getFooterSettings();

  const html = createEmailTemplate(bodyContent, {
    title: 'Navigate Wealth',
    subtitle: emailSubject || 'You\'re Invited',
    greeting,
    buttonUrl: formUrl,
    buttonLabel: emailButtonLabel || 'Get Started',
    footerNote: 'This invitation was sent on behalf of Navigate Wealth (FSP 54606). If you did not expect this invitation, you may safely ignore this email.',
    footerSettings,
  });

  const text = `${greeting}\n\nYou've been invited to complete a request on Navigate Wealth.\n\nClick here to get started: ${formUrl}\n\n${personalMessage ? `Personal note: ${personalMessage}\n\n` : ''}Navigate Wealth | FSP 54606 | info@navigatewealth.co`;

  const sent = await sendEmail({
    to: recipientEmail,
    subject: emailSubject || 'You\'re Invited — Navigate Wealth',
    html,
    text,
  });

  if (!sent) {
    log.error('Failed to send submission invite email', { recipientEmail, inviteTypeId });
    return c.json({ success: false, error: 'Email could not be sent. Please check your email configuration.' }, 500);
  }

  log.info('Submission invite email sent', { recipientEmail, inviteTypeId, formUrl });
  return c.json({ success: true, message: 'Invitation sent successfully' });
}));

// ── GET /submissions ───────────────────────────────────────────────────────────
// List all submissions with optional ?type= and ?status= filters
app.get('/', requireAuth, asyncHandler(async (c) => {
  const rawQuery = {
    type: c.req.query('type'),
    status: c.req.query('status'),
  };

  // Only parse if at least one filter is present
  const hasFilters = rawQuery.type || rawQuery.status;
  let filters: { type?: string; status?: string } | undefined;

  if (hasFilters) {
    const parsed = SubmissionListQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
      return c.json({ success: false, error: 'Invalid filter parameters', ...formatZodError(parsed.error) }, 400);
    }
    filters = parsed.data;
  }

  const submissions = await submissionsService.list(filters);
  return c.json({ success: true, data: submissions });
}));

// ── GET /submissions/count/new ─────────────────────────────────────────────────
// Returns the count of 'new' submissions — used by the nav badge
// Registered before /:id to prevent collision
app.get('/count/new', requireAuth, asyncHandler(async (c) => {
  const count = await submissionsService.countNew();
  return c.json({ success: true, count });
}));

// ── GET /submissions/:id ───────────────────────────────────────────────────────
app.get('/:id', requireAuth, asyncHandler(async (c) => {
  const id = c.req.param('id');
  const submission = await submissionsService.getById(id);
  if (!submission) {
    return c.json({ success: false, error: 'Submission not found' }, 404);
  }
  return c.json({ success: true, data: submission });
}));

// ── POST /submissions ──────────────────────────────────────────────────────────
// Create a new submission — called by source forms on the website.
// This endpoint is intentionally public (no requireAuth) so website
// forms can POST without a session. The auth check at the admin UI
// layer ensures only authenticated admins can read/manage submissions.
//
// Hardened with:
//   - Zod schema validation
//   - Honeypot field (silent rejection for bots)
//   - Email-based rate limiting (5 per hour per email)
app.post('/', asyncHandler(async (c) => {
  const body = await c.req.json();

  // --- Validate via Zod schema --------------------------------------------------
  const parsed = CreateSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
  }

  const { type, sourceChannel, payload, submitterName, submitterEmail, website } = parsed.data;

  // --- Honeypot check (silent rejection — looks like success to bots) ------------
  if (website && website.length > 0) {
    log.info('Honeypot triggered on submission create — likely bot', { type, submitterEmail });
    return c.json({
      success: true,
      data: { id: `sub_${Date.now()}_honeypot`, type, status: 'new', submittedAt: new Date().toISOString() },
    }, 201);
  }

  const blockedDomain = submitterEmail ? getBlockedEmailDomain(submitterEmail) : null;
  if (blockedDomain) {
    log.warn('Blocked public submission from scam domain', { type, submitterEmail, blockedDomain });
    return c.json(
      {
        success: false,
        error: getBlockedEmailDomainWarning(blockedDomain),
        warning: true,
        blockedDomain,
      },
      403,
    );
  }

  // --- Rate limit: max 5 submissions per email per hour -------------------------
  if (submitterEmail) {
    const rateLimitKey = `rate_limit:submission:${submitterEmail}`;
    const rateData = await kv.get(rateLimitKey);
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    if (rateData && Array.isArray(rateData.timestamps)) {
      const recent = rateData.timestamps.filter((t: number) => now - t < oneHour);
      if (recent.length >= 5) {
        log.info('Submission rate limit exceeded', { submitterEmail, type });
        return c.json({
          success: false,
          error: 'Too many submissions. Please wait a while before trying again.',
        }, 429);
      }
      await kv.set(rateLimitKey, { timestamps: [...recent, now] });
    } else {
      await kv.set(rateLimitKey, { timestamps: [now] });
    }
  }

  const submission = await submissionsService.create({
    type,
    sourceChannel,
    payload,
    submitterName,
    submitterEmail,
  });

  log.info('Submission created', { id: submission.id, type, sourceChannel });
  return c.json({ success: true, data: submission }, 201);
}));

// ── PATCH /submissions/:id ─────────────────────────────────────────────────────
// Update status, notes, assignedTo, or merge into payload
app.patch('/:id', requireAuth, asyncHandler(async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();

  const parsed = UpdateSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
  }

  const { status, notes, assignedTo, payload: payloadUpdate, updatedBy } = parsed.data;

  const updated = await submissionsService.update(
    id,
    { status, notes, assignedTo, payload: payloadUpdate },
    updatedBy,
  );

  log.info('Submission updated', { id, status });
  return c.json({ success: true, data: updated });
}));

// ── DELETE /submissions/:id ────────────────────────────────────────────────────
// Hard delete — admin only
app.delete('/:id', requireAuth, asyncHandler(async (c) => {
  const id = c.req.param('id');
  await submissionsService.delete(id);
  log.info('Submission deleted', { id });
  return c.json({ success: true });
}));

export default app;
