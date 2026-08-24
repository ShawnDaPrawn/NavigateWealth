/**
 * Turning a client's holdings into what the dashboard shows: status, guidance, labels.
 *
 * Split out of `ProductsServicesDashboardPage.tsx` (1,482 lines), which carried
 * the service catalogue, the per-service change options and every derivation
 * alongside a 950-line page.
 */
import React from 'react';
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import type { ProductHolding, PortfolioFinancialOverview } from '../portfolio/api';
import { formatCurrency } from '../portfolio/utils';
import { CHANGE_OPTIONS_BY_SERVICE, type ChangeOption } from './changeOptions';
import { type ServiceModule } from './serviceModules';

export type ServiceStatus = 'active' | 'assessed' | 'available';

export interface DerivedServiceInfo {
  status: ServiceStatus;
  statusLabel: string;
  policyCount: number;
  statLabel: string;
  statValue: string;
}

export interface ServiceGuidance {
  title: string;
  detail: string;
}

export function deriveServiceInfo(
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

export function getServiceGuidance(
  service: ServiceModule,
  derived: DerivedServiceInfo,
): ServiceGuidance {
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

export function getCoverageValueLabel(holding: ProductHolding): string {
  if (holding.value > 0) return formatCurrency(holding.value);
  if (holding.premium > 0) return formatCurrency(holding.premium);
  return 'On file';
}

export function holdingStatusClass(status: string): string {
  const lower = status.toLowerCase();
  if (lower === 'active') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (lower === 'lapsed' || lower === 'cancelled') return 'bg-red-50 text-red-700 border-red-200';
  if (lower === 'archived') return 'bg-gray-50 text-gray-600 border-gray-200';
  if (lower.includes('review') || lower.includes('progress'))
    return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-blue-50 text-blue-700 border-blue-200';
}

export function getChangeOptionsForHolding(
  service: ServiceModule,
  holding: ProductHolding | null,
): ChangeOption[] {
  const defaults = CHANGE_OPTIONS_BY_SERVICE[service.id] ?? [];
  if (!holding) return defaults;

  const productText = `${holding.provider} ${holding.product}`.toLowerCase();

  if (service.id === 'medical-aid' && productText.includes('gap')) {
    return [
      {
        id: 'bank_account_change',
        label: 'Bank account change',
        description: 'Change the bank account used for this gap cover premium.',
      },
      {
        id: 'benefit_review',
        label: 'Benefit review',
        description: 'Request a review of the benefit structure on this gap cover plan.',
      },
      {
        id: 'membership_update',
        label: 'Membership detail change',
        description: 'Update the member details linked to this gap cover policy.',
      },
    ];
  }

  if (service.id === 'investment-management' && productText.includes('offshore')) {
    return [
      {
        id: 'contribution_change',
        label: 'Contribution change',
        description: 'Adjust the ongoing contribution into this offshore investment.',
      },
      {
        id: 'switch_instruction',
        label: 'Switch instruction',
        description: 'Request guidance on switching or rebalancing this offshore investment.',
      },
      {
        id: 'withdrawal_request',
        label: 'Withdrawal request',
        description: 'Ask for help with a withdrawal or access request on this investment.',
      },
    ];
  }

  return defaults;
}

// ── Status config (Guidelines §5.3, §8.3) ────────────────────────────────

export const STATUS_CONFIG: Record<
  ServiceStatus,
  {
    badgeClass: string;
    dotClass: string;
    icon: React.ElementType;
  }
> = {
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
