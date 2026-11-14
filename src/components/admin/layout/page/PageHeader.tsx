import type { ReactNode } from 'react';

interface PageHeaderProps {
  /** The module's sidebar label, or the record's name. */
  title: string;
  /** One line under the title. */
  description?: ReactNode;
  /** One primary button, at most two secondary ones, then a ⋯ menu. */
  actions?: ReactNode;
}

/** The heading every admin page starts with (design system: PageHeader). */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[26px] leading-tight font-semibold tracking-tight text-nw-ink">
          {title}
        </h1>
        {description && <div className="mt-1 text-sm text-nw-text-3">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
    </div>
  );
}
