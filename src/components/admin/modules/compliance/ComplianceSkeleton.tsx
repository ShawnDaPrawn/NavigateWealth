import { Skeleton } from '../../../ui/skeleton';

/** Loading state for the compliance route; mirrors the ComplianceModule page. */
export function ComplianceSkeleton() {
  return (
    <div className="ds-page" role="status" aria-label="Loading compliance">
      <span className="sr-only">Loading compliance module, please wait…</span>
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      <Skeleton className="h-56 w-full rounded-xl" />
    </div>
  );
}
