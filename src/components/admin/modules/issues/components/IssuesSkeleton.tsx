import { Skeleton } from '../../../../ui/skeleton';

/** Mirrors the Issue Manager layout: header, four view cards, then the list. */
export function IssuesSkeleton() {
  return (
    <div className="mx-auto max-w-[1800px] space-y-6 p-6">
      <div className="space-y-2 border-b border-gray-200/60 pb-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-96 max-w-full" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Skeleton className="h-[122px] rounded-xl" />
        <Skeleton className="h-[122px] rounded-xl" />
        <Skeleton className="h-[122px] rounded-xl" />
        <Skeleton className="h-[122px] rounded-xl" />
      </div>
      <div className="space-y-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex gap-3">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-9 w-40" />
        </div>
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    </div>
  );
}
