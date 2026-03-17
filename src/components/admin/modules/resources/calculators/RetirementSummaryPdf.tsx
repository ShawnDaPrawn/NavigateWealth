import React from 'react';
import { BasePdfLayout } from '../templates/BasePdfLayout';
import { RetirementInputs, RetirementResults } from './types';

interface RetirementSummaryPdfProps {
  inputs: RetirementInputs;
  results: RetirementResults;
  clientName: string;
}

export const RetirementSummaryPdf = ({ inputs, results, clientName }: RetirementSummaryPdfProps) => {
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

  // Split projection data into pages (approx 25 rows per page for table)
  const rowsPerPage = 25;
  const projectionPages = [];
  for (let i = 0; i < results.projectionData.length; i += rowsPerPage) {
    projectionPages.push(results.projectionData.slice(i, i + rowsPerPage));
  }

  const pages = [
    // Page 1: Executive Summary
    <div className="space-y-6">
      <div className="section">
        <div className="section-head">
          <span className="num">01</span>
          <h2>Executive Summary</h2>
        </div>
        <div className="text-[9.5px] leading-relaxed text-justify text-gray-600 mb-4">
          This retirement planning analysis projects your future capital accumulation and sustainable income based on your current inputs and assumptions. 
          The values shown are in {inputs.isNominal ? "Nominal terms (future value including inflation)" : "Real terms (today's buying power)"}.
        </div>

        <div className="grid grid-cols-2 gap-8">
          <div className="bg-gray-50/50 p-4 border border-gray-200 rounded-sm">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-blue-800 mb-3 border-b border-blue-100 pb-1">Retirement Goal</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-baseline">
                <span className="text-[9px] text-gray-500 uppercase">Target Retirement Age</span>
                <span className="text-[11px] font-bold text-gray-900">{inputs.retirementAge}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-[9px] text-gray-500 uppercase">Years to Retirement</span>
                <span className="text-[11px] font-bold text-gray-900">{results.yearsToRetirement}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-[9px] text-gray-500 uppercase">Planning Horizon</span>
                <span className="text-[11px] font-bold text-gray-900">Age {inputs.lifeExpectancyAge}</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-50/50 p-4 border border-gray-200 rounded-sm">
             <h3 className="text-[10px] font-bold uppercase tracking-wider text-green-800 mb-3 border-b border-green-100 pb-1">Projected Outcome</h3>
             <div className="space-y-2">
              <div className="flex justify-between items-baseline">
                <span className="text-[9px] text-gray-500 uppercase">Total Capital at Retirement</span>
                <span className="text-[11px] font-bold text-green-700">{formatCurrency(results.totalCapital)}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-[9px] text-gray-500 uppercase">Sustainable Monthly Income</span>
                <span className="text-[11px] font-bold text-green-700">{formatCurrency(results.sustainableIncomeMonthly)}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-[9px] text-gray-500 uppercase">Funds Sustainable Until</span>
                <span className="text-[11px] font-bold text-gray-900">Age {results.fundsLastToAge}</span>
              </div>
             </div>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-head">
          <span className="num">02</span>
          <h2>Input Parameters</h2>
        </div>
        
        <div className="grid grid-cols-3 gap-6">
           <div>
              <div className="text-[9px] font-bold text-gray-700 mb-2 bg-gray-50 p-1">Current Position</div>
              <div className="space-y-1">
                 <div className="flex justify-between border-b border-gray-100 pb-1">
                    <span className="text-[9px] text-gray-500">Current Age</span>
                    <span className="text-[9px] font-medium">{inputs.currentAge}</span>
                 </div>
                 <div className="flex justify-between border-b border-gray-100 pb-1">
                    <span className="text-[9px] text-gray-500">Current Savings</span>
                    <span className="text-[9px] font-medium">{formatCurrency(inputs.currentSavings)}</span>
                 </div>
                 <div className="flex justify-between border-b border-gray-100 pb-1">
                    <span className="text-[9px] text-gray-500">Contribution</span>
                    <span className="text-[9px] font-medium">{formatCurrency(inputs.contributionAmount)} ({inputs.contributionFrequency})</span>
                 </div>
              </div>
           </div>

           <div>
              <div className="text-[9px] font-bold text-gray-700 mb-2 bg-gray-50 p-1">Market Assumptions</div>
              <div className="space-y-1">
                 <div className="flex justify-between border-b border-gray-100 pb-1">
                    <span className="text-[9px] text-gray-500">Nominal Return</span>
                    <span className="text-[9px] font-medium">{formatPercent(inputs.nominalReturn)}</span>
                 </div>
                 <div className="flex justify-between border-b border-gray-100 pb-1">
                    <span className="text-[9px] text-gray-500">Inflation</span>
                    <span className="text-[9px] font-medium">{formatPercent(inputs.inflation)}</span>
                 </div>
                 <div className="flex justify-between border-b border-gray-100 pb-1">
                    <span className="text-[9px] text-gray-500">Fees</span>
                    <span className="text-[9px] font-medium">{formatPercent(inputs.annualFee)}</span>
                 </div>
              </div>
           </div>

           <div>
              <div className="text-[9px] font-bold text-gray-700 mb-2 bg-gray-50 p-1">Calculated Rates (Real)</div>
              <div className="space-y-1">
                 <div className="flex justify-between border-b border-gray-100 pb-1">
                    <span className="text-[9px] text-gray-500">Real Return (Gross)</span>
                    <span className="text-[9px] font-medium">{formatPercent(results.realReturn)}</span>
                 </div>
                 <div className="flex justify-between border-b border-gray-100 pb-1">
                    <span className="text-[9px] text-gray-500">Real Return (Net)</span>
                    <span className="text-[9px] font-medium">{formatPercent(results.netRealReturn)}</span>
                 </div>
              </div>
           </div>
        </div>
      </div>

      <div className="section">
         <div className="section-head">
          <span className="num">03</span>
          <h2>Capital Composition at Retirement</h2>
        </div>
        
        <table className="w-full text-[9.5px] border-collapse mt-2">
            <thead>
                <tr className="bg-gray-50">
                    <th className="border border-gray-200 px-2 py-1 text-left w-1/2">Source</th>
                    <th className="border border-gray-200 px-2 py-1 text-right">Projected Value</th>
                    <th className="border border-gray-200 px-2 py-1 text-right">% of Total</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td className="border border-gray-200 px-2 py-1">Existing Capital Growth</td>
                    <td className="border border-gray-200 px-2 py-1 text-right">{formatCurrency(results.fvCurrentSavings)}</td>
                    <td className="border border-gray-200 px-2 py-1 text-right">{formatPercent((results.fvCurrentSavings / results.totalCapital) * 100)}</td>
                </tr>
                <tr>
                    <td className="border border-gray-200 px-2 py-1">Future Contributions Growth</td>
                    <td className="border border-gray-200 px-2 py-1 text-right">{formatCurrency(results.fvContributions)}</td>
                    <td className="border border-gray-200 px-2 py-1 text-right">{formatPercent((results.fvContributions / results.totalCapital) * 100)}</td>
                </tr>
                <tr className="bg-gray-100 font-bold">
                    <td className="border border-gray-200 px-2 py-1">Total Capital at Age {inputs.retirementAge}</td>
                    <td className="border border-gray-200 px-2 py-1 text-right">{formatCurrency(results.totalCapital)}</td>
                    <td className="border border-gray-200 px-2 py-1 text-right">100%</td>
                </tr>
            </tbody>
        </table>
      </div>
      
       <div className="mt-8 border-t border-gray-200 pt-4">
         <div className="text-[8px] text-gray-500 italic text-justify">
            Disclaimer: This calculation is for illustrative purposes only and does not constitute financial advice. The projections are based on the assumptions provided and actual results may vary. Inflation and market returns are unpredictable.
         </div>
       </div>
    </div>,

    // Page 2+: Detailed Projection Table
    ...projectionPages.map((pageRows, pageIndex) => (
       <div className="space-y-4" key={`page-${pageIndex}`}>
          <div className="section-head">
            <span className="num">{String(pageIndex + 4).padStart(2, '0')}</span>
            <h2>Year-by-Year Projection {projectionPages.length > 1 ? `(Part ${pageIndex + 1})` : ''}</h2>
          </div>
          
          <table className="w-full text-[9px] border-collapse">
             <thead>
                <tr className="bg-gray-100">
                   <th className="border border-gray-200 px-2 py-1 text-center w-12">Age</th>
                   <th className="border border-gray-200 px-2 py-1 text-center w-12">Year</th>
                   <th className="border border-gray-200 px-2 py-1 text-right">Opening Balance</th>
                   <th className="border border-gray-200 px-2 py-1 text-right">Cash Flow</th>
                   <th className="border border-gray-200 px-2 py-1 text-right">Growth</th>
                   <th className="border border-gray-200 px-2 py-1 text-right">Closing Balance</th>
                   <th className="border border-gray-200 px-2 py-1 text-center w-20">Phase</th>
                </tr>
             </thead>
             <tbody>
                {pageRows.map((row, i) => (
                   <tr key={i} className={row.phase === 'drawdown' ? 'bg-orange-50/30' : ''}>
                      <td className="border border-gray-200 px-2 py-1 text-center font-medium">{row.age}</td>
                      <td className="border border-gray-200 px-2 py-1 text-center text-gray-500">{new Date().getFullYear() + row.year}</td>
                      <td className="border border-gray-200 px-2 py-1 text-right">{formatCurrency(row.openingBalance)}</td>
                      <td className={`border border-gray-200 px-2 py-1 text-right ${row.contributionsOrIncome < 0 ? 'text-red-600' : 'text-green-600'}`}>
                         {formatCurrency(row.contributionsOrIncome)}
                      </td>
                      <td className="border border-gray-200 px-2 py-1 text-right text-gray-500">{formatCurrency(row.growth)}</td>
                      <td className="border border-gray-200 px-2 py-1 text-right font-medium">{formatCurrency(row.closingBalance)}</td>
                      <td className="border border-gray-200 px-2 py-1 text-center text-[8px] uppercase tracking-wide">
                        {row.phase}
                      </td>
                   </tr>
                ))}
             </tbody>
          </table>
       </div>
    ))
  ];

  return (
    <BasePdfLayout 
       docTitle={`Retirement Plan - ${clientName}`}
       issueDate={new Date().toLocaleDateString()}
       pages={pages}
    />
  );
};