import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '../../../ui/utils';

/**
 * Level 1 navigation inside a module: underline tabs (design system: Tabs).
 * Use with `Tabs` / `TabsContent` from ui/tabs.
 */
export function NavTabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        'flex w-full items-end gap-1 overflow-x-auto border-b border-nw-line',
        className,
      )}
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
 * width of its items (design system: SegmentedControl).
 */
export function SegmentedList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        'inline-flex w-fit max-w-full flex-wrap items-center gap-0.5 self-start rounded-[10px] bg-gray-100 p-1',
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
        'inline-flex h-8 items-center rounded-lg px-3 text-[13px] font-medium whitespace-nowrap text-nw-text-2 transition-colors',
        'hover:text-nw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-violet/60',
        'data-[state=active]:bg-white data-[state=active]:text-nw-ink data-[state=active]:shadow-sm',
        className,
      )}
      {...props}
    />
  );
}
