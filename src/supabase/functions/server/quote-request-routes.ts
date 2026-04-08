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
import {
  sendEmail,
  createEmailTemplate,
  getFooterSettings,
} from './email-service.ts';
import { generateContactPdf, type ContactPdfData } from './contact-pdf-generator.ts';
import { QuoteRequestSubmitSchema } from './contact-form-validation.ts';
import { formatZodError } from './shared-validation-utils.ts';
import { submissionsService } from './submissions-service.ts';
import { asyncHandler } from './error.middleware.ts';

const app = new Hono();
const log = createModuleLogger('quote-request');

/**
 * Format a number as South African Rand with comma-separated thousands.
 * Uses manual formatting for consistent output across all runtimes (Deno, browser).
 * Pattern: R1,234,567 (no decimals for whole amounts).
 *
 * §5.3 — Centralised currency formatting; avoids Intl.NumberFormat('en-ZA')
 * which produces space-separated thousands on some runtimes.
 */
function formatRand(value: number | string): string {
  const num = typeof value === 'string' ? Number(value) : value;
  if (isNaN(num)) return 'R0';
  const isNeg = num < 0;
  const intPart = Math.round(Math.abs(num)).toString();
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${isNeg ? '-' : ''}R${withCommas}`;
}

// Health check
app.get('/', (c) => c.json({ service: 'quote-request', status: 'active' }));

/**
 * POST /quote-request/submit
 *
 * Accepts both initial (gateway) and full (product-specific) submissions.
 */
app.post('/submit', asyncHandler(async (c) => {
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
      return c.json({
        success: true,
        submissionId: crypto.randomUUID(),
        stage,
        message: 'Your quote request has been received. We will be in touch within 24 hours.',
        emailsSent: { admin: true, acknowledgment: true },
      }, 200);
    }

    // --- Rate limit: max 5 submissions per email per hour -------------------------
    const rateLimitKey = `rate_limit:quote:${email.toLowerCase()}`;
    const rateData = await kv.get(rateLimitKey);
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    if (rateData && Array.isArray(rateData.timestamps)) {
      const recent = rateData.timestamps.filter((t: number) => now - t < oneHour);
      if (recent.length >= 5) {
        log.info('Quote request rate limit exceeded', { email });
        return c.json({
          error: 'Too many submissions. Please wait a while before trying again.',
        }, 429);
      }
      await kv.set(rateLimitKey, { timestamps: [...recent, now] });
    } else {
      await kv.set(rateLimitKey, { timestamps: [now] });
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
      const displayService = productName || service || 'General';
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
      ...(stage ? [{ label: 'Stage', value: isFullStage ? 'Full Quote Request' : 'Initial Lead Capture' }] : []),
      ...(coverageFormatted ? [{ label: 'Coverage Amount', value: coverageFormatted }] : []),
      ...(preferredProvider ? [{ label: 'Preferred Provider', value: preferredProvider }] : []),
    ];

    // Add product-specific fields for full submissions
    if (isFullStage && productDetails && typeof productDetails === 'object') {
      // Check for Phase 2 risk management structured payload
      if (productDetails.phase === 2 && productDetails.risk_needs) {
        pdfFields.push({ label: 'Quote Phase', value: 'Phase 2 — Comprehensive Risk Assessment' });
        
        // Risk needs
        const riskNeeds = productDetails.risk_needs as Record<string, Record<string, unknown>>;
        for (const [coverId, entry] of Object.entries(riskNeeds)) {
          if (entry.selected) {
            const label = coverId.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
            const val = entry.adviser_assist
              ? 'Adviser assistance requested'
              : (entry.amount || entry.amount_per_month)
                ? `${formatRand(Number(entry.amount || entry.amount_per_month))}${entry.amount_per_month ? ' /month' : ''}`
                : 'Amount not specified';
            pdfFields.push({ label: `Cover: ${label}`, value: val });
          }
        }
        
        // Personal details
        const pd = productDetails.personal_details as Record<string, unknown> | undefined;
        if (pd) {
          if (pd.occupation) pdfFields.push({ label: 'Occupation', value: String(pd.occupation) });
          if (pd.income_gross_monthly) pdfFields.push({ label: 'Gross Monthly Income', value: formatRand(Number(pd.income_gross_monthly)) });
          if (pd.income_net_monthly) pdfFields.push({ label: 'Net Monthly Income', value: formatRand(Number(pd.income_net_monthly)) });
          if (pd.smoker_status) pdfFields.push({ label: 'Smoker Status', value: String(pd.smoker_status).replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) });
          if (pd.highest_qualification) pdfFields.push({ label: 'Qualification', value: String(pd.highest_qualification).replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) });
          if (pd.marital_status) pdfFields.push({ label: 'Marital Status', value: String(pd.marital_status).replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) });
          if (pd.spouse_income_monthly) pdfFields.push({ label: 'Spouse Monthly Income', value: formatRand(Number(pd.spouse_income_monthly)) });
        }
        
        // Health disclosures
        const hd = productDetails.health_disclosures as Record<string, unknown> | undefined;
        if (hd) {
          if (hd.has_conditions === false) {
            pdfFields.push({ label: 'Chronic Conditions', value: 'None declared' });
          } else if (hd.has_conditions === true) {
            const conditions = (hd.selected_conditions as string[]) || [];
            const freeText = hd.free_text as string || '';
            const parts = [...conditions];
            if (freeText) parts.push(freeText);
            pdfFields.push({ label: 'Chronic Conditions', value: parts.join(', ') || 'Indicated but not specified' });
          }
        }
      } else if (productDetails.phase === 2 && productDetails.vertical === 'MedicalAid') {
        // Phase 2 Medical Aid structured payload
        pdfFields.push({ label: 'Quote Phase', value: 'Phase 2 — Comprehensive Medical Aid Assessment' });

        // Members
        const mem = productDetails.members as Record<string, unknown> | undefined;
        if (mem) {
          if (mem.membership_type) pdfFields.push({ label: 'Membership Type', value: String(mem.membership_type) });
          const mainM = mem.main as Record<string, unknown> | undefined;
          if (mainM) {
            const mainInfo = mainM.dob ? String(mainM.dob) : (mainM.age ? `Age ${mainM.age}` : '—');
            pdfFields.push({ label: 'Main Member', value: mainInfo });
          }
          const spouseM = mem.spouse as Record<string, unknown> | undefined;
          if (spouseM && (spouseM.dob || spouseM.age)) {
            const spouseInfo = spouseM.dob ? String(spouseM.dob) : `Age ${spouseM.age}`;
            pdfFields.push({ label: 'Spouse / Partner', value: spouseInfo });
          }
          const children = mem.children as Array<Record<string, unknown>> | undefined;
          if (children && children.length > 0) {
            children.forEach((child, i) => {
              const childInfo = child.dob ? String(child.dob) : (child.age ? `Age ${child.age}` : '—');
              pdfFields.push({ label: `Child ${i + 1}`, value: childInfo });
            });
          }
        }

        // Preferences
        const prefs = productDetails.preferences as Record<string, unknown> | undefined;
        if (prefs) {
          if (prefs.cover_type) pdfFields.push({ label: 'Cover Type', value: String(prefs.cover_type) });
          if (prefs.network) pdfFields.push({ label: 'Network Preference', value: String(prefs.network) });
          if (prefs.budget_band) pdfFields.push({ label: 'Monthly Budget', value: String(prefs.budget_band) });
          if (prefs.province) pdfFields.push({ label: 'Province', value: String(prefs.province) });
        }

        // Medical aid history
        const hist = productDetails.medical_aid_history as Record<string, unknown> | undefined;
        if (hist) {
          if (hist.current_status) pdfFields.push({ label: 'Current Status', value: String(hist.current_status) });
          if (hist.current_scheme) pdfFields.push({ label: 'Current Scheme', value: String(hist.current_scheme) });
          if (hist.current_plan) pdfFields.push({ label: 'Current Plan', value: String(hist.current_plan) });
          if (hist.current_tenure_band) pdfFields.push({ label: 'Scheme Tenure', value: String(hist.current_tenure_band) });
          if (hist.time_without_sa_medical_aid) pdfFields.push({ label: 'Time Without Medical Aid', value: String(hist.time_without_sa_medical_aid) });
          if (hist.lpj_time_off_since_35) pdfFields.push({ label: 'LPJ: Time Off Since 35', value: String(hist.lpj_time_off_since_35) });
        }

        // Health
        const health = productDetails.health as Record<string, unknown> | undefined;
        if (health) {
          if (health.has_chronic_conditions === false) {
            pdfFields.push({ label: 'Chronic Conditions', value: 'None declared' });
          } else if (health.has_chronic_conditions === true) {
            const conditions = (health.selected_conditions as string[]) || [];
            const appliesTo = (health.applies_to_members as string[]) || [];
            const notes = health.notes as string || '';
            const parts = [...conditions];
            if (notes) parts.push(notes);
            pdfFields.push({ label: 'Chronic Conditions', value: parts.join(', ') || 'Indicated but not specified' });
            if (appliesTo.length > 0) pdfFields.push({ label: 'Applies To', value: appliesTo.join(', ') });
          }
        }
      } else if (productDetails.phase === 2 && productDetails.vertical === 'Investment') {
        // Phase 2 Investment structured payload
        pdfFields.push({ label: 'Quote Phase', value: 'Phase 2 — Investment Management Assessment' });

        // Selected types
        const types = productDetails.selected_types as string[] | undefined;
        if (types && types.length > 0) {
          pdfFields.push({ label: 'Investment Types', value: types.join(', ') });
        }

        // Contributions
        const contribs = productDetails.contributions as Record<string, Record<string, unknown>> | undefined;
        if (contribs) {
          for (const [typeId, entry] of Object.entries(contribs)) {
            const label = typeId.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
            const parts: string[] = [];
            if (entry.contribution_type) parts.push(String(entry.contribution_type));
            if (entry.adviser_assist) {
              parts.push('Adviser assistance');
            } else {
              const lump = entry.lump_sum as Record<string, unknown> | undefined;
              if (lump) {
                parts.push(lump.adviser_assist
                  ? 'Lump sum: adviser assist'
                  : `Lump sum: ${formatRand(Number(lump.amount || 0))}`);
              }
              const monthly = entry.monthly as Record<string, unknown> | undefined;
              if (monthly) {
                parts.push(monthly.adviser_assist
                  ? 'Monthly: adviser assist'
                  : `Monthly: ${formatRand(Number(monthly.amount_per_month || 0))} /month`);
              }
            }
            pdfFields.push({ label: `Investment: ${label}`, value: parts.join(' · ') || '—' });
          }
        }

        // Objective
        const obj = productDetails.objective as Record<string, unknown> | undefined;
        if (obj) {
          if (obj.primary_objective) pdfFields.push({ label: 'Primary Objective', value: String(obj.primary_objective) });
          if (obj.time_horizon) pdfFields.push({ label: 'Time Horizon', value: String(obj.time_horizon) });
          if (obj.risk_comfort) pdfFields.push({ label: 'Risk Comfort', value: String(obj.risk_comfort) });
        }

        // Financial snapshot
        const fin = productDetails.financial_snapshot as Record<string, unknown> | undefined;
        if (fin) {
          if (fin.income_gross_monthly) pdfFields.push({ label: 'Gross Monthly Income', value: formatRand(Number(fin.income_gross_monthly)) });
          if (fin.income_net_monthly) pdfFields.push({ label: 'Net Monthly Income', value: formatRand(Number(fin.income_net_monthly)) });
          if (fin.existing_investments) pdfFields.push({ label: 'Existing Investments', value: String(fin.existing_investments) });
          if (fin.has_retirement_annuity !== null && fin.has_retirement_annuity !== undefined) {
            pdfFields.push({ label: 'Retirement Annuity', value: fin.has_retirement_annuity ? 'Yes' : 'No' });
          }
          if (fin.tax_bracket) pdfFields.push({ label: 'Tax Bracket', value: String(fin.tax_bracket) });
        }
      } else if (productDetails.phase === 2 && productDetails.vertical === 'Retirement') {
        // Phase 2 Retirement Planning structured payload
        pdfFields.push({ label: 'Quote Phase', value: 'Phase 2 — Retirement Planning Assessment' });

        // Selected product
        if (productDetails.selected_product) {
          pdfFields.push({ label: 'Retirement Product', value: String(productDetails.selected_product) });
        }

        // Funding
        const funding = productDetails.funding as Record<string, unknown> | undefined;
        if (funding) {
          const productId = productDetails.selected_product_id as string | undefined;
          if (productId === 'ra') {
            if (funding.contribution_type) pdfFields.push({ label: 'Contribution Type', value: String(funding.contribution_type) });
            if (funding.adviser_assist) {
              pdfFields.push({ label: 'Contribution', value: 'Adviser assistance requested' });
            } else {
              const monthly = funding.monthly as Record<string, unknown> | undefined;
              if (monthly) {
                pdfFields.push({ label: 'Monthly Contribution', value: monthly.adviser_assist
                  ? 'Adviser assist'
                  : formatRand(Number(monthly.amount_per_month || 0)) });
              }
              const lump = funding.lump_sum as Record<string, unknown> | undefined;
              if (lump) {
                pdfFields.push({ label: 'Lump Sum Contribution', value: lump.adviser_assist
                  ? 'Adviser assist'
                  : formatRand(Number(lump.amount || 0)) });
              }
            }
          } else if (productId === 'provident_preservation' || productId === 'pension_preservation') {
            if (funding.is_transferring !== null && funding.is_transferring !== undefined) {
              pdfFields.push({ label: 'Transferring from employer fund', value: funding.is_transferring ? 'Yes' : 'No' });
            }
            if (funding.transfer_not_sure) {
              pdfFields.push({ label: 'Transfer Amount', value: 'Not sure' });
            } else if (funding.transfer_amount) {
              pdfFields.push({ label: 'Transfer Amount', value: formatRand(Number(funding.transfer_amount)) });
            }
          } else if (productId === 'not_sure') {
            if (funding.currently_employed !== null && funding.currently_employed !== undefined) {
              pdfFields.push({ label: 'Currently Employed', value: funding.currently_employed ? 'Yes' : 'No' });
            }
            if (funding.leaving_employer_fund !== null && funding.leaving_employer_fund !== undefined) {
              pdfFields.push({ label: 'Leaving Employer Fund', value: funding.leaving_employer_fund ? 'Yes' : 'No' });
            }
            if (funding.want_monthly_contributions) {
              const val = funding.want_monthly_contributions === 'yes' ? 'Yes'
                : funding.want_monthly_contributions === 'no' ? 'No' : 'Not sure';
              pdfFields.push({ label: 'Want Monthly Contributions', value: val });
            }
          }
        }

        // Timeline
        const tl = productDetails.timeline as Record<string, unknown> | undefined;
        if (tl) {
          if (tl.current_age) pdfFields.push({ label: 'Current Age', value: `${tl.current_age} years` });
          if (tl.planned_retirement_age) pdfFields.push({ label: 'Planned Retirement Age', value: `${tl.planned_retirement_age} years` });
          if (tl.member_of_retirement_fund !== null && tl.member_of_retirement_fund !== undefined) {
            pdfFields.push({ label: 'Current Retirement Fund Member', value: tl.member_of_retirement_fund ? 'Yes' : 'No' });
          }
          if (tl.fund_details) pdfFields.push({ label: 'Fund(s)', value: String(tl.fund_details) });
        }

        // Financial snapshot
        const finR = productDetails.financial_snapshot as Record<string, unknown> | undefined;
        if (finR) {
          if (finR.income_gross_monthly) pdfFields.push({ label: 'Gross Monthly Income', value: formatRand(Number(finR.income_gross_monthly)) });
          if (finR.income_net_monthly) pdfFields.push({ label: 'Net Monthly Income', value: formatRand(Number(finR.income_net_monthly)) });
          if (finR.current_retirement_savings) pdfFields.push({ label: 'Current Retirement Savings', value: formatRand(Number(finR.current_retirement_savings)) });
          if (finR.tax_bracket) pdfFields.push({ label: 'Tax Bracket', value: String(finR.tax_bracket) });
        }
      } else if (productDetails.phase === 2 && productDetails.vertical === 'EmployeeBenefits') {
        // Phase 2 Employee Benefits structured payload
        pdfFields.push({ label: 'Quote Phase', value: 'Phase 2 — Employee Benefits Assessment' });

        // Business details
        const biz = productDetails.business as Record<string, unknown> | undefined;
        if (biz) {
          if (biz.company_name) pdfFields.push({ label: 'Company Name', value: String(biz.company_name) });
          if (biz.trading_name) pdfFields.push({ label: 'Trading Name', value: String(biz.trading_name) });
          if (biz.industry_sector) pdfFields.push({ label: 'Industry Sector', value: String(biz.industry_sector) });
          if (biz.employee_count) pdfFields.push({ label: 'Number of Employees', value: String(biz.employee_count) });
          if (biz.province) pdfFields.push({ label: 'Province', value: String(biz.province) });
        }

        // Benefit type
        if (productDetails.benefit_type) {
          pdfFields.push({ label: 'Benefit Type', value: String(productDetails.benefit_type) });
        }

        // Budget
        const bdgt = productDetails.budget as Record<string, unknown> | undefined;
        if (bdgt) {
          if (bdgt.budget_adviser_assist) {
            pdfFields.push({ label: 'Monthly Budget', value: 'Adviser guidance requested' });
          } else if (bdgt.monthly_budget) {
            pdfFields.push({ label: 'Monthly Budget', value: `${formatRand(Number(bdgt.monthly_budget))} /month` });
          }
          if (bdgt.contribution_structure) pdfFields.push({ label: 'Contribution Structure', value: String(bdgt.contribution_structure) });
          if (bdgt.compulsory_for_all) pdfFields.push({ label: 'Compulsory for All Staff', value: String(bdgt.compulsory_for_all) });
        }

        // Workforce
        const wf = productDetails.workforce as Record<string, unknown> | undefined;
        if (wf) {
          if (wf.average_age_band) pdfFields.push({ label: 'Average Age Band', value: String(wf.average_age_band) });
          if (wf.workforce_type) pdfFields.push({ label: 'Workforce Type', value: String(wf.workforce_type) });
          if (wf.has_existing_benefits !== null && wf.has_existing_benefits !== undefined) {
            pdfFields.push({ label: 'Existing Benefits', value: wf.has_existing_benefits ? 'Yes' : 'No' });
          }
          if (wf.existing_benefits_description) pdfFields.push({ label: 'Current Arrangement', value: String(wf.existing_benefits_description) });
        }
      } else if (productDetails.phase === 2 && productDetails.vertical === 'TaxPlanning') {
        // Phase 2 Tax Planning structured payload
        pdfFields.push({ label: 'Quote Phase', value: 'Phase 2 — Tax Planning Assessment' });

        const taxTypes = productDetails.selected_types as string[] | undefined;
        if (taxTypes && taxTypes.length > 0) {
          pdfFields.push({ label: 'Tax Submission Type(s)', value: taxTypes.join(', ') });
        }

        const tc = productDetails.taxpayer_context as Record<string, unknown> | undefined;
        if (tc) {
          if (tc.taxpayer_type) pdfFields.push({ label: 'Taxpayer Type', value: String(tc.taxpayer_type) });
          if (tc.sars_registered) pdfFields.push({ label: 'Registered with SARS', value: String(tc.sars_registered) });
          if (tc.submission_status) pdfFields.push({ label: 'Submission Status', value: String(tc.submission_status) });
          if (tc.tax_years) pdfFields.push({ label: 'Tax Year(s)', value: String(tc.tax_years) });
        }

        const fScope = productDetails.financial_scope as Record<string, unknown> | undefined;
        if (fScope) {
          if (fScope.turnover_band) pdfFields.push({ label: 'Annual Turnover / Income', value: String(fScope.turnover_band) });
          if (fScope.has_foreign_income) pdfFields.push({ label: 'Foreign Income / Offshore Assets', value: String(fScope.has_foreign_income) });
          if (fScope.under_sars_audit) pdfFields.push({ label: 'Under SARS Audit', value: String(fScope.under_sars_audit) });
          if (fScope.has_penalties) pdfFields.push({ label: 'Penalties / Interest Raised', value: String(fScope.has_penalties) });
        }
      } else {
        // Standard flat product details
        for (const [key, value] of Object.entries(productDetails)) {
          if (value) {
            // Format the key for display: camelCase → Title Case
            const displayKey = key
              .replace(/([A-Z])/g, ' $1')
              .replace(/^./, (s: string) => s.toUpperCase())
              .trim();
            pdfFields.push({ label: displayKey, value: String(value) });
          }
        }
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

    // Build product details rows for admin email
    let productDetailsRows = '';
    if (isFullStage && productDetails && typeof productDetails === 'object') {
      // Phase 2 risk management: render structured HTML sections
      if (productDetails.phase === 2 && productDetails.risk_needs) {
        const sections: string[] = [];

        // Risk covers
        const rn = productDetails.risk_needs as Record<string, Record<string, unknown>>;
        const coverRows = Object.entries(rn)
          .filter(([, e]) => e.selected)
          .map(([id, e]) => {
            const label = id.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
            const val = e.adviser_assist
              ? '<em>Adviser assistance requested</em>'
              : (e.amount || e.amount_per_month)
                ? `${formatRand(Number(e.amount || e.amount_per_month))}${e.amount_per_month ? ' /month' : ''}`
                : 'Not specified';
            return `<p style="margin: 4px 0;"><strong>${label}:</strong> ${val}</p>`;
          });
        if (coverRows.length) {
          sections.push(`<h4 style="margin: 12px 0 4px; color: #374151;">Selected Covers</h4>${coverRows.join('')}`);
        }

        // Personal details
        const pd = productDetails.personal_details as Record<string, unknown> | undefined;
        if (pd) {
          const pRows: string[] = [];
          if (pd.occupation) pRows.push(`<p style="margin: 4px 0;"><strong>Occupation:</strong> ${pd.occupation}</p>`);
          if (pd.income_gross_monthly) pRows.push(`<p style="margin: 4px 0;"><strong>Gross Income:</strong> ${formatRand(Number(pd.income_gross_monthly))}</p>`);
          if (pd.income_net_monthly) pRows.push(`<p style="margin: 4px 0;"><strong>Net Income:</strong> ${formatRand(Number(pd.income_net_monthly))}</p>`);
          if (pd.smoker_status) pRows.push(`<p style="margin: 4px 0;"><strong>Smoker:</strong> ${String(pd.smoker_status).replace(/-/g, ' ')}</p>`);
          if (pd.marital_status) pRows.push(`<p style="margin: 4px 0;"><strong>Marital Status:</strong> ${String(pd.marital_status).replace(/-/g, ' ')}</p>`);
          if (pd.spouse_income_monthly) pRows.push(`<p style="margin: 4px 0;"><strong>Spouse Income:</strong> ${formatRand(Number(pd.spouse_income_monthly))}</p>`);
          if (pd.highest_qualification) pRows.push(`<p style="margin: 4px 0;"><strong>Qualification:</strong> ${String(pd.highest_qualification).replace(/-/g, ' ')}</p>`);
          if (pRows.length) {
            sections.push(`<h4 style="margin: 12px 0 4px; color: #374151;">Personal &amp; Financial</h4>${pRows.join('')}`);
          }
        }

        // Health
        const hd = productDetails.health_disclosures as Record<string, unknown> | undefined;
        if (hd) {
          let healthLine = '';
          if (hd.has_conditions === false) {
            healthLine = '<p style="margin: 4px 0; color: #16a34a;">No chronic conditions declared</p>';
          } else if (hd.has_conditions === true) {
            const parts = [...((hd.selected_conditions as string[]) || [])];
            if (hd.free_text) parts.push(String(hd.free_text));
            healthLine = `<p style="margin: 4px 0;">${parts.join(', ') || 'Conditions indicated but not specified'}</p>`;
          }
          if (healthLine) {
            sections.push(`<h4 style="margin: 12px 0 4px; color: #374151;">Chronic Conditions</h4>${healthLine}`);
          }
        }

        productDetailsRows = sections.join('');
      } else if (productDetails.phase === 2 && productDetails.vertical === 'MedicalAid') {
        // Phase 2 Medical Aid structured payload
        const sections: string[] = [];

        // Members
        const mem = productDetails.members as Record<string, unknown> | undefined;
        if (mem) {
          const mRows: string[] = [];
          if (mem.membership_type) mRows.push(`<p style="margin: 4px 0;"><strong>Membership Type:</strong> ${mem.membership_type}</p>`);
          const mainM = mem.main as Record<string, unknown> | undefined;
          if (mainM) {
            const mainInfo = mainM.dob ? String(mainM.dob) : (mainM.age ? `Age ${mainM.age}` : '—');
            mRows.push(`<p style="margin: 4px 0;"><strong>Main Member:</strong> ${mainInfo}</p>`);
          }
          const spouseM = mem.spouse as Record<string, unknown> | undefined;
          if (spouseM && (spouseM.dob || spouseM.age)) {
            const spouseInfo = spouseM.dob ? String(spouseM.dob) : `Age ${spouseM.age}`;
            mRows.push(`<p style="margin: 4px 0;"><strong>Spouse / Partner:</strong> ${spouseInfo}</p>`);
          }
          const children = mem.children as Array<Record<string, unknown>> | undefined;
          if (children && children.length > 0) {
            children.forEach((child, i) => {
              const childInfo = child.dob ? String(child.dob) : (child.age ? `Age ${child.age}` : '—');
              mRows.push(`<p style="margin: 4px 0;"><strong>Child ${i + 1}:</strong> ${childInfo}</p>`);
            });
          }
          if (mRows.length) {
            sections.push(`<h4 style="margin: 12px 0 4px; color: #374151;">Members</h4>${mRows.join('')}`);
          }
        }

        // Preferences
        const prefs = productDetails.preferences as Record<string, unknown> | undefined;
        if (prefs) {
          const pRows: string[] = [];
          if (prefs.cover_type) pRows.push(`<p style="margin: 4px 0;"><strong>Cover Type:</strong> ${prefs.cover_type}</p>`);
          if (prefs.network) pRows.push(`<p style="margin: 4px 0;"><strong>Network Preference:</strong> ${prefs.network}</p>`);
          if (prefs.budget_band) pRows.push(`<p style="margin: 4px 0;"><strong>Monthly Budget:</strong> ${prefs.budget_band}</p>`);
          if (prefs.province) pRows.push(`<p style="margin: 4px 0;"><strong>Province:</strong> ${prefs.province}</p>`);
          if (pRows.length) {
            sections.push(`<h4 style="margin: 12px 0 4px; color: #374151;">Preferences</h4>${pRows.join('')}`);
          }
        }

        // Medical aid history
        const hist = productDetails.medical_aid_history as Record<string, unknown> | undefined;
        if (hist) {
          const hRows: string[] = [];
          if (hist.current_status) hRows.push(`<p style="margin: 4px 0;"><strong>Current Status:</strong> ${hist.current_status}</p>`);
          if (hist.current_scheme) hRows.push(`<p style="margin: 4px 0;"><strong>Current Scheme:</strong> ${hist.current_scheme}</p>`);
          if (hist.current_plan) hRows.push(`<p style="margin: 4px 0;"><strong>Current Plan:</strong> ${hist.current_plan}</p>`);
          if (hist.current_tenure_band) hRows.push(`<p style="margin: 4px 0;"><strong>Scheme Tenure:</strong> ${hist.current_tenure_band}</p>`);
          if (hist.time_without_sa_medical_aid) hRows.push(`<p style="margin: 4px 0;"><strong>Time Without Medical Aid:</strong> ${hist.time_without_sa_medical_aid}</p>`);
          if (hist.lpj_time_off_since_35) hRows.push(`<p style="margin: 4px 0;"><strong>LPJ: Time Off Since 35:</strong> ${hist.lpj_time_off_since_35}</p>`);
          if (hRows.length) {
            sections.push(`<h4 style="margin: 12px 0 4px; color: #374151;">Medical Aid History</h4>${hRows.join('')}`);
          }
        }

        // Health
        const health = productDetails.health as Record<string, unknown> | undefined;
        if (health) {
          let healthLine = '';
          if (health.has_chronic_conditions === false) {
            healthLine = '<p style="margin: 4px 0; color: #16a34a;">No chronic conditions declared</p>';
          } else if (health.has_chronic_conditions === true) {
            const parts = [...((health.selected_conditions as string[]) || [])];
            if (health.notes) parts.push(String(health.notes));
            healthLine = `<p style="margin: 4px 0;">${parts.join(', ') || 'Conditions indicated but not specified'}</p>`;
          }
          if (healthLine) {
            sections.push(`<h4 style="margin: 12px 0 4px; color: #374151;">Chronic Conditions</h4>${healthLine}`);
          }
        }

        productDetailsRows = sections.join('');
      } else if (productDetails.phase === 2 && productDetails.vertical === 'Investment') {
        // Phase 2 Investment structured payload
        const sections: string[] = [];

        // Selected types
        const types = productDetails.selected_types as string[] | undefined;
        if (types && types.length > 0) {
          sections.push(`<h4 style="margin: 12px 0 4px; color: #374151;">Investment Types</h4><p style="margin: 4px 0;">${types.join(', ')}</p>`);
        }

        // Contributions
        const contribs = productDetails.contributions as Record<string, Record<string, unknown>> | undefined;
        if (contribs) {
          const cRows: string[] = [];
          for (const [typeId, entry] of Object.entries(contribs)) {
            const label = typeId.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
            const parts: string[] = [];
            if (entry.contribution_type) parts.push(String(entry.contribution_type));
            if (entry.adviser_assist) {
              parts.push('Adviser assistance');
            } else {
              const lump = entry.lump_sum as Record<string, unknown> | undefined;
              if (lump) {
                parts.push(lump.adviser_assist
                  ? 'Lump sum: adviser assist'
                  : `Lump sum: ${formatRand(Number(lump.amount || 0))}`);
              }
              const monthly = entry.monthly as Record<string, unknown> | undefined;
              if (monthly) {
                parts.push(monthly.adviser_assist
                  ? 'Monthly: adviser assist'
                  : `Monthly: ${formatRand(Number(monthly.amount_per_month || 0))} /month`);
              }
            }
            cRows.push(`<p style="margin: 4px 0;"><strong>${label}:</strong> ${parts.join(' · ') || '—'}</p>`);
          }
          if (cRows.length) {
            sections.push(`<h4 style="margin: 12px 0 4px; color: #374151;">Contributions</h4>${cRows.join('')}`);
          }
        }

        // Objective
        const obj = productDetails.objective as Record<string, unknown> | undefined;
        if (obj) {
          const oRows: string[] = [];
          if (obj.primary_objective) oRows.push(`<p style="margin: 4px 0;"><strong>Primary Objective:</strong> ${obj.primary_objective}</p>`);
          if (obj.time_horizon) oRows.push(`<p style="margin: 4px 0;"><strong>Time Horizon:</strong> ${obj.time_horizon}</p>`);
          if (obj.risk_comfort) oRows.push(`<p style="margin: 4px 0;"><strong>Risk Comfort:</strong> ${obj.risk_comfort}</p>`);
          if (oRows.length) {
            sections.push(`<h4 style="margin: 12px 0 4px; color: #374151;">Objective</h4>${oRows.join('')}`);
          }
        }

        // Financial snapshot
        const fin = productDetails.financial_snapshot as Record<string, unknown> | undefined;
        if (fin) {
          const fRows: string[] = [];
          if (fin.income_gross_monthly) fRows.push(`<p style="margin: 4px 0;"><strong>Gross Income:</strong> ${formatRand(Number(fin.income_gross_monthly))}</p>`);
          if (fin.income_net_monthly) fRows.push(`<p style="margin: 4px 0;"><strong>Net Income:</strong> ${formatRand(Number(fin.income_net_monthly))}</p>`);
          if (fin.existing_investments) fRows.push(`<p style="margin: 4px 0;"><strong>Existing Investments:</strong> ${fin.existing_investments}</p>`);
          if (fin.has_retirement_annuity !== null && fin.has_retirement_annuity !== undefined) {
            fRows.push(`<p style="margin: 4px 0;"><strong>Retirement Annuity:</strong> ${fin.has_retirement_annuity ? 'Yes' : 'No'}</p>`);
          }
          if (fin.tax_bracket) fRows.push(`<p style="margin: 4px 0;"><strong>Tax Bracket:</strong> ${fin.tax_bracket}</p>`);
          if (fRows.length) {
            sections.push(`<h4 style="margin: 12px 0 4px; color: #374151;">Financial Snapshot</h4>${fRows.join('')}`);
          }
        }

        productDetailsRows = sections.join('');
      } else if (productDetails.phase === 2 && productDetails.vertical === 'Retirement') {
        // Phase 2 Retirement Planning structured payload
        const sections: string[] = [];

        // Selected product
        if (productDetails.selected_product) {
          sections.push(`<h4 style="margin: 12px 0 4px; color: #374151;">Retirement Product</h4><p style="margin: 4px 0;">${productDetails.selected_product}</p>`);
        }

        // Funding
        const funding = productDetails.funding as Record<string, unknown> | undefined;
        if (funding) {
          const productId = productDetails.selected_product_id as string | undefined;
          if (productId === 'ra') {
            const fRows: string[] = [];
            if (funding.contribution_type) fRows.push(`<p style="margin: 4px 0;"><strong>Contribution Type:</strong> ${funding.contribution_type}</p>`);
            if (funding.adviser_assist) {
              fRows.push(`<p style="margin: 4px 0;"><strong>Contribution:</strong> Adviser assistance requested</p>`);
            } else {
              const monthly = funding.monthly as Record<string, unknown> | undefined;
              if (monthly) {
                fRows.push(`<p style="margin: 4px 0;"><strong>Monthly Contribution:</strong> ${monthly.adviser_assist
                  ? 'Adviser assist'
                  : formatRand(Number(monthly.amount_per_month || 0)) }</p>`);
              }
              const lump = funding.lump_sum as Record<string, unknown> | undefined;
              if (lump) {
                fRows.push(`<p style="margin: 4px 0;"><strong>Lump Sum Contribution:</strong> ${lump.adviser_assist
                  ? 'Adviser assist'
                  : formatRand(Number(lump.amount || 0)) }</p>`);
              }
            }
            if (fRows.length) {
              sections.push(`<h4 style="margin: 12px 0 4px; color: #374151;">Funding</h4>${fRows.join('')}`);
            }
          } else if (productId === 'provident_preservation' || productId === 'pension_preservation') {
            const fRows: string[] = [];
            if (funding.is_transferring !== null && funding.is_transferring !== undefined) {
              fRows.push(`<p style="margin: 4px 0;"><strong>Transferring from employer fund:</strong> ${funding.is_transferring ? 'Yes' : 'No'}</p>`);
            }
            if (funding.transfer_not_sure) {
              fRows.push(`<p style="margin: 4px 0;"><strong>Transfer Amount:</strong> Not sure</p>`);
            } else if (funding.transfer_amount) {
              fRows.push(`<p style="margin: 4px 0;"><strong>Transfer Amount:</strong> ${formatRand(Number(funding.transfer_amount))}</p>`);
            }
            if (fRows.length) {
              sections.push(`<h4 style="margin: 12px 0 4px; color: #374151;">Funding</h4>${fRows.join('')}`);
            }
          } else if (productId === 'not_sure') {
            const fRows: string[] = [];
            if (funding.currently_employed !== null && funding.currently_employed !== undefined) {
              fRows.push(`<p style="margin: 4px 0;"><strong>Currently Employed:</strong> ${funding.currently_employed ? 'Yes' : 'No'}</p>`);
            }
            if (funding.leaving_employer_fund !== null && funding.leaving_employer_fund !== undefined) {
              fRows.push(`<p style="margin: 4px 0;"><strong>Leaving Employer Fund:</strong> ${funding.leaving_employer_fund ? 'Yes' : 'No'}</p>`);
            }
            if (funding.want_monthly_contributions) {
              const val = funding.want_monthly_contributions === 'yes' ? 'Yes'
                : funding.want_monthly_contributions === 'no' ? 'No' : 'Not sure';
              fRows.push(`<p style="margin: 4px 0;"><strong>Want Monthly Contributions:</strong> ${val}</p>`);
            }
            if (fRows.length) {
              sections.push(`<h4 style="margin: 12px 0 4px; color: #374151;">Funding</h4>${fRows.join('')}`);
            }
          }
        }

        // Timeline
        const tl = productDetails.timeline as Record<string, unknown> | undefined;
        if (tl) {
          const tRows: string[] = [];
          if (tl.current_age) tRows.push(`<p style="margin: 4px 0;"><strong>Current Age:</strong> ${tl.current_age} years</p>`);
          if (tl.planned_retirement_age) tRows.push(`<p style="margin: 4px 0;"><strong>Planned Retirement Age:</strong> ${tl.planned_retirement_age} years</p>`);
          if (tl.member_of_retirement_fund !== null && tl.member_of_retirement_fund !== undefined) {
            tRows.push(`<p style="margin: 4px 0;"><strong>Current Retirement Fund Member:</strong> ${tl.member_of_retirement_fund ? 'Yes' : 'No'}</p>`);
          }
          if (tl.fund_details) tRows.push(`<p style="margin: 4px 0;"><strong>Fund(s):</strong> ${tl.fund_details}</p>`);
          if (tRows.length) {
            sections.push(`<h4 style="margin: 12px 0 4px; color: #374151;">Timeline</h4>${tRows.join('')}`);
          }
        }

        // Financial snapshot
        const finR = productDetails.financial_snapshot as Record<string, unknown> | undefined;
        if (finR) {
          const fRows: string[] = [];
          if (finR.income_gross_monthly) fRows.push(`<p style="margin: 4px 0;"><strong>Gross Income:</strong> ${formatRand(Number(finR.income_gross_monthly))}</p>`);
          if (finR.income_net_monthly) fRows.push(`<p style="margin: 4px 0;"><strong>Net Income:</strong> ${formatRand(Number(finR.income_net_monthly))}</p>`);
          if (finR.current_retirement_savings) fRows.push(`<p style="margin: 4px 0;"><strong>Current Retirement Savings:</strong> ${formatRand(Number(finR.current_retirement_savings))}</p>`);
          if (finR.tax_bracket) fRows.push(`<p style="margin: 4px 0;"><strong>Tax Bracket:</strong> ${finR.tax_bracket}</p>`);
          if (fRows.length) {
            sections.push(`<h4 style="margin: 12px 0 4px; color: #374151;">Financial Snapshot</h4>${fRows.join('')}`);
          }
        }

        productDetailsRows = sections.join('');
      } else if (productDetails.phase === 2 && productDetails.vertical === 'EmployeeBenefits') {
        // Phase 2 Employee Benefits structured payload
        const sections: string[] = [];

        // Business details
        const biz = productDetails.business as Record<string, unknown> | undefined;
        if (biz) {
          const bRows: string[] = [];
          if (biz.company_name) bRows.push(`<p style="margin: 4px 0;"><strong>Company Name:</strong> ${biz.company_name}</p>`);
          if (biz.trading_name) bRows.push(`<p style="margin: 4px 0;"><strong>Trading Name:</strong> ${biz.trading_name}</p>`);
          if (biz.industry_sector) bRows.push(`<p style="margin: 4px 0;"><strong>Industry Sector:</strong> ${biz.industry_sector}</p>`);
          if (biz.employee_count) bRows.push(`<p style="margin: 4px 0;"><strong>Number of Employees:</strong> ${biz.employee_count}</p>`);
          if (biz.province) bRows.push(`<p style="margin: 4px 0;"><strong>Province:</strong> ${biz.province}</p>`);
          if (bRows.length) {
            sections.push(`<h4 style="margin: 12px 0 4px; color: #374151;">Business Details</h4>${bRows.join('')}`);
          }
        }

        // Benefit type
        if (productDetails.benefit_type) {
          sections.push(`<h4 style="margin: 12px 0 4px; color: #374151;">Benefit Type</h4><p style="margin: 4px 0;">${productDetails.benefit_type}</p>`);
        }

        // Budget
        const bdgt = productDetails.budget as Record<string, unknown> | undefined;
        if (bdgt) {
          const bRows: string[] = [];
          if (bdgt.budget_adviser_assist) {
            bRows.push(`<p style="margin: 4px 0;"><strong>Monthly Budget:</strong> Adviser guidance requested</p>`);
          } else if (bdgt.monthly_budget) {
            bRows.push(`<p style="margin: 4px 0;"><strong>Monthly Budget:</strong> ${formatRand(Number(bdgt.monthly_budget))} /month</p>`);
          }
          if (bdgt.contribution_structure) bRows.push(`<p style="margin: 4px 0;"><strong>Contribution Structure:</strong> ${bdgt.contribution_structure}</p>`);
          if (bdgt.compulsory_for_all) bRows.push(`<p style="margin: 4px 0;"><strong>Compulsory for All Staff:</strong> ${bdgt.compulsory_for_all}</p>`);
          if (bRows.length) {
            sections.push(`<h4 style="margin: 12px 0 4px; color: #374151;">Budget</h4>${bRows.join('')}`);
          }
        }

        // Workforce
        const wf = productDetails.workforce as Record<string, unknown> | undefined;
        if (wf) {
          const wRows: string[] = [];
          if (wf.average_age_band) wRows.push(`<p style="margin: 4px 0;"><strong>Average Age Band:</strong> ${wf.average_age_band}</p>`);
          if (wf.workforce_type) wRows.push(`<p style="margin: 4px 0;"><strong>Workforce Type:</strong> ${wf.workforce_type}</p>`);
          if (wf.has_existing_benefits !== null && wf.has_existing_benefits !== undefined) {
            wRows.push(`<p style="margin: 4px 0;"><strong>Existing Benefits:</strong> ${wf.has_existing_benefits ? 'Yes' : 'No'}</p>`);
          }
          if (wf.existing_benefits_description) wRows.push(`<p style="margin: 4px 0;"><strong>Current Arrangement:</strong> ${wf.existing_benefits_description}</p>`);
          if (wRows.length) {
            sections.push(`<h4 style="margin: 12px 0 4px; color: #374151;">Workforce</h4>${wRows.join('')}`);
          }
        }

        productDetailsRows = sections.join('');
      } else if (productDetails.phase === 2 && productDetails.vertical === 'TaxPlanning') {
        // Phase 2 Tax Planning structured payload
        const sections: string[] = [];

        const taxTypesEmail = productDetails.selected_types as string[] | undefined;
        if (taxTypesEmail && taxTypesEmail.length > 0) {
          const items = taxTypesEmail.map((t: string) => `<li style="margin: 2px 0;">${t}</li>`).join('');
          sections.push(`<h4 style="margin: 12px 0 4px; color: #374151;">Tax Submission Type(s)</h4><ul style="margin: 4px 0; padding-left: 20px;">${items}</ul>`);
        }

        const tcEmail = productDetails.taxpayer_context as Record<string, unknown> | undefined;
        if (tcEmail) {
          const tRows: string[] = [];
          if (tcEmail.taxpayer_type) tRows.push(`<p style="margin: 4px 0;"><strong>Taxpayer Type:</strong> ${tcEmail.taxpayer_type}</p>`);
          if (tcEmail.sars_registered) tRows.push(`<p style="margin: 4px 0;"><strong>Registered with SARS:</strong> ${tcEmail.sars_registered}</p>`);
          if (tcEmail.submission_status) tRows.push(`<p style="margin: 4px 0;"><strong>Submission Status:</strong> ${tcEmail.submission_status}</p>`);
          if (tcEmail.tax_years) tRows.push(`<p style="margin: 4px 0;"><strong>Tax Year(s):</strong> ${tcEmail.tax_years}</p>`);
          if (tRows.length) {
            sections.push(`<h4 style="margin: 12px 0 4px; color: #374151;">Taxpayer Details</h4>${tRows.join('')}`);
          }
        }

        const fsEmail = productDetails.financial_scope as Record<string, unknown> | undefined;
        if (fsEmail) {
          const fRows: string[] = [];
          if (fsEmail.turnover_band) fRows.push(`<p style="margin: 4px 0;"><strong>Annual Turnover / Income:</strong> ${fsEmail.turnover_band}</p>`);
          if (fsEmail.has_foreign_income) fRows.push(`<p style="margin: 4px 0;"><strong>Foreign Income / Offshore Assets:</strong> ${fsEmail.has_foreign_income}</p>`);
          if (fsEmail.under_sars_audit) fRows.push(`<p style="margin: 4px 0;"><strong>Under SARS Audit:</strong> ${fsEmail.under_sars_audit}</p>`);
          if (fsEmail.has_penalties) fRows.push(`<p style="margin: 4px 0;"><strong>Penalties / Interest Raised:</strong> ${fsEmail.has_penalties}</p>`);
          if (fRows.length) {
            sections.push(`<h4 style="margin: 12px 0 4px; color: #374151;">Financial Scope</h4>${fRows.join('')}`);
          }
        }

        productDetailsRows = sections.join('');
      } else {
        // Standard flat entries
        const entries = Object.entries(productDetails).filter(([, v]) => v);
        if (entries.length > 0) {
          productDetailsRows = entries
            .map(([key, value]) => {
              const displayKey = key
                .replace(/([A-Z])/g, ' $1')
                .replace(/^./, (s: string) => s.toUpperCase())
                .trim();
              return `<p style="margin: 8px 0;"><strong>${displayKey}:</strong> ${String(value)}</p>`;
            })
            .join('');
        }
      }
    }

    // ── Admin notification email ─────────────────────────────────────────────
    const adminHtmlContent = `
      <p>A new ${stageLabel.toLowerCase()} has been submitted via the website. Please review the details below and respond within 24 hours.</p>

      <div style="background-color: #f8f9fa; padding: 24px; border-radius: 8px; margin: 24px 0;">
        <h3 style="margin-top: 0; font-size: 18px; color: #111827;">Contact Details</h3>
        <p style="margin: 8px 0;"><strong>Name:</strong> ${fullName}</p>
        <p style="margin: 8px 0;"><strong>Email:</strong> <a href="mailto:${email}" style="color: #6d28d9;">${email}</a></p>
        <p style="margin: 8px 0;"><strong>Phone:</strong> <a href="tel:${phone}" style="color: #6d28d9;">${phone}</a></p>
        ${displayService ? `<p style="margin: 8px 0;"><strong>Service:</strong> ${displayService}</p>` : ''}
        ${coverageFormatted ? `<p style="margin: 8px 0;"><strong>Coverage Amount:</strong> ${coverageFormatted}</p>` : ''}
        ${preferredProvider ? `<p style="margin: 8px 0;"><strong>Preferred Provider:</strong> ${preferredProvider}</p>` : ''}
        <p style="margin: 8px 0;"><strong>Submitted:</strong> ${formattedTimestamp}</p>
      </div>

      ${productDetailsRows ? `
      <div style="background-color: #f8f9fa; padding: 24px; border-radius: 8px; margin: 24px 0;">
        <h3 style="margin-top: 0; font-size: 18px; color: #111827;">Product-Specific Details</h3>
        ${productDetailsRows}
      </div>
      ` : ''}

      ${parentSubmissionId ? `
      <div style="background-color: #f8f9fa; padding: 24px; border-radius: 8px; margin: 24px 0;">
        <h3 style="margin-top: 0; font-size: 18px; color: #111827;">Submission Lineage</h3>
        <p style="margin: 8px 0;"><strong>Stage:</strong> ${stageLabel}</p>
        <p style="margin: 8px 0;"><strong>Parent Submission:</strong> ${parentSubmissionId}</p>
      </div>
      ` : ''}

      <div style="background-color: #fef3c7; border: 1px solid #fbbf24; padding: 16px; border-radius: 8px; margin: 24px 0;">
        <p style="margin: 0; color: #92400e;"><strong>Action Required:</strong> Please respond to this quote request within 24 hours.</p>
      </div>
    `;

    const adminDeepLink = submissionEntryId
      ? `https://www.navigatewealth.co/admin?module=submissions&type=quote&id=${encodeURIComponent(submissionEntryId)}`
      : 'https://www.navigatewealth.co/admin?module=submissions&type=quote';

    const adminHtml = createEmailTemplate(adminHtmlContent, {
      title: isFullStage ? 'Full Quote Request' : 'New Quote Enquiry',
      subtitle: `From ${fullName}${displayService ? ` — ${displayService}` : ''}`,
      buttonUrl: adminDeepLink,
      buttonLabel: 'View in Submissions Manager',
      footerSettings,
    });

    // ── Client acknowledgment email ──────────────────────────────────────────
    const clientHtmlContent = isFullStage
      ? `
        <p>Dear ${fullName},</p>
        <p>Thank you for your ${displayService || 'quote'} request. We have received your detailed requirements and one of our qualified advisers will be in touch shortly with a personalised, no-obligation quote.</p>
        <div style="background-color: #f0fdf4; border: 1px solid #86efac; padding: 20px; border-radius: 8px; margin: 24px 0;">
          <h3 style="margin-top: 0; font-size: 18px; color: #166534;">What Happens Next?</h3>
          <p style="color: #15803d; margin: 8px 0;">&#10003; An adviser will review your specific requirements</p>
          <p style="color: #15803d; margin: 8px 0;">&#10003; We will compare options from our trusted partners</p>
          <p style="color: #15803d; margin: 8px 0;">&#10003; You'll receive a personalised recommendation within 24 hours</p>
        </div>
        <p>Best regards,<br><strong>The Navigate Wealth Team</strong></p>
      `
      : `
        <p>Dear ${fullName},</p>
        <p>Thank you for your interest in Navigate Wealth${displayService ? `'s ${displayService} services` : ''}. We've received your details and will be in touch shortly.</p>
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
          ? [{
              content: pdfBase64,
              filename: `Quote_Request_${firstName}_${lastName}_${new Date().toISOString().slice(0, 10)}.pdf`,
              type: 'application/pdf',
              disposition: 'attachment',
            }]
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
}));

export default app;