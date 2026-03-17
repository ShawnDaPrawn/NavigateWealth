/**
 * Newsletter Route Handlers
 *
 * §4.2 — Route files are thin dispatchers: parse input, call service, return response.
 *
 * Public flows (subscribe/confirm/unsubscribe) retain inline email logic
 * due to tight SendGrid coupling — extraction deferred (documented below).
 *
 * Admin flows delegate to newsletter-service.ts.
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createPlainTextEmail, createEmailTemplate, sendEmail, getFooterSettings } from './email-service.ts';
import { createModuleLogger } from './stderr-logger.ts';
import {
  addNewsletterSubscriber,
  removeNewsletterSubscriber,
} from './newsletter-group-service.ts';
import {
  NewsletterSubscribeSchema,
  AdminAddSubscriberSchema,
  AdminBulkSubscriberSchema,
  AdminEmailSchema,
} from './newsletter-validation.ts';
import { formatZodError } from './shared-validation-utils.ts';
import { requireAuth } from './auth-mw.ts';
import { asyncHandler } from './error.middleware.ts';
import { AdminAuditService } from './admin-audit-service.ts';

// Service layer (§4.2)
import {
  listSubscribers,
  addSubscriber,
  bulkAddSubscribers,
  removeSubscriberByEmail,
  resubscribeByEmail,
  getStats,
} from './newsletter-service.ts';

const app = new Hono();
const log = createModuleLogger('newsletter');

// Root handlers
app.get('/', (c) => c.json({ service: 'newsletter', status: 'active' }));
app.get('', (c) => c.json({ service: 'newsletter', status: 'active' }));

// ============================================================================
// PUBLIC ENDPOINTS
// ============================================================================
// NOTE: These retain inline email-template logic because it's tightly coupled
// to SendGrid headers, List-Unsubscribe, and custom from-addresses.
// Extracting to the service requires an email-dispatch abstraction — deferred.
// WORKAROUND: inline-email-logic — see above rationale.
// ============================================================================

// Newsletter subscription endpoint - Double Opt-In
app.post("/subscribe", asyncHandler(async (c) => {
  const body = await c.req.json();
  
  // Validate email via Zod schema
  const parsed = NewsletterSubscribeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
  }
  const { email } = parsed.data;
  
  const timestamp = new Date().toISOString();
  const subscriptionKey = `newsletter:${email}`;
  
  // Check if already confirmed
  const existingSubscription = await kv.get(subscriptionKey);
  if (existingSubscription && existingSubscription.confirmed) {
    return c.json({ 
      message: 'Already subscribed',
      alreadySubscribed: true 
    }, 200);
  }
  
  // Generate confirmation token
  const confirmToken = crypto.randomUUID();
  
  // Get user agent and IP for logging
  const userAgent = c.req.header('User-Agent') || 'Unknown';
  const ip = c.req.header('X-Forwarded-For') || c.req.header('X-Real-IP') || 'Unknown';
  
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
  
  // Send confirmation email
  const sendgridApiKey = Deno.env.get('SENDGRID_API_KEY');
  
  if (sendgridApiKey) {
    const confirmUrl = `https://navigatewealth.co/newsletter/confirm?token=${confirmToken}&email=${encodeURIComponent(email)}`;
    
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
      // Send confirmation email to subscriber
      // Uses direct SendGrid call because it needs a custom from address (newsletters@)
      // and custom headers for email deliverability
      const messageId = `<${crypto.randomUUID()}@navigatewealth.co>`;
      const subscriberEmailResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sendgridApiKey}`
        },
        body: JSON.stringify({
          personalizations: [
            {
              to: [{ email: email }],
              subject: 'Please Confirm Your Navigate Wealth Newsletter Subscription'
            }
          ],
          from: {
            email: 'newsletters@navigatewealth.co',
            name: 'Navigate Wealth'
          },
          reply_to: {
            email: 'info@navigatewealth.co',
            name: 'Navigate Wealth Support'
          },
          content: [
            {
              type: 'text/plain',
              value: createPlainTextEmail(`Please Confirm Your Subscription\n\n${subscriberContent}\n\nConfirm here: ${confirmUrl}`)
            },
            {
              type: 'text/html',
              value: createEmailTemplate(subscriberContent, {
                title: "Please Confirm Your Subscription",
                buttonUrl: confirmUrl,
                buttonLabel: "Confirm My Subscription",
                footerNote: 'If you did not subscribe to this newsletter, you can safely ignore this email.',
                footerSettings,
              })
            }
          ],
          headers: {
            'Message-ID': messageId,
            'X-Entity-Ref-ID': `newsletter-subscribe-${confirmToken}`
          },
          custom_args: {
            type: 'newsletter_confirmation',
            source: 'footer_form'
          }
        })
      });
      
      if (!subscriberEmailResponse.ok) {
        const errorText = await subscriberEmailResponse.text();
        log.error('Error sending confirmation email:', errorText);
      } else {
        log.info('Confirmation email sent successfully to:', { email });
      }
      
      // Send admin notification email via shared sendEmail (no custom headers needed)
      const adminHtml = createEmailTemplate(adminContent, {
        title: "New Newsletter Subscription Attempt",
        buttonUrl: "https://navigatewealth.co/admin",
        buttonLabel: "View Admin Dashboard",
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
  return c.json({ 
    message: 'Confirmation email sent. Please check your inbox to complete subscription.',
    success: true,
    requiresConfirmation: true
  }, 200);
  
}));

// Newsletter confirmation endpoint (double opt-in)
app.get("/confirm", async (c) => {
  try {
    const token = c.req.query('token');
    const email = c.req.query('email');
    
    if (!token || !email) {
      return c.json({ error: 'Missing confirmation parameters' }, 400);
    }
    
    const subscriptionKey = `newsletter:${email}`;
    const subscription = await kv.get(subscriptionKey);
    
    if (!subscription) {
      return c.json({ error: 'Subscription not found' }, 404);
    }
    
    if (subscription.confirmed) {
      return c.json({ 
        message: 'Already confirmed',
        alreadyConfirmed: true 
      }, 200);
    }
    
    if (subscription.confirmToken !== token) {
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
      active: true
    });
    
    // Add subscriber to newsletter group
    await addNewsletterSubscriber(email);
    
    // Send welcome email and admin notification
    const sendgridApiKey = Deno.env.get('SENDGRID_API_KEY');
    
    if (sendgridApiKey) {
      try {
        const unsubscribeLink = `https://navigatewealth.co/newsletter/unsubscribe?email=${encodeURIComponent(email)}`;
        
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
        
        // Send welcome email to subscriber
        // Uses direct SendGrid call because it needs a custom from address (newsletters@)
        // and List-Unsubscribe headers for email deliverability compliance
        const welcomeMessageId = `<${crypto.randomUUID()}@navigatewealth.co>`;
        await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sendgridApiKey}`
          },
          body: JSON.stringify({
            personalizations: [
              {
                to: [{ email: email }],
                subject: "You're in — Welcome to Navigate Wealth."
              }
            ],
            from: {
              email: 'newsletters@navigatewealth.co',
              name: 'Navigate Wealth'
            },
            reply_to: {
              email: 'info@navigatewealth.co',
              name: 'Navigate Wealth Support'
            },
            content: [
              {
                type: 'text/plain',
                value: createPlainTextEmail(`You're in — Welcome to Navigate Wealth!\n\n${welcomeContent}`, unsubscribeLink)
              },
              {
                type: 'text/html',
                value: createEmailTemplate(welcomeContent, {
                  title: "You're in — Welcome to Navigate Wealth!",
                  unsubscribeLink,
                  buttonUrl: "https://navigatewealth.co/resources",
                  buttonLabel: "Explore Our Resources",
                  footerNote: `If you have any questions or need personalized advice, our team is here to help. Contact us at <a href="mailto:info@navigatewealth.co" style="color: #6d28d9;">info@navigatewealth.co</a> or call <a href="tel:+27126672505" style="color: #6d28d9;">(+27) 12-667-2505</a>.`,
                  footerSettings,
                })
              }
            ],
            headers: {
              'Message-ID': welcomeMessageId,
              'List-Unsubscribe': `<mailto:unsubscribe@navigatewealth.co?subject=unsubscribe>, <${unsubscribeLink}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
              'List-Id': 'Navigate Wealth Newsletter <newsletter.navigatewealth.co>',
              'X-Entity-Ref-ID': `newsletter-welcome-${token}`
            },
            custom_args: {
              type: 'newsletter_welcome',
              source: 'footer_form'
            }
          })
        });
        
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
          title: "Newsletter Subscription Confirmed",
          buttonUrl: "https://navigatewealth.co/admin",
          buttonLabel: "View Admin Dashboard",
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
    
    return c.json({ 
      message: 'Subscription confirmed successfully',
      success: true 
    }, 200);
    
  } catch (error) {
    log.error('Newsletter confirmation error:', error);
    return c.json({ 
      error: 'Failed to confirm subscription',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Newsletter unsubscribe endpoint
app.get("/unsubscribe", async (c) => {
  try {
    const email = c.req.query('email');
    
    if (!email) {
      return c.json({ error: 'Email is required' }, 400);
    }
    
    const subscriptionKey = `newsletter:${email}`;
    const subscription = await kv.get(subscriptionKey);
    
    if (!subscription) {
      return c.json({ 
        message: 'Subscription not found',
        notFound: true 
      }, 200);
    }
    
    // Update subscription to inactive
    await kv.set(subscriptionKey, {
      ...subscription,
      active: false,
      unsubscribedAt: new Date().toISOString()
    });
    
    // Remove subscriber from newsletter group
    await removeNewsletterSubscriber(email);
    
    return c.json({ 
      message: 'Successfully unsubscribed',
      success: true 
    }, 200);
    
  } catch (error) {
    log.error('Newsletter unsubscribe error:', error);
    return c.json({ 
      error: 'Failed to unsubscribe',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// ============================================================================
// ADMIN ENDPOINTS (require auth) — thin dispatchers to newsletter-service.ts
// ============================================================================

/**
 * GET /admin/subscribers — List all newsletter subscribers
 */
