/**
 * PDFPortfolioReport
 * Renders a comprehensive, print-ready portfolio report for Navigate Wealth clients.
 *
 * This component is purely presentational (Guidelines §7) — it receives
 * pre-mapped ClientPortfolioData and renders an A4-sized document suitable
 * for browser print / "Save as PDF".
 *
 * Used by PortfolioReportModal (screen preview + hidden print clone).
 */

import React from 'react';
import type { ClientPortfolioData } from '../../../utils/pdfGenerator';

interface PDFPortfolioReportProps {
  clientData: ClientPortfolioData;
}

// ── Formatting helpers (self-contained for PDF isolation) ──

function fmtCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function fmtPremium(amount: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// ── Sub-components ──

function PageHeader({ clientData }: { clientData: ClientPortfolioData }) {
  return (
    <div className="flex items-center justify-between border-b-2 border-purple-700 pb-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-purple-800 leading-tight">
          Navigate Wealth
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Comprehensive Portfolio Report
        </p>
      </div>
      <div className="text-right text-sm text-gray-600">
        <p>Report Date: {clientData.reportDate}</p>
        <p>Client ID: {clientData.clientId}</p>
      </div>
    </div>
  );
}

function ClientSummarySection({ clientData }: { clientData: ClientPortfolioData }) {
  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-3 border-b border-gray-200 pb-1">
        Client Summary
      </h2>
      <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
        <div>
          <span className="text-gray-500">Name:</span>{' '}
          <span className="font-medium text-gray-900">{clientData.clientName}</span>
        </div>
        <div>
          <span className="text-gray-500">Email:</span>{' '}
          <span className="font-medium text-gray-900">{clientData.email}</span>
        </div>
        <div>
          <span className="text-gray-500">Age:</span>{' '}
          <span className="font-medium text-gray-900">{clientData.age}</span>
        </div>
        <div>
          <span className="text-gray-500">Phone:</span>{' '}
          <span className="font-medium text-gray-900">{clientData.phone}</span>
        </div>
      </div>
    </div>
  );
}

function AdviserSection({ clientData }: { clientData: ClientPortfolioData }) {
  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-3 border-b border-gray-200 pb-1">
        Your Financial Adviser
      </h2>
      <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
        <div>
          <span className="text-gray-500">Adviser:</span>{' '}
          <span className="font-medium text-gray-900">{clientData.adviserName}</span>
        </div>
        <div>
          <span className="text-gray-500">FSP Number:</span>{' '}
          <span className="font-medium text-gray-900">{clientData.adviserFSP}</span>
        </div>
        <div>
          <span className="text-gray-500">Email:</span>{' '}
          <span className="font-medium text-gray-900">{clientData.adviserEmail}</span>
        </div>
        <div>
          <span className="text-gray-500">Phone:</span>{' '}
          <span className="font-medium text-gray-900">{clientData.adviserPhone}</span>
        </div>
      </div>
    </div>
  );
}

function PortfolioOverviewSection({ clientData }: { clientData: ClientPortfolioData }) {
  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-3 border-b border-gray-200 pb-1">
        Portfolio Overview
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatBox label="Total Portfolio Value" value={fmtCurrency(clientData.portfolioValue)} accent="purple" />
        <StatBox label="Monthly Premiums" value={fmtPremium(clientData.monthlyPremiums)} accent="blue" />
        <StatBox label="Cashback Earned" value={fmtCurrency(clientData.cashbackValue)} accent="green" />
        <StatBox label="Projected Cashback" value={fmtCurrency(clientData.cashbackProjected)} accent="amber" />
      </div>
    </div>
  );
}

function StatBox({ label, value, accent }: { label: string; value: string; accent: string }) {
  const bgMap: Record<string, string> = {
    purple: 'bg-purple-50 border-purple-200',
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    amber: 'bg-amber-50 border-amber-200',
  };
  const textMap: Record<string, string> = {
    purple: 'text-purple-800',
    blue: 'text-blue-800',
    green: 'text-green-800',
    amber: 'text-amber-800',
  };

  return (
    <div className={`rounded-lg border p-3 ${bgMap[accent] || 'bg-gray-50 border-gray-200'}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-lg font-bold ${textMap[accent] || 'text-gray-800'}`}>{value}</p>
    </div>
  );
}

interface ProductTableProps {
  title: string;
  products: Array<{
    provider: string;
    product: string;
    policyNumber: string;
    value: number;
    premium: number;
    status: string;
  }>;
}

