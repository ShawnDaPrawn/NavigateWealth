/**
 * Employee benefits — the two renderings of one submission.
 *
 * Both halves are here on purpose. The quote handler used to dispatch on
 * `productDetails.vertical` TWICE in the same 1,516-line function: once to build
 * PDF fields and once to build email HTML, with the same six branches and
 * near-identical inner logic in each. Putting a vertical's two renderings in one
 * file makes that duplication adjacent and obvious rather than a thousand lines
 * apart, which is what turns collapsing them into a small, testable change per
 * vertical instead of one unreviewable rewrite.
 *
 * Moved verbatim: this file changes where the code lives, not what it does.
 */
import type { QuoteProductDetails, QuotePdfField } from './types.ts';
import { formatRand } from './formatRand.ts';

export function employeeBenefitsPdfFields(productDetails: QuoteProductDetails): QuotePdfField[] {
  const pdfFields: QuotePdfField[] = [];

  // Phase 2 Employee Benefits structured payload
  pdfFields.push({ label: 'Quote Phase', value: 'Phase 2 — Employee Benefits Assessment' });

  // Business details
  const biz = productDetails.business as Record<string, unknown> | undefined;
  if (biz) {
    if (biz.company_name)
      pdfFields.push({ label: 'Company Name', value: String(biz.company_name) });
    if (biz.trading_name)
      pdfFields.push({ label: 'Trading Name', value: String(biz.trading_name) });
    if (biz.industry_sector)
      pdfFields.push({ label: 'Industry Sector', value: String(biz.industry_sector) });
    if (biz.employee_count)
      pdfFields.push({ label: 'Number of Employees', value: String(biz.employee_count) });
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
      pdfFields.push({
        label: 'Monthly Budget',
        value: `${formatRand(Number(bdgt.monthly_budget))} /month`,
      });
    }
    if (bdgt.contribution_structure)
      pdfFields.push({
        label: 'Contribution Structure',
        value: String(bdgt.contribution_structure),
      });
    if (bdgt.compulsory_for_all)
      pdfFields.push({
        label: 'Compulsory for All Staff',
        value: String(bdgt.compulsory_for_all),
      });
  }

  // Workforce
  const wf = productDetails.workforce as Record<string, unknown> | undefined;
  if (wf) {
    if (wf.average_age_band)
      pdfFields.push({ label: 'Average Age Band', value: String(wf.average_age_band) });
    if (wf.workforce_type)
      pdfFields.push({ label: 'Workforce Type', value: String(wf.workforce_type) });
    if (wf.has_existing_benefits !== null && wf.has_existing_benefits !== undefined) {
      pdfFields.push({
        label: 'Existing Benefits',
        value: wf.has_existing_benefits ? 'Yes' : 'No',
      });
    }
    if (wf.existing_benefits_description)
      pdfFields.push({
        label: 'Current Arrangement',
        value: String(wf.existing_benefits_description),
      });
  }

  return pdfFields;
}

export function employeeBenefitsHtml(productDetails: QuoteProductDetails): string {
  const sections: string[] = [];

  // Business details
  const biz = productDetails.business as Record<string, unknown> | undefined;
  if (biz) {
    const bRows: string[] = [];
    if (biz.company_name)
      bRows.push(
        `<p style="margin: 4px 0;"><strong>Company Name:</strong> ${biz.company_name}</p>`,
      );
    if (biz.trading_name)
      bRows.push(
        `<p style="margin: 4px 0;"><strong>Trading Name:</strong> ${biz.trading_name}</p>`,
      );
    if (biz.industry_sector)
      bRows.push(
        `<p style="margin: 4px 0;"><strong>Industry Sector:</strong> ${biz.industry_sector}</p>`,
      );
    if (biz.employee_count)
      bRows.push(
        `<p style="margin: 4px 0;"><strong>Number of Employees:</strong> ${biz.employee_count}</p>`,
      );
    if (biz.province)
      bRows.push(`<p style="margin: 4px 0;"><strong>Province:</strong> ${biz.province}</p>`);
    if (bRows.length) {
      sections.push(
        `<h4 style="margin: 12px 0 4px; color: #374151;">Business Details</h4>${bRows.join('')}`,
      );
    }
  }

  // Benefit type
  if (productDetails.benefit_type) {
    sections.push(
      `<h4 style="margin: 12px 0 4px; color: #374151;">Benefit Type</h4><p style="margin: 4px 0;">${productDetails.benefit_type}</p>`,
    );
  }

  // Budget
  const bdgt = productDetails.budget as Record<string, unknown> | undefined;
  if (bdgt) {
    const bRows: string[] = [];
    if (bdgt.budget_adviser_assist) {
      bRows.push(
        `<p style="margin: 4px 0;"><strong>Monthly Budget:</strong> Adviser guidance requested</p>`,
      );
    } else if (bdgt.monthly_budget) {
      bRows.push(
        `<p style="margin: 4px 0;"><strong>Monthly Budget:</strong> ${formatRand(Number(bdgt.monthly_budget))} /month</p>`,
      );
    }
    if (bdgt.contribution_structure)
      bRows.push(
        `<p style="margin: 4px 0;"><strong>Contribution Structure:</strong> ${bdgt.contribution_structure}</p>`,
      );
    if (bdgt.compulsory_for_all)
      bRows.push(
        `<p style="margin: 4px 0;"><strong>Compulsory for All Staff:</strong> ${bdgt.compulsory_for_all}</p>`,
      );
    if (bRows.length) {
      sections.push(`<h4 style="margin: 12px 0 4px; color: #374151;">Budget</h4>${bRows.join('')}`);
    }
  }

  // Workforce
  const wf = productDetails.workforce as Record<string, unknown> | undefined;
  if (wf) {
    const wRows: string[] = [];
    if (wf.average_age_band)
      wRows.push(
        `<p style="margin: 4px 0;"><strong>Average Age Band:</strong> ${wf.average_age_band}</p>`,
      );
    if (wf.workforce_type)
      wRows.push(
        `<p style="margin: 4px 0;"><strong>Workforce Type:</strong> ${wf.workforce_type}</p>`,
      );
    if (wf.has_existing_benefits !== null && wf.has_existing_benefits !== undefined) {
      wRows.push(
        `<p style="margin: 4px 0;"><strong>Existing Benefits:</strong> ${wf.has_existing_benefits ? 'Yes' : 'No'}</p>`,
      );
    }
    if (wf.existing_benefits_description)
      wRows.push(
        `<p style="margin: 4px 0;"><strong>Current Arrangement:</strong> ${wf.existing_benefits_description}</p>`,
      );
    if (wRows.length) {
      sections.push(
        `<h4 style="margin: 12px 0 4px; color: #374151;">Workforce</h4>${wRows.join('')}`,
      );
    }
  }

  return sections.join('');
}
