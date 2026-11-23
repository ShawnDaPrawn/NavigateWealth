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
        'group/tab -mb-px inline-flex h-11 shrink-0 items-center gap-2 border-b-2 border-transparent px-3 text-[14px] font-medium whitespace-nowrap text-nw-text max-sm:px-2',
        'transition-[color,border-color] duration-[250ms] ease-[cubic-bezier(.2,.8,.2,1)]',
        'hover:text-nw-ink data-[state=inactive]:hover:border-nw-line-heavy',
        'data-[state=active]:border-nw-violet data-[state=active]:font-semibold data-[state=active]:text-nw-violet',
        className,
      )}
      {...props}
    >
      {children}
      {count !== undefined && (
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-[4px] bg-nw-paper-2 px-1.5 text-[11.5px] font-semibold tabular-nums text-nw-text-strong group-data-[state=active]/tab:bg-nw-violet-tint group-data-[state=active]/tab:text-nw-violet">
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
        'tab-strip inline-flex w-fit max-w-full items-center gap-0.5 self-start rounded-[4px] border border-nw-line-soft bg-nw-paper-2 p-[3px]',
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
        'inline-flex h-8 shrink-0 items-center rounded-[3px] px-3 text-[13.5px] font-medium whitespace-nowrap text-nw-text',
        'transition-[background-color,color] duration-[250ms] ease-[cubic-bezier(.2,.8,.2,1)]',
        'data-[state=inactive]:hover:bg-white/70 data-[state=inactive]:hover:text-nw-ink',
        'data-[state=active]:bg-nw-ink data-[state=active]:font-semibold data-[state=active]:text-white',
        className,
      )}
      {...props}
    />
  );
}
