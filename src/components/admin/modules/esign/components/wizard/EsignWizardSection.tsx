/**
 * One content block inside a wizard step.
 *
 * Every step is a short stack of these, so a section header looks the same
 * whether it is introducing an upload zone or a recipient list. Steps that
 * hand-rolled their own card + heading markup drifted apart; this keeps the
 * spacing, the type scale and the icon treatment in one place.
 */
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import { Card, CardContent } from '../../../../../ui/card';
import { cn } from '../../../../../ui/utils';

interface EsignWizardSectionProps {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  /** Rendered on the right of the section header — a count, a small button. */
  action?: ReactNode;
  /** Drop the card chrome; useful when the child already draws its own. */
  bare?: boolean;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}

export function EsignWizardSection({
  title,
  description,
  icon: Icon,
  action,
  bare = false,
  className,
  contentClassName,
  children,
}: EsignWizardSectionProps) {
  const header = (title || description || action) && (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        {Icon && (
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
        <div className="space-y-0.5">
          {/* h4, not h3: globals.css forces every `h3[class*='text-']` to 20px
              with !important, which would flatten this against the step's own
              heading. `CardTitle` sidesteps the same rule the same way. */}
          {title && <h4 className="text-base font-semibold text-gray-900">{title}</h4>}
          {description && <p className="text-sm text-gray-500">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );

  const body = (
    <div className={cn('space-y-4', contentClassName)}>
      {header}
      {children}
    </div>
  );

  if (bare) return <div className={className}>{body}</div>;

  return (
    <Card className={cn('border-gray-200 shadow-sm', className)}>
      <CardContent className="p-5 sm:p-6">{body}</CardContent>
    </Card>
  );
}
