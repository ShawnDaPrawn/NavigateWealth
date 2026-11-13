/**
 * POLICY DETAILS SECTION - WITH SUBTABS
 * Comprehensive policy management with 8 financial planning categories
 */

import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Download,
  Shield,
  Heart,
  PiggyBank,
  Briefcase,
  FileText,
  Landmark,
  Target,
  TrendingUp,
} from 'lucide-react';
import { PolicyCategoryTab } from './PolicyCategoryTab';
import { Button } from '../../ui/button';
import { PolicyOverviewTab } from './PolicyOverviewTab';
import { PolicyComparisonPanel } from './PolicyComparisonPanel';
import type { FNAListFocus } from '../modules/fna';
import { useUrlState, usePageTakeoverActive } from '../layout/page';
import { useClientSubCrumbs } from '../layout/page';
import {
  clientPoliciesQueryOptions,
  filterPoliciesForCategory,
} from '../../../shared/api/clientPolicies';
import { SUBTAB_TO_CATEGORY } from './policyFormModel';
import { withNavigateWealthPrintTitle } from '../../../utils/pdfPrintTitle';

const POLICY_VIEWS = [
  'overview',
  'risk-planning',
  'medical-aid',
  'retirement',
  'investments',
  'employee-benefits',
  'tax-planning',
  'estate-planning',
  'compare',
] as const;
type PolicyView = (typeof POLICY_VIEWS)[number];

/** Sub-categories a parent category's count includes. */
const COMPOSITE: Record<string, readonly string[]> = {
  retirement_planning: ['retirement_pre', 'retirement_post', 'retirement_post_fixed'],
  investments: ['investments_voluntary', 'investments_guaranteed'],
  employee_benefits: ['employee_benefits_risk', 'employee_benefits_retirement'],
};

interface PolicyDetailsSectionProps {
  selectedClient: { id: string; firstName?: string; lastName?: string; [key: string]: unknown };
  /** Open on this category's FNA list (after an FNA is published elsewhere). */
  fnaFocus?: FNAListFocus;
}

