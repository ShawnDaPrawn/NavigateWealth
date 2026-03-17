/**
 * Portfolio Summary — Financial Pillar Cards
 * Each card renders one pillar of the client's financial overview.
 * Guidelines §7 (UI components handle layout only), §8.3 (consistent patterns).
 */

import React from 'react';
import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card';
import { Button } from '../../../ui/button';
import { Badge } from '../../../ui/badge';
import { Progress } from '../../../ui/progress';
import { Separator } from '../../../ui/separator';
import {
  Target,
  Shield,
  TrendingUp,
  Users,
  Heart,
  Calculator,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import type { PortfolioFinancialOverview } from '../api';
import { formatCurrency, formatDate, getStatusColor } from '../utils';

// ── Shared status icon helper ──
function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'on-track':
    case 'adequate':
    case 'performing':
    case 'active':
    case 'complete':
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case 'review-needed':
    case 'underinsured':
      return <Clock className="h-4 w-4 text-yellow-600" />;
    case 'urgent':
    case 'overdue':
    case 'not-established':
      return <AlertTriangle className="h-4 w-4 text-red-600" />;
    default:
      return <Clock className="h-4 w-4 text-gray-600" />;
  }
}

// ═══════════════════════════════════════════════════════
// Shared card wrapper (reduces per-card boilerplate)
// ═══════════════════════════════════════════════════════

interface PillarCardShellProps {
  icon: React.ReactNode;
  title: string;
  status: string;
  statusText: string;
  nextReview: string;
  reviewLabel?: string;
  linkTo: string;
  children: React.ReactNode;
}

function PillarCardShell({
  icon,
  title,
  status,
  statusText,
  nextReview,
  reviewLabel = 'Next Review',
  linkTo,
  children,
}: PillarCardShellProps) {
  return (
    <Card className="bg-white border-gray-200 hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {icon}
            <CardTitle className="text-black text-base">{title}</CardTitle>
          </div>
          <StatusIcon status={status} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {children}
          <Badge className={getStatusColor(status)}>{statusText}</Badge>
        </div>
        <Separator className="my-4" />
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">
            {reviewLabel}: {formatDate(nextReview)}
          </span>
          <Button size="sm" variant="outline" asChild>
            <Link to={linkTo}>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════
// Individual Pillar Cards
// ═══════════════════════════════════════════════════════

interface FinancialPillarCardsProps {
  overview: PortfolioFinancialOverview;
}

export function FinancialPillarCards({ overview }: FinancialPillarCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <RetirementCard data={overview.retirement} />
      <RiskCard data={overview.risk} />
      <InvestmentCard data={overview.investment} />
      <EstateCard data={overview.estate} />
      <MedicalAidCard data={overview.medicalAid} />
      <TaxCard data={overview.tax} />
    </div>
  );
}

// ── Retirement ──

function RetirementCard({ data }: { data: PortfolioFinancialOverview['retirement'] }) {
  return (
    <PillarCardShell
      icon={<Target className="h-5 w-5 text-blue-600" />}
      title="Retirement Savings"
      status={data.status}
      statusText={data.statusText}
      nextReview={data.nextReview}
      linkTo="/retirement-planning"
    >
      <div>
        <div className="text-2xl font-semibold text-black">
          {formatCurrency(data.currentValue)}
        </div>
        <p className="text-sm text-gray-600">
          Projected: {formatCurrency(data.projectedValue)}
        </p>
      </div>
      <div>
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-600">Progress to Goal</span>
          <span className="text-blue-600 font-medium">{data.progressToGoal}%</span>
        </div>
        <Progress value={data.progressToGoal} className="h-2" />
      </div>
    </PillarCardShell>
  );
}

// ── Risk Cover ──

function RiskCard({ data }: { data: PortfolioFinancialOverview['risk'] }) {
  return (
    <PillarCardShell
      icon={<Shield className="h-5 w-5 text-red-600" />}
      title="Risk Cover"
      status={data.status}
      statusText={data.statusText}
      nextReview={data.nextReview}
      linkTo="/risk-management"
    >
      <div>
        <div className="text-2xl font-semibold text-black">
          {formatCurrency(data.deathCover)}
        </div>
        <p className="text-sm text-gray-600">Death Cover</p>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-gray-600 block">Disability</span>
          <span className="text-black font-medium">{formatCurrency(data.disabilityCover)}</span>
        </div>
        <div>
          <span className="text-gray-600 block">Critical Illness</span>
          <span className="text-black font-medium">{formatCurrency(data.criticalIllnessCover)}</span>
        </div>
      </div>
    </PillarCardShell>
  );
}

// ── Investments ──

function InvestmentCard({ data }: { data: PortfolioFinancialOverview['investment'] }) {
  return (
    <PillarCardShell
      icon={<TrendingUp className="h-5 w-5 text-green-600" />}
      title="Investments"
      status={data.status}
      statusText={data.statusText}
      nextReview={data.nextReview}
      linkTo="/investment-management"
    >
      <div>
        <div className="text-2xl font-semibold text-black">
          {formatCurrency(data.totalValue)}
        </div>
        <p className="text-sm text-gray-600">Total Investment Value</p>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-600">Performance YTD</span>
        <span className="text-green-600 font-medium">{data.performance}</span>
      </div>
    </PillarCardShell>
  );
}

// ── Estate Planning ──

function EstateCard({ data }: { data: PortfolioFinancialOverview['estate'] }) {
  // Derived estate status indicators (Guidelines §7.1)
  const estateItems = [
    { label: 'Will', value: data.willStatus },
    { label: 'Trust', value: data.trustStatus },
    { label: 'Nominations', value: data.nominationStatus },
  ];

  return (
    <PillarCardShell
      icon={<Users className="h-5 w-5 text-purple-600" />}
      title="Estate Planning"
      status={data.status}
      statusText={data.statusText}
      nextReview={data.nextReview}
      linkTo="/estate-planning"
    >
      <div className="grid grid-cols-2 gap-3 text-sm">
        {estateItems.map((item) => {
          const isPositive = ['signed', 'established', 'complete', 'drafted'].includes(item.value);
          const displayText = item.value
            .replace(/-/g, ' ')
            .replace(/\b\w/g, (c: string) => c.toUpperCase());
          return (
            <div key={item.label} className="flex items-center space-x-2">
              {isPositive ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-600" />
              )}
              <span className="text-black">{item.label}: {displayText}</span>
            </div>
          );
        })}
      </div>
    </PillarCardShell>
  );
}

