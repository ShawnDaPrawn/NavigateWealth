/**
 * Portfolio Summary — Utility Functions
 * Pure display helpers for the portfolio dashboard.
 * Guidelines §7.1 — derived display state in utility functions.
 */

import React from 'react';
import {
  Shield,
  Target,
  Users,
  Heart,
  Calculator,
  TrendingUp,
  Activity,
  FileText,
} from 'lucide-react';
import type { ClientPortfolioData } from '../../../utils/pdfGenerator';
import type { PortfolioSummary, ProductHolding } from './api';

// ═══════════════════════════════════════════════════════
// Formatting (en-ZA locale per Guidelines §8.3)
// ═══════════════════════════════════════════════════════

export function formatCurrency(amount: number): string {
  if (amount === undefined || amount === null || isNaN(amount)) return 'R0';
  const isNeg = amount < 0;
  const abs = Math.abs(amount);
  const intPart = Math.round(abs).toString();
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${isNeg ? '-' : ''}R${withCommas}`;
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return 'Not set';
  try {
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'Not set';
  }
}

// ═══════════════════════════════════════════════════════
// Status Derivation (Guidelines §7.1, §8.3 colour table)
// ═══════════════════════════════════════════════════════

/** Badge / background colour class for a pillar status string */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'on-track':
    case 'adequate':
    case 'performing':
    case 'active':
    case 'complete':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'review-needed':
    case 'underinsured':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'urgent':
    case 'overdue':
    case 'not-established':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

/** Priority border colour for recommendation cards */
export function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'high':
      return 'border-l-blue-500';
    case 'medium':
      return 'border-l-yellow-500';
    case 'urgent':
      return 'border-l-red-500';
    default:
      return 'border-l-gray-500';
  }
}

// ═══════════════════════════════════════════════════════
// Icon Resolution (Guidelines §8.4 — config-driven UI)
// ═══════════════════════════════════════════════════════

const RECOMMENDATION_ICON_MAP: Record<string, React.ElementType> = {
  shield: Shield,
  target: Target,
  users: Users,
  calculator: Calculator,
  heart: Heart,
  'trending-up': TrendingUp,
  activity: Activity,
};

/** Resolve a slug string to a Lucide icon component; FileText as fallback */
export function resolveRecommendationIcon(slug: string): React.ElementType {
  return RECOMMENDATION_ICON_MAP[slug] || FileText;
}

// ═══════════════════════════════════════════════════════
// Portfolio Report Data Mapper (Guidelines §7.1)
// Transforms real PortfolioSummary API data into the
// ClientPortfolioData shape expected by PDFPortfolioReport.
// ═══════════════════════════════════════════════════════

interface MapperContext {
  /** User's email from auth context */
  email: string;
  /** User's phone if available */
  phone?: string;
  /** User's age if known */
  age?: number;
}

/**
 * Group ProductHolding[] by category bucket into the products shape
 * expected by ClientPortfolioData.
 */
function groupHoldingsByCategory(
  holdings: ProductHolding[],
): ClientPortfolioData['products'] {
  const buckets: ClientPortfolioData['products'] = {
    life: [],
    retirement: [],
    investment: [],
    medicalAid: [],
    shortTerm: [],
  };

  for (const h of holdings) {
    const row = {
      provider: h.provider,
      product: h.product,
      policyNumber: h.policyNumber,
      value: h.value,
      premium: h.premium,
      status: h.status,
    };

    switch (h.category) {
      case 'life':
      case 'employeeBenefits':
        buckets.life.push(row);
        break;
      case 'retirement':
        buckets.retirement.push(row);
        break;
      case 'investment':
        buckets.investment.push(row);
        break;
      case 'medicalAid':
        buckets.medicalAid.push(row);
        break;
      case 'shortTerm':
        buckets.shortTerm.push(row);
        break;
      default:
        // estate, tax, other → life as a catch-all
        buckets.life.push(row);
        break;
    }
  }

  return buckets;
}

/**
 * Pure mapper: PortfolioSummary → ClientPortfolioData
 *
 * When the server returns real productHoldings, those are used directly
 * for the PDF product tables. Otherwise falls back to deriving rows
 * from pillar summary data.
 *
 * Adviser details come from the server's resolved adviserDetails field
 * rather than hard-coded platform defaults.
 */
export function mapPortfolioToReportData(
  summary: PortfolioSummary,
  ctx: MapperContext,
): ClientPortfolioData {
  const { clientData, financialOverview: fo, recommendations } = summary;

  const today = new Date();
  const nextReview = new Date(today);
  nextReview.setMonth(nextReview.getMonth() + 6);

  const fmtReportDate = (d: Date) =>
    d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  // ── Adviser details from server (resolved from personnel profile) ──
  const adviser = summary.adviserDetails ?? {
    name: 'Your Navigate Wealth Adviser',
    email: 'support@navigatewealth.co.za',
    phone: '+27 10 000 0000',
    fspReference: 'FSP 00000',
  };

  // ── Product Holdings ──
  // Prefer real policy data from the server; fall back to pillar-derived rows
  const serverHoldings = summary.productHoldings ?? [];
  const hasRealHoldings = serverHoldings.length > 0;

  let products: ClientPortfolioData['products'];
  let totalPremiums: number;
  let totalPortfolioValue: number;

  if (hasRealHoldings) {
    products = groupHoldingsByCategory(serverHoldings);
    // Compute totals from real holdings
    totalPremiums = serverHoldings.reduce((sum, h) => sum + h.premium, 0);
    totalPortfolioValue = serverHoldings.reduce((sum, h) => sum + h.value, 0);
  } else {
    // Fallback: derive placeholder rows from pillar data
    totalPremiums =
      fo.retirement.monthlyContribution +
      fo.investment.monthlyContribution +
      fo.medicalAid.monthlyPremium;

    totalPortfolioValue =
      fo.retirement.currentValue + fo.investment.totalValue;

    const retirementProducts =
      fo.retirement.currentValue > 0 || fo.retirement.monthlyContribution > 0
        ? [{
            provider: 'Retirement Fund',
            product: 'Retirement Annuity',
            policyNumber: `RET-${clientData.memberNumber}`,
            value: fo.retirement.currentValue,
            premium: fo.retirement.monthlyContribution,
            status: fo.retirement.status === 'on-track' ? 'Active' : 'Review Needed',
          }]
        : [];

    const investmentProducts =
      fo.investment.totalValue > 0 || fo.investment.monthlyContribution > 0
        ? [{
            provider: 'Investment Portfolio',
            product: fo.investment.performance !== 'N/A' ? `Performance: ${fo.investment.performance}` : 'Investment Portfolio',
            policyNumber: `INV-${clientData.memberNumber}`,
            value: fo.investment.totalValue,
            premium: fo.investment.monthlyContribution,
            status: fo.investment.status === 'on-track' ? 'Active' : 'Review Needed',
          }]
        : [];

    const lifeProducts =
      fo.risk.deathCover > 0
        ? [{
            provider: 'Risk Cover',
            product: 'Life & Disability Cover',
            policyNumber: `LIF-${clientData.memberNumber}`,
            value: fo.risk.deathCover,
            premium: 0,
            status: fo.risk.status === 'on-track' ? 'Active' : 'Review Needed',
          }]
        : [];

    const medicalProducts =
      fo.medicalAid.monthlyPremium > 0
        ? [{
            provider: fo.medicalAid.scheme,
            product: fo.medicalAid.plan,
            policyNumber: `MED-${clientData.memberNumber}`,
            value: 0,
            premium: fo.medicalAid.monthlyPremium,
            status: fo.medicalAid.status === 'on-track' ? 'Active' : 'Review Needed',
          }]
        : [];

    products = {
      life: lifeProducts,
      retirement: retirementProducts,
      investment: investmentProducts,
      medicalAid: medicalProducts,
      shortTerm: [],
    };
  }

  // ── Derive insights from pillar statuses and recommendations ──
  const strengths: string[] = [];
  const opportunities: string[] = [];
  const recs: string[] = [];

  // Build strengths from assessed pillars
  if (fo.retirement.status === 'on-track') {
    strengths.push('Retirement planning is on track with consistent contributions.');
  }
  if (fo.risk.status === 'on-track' && fo.risk.deathCover > 0) {
    strengths.push(`Adequate risk cover in place with ${formatCurrency(fo.risk.deathCover)} death benefit.`);
  }
  if (fo.investment.status === 'on-track') {
    strengths.push('Investment portfolio is performing within expected parameters.');
  }
  if (fo.medicalAid.status === 'on-track') {
    strengths.push(`Medical aid coverage active on ${fo.medicalAid.scheme} — ${fo.medicalAid.plan}.`);
  }
  if (fo.estate.status === 'on-track') {
    strengths.push('Estate planning documentation is up to date.');
  }
  if (fo.tax.status === 'on-track') {
    strengths.push('Tax affairs are in order.');
  }
  if (strengths.length === 0) {
    strengths.push('Your financial plan is being established. Completing assessments will strengthen your position.');
  }

  // Map API recommendations to insight categories
  for (const rec of recommendations) {
    if (rec.priority === 'urgent' || rec.priority === 'high') {
      opportunities.push(rec.description);
    }
    recs.push(`${rec.title}: ${rec.description}`);
  }

  // Add generic opportunities if pillars are unassessed
  if (fo.retirement.status === 'not-assessed') {
    opportunities.push('A retirement planning assessment would help establish long-term savings goals.');
  }
  if (fo.risk.status === 'not-assessed') {
    opportunities.push('Consider completing a risk needs analysis to ensure adequate cover for your family.');
  }
  if (fo.tax.status === 'not-assessed') {
    opportunities.push('A tax planning review could identify contribution optimisation opportunities.');
  }

  return {
    clientName: `${clientData.firstName} ${clientData.lastName}`.trim(),
    clientId: clientData.memberNumber || `NW-${Date.now().toString(36).toUpperCase()}`,
    age: ctx.age ?? 0,
    email: ctx.email,
    phone: ctx.phone ?? '',

    adviserName: adviser.name,
    adviserEmail: adviser.email,
    adviserPhone: adviser.phone,
    adviserFSP: adviser.fspReference,

    portfolioValue: totalPortfolioValue || clientData.totalWealthValue,
    monthlyPremiums: totalPremiums,
    cashbackValue: 0,
    cashbackProjected: 0,

    products,

    aiInsights: {
      strengths,
      opportunities,
      recommendations: recs,
    },

    reportDate: fmtReportDate(today),
    nextReviewDate: fmtReportDate(nextReview),
  };
}