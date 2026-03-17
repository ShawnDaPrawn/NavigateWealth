/**
 * Per-Category Policy KPIs — Phase 3
 *
 * Displays compact KPI summary cards for each policy category
 * (Risk, Medical, Retirement, Investment, Employee Benefits, Estate).
 *
 * Each card shows:
 *   - Policy count
 *   - Total monthly premium
 *   - Category-specific headline metric (e.g., total life cover for Risk)
 *   - Mini sub-metrics
 *
 * Guidelines §7.1 — data prep done via pure derivation in the parent.
 * Guidelines §8.3 — consistent colour vocabulary per category.
 * Guidelines §8.4 — Design System components.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../ui/card';
import { Badge } from '../../../../../ui/badge';
import {
  Shield,
  Heart,
  PiggyBank,
  TrendingUp,
  Briefcase,
  Landmark,
  BarChart3,
} from 'lucide-react';
import type { DashboardMode } from '../ClientOverviewTab';

// ── Types ───────────────────────────────────────────────────────────────

export interface CategoryKPI {
  categoryId: string;
  label: string;
  policyCount: number;
  monthlyPremium: number;
  /** Primary headline metric value (formatted) */
  headlineValue: string;
  /** Primary headline metric label */
  headlineLabel: string;
  /** Additional sub-metrics */
  metrics: Array<{ label: string; value: string; highlight?: boolean }>;
}

// ── Constants ───────────────────────────────────────────────────────────