export function PolicyDetailsSection({ selectedClient, fnaFocus }: PolicyDetailsSectionProps) {
  // The open category is in the address (?pcat=).
  const [activePolicyTab, setActivePolicyTab] = useUrlState<PolicyView>(
    'pcat',
    'overview',
    POLICY_VIEWS,
  );
  useEffect(() => {
    if (fnaFocus?.categorySubtabId) setActivePolicyTab(fnaFocus.categorySubtabId as PolicyView);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when opened on an FNA
  }, []);

  /** The focus props for one category tab: its FNA list open, the new FNA highlighted. */
  const focusFor = (categorySubtabId: string) =>
    fnaFocus?.categorySubtabId === categorySubtabId
      ? { openFNAListOnMount: true, highlightFnaId: fnaFocus.fnaId }
      : {};

  // Derive the actual client display name
  const clientDisplayName =
    [selectedClient?.firstName, selectedClient?.lastName].filter(Boolean).join(' ') || 'Client';
  const clientId = selectedClient?.id || 'client_1';

  // Category rail
  const policySubtabs = [
    { id: 'risk-planning', label: 'Risk planning', icon: Shield },
    { id: 'medical-aid', label: 'Medical aid', icon: Heart },
    { id: 'retirement', label: 'Retirement planning', icon: PiggyBank },
    { id: 'investments', label: 'Investments', icon: TrendingUp },
    { id: 'employee-benefits', label: 'Employee benefits', icon: Briefcase },
    { id: 'tax-planning', label: 'Tax planning', icon: FileText },
    { id: 'estate-planning', label: 'Estate planning', icon: Landmark },
  ] as const;

  // An FNA / will page or the policy form takes the rail's place.
  const railHidden = usePageTakeoverActive() !== null;
  const policiesQuery = useQuery(clientPoliciesQueryOptions(clientId));
  const counts = useMemo(() => {
    const all = policiesQuery.data ?? [];
    return Object.fromEntries(
      policySubtabs.map((tab) => {
        const categoryId = SUBTAB_TO_CATEGORY[tab.id];
        const ids = new Set(
          [categoryId, ...(COMPOSITE[categoryId] ?? [])].flatMap((id) =>
            filterPoliciesForCategory(all, id).map((p) => p.id),
          ),
        );
        return [tab.id, ids.size];
      }),
    ) as Record<string, number>;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- policySubtabs is static
  }, [policiesQuery.data]);

  const activeLabel =
    activePolicyTab === 'overview'
      ? 'Portfolio overview'
      : activePolicyTab === 'compare'
        ? 'Compare all policies'
        : (policySubtabs.find((t) => t.id === activePolicyTab)?.label ?? '');
  useClientSubCrumbs(activeLabel ? [{ label: activeLabel }] : []);

  const downloadReport = () =>
    withNavigateWealthPrintTitle(`Financial Portfolio Overview - ${clientDisplayName}`, () =>
      window.print(),
    );

  const railItem = (id: PolicyView, label: string, Icon: typeof Shield, count?: number) => {
    const active = activePolicyTab === id;
    return (
      <li key={id}>
        <button
          type="button"
          onClick={() => setActivePolicyTab(id)}
          aria-current={active ? 'page' : undefined}
          className={`flex w-full items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-violet/60 ${
            active
              ? 'bg-nw-violet-50 font-medium text-nw-violet-600'
              : 'text-nw-text-2 hover:bg-gray-50 hover:text-nw-ink'
          }`}
        >
          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="flex-1">{label}</span>
          {count !== undefined && (
            <span className="text-xs tabular-nums text-nw-text-3">{count}</span>
          )}
        </button>
      </li>
    );
  };

  return (
    <div className={railHidden ? '' : 'grid gap-6 lg:grid-cols-[220px_1fr]'}>
      <nav
        aria-label="Policy categories"
        className="lg:sticky lg:top-4 lg:self-start"
        hidden={railHidden}
      >
        <ul className="flex gap-1 overflow-x-auto lg:flex-col">
          {railItem('overview', 'Portfolio overview', Target)}
        </ul>
        <p className="mb-1 mt-4 hidden px-3 text-xs font-medium text-nw-text-3 lg:block">
          Categories
        </p>
        <ul className="flex gap-1 overflow-x-auto lg:flex-col">
          {policySubtabs.map((tab) => railItem(tab.id, tab.label, tab.icon, counts[tab.id] ?? 0))}
        </ul>
        <p className="mb-1 mt-4 hidden px-3 text-xs font-medium text-nw-text-3 lg:block">
          Across all
        </p>
        <ul className="flex gap-1 overflow-x-auto lg:flex-col">
          {railItem('compare', 'Compare all policies', BarChart3)}
          <li>
            <button
              type="button"
              onClick={downloadReport}
              className="flex w-full items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm text-nw-text-2 hover:bg-gray-50 hover:text-nw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-violet/60"
            >
              <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
              Download report
            </button>
          </li>
        </ul>
      </nav>

      <div className="min-w-0 space-y-6">
        {activePolicyTab === 'compare' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-nw-ink">Compare all policies</h2>
                <p className="text-sm text-nw-text-3">
                  Every active policy side by side, with totals and coverage gaps.
                </p>
              </div>
              <Button variant="outline" onClick={downloadReport}>
                Download report
              </Button>
            </div>
            <PolicyComparisonPanel clientId={clientId} />
          </div>
        )}

        {/* Overview Tab Content */}
        {activePolicyTab === 'overview' && (
          <PolicyOverviewTab
            clientId={selectedClient?.id || 'client_1'}
            clientDisplayName={clientDisplayName}
            showComparison={false}
            onRunFNA={(categoryId) => setActivePolicyTab(categoryId as PolicyView)}
            onAddPolicy={(categoryId) => setActivePolicyTab(categoryId as PolicyView)}
            onViewDetails={(categoryId) => setActivePolicyTab(categoryId as PolicyView)}
          />
        )}

        {/* Risk Planning Tab Content */}
        {activePolicyTab === 'risk-planning' && (
          <PolicyCategoryTab
            categorySubtabId="risk-planning"
            categoryName="Risk planning"
            icon={Shield}
            iconColor="text-[#6d28d9]"
            description="Life insurance, disability cover, and income protection"
            clientId={selectedClient?.id || 'client_1'}
            {...focusFor('risk-planning')}
          />
        )}

        {/* Medical Aid Tab Content */}
        {activePolicyTab === 'medical-aid' && (
          <PolicyCategoryTab
            categorySubtabId="medical-aid"
            categoryName="Medical aid"
            icon={Heart}
            iconColor="text-red-500"
            description="Healthcare coverage and medical scheme memberships"
            clientId={selectedClient?.id || 'client_1'}
            {...focusFor('medical-aid')}
          />
        )}

        {/* Retirement Planning Tab Content */}
        {activePolicyTab === 'retirement' && (
          <PolicyCategoryTab
            categorySubtabId="retirement"
            categoryName="Retirement planning"
            icon={PiggyBank}
            iconColor="text-green-600"
            description="Pension funds, retirement annuities, and preservation funds"
            clientId={selectedClient?.id || 'client_1'}
            {...focusFor('retirement')}
          />
        )}

        {/* Investments Tab Content */}
        {activePolicyTab === 'investments' && (
          <PolicyCategoryTab
            categorySubtabId="investments"
            categoryName="Investments"
            icon={TrendingUp}
            iconColor="text-[#6d28d9]"
            description="Unit trusts, tax-free savings, and offshore investments"
            clientId={selectedClient?.id || 'client_1'}
            {...focusFor('investments')}
          />
        )}

        {/* Employee Benefits Tab Content */}
        {activePolicyTab === 'employee-benefits' && (
          <PolicyCategoryTab
            categorySubtabId="employee-benefits"
            categoryName="Employee benefits"
            icon={Briefcase}
            iconColor="text-blue-600"
            description="Employer-sponsored benefits and group schemes"
            clientId={selectedClient?.id || 'client_1'}
            {...focusFor('employee-benefits')}
          />
        )}

        {/* Tax Planning Tab Content */}
        {activePolicyTab === 'tax-planning' && (
          <PolicyCategoryTab
            categorySubtabId="tax-planning"
            categoryName="Tax planning"
            icon={FileText}
            iconColor="text-[#6d28d9]"
            description="Tax-efficient investment strategies and planning"
            clientId={selectedClient?.id || 'client_1'}
            {...focusFor('tax-planning')}
          />
        )}

        {/* Estate Planning Tab Content */}
        {activePolicyTab === 'estate-planning' && (
          <PolicyCategoryTab
            categorySubtabId="estate-planning"
            categoryName="Estate planning"
            icon={Landmark}
            iconColor="text-[#6d28d9]"
            description="Wills, trusts, and estate management"
            clientId={selectedClient?.id || 'client_1'}
            clientDisplayName={clientDisplayName}
            {...focusFor('estate-planning')}
          />
        )}
      </div>
    </div>
  );
}
