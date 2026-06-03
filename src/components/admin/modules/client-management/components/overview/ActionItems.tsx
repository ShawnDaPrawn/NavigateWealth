/**
 * ActionItems.tsx
 *
 * Unified Action Items sub-components for the Client Overview Tab.
 * Extracted from ClientOverviewTab.tsx.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../ui/card';
import { Badge } from '../../../../../ui/badge';
import { Button } from '../../../../../ui/button';
import { CheckCircle, Zap, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { ActionPriorityBar } from './OverviewCharts';
import type { ActionDistribution } from './OverviewCharts';
import type { ActionItem, ActionPriority } from '../clientOverviewUtils';
import type { DashboardMode } from '../clientOverviewConstants';

// ── Priority styles ──────────────────────────────────────────────────────

const PRIORITY_STYLES: Record<
  ActionPriority,
  {
    border: string;
    bg: string;
    iconBg: string;
    iconColor: string;
    label: string;
    labelColor: string;
    labelBorder: string;
  }
> = {
  urgent: {
    border: 'border-red-200',
    bg: 'bg-red-50/40',
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    label: 'Act Now',
    labelColor: 'text-red-700',
    labelBorder: 'border-red-200 bg-red-50',
  },
  attention: {
    border: 'border-amber-200',
    bg: 'bg-amber-50/30',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    label: 'Worth a Look',
    labelColor: 'text-amber-700',
    labelBorder: 'border-amber-200 bg-amber-50',
  },
  recommended: {
    border: 'border-blue-200',
    bg: 'bg-blue-50/20',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    label: 'Nice to Have',
    labelColor: 'text-blue-600',
    labelBorder: 'border-blue-200 bg-blue-50',
  },
};

const CATEGORY_LABELS: Record<ActionItem['category'], string> = {
  fna: 'Financial Review',
  coverage: 'Cover Gaps',
  renewal: 'Upcoming Renewal',
  profile: 'Client Info',
  compliance: 'Compliance',
};

/** Client-friendly labels — replaces jargon for the client portal */
const CLIENT_CATEGORY_LABELS: Record<ActionItem['category'], string> = {
  fna: 'Financial Review',
  coverage: 'Your Cover',
  renewal: 'Upcoming Renewal',
  profile: 'Your Details',
  compliance: 'Compliance',
};

// ── ActionItemRow component ──────────────────────────────────────────────

export function ActionItemRow({
  item,
  mode = 'adviser',
}: {
  item: ActionItem;
  mode?: DashboardMode;
}) {
  const style = PRIORITY_STYLES[item.priority];
  const ItemIcon = item.icon;
  const categoryLabels = mode === 'client' ? CLIENT_CATEGORY_LABELS : CATEGORY_LABELS;

  return (
    <div
      className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border ${style.border} ${style.bg}`}
    >
      <div
        className={`flex items-center justify-center h-8 w-8 rounded-md ${style.iconBg} flex-shrink-0 mt-0.5`}
      >
        <ItemIcon className={`h-4 w-4 ${style.iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-gray-800">{item.title}</p>
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 h-4.5 border ${style.labelBorder} ${style.labelColor}`}
          >
            {style.label}
          </Badge>
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 h-4.5 border-gray-200 text-gray-400 hidden sm:inline-flex"
          >
            {categoryLabels[item.category]}
          </Badge>
        </div>
        {item.detail && (
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.detail}</p>
        )}
      </div>
      <ArrowRight className="h-4 w-4 text-gray-300 flex-shrink-0 mt-1.5 print:hidden" />
    </div>
  );
}

// ── UnifiedActionItems component ─────────────────────────────────────────

export function UnifiedActionItems({
  items,
  mode = 'adviser',
  actionDistribution,
}: {
  items: ActionItem[];
  mode?: DashboardMode;
  actionDistribution?: ActionDistribution;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const isClientMode = mode === 'client';

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-green-50">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">
                {isClientMode ? 'Everything looks good' : 'Nothing outstanding'}
              </p>
              <p className="text-xs text-gray-500">
                {isClientMode
                  ? 'Nothing needs your attention right now.'
                  : 'No items need attention for this client right now.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4 border-b border-gray-100 bg-gray-50/40 print:bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-gray-500" />
            <CardTitle className="text-sm font-semibold text-gray-800">
              {isClientMode ? 'Things to Check' : 'What Needs Doing'}
            </CardTitle>
            <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5 ml-1">
              {items.length}
            </Badge>
          </div>

          {/* Priority distribution bar + summary */}
          <div className="flex items-center gap-3">
            {actionDistribution && (
              <ActionPriorityBar distribution={actionDistribution} mode={mode} />
            )}

            {items.length > 5 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-gray-500 h-6 px-2 print:hidden"
                onClick={() => setCollapsed(!collapsed)}
              >
                {collapsed ? (
                  <div className="contents">
                    <ChevronDown className="h-3 w-3 mr-1" /> Show all
                  </div>
                ) : (
                  <div className="contents">
                    <ChevronUp className="h-3 w-3 mr-1" /> Collapse
                  </div>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-2">
        {(collapsed ? items.slice(0, 5) : items).map((item) => (
          <ActionItemRow key={item.id} item={item} mode={mode} />
        ))}
        {collapsed && items.length > 5 && (
          <button
            className="w-full text-center py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors print:hidden"
            onClick={() => setCollapsed(false)}
          >
            + {items.length - 5} more
          </button>
        )}
      </CardContent>
    </Card>
  );
}
