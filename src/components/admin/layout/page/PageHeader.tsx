import type { ReactNode } from 'react';

interface PageHeaderProps {
  /** The module's sidebar label, or the record's name. */
  title: string;
  /** One line under the title. */
  description?: ReactNode;
  /** One primary button, at most two secondary ones, then a ⋯ menu. */
  actions?: ReactNode;
  /**
   * The person can see but not change this page: shows a "View only" pill
   * in place of the actions (design system: View only).
   */
  viewOnly?: boolean;
}

/** The heading every admin page starts with (design system: PageHeader). */
export function PageHeader({ title, description, actions, viewOnly }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {/* On a phone the top bar already shows the title (PH-* boards). */}
        <h1 className="text-[26px] leading-tight font-semibold tracking-tight text-nw-ink max-sm:sr-only">
          {title}
        </h1>
        {description && <div className="mt-1 text-sm text-nw-text-3">{description}</div>}
      </div>
      {viewOnly ? (
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-nw-bg px-2.5 py-0.5 text-xs font-medium text-nw-text-2">
          <span className="h-1.5 w-1.5 rounded-full bg-nw-text-3" aria-hidden="true" />
          View only
        </span>
      ) : (
        actions && (
          <div className="flex flex-wrap items-center gap-2 max-sm:w-full max-sm:[&>*:first-child]:flex-1 sm:justify-end">
            {actions}
          </div>
        )
      )}
    </div>
  );
}
