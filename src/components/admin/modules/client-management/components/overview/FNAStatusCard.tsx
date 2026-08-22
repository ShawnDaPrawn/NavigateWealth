/**
 * FNAStatusCard.tsx
 *
 * FNA Status Card sub-component for the Client Overview Tab.
 * Extracted from ClientOverviewTab.tsx.
 */

import React from 'react';
import { Badge } from '../../../../../ui/badge';
import { Button } from '../../../../../ui/button';
import { Skeleton } from '../../../../../ui/skeleton';
import { fmtDate, isPast } from '../clientOverview/format';
import { getFnaStatusLabel } from '@/shared/fna-intake/fna-intake-labels';
import type { DashboardMode } from '../clientOverviewConstants';

// ── FNAStatusItem interface ──────────────────────────────────────────────

/** Normalised FNA status for display */
export interface FNAStatusItem {
  key: string;
  name: string;
  icon: React.ElementType;
  status: 'published' | 'draft' | 'client_draft' | 'submitted' | 'not_started' | 'error';
  updatedAt?: string;
  publishedAt?: string;
  submittedAt?: string;
  nextReviewDue?: string;
  progressPercent?: number;
  loading: boolean;
}

// ── FNA status styles ───────────────────────────────────────────────────

const FNA_STATUS_STYLES: Record<
  FNAStatusItem['status'],
  { dot: string; badge: string; badgeLabel: string }
> = {
  published: {
    dot: 'bg-green-500',
    badge: 'bg-green-50 text-green-700 border-green-200',
    badgeLabel: 'Published',
  },
  draft: {
    dot: 'bg-amber-400',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    badgeLabel: 'Draft',
  },
  client_draft: {
    dot: 'bg-purple-400',
    badge: 'bg-purple-50 text-purple-700 border-purple-200',
    badgeLabel: 'Client draft',
  },
  submitted: {
    dot: 'bg-blue-400',
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
    badgeLabel: 'Review queue',
  },
  not_started: {
    dot: 'bg-gray-300',
    badge: 'bg-gray-50 text-gray-500 border-gray-200',
    badgeLabel: 'Not Started',
  },
  error: {
    dot: 'bg-red-400',
    badge: 'bg-red-50 text-red-600 border-red-200',
    badgeLabel: 'Error',
  },
};

// ── FNAStatusCard component ──────────────────────────────────────────────

export function FNAStatusCard({
  fna,
  mode = 'adviser',
  onIntakeAction,
}: {
  fna: FNAStatusItem;
  mode?: DashboardMode;
  onIntakeAction?: () => void;
}) {
  const style = FNA_STATUS_STYLES[fna.status] ?? FNA_STATUS_STYLES.not_started;
  const FnaIcon = fna.icon;
  const overdue = fna.nextReviewDue && isPast(fna.nextReviewDue);
  const isClientMode = mode === 'client';
  const clientLabel = getFnaStatusLabel(fna.status, 'client');
  const adviserLabel = getFnaStatusLabel(fna.status, 'adviser');

  if (fna.loading) {
    return (
      <div className="border border-gray-200 rounded-lg p-3 flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`border rounded-lg p-3.5 flex items-start gap-3 ${overdue ? 'border-red-200 bg-red-50/30' : 'border-gray-200'}`}
    >
      <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-gray-100 flex-shrink-0">
        <FnaIcon className="h-4.5 w-4.5 text-gray-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-sm font-semibold text-gray-800 truncate">{fna.name}</p>
          <Badge
            variant="outline"
            className={`text-[11px] px-1.5 py-0 h-4.5 border ${style.badge}`}
          >
            {isClientMode ? clientLabel : adviserLabel}
          </Badge>
        </div>
        {fna.status === 'not_started' ? (
          <p className="text-xs text-gray-400">
            {isClientMode
              ? 'Start your financial discovery — your adviser will review and publish formal advice.'
              : 'No analysis conducted yet'}
          </p>
        ) : (
          <div className="space-y-0.5">
            {fna.publishedAt && (
              <p className="text-xs text-gray-500">
                {isClientMode ? 'Completed: ' : 'Published: '}
                {fmtDate(fna.publishedAt)}
              </p>
            )}
            {fna.submittedAt && fna.status === 'submitted' && (
              <p className="text-xs text-gray-500">Submitted: {fmtDate(fna.submittedAt)}</p>
            )}
            {fna.updatedAt && !fna.publishedAt && fna.status !== 'submitted' && (
              <p className="text-xs text-gray-500">
                {isClientMode ? 'Last updated: ' : 'Last saved: '}
                {fmtDate(fna.updatedAt)}
              </p>
            )}
            {typeof fna.progressPercent === 'number' && fna.status === 'client_draft' && (
              <p className="text-xs text-gray-500">Progress: {fna.progressPercent}%</p>
            )}
            {fna.nextReviewDue && (
              <p className={`text-xs ${overdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                {overdue ? (isClientMode ? 'Review due — ' : 'Review overdue — ') : 'Next review: '}
                {fmtDate(fna.nextReviewDue)}
              </p>
            )}
          </div>
        )}
        {onIntakeAction && (
          <Button size="sm" variant="outline" className="mt-2 h-7 text-xs" onClick={onIntakeAction}>
            {fna.status === 'client_draft'
              ? 'Continue'
              : fna.status === 'published' && overdue
                ? 'Refresh discovery'
                : 'Start discovery'}
          </Button>
        )}
      </div>
      <div className={`h-2.5 w-2.5 rounded-full ${style.dot} flex-shrink-0 mt-1`} />
    </div>
  );
}
