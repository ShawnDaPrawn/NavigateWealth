/**
 * Investment management — the two renderings of one submission.
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

export function investmentPdfFields(productDetails: QuoteProductDetails): QuotePdfField[] {
  const pdfFields: QuotePdfField[] = [];

  // Phase 2 Investment structured payload
  pdfFields.push({
    label: 'Quote Phase',
    value: 'Phase 2 — Investment Management Assessment',
  });

  // Selected types
  const types = productDetails.selected_types as string[] | undefined;
  if (types && types.length > 0) {
    pdfFields.push({ label: 'Investment Types', value: types.join(', ') });
  }

  // Contributions
  const contribs = productDetails.contributions as
    | Record<string, Record<string, unknown>>
    | undefined;
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
          parts.push(
            lump.adviser_assist
              ? 'Lump sum: adviser assist'
              : `Lump sum: ${formatRand(Number(lump.amount || 0))}`,
          );
        }
        const monthly = entry.monthly as Record<string, unknown> | undefined;
        if (monthly) {
          parts.push(
            monthly.adviser_assist
              ? 'Monthly: adviser assist'
              : `Monthly: ${formatRand(Number(monthly.amount_per_month || 0))} /month`,
          );
        }
      }
      pdfFields.push({ label: `Investment: ${label}`, value: parts.join(' · ') || '—' });
    }
  }

  // Objective
  const obj = productDetails.objective as Record<string, unknown> | undefined;
  if (obj) {
    if (obj.primary_objective)
      pdfFields.push({ label: 'Primary Objective', value: String(obj.primary_objective) });
    if (obj.time_horizon)
      pdfFields.push({ label: 'Time Horizon', value: String(obj.time_horizon) });
    if (obj.risk_comfort)
      pdfFields.push({ label: 'Risk Comfort', value: String(obj.risk_comfort) });
  }

  // Financial snapshot
  const fin = productDetails.financial_snapshot as Record<string, unknown> | undefined;
  if (fin) {
    if (fin.income_gross_monthly)
      pdfFields.push({
        label: 'Gross Monthly Income',
        value: formatRand(Number(fin.income_gross_monthly)),
      });
    if (fin.income_net_monthly)
      pdfFields.push({
        label: 'Net Monthly Income',
        value: formatRand(Number(fin.income_net_monthly)),
      });
    if (fin.existing_investments)
      pdfFields.push({
        label: 'Existing Investments',
        value: String(fin.existing_investments),
      });
    if (fin.has_retirement_annuity !== null && fin.has_retirement_annuity !== undefined) {
      pdfFields.push({
        label: 'Retirement Annuity',
        value: fin.has_retirement_annuity ? 'Yes' : 'No',
      });
    }
    if (fin.tax_bracket) pdfFields.push({ label: 'Tax Bracket', value: String(fin.tax_bracket) });
  }

  return pdfFields;
}

export function investmentHtml(productDetails: QuoteProductDetails): string {
  const sections: string[] = [];

  // Selected types
  const types = productDetails.selected_types as string[] | undefined;
  if (types && types.length > 0) {
    sections.push(
      `<h4 style="margin: 12px 0 4px; color: #374151;">Investment Types</h4><p style="margin: 4px 0;">${types.join(', ')}</p>`,
    );
  }

  // Contributions
  const contribs = productDetails.contributions as
    | Record<string, Record<string, unknown>>
    | undefined;
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
          parts.push(
            lump.adviser_assist
              ? 'Lump sum: adviser assist'
              : `Lump sum: ${formatRand(Number(lump.amount || 0))}`,
          );
        }
        const monthly = entry.monthly as Record<string, unknown> | undefined;
        if (monthly) {
          parts.push(
            monthly.adviser_assist
              ? 'Monthly: adviser assist'
              : `Monthly: ${formatRand(Number(monthly.amount_per_month || 0))} /month`,
          );
        }
      }
      cRows.push(
        `<p style="margin: 4px 0;"><strong>${label}:</strong> ${parts.join(' · ') || '—'}</p>`,
      );
    }
    if (cRows.length) {
      sections.push(
        `<h4 style="margin: 12px 0 4px; color: #374151;">Contributions</h4>${cRows.join('')}`,
      );
    }
  }

  // Objective
  const obj = productDetails.objective as Record<string, unknown> | undefined;
  if (obj) {
    const oRows: string[] = [];
    if (obj.primary_objective)
      oRows.push(
        `<p style="margin: 4px 0;"><strong>Primary Objective:</strong> ${obj.primary_objective}</p>`,
      );
    if (obj.time_horizon)
      oRows.push(
        `<p style="margin: 4px 0;"><strong>Time Horizon:</strong> ${obj.time_horizon}</p>`,
      );
    if (obj.risk_comfort)
      oRows.push(
        `<p style="margin: 4px 0;"><strong>Risk Comfort:</strong> ${obj.risk_comfort}</p>`,
      );
    if (oRows.length) {
      sections.push(
        `<h4 style="margin: 12px 0 4px; color: #374151;">Objective</h4>${oRows.join('')}`,
      );
    }
  }

  // Financial snapshot
  const fin = productDetails.financial_snapshot as Record<string, unknown> | undefined;
  if (fin) {
    const fRows: string[] = [];
    if (fin.income_gross_monthly)
      fRows.push(
        `<p style="margin: 4px 0;"><strong>Gross Income:</strong> ${formatRand(Number(fin.income_gross_monthly))}</p>`,
      );
    if (fin.income_net_monthly)
      fRows.push(
        `<p style="margin: 4px 0;"><strong>Net Income:</strong> ${formatRand(Number(fin.income_net_monthly))}</p>`,
      );
    if (fin.existing_investments)
      fRows.push(
        `<p style="margin: 4px 0;"><strong>Existing Investments:</strong> ${fin.existing_investments}</p>`,
      );
    if (fin.has_retirement_annuity !== null && fin.has_retirement_annuity !== undefined) {
      fRows.push(
        `<p style="margin: 4px 0;"><strong>Retirement Annuity:</strong> ${fin.has_retirement_annuity ? 'Yes' : 'No'}</p>`,
      );
    }
    if (fin.tax_bracket)
      fRows.push(`<p style="margin: 4px 0;"><strong>Tax Bracket:</strong> ${fin.tax_bracket}</p>`);
    if (fRows.length) {
      sections.push(
        `<h4 style="margin: 12px 0 4px; color: #374151;">Financial Snapshot</h4>${fRows.join('')}`,
      );
    }
  }

  return sections.join('');
}
