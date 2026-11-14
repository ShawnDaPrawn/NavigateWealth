import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '../../../ui/utils';
import { useTabStrip } from '../../../ui/use-tab-strip';

/**
 * Level 1 navigation inside a module: underline tabs (design system: Tabs).
 * Use with `Tabs` / `TabsContent` from ui/tabs.
 */
export function NavTabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  const stripRef = useTabStrip<HTMLDivElement>();
  return (
    <TabsPrimitive.List
      ref={stripRef}
      className={cn('tab-strip flex w-full items-end gap-1 border-b border-nw-line', className)}
      {...props}
    />
  );
}

export function NavTabsTrigger({
  className,
  count,
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger> & { count?: number }) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        '-mb-px inline-flex h-10 shrink-0 items-center gap-2 border-b-2 border-transparent px-3 text-sm font-medium whitespace-nowrap text-nw-text-2 transition-colors',
        'hover:text-nw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-violet/60',
        'data-[state=active]:border-nw-violet data-[state=active]:text-nw-violet-600',
        className,
      )}
      {...props}
    >
      {children}
      {count !== undefined && (
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-nw-count px-1.5 text-[11.5px] font-semibold tabular-nums text-nw-text-2">
          {count.toLocaleString()}
        </span>
      )}
    </TabsPrimitive.Trigger>
  );
}

/**
 * Level 2 navigation inside a tab: a segmented control that only takes the
 * width of its items (design system: SegmentedControl). When the items are
 * wider than the screen the control scrolls sideways rather than wrapping
 * into a ragged second row.
 */
export function SegmentedList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  const stripRef = useTabStrip<HTMLDivElement>();
  return (
    <TabsPrimitive.List
      ref={stripRef}
      className={cn(
        'tab-strip inline-flex w-fit max-w-full items-center gap-0.5 self-start rounded-[10px] bg-gray-100 p-1',
        className,
      )}
      {...props}
    />
  );
}

export function SegmentedTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'inline-flex h-8 shrink-0 items-center rounded-lg px-3 text-[13px] font-medium whitespace-nowrap text-nw-text-2 transition-colors',
        'hover:text-nw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-violet/60',
        'data-[state=active]:bg-white data-[state=active]:text-nw-ink data-[state=active]:shadow-sm',
        className,
      )}
      {...props}
    />
  );
}
