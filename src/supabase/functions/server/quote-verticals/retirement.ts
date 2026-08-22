/**
 * Retirement planning — the two renderings of one submission.
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

export function retirementPdfFields(productDetails: QuoteProductDetails): QuotePdfField[] {
  const pdfFields: QuotePdfField[] = [];

  // Phase 2 Retirement Planning structured payload
  pdfFields.push({ label: 'Quote Phase', value: 'Phase 2 — Retirement Planning Assessment' });

  // Selected product
  if (productDetails.selected_product) {
    pdfFields.push({
      label: 'Retirement Product',
      value: String(productDetails.selected_product),
    });
  }

  // Funding
  const funding = productDetails.funding as Record<string, unknown> | undefined;
  if (funding) {
    const productId = productDetails.selected_product_id as string | undefined;
    if (productId === 'ra') {
      if (funding.contribution_type)
        pdfFields.push({
          label: 'Contribution Type',
          value: String(funding.contribution_type),
        });
      if (funding.adviser_assist) {
        pdfFields.push({ label: 'Contribution', value: 'Adviser assistance requested' });
      } else {
        const monthly = funding.monthly as Record<string, unknown> | undefined;
        if (monthly) {
          pdfFields.push({
            label: 'Monthly Contribution',
            value: monthly.adviser_assist
              ? 'Adviser assist'
              : formatRand(Number(monthly.amount_per_month || 0)),
          });
        }
        const lump = funding.lump_sum as Record<string, unknown> | undefined;
        if (lump) {
          pdfFields.push({
            label: 'Lump Sum Contribution',
            value: lump.adviser_assist ? 'Adviser assist' : formatRand(Number(lump.amount || 0)),
          });
        }
      }
    } else if (productId === 'provident_preservation' || productId === 'pension_preservation') {
      if (funding.is_transferring !== null && funding.is_transferring !== undefined) {
        pdfFields.push({
          label: 'Transferring from employer fund',
          value: funding.is_transferring ? 'Yes' : 'No',
        });
      }
      if (funding.transfer_not_sure) {
        pdfFields.push({ label: 'Transfer Amount', value: 'Not sure' });
      } else if (funding.transfer_amount) {
        pdfFields.push({
          label: 'Transfer Amount',
          value: formatRand(Number(funding.transfer_amount)),
        });
      }
    } else if (productId === 'not_sure') {
      if (funding.currently_employed !== null && funding.currently_employed !== undefined) {
        pdfFields.push({
          label: 'Currently Employed',
          value: funding.currently_employed ? 'Yes' : 'No',
        });
      }
      if (funding.leaving_employer_fund !== null && funding.leaving_employer_fund !== undefined) {
        pdfFields.push({
          label: 'Leaving Employer Fund',
          value: funding.leaving_employer_fund ? 'Yes' : 'No',
        });
      }
      if (funding.want_monthly_contributions) {
        const val =
          funding.want_monthly_contributions === 'yes'
            ? 'Yes'
            : funding.want_monthly_contributions === 'no'
              ? 'No'
              : 'Not sure';
        pdfFields.push({ label: 'Want Monthly Contributions', value: val });
      }
    }
  }

  // Timeline
  const tl = productDetails.timeline as Record<string, unknown> | undefined;
  if (tl) {
    if (tl.current_age) pdfFields.push({ label: 'Current Age', value: `${tl.current_age} years` });
    if (tl.planned_retirement_age)
      pdfFields.push({
        label: 'Planned Retirement Age',
        value: `${tl.planned_retirement_age} years`,
      });
    if (tl.member_of_retirement_fund !== null && tl.member_of_retirement_fund !== undefined) {
      pdfFields.push({
        label: 'Current Retirement Fund Member',
        value: tl.member_of_retirement_fund ? 'Yes' : 'No',
      });
    }
    if (tl.fund_details) pdfFields.push({ label: 'Fund(s)', value: String(tl.fund_details) });
  }

  // Financial snapshot
  const finR = productDetails.financial_snapshot as Record<string, unknown> | undefined;
  if (finR) {
    if (finR.income_gross_monthly)
      pdfFields.push({
        label: 'Gross Monthly Income',
        value: formatRand(Number(finR.income_gross_monthly)),
      });
    if (finR.income_net_monthly)
      pdfFields.push({
        label: 'Net Monthly Income',
        value: formatRand(Number(finR.income_net_monthly)),
      });
    if (finR.current_retirement_savings)
      pdfFields.push({
        label: 'Current Retirement Savings',
        value: formatRand(Number(finR.current_retirement_savings)),
      });
    if (finR.tax_bracket) pdfFields.push({ label: 'Tax Bracket', value: String(finR.tax_bracket) });
  }

  return pdfFields;
}

export function retirementHtml(productDetails: QuoteProductDetails): string {
  const sections: string[] = [];

  // Selected product
  if (productDetails.selected_product) {
    sections.push(
      `<h4 style="margin: 12px 0 4px; color: #374151;">Retirement Product</h4><p style="margin: 4px 0;">${productDetails.selected_product}</p>`,
    );
  }

  // Funding
  const funding = productDetails.funding as Record<string, unknown> | undefined;
  if (funding) {
    const productId = productDetails.selected_product_id as string | undefined;
    if (productId === 'ra') {
      const fRows: string[] = [];
      if (funding.contribution_type)
        fRows.push(
          `<p style="margin: 4px 0;"><strong>Contribution Type:</strong> ${funding.contribution_type}</p>`,
        );
      if (funding.adviser_assist) {
        fRows.push(
          `<p style="margin: 4px 0;"><strong>Contribution:</strong> Adviser assistance requested</p>`,
        );
      } else {
        const monthly = funding.monthly as Record<string, unknown> | undefined;
        if (monthly) {
          fRows.push(
            `<p style="margin: 4px 0;"><strong>Monthly Contribution:</strong> ${
              monthly.adviser_assist
                ? 'Adviser assist'
                : formatRand(Number(monthly.amount_per_month || 0))
            }</p>`,
          );
        }
        const lump = funding.lump_sum as Record<string, unknown> | undefined;
        if (lump) {
          fRows.push(
            `<p style="margin: 4px 0;"><strong>Lump Sum Contribution:</strong> ${
              lump.adviser_assist ? 'Adviser assist' : formatRand(Number(lump.amount || 0))
            }</p>`,
          );
        }
      }
      if (fRows.length) {
        sections.push(
          `<h4 style="margin: 12px 0 4px; color: #374151;">Funding</h4>${fRows.join('')}`,
        );
      }
    } else if (productId === 'provident_preservation' || productId === 'pension_preservation') {
      const fRows: string[] = [];
      if (funding.is_transferring !== null && funding.is_transferring !== undefined) {
        fRows.push(
          `<p style="margin: 4px 0;"><strong>Transferring from employer fund:</strong> ${funding.is_transferring ? 'Yes' : 'No'}</p>`,
        );
      }
      if (funding.transfer_not_sure) {
        fRows.push(`<p style="margin: 4px 0;"><strong>Transfer Amount:</strong> Not sure</p>`);
      } else if (funding.transfer_amount) {
        fRows.push(
          `<p style="margin: 4px 0;"><strong>Transfer Amount:</strong> ${formatRand(Number(funding.transfer_amount))}</p>`,
        );
      }
      if (fRows.length) {
        sections.push(
          `<h4 style="margin: 12px 0 4px; color: #374151;">Funding</h4>${fRows.join('')}`,
        );
      }
    } else if (productId === 'not_sure') {
      const fRows: string[] = [];
      if (funding.currently_employed !== null && funding.currently_employed !== undefined) {
        fRows.push(
          `<p style="margin: 4px 0;"><strong>Currently Employed:</strong> ${funding.currently_employed ? 'Yes' : 'No'}</p>`,
        );
      }
      if (funding.leaving_employer_fund !== null && funding.leaving_employer_fund !== undefined) {
        fRows.push(
          `<p style="margin: 4px 0;"><strong>Leaving Employer Fund:</strong> ${funding.leaving_employer_fund ? 'Yes' : 'No'}</p>`,
        );
      }
      if (funding.want_monthly_contributions) {
        const val =
          funding.want_monthly_contributions === 'yes'
            ? 'Yes'
            : funding.want_monthly_contributions === 'no'
              ? 'No'
              : 'Not sure';
        fRows.push(
          `<p style="margin: 4px 0;"><strong>Want Monthly Contributions:</strong> ${val}</p>`,
        );
      }
      if (fRows.length) {
        sections.push(
          `<h4 style="margin: 12px 0 4px; color: #374151;">Funding</h4>${fRows.join('')}`,
        );
      }
    }
  }

  // Timeline
  const tl = productDetails.timeline as Record<string, unknown> | undefined;
  if (tl) {
    const tRows: string[] = [];
    if (tl.current_age)
      tRows.push(
        `<p style="margin: 4px 0;"><strong>Current Age:</strong> ${tl.current_age} years</p>`,
      );
    if (tl.planned_retirement_age)
      tRows.push(
        `<p style="margin: 4px 0;"><strong>Planned Retirement Age:</strong> ${tl.planned_retirement_age} years</p>`,
      );
    if (tl.member_of_retirement_fund !== null && tl.member_of_retirement_fund !== undefined) {
      tRows.push(
        `<p style="margin: 4px 0;"><strong>Current Retirement Fund Member:</strong> ${tl.member_of_retirement_fund ? 'Yes' : 'No'}</p>`,
      );
    }
    if (tl.fund_details)
      tRows.push(`<p style="margin: 4px 0;"><strong>Fund(s):</strong> ${tl.fund_details}</p>`);
    if (tRows.length) {
      sections.push(
        `<h4 style="margin: 12px 0 4px; color: #374151;">Timeline</h4>${tRows.join('')}`,
      );
    }
  }

  // Financial snapshot
  const finR = productDetails.financial_snapshot as Record<string, unknown> | undefined;
  if (finR) {
    const fRows: string[] = [];
    if (finR.income_gross_monthly)
      fRows.push(
        `<p style="margin: 4px 0;"><strong>Gross Income:</strong> ${formatRand(Number(finR.income_gross_monthly))}</p>`,
      );
    if (finR.income_net_monthly)
      fRows.push(
        `<p style="margin: 4px 0;"><strong>Net Income:</strong> ${formatRand(Number(finR.income_net_monthly))}</p>`,
      );
    if (finR.current_retirement_savings)
      fRows.push(
        `<p style="margin: 4px 0;"><strong>Current Retirement Savings:</strong> ${formatRand(Number(finR.current_retirement_savings))}</p>`,
      );
    if (finR.tax_bracket)
      fRows.push(`<p style="margin: 4px 0;"><strong>Tax Bracket:</strong> ${finR.tax_bracket}</p>`);
    if (fRows.length) {
      sections.push(
        `<h4 style="margin: 12px 0 4px; color: #374151;">Financial Snapshot</h4>${fRows.join('')}`,
      );
    }
  }

  return sections.join('');
}
