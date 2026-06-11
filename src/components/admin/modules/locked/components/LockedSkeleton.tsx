/**
 * LockedSkeleton — Loading placeholder for the Locked module
 *
 * §8.3 — Consistent loading states. Mirrors the centered access-gate card.
 */

import { Skeleton } from '../../../../ui/skeleton';

export function LockedSkeleton() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-lg border p-6 space-y-4">
        <div className="flex flex-col items-center space-y-2">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    </div>
  );
}
