import React from 'react';
import { Card, CardContent, CardHeader } from '../../../../ui/card';
import { Skeleton } from '../../../../ui/skeleton';

/**
 * DashboardSkeleton
 * 
 * A structural skeleton that mirrors the exact layout of DashboardModule.
 * Used as the Suspense fallback so the card structure is visible immediately
 * when the page initialises, before the module chunk or data has loaded.
 * 
 * Layout mirrors:
 * - 4-column KPI grid (top)
 * - 2-column middle section (System Activity + Quick Actions)
 * - Full-width bottom section (Tasks)
 */

function KPICardSkeleton() {
  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-7 w-20 mb-2" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-28" />
        </div>
      </CardContent>
    </Card>
  );
}

function SystemActivitySkeleton() {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-5 w-32" />
        </div>
        <Skeleton className="h-4 w-56 mt-1" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="p-4 rounded-xl border border-border">
              <div className="flex justify-between items-start mb-2">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <Skeleton className="h-5 w-10 rounded-full" />
              </div>
              <div className="mt-2">
                <Skeleton className="h-7 w-16 mb-1" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function QuickActionsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-5 w-28" />
        </div>
        <Skeleton className="h-4 w-44 mt-1" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <Skeleton key={i} className="h-14 w-full rounded-md" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TasksSkeleton() {
  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-24" />
          </div>
          <Skeleton className="h-4 w-52 mt-1" />
        </div>
        <div className="flex space-x-2">
          <Skeleton className="h-8 w-16 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border border-border">
              <div className="flex items-start space-x-3 mb-2 sm:mb-0">
                <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-4 w-14" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-6" role="status" aria-label="Loading dashboard">
      <span className="sr-only">Loading dashboard, please wait…</span>
      {/* KPI Grid — 4 columns */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <KPICardSkeleton key={i} />
        ))}
      </div>

      {/* Middle section — System Activity + Quick Actions */}
      <div className="grid gap-6 md:grid-cols-2">
        <SystemActivitySkeleton />
        <QuickActionsSkeleton />
      </div>

      {/* Bottom section — Tasks + Recent Notes */}
      <div className="grid gap-6 lg:grid-cols-2">
        <TasksSkeleton />
        <TasksSkeleton />
      </div>
    </div>
  );
}