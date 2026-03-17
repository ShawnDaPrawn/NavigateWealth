/**
 * SubmissionsSkeleton
 *
 * Mirrors the SubmissionsModule layout for stable paint before the
 * JS chunk loads. Matches the Task Management skeleton pattern.
 */

import React from 'react';
import { Skeleton } from '../../../../ui/skeleton';

export function SubmissionsSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50/30 pb-10">
      <div className="max-w-[1800px] mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex items-end justify-between pb-4 border-b border-gray-200/60">
          <div className="space-y-2">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-5 w-96" />
          </div>
          <Skeleton className="h-10 w-28 rounded-md" />
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
              <Skeleton className="h-8 w-12" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div className="bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-2 max-w-3xl">
          <Skeleton className="h-10 flex-1 rounded-lg" />
          <Skeleton className="h-10 w-[180px] rounded-lg" />
        </div>

        {/* Kanban board */}
        <div className="flex gap-6 h-[500px]">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex-1 min-w-[350px] rounded-xl bg-gray-100/50 border border-gray-200">
              <div className="p-3 bg-white rounded-t-xl border-b flex items-center justify-between">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-6 rounded-md" />
              </div>
              <div className="p-3 space-y-3">
                {[1, 2].map(j => (
                  <div key={j} className="bg-white rounded-lg border border-gray-200 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Skeleton className="h-8 w-8 rounded-lg" />
                        <div className="space-y-1">
                          <Skeleton className="h-3 w-16" />
                          <Skeleton className="h-3.5 w-24" />
                        </div>
                      </div>
                      <Skeleton className="h-4 w-4 rounded" />
                    </div>
                    <Skeleton className="h-3 w-3/4" />
                    <div className="pt-2 border-t border-gray-100">
                      <Skeleton className="h-7 w-24 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}