import type { ReactNode } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { StatCard } from '../../../layout/page';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '../../../../ui/dropdown-menu';
import { cn } from '../../../../ui/utils';

/**
 * A StatCard that filters the list it sits above (design system: "stat cards
 * that filter act as chips"). The active card has a violet ring.
 */
export function FilterStatCard({
  active,
  onClick,
  ...card
}: React.ComponentProps<typeof StatCard> & { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-xl text-left transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-violet/60',
        '[&>div]:h-full [&>div]:transition-colors hover:[&>div]:border-violet-300',
        active && '[&>div]:border-nw-violet shadow-[0_0_0_3px_var(--nw-violet-50)]',
      )}
    >
      <StatCard {...card} />
    </button>
  );
}

/**
 * FilterChip with a menu (design system: a dashed "+ Field" chip that becomes a
 * solid violet chip once a value is set). `all` is the unset value.
 */
export function FilterChipMenu<T extends string>({
  field,
  value,
  labels,
  onChange,
}: {
  field: string;
  value: T;
  labels: Record<T, string>;
  onChange: (next: T) => void;
}) {
  const on = value !== 'all';
  let content: ReactNode;
  if (on) {
    content = (
      <>
        {field}: {labels[value]}
        <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
      </>
    );
  } else {
    content = (
      <>
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        {field}
      </>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`${field}: ${labels[value]}`}
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-violet/60',
            on
              ? 'border-violet-300 bg-nw-violet-50 font-medium text-nw-violet-600'
              : 'border-dashed border-gray-300 bg-white text-nw-text-2 hover:border-gray-400 hover:text-nw-ink',
          )}
        >
          {content}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(v as T)}>
          {(Object.keys(labels) as T[]).map((key) => (
            <DropdownMenuRadioItem key={key} value={key}>
              {labels[key]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
