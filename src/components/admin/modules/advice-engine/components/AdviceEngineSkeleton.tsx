import React from 'react';
import { Skeleton } from '../../../../ui/skeleton';

/**
 * AdviceEngineSkeleton
 *
 * Mirrors the AdviceEngineModule layout:
 * - Header (title + subtitle)
 * - 2-column tab bar (Ask Vasco / Draft RoA)
 * - Chat interface area
 */

export function AdviceEngineSkeleton() {
  return (
    <div className="space-y-6 p-6" role="status" aria-label="Loading advice engine">
      <span className="sr-only">Loading advice engine, please wait…</span>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-44 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
      </div>

      {/* Tabs */}
      <div className="space-y-6">
        <div className="grid w-full grid-cols-2 h-10 rounded-md bg-muted p-1">
          <Skeleton className="h-full rounded-sm" />
          <Skeleton className="h-full rounded-sm bg-transparent" />
        </div>

        {/* Chat interface skeleton */}
        <div className="rounded-lg border border-border bg-white p-6 space-y-4">
          {/* System message */}
          <div className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>

          {/* Spacer area for messages */}
          <div className="h-[300px]" />

          {/* Input area */}
          <div className="flex items-center gap-2 border-t pt-4">
            <Skeleton className="h-10 flex-1 rounded-md" />
            <Skeleton className="h-10 w-10 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}