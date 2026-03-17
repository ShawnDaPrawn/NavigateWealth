/**
 * AIManagementSkeleton
 *
 * Mirrors the AIManagementModule layout for stable paint before the
 * JS chunk loads. Matches the established skeleton pattern (§8.1).
 */

import React from 'react';
import { Skeleton } from '../../../../ui/skeleton';

export function AIManagementSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50/30 pb-10">
      <div className="max-w-[1800px] mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex items-end justify-between pb-4 border-b border-gray-200/60">
          <div className="space-y-2">
            <Skeleton className="h-9 w-72" />
            <Skeleton className="h-5 w-96" />
          </div>
          <Skeleton className="h-10 w-28 rounded-md" />
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-10 w-28 rounded-lg" />
          ))}
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>

        {/* Agent cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <div className="flex gap-2 pt-2">
                <Skeleton className="h-6 w-16 rounded" />
                <Skeleton className="h-6 w-16 rounded" />
                <Skeleton className="h-6 w-16 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
