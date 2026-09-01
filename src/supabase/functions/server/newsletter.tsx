/**
 * Newsletter Route Handlers
 *
 * §4.2 — Route files are thin dispatchers: parse input, call service, return response.
 *
 * Public flows (subscribe/confirm/unsubscribe) send through the shared
 * email-core transport — the custom from address and deliverability headers
 * ride EmailParams, so these emails follow the NW_EMAIL_PROVIDER switch
 * (SendGrid/SES) like every other platform email.
 *
 * Admin flows delegate to newsletter-service.ts.
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { constantTimeEqual } from './crypto-utils.ts';
import {
  createPlainTextEmail,
  createEmailTemplate,
  sendEmail,
  getFooterSettings,
} from './email-service.ts';
import { createModuleLogger } from './stderr-logger.ts';
import {
  addNewsletterSubscriber,
  backfillLegacyNewsletterSubscribersToGroup,
  removeNewsletterSubscriber,
} from './newsletter-group-service.ts';
import {
  NewsletterSubscribeSchema,
  AdminAddSubscriberSchema,
  AdminBulkSubscriberSchema,
  AdminEmailSchema,
  AdminUpdateSubscriberSchema,
} from './newsletter-validation.ts';
import { formatZodError } from './shared-validation-utils.ts';
import { requireAuth, requireAdmin } from './auth-mw.ts';
import { asyncHandler } from './error.middleware.ts';
import { AdminAuditService } from './admin-audit-service.ts';
import {
  extractClientIp,
  getBlockedIpAddress,
  getBlockedIpAddressWarning,
} from '../../../shared/submissions/blockedIpAddresses.ts';

// Service layer (§4.2)
import {
  listSubscribers,
  addSubscriber,
  bulkAddSubscribers,
  removeSubscriberByEmail,
  resubscribeByEmail,
  updateSubscriberDetails,
  getStats,
  reconcileClientsToSubscribers,
} from './newsletter-service.ts';

const app = new Hono();
const log = createModuleLogger('newsletter');

/**
 * The one canonical form of a subscriber address.
 *
 * Every admin and service path already keys off `email.trim().toLowerCase()`;
 * the three public routes used to key off the raw string, which split the
 * store in two the moment anyone typed a capital letter. Kept here rather than
 * imported so the public routes cannot drift from it again.
 */
function normalizeSubscriberEmail(email: string | undefined | null): string {
  return (email || '').trim().toLowerCase();
}

function subscriberKey(normalizedEmail: string): string {
  return `newsletter:${normalizedEmail}`;
}

// Root handlers
app.get('/', (c) => c.json({ service: 'newsletter', status: 'active' }));
app.get('', (c) => c.json({ service: 'newsletter', status: 'active' }));

// ============================================================================
// PUBLIC ENDPOINTS
// ============================================================================

