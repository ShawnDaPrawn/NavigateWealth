import React from 'react';
import { BasePdfLayout } from '../templates/BasePdfLayout';
import { RetirementInputs, RetirementResults, ProjectionYear } from './types';

interface RetirementReportTemplateProps {
  inputs: RetirementInputs;
  results: RetirementResults;
  clientName: string;
  adviserName?: string;
  scenarioName?: string;
}

export const RetirementReportTemplate = ({
  inputs,
  results,
  clientName,
  adviserName = "Navigate Wealth Adviser",
  scenarioName = "Retirement Projection"
}: RetirementReportTemplateProps) => {
  
  const formatCurrency = (val: number) => {
    if (val === undefined || val === null || isNaN(val)) return 'R0';
    const isNeg = val < 0;
    const abs = Math.abs(val);
    const intPart = Math.round(abs).toString();
    const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${isNeg ? '-' : ''}R${withCommas}`;
  };
  
  const formatPercent = (val: number) => {
    return new Intl.NumberFormat('en-ZA', { style: 'percent', maximumFractionDigits: 2 }).format(val / 100);
  };

  const pages: React.ReactNode[] = [];

  // --- PAGE 1: SUMMARY ---
  pages.push(
    <div key="page-1">
      <section className="section">
        <div className="section-head">
          <span className="num">1.</span><h2>Scenario Overview</h2>
        </div>
        <div className="callout" style={{ marginBottom: '4mm' }}>
           <strong>{scenarioName}</strong> prepared for <strong>{clientName}</strong>. 
           This report projects retirement capital accumulation and sustainable income drawdown based on the inputs provided.
           All figures are {inputs.isNominal ? "Nominal (Future Values)" : "Real (Today's Money)"}.
        </div>
        
        <div className="grid grid-cols-2 gap-8">
            <div>
                <h3 className="text-[9.5px] font-bold uppercase text-gray-500 mb-2 border-b border-gray-200">Timeline</h3>
                <table className="w-full mb-4">
                    <tbody>
                        <tr><th>Current Age</th><td className="field">{inputs.currentAge}</td></tr>
                        <tr><th>Retirement Age</th><td className="field">{inputs.retirementAge}</td></tr>
                        <tr><th>Life Expectancy</th><td className="field">{inputs.lifeExpectancyAge}</td></tr>
                        <tr><th>Time Horizon</th><td className="field">{results.yearsToRetirement} years to retirement + {results.yearsInRetirement} years in retirement</td></tr>
                    </tbody>
                </table>
            </div>
            <div>
                <h3 className="text-[9.5px] font-bold uppercase text-gray-500 mb-2 border-b border-gray-200">Assumptions</h3>
                <table className="w-full mb-4">
                    <tbody>
                        <tr><th>Investment Return (Nominal)</th><td className="field">{formatPercent(inputs.nominalReturn)}</td></tr>
                        <tr><th>Inflation</th><td className="field">{formatPercent(inputs.inflation)}</td></tr>
                        <tr><th>Total Fees</th><td className="field">{formatPercent(inputs.annualFee)}</td></tr>
                        <tr><th>Net Real Return</th><td className="field font-bold">{formatPercent(results.netRealReturn)}</td></tr>
                    </tbody>
                </table>
            </div>
        </div>

        <h3 className="text-[9.5px] font-bold uppercase text-gray-500 mb-2 border-b border-gray-200">Financial Inputs</h3>
        <table className="w-full mb-6">
            <tbody>
                <tr>
                    <th>Current Savings</th>
                    <td className="field">{formatCurrency(inputs.currentSavings)}</td>
                    <th>Annual Contribution</th>
                    <td className="field">
                        {formatCurrency(inputs.contributionFrequency === 'monthly' ? inputs.contributionAmount * 12 : inputs.contributionAmount)}
                        <span className="text-[8px] text-gray-500 block">
                            (Growing at {formatPercent(inputs.contributionGrowthRate)} p.a.)
                        </span>
                    </td>
                </tr>
            </tbody>
        </table>
      </section>

      <section className="section">
        <div className="section-head">
            <span className="num">2.</span><h2>Key Results</h2>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="border border-green-200 bg-green-50/50 p-4 rounded-sm">
                <div className="text-[9px] uppercase text-green-800 font-bold mb-1">Projected Capital at Retirement (Age {inputs.retirementAge})</div>
                <div className="text-2xl font-bold text-green-700">{formatCurrency(results.totalCapital)}</div>
                <div className="mt-2 text-[8px] text-gray-600">
                    <div>Savings Growth: {formatCurrency(results.fvCurrentSavings)}</div>
                    <div>Contribution Growth: {formatCurrency(results.fvContributions)}</div>
                </div>
            </div>
            
            <div className="border border-blue-200 bg-blue-50/50 p-4 rounded-sm">
                <div className="text-[9px] uppercase text-blue-800 font-bold mb-1">Sustainable Monthly Income</div>
                <div className="text-2xl font-bold text-blue-700">{formatCurrency(results.sustainableIncomeMonthly)}</div>
                <div className="mt-2 text-[8px] text-gray-600">
                    <div>Annual Income: {formatCurrency(results.sustainableIncomeAnnual)}</div>
                    <div className="font-bold mt-1 text-blue-900">
                        Funds projected to last until Age: {results.fundsLastToAge}
                    </div>
                </div>
            </div>
        </div>
      </section>

       <section className="section">
        <div className="section-head">
            <span className="num">3.</span><h2>Snapshot</h2>
        </div>
        <table className="w-full">
            <thead>
                <tr>
                    <th>Phase</th>
                    <th>Age</th>
                    <th>Year</th>
                    <th className="text-right">Balance</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Start</td>
                    <td>{inputs.currentAge}</td>
                    <td>{new Date().getFullYear()}</td>
                    <td className="text-right">{formatCurrency(results.projectionData[0]?.openingBalance || 0)}</td>
                </tr>
                 <tr>
                    <td>Retirement</td>
                    <td>{inputs.retirementAge}</td>
                    <td>{new Date().getFullYear() + results.yearsToRetirement}</td>
                    <td className="text-right font-bold">{formatCurrency(results.totalCapital)}</td>
                </tr>
                <tr>
                    <td>End of Plan</td>
                    <td>{inputs.lifeExpectancyAge}</td>
                    <td>{new Date().getFullYear() + results.yearsToRetirement + results.yearsInRetirement}</td>
                    <td className="text-right">{formatCurrency(results.projectionData[results.projectionData.length - 1]?.closingBalance || 0)}</td>
                </tr>
            </tbody>
        </table>
       </section>
    </div>
  );

  // --- PAGE 2+: PROJECTION TABLE ---
  const ITEMS_PER_PAGE = 35;
  const data = results.projectionData;
  const totalRows = data.length;
  const tablePagesCount = Math.ceil(totalRows / ITEMS_PER_PAGE);

  for (let i = 0; i < tablePagesCount; i++) {
    const startIdx = i * ITEMS_PER_PAGE;
    const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, totalRows);
    const pageData = data.slice(startIdx, endIdx);

    pages.push(
      <div key={`page-proj-${i}`}>
         <section className="section">
            <div className="section-head">
                <span className="num">{i === 0 ? '4.' : ''}</span>
                <h2>Year-by-Year Projection {tablePagesCount > 1 ? `(${i+1}/${tablePagesCount})` : ''}</h2>
            </div>
            
            <table className="w-full text-[9px]">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="w-12">Age</th>
                        <th className="w-16">Year</th>
                        <th className="text-right">Opening Balance</th>
                        <th className="text-right">Cash Flow</th>
                        <th className="text-right">Growth</th>
                        <th className="text-right">Closing Balance</th>
                    </tr>
                </thead>
                <tbody>
                    {pageData.map((row, idx) => (
                        <tr key={idx} className={row.phase === 'drawdown' ? 'bg-orange-50/30' : ''}>
                            <td className="text-center">{row.age}</td>
                            <td className="text-center">{new Date().getFullYear() + row.year}</td>
                            <td className="text-right">{formatCurrency(row.openingBalance)}</td>
                            <td className={`text-right ${row.contributionsOrIncome < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {formatCurrency(row.contributionsOrIncome)}
                            </td>
                            <td className="text-right">{formatCurrency(row.growth)}</td>
                            <td className="text-right font-bold">{formatCurrency(row.closingBalance)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
         </section>
      </div>
    );
  }

  return (
    <BasePdfLayout
      docTitle="Retirement Plan"
      issueDate={new Date().toLocaleDateString()}
      pages={pages}
    />
  );
};