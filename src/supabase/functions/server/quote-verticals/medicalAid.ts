/**
 * Medical aid — the two renderings of one submission.
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

export function medicalAidPdfFields(productDetails: QuoteProductDetails): QuotePdfField[] {
  const pdfFields: QuotePdfField[] = [];

  // Phase 2 Medical Aid structured payload
  pdfFields.push({
    label: 'Quote Phase',
    value: 'Phase 2 — Comprehensive Medical Aid Assessment',
  });

  // Members
  const mem = productDetails.members as Record<string, unknown> | undefined;
  if (mem) {
    if (mem.membership_type)
      pdfFields.push({ label: 'Membership Type', value: String(mem.membership_type) });
    const mainM = mem.main as Record<string, unknown> | undefined;
    if (mainM) {
      const mainInfo = mainM.dob ? String(mainM.dob) : mainM.age ? `Age ${mainM.age}` : '—';
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
        const childInfo = child.dob ? String(child.dob) : child.age ? `Age ${child.age}` : '—';
        pdfFields.push({ label: `Child ${i + 1}`, value: childInfo });
      });
    }
  }

  // Preferences
  const prefs = productDetails.preferences as Record<string, unknown> | undefined;
  if (prefs) {
    if (prefs.cover_type) pdfFields.push({ label: 'Cover Type', value: String(prefs.cover_type) });
    if (prefs.network)
      pdfFields.push({ label: 'Network Preference', value: String(prefs.network) });
    if (prefs.budget_band)
      pdfFields.push({ label: 'Monthly Budget', value: String(prefs.budget_band) });
    if (prefs.province) pdfFields.push({ label: 'Province', value: String(prefs.province) });
  }

  // Medical aid history
  const hist = productDetails.medical_aid_history as Record<string, unknown> | undefined;
  if (hist) {
    if (hist.current_status)
      pdfFields.push({ label: 'Current Status', value: String(hist.current_status) });
    if (hist.current_scheme)
      pdfFields.push({ label: 'Current Scheme', value: String(hist.current_scheme) });
    if (hist.current_plan)
      pdfFields.push({ label: 'Current Plan', value: String(hist.current_plan) });
    if (hist.current_tenure_band)
      pdfFields.push({ label: 'Scheme Tenure', value: String(hist.current_tenure_band) });
    if (hist.time_without_sa_medical_aid)
      pdfFields.push({
        label: 'Time Without Medical Aid',
        value: String(hist.time_without_sa_medical_aid),
      });
    if (hist.lpj_time_off_since_35)
      pdfFields.push({
        label: 'LPJ: Time Off Since 35',
        value: String(hist.lpj_time_off_since_35),
      });
  }

  // Health
  const health = productDetails.health as Record<string, unknown> | undefined;
  if (health) {
    if (health.has_chronic_conditions === false) {
      pdfFields.push({ label: 'Chronic Conditions', value: 'None declared' });
    } else if (health.has_chronic_conditions === true) {
      const conditions = (health.selected_conditions as string[]) || [];
      const appliesTo = (health.applies_to_members as string[]) || [];
      const notes = (health.notes as string) || '';
      const parts = [...conditions];
      if (notes) parts.push(notes);
      pdfFields.push({
        label: 'Chronic Conditions',
        value: parts.join(', ') || 'Indicated but not specified',
      });
      if (appliesTo.length > 0)
        pdfFields.push({ label: 'Applies To', value: appliesTo.join(', ') });
    }
  }

  return pdfFields;
}

export function medicalAidHtml(productDetails: QuoteProductDetails): string {
  const sections: string[] = [];

  // Members
  const mem = productDetails.members as Record<string, unknown> | undefined;
  if (mem) {
    const mRows: string[] = [];
    if (mem.membership_type)
      mRows.push(
        `<p style="margin: 4px 0;"><strong>Membership Type:</strong> ${mem.membership_type}</p>`,
      );
    const mainM = mem.main as Record<string, unknown> | undefined;
    if (mainM) {
      const mainInfo = mainM.dob ? String(mainM.dob) : mainM.age ? `Age ${mainM.age}` : '—';
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
        const childInfo = child.dob ? String(child.dob) : child.age ? `Age ${child.age}` : '—';
        mRows.push(`<p style="margin: 4px 0;"><strong>Child ${i + 1}:</strong> ${childInfo}</p>`);
      });
    }
    if (mRows.length) {
      sections.push(
        `<h4 style="margin: 12px 0 4px; color: #374151;">Members</h4>${mRows.join('')}`,
      );
    }
  }

  // Preferences
  const prefs = productDetails.preferences as Record<string, unknown> | undefined;
  if (prefs) {
    const pRows: string[] = [];
    if (prefs.cover_type)
      pRows.push(`<p style="margin: 4px 0;"><strong>Cover Type:</strong> ${prefs.cover_type}</p>`);
    if (prefs.network)
      pRows.push(
        `<p style="margin: 4px 0;"><strong>Network Preference:</strong> ${prefs.network}</p>`,
      );
    if (prefs.budget_band)
      pRows.push(
        `<p style="margin: 4px 0;"><strong>Monthly Budget:</strong> ${prefs.budget_band}</p>`,
      );
    if (prefs.province)
      pRows.push(`<p style="margin: 4px 0;"><strong>Province:</strong> ${prefs.province}</p>`);
    if (pRows.length) {
      sections.push(
        `<h4 style="margin: 12px 0 4px; color: #374151;">Preferences</h4>${pRows.join('')}`,
      );
    }
  }

  // Medical aid history
  const hist = productDetails.medical_aid_history as Record<string, unknown> | undefined;
  if (hist) {
    const hRows: string[] = [];
    if (hist.current_status)
      hRows.push(
        `<p style="margin: 4px 0;"><strong>Current Status:</strong> ${hist.current_status}</p>`,
      );
    if (hist.current_scheme)
      hRows.push(
        `<p style="margin: 4px 0;"><strong>Current Scheme:</strong> ${hist.current_scheme}</p>`,
      );
    if (hist.current_plan)
      hRows.push(
        `<p style="margin: 4px 0;"><strong>Current Plan:</strong> ${hist.current_plan}</p>`,
      );
    if (hist.current_tenure_band)
      hRows.push(
        `<p style="margin: 4px 0;"><strong>Scheme Tenure:</strong> ${hist.current_tenure_band}</p>`,
      );
    if (hist.time_without_sa_medical_aid)
      hRows.push(
        `<p style="margin: 4px 0;"><strong>Time Without Medical Aid:</strong> ${hist.time_without_sa_medical_aid}</p>`,
      );
    if (hist.lpj_time_off_since_35)
      hRows.push(
        `<p style="margin: 4px 0;"><strong>LPJ: Time Off Since 35:</strong> ${hist.lpj_time_off_since_35}</p>`,
      );
    if (hRows.length) {
      sections.push(
        `<h4 style="margin: 12px 0 4px; color: #374151;">Medical Aid History</h4>${hRows.join('')}`,
      );
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
      sections.push(
        `<h4 style="margin: 12px 0 4px; color: #374151;">Chronic Conditions</h4>${healthLine}`,
      );
    }
  }

  return sections.join('');
}
