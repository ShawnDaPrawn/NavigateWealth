/**
 * FNAFormSection — one titled group of fields in an FNA information step.
 *
 * Design system "long form" pattern: the section title (Inter; Newsreader is for
 * page and dialog titles only, see docs/STATUS.md) sits down the left with
 * the fields to its right; on a phone the title stacks above the fields.
 * Sections go inside <FNAFormPanel>, which draws one card with hairlines
 * between them (no card inside a card).
 */

import React from 'react';

interface FNAFormSectionProps {
  title: string;
  description?: React.ReactNode;
  /** Shown beside the title on wide screens, under it on a phone. */
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function FNAFormPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="divide-y divide-nw-line-soft rounded-lg border border-nw-line bg-white">
      {children}
    </div>
  );
}

export function FNAFormSection({ title, description, actions, children }: FNAFormSectionProps) {
  return (
    <section className="flex flex-col gap-4 p-4 sm:p-6 lg:flex-row lg:gap-8">
      <div className="flex flex-col gap-1 lg:w-52 lg:flex-none">
        <h3 className="text-[15px] leading-[22px] font-semibold text-nw-ink">{title}</h3>
        {description && <p className="text-[13px] leading-[18px] text-nw-muted">{description}</p>}
        {actions && <div className="mt-2">{actions}</div>}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </section>
  );
}

/** A small hint under a field: a derived value or what to enter. */
export function FNAFieldHint({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] leading-[18px] text-nw-muted tabular-nums">{children}</p>;
}
