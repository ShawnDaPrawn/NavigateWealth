import { Skeleton } from '../../../ui/skeleton';

/** Loading state for the compliance route; mirrors the ComplianceModule page. */
export function ComplianceSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-[1800px] space-y-6 p-6 lg:p-8"
      role="status"
      aria-label="Loading compliance"
    >
      <span className="sr-only">Loading compliance module, please wait…</span>
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      <Skeleton className="h-56 w-full rounded-xl" />
    </div>
  );
}
