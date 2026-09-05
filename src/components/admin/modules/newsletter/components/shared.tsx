/**
 * Newsletter Studio — small presentational building blocks shared across
 * tabs: empty/error states, KPI tiles, section headings and filter chips.
 * Keeping them here keeps every studio view visually consistent.
 */
import type { ComponentType, ReactNode } from 'react';
import { AlertTriangle, type LucideProps, RefreshCw } from 'lucide-react';
import { Button } from '../../../../ui/button';
import { Card, CardContent } from '../../../../ui/card';
import { cn } from '../../../../ui/utils';

type IconType = ComponentType<LucideProps>;

// ── Empty & error states ─────────────────────────────────────────────────────

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  compact = false,
  className,
}: {
  icon: IconType;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'px-4 py-8' : 'px-6 py-14',
        className,
      )}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-300">
        <Icon className="h-6 w-6" aria-hidden />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action || secondaryAction ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  description,
  onRetry,
  retrying = false,
}: {
  title?: string;
  description?: ReactNode;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  return (
    <Card>
      <CardContent className="py-10">
        <div className="flex flex-col items-center text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">
            <AlertTriangle className="h-5 w-5" aria-hidden />
          </div>
          <h3 className="text-base font-semibold">{title}</h3>
          {description ? (
            <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
          ) : null}
          {onRetry ? (
            <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
              <RefreshCw className={cn('h-3.5 w-3.5', retrying && 'animate-spin')} aria-hidden />
              Try again
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

// ── KPI tile ─────────────────────────────────────────────────────────────────

export type Tone = 'default' | 'purple' | 'emerald' | 'amber' | 'rose' | 'blue' | 'slate';

const TONE_ICON: Record<Tone, string> = {
  default: 'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  purple: 'bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-300',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300',
  rose: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300',
  blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300',
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

const TONE_BAR: Record<Tone, string> = {
  default: 'bg-gray-400',
  purple: 'bg-purple-600',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  blue: 'bg-blue-500',
  slate: 'bg-slate-400',
};

export function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'default',
  progress,
  footer,
  className,
}: {
  icon?: IconType;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  /** 0–100; renders a slim bar under the value. */
  progress?: number;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('gap-0', className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          {Icon ? (
            <span className={cn('rounded-lg p-1.5', TONE_ICON[tone])}>
              <Icon className="h-4 w-4" aria-hidden />
            </span>
          ) : null}
        </div>
        <div className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">{value}</div>
        {typeof progress === 'number' ? (
          <MiniBar value={progress} tone={tone} className="mt-3" />
        ) : null}
        {hint ? <p className="mt-2 text-xs text-muted-foreground">{hint}</p> : null}
        {footer ? <div className="mt-3">{footer}</div> : null}
      </CardContent>
    </Card>
  );
}

/** Compact inline statistic used inside panels (no card chrome). */
export function InlineStat({
  label,
  value,
  hint,
  tone = 'default',
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div className={cn('rounded-xl border border-border/60 bg-muted/30 px-4 py-3', className)}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-1 text-2xl font-semibold tabular-nums tracking-tight',
          tone === 'rose' && 'text-rose-600 dark:text-rose-400',
          tone === 'emerald' && 'text-emerald-600 dark:text-emerald-400',
          tone === 'amber' && 'text-amber-600 dark:text-amber-400',
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function MiniBar({
  value,
  tone = 'purple',
  className,
}: {
  value: number;
  tone?: Tone;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value || 0));
  return (
    <div
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-muted', className)}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn('h-full rounded-full transition-all duration-500', TONE_BAR[tone])}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

// ── Section header ───────────────────────────────────────────────────────────

export function SectionHeader({
  title,
  description,
  action,
  icon: Icon,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: IconType;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="flex min-w-0 items-start gap-2.5">
        {Icon ? (
          <span className="mt-0.5 rounded-lg bg-gray-50 p-1.5 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        ) : null}
        <div className="min-w-0">
          <h3 className="text-base font-semibold leading-tight">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

// ── Filter chips ─────────────────────────────────────────────────────────────

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (id: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={ariaLabel}>
      {options.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.id)}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors',
              active
                ? 'border-purple-600 bg-purple-600 text-white shadow-sm'
                : 'border-border bg-background text-muted-foreground hover:border-purple-300 hover:text-foreground',
            )}
          >
            {option.label}
            {typeof option.count === 'number' ? (
              <span
                className={cn(
                  'rounded-full px-1.5 text-[11px] tabular-nums',
                  active ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground',
                )}
              >
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

// ── Notices ──────────────────────────────────────────────────────────────────

const NOTICE_TONE: Record<'info' | 'warn' | 'error' | 'success' | 'progress', string> = {
  info: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800/60 dark:bg-blue-950/40 dark:text-blue-100',
  warn: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100',
  error:
    'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-100',
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-100',
  progress:
    'border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-800/60 dark:bg-violet-950/40 dark:text-violet-100',
};

export function Notice({
  tone,
  icon: Icon,
  title,
  children,
  action,
  className,
}: {
  tone: keyof typeof NOTICE_TONE;
  icon?: IconType;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex flex-wrap items-start gap-3 rounded-xl border px-4 py-3 text-sm',
        NOTICE_TONE[tone],
        className,
      )}
    >
      {Icon ? <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : null}
      <div className="min-w-0 flex-1">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className={cn(title && 'mt-0.5', 'text-[13px]')}>{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** Small key/value row used in detail side panels. */
export function DetailRow({
  label,
  children,
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 py-2 text-sm', className)}>
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium">{children}</dd>
    </div>
  );
}
