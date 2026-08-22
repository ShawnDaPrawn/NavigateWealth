/**
 * The catalogue of service modules the dashboard offers, and their categories.
 *
 * Split out of `ProductsServicesDashboardPage.tsx` (1,482 lines), which carried
 * the service catalogue, the per-service change options and every derivation
 * alongside a 950-line page.
 */
import React from 'react';
import {
  Shield,
  Heart,
  PiggyBank,
  TrendingUp,
  Briefcase,
  Calculator,
  FileText,
} from 'lucide-react';
import type { PortfolioFinancialOverview } from '../portfolio/api';
import type { QuoteServiceId } from '../quote/types';

export interface ServiceModule {
  id: QuoteServiceId;
  title: string;
  shortLabel: string;
  description: string;
  focusAreas: string[];
  icon: React.ElementType;
  color: string;
  bgColor: string;
  iconColor: string;
  path: string;
  category: 'Protection' | 'Health' | 'Wealth' | 'Business' | 'Advisory';
  /** Maps to productHoldings category bucket from the portfolio API */
  holdingCategory: string;
  /** Maps to financialOverview pillar key */
  pillarKey?: keyof PortfolioFinancialOverview;
}

// ── Service module definitions (static config — Guidelines §5.3) ─────────

export const SERVICE_MODULES: ServiceModule[] = [
  {
    id: 'risk-management',
    title: 'Risk Management',
    shortLabel: 'Risk',
    description: 'Life insurance, disability cover, and income protection strategies.',
    focusAreas: ['Life cover', 'Disability protection', 'Income protection'],
    icon: Shield,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    iconColor: 'text-blue-500',
    path: '/dashboard/risk-management',
    category: 'Protection',
    holdingCategory: 'life',
    pillarKey: 'risk',
  },
  {
    id: 'medical-aid',
    title: 'Medical Aid',
    shortLabel: 'Medical',
    description: 'Medical scheme comparisons, gap cover, and health benefits.',
    focusAreas: ['Scheme selection', 'Gap cover', 'Family healthcare benefits'],
    icon: Heart,
    color: 'text-rose-600',
    bgColor: 'bg-rose-50',
    iconColor: 'text-rose-500',
    path: '/dashboard/medical-aid',
    category: 'Health',
    holdingCategory: 'medicalAid',
    pillarKey: 'medicalAid',
  },
  {
    id: 'investment-management',
    title: 'Investment Management',
    shortLabel: 'Investments',
    description: 'Local and offshore investment portfolios and wealth creation.',
    focusAreas: ['Investment portfolios', 'Wealth creation', 'Long-term growth'],
    icon: TrendingUp,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    iconColor: 'text-emerald-500',
    path: '/dashboard/investment-management',
    category: 'Wealth',
    holdingCategory: 'investment',
    pillarKey: 'investment',
  },
  {
    id: 'retirement-planning',
    title: 'Retirement Planning',
    shortLabel: 'Retirement',
    description: 'Retirement annuities, pension funds, and preservation strategies.',
    focusAreas: ['Retirement annuities', 'Pension planning', 'Preservation strategies'],
    icon: PiggyBank,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    iconColor: 'text-amber-500',
    path: '/dashboard/retirement-planning',
    category: 'Wealth',
    holdingCategory: 'retirement',
    pillarKey: 'retirement',
  },
  {
    id: 'employee-benefits',
    title: 'Employee Benefits',
    shortLabel: 'Employee Benefits',
    description: 'Group risk schemes and employee wellness programs for businesses.',
    focusAreas: ['Group schemes', 'Wellness support', 'Business benefit planning'],
    icon: Briefcase,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    iconColor: 'text-purple-500',
    path: '/dashboard/employee-benefits',
    category: 'Business',
    holdingCategory: 'employeeBenefits',
  },
  {
    id: 'tax-planning',
    title: 'Tax Planning',
    shortLabel: 'Tax',
    description: 'Tax optimisation, compliance, and SARS submission services.',
    focusAreas: ['Tax optimisation', 'SARS submissions', 'Compliance support'],
    icon: Calculator,
    color: 'text-slate-600',
    bgColor: 'bg-slate-50',
    iconColor: 'text-slate-500',
    path: '/dashboard/tax-planning',
    category: 'Advisory',
    holdingCategory: 'tax',
    pillarKey: 'tax',
  },
  {
    id: 'estate-planning',
    title: 'Estate Planning',
    shortLabel: 'Estate',
    description: 'Wills, trusts, and estate duty planning for legacy protection.',
    focusAreas: ['Wills', 'Trust structures', 'Estate duty planning'],
    icon: FileText,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    iconColor: 'text-indigo-500',
    path: '/dashboard/estate-planning',
    category: 'Advisory',
    holdingCategory: 'estate',
    pillarKey: 'estate',
  },
];

export const CATEGORIES = [
  'All',
  'Protection',
  'Health',
  'Wealth',
  'Advisory',
  'Business',
] as const;

// ── Utility: derive service status from real data (Guidelines §7.1) ──────
