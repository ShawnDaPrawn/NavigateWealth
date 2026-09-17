/**
 * Newsletter — choose who receives it.
 *
 * A checkbox list of the communication groups. "Newsletter Contacts" (every
 * confirmed subscriber) is the default and sits first. Membership is managed
 * in Communication → Groups; this picker only chooses among them.
 */
import { Users } from 'lucide-react';
import { Checkbox } from '../../../../ui/checkbox';
import { Skeleton } from '../../../../ui/skeleton';
import { cn } from '../../../../ui/utils';
import { SUBSCRIBER_LIST_ID } from '../constants';
import type { NewsletterListView } from '../types';
import { formatNumber, pluralize } from '../utils/format';

export function AudiencePicker({
  lists,
  loading,
  value,
  onChange,
  disabled,
}: {
  lists: NewsletterListView[];
  loading?: boolean;
  value: string[];
  onChange: (listIds: string[]) => void;
  disabled?: boolean;
}) {
  const toggle = (id: string, checked: boolean) => {
    if (checked) onChange(value.includes(id) ? value : [...value, id]);
    else onChange(value.filter((v) => v !== id));
  };

  const reach = lists
    .filter((list) => value.includes(list.id))
    .reduce((sum, list) => sum + list.memberCount, 0);

  return (
    <div className="space-y-2">
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      ) : lists.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No audiences yet. Create a group in Communication → Groups first.
        </p>
      ) : (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60">
          {lists.map((list) => {
            const checked = value.includes(list.id);
            const inputId = `nl-audience-${list.id}`;
            return (
              <li key={list.id}>
                <label
                  htmlFor={inputId}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors',
                    checked ? 'bg-purple-50/60 dark:bg-purple-950/20' : 'hover:bg-muted/40',
                    disabled && 'cursor-not-allowed opacity-60',
                  )}
                >
                  <Checkbox
                    id={inputId}
                    checked={checked}
                    disabled={disabled}
                    onCheckedChange={(next) => toggle(list.id, next === true)}
                    aria-label={list.name}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{list.name}</span>
                      {list.id === SUBSCRIBER_LIST_ID ? (
                        <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-purple-700 dark:bg-purple-900/50 dark:text-purple-200">
                          Default
                        </span>
                      ) : list.type === 'system' ? (
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Built-in
                        </span>
                      ) : null}
                    </span>
                    {list.description ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {list.description}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {pluralize(list.memberCount, 'member')}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Users className="h-3.5 w-3.5" aria-hidden />
        {value.length === 0
          ? 'No audience chosen — this newsletter can still be published on the website without being emailed.'
          : `About ${formatNumber(reach)} recipients before de-duplication and opt-outs. Manage membership in Communication → Groups.`}
      </p>
    </div>
  );
}
