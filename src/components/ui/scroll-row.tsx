import * as React from 'react';
import { cn } from './utils';
import { useTabStrip } from './use-tab-strip';

/**
 * A row of pills or buttons that scrolls sideways when it is wider than the
 * screen, with a fade at the edge that has more past it (see useTabStrip).
 */
export function ScrollRow({ className, ...props }: React.ComponentProps<'div'>) {
  const ref = useTabStrip<HTMLDivElement>();
  return <div ref={ref} className={cn('tab-strip flex items-center', className)} {...props} />;
}
