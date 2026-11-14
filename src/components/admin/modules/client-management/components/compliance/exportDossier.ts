import { toast } from 'sonner';
import { api } from '../../../../../../utils/api';
import { generateDossierHtml } from './generateDossierHtml';

/** One stored provider check result. */
interface ComplianceCheckResult {
  checkType: string;
  submittedAt: string;
  status: string;
  summary?: string;
  matterId?: string;
  rawResponse?: unknown;
}

/**
 * Builds the client's compliance dossier from every stored check result and
 * opens it in a new tab (Reports and the Compliance header both use it).
 */
export async function exportComplianceDossier(clientId: string, clientName: string) {
  const toastId = toast.loading('Generating compliance dossier...');

  try {
    const data = await api.get<{ history?: ComplianceCheckResult[] }>(
      `/integrations/honeycomb/checks/history/${clientId}`,
    );
    const allResults = data.history || [];

    const now = new Date().toLocaleString('en-ZA', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const issueDate = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    const checkTypeLabels: Record<string, string> = {
      idv_no_photo: 'Identity Verification (No Photo)',
      idv_with_photo: 'Identity Verification (With Photo)',
      idv_no_photo_secondary: 'IDV Secondary (No Photo)',
      idv_with_photo_secondary: 'IDV Secondary (With Photo)',
      idv_bulk: 'Bulk IDV',
      bank_verification: 'Bank Account Verification',
      consumer_credit: 'Consumer Credit Check',
      consumer_trace: 'Consumer Trace',
      debt_enquiry: 'Debt Review Enquiry',
      lifestyle_audit: 'Lifestyle Audit',
      income_predictor: 'Income Predictor',
      cipc: 'CIPC Company Search',
      director_enquiry: 'Director Enquiry',
      tenders_blue: 'Tenders Blue List',
      custom_screening: 'Custom Screening',
      sanctions_search: 'Sanctions Search',
      enforcement_actions: 'Enforcement Actions',
      legal_a_listing: 'Legal A Listing',
      best_known_address: 'Best Known Address',
      cdd_report: 'Customer Due Diligence (CDD)',
      assessment: 'Risk Assessment',
      registration: 'Client Registration',
    };

    const grouped: Record<string, ComplianceCheckResult[]> = {};
    for (const r of allResults) {
      if (!grouped[r.checkType]) grouped[r.checkType] = [];
      grouped[r.checkType].push(r);
    }

    let sectionNum = 0;
    let sectionsHtml = '';
    for (const [checkType, results] of Object.entries(grouped)) {
      sectionNum++;
      const label = checkTypeLabels[checkType] || checkType.replace(/_/g, ' ');
      sectionsHtml += `
        <div class="section dossier-section">
          <div class="section-head dossier-section-head">
            <span class="num">${sectionNum}</span>
            <h2>${label} <span style="font-weight:400;color:#9ca3af;font-size:9.5px">(${results.length} result${results.length !== 1 ? 's' : ''})</span></h2>
          </div>
          ${results
            .map(
              (r) => `
            <div class="dossier-result">
              <table>
                <tr><th>Date</th><td>${new Date(r.submittedAt).toLocaleString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td></tr>
                <tr><th>Status</th><td>${r.status}</td></tr>
                <tr><th>Summary</th><td>${r.summary || '—'}</td></tr>
                ${r.matterId ? `<tr><th>Matter ID</th><td style="font-family:monospace;font-size:9px">${r.matterId}</td></tr>` : ''}
              </table>
              <details style="margin-top:2mm">
                <summary style="cursor:pointer;font-size:8.5px;color:#6b7280">View full provider response</summary>
                <pre style="background:#1f2937;color:#e5e7eb;padding:6px;border-radius:4px;font-size:8px;overflow-x:auto;max-height:200px;overflow-y:auto;margin-top:4px;white-space:pre-wrap;word-break:break-word">${JSON.stringify(r.rawResponse, null, 2)}</pre>
              </details>
            </div>
          `,
            )
            .join('')}
        </div>
      `;
    }

    const dossierHtml = generateDossierHtml({
      clientName,
      now,
      issueDate,
      grouped,
      allResults,
      sectionsHtml,
    });
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(dossierHtml);
      win.document.close();
    }

    toast.success(
      `Dossier generated: ${allResults.length} results across ${Object.keys(grouped).length} check types`,
      { id: toastId },
    );
  } catch (err: unknown) {
    console.error('[ActivityLog] Download All error:', err);
    toast.error(err instanceof Error ? err.message : 'Failed to generate dossier', {
      id: toastId,
    });
  }
}