const ZAR = new Intl.NumberFormat('en-ZA', {
  style: 'currency',
  currency: 'ZAR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function fmtCurrency(v: number): string {
  return ZAR.format(v);
}

function fmtCompact(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `R ${(v / 1_000_000).toFixed(1)}m`;
  if (Math.abs(v) >= 1_000) return `R ${(v / 1_000).toFixed(0)}k`;
  return fmtCurrency(v);
}

const CATEGORY_ICON_MAP: Record<string, { icon: React.ElementType; colorClass: string; bgClass: string }> = {
  risk: { icon: Shield, colorClass: 'text-[#6d28d9]', bgClass: 'bg-[#6d28d9]/10' },
  medical: { icon: Heart, colorClass: 'text-red-500', bgClass: 'bg-red-50' },
  retirement: { icon: PiggyBank, colorClass: 'text-green-600', bgClass: 'bg-green-50' },
  investment: { icon: TrendingUp, colorClass: 'text-blue-600', bgClass: 'bg-blue-50' },
  employee: { icon: Briefcase, colorClass: 'text-purple-500', bgClass: 'bg-purple-50' },
  estate: { icon: Landmark, colorClass: 'text-gray-600', bgClass: 'bg-gray-100' },
};

// ── Component ───────────────────────────────────────────────────────────

interface CategoryPolicyKPIsProps {
  categories: CategoryKPI[];
  mode?: DashboardMode;
}

export function CategoryPolicyKPIs({
  categories,
  mode = 'adviser',
}: CategoryPolicyKPIsProps) {
  const isClient = mode === 'client';

  // Filter to only categories with policies or meaningful data
  const activeCats = categories.filter(c => c.policyCount > 0 || c.monthlyPremium > 0);

  if (activeCats.length === 0) {
    return null;
  }

  const totalPremium = activeCats.reduce((s, c) => s + c.monthlyPremium, 0);
  const totalPolicies = activeCats.reduce((s, c) => s + c.policyCount, 0);

  return (
    <Card className="border border-gray-200 rounded-lg bg-white shadow-sm">
      <CardHeader className="px-5 py-3.5 bg-gray-50/40 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center h-7 w-7 rounded-md bg-[#6d28d9]/10 flex-shrink-0">
            <BarChart3 className="h-3.5 w-3.5 text-[#6d28d9]" />
          </div>
          <CardTitle className="text-sm font-semibold text-gray-800 !leading-none">
            {isClient ? 'My Coverage by Category' : 'Policy KPIs by Category'}
          </CardTitle>
          <div className="flex items-center gap-2 ml-auto">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-gray-200 text-gray-500">
              {totalPolicies} {totalPolicies === 1 ? 'policy' : 'policies'}
            </Badge>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-gray-200 text-gray-500">
              {fmtCompact(totalPremium)}/m
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 pb-3 px-5">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {activeCats.map((cat) => (
            <CategoryKPICard key={cat.categoryId} category={cat} mode={mode} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Category KPI Card ───────────────────────────────────────────────────

function CategoryKPICard({
  category,
  mode = 'adviser',
}: {
  category: CategoryKPI;
  mode?: DashboardMode;
}) {
  const iconCfg = CATEGORY_ICON_MAP[category.categoryId] || {
    icon: Briefcase,
    colorClass: 'text-gray-500',
    bgClass: 'bg-gray-100',
  };
  const CatIcon = iconCfg.icon;

  return (
    <div className="border border-gray-200 rounded-lg p-3.5 hover:shadow-sm transition-shadow">
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-3">
        <div className={`flex items-center justify-center h-8 w-8 rounded-lg ${iconCfg.bgClass} flex-shrink-0`}>
          <CatIcon className={`h-4 w-4 ${iconCfg.colorClass}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-800 truncate">{category.label}</p>
          <p className="text-[10px] text-gray-400">
            {category.policyCount} {category.policyCount === 1 ? 'policy' : 'policies'}
            {category.monthlyPremium > 0 && ` · ${fmtCompact(category.monthlyPremium)}/m`}
          </p>
        </div>
      </div>

      {/* Headline metric */}
      <div className="mb-2.5">
        <p className="text-base font-bold text-gray-900 leading-tight">{category.headlineValue}</p>
        <p className="text-[10px] text-gray-500 mt-0.5">{category.headlineLabel}</p>
      </div>

      {/* Sub-metrics */}
      {category.metrics.length > 0 && (
        <div className="space-y-1 border-t border-gray-100 pt-2">
          {category.metrics.map((metric) => (
            <div key={metric.label} className="flex items-center justify-between">
              <span className="text-[10px] text-gray-500">{metric.label}</span>
              <span className={`text-[10px] font-medium ${
                metric.highlight ? 'text-amber-600' : 'text-gray-700'
              }`}>
                {metric.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Data derivation utility ─────────────────────────────────────────────

/**
 * Derives per-category policy KPIs from policy data.
 * Pure function — Guidelines §7.1.
 */
export function deriveCategoryKPIs({
  riskPolicies,
  medicalPolicies,
  retirementPolicies,
  investmentPolicies,
  employeePolicies,
  estatePolicies,
  sumField,
  dependantCount,
}: {
  riskPolicies: Array<{ id: string; data: Record<string, unknown> }>;
  medicalPolicies: Array<{ id: string; data: Record<string, unknown> }>;
  retirementPolicies: Array<{ id: string; data: Record<string, unknown> }>;
  investmentPolicies: Array<{ id: string; data: Record<string, unknown> }>;
  employeePolicies: Array<{ id: string; data: Record<string, unknown> }>;
  estatePolicies: Array<{ id: string; data: Record<string, unknown> }>;
  sumField: (pols: Array<{ data: Record<string, unknown> }>, field: string) => number;
  dependantCount: number;
}): CategoryKPI[] {
  const fmt = (n: number): string => {
    if (n === 0) return 'R 0';
    return `R ${n.toLocaleString('en-ZA')}`;
  };

  const categories: CategoryKPI[] = [];

  // Risk
  if (riskPolicies.length > 0) {
    const totalLifeCover = sumField(riskPolicies, 'risk_life_cover');
    const totalDisability = sumField(riskPolicies, 'risk_disability');
    const totalSevereIllness = sumField(riskPolicies, 'risk_severe_illness');
    const totalPremium = sumField(riskPolicies, 'risk_monthly_premium');

    categories.push({
      categoryId: 'risk',
      label: 'Risk Planning',
      policyCount: riskPolicies.length,
      monthlyPremium: totalPremium,
      headlineValue: fmt(totalLifeCover),
      headlineLabel: 'Total Life Cover',
      metrics: [
        { label: 'Disability Cover', value: totalDisability > 0 ? fmt(totalDisability) : 'None', highlight: totalDisability === 0 },
        { label: 'Severe Illness', value: totalSevereIllness > 0 ? fmt(totalSevereIllness) : 'None', highlight: totalSevereIllness === 0 },
      ],
    });
  }

  // Medical
  if (medicalPolicies.length > 0) {
    const totalPremium = sumField(medicalPolicies, 'medical_aid_monthly_premium');

    categories.push({
      categoryId: 'medical',
      label: 'Medical Aid',
      policyCount: medicalPolicies.length,
      monthlyPremium: totalPremium,
      headlineValue: `${medicalPolicies.length} Plan${medicalPolicies.length > 1 ? 's' : ''}`,
      headlineLabel: 'Active Medical Coverage',
      metrics: [
        { label: 'Dependants Covered', value: `${dependantCount}` },
        { label: 'Monthly Premium', value: totalPremium > 0 ? `${fmt(totalPremium)}/m` : '-' },
      ],
    });
  }

  // Retirement
  if (retirementPolicies.length > 0) {
    const currentValue = sumField(retirementPolicies, 'retirement_fund_value');
    const totalPremium = sumField(retirementPolicies, 'retirement_monthly_contribution');

    categories.push({
      categoryId: 'retirement',
      label: 'Retirement',
      policyCount: retirementPolicies.length,
      monthlyPremium: totalPremium,
      headlineValue: fmt(currentValue),
      headlineLabel: 'Portfolio Value',
      metrics: [
        { label: 'Monthly Contribution', value: totalPremium > 0 ? `${fmt(totalPremium)}/m` : '-' },
        { label: 'Fund Count', value: `${retirementPolicies.length}` },
      ],
    });
  }

  // Investment
  if (investmentPolicies.length > 0) {
    const currentValue = sumField(investmentPolicies, 'invest_current_value');
    // Apply lump-sum guard: when a policy's "Premium" field equals or exceeds
    // its "Current Value", the value represents the initial lump-sum investment
    // rather than a recurring monthly contribution (common AI extraction artefact).
    const totalPremium = investmentPolicies.reduce((s, pol) => {
      const rawNum = (key: string): number => {
        const v = pol.data?.[key];
        if (v === undefined || v === null || v === '') return 0;
        const n = Number(v);
        return isNaN(n) ? 0 : n;
      };
      const contribution = rawNum('invest_monthly_contribution');
      if (contribution <= 0) return s;
      const polValue = rawNum('invest_current_value');
      if (polValue > 0 && contribution >= polValue) return s;
      return s + contribution;
    }, 0);

    categories.push({
      categoryId: 'investment',
      label: 'Investments',
      policyCount: investmentPolicies.length,
      monthlyPremium: totalPremium,
      headlineValue: fmt(currentValue),
      headlineLabel: 'Portfolio Value',
      metrics: [
        { label: 'Monthly Contribution', value: totalPremium > 0 ? `${fmt(totalPremium)}/m` : '-' },
        { label: 'Portfolios', value: `${investmentPolicies.length}` },
      ],
    });
  }

  // Employee Benefits
  if (employeePolicies.length > 0) {
    const totalPremium = sumField(employeePolicies, 'eb_monthly_premium');

    categories.push({
      categoryId: 'employee',
      label: 'Employee Benefits',
      policyCount: employeePolicies.length,
      monthlyPremium: totalPremium,
      headlineValue: `${employeePolicies.length} Benefit${employeePolicies.length > 1 ? 's' : ''}`,
      headlineLabel: 'Active Benefits',
      metrics: [
        { label: 'Monthly Premium', value: totalPremium > 0 ? `${fmt(totalPremium)}/m` : '-' },
      ],
    });
  }

  // Estate Planning
  if (estatePolicies.length > 0) {
    categories.push({
      categoryId: 'estate',
      label: 'Estate Planning',
      policyCount: estatePolicies.length,
      monthlyPremium: 0,
      headlineValue: 'In Place',
      headlineLabel: 'Estate Plan Status',
      metrics: [
        { label: 'Documents', value: `${estatePolicies.length}` },
      ],
    });
  }

  return categories;
}