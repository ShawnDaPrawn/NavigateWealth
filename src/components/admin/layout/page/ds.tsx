/**
 * The redesign's building blocks, rendered with the design system's own
 * classes (src/styles/admin-ds.css) so screens match the boards exactly.
 */
import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../../ui/utils';

/* ---------- page ---------- */

/** The page column every module screen sits in (.page: 1440 wide, 20px gaps). */
export function DsPage({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('ds-page', className)} {...rest} />;
}

/** A titled block on a page (h2 15px semibold over its content). */
export function DsSection({
  title,
  actions,
  children,
  className,
  titleId,
}: {
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  titleId?: string;
}) {
  return (
    <section aria-labelledby={titleId} className={cn('ds-section', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={titleId} className="ds-h2">
          {title}
        </h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

/* ---------- buttons ---------- */

type DsButtonVariant = 'default' | 'primary' | 'ghost' | 'danger';

interface DsButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: DsButtonVariant;
  size?: 'default' | 'sm';
}

/** .btn — 38px (32px small), the site's hover and press behaviour. */
export const DsButton = forwardRef<HTMLButtonElement, DsButtonProps>(function DsButton(
  { variant = 'default', size = 'default', className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'ds-btn',
        size === 'sm' && 'ds-btn-sm',
        variant === 'primary' && 'ds-btn-primary',
        variant === 'ghost' && 'ds-btn-ghost',
        variant === 'danger' && 'ds-btn-danger',
        className,
      )}
      {...rest}
    />
  );
});

/* ---------- surfaces ---------- */

export function DsCard({ className, ...rest }: HTMLAttributes<HTMLElement>) {
  return <section className={cn('ds-card', className)} {...rest} />;
}

/** Card heading row: title on the left, actions on the right. */
export function DsCardHead({
  title,
  actions,
  as: Heading = 'h2',
  className,
}: {
  title: ReactNode;
  actions?: ReactNode;
  as?: 'h2' | 'h3';
  className?: string;
}) {
  return (
    <div className={cn('ds-card-h', className)}>
      <Heading>{title}</Heading>
      {actions && <div className="flex flex-wrap items-center gap-1.5">{actions}</div>}
    </div>
  );
}

export function DsCardBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('ds-card-b', className)} {...rest} />;
}

/* ---------- figures ---------- */

export function DsStats({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('ds-stats', className)} {...rest} />;
}

interface DsStatProps {
  label: ReactNode;
  value: ReactNode;
  meta?: ReactNode;
  /** Makes the figure a filter: clicking it selects it. */
  onClick?: () => void;
  selected?: boolean;
  className?: string;
}

/** .stat — label, number, one line under it. A button when it filters. */
export function DsStat({ label, value, meta, onClick, selected, className }: DsStatProps) {
  const body = (
    <>
      <span className="k">{label}</span>
      <span className="v">{value}</span>
      {meta && <span className="m">{meta}</span>}
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        aria-pressed={selected}
        onClick={onClick}
        className={cn('ds-stat', selected && 'on', className)}
      >
        {body}
      </button>
    );
  }
  return <div className={cn('ds-stat', className)}>{body}</div>;
}

/* ---------- small parts ---------- */

export type DsTone = 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'brand';

/** .pill — a status with a dot. */
export function DsPill({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: DsTone;
  className?: string;
  children: ReactNode;
}) {
  return <span className={cn('ds-pill', tone !== 'neutral' && tone, className)}>{children}</span>;
}

/** .count — a number beside a tab or heading. */
export function DsCount({
  attention,
  className,
  children,
}: {
  attention?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return <span className={cn('ds-count', attention && 'attn', className)}>{children}</span>;
}

/** .seg — a segmented switch. */
export function DsSegmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<{ value: T; label: ReactNode }>;
  label: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn('ds-seg', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** .state — an empty, no-match or error message inside a card. */
export function DsState({
  icon,
  title,
  children,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('ds-state', className)}>
      {icon && (
        <div className="ico" aria-hidden="true">
          {icon}
        </div>
      )}
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

/** .meta — grey supporting text. */
export function DsMeta({ className, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn('ds-meta', className)} {...rest} />;
}