// Newsletter subscription endpoint - Double Opt-In
app.post(
  '/subscribe',
  asyncHandler(async (c) => {
    const ip = extractClientIp((headerName) => c.req.header(headerName)) || 'Unknown';
    const blockedIpAddress = getBlockedIpAddress(ip);
    if (blockedIpAddress) {
      log.warn('Blocked newsletter subscription from abusive IP address', { blockedIpAddress });
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

    // Validate email via Zod schema
    const parsed = NewsletterSubscribeSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }
    // Lowercase at the door. Every admin and service path — removeSubscriberByEmail,
    // resubscribeByEmail, the group sync, one-click unsubscribe — looks the record
    // up as `newsletter:{email.trim().toLowerCase()}`. A record filed here under
    // `newsletter:John.Smith@x.com` is therefore invisible to all of them: the
    // admin cannot unsubscribe them, and their own unsubscribe link (built from
    // the lowercased address) misses and silently does nothing. Email local-parts
    // are technically case-sensitive; no mail provider anyone here uses treats
    // them that way, and one canonical key is what makes an opt-out honourable.
    const email = normalizeSubscriberEmail(parsed.data.email);

    const timestamp = new Date().toISOString();
    const subscriptionKey = subscriberKey(email);

    // Check if already confirmed
    const existingSubscription = await kv.get(subscriptionKey);
    if (existingSubscription && existingSubscription.confirmed) {
      return c.json(
        {
          message: 'Already subscribed',
          alreadySubscribed: true,
        },
        200,
      );
    }

    // Generate confirmation token
    const confirmToken = crypto.randomUUID();

    // Get user agent and IP for logging
    const userAgent = c.req.header('User-Agent') || 'Unknown';
    // Store pending subscription in KV store
    await kv.set(subscriptionKey, {
      email,
      subscribedAt: timestamp,
      source: 'Footer Newsletter',
      confirmed: false,
      confirmToken,
      ip,
      userAgent,
    });

    // Send confirmation email (best-effort; sendEmail no-ops when no provider
    // is configured, so subscription state is never blocked on email).
    {
      const confirmUrl = `https://www.navigatewealth.co/newsletter/confirm?token=${confirmToken}&email=${encodeURIComponent(email)}`;

      // Fetch admin-configured footer settings for template consistency
      const footerSettings = await getFooterSettings();

      // Confirmation email content
      const subscriberContent = `
      <p>Thank you for subscribing to the Navigate Wealth newsletter!</p>
      <p>Please confirm your subscription by clicking the button below:</p>
    `;

      // Admin notification content
      const adminContent = `
      <p>A new user has attempted to subscribe to the Navigate Wealth newsletter.</p>
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 24px 0;">
        <p style="margin: 8px 0;"><strong>Email:</strong> ${email}</p>
        <p style="margin: 8px 0;"><strong>Subscribed:</strong> ${new Date(timestamp).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg', dateStyle: 'full', timeStyle: 'short' })}</p>
        <p style="margin: 8px 0;"><strong>Source:</strong> Footer Newsletter</p>
        <p style="margin: 8px 0;"><strong>Status:</strong> Pending Confirmation</p>
      </div>
      <p>The subscriber needs to confirm their email before they are added to the active mailing list.</p>
    `;

      try {
        // Provider-agnostic since the SES cutover: the custom from address
        // and deliverability headers ride email-core's extended EmailParams.
        const messageId = `<${crypto.randomUUID()}@navigatewealth.co>`;
        const confirmationSent = await sendEmail({
          to: email,
          subject: 'Please Confirm Your Navigate Wealth Newsletter Subscription',
          text: createPlainTextEmail(
            `Please Confirm Your Subscription\n\n${subscriberContent}\n\nConfirm here: ${confirmUrl}`,
          ),
          html: createEmailTemplate(subscriberContent, {
            title: 'Please Confirm Your Subscription',
            buttonUrl: confirmUrl,
            buttonLabel: 'Confirm My Subscription',
            footerNote:
              'If you did not subscribe to this newsletter, you can safely ignore this email.',
            footerSettings,
          }),
          from: { email: 'newsletters@navigatewealth.co', name: 'Navigate Wealth' },
          replyTo: { email: 'info@navigatewealth.co', name: 'Navigate Wealth Support' },
          headers: {
            'Message-ID': messageId,
            'X-Entity-Ref-ID': `newsletter-subscribe-${confirmToken}`,
          },
          customArgs: { type: 'newsletter_confirmation', source: 'footer_form' },
        });

        if (!confirmationSent) {
          log.error('Error sending confirmation email');
        } else {
          log.info('Confirmation email sent successfully to:', { email });
        }

        // Send admin notification email via shared sendEmail (no custom headers needed)
        const adminHtml = createEmailTemplate(adminContent, {
          title: 'New Newsletter Subscription Attempt',
          buttonUrl: 'https://www.navigatewealth.co/admin',
          buttonLabel: 'View Admin Dashboard',
          footerSettings,
        });

        const adminOk = await sendEmail({
          to: 'info@navigatewealth.co',
          subject: 'New Newsletter Subscription Attempt (Footer Form)',
          html: adminHtml,
        });

        if (!adminOk) {
          log.error('Error sending admin notification for newsletter subscription');
        } else {
          log.info('Admin notification email sent successfully');
        }
      } catch (emailError) {
        log.error('Email sending error:', emailError);
      }
    }

    // Return success even if emails fail (pending confirmation is saved)
    return c.json(
      {
        message: 'Confirmation email sent. Please check your inbox to complete subscription.',
        success: true,
        requiresConfirmation: true,
      },
      200,
    );
  }),
);

