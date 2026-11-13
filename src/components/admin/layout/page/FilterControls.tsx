import type { ReactNode } from 'react';
import { Check, ChevronDown, Plus } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../ui/dropdown-menu';
import { cn } from '../../../ui/utils';

export interface FilterChipOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

/**
 * One filter in a list toolbar (design system: FilterChip). Unset, it reads
 * "+ Label"; set, it is a solid violet chip "Label: Value". Picking the
 * "All" entry clears it.
 */
export function FilterChip<T extends string>({
  label,
  value,
  allValue,
  allLabel = 'All',
  options,
  onChange,
}: {
  label: string;
  value: T;
  /** The value that means "not filtered". */
  allValue: T;
  allLabel?: string;
  options: FilterChipOption<T>[];
  onChange: (next: T) => void;
}) {
  const active = value !== allValue;
  const current = options.find((option) => option.value === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={
            active ? `${label}: ${current?.label ?? value}` : `Filter by ${label.toLowerCase()}`
          }
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium whitespace-nowrap transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-violet/60',
            active
              ? 'border-nw-violet bg-nw-violet text-white hover:bg-nw-violet-hover'
              : 'border-dashed border-gray-400 bg-white text-nw-text-2 hover:text-nw-ink',
          )}
        >
          {active ? (
            <>
              {label}: {current?.label ?? value}
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            </>
          ) : (
            <>
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              {label}
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 min-w-44 overflow-y-auto">
        {[{ value: allValue, label: allLabel } as FilterChipOption<T>, ...options].map((option) => (
          <DropdownMenuItem
            key={option.value}
            onSelect={() => onChange(option.value)}
            className="flex items-center gap-2"
          >
            <Check
              className={cn('h-3.5 w-3.5', option.value === value ? 'opacity-100' : 'opacity-0')}
              aria-hidden="true"
            />
            <span className="flex-1">{option.label}</span>
            {option.count !== undefined && (
              <span className="text-xs tabular-nums text-nw-text-3">{option.count}</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** "Clear filters" — shown once any filter in the toolbar is set. */
export function ClearFiltersButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-8 rounded px-2 text-[13px] font-medium text-nw-violet-600 hover:text-nw-violet hover:underline"
    >
      Clear filters
    </button>
  );
}

/**
 * A stat card that also filters the list under it (design system: stat cards
 * that filter act as chips). Same look as StatCard; pressed when active.
 */
export function FilterStatCard({
  label,
  value,
  meta,
  tone = 'default',
  active,
  onClick,
}: {
  label: string;
  value: ReactNode;
  meta?: ReactNode;
  tone?: 'default' | 'attention';
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'rounded-xl border bg-white px-4 py-4 text-left transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-violet/60',
        active ? 'border-nw-violet ring-1 ring-nw-violet' : 'border-nw-line hover:border-gray-300',
      )}
    >
      <span className="block text-[13px] text-nw-text-2">{label}</span>
      <span className="mt-1 block text-2xl font-semibold tabular-nums text-nw-ink">{value}</span>
      {meta && (
        <span
          className={cn(
            'mt-1 block text-xs',
            tone === 'attention' ? 'text-nw-amber-700' : 'text-nw-text-3',
          )}
        >
          {meta}
        </span>
      )}
    </button>
  );
}

/** "‹ Back to …" at the top of a record page. */
export function BackLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex w-fit items-center gap-1 rounded text-sm text-nw-text-2 hover:text-nw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-violet/60"
    >
      <span aria-hidden="true">‹</span>
      {label}
    </button>
  );
}
