/**
 * Products & Services Dashboard Page
 * Client-facing page showing all financial service modules with real-time
 * policy counts and status derived from the portfolio API.
 *
 * Guidelines refs: §3.1 (dependency direction), §5.1 (API layer),
 * §7 (presentation), §8.3 (UI standards), §8.4 (AI builder)
 */

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import {
  Package,
  Shield,
  Heart,
  PiggyBank,
  TrendingUp,
  Briefcase,
  Calculator,
  FileText,
  Search,
  ChevronRight,
  Zap,
  LayoutGrid,
  List as ListIcon,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles,
  X,
} from 'lucide-react';
import { PortalPageHeader } from '../portal/PortalPageHeader';
import { ACTIVE_THEME } from '../portal/portal-theme';
import { usePortfolioSummary } from './portfolio/hooks';
import type { ProductHolding, PortfolioFinancialOverview } from './portfolio/api';

// ── Types ────────────────────────────────────────────────────────────────────

interface ServiceModule {
  id: string;
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

const SERVICE_MODULES: ServiceModule[] = [
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
  {
    id: 'employee-benefits',
    title: 'Employee Benefits',
    shortLabel: 'Benefits',
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
];

const CATEGORIES = ['All', 'Protection', 'Health', 'Wealth', 'Advisory', 'Business'] as const;

// ── Utility: derive service status from real data (Guidelines §7.1) ──────

type ServiceStatus = 'active' | 'assessed' | 'available';

interface DerivedServiceInfo {
  status: ServiceStatus;
  statusLabel: string;
  policyCount: number;
  statLabel: string;
  statValue: string;
}

interface ServiceGuidance {
  title: string;
  detail: string;
}

function deriveServiceInfo(
  module: ServiceModule,
  holdings: ProductHolding[],
  overview: PortfolioFinancialOverview | null,
): DerivedServiceInfo {
  // Count active (non-archived) policies in this category
  const categoryHoldings = holdings.filter(
    (h) => h.category === module.holdingCategory && h.status !== 'Archived',
  );
  const policyCount = categoryHoldings.length;

  // Check pillar assessment status
  const pillar = module.pillarKey && overview ? overview[module.pillarKey] : null;
  const isAssessed = pillar && pillar.status !== 'not-assessed';

  if (policyCount > 0) {
    return {
      status: 'active',
      statusLabel: 'Active',
      policyCount,
      statLabel: policyCount === 1 ? 'Policy' : 'Policies',
      statValue: `${policyCount} Active`,
    };
  }

  if (isAssessed) {
    return {
      status: 'assessed',
      statusLabel: 'Assessed',
      policyCount: 0,
      statLabel: 'Status',
      statValue: pillar?.statusText || 'Reviewed',
    };
  }

  return {
    status: 'available',
    statusLabel: 'Explore',
    policyCount: 0,
    statLabel: 'Status',
    statValue: 'Available',
  };
}

function getServiceGuidance(service: ServiceModule, derived: DerivedServiceInfo): ServiceGuidance {
  if (derived.status === 'active') {
    return {
      title: `You already have ${service.shortLabel.toLowerCase()} support in place`,
      detail:
        derived.policyCount === 1
          ? 'Open this area to review your current policy details, benefits, and next review points.'
          : 'Open this area to review your current products, benefits, and next review points.',
    };
  }

  if (derived.status === 'assessed') {
    return {
      title: `${service.shortLabel} has already been reviewed`,
      detail:
        'This area has assessment activity on file. Open it to continue the review or see the latest outcome.',
    };
  }

  return {
    title: `Explore ${service.shortLabel.toLowerCase()} with your adviser`,
    detail:
      'Start here to understand this area, see what is available, and decide whether you would like guidance or a recommendation.',
  };
}

// ── Status config (Guidelines §5.3, §8.3) ────────────────────────────────

const STATUS_CONFIG: Record<ServiceStatus, {
  badgeClass: string;
  dotClass: string;
  icon: React.ElementType;
}> = {
  active: {
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotClass: 'bg-emerald-500',
    icon: CheckCircle2,
  },
  assessed: {
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    dotClass: 'bg-blue-500',
    icon: Clock,
  },
  available: {
    badgeClass: 'bg-gray-50 text-gray-500 border-gray-200',
    dotClass: 'bg-gray-400',
    icon: AlertCircle,
  },
};

// ── Component ────────────────────────────────────────────────────────────────

export function ProductsServicesDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('risk-management');

  // ── Fetch real portfolio data ──
  const { data: portfolioData, isLoading } = usePortfolioSummary(user?.id);

  const holdings = portfolioData?.productHoldings ?? [];
  const overview = portfolioData?.financialOverview ?? null;

  // ── Derived module data ──
  const enrichedServices = useMemo(() => {
    return SERVICE_MODULES.map((mod) => ({
      ...mod,
      derived: deriveServiceInfo(mod, holdings, overview),
    }));
  }, [holdings, overview]);

  // ── Filter ──
  const filteredServices = useMemo(() => {
    return enrichedServices.filter((service) => {
      const matchesSearch =
        service.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        service.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategory === 'All' || service.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [enrichedServices, searchQuery, selectedCategory]);

  // ── Stats ──
  const stats = useMemo(() => {
    const activeCount = enrichedServices.filter((s) => s.derived.status === 'active').length;
    const totalPolicies = enrichedServices.reduce((sum, s) => sum + s.derived.policyCount, 0);
    return {
      total: enrichedServices.length,
      active: activeCount,
      available: enrichedServices.length - activeCount,
      totalPolicies,
    };
  }, [enrichedServices]);

  const selectedDesktopService = useMemo(() => {
    return (
      enrichedServices.find((service) => service.id === selectedServiceId) ??
      enrichedServices[0] ??
      null
    );
  }, [enrichedServices, selectedServiceId]);

  const selectedDesktopGuidance = useMemo(() => {
    if (!selectedDesktopService) return null;
    return getServiceGuidance(selectedDesktopService, selectedDesktopService.derived);
  }, [selectedDesktopService]);

  return (
    <div className={`min-h-screen ${ACTIVE_THEME === 'branded' ? 'bg-[#f8f9fb]' : 'bg-[rgb(249,249,249)]'}`}>
      {/* Branded Page Header */}
      <PortalPageHeader
        title="Products & Services"
        subtitle="Manage your financial portfolio and explore new solutions"
        icon={Package}
        compact
      />

      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="hidden lg:block space-y-5">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-3">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {enrichedServices.map((service) => {
                const isSelected = selectedDesktopService?.id === service.id;
                const statusCfg = STATUS_CONFIG[service.derived.status];
                return (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => setSelectedServiceId(service.id)}
                    className={`group min-w-[148px] rounded-xl border px-4 py-3 text-left transition-all ${
                      isSelected
                        ? 'border-purple-200 bg-purple-50 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${service.bgColor}`}>
                        <service.icon className={`h-5 w-5 ${service.iconColor}`} />
                      </div>
                      <span className={`mt-1 inline-flex h-2.5 w-2.5 rounded-full ${statusCfg.dotClass}`} />
                    </div>
                    <p className={`mt-3 text-sm font-semibold ${isSelected ? 'text-[#6d28d9]' : 'text-gray-900'}`}>
                      {service.shortLabel}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">{service.derived.statusLabel}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedDesktopService && selectedDesktopGuidance && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-7 py-7 border-b border-gray-100">
                <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className={`h-14 w-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${selectedDesktopService.bgColor}`}>
                      <selectedDesktopService.icon className={`h-7 w-7 ${selectedDesktopService.iconColor}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h2 className="text-2xl font-bold text-gray-900">
                          {selectedDesktopService.title}
                        </h2>
                        <Badge
                          variant="outline"
                          className={`text-[11px] px-2.5 py-1 font-medium border ${STATUS_CONFIG[selectedDesktopService.derived.status].badgeClass}`}
                        >
                          {selectedDesktopService.derived.statusLabel}
                        </Badge>
                      </div>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
                        {selectedDesktopService.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    <button
                      type="button"
                      onClick={() => navigate(selectedDesktopService.path)}
                      className="inline-flex items-center gap-2 rounded-lg bg-[#6d28d9] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#5b21b6]"
                    >
                      Open {selectedDesktopService.shortLabel}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/ai-advisor')}
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      <Sparkles className="h-4 w-4 text-[#6d28d9]" />
                      Ask Vasco
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/transactions-documents')}
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      <FileText className="h-4 w-4 text-gray-500" />
                      Documents
                    </button>
                  </div>
                </div>
              </div>

              <div className="px-7 py-6 space-y-6">
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                  <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      Current Position
                    </p>
                    <p className="mt-2 text-lg font-semibold text-gray-900">
                      {selectedDesktopService.derived.statValue}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-gray-500">
                      {selectedDesktopService.derived.policyCount > 0
                        ? `${selectedDesktopService.derived.policyCount} ${
                            selectedDesktopService.derived.policyCount === 1 ? 'product or policy is' : 'products or policies are'
                          } currently linked to this area.`
                        : 'No active product is currently linked to this area yet.'}
                    </p>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      Service Area
                    </p>
                    <p className="mt-2 text-lg font-semibold text-gray-900">
                      {selectedDesktopService.category}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-gray-500">
                      This section focuses on {selectedDesktopService.focusAreas[0].toLowerCase()},
                      {' '}{selectedDesktopService.focusAreas[1].toLowerCase()}, and
                      {' '}{selectedDesktopService.focusAreas[2].toLowerCase()}.
                    </p>
                  </div>

                  <div className="rounded-xl border border-purple-100 bg-purple-50/60 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-purple-500">
                      Best Next Step
                    </p>
                    <p className="mt-2 text-lg font-semibold text-gray-900">
                      {selectedDesktopGuidance.title}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-gray-600">
                      {selectedDesktopGuidance.detail}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-4">
                  <div className="rounded-xl border border-gray-200 p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Zap className="h-4 w-4 text-[#6d28d9]" />
                      <h3 className="text-sm font-semibold text-gray-900">
                        What This Area Covers
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {selectedDesktopService.focusAreas.map((area) => (
                        <div
                          key={area}
                          className="rounded-lg border border-gray-200 bg-gray-50/60 px-3 py-3"
                        >
                          <p className="text-sm font-medium text-gray-800">{area}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-200 p-5">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">
                      Helpful Actions
                    </h3>
                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={() => navigate(selectedDesktopService.path)}
                        className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-4 py-3 text-left transition-colors hover:bg-gray-50"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900">Open this service area</p>
                          <p className="text-xs text-gray-500 mt-0.5">View details, status, and next actions</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </button>

                      <button
                        type="button"
                        onClick={() => navigate('/ai-advisor')}
                        className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-4 py-3 text-left transition-colors hover:bg-gray-50"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900">Ask Vasco about this area</p>
                          <p className="text-xs text-gray-500 mt-0.5">Get simple guidance and explanations</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </button>

                      <button
                        type="button"
                        onClick={() => navigate('/communication')}
                        className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-4 py-3 text-left transition-colors hover:bg-gray-50"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900">Contact your adviser</p>
                          <p className="text-xs text-gray-500 mt-0.5">Message your team if you need help</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="lg:hidden">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">

          {/* ═══ LEFT SIDEBAR ═══ */}
          <div className="lg:col-span-1 space-y-5">

            {/* Portfolio Snapshot */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Portfolio Snapshot
                </h2>
              </div>
              <div className="p-5 space-y-3">
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
                        <div className="h-5 w-10 bg-gray-100 rounded animate-pulse" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="contents">
                    <div className="flex items-center justify-between py-1">
                      <span className="text-sm text-gray-600">Total Modules</span>
                      <span className="text-sm font-semibold text-gray-900 bg-gray-100 px-2.5 py-0.5 rounded-md">{stats.total}</span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-sm text-gray-600">Active Services</span>
                      <span className="text-sm font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md">{stats.active}</span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-sm text-gray-600">Total Policies</span>
                      <span className="text-sm font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md">{stats.totalPolicies}</span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-sm text-gray-600">Available</span>
                      <span className="text-sm font-medium text-gray-500 bg-gray-50 px-2.5 py-0.5 rounded-md">{stats.available}</span>
                    </div>
                  </div>
                )}

                <div className="pt-3 mt-1 border-t border-gray-100">
                  <button
                    className="w-full flex items-center justify-center gap-2 bg-[#6d28d9] hover:bg-[#5b21b6] text-white text-sm font-medium py-2.5 px-4 rounded-lg transition-colors shadow-sm"
                    onClick={() => navigate('/ai-advisor')}
                  >
                    <Sparkles className="h-4 w-4" />
                    Ask Vasco
                  </button>
                </div>
              </div>
            </div>

            {/* Category Navigation */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hidden lg:block">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Categories
                </h2>
              </div>
              <div className="p-3">
                <div className="space-y-0.5">
                  {CATEGORIES.map((cat) => {
                    const isSelected = selectedCategory === cat;
                    const count = cat === 'All'
                      ? enrichedServices.length
                      : enrichedServices.filter((s) => s.category === cat).length;

                    return (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`w-full text-left px-3 py-2.5 text-sm rounded-lg transition-all duration-150 flex items-center justify-between group ${
                          isSelected
                            ? 'bg-purple-50 text-[#6d28d9] font-medium'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                      >
                        <span>{cat}</span>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs ${isSelected ? 'text-purple-400' : 'text-gray-400'}`}>
                            {count}
                          </span>
                          {isSelected && <ChevronRight className="h-3.5 w-3.5" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* ═══ MAIN CONTENT ═══ */}
          <div className="lg:col-span-3 space-y-5">

            {/* Search & View Toggle */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col sm:flex-row gap-3 items-center">
              <div className="relative w-full sm:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search products & services..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-gray-50 border-gray-200 focus:bg-white transition-colors h-10"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Mobile categories */}
              <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto lg:hidden pb-1">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap border transition-colors ${
                      selectedCategory === cat
                        ? 'bg-purple-50 text-[#6d28d9] border-purple-200'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg border border-gray-200 ml-auto flex-shrink-0">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-md transition-all ${
                    viewMode === 'list'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  title="List View"
                >
                  <ListIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-md transition-all ${
                    viewMode === 'grid'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  title="Grid View"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Loading state */}
            {isLoading && (
              <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'space-y-3'}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse"
                  >
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-xl bg-gray-100 flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-5 w-40 bg-gray-100 rounded" />
                        <div className="h-4 w-64 bg-gray-50 rounded" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {!isLoading && filteredServices.length === 0 && (
              <div className="text-center py-16 bg-white rounded-xl border border-gray-200 border-dashed">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gray-50 mb-4">
                  <Search className="h-6 w-6 text-gray-400" />
                </div>
                <h3 className="text-base font-semibold text-gray-900">No services found</h3>
                <p className="text-sm text-gray-500 mt-1">Try adjusting your search or category filter</p>
                <button
                  onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }}
                  className="text-sm text-[#6d28d9] hover:text-[#5b21b6] font-medium mt-3 inline-block"
                >
                  Clear all filters
                </button>
              </div>
            )}

            {/* Services List / Grid */}
            {!isLoading && filteredServices.length > 0 && (
              <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'space-y-3'}>
                {filteredServices.map((service) => {
                  const { derived } = service;
                  const statusCfg = STATUS_CONFIG[derived.status];
                  const StatusIcon = statusCfg.icon;

                  if (viewMode === 'grid') {
                    return (
                      <button
                        key={service.id}
                        onClick={() => navigate(service.path)}
                        className="group bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200 text-left p-5 flex flex-col"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${service.bgColor}`}>
                            <service.icon className={`h-5 w-5 ${service.iconColor}`} />
                          </div>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-2 py-0.5 h-5 font-medium border ${statusCfg.badgeClass}`}
                          >
                            <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1 ${statusCfg.dotClass}`} />
                            {derived.statusLabel}
                          </Badge>
                        </div>

                        <h3 className="text-[15px] font-semibold text-gray-900 group-hover:text-[#6d28d9] transition-colors mb-1">
                          {service.title}
                        </h3>
                        <p className="text-sm text-gray-500 leading-relaxed mb-4 flex-1">
                          {service.description}
                        </p>

                        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                          {derived.policyCount > 0 ? (
                            <div className="flex items-center gap-1.5">
                              <StatusIcon className="h-3.5 w-3.5 text-emerald-500" />
                              <span className="text-xs font-medium text-gray-700">
                                {derived.statValue}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">{derived.statValue}</span>
                          )}
                          <div className="h-7 w-7 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-400 group-hover:border-[#6d28d9] group-hover:text-[#6d28d9] group-hover:bg-purple-50 transition-all">
                            <ArrowRight className="h-3.5 w-3.5" />
                          </div>
                        </div>
                      </button>
                    );
                  }

                  // List view
                  return (
                    <button
                      key={service.id}
                      onClick={() => navigate(service.path)}
                      className="group w-full bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200 text-left"
                    >
                      <div className="flex items-center p-5 gap-5">
                        {/* Icon */}
                        <div className={`h-12 w-12 rounded-xl flex-shrink-0 flex items-center justify-center ${service.bgColor} group-hover:scale-105 transition-transform duration-200`}>
                          <service.icon className={`h-5.5 w-5.5 ${service.iconColor}`} />
                        </div>

                        {/* Title & Description */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2.5 mb-0.5">
                            <h3 className="text-[15px] font-semibold text-gray-900 group-hover:text-[#6d28d9] transition-colors">
                              {service.title}
                            </h3>
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-2 py-0.5 h-5 font-medium border ${statusCfg.badgeClass} hidden sm:inline-flex`}
                            >
                              <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1 ${statusCfg.dotClass}`} />
                              {derived.statusLabel}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-500 leading-relaxed truncate sm:whitespace-normal">
                            {service.description}
                          </p>
                        </div>

                        {/* Stats */}
                        <div className="hidden md:flex flex-col items-end pl-4 border-l border-gray-100 min-w-[100px]">
                          <span className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">
                            {derived.statLabel}
                          </span>
                          <span className={`text-sm font-semibold mt-0.5 ${
                            derived.policyCount > 0 ? 'text-gray-900' : 'text-gray-400'
                          }`}>
                            {derived.statValue}
                          </span>
                        </div>

                        {/* Arrow */}
                        <div className="h-8 w-8 rounded-full bg-gray-50 border border-gray-200 flex-shrink-0 flex items-center justify-center text-gray-400 group-hover:border-[#6d28d9] group-hover:text-[#6d28d9] group-hover:bg-purple-50 transition-all">
                          <ArrowRight className="h-4 w-4" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

export default ProductsServicesDashboardPage;
