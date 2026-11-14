/**
 * The Overview's detail sections. On the adviser's client page they are
 * always-open cards (design: CM 5 — "cards instead of collapsible rows");
 * the client's own dashboard keeps them as collapsible rows.
 */
import type { ReactNode } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../../../../ui/accordion';
import { cn } from '../../../../../ui/utils';

export function OverviewPanels({ asCards, children }: { asCards: boolean; children: ReactNode }) {
  if (asCards) {
    return <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{children}</div>;
  }
  return (
    <Accordion type="multiple" defaultValue={[]} className="space-y-3">
      {children}
    </Accordion>
  );
}

export function OverviewPanel({
  value,
  asCard,
  header,
  wide = false,
  children,
}: {
  value: string;
  asCard: boolean;
  header: ReactNode;
  /** Spans both columns of the card grid. */
  wide?: boolean;
  children: ReactNode;
}) {
  if (asCard) {
    return (
      <section
        aria-labelledby={`overview-${value}`}
        className={cn(
          'overflow-hidden rounded-xl border border-nw-line bg-white',
          wide && 'lg:col-span-2',
        )}
      >
        <div
          id={`overview-${value}`}
          className="flex min-w-0 items-center gap-3 border-b border-nw-line-2 px-5 py-3.5"
        >
          {header}
        </div>
        {children}
      </section>
    );
  }
  return (
    <AccordionItem
      value={value}
      className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
    >
      <AccordionTrigger className="bg-gray-50/40 px-5 py-3.5 hover:bg-gray-50/60 hover:no-underline data-[state=open]:border-b data-[state=open]:border-gray-100">
        <div className="flex min-w-0 flex-1 items-center gap-3">{header}</div>
      </AccordionTrigger>
      <AccordionContent className="px-0 pb-0">{children}</AccordionContent>
    </AccordionItem>
  );
}
