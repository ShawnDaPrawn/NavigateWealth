import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Loader2, Mail } from 'lucide-react';
import { Button } from '../../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import { NewsletterCard } from './NewsletterCard';
import {
  buildYearTabs,
  defaultYear,
  groupByMonth,
  selectableYears,
  yearsWithNewsletters,
  type PublicNewsletter,
} from './newsletterArchive';

/**
 * The Newsletters archive on the Resources page.
 *
 * Years across the top — this year and the three before it — with the five
 * years before those behind an "Older" dropdown, all derived from the clock
 * so the strip shifts by itself every 1 January. Within a year, only the
 * months that actually have an issue are listed.
 */
export function NewslettersTab({
  newsletters,
  isLoading,
  now = new Date(),
}: {
  newsletters: PublicNewsletter[];
  isLoading: boolean;
  /** Injected in tests to pin the clock; production reads the real one. */
  now?: Date;
}) {
  const years = useMemo(() => yearsWithNewsletters(newsletters), [newsletters]);
  const tabs = useMemo(() => buildYearTabs(now, years), [now, years]);
  const reachable = useMemo(() => selectableYears(tabs), [tabs]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  // Follow the data: the first load, and any later change that drops the
  // selected year out of reach, lands on the newest year there is.
  useEffect(() => {
    setSelectedYear((current) =>
      current !== null && reachable.includes(current) ? current : defaultYear(tabs),
    );
  }, [reachable, tabs]);

  const months = useMemo(
    () => (selectedYear === null ? [] : groupByMonth(newsletters, selectedYear)),
    [newsletters, selectedYear],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading newsletters…
      </div>
    );
  }

  if (newsletters.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white/60 px-6 py-16 text-center">
        <Mail className="mx-auto h-8 w-8 text-gray-400" />
        <h3 className="mt-4 text-lg font-semibold text-gray-900">No newsletters yet</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
          Our newsletters will appear here as they are published. Subscribe at the bottom of any
          page to get each one by email.
        </p>
      </div>
    );
  }

  const olderSelected = selectedYear !== null && tabs.older.includes(selectedYear);

  return (
    <div className="space-y-8">
      <div
        className="flex flex-wrap items-center gap-2"
        role="tablist"
        aria-label="Newsletter years"
      >
        {tabs.primary.map((year) => (
          <Button
            key={year}
            role="tab"
            aria-selected={selectedYear === year}
            variant={selectedYear === year ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedYear(year)}
          >
            {year}
          </Button>
        ))}

        {tabs.older.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant={olderSelected ? 'default' : 'outline'}
                size="sm"
                aria-label="Older years"
              >
                {olderSelected ? selectedYear : 'Older'}
                <ChevronDown className="ml-1 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {tabs.older.map((year) => (
                <DropdownMenuItem key={year} onSelect={() => setSelectedYear(year)}>
                  {year}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {months.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-600">
          No newsletters for {selectedYear}.
        </p>
      ) : (
        months.map((group) => (
          <section key={group.month} className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              {group.label} {selectedYear}
            </h3>
            <div className="space-y-3">
              {group.items.map((item) => (
                <NewsletterCard key={item.slug} newsletter={item} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

export default NewslettersTab;
