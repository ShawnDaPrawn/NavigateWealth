/**
 * Risk Planning FNA PDF Export
 * Generates a professional PDF report using the Navigate Wealth template
 */

import React from 'react';
import { BasePdfLayout } from '../../resources/templates/BasePdfLayout';
import type { RiskCalculations, Adjustments } from '../types';
import { COMPLIANCE_DISCLAIMERS } from '../constants';

interface RiskPlanningFNAPdfExportProps {
  calculations: RiskCalculations;
  adjustments: Adjustments;
  clientName?: string;
  clientId?: string;
}

const formatCurrency = (value: number): string => {
  if (value === undefined || value === null || isNaN(value)) return 'R0';
  const isNeg = value < 0;
  const abs = Math.abs(value);
  const intPart = Math.round(abs).toString();
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${isNeg ? '-' : ''}R${withCommas}`;
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

export const RiskPlanningFNAPdfExport = ({ calculations, adjustments, clientName = 'Client', clientId }: RiskPlanningFNAPdfExportProps) => {
  if (!calculations) {
    return null;
  }

  // Build final needs from calculations and adjustments
  const finalNeeds = [
    {
      riskType: 'life',
      label: 'Life Cover (Death)',
      grossNeed: calculations.life.grossNeed,
      existingCoverPersonal: calculations.life.existingCover.personal,
      existingCoverGroup: calculations.life.existingCover.group,
      existingCoverTotal: calculations.life.existingCover.total,
      netShortfall: calculations.life.netShortfall,
      isOverinsured: calculations.life.netShortfall < 0,
      overinsuredAmount: calculations.life.netShortfall < 0 ? Math.abs(calculations.life.netShortfall) : 0,
      advisorOverride: adjustments.life,
      finalRecommendedCover: adjustments.life?.overrideValue ?? calculations.life.netShortfall,
      assumptions: calculations.life.assumptions,
      riskNotes: calculations.life.riskNotes,
    },
    {
      riskType: 'disability',
      label: 'Lump Sum Disability Cover',
      grossNeed: calculations.disability.grossNeed,
      existingCoverPersonal: calculations.disability.existingCover.personal,
      existingCoverGroup: calculations.disability.existingCover.group,
      existingCoverTotal: calculations.disability.existingCover.total,
      netShortfall: calculations.disability.netShortfall,
      isOverinsured: calculations.disability.netShortfall < 0,
      overinsuredAmount: calculations.disability.netShortfall < 0 ? Math.abs(calculations.disability.netShortfall) : 0,
      advisorOverride: adjustments.disability,
      finalRecommendedCover: adjustments.disability?.overrideValue ?? calculations.disability.netShortfall,
      assumptions: calculations.disability.assumptions,
      riskNotes: calculations.disability.riskNotes,
    },
    {
      riskType: 'severeIllness',
      label: 'Severe Illness Cover',
      grossNeed: calculations.severeIllness.grossNeed,
      existingCoverPersonal: calculations.severeIllness.existingCover.personal,
      existingCoverGroup: calculations.severeIllness.existingCover.group,
      existingCoverTotal: calculations.severeIllness.existingCover.total,
      netShortfall: calculations.severeIllness.netShortfall,
      isOverinsured: calculations.severeIllness.netShortfall < 0,
      overinsuredAmount: calculations.severeIllness.netShortfall < 0 ? Math.abs(calculations.severeIllness.netShortfall) : 0,
      advisorOverride: adjustments.severeIllness,
      finalRecommendedCover: adjustments.severeIllness?.overrideValue ?? calculations.severeIllness.netShortfall,
      assumptions: calculations.severeIllness.assumptions,
      riskNotes: calculations.severeIllness.riskNotes,
    },
    {
      riskType: 'incomeProtectionTemporary',
      label: 'Income Protection (Temporary)',
      grossNeed: calculations.incomeProtection.temporary.calculatedNeed,
      existingCoverPersonal: calculations.incomeProtection.temporary.existingCover.personal,
      existingCoverGroup: calculations.incomeProtection.temporary.existingCover.group,
      existingCoverTotal: calculations.incomeProtection.temporary.existingCover.total,
      netShortfall: calculations.incomeProtection.temporary.netShortfall,
      isOverinsured: calculations.incomeProtection.temporary.netShortfall < 0,
      overinsuredAmount: calculations.incomeProtection.temporary.netShortfall < 0 ? Math.abs(calculations.incomeProtection.temporary.netShortfall) : 0,
      advisorOverride: adjustments.incomeProtectionTemporary,
      finalRecommendedCover: adjustments.incomeProtectionTemporary?.overrideValue ?? calculations.incomeProtection.temporary.netShortfall,
      assumptions: calculations.incomeProtection.assumptions,
      riskNotes: calculations.incomeProtection.riskNotes,
    },
    {
      riskType: 'incomeProtectionPermanent',
      label: 'Income Protection (Permanent)',
      grossNeed: calculations.incomeProtection.permanent.calculatedNeed,
      existingCoverPersonal: calculations.incomeProtection.permanent.existingCover.personal,
      existingCoverGroup: calculations.incomeProtection.permanent.existingCover.group,
      existingCoverTotal: calculations.incomeProtection.permanent.existingCover.total,
      netShortfall: calculations.incomeProtection.permanent.netShortfall,
      isOverinsured: calculations.incomeProtection.permanent.netShortfall < 0,
      overinsuredAmount: calculations.incomeProtection.permanent.netShortfall < 0 ? Math.abs(calculations.incomeProtection.permanent.netShortfall) : 0,
      advisorOverride: adjustments.incomeProtectionPermanent,
      finalRecommendedCover: adjustments.incomeProtectionPermanent?.overrideValue ?? calculations.incomeProtection.permanent.netShortfall,
      assumptions: calculations.incomeProtection.assumptions,
      riskNotes: calculations.incomeProtection.riskNotes,
    },
  ];

  // Group final needs by risk type
  const lifeCover = finalNeeds.find(n => n.riskType === 'life');
  const disabilityCover = finalNeeds.find(n => n.riskType === 'disability');
  const severeIllnessCover = finalNeeds.find(n => n.riskType === 'severeIllness');
  const ipTemporary = finalNeeds.find(n => n.riskType === 'incomeProtectionTemporary');
  const ipPermanent = finalNeeds.find(n => n.riskType === 'incomeProtectionPermanent');

  // Calculate totals
  const totalLumpSumCover = 
    (lifeCover?.finalRecommendedCover || 0) +
    (disabilityCover?.finalRecommendedCover || 0) +
    (severeIllnessCover?.finalRecommendedCover || 0);

  const permanentMonthlyIncome = ipPermanent?.finalRecommendedCover || 0;

  // Build pages array - each page should fit within A4 constraints
  const pages: React.ReactNode[] = [];

  // ==================== PAGE 1: Executive Summary ====================
  pages.push(
    <div key="page-1">
      {/* Executive Summary */}
      <section className="section">
        <div className="section-head">
          <span className="num">1.</span>
          <h2>Executive Summary</h2>
        </div>
        
        <div className="callout mb-4">
          <p className="m-0">
            This Financial Needs Analysis (FNA) has been prepared for <strong>{clientName}</strong> as at {formatDate(calculations.metadata.calculatedAt)}.
            The analysis is based on the client's current financial position and circumstances as disclosed during the advisory process.
          </p>
        </div>

        {/* Summary Statistics */}
        <table className="w-full mb-4">
          <tbody>
            <tr>
              <th>Client Name</th>
              <td>{clientName}</td>
            </tr>
            <tr>
              <th>FNA Version</th>
              <td>{calculations.metadata.systemVersion}</td>
            </tr>
            <tr>
              <th>Publication Date</th>
              <td>{formatDate(calculations.metadata.calculatedAt)}</td>
            </tr>
            <tr>
              <th>Published By</th>
              <td>{calculations.metadata.calculatedBy}</td>
            </tr>
          </tbody>
        </table>

        {/* Recommended Cover Summary */}
        <div className="mt-6">
          <h3 className="text-[10px] font-bold mb-2 uppercase">Recommended Cover Summary</h3>
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left">Risk Category</th>
                <th className="text-right">Recommended Cover</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Life Cover (Death)</strong></td>
                <td className="text-right font-bold">{formatCurrency(lifeCover?.finalRecommendedCover || 0)}</td>
              </tr>
              <tr>
                <td><strong>Lump Sum Disability Cover</strong></td>
                <td className="text-right font-bold">{formatCurrency(disabilityCover?.finalRecommendedCover || 0)}</td>
              </tr>
              <tr>
                <td><strong>Severe Illness Cover</strong></td>
                <td className="text-right font-bold">{formatCurrency(severeIllnessCover?.finalRecommendedCover || 0)}</td>
              </tr>
              <tr>
                <td><strong>Income Protection (Temporary)</strong></td>
                <td className="text-right font-bold">{formatCurrency(ipTemporary?.finalRecommendedCover || 0)}/month</td>
              </tr>
              <tr>
                <td><strong>Income Protection (Permanent)</strong></td>
                <td className="text-right font-bold">{formatCurrency(ipPermanent?.finalRecommendedCover || 0)}/month</td>
              </tr>
              <tr className="bg-gray-100">
                <td><strong>Total Lump Sum Cover</strong></td>
                <td className="text-right font-bold text-purple-700">{formatCurrency(totalLumpSumCover)}</td>
              </tr>
              <tr className="bg-gray-100">
                <td><strong>Total Monthly Income Protection (Permanent)</strong></td>
                <td className="text-right font-bold text-purple-700">{formatCurrency(permanentMonthlyIncome)}/month</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Key Assumptions Used in Analysis */}
      <section className="section">
        <div className="section-head">
          <span className="num">2.</span>
          <h2>Key Assumptions Used in Analysis</h2>
        </div>

        {/* Life Cover Assumptions */}
        {lifeCover && lifeCover.assumptions.length > 0 && (
          <div className="mb-4">
            <h3 className="text-[9.5px] font-bold mb-1 uppercase text-gray-700">Life Cover (Death)</h3>
            <ul className="text-[8.5px] leading-relaxed" style={{ margin: '0', paddingLeft: '15px' }}>
              {lifeCover.assumptions.map((assumption, idx) => (
                <li key={idx} style={{ marginBottom: '2px' }}>{assumption}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Disability Cover Assumptions */}
        {disabilityCover && disabilityCover.assumptions.length > 0 && (
          <div className="mb-4">
            <h3 className="text-[9.5px] font-bold mb-1 uppercase text-gray-700">Lump Sum Disability Cover</h3>
            <ul className="text-[8.5px] leading-relaxed" style={{ margin: '0', paddingLeft: '15px' }}>
              {disabilityCover.assumptions.map((assumption, idx) => (
                <li key={idx} style={{ marginBottom: '2px' }}>{assumption}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Severe Illness Assumptions */}
        {severeIllnessCover && severeIllnessCover.assumptions.length > 0 && (
          <div className="mb-4">
            <h3 className="text-[9.5px] font-bold mb-1 uppercase text-gray-700">Severe Illness Cover</h3>
            <ul className="text-[8.5px] leading-relaxed" style={{ margin: '0', paddingLeft: '15px' }}>
              {severeIllnessCover.assumptions.map((assumption, idx) => (
                <li key={idx} style={{ marginBottom: '2px' }}>{assumption}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Income Protection Assumptions */}
        {(ipTemporary || ipPermanent) && ipTemporary?.assumptions && ipTemporary.assumptions.length > 0 && (
          <div className="mb-4">
            <h3 className="text-[9.5px] font-bold mb-1 uppercase text-gray-700">Income Protection</h3>
            <ul className="text-[8.5px] leading-relaxed" style={{ margin: '0', paddingLeft: '15px' }}>
              {ipTemporary.assumptions.map((assumption, idx) => (
                <li key={idx} style={{ marginBottom: '2px' }}>{assumption}</li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );

  // ==================== PAGE 2: Life Cover Analysis ====================
  pages.push(
    <div key="page-2">
      <section className="section">
        <div className="section-head">
          <span className="num">3.</span>
          <h2>Life Cover (Death) Analysis</h2>
        </div>

        {lifeCover ? (
          <div className="contents">
            {/* Calculation Summary */}
            <table className="w-full mb-4">
              <tbody>
                <tr>
                  <th>Gross Need</th>
                  <td className="text-right">{formatCurrency(lifeCover.grossNeed)}</td>
                </tr>
                <tr>
                  <th>Existing Cover (Personal)</th>
                  <td className="text-right">{formatCurrency(lifeCover.existingCoverPersonal || 0)}</td>
                </tr>
                <tr>
                  <th>Existing Cover (Group)</th>
                  <td className="text-right">{formatCurrency(lifeCover.existingCoverGroup || 0)}</td>
                </tr>
                <tr>
                  <th><strong>Total Existing Cover</strong></th>
                  <td className="text-right font-bold">{formatCurrency(lifeCover.existingCoverTotal)}</td>
                </tr>
                {lifeCover.isOverinsured ? (
                  <tr className="bg-amber-50">
                    <th>Overinsured Amount</th>
                    <td className="text-right font-bold text-amber-700">{formatCurrency(lifeCover.overinsuredAmount)}</td>
                  </tr>
                ) : (
                  <tr>
                    <th>Shortfall</th>
                    <td className="text-right">{formatCurrency(lifeCover.netShortfall)}</td>
                  </tr>
                )}
                {lifeCover.advisorOverride && (
                  <tr className="bg-[#eef2ff]">
                    <th>Adviser Override Applied</th>
                    <td className="text-right font-bold text-purple-700">YES</td>
                  </tr>
                )}
                <tr className="bg-gray-100">
                  <th><strong>Final Recommended Cover</strong></th>
                  <td className="text-right font-bold text-purple-700">{formatCurrency(lifeCover.finalRecommendedCover)}</td>
                </tr>
              </tbody>
            </table>

            {/* Overinsurance Warning */}
            {lifeCover.isOverinsured && (
              <div className="callout mb-4 bg-amber-50 border-amber-200">
                <p className="text-[9px] font-bold mb-1 text-amber-900">OVERINSURED</p>
                <p className="text-[8.5px] m-0 text-amber-800">
                  The client's existing cover ({formatCurrency(lifeCover.existingCoverTotal)}) exceeds their calculated need ({formatCurrency(lifeCover.grossNeed)}) by {formatCurrency(lifeCover.overinsuredAmount)}. 
                  Consider reducing cover to avoid unnecessary premium expenditure.
                </p>
              </div>
            )}

            {/* Adviser Override Details */}
            {lifeCover.advisorOverride && (
              <div className="callout mb-4 bg-[#eef2ff] border-[#e0e7ff]">
                <p className="text-[9px] font-bold mb-1">ADVISER OVERRIDE APPLIED</p>
                <p className="text-[8.5px] m-0 mb-1"><strong>Reason:</strong> {lifeCover.advisorOverride.reason}</p>
                <p className="text-[8.5px] m-0 mb-1"><strong>Classification:</strong> {lifeCover.advisorOverride.classification}</p>
                <p className="text-[8.5px] m-0"><strong>Overridden by:</strong> {lifeCover.advisorOverride.overriddenBy} on {formatDate(lifeCover.advisorOverride.overriddenAt)}</p>
              </div>
            )}

            {/* Risk Notes */}
            <div className="mt-4">
              <h3 className="text-[9.5px] font-bold mb-1 uppercase">Risk Notes</h3>
              <ul className="text-[8.5px] leading-relaxed" style={{ margin: '0', paddingLeft: '15px' }}>
                {lifeCover.riskNotes && lifeCover.riskNotes.map((note, idx) => (
                  <li key={idx} style={{ marginBottom: '2px' }}>{note}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <p className="text-[9px] text-gray-600">No life cover data available.</p>
        )}
      </section>
    </div>
  );

  // ==================== PAGE 3: Disability Cover Analysis ====================
  pages.push(
    <div key="page-3">
      <section className="section">
        <div className="section-head">
          <span className="num">4.</span>
          <h2>Lump Sum Disability Cover Analysis</h2>
        </div>

        {disabilityCover ? (
          <div className="contents">
            {/* Calculation Summary */}
            <table className="w-full mb-4">
              <tbody>
                <tr>
                  <th>Gross Need</th>
                  <td className="text-right">{formatCurrency(disabilityCover.grossNeed)}</td>
                </tr>
                <tr>
                  <th>Existing Cover (Personal)</th>
                  <td className="text-right">{formatCurrency(disabilityCover.existingCoverPersonal || 0)}</td>
                </tr>
                <tr>
                  <th>Existing Cover (Group)</th>
                  <td className="text-right">{formatCurrency(disabilityCover.existingCoverGroup || 0)}</td>
                </tr>
                <tr>
                  <th><strong>Total Existing Cover</strong></th>
                  <td className="text-right font-bold">{formatCurrency(disabilityCover.existingCoverTotal)}</td>
                </tr>
                {disabilityCover.isOverinsured ? (
                  <tr className="bg-amber-50">
                    <th>Overinsured Amount</th>
                    <td className="text-right font-bold text-amber-700">{formatCurrency(disabilityCover.overinsuredAmount)}</td>
                  </tr>
                ) : (
                  <tr>
                    <th>Shortfall</th>
                    <td className="text-right">{formatCurrency(disabilityCover.netShortfall)}</td>
                  </tr>
                )}
                {disabilityCover.advisorOverride && (
                  <tr className="bg-[#eef2ff]">
                    <th>Adviser Override Applied</th>
                    <td className="text-right font-bold text-purple-700">YES</td>
                  </tr>
                )}
                <tr className="bg-gray-100">
                  <th><strong>Final Recommended Cover</strong></th>
                  <td className="text-right font-bold text-purple-700">{formatCurrency(disabilityCover.finalRecommendedCover)}</td>
                </tr>
              </tbody>
            </table>

            {/* Overinsurance Warning */}
            {disabilityCover.isOverinsured && (
              <div className="callout mb-4 bg-amber-50 border-amber-200">
                <p className="text-[9px] font-bold mb-1 text-amber-900">OVERINSURED</p>
                <p className="text-[8.5px] m-0 text-amber-800">
                  The client's existing cover ({formatCurrency(disabilityCover.existingCoverTotal)}) exceeds their calculated need ({formatCurrency(disabilityCover.grossNeed)}) by {formatCurrency(disabilityCover.overinsuredAmount)}. 
                  Consider reducing cover to avoid unnecessary premium expenditure.
                </p>
              </div>
            )}

            {/* Adviser Override Details */}
            {disabilityCover.advisorOverride && (
              <div className="callout mb-4 bg-[#eef2ff] border-[#e0e7ff]">
                <p className="text-[9px] font-bold mb-1">ADVISER OVERRIDE APPLIED</p>
                <p className="text-[8.5px] m-0 mb-1"><strong>Reason:</strong> {disabilityCover.advisorOverride.reason}</p>
                <p className="text-[8.5px] m-0 mb-1"><strong>Classification:</strong> {disabilityCover.advisorOverride.classification}</p>
                <p className="text-[8.5px] m-0"><strong>Overridden by:</strong> {disabilityCover.advisorOverride.overriddenBy} on {formatDate(disabilityCover.advisorOverride.overriddenAt)}</p>
              </div>
            )}

            {/* Risk Notes */}
            <div className="mt-4">
              <h3 className="text-[9.5px] font-bold mb-1 uppercase">Risk Notes</h3>
              <ul className="text-[8.5px] leading-relaxed" style={{ margin: '0', paddingLeft: '15px' }}>
                {disabilityCover.riskNotes && disabilityCover.riskNotes.map((note, idx) => (
                  <li key={idx} style={{ marginBottom: '2px' }}>{note}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <p className="text-[9px] text-gray-600">No disability cover data available.</p>
        )}
      </section>
    </div>
  );

  // ==================== PAGE 4: Severe Illness & Income Protection ====================
  pages.push(
    <div key="page-4">
      {/* Severe Illness Cover */}
      {severeIllnessCover && (
        <section className="section">
          <div className="section-head">
            <span className="num">5.</span>
            <h2>Severe Illness Cover Analysis</h2>
          </div>

          <table className="w-full mb-4">
            <tbody>
              <tr>
                <th>Gross Need</th>
                <td className="text-right">{formatCurrency(severeIllnessCover.grossNeed)}</td>
              </tr>
              <tr>
                <th>Existing Cover (Total)</th>
                <td className="text-right">{formatCurrency(severeIllnessCover.existingCoverTotal)}</td>
              </tr>
              <tr>
                <th>Net Shortfall</th>
                <td className="text-right">{formatCurrency(severeIllnessCover.netShortfall)}</td>
              </tr>
              <tr className="bg-gray-100">
                <th><strong>Final Recommended Cover</strong></th>
                <td className="text-right font-bold text-purple-700">{formatCurrency(severeIllnessCover.finalRecommendedCover)}</td>
              </tr>
            </tbody>
          </table>

          <div className="mt-3">
            <h3 className="text-[9.5px] font-bold mb-1 uppercase">Assumptions</h3>
            <ul className="text-[8.5px] leading-relaxed" style={{ margin: '0', paddingLeft: '15px' }}>
              {severeIllnessCover.assumptions.map((assumption, idx) => (
                <li key={idx} style={{ marginBottom: '2px' }}>{assumption}</li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Income Protection Summary */}
      {(ipTemporary || ipPermanent) && (
        <section className="section mt-6">
          <div className="section-head">
            <span className="num">6.</span>
            <h2>Income Protection Analysis</h2>
          </div>

          {ipTemporary && (
            <div className="mb-4">
              <h3 className="text-[9.5px] font-bold mb-2 uppercase">Temporary Income Protection</h3>
              <table className="w-full">
                <tbody>
                  <tr>
                    <th>Calculated Need</th>
                    <td className="text-right">{formatCurrency(ipTemporary.grossNeed)}/month</td>
                  </tr>
                  <tr>
                    <th>Existing Cover (Total)</th>
                    <td className="text-right">{formatCurrency(ipTemporary.existingCoverTotal)}/month</td>
                  </tr>
                  <tr className="bg-gray-100">
                    <th><strong>Recommended Cover</strong></th>
                    <td className="text-right font-bold text-purple-700">{formatCurrency(ipTemporary.finalRecommendedCover)}/month</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {ipPermanent && (
            <div>
              <h3 className="text-[9.5px] font-bold mb-2 uppercase">Permanent Income Protection</h3>
              <table className="w-full">
                <tbody>
                  <tr>
                    <th>Calculated Need</th>
                    <td className="text-right">{formatCurrency(ipPermanent.grossNeed)}/month</td>
                  </tr>
                  <tr>
                    <th>Existing Cover (Total)</th>
                    <td className="text-right">{formatCurrency(ipPermanent.existingCoverTotal)}/month</td>
                  </tr>
                  <tr className="bg-gray-100">
                    <th><strong>Recommended Cover</strong></th>
                    <td className="text-right font-bold text-purple-700">{formatCurrency(ipPermanent.finalRecommendedCover)}/month</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );

  // ==================== PAGE 5: Compliance & Disclaimers ====================
  pages.push(
    <div key="page-5">
      <section className="section">
        <div className="section-head">
          <span className="num">7.</span>
          <h2>FAIS Compliance Disclaimers</h2>
        </div>

        <div className="callout">
          <ul className="text-[8.5px] leading-relaxed" style={{ margin: '0', paddingLeft: '15px' }}>
            {COMPLIANCE_DISCLAIMERS.map((disclaimer, idx) => (
              <li key={idx} style={{ marginBottom: '4px' }}>{disclaimer}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section mt-6">
        <div className="section-head">
          <span className="num">8.</span>
          <h2>Document Information</h2>
        </div>

        <table className="w-full">
          <tbody>
            <tr>
              <th>Client ID</th>
              <td>{clientId || 'N/A'}</td>
            </tr>
            <tr>
              <th>Created</th>
              <td>{formatDate(calculations.metadata.calculatedAt)}</td>
            </tr>
            <tr>
              <th>System Version</th>
              <td>{calculations.metadata.systemVersion}</td>
            </tr>
            <tr>
              <th>Calculated By</th>
              <td>{calculations.metadata.calculatedBy}</td>
            </tr>
            <tr>
              <th>Calculation Date</th>
              <td>{formatDate(calculations.metadata.calculatedAt)}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );

  return (
    <BasePdfLayout
      pages={pages}
      docTitle="Risk Planning Financial Needs Analysis"
      issueDate={formatDate(calculations.metadata.calculatedAt)}
    />
  );
};