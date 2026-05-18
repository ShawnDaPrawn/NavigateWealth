/**
 * Products & Services Dashboard Page
 * Client-facing page showing all financial service modules with real-time
 * policy counts and status derived from the portfolio API.
 *
 * Guidelines refs: §3.1 (dependency direction), §5.1 (API layer),
 * §7 (presentation), §8.3 (UI standards), §8.4 (AI builder)
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Textarea } from '../ui/textarea';
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
  LayoutGrid,
  List as ListIcon,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles,
  ClipboardList,
  Loader2,
  MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { ConsultationModal } from '../modals/ConsultationModal';
import { PortalPageHeader } from '../portal/PortalPageHeader';
import { PortalQuoteFlowModal } from '../portal/PortalQuoteFlowModal';
import { ACTIVE_THEME } from '../portal/portal-theme';
import { usePortfolioSummary } from './portfolio/hooks';
import type { ProductHolding, PortfolioFinancialOverview } from './portfolio/api';
import { formatCurrency } from './portfolio/utils';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import type { QuoteServiceId } from './quote/types';

// ── Types ────────────────────────────────────────────────────────────────────

interface ServiceModule {
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

interface ChangeOption {
  id: string;
  label: string;
  description: string;
}

const SUBMISSIONS_API = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/submissions`;

const CHANGE_OPTIONS_BY_SERVICE: Record<ServiceModule['id'], ChangeOption[]> = {
  'risk-management': [
    { id: 'beneficiary_change', label: 'Beneficiary change', description: 'Update or replace the nominated beneficiary on this policy.' },
    { id: 'debit_order_date_change', label: 'Debit order date change', description: 'Request a new debit order collection date.' },
    { id: 'bank_account_change', label: 'Bank account change', description: 'Change the bank account linked to this premium collection.' },
    { id: 'cover_review', label: 'Cover review', description: 'Ask us to review whether this cover still matches your needs.' },
  ],
  'medical-aid': [
    { id: 'plan_change', label: 'Plan option change', description: 'Request help changing the medical aid plan option.' },
    { id: 'dependant_update', label: 'Dependant update', description: 'Add or remove a dependant on this plan.' },
    { id: 'bank_account_change', label: 'Bank account change', description: 'Change the bank account used for monthly collections.' },
    { id: 'membership_update', label: 'Membership detail change', description: 'Update contact or membership details linked to this plan.' },
  ],
  'investment-management': [
    { id: 'contribution_change', label: 'Contribution change', description: 'Increase, reduce, or pause regular contributions.' },
    { id: 'bank_account_change', label: 'Bank account change', description: 'Update the bank account used for recurring investments.' },
    { id: 'withdrawal_request', label: 'Withdrawal request', description: 'Ask for help with a withdrawal or access request.' },
    { id: 'switch_instruction', label: 'Switch instruction', description: 'Request a review or switch instruction on this investment.' },
  ],
  'retirement-planning': [
    { id: 'contribution_change', label: 'Contribution change', description: 'Adjust the monthly contribution on this retirement plan.' },
    { id: 'beneficiary_change', label: 'Beneficiary change', description: 'Update the beneficiary details attached to this plan.' },
    { id: 'bank_account_change', label: 'Bank account change', description: 'Change the bank account used for contributions.' },
    { id: 'retirement_review', label: 'Retirement review', description: 'Request a review of this retirement policy or fund.' },
  ],
  'tax-planning': [
    { id: 'document_request', label: 'Document request', description: 'Request tax documents or supporting records for this service.' },
    { id: 'submission_support', label: 'Submission support', description: 'Ask for help with a tax filing or submission-related change.' },
    { id: 'detail_update', label: 'Detail update', description: 'Update the information we should use for this tax service.' },
  ],
  'estate-planning': [
    { id: 'beneficiary_change', label: 'Beneficiary change', description: 'Request a beneficiary-related update connected to this planning area.' },
    { id: 'document_update', label: 'Document update', description: 'Ask us to update or review a will, trust, or estate document.' },
    { id: 'planning_review', label: 'Planning review', description: 'Request an estate planning review meeting for this arrangement.' },
  ],
  'employee-benefits': [
    { id: 'member_update', label: 'Member detail change', description: 'Update employee or membership information on this benefit plan.' },
    { id: 'beneficiary_change', label: 'Beneficiary change', description: 'Update the nominated beneficiary for this benefit.' },
    { id: 'bank_account_change', label: 'Bank account change', description: 'Update the banking details linked to this arrangement.' },
    { id: 'benefit_review', label: 'Benefit review', description: 'Request a review of the benefits or cover attached to this plan.' },
  ],
};

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

function getCoverageValueLabel(holding: ProductHolding): string {
  if (holding.value > 0) return formatCurrency(holding.value);
  if (holding.premium > 0) return formatCurrency(holding.premium);
  return 'On file';
}

function holdingStatusClass(status: string): string {
  const lower = status.toLowerCase();
  if (lower === 'active') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (lower === 'lapsed' || lower === 'cancelled') return 'bg-red-50 text-red-700 border-red-200';
  if (lower === 'archived') return 'bg-gray-50 text-gray-600 border-gray-200';
  if (lower.includes('review') || lower.includes('progress')) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-blue-50 text-blue-700 border-blue-200';
}

function getChangeOptionsForHolding(
  service: ServiceModule,
  holding: ProductHolding | null,
): ChangeOption[] {
  const defaults = CHANGE_OPTIONS_BY_SERVICE[service.id] ?? [];
  if (!holding) return defaults;

  const productText = `${holding.provider} ${holding.product}`.toLowerCase();

  if (service.id === 'medical-aid' && productText.includes('gap')) {
    return [
      { id: 'bank_account_change', label: 'Bank account change', description: 'Change the bank account used for this gap cover premium.' },
      { id: 'benefit_review', label: 'Benefit review', description: 'Request a review of the benefit structure on this gap cover plan.' },
      { id: 'membership_update', label: 'Membership detail change', description: 'Update the member details linked to this gap cover policy.' },
    ];
  }

  if (service.id === 'investment-management' && productText.includes('offshore')) {
    return [
      { id: 'contribution_change', label: 'Contribution change', description: 'Adjust the ongoing contribution into this offshore investment.' },
      { id: 'switch_instruction', label: 'Switch instruction', description: 'Request guidance on switching or rebalancing this offshore investment.' },
      { id: 'withdrawal_request', label: 'Withdrawal request', description: 'Ask for help with a withdrawal or access request on this investment.' },
    ];
  }

  return defaults;
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
  const [consultationOpen, setConsultationOpen] = useState(false);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [selectedQuoteService, setSelectedQuoteService] = useState<QuoteServiceId | null>(null);
  const [changeDialogOpen, setChangeDialogOpen] = useState(false);
  const [selectedHoldingId, setSelectedHoldingId] = useState<string>('');
  const [selectedChangeType, setSelectedChangeType] = useState<string>('');
  const [changeRequestNotes, setChangeRequestNotes] = useState('');
  const [submittingChangeRequest, setSubmittingChangeRequest] = useState(false);

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

  const selectedServiceHoldings = useMemo(() => {
    if (!selectedDesktopService) return [];
    return holdings.filter(
      (holding) =>
        holding.category === selectedDesktopService.holdingCategory &&
        holding.status !== 'Archived',
    );
  }, [holdings, selectedDesktopService]);

  const selectedHolding = useMemo(
    () => selectedServiceHoldings.find((holding) => holding.id === selectedHoldingId) ?? null,
    [selectedHoldingId, selectedServiceHoldings],
  );

  const availableChangeOptions = useMemo(() => {
    if (!selectedDesktopService) return [];
    return getChangeOptionsForHolding(selectedDesktopService, selectedHolding);
  }, [selectedDesktopService, selectedHolding]);

  useEffect(() => {
    if (!changeDialogOpen) return;
    if (selectedServiceHoldings.length === 0) {
      setSelectedHoldingId('');
      setSelectedChangeType('');
      return;
    }

    const stillValid = selectedServiceHoldings.some((holding) => holding.id === selectedHoldingId);
    if (!stillValid) {
      setSelectedHoldingId(selectedServiceHoldings[0].id);
    }
  }, [changeDialogOpen, selectedHoldingId, selectedServiceHoldings]);

  useEffect(() => {
    if (!changeDialogOpen) return;
    if (availableChangeOptions.length === 0) {
      setSelectedChangeType('');
      return;
    }

    const hasSelectedType = availableChangeOptions.some((option) => option.id === selectedChangeType);
    if (!hasSelectedType) {
      setSelectedChangeType(availableChangeOptions[0].id);
    }
  }, [availableChangeOptions, changeDialogOpen, selectedChangeType]);

  const clientDisplayName = useMemo(() => {
    const firstName = portfolioData?.clientData?.firstName?.trim();
    const lastName = portfolioData?.clientData?.lastName?.trim();
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
    return fullName || user?.email || 'Navigate Wealth Client';
  }, [portfolioData?.clientData?.firstName, portfolioData?.clientData?.lastName, user?.email]);

  const openQuoteModal = (serviceId: QuoteServiceId) => {
    setSelectedQuoteService(serviceId);
    setQuoteModalOpen(true);
  };

  const openChangeDialog = () => {
    if (selectedServiceHoldings.length === 0) return;
    setChangeDialogOpen(true);
  };

  const resetChangeRequestForm = () => {
    setChangeDialogOpen(false);
    setSelectedHoldingId('');
    setSelectedChangeType('');
    setChangeRequestNotes('');
    setSubmittingChangeRequest(false);
  };

  const submitChangeRequest = async () => {
    if (!selectedDesktopService || !selectedHolding) {
      toast.error('Select a plan before submitting a change request.');
      return;
    }

    const selectedOption = availableChangeOptions.find((option) => option.id === selectedChangeType);
    if (!selectedOption) {
      toast.error('Choose the type of change you would like to request.');
      return;
    }

    setSubmittingChangeRequest(true);

    try {
      const response = await fetch(SUBMISSIONS_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({
          type: 'change_request',
          sourceChannel: 'client_portal',
          submitterName: clientDisplayName,
          submitterEmail: user?.email,
          payload: {
            clientId: user?.id,
            clientName: clientDisplayName,
            service: selectedDesktopService.id,
            serviceLabel: selectedDesktopService.title,
            provider: selectedHolding.provider,
            productName: selectedHolding.product,
            policyNumber: selectedHolding.policyNumber,
            holdingId: selectedHolding.id,
            currentStatus: selectedHolding.status,
            changeType: selectedOption.id,
            changeTypeLabel: selectedOption.label,
            changeSummary: selectedOption.description,
            additionalNotes: changeRequestNotes.trim(),
            submittedFrom: 'products-services-dashboard',
          },
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Unable to submit your change request right now.');
      }

      toast.success('Your change request has been sent to our team.');
      resetChangeRequestForm();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to submit your change request right now.';
      toast.error(message);
      setSubmittingChangeRequest(false);
    }
  };

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
          <div className="inline-flex max-w-full rounded-2xl border border-gray-200 bg-white p-2.5 shadow-sm">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {enrichedServices.map((service) => {
                const isSelected = selectedDesktopService?.id === service.id;
                return (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => setSelectedServiceId(service.id)}
                    className={`group min-w-[118px] rounded-xl border px-3 py-2.5 text-left transition-all ${
                      isSelected
                        ? 'border-purple-200 bg-purple-50 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${service.bgColor}`}>
                      <service.icon className={`h-4.5 w-4.5 ${service.iconColor}`} />
                    </div>
                    <p className={`mt-2.5 text-sm font-semibold ${isSelected ? 'text-[#6d28d9]' : 'text-gray-900'}`}>
                      {service.shortLabel}
                    </p>
                    <p className="mt-0.5 text-[11px] text-gray-500">{service.derived.statusLabel}</p>
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
                        {selectedServiceHoldings.length > 0
                          ? `Here are the policies and plan details we currently hold for ${selectedDesktopService.title.toLowerCase()}.`
                          : selectedDesktopService.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    <Button
                      type="button"
                      onClick={() => openQuoteModal(selectedDesktopService.id)}
                      className="inline-flex items-center gap-2 rounded-lg bg-[#6d28d9] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#5b21b6]"
                    >
                      Get a Quote
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setConsultationOpen(true)}
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      <MessageSquare className="h-4 w-4 text-[#6d28d9]" />
                      Speak to Adviser
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={openChangeDialog}
                      disabled={selectedServiceHoldings.length === 0}
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ClipboardList className="h-4 w-4 text-gray-500" />
                      Make a Change
                    </Button>
                  </div>
                </div>
              </div>

              <div className="px-7 py-6 space-y-6">
                {selectedServiceHoldings.length > 0 ? (
                  <>
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                      <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                          Policies In This Area
                        </p>
                        <p className="mt-2 text-lg font-semibold text-gray-900">
                          {selectedServiceHoldings.length}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-gray-500">
                          {selectedServiceHoldings.length === 1
                            ? '1 active plan is linked to this service area.'
                            : `${selectedServiceHoldings.length} active plans are linked to this service area.`}
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
                          This tab focuses on {selectedDesktopService.focusAreas[0].toLowerCase()},
                          {' '}{selectedDesktopService.focusAreas[1].toLowerCase()}, and
                          {' '}{selectedDesktopService.focusAreas[2].toLowerCase()}.
                        </p>
                      </div>

                      <div className="rounded-xl border border-purple-100 bg-purple-50/60 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-purple-500">
                          Next Best Action
                        </p>
                        <p className="mt-2 text-lg font-semibold text-gray-900">
                          {selectedDesktopGuidance.title}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-gray-600">
                          {selectedDesktopGuidance.detail}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-gray-200 overflow-hidden">
                      <div className="flex items-center justify-between gap-4 border-b border-gray-100 bg-gray-50/70 px-5 py-4">
                        <div>
                          <h3 className="text-base font-semibold text-gray-900">
                            Policy Schedule
                          </h3>
                          <p className="mt-1 text-sm text-gray-500">
                            Review your current plans, status, and key policy details in this area.
                          </p>
                        </div>
                      </div>

                      <Table>
                        <TableHeader>
                          <TableRow className="bg-white">
                            <TableHead className="text-xs font-medium text-gray-600">Provider</TableHead>
                            <TableHead className="text-xs font-medium text-gray-600">Plan</TableHead>
                            <TableHead className="text-xs font-medium text-gray-600">Policy No.</TableHead>
                            <TableHead className="text-xs font-medium text-gray-600 text-right">Cover / Value</TableHead>
                            <TableHead className="text-xs font-medium text-gray-600 text-right">Monthly Premium</TableHead>
                            <TableHead className="text-xs font-medium text-gray-600 text-center">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedServiceHoldings.map((holding) => (
                            <TableRow key={holding.id}>
                              <TableCell className="text-sm font-medium text-gray-900">
                                {holding.provider}
                              </TableCell>
                              <TableCell className="text-sm text-gray-700">
                                {holding.product}
                              </TableCell>
                              <TableCell className="font-mono text-xs text-gray-500">
                                {holding.policyNumber || 'On file'}
                              </TableCell>
                              <TableCell className="text-right text-sm text-gray-900">
                                {getCoverageValueLabel(holding)}
                              </TableCell>
                              <TableCell className="text-right text-sm text-gray-900">
                                {holding.premium > 0 ? formatCurrency(holding.premium) : 'On file'}
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge
                                  variant="outline"
                                  className={`text-[11px] px-2.5 py-1 font-medium border ${holdingStatusClass(holding.status)}`}
                                >
                                  {holding.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50/50 px-8 py-12 text-center">
                    <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${selectedDesktopService.bgColor}`}>
                      <selectedDesktopService.icon className={`h-7 w-7 ${selectedDesktopService.iconColor}`} />
                    </div>
                    <h3 className="mt-5 text-xl font-semibold text-gray-900">
                      No policies in {selectedDesktopService.shortLabel.toLowerCase()} yet
                    </h3>
                    <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-gray-500">
                      {selectedDesktopGuidance.detail}
                    </p>
                    <div className="mt-6 flex flex-wrap justify-center gap-3">
                      <Button
                        type="button"
                        onClick={() => openQuoteModal(selectedDesktopService.id)}
                        className="bg-[#6d28d9] text-white hover:bg-[#5b21b6]"
                      >
                        Get a Quote
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setConsultationOpen(true)}
                      >
                        Speak to Adviser
                      </Button>
                    </div>
                  </div>
                )}
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

      <ConsultationModal open={consultationOpen} onOpenChange={setConsultationOpen} />

      <PortalQuoteFlowModal
        isOpen={quoteModalOpen}
        onClose={() => setQuoteModalOpen(false)}
        serviceId={selectedQuoteService}
        user={user}
      />

      <Dialog
        open={changeDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            resetChangeRequestForm();
            return;
          }
          setChangeDialogOpen(true);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Make a change</DialogTitle>
            <DialogDescription>
              Choose the plan you want to update, then tell us what should change. We will send it straight to our submissions inbox for follow-up.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="change-plan">Select a plan</Label>
              <Select value={selectedHoldingId} onValueChange={setSelectedHoldingId}>
                <SelectTrigger id="change-plan">
                  <SelectValue placeholder="Choose a plan" />
                </SelectTrigger>
                <SelectContent>
                  {selectedServiceHoldings.map((holding) => (
                    <SelectItem key={holding.id} value={holding.id}>
                      {holding.provider} — {holding.product}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedHolding && (
                <p className="text-xs text-gray-500">
                  Policy number: {selectedHolding.policyNumber || 'On file'}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="change-type">What would you like changed?</Label>
              <Select value={selectedChangeType} onValueChange={setSelectedChangeType}>
                <SelectTrigger id="change-type">
                  <SelectValue placeholder="Choose a request type" />
                </SelectTrigger>
                <SelectContent>
                  {availableChangeOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedChangeType && (
                <p className="text-xs text-gray-500">
                  {availableChangeOptions.find((option) => option.id === selectedChangeType)?.description}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="change-notes">Anything else we should know?</Label>
              <Textarea
                id="change-notes"
                value={changeRequestNotes}
                onChange={(event) => setChangeRequestNotes(event.target.value)}
                placeholder="Add any extra detail that will help your adviser or administrator action this request."
                rows={5}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={resetChangeRequestForm}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={submitChangeRequest}
              disabled={!selectedHoldingId || !selectedChangeType || submittingChangeRequest}
              className="bg-[#6d28d9] text-white hover:bg-[#5b21b6]"
            >
              {submittingChangeRequest ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending request
                </>
              ) : (
                'Submit change request'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ProductsServicesDashboardPage;
