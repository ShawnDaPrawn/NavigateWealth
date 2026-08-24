/**
 * Tax planning — the two renderings of one submission.
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

export function taxPlanningPdfFields(productDetails: QuoteProductDetails): QuotePdfField[] {
  const pdfFields: QuotePdfField[] = [];

  // Phase 2 Tax Planning structured payload
  pdfFields.push({ label: 'Quote Phase', value: 'Phase 2 — Tax Planning Assessment' });

  const taxTypes = productDetails.selected_types as string[] | undefined;
  if (taxTypes && taxTypes.length > 0) {
    pdfFields.push({ label: 'Tax Submission Type(s)', value: taxTypes.join(', ') });
  }

  const tc = productDetails.taxpayer_context as Record<string, unknown> | undefined;
  if (tc) {
    if (tc.taxpayer_type)
      pdfFields.push({ label: 'Taxpayer Type', value: String(tc.taxpayer_type) });
    if (tc.sars_registered)
      pdfFields.push({ label: 'Registered with SARS', value: String(tc.sars_registered) });
    if (tc.submission_status)
      pdfFields.push({ label: 'Submission Status', value: String(tc.submission_status) });
    if (tc.tax_years) pdfFields.push({ label: 'Tax Year(s)', value: String(tc.tax_years) });
  }

  const fScope = productDetails.financial_scope as Record<string, unknown> | undefined;
  if (fScope) {
    if (fScope.turnover_band)
      pdfFields.push({
        label: 'Annual Turnover / Income',
        value: String(fScope.turnover_band),
      });
    if (fScope.has_foreign_income)
      pdfFields.push({
        label: 'Foreign Income / Offshore Assets',
        value: String(fScope.has_foreign_income),
      });
    if (fScope.under_sars_audit)
      pdfFields.push({ label: 'Under SARS Audit', value: String(fScope.under_sars_audit) });
    if (fScope.has_penalties)
      pdfFields.push({
        label: 'Penalties / Interest Raised',
        value: String(fScope.has_penalties),
      });
  }

  return pdfFields;
}

export function taxPlanningHtml(productDetails: QuoteProductDetails): string {
  const sections: string[] = [];

  const taxTypesEmail = productDetails.selected_types as string[] | undefined;
  if (taxTypesEmail && taxTypesEmail.length > 0) {
    const items = taxTypesEmail.map((t: string) => `<li style="margin: 2px 0;">${t}</li>`).join('');
    sections.push(
      `<h4 style="margin: 12px 0 4px; color: #374151;">Tax Submission Type(s)</h4><ul style="margin: 4px 0; padding-left: 20px;">${items}</ul>`,
    );
  }

  const tcEmail = productDetails.taxpayer_context as Record<string, unknown> | undefined;
  if (tcEmail) {
    const tRows: string[] = [];
    if (tcEmail.taxpayer_type)
      tRows.push(
        `<p style="margin: 4px 0;"><strong>Taxpayer Type:</strong> ${tcEmail.taxpayer_type}</p>`,
      );
    if (tcEmail.sars_registered)
      tRows.push(
        `<p style="margin: 4px 0;"><strong>Registered with SARS:</strong> ${tcEmail.sars_registered}</p>`,
      );
    if (tcEmail.submission_status)
      tRows.push(
        `<p style="margin: 4px 0;"><strong>Submission Status:</strong> ${tcEmail.submission_status}</p>`,
      );
    if (tcEmail.tax_years)
      tRows.push(
        `<p style="margin: 4px 0;"><strong>Tax Year(s):</strong> ${tcEmail.tax_years}</p>`,
      );
    if (tRows.length) {
      sections.push(
        `<h4 style="margin: 12px 0 4px; color: #374151;">Taxpayer Details</h4>${tRows.join('')}`,
      );
    }
  }

  const fsEmail = productDetails.financial_scope as Record<string, unknown> | undefined;
  if (fsEmail) {
    const fRows: string[] = [];
    if (fsEmail.turnover_band)
      fRows.push(
        `<p style="margin: 4px 0;"><strong>Annual Turnover / Income:</strong> ${fsEmail.turnover_band}</p>`,
      );
    if (fsEmail.has_foreign_income)
      fRows.push(
        `<p style="margin: 4px 0;"><strong>Foreign Income / Offshore Assets:</strong> ${fsEmail.has_foreign_income}</p>`,
      );
    if (fsEmail.under_sars_audit)
      fRows.push(
        `<p style="margin: 4px 0;"><strong>Under SARS Audit:</strong> ${fsEmail.under_sars_audit}</p>`,
      );
    if (fsEmail.has_penalties)
      fRows.push(
        `<p style="margin: 4px 0;"><strong>Penalties / Interest Raised:</strong> ${fsEmail.has_penalties}</p>`,
      );
    if (fRows.length) {
      sections.push(
        `<h4 style="margin: 12px 0 4px; color: #374151;">Financial Scope</h4>${fRows.join('')}`,
      );
    }
  }

  return sections.join('');
}
