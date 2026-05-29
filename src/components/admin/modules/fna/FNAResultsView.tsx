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
import type {
  FNASession,
  FNAInputs,
  LifeCoverBreakdown as LifeCoverBreakdownData,
  SevereIllnessBreakdown as SevereIllnessBreakdownData,
  CapitalDisabilityBreakdown as CapitalDisabilityBreakdownData,
  IncomeProtectionBreakdown as IncomeProtectionBreakdownData,
} from './types';

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
          required={results.lifeCover.finalRecommendedNeed}
          existing={results.lifeCover.existingLifeCover}
          gap={results.lifeCover.shortfallSurplus}
          color="blue"
        />
        <SummaryCard
          title="Severe Illness"
          icon={Heart}
          required={results.severeIllness.finalRecommendedNeed}
          existing={results.severeIllness.existingSevereIllnessCover}
          gap={results.severeIllness.shortfallSurplus}
          color="red"
        />
        <SummaryCard
          title="Capital Disability"
          icon={Activity}
          required={results.capitalDisability.finalRecommendedNeed}
          existing={results.capitalDisability.existingDisabilityCover}
          gap={results.capitalDisability.shortfallSurplus}
          color="orange"
        />
        <SummaryCard
          title="Income Protection"
          icon={DollarSign}
          required={results.incomeProtection.finalRecommendedNeed}
          existing={results.incomeProtection.existingIP}
          gap={results.incomeProtection.shortfallSurplus}
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

function LifeCoverBreakdown({ data }: { data: LifeCoverBreakdownData; inputs: Partial<FNAInputs> }) {
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
                    Shortfall: {formatCurrency(data.shortfallSurplus)}
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
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Recommended Cover</p>
                <p>{formatCurrency(data.finalRecommendedNeed)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Existing Cover</p>
                <p>{formatCurrency(data.existingLifeCover)}</p>
              </div>
            </div>

            <Separator />

            {/* Needs Breakdown */}
            <div>
              <p className="text-sm mb-3">
                <strong>Calculated Need:</strong> {formatCurrency(data.calculatedNeed)}
              </p>
              <div className="space-y-2 ml-4">
                <BreakdownItem label="Debt Settlement" value={data.debt} />
                <BreakdownItem label="Final Expenses" value={data.finalExpenses} />
                <BreakdownItem label="Income Replacement" value={data.incomeReplacement} />
                <BreakdownItem label="Education Funding" value={data.educationFunding} />
                <BreakdownItem label="Estate Costs" value={data.estateCosts} />
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function SevereIllnessBreakdown({ data }: { data: SevereIllnessBreakdownData; inputs: Partial<FNAInputs> }) {
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
                    Shortfall: {formatCurrency(data.shortfallSurplus)}
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
                <p className="text-sm text-muted-foreground">Recommended CI Cover</p>
                <p>{formatCurrency(data.finalRecommendedNeed)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Existing CI Cover</p>
                <p>{formatCurrency(data.existingSevereIllnessCover)}</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <BreakdownItem label="Medical Shortfalls" value={data.medicalShortfalls} />
              <BreakdownItem label="Lifestyle Adjustments" value={data.lifestyleAdjustments} />
              <BreakdownItem label="Income Gap" value={data.incomeGap} />
              <BreakdownItem label="Debt Buffer" value={data.debtBuffer} />
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function CapitalDisabilityBreakdown({ data }: { data: CapitalDisabilityBreakdownData; inputs: Partial<FNAInputs> }) {
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
                    Shortfall: {formatCurrency(data.shortfallSurplus)}
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
                <p className="text-sm text-muted-foreground">Recommended</p>
                <p>{formatCurrency(data.finalRecommendedNeed)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Existing</p>
                <p>{formatCurrency(data.existingDisabilityCover)}</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <BreakdownItem label="Debt Settlement" value={data.debt} />
              <BreakdownItem label="Income Capitalisation" value={data.incomeCapitalisation} />
              <BreakdownItem label="Lifestyle Modifications" value={data.lifestyleModifications} />
              <BreakdownItem label="Medical Adaptation" value={data.medicalAdaptation} />
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function IncomeProtectionBreakdown({ data }: { data: IncomeProtectionBreakdownData; inputs: Partial<FNAInputs> }) {
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
                    Shortfall: {formatCurrency(data.shortfallSurplus)}/mo
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
                <p className="text-sm text-muted-foreground">Recommended Monthly</p>
                <p>{formatCurrency(data.finalRecommendedNeed)}/mo</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Existing</p>
                <p>{formatCurrency(data.existingIP)}/mo</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-2 text-sm">
              <p>Monthly required: {formatCurrency(data.monthlyRequired)}/mo</p>
              <p>Calculated need: {formatCurrency(data.calculatedNeed)}/mo</p>
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