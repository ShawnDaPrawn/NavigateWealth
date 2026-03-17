/**
 * FNA Results View Component
 * Displays calculated FNA results with breakdowns
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/card';
import { Badge } from '../../../ui/badge';
import { Button } from '../../../ui/button';
import { Separator } from '../../../ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../../ui/collapsible';
import {
  Shield,
  Heart,
  DollarSign,
  Activity,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  Info,
  TrendingUp,
  Calendar,
  Download,
  Send
} from 'lucide-react';
import { formatCurrency } from '../../../../utils/currencyFormatter';
import type { FNASession } from './types';

interface FNAResultsViewProps {
  fna: FNASession;
  onPublish?: () => void;
  onDraft?: () => void;
  isClientView?: boolean;
}

export function FNAResultsView({ fna, onPublish, onDraft, isClientView = false }: FNAResultsViewProps) {
  const { results, inputs, status, createdAt, publishedAt } = fna;

  if (!results) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No calculation results available
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3>Financial Needs Analysis Results</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Based on information as at {new Date(createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={status === 'published' ? 'default' : 'secondary'}>
            {status}
          </Badge>
          {!isClientView && status === 'draft' && (
            <div className="contents">
              {onDraft && (
                <Button size="sm" variant="outline" onClick={onDraft}>
                  Save Draft
                </Button>
              )}
              {onPublish && (
                <Button size="sm" onClick={onPublish}>
                  <Send className="size-4 mr-2" />
                  Publish
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Life Cover"
          icon={Shield}
          required={results.lifeCover.requiredLifeCover}
          existing={results.lifeCover.existingLifeCover}
          gap={results.lifeCover.lifeCoverGap}
          color="blue"
        />
        <SummaryCard
          title="Severe Illness"
          icon={Heart}
          required={results.severeIllness.ciRequired}
          existing={results.severeIllness.existingCICover}
          gap={results.severeIllness.ciGap}
          color="red"
        />
        <SummaryCard
          title="Capital Disability"
          icon={Activity}
          required={results.capitalDisability.capitalDisabilityRequired}
          existing={results.capitalDisability.existingCapitalDisabilityCover}
          gap={results.capitalDisability.capitalDisabilityGap}
          color="orange"
        />
        <SummaryCard
          title="Income Protection"
          icon={DollarSign}
          required={results.incomeProtection.targetIncomeProtectionMonthly}
          existing={results.incomeProtection.existingIPMonthlyTotal}
          gap={results.incomeProtection.incomeProtectionGapMonthly}
          color="green"
          isMonthly
        />
      </div>

      {/* Detailed Breakdowns */}
      <div className="space-y-4">
        <LifeCoverBreakdown data={results.lifeCover} inputs={inputs} />
        <SevereIllnessBreakdown data={results.severeIllness} inputs={inputs} />
        <CapitalDisabilityBreakdown data={results.capitalDisability} inputs={inputs} />
        <IncomeProtectionBreakdown data={results.incomeProtection} inputs={inputs} />
      </div>

      {/* Disclaimer */}
      {isClientView && (
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="pt-4">
            <div className="flex items-start gap-2">
              <Info className="size-5 text-amber-600 mt-0.5" />
              <div className="text-sm">
                <p>
                  <strong>Important:</strong> These are planning estimates, not product recommendations.
                </p>
                <p className="text-muted-foreground mt-1">
                  They depend on the accuracy of the data in your profile and should be reviewed regularly with your adviser.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ==================== SUMMARY CARD ====================

interface SummaryCardProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  required: number;
  existing: number;
  gap: number;
  color: 'blue' | 'red' | 'orange' | 'green';
  isMonthly?: boolean;
}

function SummaryCard({ title, icon: Icon, required, existing, gap, color, isMonthly = false }: SummaryCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    green: 'bg-green-50 border-green-200 text-green-700',
  };

  const hasGap = gap > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{title}</CardTitle>
          <Icon className="size-5 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div>
          <p className="text-xs text-muted-foreground">Required</p>
          <p>{formatCurrency(required)}{isMonthly && '/mo'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Existing</p>
          <p>{formatCurrency(existing)}{isMonthly && '/mo'}</p>
        </div>
        <Separator />
        <div className={`p-2 rounded ${hasGap ? 'bg-red-50' : 'bg-green-50'}`}>
          <p className="text-xs text-muted-foreground">Shortfall</p>
          <p className={hasGap ? 'text-red-700' : 'text-green-700'}>
            {formatCurrency(gap)}{isMonthly && '/mo'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== BREAKDOWN COMPONENTS ====================

/** Shared props for FNA breakdown components */
interface FNABreakdownProps {
  data: Record<string, unknown>;
  inputs: Partial<FNAInputs>;
}

function LifeCoverBreakdown({ data, inputs }: FNABreakdownProps) {
  const [open, setOpen] = useState(true);

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="size-5 text-blue-600" />
                <div className="text-left">
                  <CardTitle className="text-base">Life Cover Analysis</CardTitle>
                  <CardDescription>
                    Gap: {formatCurrency(data.lifeCoverGap)}
                  </CardDescription>
                </div>
              </div>
              {open ? <ChevronDown className="size-5" /> : <ChevronRight className="size-5" />}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Summary Grid */}
            <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Required Cover</p>
                <p>{formatCurrency(data.requiredLifeCover)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Existing Cover</p>
                <p>{formatCurrency(data.existingLifeCover)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Available Assets</p>
                <p>{formatCurrency(data.availableLiquidAssets)}</p>
              </div>
            </div>

            <Separator />

            {/* Lump Sum Needs */}
            <div>
              <p className="text-sm mb-3">
                <strong>Immediate Lump Sum Needs:</strong> {formatCurrency(data.lumpSumNeeds)}
              </p>
              <div className="space-y-2 ml-4">
                <BreakdownItem label="Debt Settlement" value={data.totalDebtToSettle} />
                <BreakdownItem label="Emergency Fund" value={data.emergencyFundNeed} />
                <BreakdownItem label="Final Expenses" value={data.finalExpensesNeed} />
                <BreakdownItem label="Education Capital" value={data.educationNeed} />
                <BreakdownItem label="Bequests" value={data.bequestsNeed} />
              </div>
            </div>

            <Separator />

            {/* Income Replacement */}
            <div>
              <p className="text-sm mb-3">
                <strong>Income Replacement Capital:</strong> {formatCurrency(data.incomeReplacementCapital)}
              </p>
              <div className="space-y-2 ml-4 text-sm">
                <p>Target monthly income: {formatCurrency(data.targetFamilyIncomePerMonth)}/mo</p>
                <p>Years of support needed: {data.yearsSupportForIncomeReplacement} years</p>
                <p className="text-muted-foreground">
                  (Based on {data.yearsToRetirement} years to retirement and {data.maxYearsSupportDependants} years for dependants)
                </p>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function SevereIllnessBreakdown({ data, inputs }: FNABreakdownProps) {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Heart className="size-5 text-red-600" />
                <div className="text-left">
                  <CardTitle className="text-base">Severe / Critical Illness Analysis</CardTitle>
                  <CardDescription>
                    Gap: {formatCurrency(data.ciGap)}
                  </CardDescription>
                </div>
              </div>
              {open ? <ChevronDown className="size-5" /> : <ChevronRight className="size-5" />}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Required CI Cover</p>
                <p>{formatCurrency(data.ciRequired)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Existing CI Cover</p>
                <p>{formatCurrency(data.existingCICover)}</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <BreakdownItem label="Medical Gap Buffer" value={data.medicalGapNeed} />
              <BreakdownItem label="Lifestyle Adjustment Buffer" value={data.lifestyleAdjustmentNeed} />
              <BreakdownItem label="Debt to Settle" value={data.debtToSettleOnCI} />
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function CapitalDisabilityBreakdown({ data, inputs }: FNABreakdownProps) {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Activity className="size-5 text-orange-600" />
                <div className="text-left">
                  <CardTitle className="text-base">Capital Disability Analysis</CardTitle>
                  <CardDescription>
                    Gap: {formatCurrency(data.capitalDisabilityGap)}
                  </CardDescription>
                </div>
              </div>
              {open ? <ChevronDown className="size-5" /> : <ChevronRight className="size-5" />}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Required</p>
                <p>{formatCurrency(data.capitalDisabilityRequired)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Existing</p>
                <p>{formatCurrency(data.existingCapitalDisabilityCover)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Assets</p>
                <p>{formatCurrency(data.availableLiquidAssetsForDisability)}</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <BreakdownItem label="Debt Settlement" value={data.debtOnDisability} />
              <BreakdownItem label="Home/Vehicle Adaptation" value={data.homeVehicleAdaptationNeed} />
              <BreakdownItem label="Retirement Contribution Gap" value={data.retirementContributionGapCapital} />
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function IncomeProtectionBreakdown({ data, inputs }: FNABreakdownProps) {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <DollarSign className="size-5 text-green-600" />
                <div className="text-left">
                  <CardTitle className="text-base">Income Protection Analysis</CardTitle>
                  <CardDescription>
                    Gap: {formatCurrency(data.incomeProtectionGapMonthly)}/mo
                  </CardDescription>
                </div>
              </div>
              {open ? <ChevronDown className="size-5" /> : <ChevronRight className="size-5" />}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Target Monthly</p>
                <p>{formatCurrency(data.targetIncomeProtectionMonthly)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Existing</p>
                <p>{formatCurrency(data.existingIPMonthlyTotal)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Other Income</p>
                <p>{formatCurrency(data.reliableOtherIncome)}</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-2 text-sm">
              <p>Regulatory limit (75% of gross): {formatCurrency(data.regulatoryLimit)}/mo</p>
              <p>Planning target ({inputs.assumptions?.targetIncomeReplacementPercent || 70}% of net): {formatCurrency(data.planningTarget)}/mo</p>
              <p className="text-muted-foreground">
                Recommended benefit is the lower of these two amounts.
              </p>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function BreakdownItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span>{formatCurrency(value)}</span>
    </div>
  );
}