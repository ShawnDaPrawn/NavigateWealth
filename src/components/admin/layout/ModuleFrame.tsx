import { Suspense, type ReactNode } from 'react';
import { ErrorBoundary } from '../../shared/ErrorBoundary';
import { Button } from '../../ui/button';
import { ErrorState, ModuleSkeleton, NoAccess } from './page';
import { moduleConfig } from './config';
import type { AdminModule } from './types';

/**
 * How every admin module loads and fails (design system: one skeleton
 * pattern, one error state with Try again and Show details).
 */
export function ModuleFrame({
  module,
  children,
  allowed = true,
  onBackToDashboard,
}: {
  module: AdminModule;
  children: ReactNode;
  /** False when the person's role can't use this module (reached by a direct link). */
  allowed?: boolean;
  onBackToDashboard?: () => void;
}) {
  const label = moduleConfig[module]?.label ?? 'this page';
  if (!allowed) {
    return (
      <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-6 p-6 lg:p-8">
        <NoAccess
          what={label}
          action={
            onBackToDashboard ? (
              <Button variant="outline" onClick={onBackToDashboard}>
                Back to Dashboard
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }
  return (
    <Suspense fallback={<ModuleSkeleton title={label} />}>
      <ErrorBoundary
        fallbackTitle={`${label} error`}
        renderFallback={({ error, reset, reload, isStaleChunk }) => (
          <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-6 p-6 lg:p-8">
            <h1 className="text-[26px] leading-tight font-semibold tracking-tight text-nw-ink">
              {label}
            </h1>
            <ErrorState
              title={isStaleChunk ? 'A new version is available' : `Unable to load ${label}`}
              description={
                isStaleChunk
                  ? 'Refresh the page to load the latest version. Nothing you entered was lost.'
                  : 'Something went wrong while loading this page. Nothing you entered was lost.'
              }
              onRetry={isStaleChunk ? reload : reset}
              retryLabel={isStaleChunk ? 'Refresh' : 'Try again'}
              details={isStaleChunk ? undefined : error?.message || undefined}
            />
          </div>
        )}
      >
        {children}
      </ErrorBoundary>
    </Suspense>
  );
}
