import { Skeleton } from '../../../ui/skeleton';

/** Loading state for the compliance route; mirrors the ComplianceModule shell. */
export function ComplianceSkeleton() {
  return (
    <div
      className="flex h-full w-full flex-col bg-slate-50/50"
      role="status"
      aria-label="Loading compliance"
    >
      <span className="sr-only">Loading compliance module, please wait…</span>
      <div className="shrink-0 border-b bg-white px-6 py-4 shadow-sm">
        <Skeleton className="h-8 w-40" />
      </div>
    </div>
  );
}
