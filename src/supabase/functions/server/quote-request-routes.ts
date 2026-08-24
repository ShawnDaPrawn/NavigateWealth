/**
 * Quote Request Routes
 *
 * Handles "Get a Quote" form submissions from the public website.
 * Supports a two-stage flow:
 *   Stage 1 (initial): Quick lead capture from the Gateway page — creates a
 *     submission entry so admin has the contact even if the client abandons.
 *   Stage 2 (full): Product-specific details from the Product Quote page —
 *     creates a detailed submission and links back to the initial entry.
 *
 * Persists to KV, creates Submissions Manager entries, generates branded PDFs,
 * and sends transactional emails to both admin and the submitter.
 *
 * No auth required — this is a public-facing endpoint.
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { sendEmail, createEmailTemplate, getFooterSettings } from './email-service.ts';
import { generateContactPdf, type ContactPdfData } from './contact-pdf-generator.ts';
import { QuoteRequestSubmitSchema } from './contact-form-validation.ts';
import { escapeHtml, escapeHtmlDeep, formatZodError } from './shared-validation-utils.ts';
import { checkPublicFormRateLimit } from './public-form-rate-limit.ts';
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
import type { QuoteProductDetails } from './quote-verticals/types.ts';
import { formatRand } from './quote-verticals/formatRand.ts';
import { riskPdfFields, riskHtml } from './quote-verticals/risk.ts';
import { medicalAidPdfFields, medicalAidHtml } from './quote-verticals/medicalAid.ts';
import { investmentPdfFields, investmentHtml } from './quote-verticals/investment.ts';
import { retirementPdfFields, retirementHtml } from './quote-verticals/retirement.ts';
import {
  employeeBenefitsPdfFields,
  employeeBenefitsHtml,
} from './quote-verticals/employeeBenefits.ts';
import { taxPlanningPdfFields, taxPlanningHtml } from './quote-verticals/taxPlanning.ts';
import { genericPdfFields, genericHtml } from './quote-verticals/generic.ts';

const app = new Hono();
const log = createModuleLogger('quote-request');
app.get('/', (c) => c.json({ service: 'quote-request', status: 'active' }));

/**
 * POST /quote-request/submit
 *
 * Accepts both initial (gateway) and full (product-specific) submissions.
 */
