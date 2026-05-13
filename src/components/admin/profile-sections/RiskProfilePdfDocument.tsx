import React from 'react';
import { BasePdfLayout } from '../modules/resources/templates/BasePdfLayout';
import type { RiskAssessment } from '../modules/client-management/types';
import {
  getRiskCategorySummary,
  getSelectedRiskAnswerLabel,
  RISK_CATEGORY_SUMMARIES,
  RISK_PROFILE_QUESTIONS,
} from './riskProfileContent';

const RISK_PORTRAIT_PDF_CSS = `
  .risk-pdf {
    font-size: 9.2px;
    line-height: 1.45;
    color: var(--text);
  }

  .risk-pdf .section {
    margin-bottom: 4.5mm;
  }

  .risk-pdf .section-head {
    display: flex;
    align-items: center;
    gap: 3mm;
    border-bottom: 1px solid var(--border);
    padding-bottom: 1.5mm;
    margin-bottom: 2.8mm;
  }

  .risk-pdf .section-head .num {
    min-width: 7mm;
    color: var(--nw-purple);
    font-weight: 800;
  }

  .risk-pdf .section-head h2 {
    margin: 0;
    color: #1f2937;
  }

  .risk-pdf .summary-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 2.4mm;
  }

  .risk-pdf .summary-card,
  .risk-pdf .callout,
  .risk-pdf .legend-card {
    border: 1px solid var(--border);
    border-radius: 4px;
    background: #ffffff;
  }

  .risk-pdf .summary-card {
    padding: 2.4mm 2.8mm;
    min-height: 19mm;
  }

  .risk-pdf .summary-label {
    font-size: 8px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    color: var(--muted);
    margin-bottom: 1mm;
  }

  .risk-pdf .summary-value {
    font-size: 10px;
    font-weight: 700;
    color: #111827;
  }

  .risk-pdf .summary-value.score {
    color: var(--nw-purple);
    font-size: 14px;
  }

  .risk-pdf .summary-value.band {
    display: inline-block;
    padding: 1.2mm 2mm;
    border-radius: 999px;
    background: #ede9fe;
    color: #5b21b6;
  }

  .risk-pdf .split-grid {
    display: grid;
    grid-template-columns: 1.35fr 0.95fr;
    gap: 3mm;
  }

  .risk-pdf .callout,
  .risk-pdf .legend-card {
    padding: 2.8mm 3mm;
  }

  .risk-pdf .callout-title,
  .risk-pdf .legend-title {
    font-size: 8px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    color: var(--muted);
    margin-bottom: 1.2mm;
  }

  .risk-pdf .callout p {
    margin: 0;
    font-size: 9px;
  }

  .risk-pdf .legend-list {
    display: grid;
    gap: 1.2mm;
  }

  .risk-pdf .legend-row {
    display: flex;
    justify-content: space-between;
    gap: 3mm;
    padding: 1.5mm 0;
    border-bottom: 1px solid #f3f4f6;
    font-size: 8.6px;
  }

  .risk-pdf .legend-row:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  .risk-pdf .legend-row.active {
    color: var(--nw-purple);
    font-weight: 700;
  }

  .risk-pdf .answers-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 8.2px;
  }

  .risk-pdf .answers-table th,
  .risk-pdf .answers-table td {
    border: 1px solid var(--border);
    padding: 1.6mm 1.8mm;
    text-align: left;
    vertical-align: top;
  }

  .risk-pdf .answers-table th {
    background: var(--soft);
    color: #374151;
    font-weight: 700;
  }

  .risk-pdf .answers-table .col-number {
    width: 8%;
  }

  .risk-pdf .answers-table .col-question {
    width: 54%;
  }

  .risk-pdf .answers-table .col-answer {
    width: 38%;
  }

  .risk-pdf .answers-table td strong {
    display: block;
    margin-bottom: 0.6mm;
    font-size: 8.5px;
    color: #111827;
  }

  .risk-pdf .footnote {
    margin-top: 2.5mm;
    padding: 2mm 2.4mm;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--soft);
    font-size: 7.8px;
    color: #4b5563;
  }
`;

interface RiskProfilePdfDocumentProps {
  clientName: string;
  riskAssessment: RiskAssessment;
}

export function RiskProfilePdfDocument({
  clientName,
  riskAssessment,
}: RiskProfilePdfDocumentProps) {
  const completedLabel = riskAssessment.dateCompleted
    ? new Date(riskAssessment.dateCompleted).toLocaleDateString('en-ZA', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : 'Not recorded';
  const categorySummary = getRiskCategorySummary(riskAssessment.riskCategory);

  return (
    <BasePdfLayout
      docTitle="Client Risk Portrait"
      issueDate={completedLabel}
      pageSize="A4"
      orientation="portrait"
    >
      <style dangerouslySetInnerHTML={{ __html: RISK_PORTRAIT_PDF_CSS }} />

      <div className="risk-pdf">
        <section className="section">
          <div className="section-head">
            <div className="num">01</div>
            <h2>Assessment Overview</h2>
          </div>

          <div className="summary-grid">
            <div className="summary-card">
              <div className="summary-label">Client</div>
              <div className="summary-value">{clientName}</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">Completed</div>
              <div className="summary-value">{completedLabel}</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">Total Score</div>
              <div className="summary-value score">{riskAssessment.totalScore}/30</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">Investor Type</div>
              <div className="summary-value band">{riskAssessment.riskCategory || 'Pending'}</div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="section-head">
            <div className="num">02</div>
            <h2>Interpretation</h2>
          </div>

          <div className="split-grid">
            <div className="callout">
              <div className="callout-title">What this means</div>
              <p>
                <strong>{categorySummary?.label || 'Risk profile pending'}:</strong>{' '}
                {categorySummary?.body || 'The assessment must be completed before a risk profile can be interpreted.'}
              </p>
            </div>

            <div className="legend-card">
              <div className="legend-title">Score Bands</div>
              <div className="legend-list">
                {RISK_CATEGORY_SUMMARIES.map((item) => (
                  <div
                    key={item.label}
                    className={`legend-row ${item.label === riskAssessment.riskCategory ? 'active' : ''}`}
                  >
                    <span>{item.label}</span>
                    <span>{item.scoreRange}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="section-head">
            <div className="num">03</div>
            <h2>Response Summary</h2>
          </div>

          <table className="answers-table">
            <thead>
              <tr>
                <th className="col-number">#</th>
                <th className="col-question">Question</th>
                <th className="col-answer">Selected response</th>
              </tr>
            </thead>
            <tbody>
              {RISK_PROFILE_QUESTIONS.map((question) => (
                <tr key={question.key}>
                  <td>{question.number}</td>
                  <td>
                    <strong>{question.prompt}</strong>
                    <span>{question.helperText}</span>
                  </td>
                  <td>{getSelectedRiskAnswerLabel(riskAssessment, question)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="footnote">
            This portrait is generated from the completed client risk assessment captured in the admin portal and is intended to support adviser review and downstream documentation.
          </div>
        </section>
      </div>
    </BasePdfLayout>
  );
}
