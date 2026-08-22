/**
 * Products & Services Dashboard Page
 * Client-facing page showing all financial service modules with real-time
 * policy counts and status derived from the portfolio API.
 *
 * Guidelines refs: §3.1 (dependency direction), §5.1 (API layer),
 * §7 (presentation), §8.3 (UI standards), §8.4 (AI builder)
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Textarea } from '../ui/textarea';
import {
  Package,
  Search,
  ChevronRight,
  LayoutGrid,
  List as ListIcon,
  ArrowRight,
  Sparkles,
  ClipboardList,
  Loader2,
  MessageSquare,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { ConsultationModal } from '../modals/ConsultationModal';
import { PortalPageHeader } from '../portal/PortalPageHeader';
import { PortalQuoteFlowModal } from '../portal/PortalQuoteFlowModal';
import { ServiceFnaPanel } from '../portal/ServiceFnaPanel';
import {
  getFnaTitleForService,
  quoteServiceIdToFnaDomain,
} from '@/shared/fna-intake/service-fna-mapping';
import { usePortfolioSummary } from './portfolio/hooks';
import { formatCurrency } from './portfolio/utils';
import { publicAnonKey } from '../../utils/supabase/info';
import type { QuoteServiceId } from './quote/types';
import { SUBMISSIONS_API } from './productsServices/changeOptions';
import {
  STATUS_CONFIG,
  deriveServiceInfo,
  getChangeOptionsForHolding,
  getCoverageValueLabel,
  getServiceGuidance,
  holdingStatusClass,
} from './productsServices/serviceDerivation';
import { CATEGORIES, SERVICE_MODULES } from './productsServices/serviceModules';

export function ProductsServicesDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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

  const holdings = useMemo(
    () => portfolioData?.productHoldings ?? [],
    [portfolioData?.productHoldings],
  );
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
      const matchesCategory = selectedCategory === 'All' || service.category === selectedCategory;
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

  const selectedFnaDomain = useMemo(() => {
    if (!selectedDesktopService) return undefined;
    return quoteServiceIdToFnaDomain(selectedDesktopService.id);
  }, [selectedDesktopService]);

  const selectedFnaTitle = useMemo(() => {
    if (!selectedDesktopService) return undefined;
    return getFnaTitleForService(selectedDesktopService.id);
  }, [selectedDesktopService]);

  useEffect(() => {
    const serviceParam = searchParams.get('service');
    if (!serviceParam) return;
    const isValid = enrichedServices.some((service) => service.id === serviceParam);
    if (isValid) {
      setSelectedServiceId(serviceParam);
    }
  }, [searchParams, enrichedServices]);

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

    const hasSelectedType = availableChangeOptions.some(
      (option) => option.id === selectedChangeType,
    );
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

    const selectedOption = availableChangeOptions.find(
      (option) => option.id === selectedChangeType,
    );
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
      const message =
        error instanceof Error ? error.message : 'Unable to submit your change request right now.';
      toast.error(message);
      setSubmittingChangeRequest(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
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
                    className={`group min-w-[148px] rounded-xl border px-3 py-2.5 text-left transition-all ${
                      isSelected
                        ? 'border-purple-200 bg-purple-50 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div
                      className={`h-9 w-9 rounded-xl flex items-center justify-center ${service.bgColor}`}
                    >
                      <service.icon className={`h-4.5 w-4.5 ${service.iconColor}`} />
                    </div>
                    <p
                      className={`mt-2.5 text-sm font-semibold ${isSelected ? 'text-[#6d28d9]' : 'text-gray-900'}`}
                    >
                      {service.shortLabel}
                    </p>
                    <p className="mt-0.5 text-[11px] text-gray-500">
                      {service.derived.statusLabel}
                    </p>
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
                    <div
                      className={`h-14 w-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${selectedDesktopService.bgColor}`}
                    >
                      <selectedDesktopService.icon
                        className={`h-7 w-7 ${selectedDesktopService.iconColor}`}
                      />
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
                {selectedFnaDomain && selectedFnaTitle && user?.id && (
                  <ServiceFnaPanel
                    clientId={user.id}
                    fnaType={selectedFnaDomain}
                    title={selectedFnaTitle}
                    description={`Complete your ${selectedDesktopService.shortLabel.toLowerCase()} needs discovery or view your published analysis.`}
                  />
                )}

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
                          This tab focuses on {selectedDesktopService.focusAreas[0].toLowerCase()},{' '}
                          {selectedDesktopService.focusAreas[1].toLowerCase()}, and{' '}
                          {selectedDesktopService.focusAreas[2].toLowerCase()}.
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
                          <h3 className="text-base font-semibold text-gray-900">Policy Schedule</h3>
                          <p className="mt-1 text-sm text-gray-500">
                            Review your current plans, status, and key policy details in this area.
                          </p>
                        </div>
                      </div>

                      <Table>
                        <TableHeader>
                          <TableRow className="bg-white">
                            <TableHead className="text-xs font-medium text-gray-600">
                              Provider
                            </TableHead>
                            <TableHead className="text-xs font-medium text-gray-600">
                              Plan
                            </TableHead>
                            <TableHead className="text-xs font-medium text-gray-600">
                              Policy No.
                            </TableHead>
                            <TableHead className="text-xs font-medium text-gray-600 text-right">
                              Cover / Value
                            </TableHead>
                            <TableHead className="text-xs font-medium text-gray-600 text-right">
                              Monthly Premium
                            </TableHead>
                            <TableHead className="text-xs font-medium text-gray-600 text-center">
                              Status
                            </TableHead>
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
                    <div
                      className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${selectedDesktopService.bgColor}`}
                    >
                      <selectedDesktopService.icon
                        className={`h-7 w-7 ${selectedDesktopService.iconColor}`}
                      />
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
                        <span className="text-sm font-semibold text-gray-900 bg-gray-100 px-2.5 py-0.5 rounded-md">
                          {stats.total}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span className="text-sm text-gray-600">Active Services</span>
                        <span className="text-sm font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md">
                          {stats.active}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span className="text-sm text-gray-600">Total Policies</span>
                        <span className="text-sm font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md">
                          {stats.totalPolicies}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span className="text-sm text-gray-600">Available</span>
                        <span className="text-sm font-medium text-gray-500 bg-gray-50 px-2.5 py-0.5 rounded-md">
                          {stats.available}
                        </span>
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
                      const count =
                        cat === 'All'
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
                            <span
                              className={`text-xs ${isSelected ? 'text-purple-400' : 'text-gray-400'}`}
                            >
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
                <div
                  className={
                    viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'space-y-3'
                  }
                >
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
                  <p className="text-sm text-gray-500 mt-1">
                    Try adjusting your search or category filter
                  </p>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('All');
                    }}
                    className="text-sm text-[#6d28d9] hover:text-[#5b21b6] font-medium mt-3 inline-block"
                  >
                    Clear all filters
                  </button>
                </div>
              )}

              {/* Services List / Grid */}
              {!isLoading && filteredServices.length > 0 && (
                <div
                  className={
                    viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'space-y-3'
                  }
                >
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
                            <div
                              className={`h-11 w-11 rounded-xl flex items-center justify-center ${service.bgColor}`}
                            >
                              <service.icon className={`h-5 w-5 ${service.iconColor}`} />
                            </div>
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-2 py-0.5 h-5 font-medium border ${statusCfg.badgeClass}`}
                            >
                              <span
                                className={`inline-block h-1.5 w-1.5 rounded-full mr-1 ${statusCfg.dotClass}`}
                              />
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
                          <div
                            className={`h-12 w-12 rounded-xl flex-shrink-0 flex items-center justify-center ${service.bgColor} group-hover:scale-105 transition-transform duration-200`}
                          >
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
                                <span
                                  className={`inline-block h-1.5 w-1.5 rounded-full mr-1 ${statusCfg.dotClass}`}
                                />
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
                            <span
                              className={`text-sm font-semibold mt-0.5 ${
                                derived.policyCount > 0 ? 'text-gray-900' : 'text-gray-400'
                              }`}
                            >
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
              Choose the plan you want to update, then tell us what should change. We will send it
              straight to our submissions inbox for follow-up.
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
                  {
                    availableChangeOptions.find((option) => option.id === selectedChangeType)
                      ?.description
                  }
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
