import React from 'react';
import { Card, CardContent } from '../../../../../ui/card';
import { cn } from '../../../../../ui/utils';
import type { PillTone } from './complianceTypes';

/**
 * A white card with a titled header row (design CM-K-*): the frame every
 * compliance panel's blocks share.
 */
export function PanelCard({
  title,
  aside,
  children,
  className,
}: {
  title: React.ReactNode;
  /** Right side of the header row: a status, a date, a small action. */
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-xl border border-nw-line bg-white', className)}>
      <div className="flex items-center justify-between gap-3 border-b border-nw-line px-5 py-3.5">
        <h3 className="text-sm font-semibold text-nw-ink">{title}</h3>
        {aside}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

const PILL_TONES: Record<PillTone, string> = {
  good: 'bg-emerald-50 text-emerald-700 before:bg-emerald-500',
  bad: 'bg-red-50 text-red-700 before:bg-red-500',
  warn: 'bg-amber-50 text-amber-800 before:bg-amber-500',
  neutral: 'bg-gray-100 text-gray-700 before:bg-gray-400',
};

/** A status pill with a dot: "● Verification complete". */
export function StatusPill({ tone, children }: { tone: PillTone; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium before:h-1.5 before:w-1.5 before:shrink-0 before:rounded-full',
        PILL_TONES[tone],
      )}
    >
      {children}
    </span>
  );
}

export function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="bg-gray-50 p-2 rounded-lg">{icon}</div>
        <div>
          <div className="text-xl font-bold">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export function QuickActionCard({
  title,
  description,
  icon,
  onClick,
  disabled = false,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`text-left p-4 rounded-lg border transition-all ${
        disabled
          ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-200'
          : 'bg-white border-gray-200 hover:border-purple-300 hover:shadow-sm cursor-pointer'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="font-medium text-sm">{title}</span>
      </div>
      <p className="text-xs text-gray-500">{description}</p>
    </button>
  );
}