// Newsletter confirmation endpoint (double opt-in)
app.get('/confirm', async (c) => {
  try {
    const token = c.req.query('token');
    const email = normalizeSubscriberEmail(c.req.query('email'));

    if (!token || !email) {
      return c.json({ error: 'Missing confirmation parameters' }, 400);
    }

    const subscriptionKey = subscriberKey(email);
    const subscription = await kv.get(subscriptionKey);

    if (!subscription) {
      return c.json({ error: 'Subscription not found' }, 404);
    }

    if (subscription.confirmed) {
      return c.json(
        {
          message: 'Already confirmed',
          alreadyConfirmed: true,
        },
        200,
      );
    }

    if (!constantTimeEqual(String(subscription.confirmToken ?? ''), String(token ?? ''))) {
      return c.json({ error: 'Invalid confirmation token' }, 400);
    }

    // Check if token is expired (48 hours)
    const subscribedAt = new Date(subscription.subscribedAt);
    const now = new Date();
    const hoursDiff = (now.getTime() - subscribedAt.getTime()) / (1000 * 60 * 60);

    if (hoursDiff > 48) {
      return c.json({ error: 'Confirmation link expired' }, 400);
    }

    // Update subscription to confirmed
    await kv.set(subscriptionKey, {
      ...subscription,
      confirmed: true,
      confirmedAt: new Date().toISOString(),
      active: true,
    });

    // Add subscriber to newsletter group
    await addNewsletterSubscriber(email);

    // Send welcome email and admin notification (best-effort, provider-agnostic).
    {
      try {
        const unsubscribeLink = `https://www.navigatewealth.co/newsletter/unsubscribe?email=${encodeURIComponent(email)}`;

        // Fetch admin-configured footer settings for template consistency
        const footerSettings = await getFooterSettings();

        // Welcome email content
        const welcomeContent = `
          <p>Thank you for confirming your subscription. We're excited to have you on board!</p>
          <p>You'll now receive:</p>
          <ul style="color: #333333; line-height: 1.8; margin: 16px 0;">
            <li>Expert financial insights and market analysis</li>
            <li>Retirement planning tips and strategies</li>
            <li>Investment management updates</li>
            <li>Tax planning guidance</li>
            <li>Exclusive offers and financial education resources</li>
          </ul>
          <p>Our team is committed to providing you with valuable information to help you make informed financial decisions.</p>
        `;

        // Provider-agnostic since the SES cutover — the newsletters@ from
        // address and List-Unsubscribe compliance headers ride EmailParams.
        const welcomeMessageId = `<${crypto.randomUUID()}@navigatewealth.co>`;
        const welcomeSent = await sendEmail({
          to: email,
          subject: "You're in — Welcome to Navigate Wealth.",
          text: createPlainTextEmail(
            `You're in — Welcome to Navigate Wealth!\n\n${welcomeContent}`,
            unsubscribeLink,
          ),
          html: createEmailTemplate(welcomeContent, {
            title: "You're in — Welcome to Navigate Wealth!",
            unsubscribeLink,
            buttonUrl: 'https://www.navigatewealth.co/resources',
            buttonLabel: 'Explore Our Resources',
            footerNote: `If you have any questions or need personalized advice, our team is here to help. Contact us at <a href="mailto:info@navigatewealth.co" style="color: #6d28d9;">info@navigatewealth.co</a> or call <a href="tel:+27126672505" style="color: #6d28d9;">(+27) 12-667-2505</a>.`,
            footerSettings,
          }),
          from: { email: 'newsletters@navigatewealth.co', name: 'Navigate Wealth' },
          replyTo: { email: 'info@navigatewealth.co', name: 'Navigate Wealth Support' },
          headers: {
            'Message-ID': welcomeMessageId,
            'List-Unsubscribe': `<mailto:unsubscribe@navigatewealth.co?subject=unsubscribe>, <${unsubscribeLink}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            'List-Id': 'Navigate Wealth Newsletter <newsletter.navigatewealth.co>',
            'X-Entity-Ref-ID': `newsletter-welcome-${token}`,
          },
          customArgs: { type: 'newsletter_welcome', source: 'footer_form' },
        });
        if (!welcomeSent) {
          log.error('Error sending welcome email');
        }

        // Send confirmed admin notification via shared sendEmail (no custom headers needed)
        const adminConfirmContent = `
          <p>A subscriber has confirmed their email and joined the Navigate Wealth newsletter.</p>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 24px 0;">
            <p style="margin: 8px 0;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 8px 0;"><strong>Status:</strong> Confirmed & Active</p>
            <p style="margin: 8px 0;"><strong>Subscribed:</strong> ${new Date(subscription.subscribedAt).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg', dateStyle: 'full', timeStyle: 'short' })}</p>
            <p style="margin: 8px 0;"><strong>Confirmed:</strong> ${new Date().toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg', dateStyle: 'full', timeStyle: 'short' })}</p>
            <p style="margin: 8px 0;"><strong>Source:</strong> Footer Newsletter</p>
          </div>
          <p>The subscriber is now added to the active mailing list and will receive future newsletters.</p>
        `;

        const adminConfirmHtml = createEmailTemplate(adminConfirmContent, {
          title: 'Newsletter Subscription Confirmed',
          buttonUrl: 'https://www.navigatewealth.co/admin',
          buttonLabel: 'View Admin Dashboard',
          footerSettings,
        });

        const adminConfirmOk = await sendEmail({
          to: 'info@navigatewealth.co',
          subject: 'Newsletter Subscription Confirmed (Footer Form)',
          html: adminConfirmHtml,
        });

        if (!adminConfirmOk) {
          log.error('Error sending admin confirmation notification for newsletter');
        }

        log.info('Welcome email and admin notification sent for:', { email });
      } catch (emailError) {
        log.error('Error sending welcome emails:', emailError);
      }
    }

    return c.json(
      {
        message: 'Subscription confirmed successfully',
        success: true,
      },
      200,
    );
  } catch (error) {
    log.error('Newsletter confirmation error:', error);
    return c.json(
      {
        error: 'Failed to confirm subscription',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    );
  }
});

// Newsletter unsubscribe endpoint
app.get('/unsubscribe', async (c) => {
  try {
    const email = normalizeSubscriberEmail(c.req.query('email'));

    if (!email) {
      return c.json({ error: 'Email is required' }, 400);
    }

    const subscriptionKey = subscriberKey(email);
    const subscription = await kv.get(subscriptionKey);
    const now = new Date().toISOString();

    // An opt-out is never a no-op. This used to answer 200 `notFound` and write
    // NOTHING when there was no matching record — so the person saw a success
    // page, kept receiving mail, and no trace of the request survived. Anyone
    // reaching this route asked to stop being emailed; record that, whether or
    // not a subscription row happened to exist (it may have been a group-only
    // contact, or a legacy record under a differently-cased key).
    await kv.set(subscriptionKey, {
      ...(subscription ?? {
        email,
        source: 'Unsubscribe Link',
        subscribedAt: now,
        confirmed: true,
      }),
      email,
      active: false,
      unsubscribedAt: now,
    });

    // Remove subscriber from newsletter group
    await removeNewsletterSubscriber(email);

    if (!subscription) {
      log.warn('Unsubscribe recorded for an address with no prior subscription record', {
        hadSubscription: false,
      });
    }

    return c.json(
      {
        message: 'Successfully unsubscribed',
        success: true,
      },
      200,
    );
  } catch (error) {
    log.error('Newsletter unsubscribe error:', error);
    return c.json(
      {
        error: 'Failed to unsubscribe',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    );
  }
});

// ============================================================================
// ADMIN ENDPOINTS (require auth) — thin dispatchers to newsletter-service.ts
// ============================================================================

/**
 * GET /admin/subscribers — List all newsletter subscribers
 */
app.get(
  '/admin/subscribers',
  requireAuth,
  asyncHandler(async (c) => {
    await backfillLegacyNewsletterSubscribersToGroup().catch((error) => {
      log.error('Newsletter group backfill failed during subscriber listing', error);
    });
    const subscribers = await listSubscribers();
    return c.json({ success: true, subscribers, total: subscribers.length });
  }),
);

/**
 * POST /admin/add — Manually add a single subscriber (offline opt-in)
 */
app.post(
  '/admin/add',
  requireAuth,
  asyncHandler(async (c) => {
    const body = await c.req.json();
    const parsed = AdminAddSubscriberSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }

    const result = await addSubscriber(parsed.data);

    // Audit trail (non-blocking — §12.2)
    const adminUserId = (c.get('userId') as string) || 'unknown';
    AdminAuditService.record({
      actorId: adminUserId,
      actorRole: 'admin',
      category: 'communication',
      action: 'newsletter_subscriber_added',
      summary: 'Newsletter subscriber added manually',
      severity: 'info',
      entityType: 'newsletter',
    }).catch(() => {});

    return c.json({ success: true, ...result });
  }),
);

/**
 * POST /admin/bulk — Bulk add subscribers from parsed spreadsheet data
 */
app.post(
  '/admin/bulk',
  requireAuth,
  asyncHandler(async (c) => {
    const body = await c.req.json();
    const parsed = AdminBulkSubscriberSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }

    const results = await bulkAddSubscribers(parsed.data.subscribers);

    // Audit trail (non-blocking — §12.2)
    const adminUserId = (c.get('userId') as string) || 'unknown';
    AdminAuditService.record({
      actorId: adminUserId,
      actorRole: 'admin',
      category: 'bulk_operation',
      action: 'newsletter_bulk_upload',
      summary: `Newsletter bulk upload: ${results.added} added, ${results.skipped} skipped`,
      severity: 'info',
      entityType: 'newsletter',
      metadata: { added: results.added, skipped: results.skipped, errors: results.errors.length },
    }).catch(() => {});

    return c.json({
      success: true,
      message: `Bulk upload complete: ${results.added} added, ${results.skipped} already subscribed, ${results.errors.length} errors`,
      ...results,
    });
  }),
);

/**
 * POST /admin/remove — Remove (deactivate) a subscriber
 */
app.post(
  '/admin/remove',
  requireAuth,
  asyncHandler(async (c) => {
    const body = await c.req.json();
    const parsed = AdminEmailSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }

    await removeSubscriberByEmail(parsed.data.email);

    // Audit trail (non-blocking — §12.2)
    const adminUserId = (c.get('userId') as string) || 'unknown';
    AdminAuditService.record({
      actorId: adminUserId,
      actorRole: 'admin',
      category: 'communication',
      action: 'newsletter_subscriber_removed',
      summary: 'Newsletter subscriber removed',
      severity: 'warning',
      entityType: 'newsletter',
    }).catch(() => {});

    return c.json({ success: true, message: `${parsed.data.email} removed from newsletter` });
  }),
);

/**
 * POST /admin/resubscribe — Re-activate a previously unsubscribed subscriber
 */
app.post(
  '/admin/resubscribe',
  requireAuth,
  asyncHandler(async (c) => {
    const body = await c.req.json();
    const parsed = AdminEmailSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }

    const result = await resubscribeByEmail(parsed.data.email);

    // Audit trail (non-blocking — §12.2)
    const adminUserId = (c.get('userId') as string) || 'unknown';
    AdminAuditService.record({
      actorId: adminUserId,
      actorRole: 'admin',
      category: 'communication',
      action: 'newsletter_subscriber_resubscribed',
      summary: 'Newsletter subscriber re-activated by admin',
      severity: 'info',
      entityType: 'newsletter',
    }).catch(() => {});

    return c.json({ success: true, ...result });
  }),
);

/**
 * POST /admin/update — Update subscriber details
 */
app.post(
  '/admin/update',
  requireAuth,
  asyncHandler(async (c) => {
    const body = await c.req.json();
    const parsed = AdminUpdateSubscriberSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }

    const result = await updateSubscriberDetails(parsed.data);

    const adminUserId = (c.get('userId') as string) || 'unknown';
    AdminAuditService.record({
      actorId: adminUserId,
      actorRole: 'admin',
      category: 'communication',
      action: 'newsletter_subscriber_updated',
      summary: 'Newsletter subscriber details updated',
      severity: 'info',
      entityType: 'newsletter',
    }).catch(() => {});

    return c.json({ success: true, ...result });
  }),
);

/**
 * GET /admin/stats — Newsletter KPI summary
 */
app.get(
  '/admin/stats',
  requireAuth,
  asyncHandler(async (c) => {
    await backfillLegacyNewsletterSubscribersToGroup().catch((error) => {
      log.error('Newsletter group backfill failed during stats load', error);
    });
    const data = await getStats();
    return c.json({ success: true, data });
  }),
);

app.post(
  '/admin/backfill-group',
  requireAdmin,
  asyncHandler(async (c) => {
    const result = await backfillLegacyNewsletterSubscribersToGroup();
    return c.json({
      success: true,
      message:
        result.subscriberCount > 0
          ? `Backfilled ${result.subscriberCount} legacy subscriber(s) into Newsletter Contacts`
          : 'Newsletter Contacts legacy backfill already completed',
      data: result,
    });
  }),
);

/**
 * POST /admin/reconcile-clients — One-time reconciliation of clients → subscribers.
 *
 * Fetches every client profile and creates newsletter entries for those
 * not already subscribed.  Explicitly unsubscribed users are skipped.
 *
 * Admin-only.  Returns an audit summary.
 */
app.post(
  '/admin/reconcile-clients',
  requireAdmin,
  asyncHandler(async (c) => {
    log.info('Admin: Starting client-to-subscriber reconciliation');

    const result = await reconcileClientsToSubscribers();

    const adminUserId = (c.get('userId') as string) || 'unknown';
    AdminAuditService.record({
      actorId: adminUserId,
      actorRole: 'admin',
      category: 'bulk_operation',
      action: 'newsletter_client_reconciliation',
      summary: `Client reconciliation: ${result.added} added, ${result.skippedUnsubscribed} skipped (unsubscribed), ${result.alreadySubscribed} already subscribed`,
      severity: 'info',
      entityType: 'newsletter',
      metadata: {
        added: result.added,
        skippedUnsubscribed: result.skippedUnsubscribed,
        alreadySubscribed: result.alreadySubscribed,
        errors: result.errors.length,
        totalClients: result.totalClients,
        totalSubscribersBefore: result.totalSubscribersBefore,
        totalSubscribersAfter: result.totalSubscribersAfter,
      },
    }).catch(() => {});

    return c.json({
      success: true,
      message: `Reconciliation complete: ${result.added} added, ${result.skippedUnsubscribed} skipped (unsubscribed), ${result.alreadySubscribed} already subscribed`,
      ...result,
    });
  }),
);

export default app;
