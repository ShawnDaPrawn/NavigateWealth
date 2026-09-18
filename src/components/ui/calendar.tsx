/**
 * Calendar — the shared date picker, wrapping react-day-picker.
 *
 * WHY THE CLASS NAMES LOOK LIKE THIS
 * ----------------------------------
 * react-day-picker v9 renamed every element key, and this wrapper was left on
 * the v8 names long after the dependency moved: `head_row`, `head_cell`, `row`,
 * `cell`, `table`, `nav_button_*` and the `day_*` state keys are all v8. v9
 * ignores an unknown key silently, so the calendar rendered with almost no
 * styling at all — the weekday header collapsed into a run of letters, the
 * date grid did not line up under it, and the navigation arrows floated loose
 * in the middle of the box. Nothing warned about it, in the browser or in CI.
 *
 * The keys below are v9's, taken from its `UI`, `DayFlag` and `SelectionState`
 * enums. If this file is ever updated again, check those enums first — a typo
 * here is invisible rather than a build error.
 *
 * The layout is an explicit CSS grid rather than v8's flex rows: `weekdays` and
 * `week` are both 7-column grids on the same track sizing, which is what keeps
 * a weekday label centred over its column.
 */

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker } from 'react-day-picker';

import { cn } from './utils';
import { buttonVariants } from './button';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        months: 'relative flex flex-col gap-4 sm:flex-row',
        month: 'flex flex-col gap-4',

        // The caption row carries the month name; the nav is absolutely
        // positioned over it so the label stays optically centred.
        month_caption: 'flex h-9 items-center justify-center px-9',
        caption_label: 'text-sm font-medium',
        nav: 'absolute inset-x-0 top-0 flex h-9 items-center justify-between px-1',
        button_previous: cn(
          buttonVariants({ variant: 'outline' }),
          'h-7 w-7 bg-transparent p-0 opacity-60 hover:opacity-100 disabled:opacity-30',
        ),
        button_next: cn(
          buttonVariants({ variant: 'outline' }),
          'h-7 w-7 bg-transparent p-0 opacity-60 hover:opacity-100 disabled:opacity-30',
        ),

        // One grid definition, used by both header and body, so the columns
        // cannot drift apart.
        month_grid: 'w-full border-collapse',
        weekdays: 'grid grid-cols-7',
        weekday:
          'text-muted-foreground h-9 text-[0.8rem] font-normal flex items-center justify-center',
        weeks: 'flex flex-col gap-1',
        week: 'grid grid-cols-7',

        day: 'relative h-9 w-9 p-0 text-center text-sm focus-within:relative focus-within:z-20',
        day_button: cn(
          buttonVariants({ variant: 'ghost' }),
          'h-9 w-9 p-0 font-normal aria-selected:opacity-100',
        ),

        // Selection and day-state flags (SelectionState / DayFlag in v9).
        selected: cn(
          '[&>button]:bg-primary [&>button]:text-primary-foreground',
          '[&>button:hover]:bg-primary [&>button:hover]:text-primary-foreground',
          '[&>button:focus]:bg-primary [&>button:focus]:text-primary-foreground',
        ),
        range_start: 'rounded-l-md',
        range_end: 'rounded-r-md',
        range_middle: 'bg-accent [&>button]:bg-transparent [&>button]:text-accent-foreground',
        today: '[&>button]:bg-accent [&>button]:text-accent-foreground',
        outside: 'text-muted-foreground opacity-50',
        disabled: 'text-muted-foreground opacity-40',
        hidden: 'invisible',

        ...classNames,
      }}
      components={{
        // v9 replaced IconLeft/IconRight with one Chevron that is told which
        // way to point.
        Chevron: ({ orientation }) =>
          orientation === 'left' ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          ),
      }}
      {...props}
    />
  );
}
Calendar.displayName = 'Calendar';

export { Calendar };
