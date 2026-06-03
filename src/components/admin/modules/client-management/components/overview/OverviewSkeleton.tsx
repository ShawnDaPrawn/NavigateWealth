/**
 * OverviewSkeleton.tsx
 *
 * Loading skeleton for the Client Overview Tab.
 * Extracted from ClientOverviewTab.tsx.
 */

import React from 'react';
import { Card, CardContent, CardHeader } from '../../../../../ui/card';
import { Skeleton } from '../../../../../ui/skeleton';

// ── OverviewSkeleton component ───────────────────────────────────────────

export function OverviewSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Welcome Banner skeleton */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center gap-6">
            <div className="flex items-start gap-4 flex-1">
              <Skeleton className="h-14 w-14 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-64" />
                <div className="flex gap-4 mt-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            </div>
            <Skeleton className="h-[100px] w-[100px] rounded-full" />
          </div>
        </CardContent>
      </Card>

      {/* Pillar cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gray-200" />
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-6 w-28 mb-1" />
              <Skeleton className="h-3 w-36 mb-4" />
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Action items skeleton */}
      <Card>
        <CardHeader className="pb-4 border-b border-gray-100 bg-gray-50/40">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-5 w-6 rounded-full" />
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-gray-100"
            >
              <Skeleton className="h-7 w-7 rounded-md" />
              <div className="flex-1 space-y-1.5">
                <div className="flex gap-2">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-4 w-14 rounded-full" />
                </div>
                <Skeleton className="h-3 w-64" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
