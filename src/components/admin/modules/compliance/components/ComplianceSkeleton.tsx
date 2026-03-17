import React from 'react';
import { Skeleton } from '../../../../ui/skeleton';

/**
 * ComplianceSkeleton
 *
 * Mirrors the ComplianceModule layout:
 * - Header bar (title + FSP badge + Export button) with bottom border
 * - Horizontal nav bar (Overview, CDD, Practice, Reports)
 * - Content area with overview cards
 */

function OverviewCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-white p-5 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-3 w-40" />
      <Skeleton className="h-2 w-full rounded-full mt-2" />
    </div>
  );
}

export function ComplianceSkeleton() {
  return (
    <div className="flex flex-col h-full w-full max-w-full bg-slate-50/50 overflow-hidden" role="status" aria-label="Loading compliance">
      <span className="sr-only">Loading compliance module, please wait…</span>
      {/* Header */}
      <div className="border-b bg-white px-6 py-4 shadow-sm shrink-0">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between max-w-screen-2xl mx-auto">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Skeleton className="h-7 w-64" />
              <Skeleton className="h-6 w-36 rounded-full" />
            </div>
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-9 w-44 rounded-md" />
        </div>
      </div>

      {/* Navigation bar */}
      <div className="hidden md:block bg-white border-b shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-6">
          <div className="flex items-center gap-1 py-2">
            {['Overview', 'CDD', 'Practice', 'Reports'].map((tab, i) => (
              <Skeleton
                key={tab}
                className={`h-9 w-28 rounded-lg ${i === 0 ? 'bg-muted' : 'bg-transparent'}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-screen-2xl mx-auto space-y-6">
          {/* Overview KPI cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <OverviewCardSkeleton />
            <OverviewCardSkeleton />
            <OverviewCardSkeleton />
            <OverviewCardSkeleton />
          </div>

          {/* Content sections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-lg border border-border bg-white p-5 h-64">
              <Skeleton className="h-5 w-44 mb-4" />
              <div className="space-y-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="flex items-center justify-between">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-white p-5 h-64">
              <Skeleton className="h-5 w-40 mb-4" />
              <div className="space-y-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="flex items-center justify-between">
                    <Skeleton className="h-4 w-44" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}