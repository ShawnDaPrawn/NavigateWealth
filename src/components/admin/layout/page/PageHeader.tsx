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
    <div className="ds-ph">
      <div className="min-w-0">
        {/* On a phone the top bar already shows the title (Phone board). */}
        <h1 className="max-sm:sr-only">{title}</h1>
        {description && <div className="ds-ph-desc max-sm:!mt-0">{description}</div>}
      </div>
      {viewOnly ? (
        <span className="ds-pill">View only</span>
      ) : (
        actions && <div className="ds-ph-actions">{actions}</div>
      )}
    </div>
  );
}
