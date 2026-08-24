/**
 * Risk assessment — the two renderings of one submission.
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

export function riskPdfFields(productDetails: QuoteProductDetails): QuotePdfField[] {
  const pdfFields: QuotePdfField[] = [];

  pdfFields.push({ label: 'Quote Phase', value: 'Phase 2 — Comprehensive Risk Assessment' });

  // Risk needs
  const riskNeeds = productDetails.risk_needs as Record<string, Record<string, unknown>>;
  for (const [coverId, entry] of Object.entries(riskNeeds)) {
    if (entry.selected) {
      const label = coverId.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
      const val = entry.adviser_assist
        ? 'Adviser assistance requested'
        : entry.amount || entry.amount_per_month
          ? `${formatRand(Number(entry.amount || entry.amount_per_month))}${entry.amount_per_month ? ' /month' : ''}`
          : 'Amount not specified';
      pdfFields.push({ label: `Cover: ${label}`, value: val });
    }
  }

  // Personal details
  const pd = productDetails.personal_details as Record<string, unknown> | undefined;
  if (pd) {
    if (pd.occupation) pdfFields.push({ label: 'Occupation', value: String(pd.occupation) });
    if (pd.income_gross_monthly)
      pdfFields.push({
        label: 'Gross Monthly Income',
        value: formatRand(Number(pd.income_gross_monthly)),
      });
    if (pd.income_net_monthly)
      pdfFields.push({
        label: 'Net Monthly Income',
        value: formatRand(Number(pd.income_net_monthly)),
      });
    if (pd.smoker_status)
      pdfFields.push({
        label: 'Smoker Status',
        value: String(pd.smoker_status)
          .replace(/-/g, ' ')
          .replace(/\b\w/g, (c: string) => c.toUpperCase()),
      });
    if (pd.highest_qualification)
      pdfFields.push({
        label: 'Qualification',
        value: String(pd.highest_qualification)
          .replace(/-/g, ' ')
          .replace(/\b\w/g, (c: string) => c.toUpperCase()),
      });
    if (pd.marital_status)
      pdfFields.push({
        label: 'Marital Status',
        value: String(pd.marital_status)
          .replace(/-/g, ' ')
          .replace(/\b\w/g, (c: string) => c.toUpperCase()),
      });
    if (pd.spouse_income_monthly)
      pdfFields.push({
        label: 'Spouse Monthly Income',
        value: formatRand(Number(pd.spouse_income_monthly)),
      });
  }

  // Health disclosures
  const hd = productDetails.health_disclosures as Record<string, unknown> | undefined;
  if (hd) {
    if (hd.has_conditions === false) {
      pdfFields.push({ label: 'Chronic Conditions', value: 'None declared' });
    } else if (hd.has_conditions === true) {
      const conditions = (hd.selected_conditions as string[]) || [];
      const freeText = (hd.free_text as string) || '';
      const parts = [...conditions];
      if (freeText) parts.push(freeText);
      pdfFields.push({
        label: 'Chronic Conditions',
        value: parts.join(', ') || 'Indicated but not specified',
      });
    }
  }

  return pdfFields;
}

export function riskHtml(productDetails: QuoteProductDetails): string {
  const sections: string[] = [];

  // Risk covers
  const rn = productDetails.risk_needs as Record<string, Record<string, unknown>>;
  const coverRows = Object.entries(rn)
    .filter(([, e]) => e.selected)
    .map(([id, e]) => {
      const label = id.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
      const val = e.adviser_assist
        ? '<em>Adviser assistance requested</em>'
        : e.amount || e.amount_per_month
          ? `${formatRand(Number(e.amount || e.amount_per_month))}${e.amount_per_month ? ' /month' : ''}`
          : 'Not specified';
      return `<p style="margin: 4px 0;"><strong>${label}:</strong> ${val}</p>`;
    });
  if (coverRows.length) {
    sections.push(
      `<h4 style="margin: 12px 0 4px; color: #374151;">Selected Covers</h4>${coverRows.join('')}`,
    );
  }

  // Personal details
  const pd = productDetails.personal_details as Record<string, unknown> | undefined;
  if (pd) {
    const pRows: string[] = [];
    if (pd.occupation)
      pRows.push(`<p style="margin: 4px 0;"><strong>Occupation:</strong> ${pd.occupation}</p>`);
    if (pd.income_gross_monthly)
      pRows.push(
        `<p style="margin: 4px 0;"><strong>Gross Income:</strong> ${formatRand(Number(pd.income_gross_monthly))}</p>`,
      );
    if (pd.income_net_monthly)
      pRows.push(
        `<p style="margin: 4px 0;"><strong>Net Income:</strong> ${formatRand(Number(pd.income_net_monthly))}</p>`,
      );
    if (pd.smoker_status)
      pRows.push(
        `<p style="margin: 4px 0;"><strong>Smoker:</strong> ${String(pd.smoker_status).replace(/-/g, ' ')}</p>`,
      );
    if (pd.marital_status)
      pRows.push(
        `<p style="margin: 4px 0;"><strong>Marital Status:</strong> ${String(pd.marital_status).replace(/-/g, ' ')}</p>`,
      );
    if (pd.spouse_income_monthly)
      pRows.push(
        `<p style="margin: 4px 0;"><strong>Spouse Income:</strong> ${formatRand(Number(pd.spouse_income_monthly))}</p>`,
      );
    if (pd.highest_qualification)
      pRows.push(
        `<p style="margin: 4px 0;"><strong>Qualification:</strong> ${String(pd.highest_qualification).replace(/-/g, ' ')}</p>`,
      );
    if (pRows.length) {
      sections.push(
        `<h4 style="margin: 12px 0 4px; color: #374151;">Personal &amp; Financial</h4>${pRows.join('')}`,
      );
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
      sections.push(
        `<h4 style="margin: 12px 0 4px; color: #374151;">Chronic Conditions</h4>${healthLine}`,
      );
    }
  }

  return sections.join('');
}
