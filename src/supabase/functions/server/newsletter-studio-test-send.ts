/**
 * Newsletter Studio — test sends.
 *
 * Deliver the campaign to up to five test addresses exactly as a recipient
 * would see it: same wrapper, same attachment. Two deliberate differences —
 * the subject is prefixed, and the "Read the newsletter" button points at a
 * signed URL directly rather than the click-through, because a test address
 * has no recipient record and a test must never count as a read.
 */

import { getFooterSettings, sendEmail } from './email-service.ts';
import {
  buildCampaignEmailHeaders,
  NEWSLETTER_DEFAULT_FROM_NAME,
  NEWSLETTER_FROM_EMAIL,
  NEWSLETTER_REPLY_TO,
  renderNewsletterEmail,
} from './newsletter-studio-render.ts';
import { buildPdfAttachment } from './newsletter-studio-attachment.ts';
import { signedNewsletterPdfUrl } from './newsletter-studio-storage.ts';
import { newsletterCampaigns } from './repositories/newsletter-studio-repository.ts';
import { NotFoundError, ValidationError } from './error.middleware.ts';

/** A test link should outlive the admin's inbox triage, not just one hour. */
export const TEST_READ_URL_TTL_SECONDS = 7 * 24 * 3600;

/** Deadline on a single provider call — the processor's value, kept in step. */
export const TEST_SEND_TIMEOUT_MS = 15_000;

export interface TestSendOutcome {
  email: string;
  ok: boolean;
  error?: string;
}

export async function sendCampaignTestEmails(
  campaignId: string,
  emails: string[],
): Promise<TestSendOutcome[]> {
  const campaign = await newsletterCampaigns.get(campaignId);
  if (!campaign) throw new NotFoundError(`Campaign ${campaignId} not found`);
  if (!campaign.pdf) throw new ValidationError('Upload the newsletter PDF before sending a test');

  const [attachment, readUrl, footerSettings] = await Promise.all([
    buildPdfAttachment(campaign.pdf),
    signedNewsletterPdfUrl(campaign.pdf.storagePath, TEST_READ_URL_TTL_SECONDS),
    getFooterSettings(),
  ]);

  const outcomes: TestSendOutcome[] = [];
  for (const email of emails) {
    const recipient = { email, firstName: email.split('@')[0] || '' };
    try {
      const { html, text } = renderNewsletterEmail({
        campaign,
        recipient,
        readUrl,
        footerSettings,
      });
      await sendEmail({
        to: email,
        subject: `[TEST] ${campaign.title}`,
        html,
        text,
        from: {
          email: NEWSLETTER_FROM_EMAIL,
          name: campaign.fromName || NEWSLETTER_DEFAULT_FROM_NAME,
        },
        replyTo: NEWSLETTER_REPLY_TO,
        headers: buildCampaignEmailHeaders(campaign.id, `test-${crypto.randomUUID().slice(0, 8)}`),
        attachments: [attachment],
        customArgs: { type: 'newsletter_campaign_test', campaign_id: campaign.id },
        throwOnError: true,
        timeoutMs: TEST_SEND_TIMEOUT_MS,
      });
      outcomes.push({ email, ok: true });
    } catch (error) {
      outcomes.push({
        email,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return outcomes;
}