app.get('/admin/subscribers', requireAuth, asyncHandler(async (c) => {
  const subscribers = await listSubscribers();
  return c.json({ success: true, subscribers, total: subscribers.length });
}));

/**
 * POST /admin/add — Manually add a single subscriber (offline opt-in)
 */
app.post('/admin/add', requireAuth, asyncHandler(async (c) => {
  const body = await c.req.json();
  const parsed = AdminAddSubscriberSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
  }

  const result = await addSubscriber(parsed.data);

  // Audit trail (non-blocking — §12.2)
  const adminUserId = c.get('userId') || 'unknown';
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
}));

/**
 * POST /admin/bulk — Bulk add subscribers from parsed spreadsheet data
 */
app.post('/admin/bulk', requireAuth, asyncHandler(async (c) => {
  const body = await c.req.json();
  const parsed = AdminBulkSubscriberSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
  }

  const results = await bulkAddSubscribers(parsed.data.subscribers);

  // Audit trail (non-blocking — §12.2)
  const adminUserId = c.get('userId') || 'unknown';
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
}));

/**
 * POST /admin/remove — Remove (deactivate) a subscriber
 */
app.post('/admin/remove', requireAuth, asyncHandler(async (c) => {
  const body = await c.req.json();
  const parsed = AdminEmailSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
  }

  await removeSubscriberByEmail(parsed.data.email);

  // Audit trail (non-blocking — §12.2)
  const adminUserId = c.get('userId') || 'unknown';
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
}));

/**
 * POST /admin/resubscribe — Re-activate a previously unsubscribed subscriber
 */
app.post('/admin/resubscribe', requireAuth, asyncHandler(async (c) => {
  const body = await c.req.json();
  const parsed = AdminEmailSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
  }

  const result = await resubscribeByEmail(parsed.data.email);

  // Audit trail (non-blocking — §12.2)
  const adminUserId = c.get('userId') || 'unknown';
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
}));

/**
 * GET /admin/stats — Newsletter KPI summary
 */
app.get('/admin/stats', requireAuth, asyncHandler(async (c) => {
  const data = await getStats();
  return c.json({ success: true, data });
}));

export default app;