app.post(
  '/submit',
  asyncHandler(async (c) => {
    const blockedIpAddress = getBlockedClientIp((headerName) => c.req.header(headerName));
    if (blockedIpAddress) {
      log.warn('Blocked quote request from abusive IP address', { blockedIpAddress });
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
    const parsed = QuoteRequestSubmitSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }

    const {
      firstName,
      lastName,
      email,
      phone,
      productName,
      coverage,
      preferredProvider,
      stage,
      service,
      parentSubmissionId,
      productDetails,
      website,
    } = parsed.data;

    // --- Honeypot check (silent rejection — looks like success to bots) ----------
    if (website && website.length > 0) {
      log.info('Honeypot triggered on quote request — likely bot', { email });
      return c.json(
        {
          success: true,
          submissionId: crypto.randomUUID(),
          stage,
          message: 'Your quote request has been received. We will be in touch within 24 hours.',
          emailsSent: { admin: true, acknowledgment: true },
        },
        200,
      );
    }

    const blockedDomain = getBlockedEmailDomain(email);
    if (blockedDomain) {
      log.warn('Blocked quote request from scam domain', { email, blockedDomain, stage, service });
      return c.json(
        {
          error: getBlockedEmailDomainWarning(blockedDomain),
          warning: true,
          blockedDomain,
        },
        403,
      );
    }

    // --- Rate limit: per email AND per IP ---------------------------------------
    // SECURITY (SECURITY-AUDIT S11): this used to key on the submitted email
    // alone, which the caller chooses — rotating one character reset the bucket
    // and the limit bounded nothing. See public-form-rate-limit.ts for the
    // per-dimension budgets and the (deliberate) fail-open posture.
    const rateLimit = await checkPublicFormRateLimit('quote', email, (headerName) =>
      c.req.header(headerName),
    );
    if (!rateLimit.allowed) {
      log.info('Quote request rate limit exceeded', { limitedBy: rateLimit.limitedBy });
      return c.json(
        {
          error: 'Too many submissions. Please wait a while before trying again.',
        },
        429,
      );
    }

    const isFullStage = stage === 'full';
    const fullName = `${firstName} ${lastName}`.trim();

    // --- Persist raw quote request to KV ----------------------------------------
    const submissionId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    const submission = {
      id: submissionId,
      firstName,
      lastName,
      email,
      phone,
      productName: productName || service || '',
      coverage: coverage || 0,
      preferredProvider: preferredProvider || '',
      service: service || '',
      stage,
      parentSubmissionId: parentSubmissionId || '',
      productDetails: productDetails || {},
      submittedAt: timestamp,
      status: 'new',
    };

    await kv.set(`quote_request:${submissionId}`, submission);
    log.info(`Quote request stored (stage: ${stage})`, { submissionId, service });

    // --- Create Submissions Manager entry ---------------------------------------
    let submissionEntryId: string | undefined;
    try {
      const _displayService = productName || service || 'General';
      const payloadData: Record<string, unknown> = {
        service: service || '',
        stage,
        phone,
        quoteRequestId: submissionId,
      };

      // Add product-specific details for full submissions
      if (isFullStage && productDetails && Object.keys(productDetails).length > 0) {
        payloadData.productDetails = productDetails;
      }

      if (productName) payloadData.productName = productName;
      if (coverage) payloadData.coverage = coverage;
      if (preferredProvider) payloadData.preferredProvider = preferredProvider;
      if (parentSubmissionId) payloadData.parentSubmissionId = parentSubmissionId;

      const submissionEntry = await submissionsService.create({
        type: 'quote',
        sourceChannel: 'website_form',
        payload: payloadData,
        submitterName: fullName,
        submitterEmail: email,
      });
      submissionEntryId = submissionEntry.id;
    } catch (subError) {
      log.error('Failed to create submission entry for quote request (non-blocking)', subError);
    }

    // --- If this is a full submission, update the parent's status ----------------
    if (isFullStage && parentSubmissionId) {
      try {
        const parentSubmission = await submissionsService.getById(parentSubmissionId);
        if (parentSubmission) {
          await submissionsService.update(parentSubmissionId, {
            status: 'completed',
            notes: `Client completed full ${service || 'product'} quote form. Full submission: ${submissionEntryId || submissionId}`,
          });
          log.info('Updated parent submission to completed', { parentSubmissionId });
        }
      } catch (parentError) {
        log.error('Failed to update parent submission (non-blocking)', parentError);
      }
    }

    // --- Generate PDF -----------------------------------------------------------
    const coverageFormatted = coverage ? formatRand(coverage) : '';

    // Build fields list for PDF
    const pdfFields = [
      { label: 'Full Name', value: fullName },
      { label: 'Email', value: email },
      { label: 'Phone', value: phone },
      ...(service ? [{ label: 'Service', value: productName || service }] : []),
      ...(stage
        ? [{ label: 'Stage', value: isFullStage ? 'Full Quote Request' : 'Initial Lead Capture' }]
        : []),
      ...(coverageFormatted ? [{ label: 'Coverage Amount', value: coverageFormatted }] : []),
      ...(preferredProvider ? [{ label: 'Preferred Provider', value: preferredProvider }] : []),
    ];

    // Add product-specific fields for full submissions
    if (isFullStage && productDetails && typeof productDetails === 'object') {
      const details = productDetails as QuoteProductDetails;
      if (details.phase === 2 && details.risk_needs) {
        pdfFields.push(...riskPdfFields(details));
      } else if (details.phase === 2 && details.vertical === 'MedicalAid') {
        pdfFields.push(...medicalAidPdfFields(details));
      } else if (details.phase === 2 && details.vertical === 'Investment') {
        pdfFields.push(...investmentPdfFields(details));
      } else if (details.phase === 2 && details.vertical === 'Retirement') {
        pdfFields.push(...retirementPdfFields(details));
      } else if (details.phase === 2 && details.vertical === 'EmployeeBenefits') {
        pdfFields.push(...employeeBenefitsPdfFields(details));
      } else if (details.phase === 2 && details.vertical === 'TaxPlanning') {
        pdfFields.push(...taxPlanningPdfFields(details));
      } else {
        pdfFields.push(...genericPdfFields(details));
      }
    }

    let pdfBase64: string | undefined;
    try {
      const pdfData: ContactPdfData = {
        formType: 'quote',
        title: `Quote Request — ${fullName}${service ? ` (${productName || service})` : ''}`,
        submittedAt: timestamp,
        fields: pdfFields,
      };
      pdfBase64 = generateContactPdf(pdfData);
    } catch (pdfError) {
      log.error('Failed to generate quote request PDF (non-blocking)', pdfError);
    }

    // --- Send emails ------------------------------------------------------------
    const footerSettings = await getFooterSettings();
    const stageLabel = isFullStage ? 'Full Quote Request' : 'Initial Quote Enquiry';
    const displayService = productName || service || '';
    const formattedTimestamp = new Date(timestamp).toLocaleString('en-ZA', {
      timeZone: 'Africa/Johannesburg',
      dateStyle: 'full',
      timeStyle: 'long',
    });

    // Build product details rows for admin email.
    //
    // SECURITY (SECURITY-AUDIT S10): everything from here down is interpolated
    // into the staff notification email as HTML, and `productDetails` is an
    // anonymous visitor's `z.record(z.string(), z.unknown())` payload — arbitrary
    // keys and values that clear validation with only a length cap. The vertical
    // HTML builders therefore receive an escaped view of that payload, so no
    // interpolation site inside them can reintroduce the injection. The KV,
    // submissions and PDF paths ABOVE deliberately keep the raw values: escaping
    // those would show `&amp;` to staff rather than protect anyone.
    let productDetailsRows = '';
    if (isFullStage && productDetails && typeof productDetails === 'object') {
      const details = escapeHtmlDeep(productDetails) as QuoteProductDetails;
      if (details.phase === 2 && details.risk_needs) {
        productDetailsRows = riskHtml(details);
      } else if (details.phase === 2 && details.vertical === 'MedicalAid') {
        productDetailsRows = medicalAidHtml(details);
      } else if (details.phase === 2 && details.vertical === 'Investment') {
        productDetailsRows = investmentHtml(details);
      } else if (details.phase === 2 && details.vertical === 'Retirement') {
        productDetailsRows = retirementHtml(details);
      } else if (details.phase === 2 && details.vertical === 'EmployeeBenefits') {
        productDetailsRows = employeeBenefitsHtml(details);
      } else if (details.phase === 2 && details.vertical === 'TaxPlanning') {
        productDetailsRows = taxPlanningHtml(details);
      } else {
        productDetailsRows = genericHtml(details);
      }
    }

    // ── Admin notification email ─────────────────────────────────────────────
    const adminHtmlContent = `
      <p>A new ${stageLabel.toLowerCase()} has been submitted via the website. Please review the details below and respond within 24 hours.</p>

      <div style="background-color: #f8f9fa; padding: 24px; border-radius: 8px; margin: 24px 0;">
        <h3 style="margin-top: 0; font-size: 18px; color: #111827;">Contact Details</h3>
        <p style="margin: 8px 0;"><strong>Name:</strong> ${escapeHtml(fullName)}</p>
        <p style="margin: 8px 0;"><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}" style="color: #6d28d9;">${escapeHtml(email)}</a></p>
        <p style="margin: 8px 0;"><strong>Phone:</strong> <a href="tel:${escapeHtml(phone)}" style="color: #6d28d9;">${escapeHtml(phone)}</a></p>
        ${displayService ? `<p style="margin: 8px 0;"><strong>Service:</strong> ${escapeHtml(displayService)}</p>` : ''}
        ${coverageFormatted ? `<p style="margin: 8px 0;"><strong>Coverage Amount:</strong> ${escapeHtml(coverageFormatted)}</p>` : ''}
        ${preferredProvider ? `<p style="margin: 8px 0;"><strong>Preferred Provider:</strong> ${escapeHtml(preferredProvider)}</p>` : ''}
        <p style="margin: 8px 0;"><strong>Submitted:</strong> ${formattedTimestamp}</p>
      </div>

      ${
        productDetailsRows
          ? `
      <div style="background-color: #f8f9fa; padding: 24px; border-radius: 8px; margin: 24px 0;">
        <h3 style="margin-top: 0; font-size: 18px; color: #111827;">Product-Specific Details</h3>
        ${productDetailsRows}
      </div>
      `
          : ''
      }

      ${
        parentSubmissionId
          ? `
      <div style="background-color: #f8f9fa; padding: 24px; border-radius: 8px; margin: 24px 0;">
        <h3 style="margin-top: 0; font-size: 18px; color: #111827;">Submission Lineage</h3>
        <p style="margin: 8px 0;"><strong>Stage:</strong> ${stageLabel}</p>
        <p style="margin: 8px 0;"><strong>Parent Submission:</strong> ${escapeHtml(parentSubmissionId)}</p>
      </div>
      `
          : ''
      }

      <div style="background-color: #fef3c7; border: 1px solid #fbbf24; padding: 16px; border-radius: 8px; margin: 24px 0;">
        <p style="margin: 0; color: #92400e;"><strong>Action Required:</strong> Please respond to this quote request within 24 hours.</p>
      </div>
    `;

    const adminDeepLink = submissionEntryId
      ? `https://www.navigatewealth.co/admin?module=submissions&type=quote&id=${encodeURIComponent(submissionEntryId)}`
      : 'https://www.navigatewealth.co/admin?module=submissions&type=quote';

    const adminHtml = createEmailTemplate(adminHtmlContent, {
      title: isFullStage ? 'Full Quote Request' : 'New Quote Enquiry',
      subtitle: `From ${escapeHtml(fullName)}${displayService ? ` — ${escapeHtml(displayService)}` : ''}`,
      buttonUrl: adminDeepLink,
      buttonLabel: 'View in Submissions Manager',
      footerSettings,
    });

    // ── Client acknowledgment email ──────────────────────────────────────────
    const clientHtmlContent = isFullStage
      ? `
        <p>Dear ${escapeHtml(fullName)},</p>
        <p>Thank you for your ${escapeHtml(displayService || 'quote')} request. We have received your detailed requirements and one of our qualified advisers will be in touch shortly with a personalised, no-obligation quote.</p>
        <div style="background-color: #f0fdf4; border: 1px solid #86efac; padding: 20px; border-radius: 8px; margin: 24px 0;">
          <h3 style="margin-top: 0; font-size: 18px; color: #166534;">What Happens Next?</h3>
          <p style="color: #15803d; margin: 8px 0;">&#10003; An adviser will review your specific requirements</p>
          <p style="color: #15803d; margin: 8px 0;">&#10003; We will compare options from our trusted partners</p>
          <p style="color: #15803d; margin: 8px 0;">&#10003; You'll receive a personalised recommendation within 24 hours</p>
        </div>
        <p>Best regards,<br><strong>The Navigate Wealth Team</strong></p>
      `
      : `
        <p>Dear ${escapeHtml(fullName)},</p>
        <p>Thank you for your interest in Navigate Wealth${displayService ? `'s ${escapeHtml(displayService)} services` : ''}. We've received your details and will be in touch shortly.</p>
        <div style="background-color: #f0fdf4; border: 1px solid #86efac; padding: 20px; border-radius: 8px; margin: 24px 0;">
          <h3 style="margin-top: 0; font-size: 18px; color: #166534;">What Happens Next?</h3>
          <p style="color: #15803d; margin: 8px 0;">&#10003; A member of our team will review your enquiry</p>
          <p style="color: #15803d; margin: 8px 0;">&#10003; We will contact you within 24 business hours</p>
          <p style="color: #15803d; margin: 8px 0;">&#10003; There is no obligation — this is a complimentary consultation</p>
        </div>
        <p>In the meantime, feel free to complete your full quote request for faster processing.</p>
        <p>Best regards,<br><strong>The Navigate Wealth Team</strong></p>
      `;

    const clientHtml = createEmailTemplate(clientHtmlContent, {
      title: isFullStage ? 'Quote Request Received' : 'Thank You for Your Interest',
      subtitle: isFullStage
        ? 'We are preparing your personalised quote'
        : 'One of our advisers will be in touch',
      buttonUrl: isFullStage
        ? 'https://www.navigatewealth.co/services'
        : `https://www.navigatewealth.co/get-quote/${service || ''}/contact`,
      buttonLabel: isFullStage ? 'Explore Our Services' : 'Complete Your Quote',
      footerSettings,
    });

    const emailResults = await Promise.allSettled([
      sendEmail({
        to: 'info@navigatewealth.co',
        subject: `${isFullStage ? 'Full Quote Request' : 'New Quote Enquiry'}: ${fullName}${service ? ` — ${productName || service}` : ''}`,
        html: adminHtml,
        attachments: pdfBase64
          ? [
              {
                content: pdfBase64,
                filename: `Quote_Request_${firstName}_${lastName}_${new Date().toISOString().slice(0, 10)}.pdf`,
                type: 'application/pdf',
                disposition: 'attachment',
              },
            ]
          : undefined,
      }),
      sendEmail({
        to: email,
        subject: isFullStage
          ? 'Quote Request Received — Navigate Wealth'
          : 'Thank You for Your Interest — Navigate Wealth',
        html: clientHtml,
      }),
    ]);

    const adminOk = emailResults[0].status === 'fulfilled' && emailResults[0].value === true;
    const clientOk = emailResults[1].status === 'fulfilled' && emailResults[1].value === true;

    if (!adminOk) {
      log.error('Failed to send admin notification for quote request', { submissionId });
    }
    if (!clientOk) {
      log.error('Failed to send client acknowledgment for quote request', { submissionId });
    }

    return c.json({
      success: true,
      submissionId,
      submissionEntryId,
      stage,
      message: isFullStage
        ? 'Your quote request has been received. We will be in touch within 24 hours.'
        : 'Thank you! Continue to provide your specific details for a faster quote.',
      emailsSent: { admin: adminOk, acknowledgment: clientOk },
    });
  }),
);

export default app;