// ── Medical Aid ──

function MedicalAidCard({ data }: { data: PortfolioFinancialOverview['medicalAid'] }) {
  return (
    <PillarCardShell
      icon={<Heart className="h-5 w-5 text-pink-600" />}
      title="Medical Aid"
      status={data.status}
      statusText={data.statusText}
      nextReview={data.nextReview}
      reviewLabel="Renewal"
      linkTo="/medical-aid"
    >
      <div>
        <div className="text-lg font-semibold text-black">{data.scheme}</div>
        <p className="text-sm text-gray-600">{data.plan}</p>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-gray-600">Monthly Premium:</span>
        <span className="text-black font-medium">{formatCurrency(data.monthlyPremium)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-gray-600">Dependants:</span>
        <span className="text-black font-medium">{data.dependants}</span>
      </div>
    </PillarCardShell>
  );
}

// ── Tax Planning ──

function TaxCard({ data }: { data: PortfolioFinancialOverview['tax'] }) {
  return (
    <PillarCardShell
      icon={<Calculator className="h-5 w-5 text-orange-600" />}
      title="Tax Planning"
      status={data.status}
      statusText={data.statusText}
      nextReview={data.nextReview}
      reviewLabel="Next Return"
      linkTo="/tax-planning"
    >
      <div>
        <div className="text-lg font-semibold text-black">
          {data.taxYear} Tax Return
        </div>
        <p className="text-sm text-gray-600">Filed: {formatDate(data.filingDate)}</p>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-gray-600">Estimated Refund:</span>
        <span className="text-green-600 font-medium">{formatCurrency(data.estimatedRefund)}</span>
      </div>
    </PillarCardShell>
  );
}