function ProductTable({ title, products }: ProductTableProps) {
  if (products.length === 0) return null;

  return (
    <div className="mb-6">
      <h3 className="text-base font-semibold text-gray-800 mb-2">{title}</h3>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100 border-b border-gray-300">
            <th className="text-left py-2 px-3 font-medium text-gray-700">Provider</th>
            <th className="text-left py-2 px-3 font-medium text-gray-700">Product</th>
            <th className="text-left py-2 px-3 font-medium text-gray-700">Policy No.</th>
            <th className="text-right py-2 px-3 font-medium text-gray-700">Value</th>
            <th className="text-right py-2 px-3 font-medium text-gray-700">Premium</th>
            <th className="text-center py-2 px-3 font-medium text-gray-700">Status</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p, idx) => (
            <tr key={`${p.policyNumber}-${idx}`} className="border-b border-gray-200">
              <td className="py-2 px-3 text-gray-900">{p.provider}</td>
              <td className="py-2 px-3 text-gray-900">{p.product}</td>
              <td className="py-2 px-3 text-gray-600 font-mono text-xs">{p.policyNumber}</td>
              <td className="py-2 px-3 text-right text-gray-900">{fmtCurrency(p.value)}</td>
              <td className="py-2 px-3 text-right text-gray-900">{fmtPremium(p.premium)}</td>
              <td className="py-2 px-3 text-center">
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                    p.status === 'Active'
                      ? 'bg-green-100 text-green-800'
                      : p.status === 'Lapsed'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {p.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProductHoldingsSection({ clientData }: { clientData: ClientPortfolioData }) {
  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-3 border-b border-gray-200 pb-1">
        Product Holdings
      </h2>
      <ProductTable title="Life Insurance" products={clientData.products.life} />
      <ProductTable title="Retirement Savings" products={clientData.products.retirement} />
      <ProductTable title="Investments" products={clientData.products.investment} />
      <ProductTable title="Medical Aid" products={clientData.products.medicalAid} />
      <ProductTable title="Short-Term Insurance" products={clientData.products.shortTerm} />
    </div>
  );
}

function InsightsSection({ clientData }: { clientData: ClientPortfolioData }) {
  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-3 border-b border-gray-200 pb-1">
        Portfolio Insights & Recommendations
      </h2>

      {clientData.aiInsights.strengths.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-green-800 mb-2 flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
            Strengths
          </h3>
          <ul className="list-disc list-inside text-sm text-gray-700 space-y-1 pl-1">
            {clientData.aiInsights.strengths.map((s, i) => (
              <li key={`str-${i}`}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {clientData.aiInsights.opportunities.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
            Opportunities
          </h3>
          <ul className="list-disc list-inside text-sm text-gray-700 space-y-1 pl-1">
            {clientData.aiInsights.opportunities.map((o, i) => (
              <li key={`opp-${i}`}>{o}</li>
            ))}
          </ul>
        </div>
      )}

      {clientData.aiInsights.recommendations.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
            Recommendations
          </h3>
          <ul className="list-disc list-inside text-sm text-gray-700 space-y-1 pl-1">
            {clientData.aiInsights.recommendations.map((r, i) => (
              <li key={`rec-${i}`}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PageFooter({ clientData }: { clientData: ClientPortfolioData }) {
  return (
    <div className="border-t border-gray-300 pt-4 mt-auto">
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>Navigate Wealth | Authorised Financial Services Provider</span>
        <span>Next Review: {clientData.nextReviewDate}</span>
      </div>
      <p className="text-[10px] text-gray-400 mt-2 leading-tight">
        This report is generated for informational purposes and does not constitute financial advice.
        Past performance is not indicative of future results. All values are as at the report date
        and may fluctuate. Please consult your financial adviser for personalised guidance.
      </p>
    </div>
  );
}

// ── Main Component ──

export function PDFPortfolioReport({ clientData }: PDFPortfolioReportProps) {
  return (
    <div className="contents">
      {/* Page 1: Client Summary + Portfolio Overview + Products */}
      <div
        className="pdf-page bg-white shadow-lg"
        style={{
          width: '210mm',
          minHeight: '297mm',
          padding: '20mm',
          boxSizing: 'border-box',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <PageHeader clientData={clientData} />
        <ClientSummarySection clientData={clientData} />
        <AdviserSection clientData={clientData} />
        <PortfolioOverviewSection clientData={clientData} />
        <ProductHoldingsSection clientData={clientData} />
        <div className="flex-1" />
        <PageFooter clientData={clientData} />
      </div>

      {/* Page 2: AI Insights & Recommendations */}
      <div
        className="pdf-page bg-white shadow-lg mt-8"
        style={{
          width: '210mm',
          minHeight: '297mm',
          padding: '20mm',
          boxSizing: 'border-box',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <PageHeader clientData={clientData} />
        <InsightsSection clientData={clientData} />
        <div className="flex-1" />
        <PageFooter clientData={clientData} />
      </div>
    </div>
  );
}