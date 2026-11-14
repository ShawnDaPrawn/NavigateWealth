import { useEffect, useState } from 'react';
import { Skeleton } from '../../../ui/skeleton';
import { ErrorState } from './ErrorState';

interface ModuleSkeletonProps {
  /** The module's sidebar label; the header shows it straight away. */
  title: string;
  /** How long to wait before showing the error state. */
  timeoutMs?: number;
}

/**
 * The one loading pattern for every admin module (design system: Skeleton):
 * the header renders immediately, tabs, figures and rows are grey shapes,
 * and after ten seconds the area switches to the error state.
 */
export function ModuleSkeleton({ title, timeoutMs = 10_000 }: ModuleSkeletonProps) {
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setTimedOut(true), timeoutMs);
    return () => window.clearTimeout(t);
  }, [timeoutMs]);

  return (
    <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-6 p-6 lg:p-8">
      <div>
        <h1 className="text-[26px] leading-tight font-semibold tracking-tight text-nw-ink">
          {title}
        </h1>
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      {timedOut ? (
        <ErrorState
          title={`Unable to load ${title}`}
          description="This is taking longer than it should. Nothing you entered was lost."
          onRetry={() => window.location.reload()}
        />
      ) : (
        <div aria-busy="true" aria-label={`Loading ${title}`} className="flex flex-col gap-6">
          <div className="flex gap-6 border-b border-nw-line pb-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-4 w-20" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[88px] rounded-xl" />
            ))}
          </div>
          <div className="rounded-xl border border-nw-line bg-white p-4">
            <Skeleton className="mb-4 h-9 w-full max-w-sm" />
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="mb-3 h-10 w-full" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
