/**
 * Loading chrome for the FNA Intake Queue card.
 *
 * Rendered both as the Suspense fallback while the queue chunk loads and by
 * the queue itself while it fetches, so the two states are pixel-identical
 * and the stat cards and client table below never move.
 *
 * The results area reserves the height of one intake row in every state
 * (loading, empty, populated) and scrolls once it holds more than a few rows,
 * so finishing a load never resizes the card.
 */

import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { Skeleton } from '../../../../ui/skeleton';

/** Shared sizing for the list region: one-row minimum, bounded maximum, scroll beyond. */
export const INTAKE_RESULTS_CLASS = 'min-h-[94px] max-h-[22rem] space-y-3 overflow-y-auto';

/** Mirrors the structure and padding of a real intake row so heights line up. */
function IntakeRowSkeleton() {
  return (
    <div
      className="flex flex-col gap-3 rounded-lg border border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between"
      aria-hidden="true"
    >
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-[18px] w-20 rounded-full" />
          <Skeleton className="h-[18px] w-24 rounded-full" />
        </div>
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-8 w-28 rounded-md" />
        <Skeleton className="h-8 w-40 rounded-md" />
      </div>
    </div>
  );
}

export function FNAIntakeQueueTitle({ loading }: { loading: boolean }) {
  return (
    <CardTitle className="flex items-center gap-2 text-base">
      FNA Intake Queue
      {loading && (
        <span
          className="inline-flex items-center gap-1.5 text-xs font-normal text-gray-500"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-600" aria-hidden="true" />
          Loading intakes…
        </span>
      )}
    </CardTitle>
  );
}

export function FNAIntakeQueueSkeleton() {
  return (
    <Card className="border-gray-200" aria-busy="true">
      <CardHeader>
        <FNAIntakeQueueTitle loading />
      </CardHeader>
      <CardContent>
        <div className={INTAKE_RESULTS_CLASS}>
          <IntakeRowSkeleton />
        </div>
      </CardContent>
    </Card>
  );
}
