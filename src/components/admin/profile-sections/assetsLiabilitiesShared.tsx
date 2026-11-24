/**
 * Shared parts of the admin assets & liabilities section (design: the
 * "Assets & liabilities redesign" canvas): the net-worth strip, the card
 * that holds each table, the source badge, the row actions menu and the
 * empty state. Pure presentation; every value comes from props.
 */
import type { ReactNode } from 'react';
import { Link2, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '../../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';

/** Table cell classes, shared so both tables line up. */
export const TH =
  'border-b border-nw-line-soft px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-nw-muted first:pl-5';
export const TH_NUM = `${TH} text-right`;
export const TD =
  'border-b border-nw-line-soft px-4 py-3.5 align-top text-nw-text-strong first:pl-5';
export const TD_NUM = `${TD} whitespace-nowrap text-right tabular-nums text-nw-ink`;
export const TD_ACTIONS = `${TD} w-[132px] whitespace-nowrap py-2 pr-5 text-right align-middle`;

function StripCell({
  label,
  value,
  meta,
  negative = false,
  emphasis = false,
}: {
  label: string;
  value: string;
  meta?: string;
  negative?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`flex min-w-0 flex-1 basis-[200px] flex-col gap-1.5 px-6 py-5 ${
        emphasis ? 'border-l border-nw-line-soft bg-nw-paper-3' : ''
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-nw-muted">{label}</p>
      <p
        className={`text-[28px] leading-[34px] tracking-[-0.01em] tabular-nums ${
          emphasis ? 'font-medium' : ''
        } ${negative ? 'text-red-700' : 'text-nw-ink'}`}
      >
        {value}
      </p>
      {meta && <p className="text-[13px] leading-[18px] text-nw-muted">{meta}</p>}
    </div>
  );
}

function Operator({ symbol }: { symbol: string }) {
  return (
    <div aria-hidden="true" className="hidden w-8 shrink-0 items-center justify-center sm:flex">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-nw-paper-2 text-lg leading-none text-nw-text">
        {symbol}
      </span>
    </div>
  );
}

/** Assets − Liabilities = Net worth, in one card. */
export function NetWorthStrip({
  assets,
  assetsMeta,
  liabilities,
  liabilitiesMeta,
  netWorth,
  netWorthNegative,
}: {
  assets: string;
  assetsMeta: string;
  liabilities: string;
  liabilitiesMeta: string;
  netWorth: string;
  netWorthNegative: boolean;
}) {
  return (
    <section
      aria-label="Net worth"
      className="flex flex-wrap items-stretch overflow-hidden rounded-lg border border-nw-line bg-white"
    >
      <StripCell label="Assets" value={assets} meta={assetsMeta} />
      <Operator symbol="−" />
      <StripCell label="Liabilities" value={liabilities} meta={liabilitiesMeta} />
      <Operator symbol="=" />
      <StripCell label="Net worth" value={netWorth} negative={netWorthNegative} emphasis />
    </section>
  );
}

/** A white card with a serif title, an optional line under it and one add button. */
export function BalanceCard({
  id,
  title,
  description,
  addLabel,
  onAdd,
  addDisabled,
  addTitle,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  addLabel: string;
  onAdd: () => void;
  addDisabled?: boolean;
  addTitle?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="overflow-hidden rounded-lg border border-nw-line bg-white"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-nw-line-soft px-5 py-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2
            id={id}
            className="font-serif text-xl leading-[26px] font-medium tracking-[-0.012em] text-nw-ink"
          >
            {title}
          </h2>
          {description && <p className="text-[13px] leading-[18px] text-nw-muted">{description}</p>}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onAdd}
          disabled={addDisabled}
          title={addTitle}
          className="disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {addLabel}
        </Button>
      </div>
      {children}
    </section>
  );
}

/** Where a row comes from: captured here, or read from the policy register. */
export function SourceBadge({ linked }: { linked: boolean }) {
  return linked ? (
    <span className="inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded border border-nw-line bg-nw-paper px-2 text-xs font-semibold text-nw-text">
      <Link2 className="h-3 w-3" aria-hidden="true" />
      From policies
    </span>
  ) : (
    <span className="inline-flex h-[22px] items-center whitespace-nowrap rounded border border-nw-line bg-white px-2 text-xs font-semibold text-nw-text">
      Added here
    </span>
  );
}

/** ⋯ on a row: Edit, then Delete. */
export function RowActionsMenu({
  name,
  onEdit,
  onDelete,
}: {
  name: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-nw-muted hover:text-nw-ink"
          aria-label={`Actions for ${name}`}
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** "No <things> yet", one line, and the button that adds the first one. */
export function PanelEmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
      <span
        aria-hidden="true"
        className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-nw-paper-2 text-nw-muted"
      >
        <Icon className="h-[22px] w-[22px]" />
      </span>
      <p className="font-serif text-xl leading-[26px] font-medium text-nw-ink">{title}</p>
      <p className="max-w-sm text-[13px] leading-[18px] text-nw-muted">{description}</p>
      <Button variant="outline" size="sm" onClick={onAction} className="mt-2">
        <Plus className="h-4 w-4" aria-hidden="true" />
        {actionLabel}
      </Button>
    </div>
  );
}
