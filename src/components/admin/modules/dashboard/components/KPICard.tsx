import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { Skeleton } from '../../../../ui/skeleton';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { formatKPIValue } from '../utils';
import type { KPICardProps } from '../types';

export function KPICard({
  title,
  value,
  change,
  icon: Icon,
  format = 'number',
  subtitle,
  onClick,
  loading = false,
}: KPICardProps) {
  const isPositive = change > 0;
  const isNegative = change < 0;
  const isNeutral = change === 0;

  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 px-4 pt-4 pb-3 sm:items-center sm:px-6 sm:pt-6">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-9 rounded-full" />
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <Skeleton className="h-9 w-24 mb-3" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-14" />
            <Skeleton className="h-5 w-32" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={`transition-all ${onClick ? 'cursor-pointer hover:-translate-y-1 hover:shadow-lg' : ''}`}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 px-4 pt-4 pb-3 sm:items-center sm:px-6 sm:pt-6">
        <CardTitle className="min-w-0 text-xs leading-snug font-semibold text-muted-foreground uppercase tracking-wide sm:text-sm">
          {title}
        </CardTitle>
        <div className="shrink-0 rounded-full bg-primary/10 p-2 sm:p-2.5">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </CardHeader>
      <CardContent className="px-4 sm:px-6">
        <div className="text-2xl font-bold text-gray-900 tracking-tight sm:text-3xl">
          {formatKPIValue(value, format)}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs sm:text-sm">
          {isPositive && (
            <span className="text-green-600 flex items-center font-medium">
              <ArrowUp className="h-3 w-3 mr-1" />
              {Math.abs(change).toFixed(1)}%
            </span>
          )}
          {isNegative && (
            <span className="text-red-600 flex items-center font-medium">
              <ArrowDown className="h-3 w-3 mr-1" />
              {Math.abs(change).toFixed(1)}%
            </span>
          )}
          {isNeutral && (
            <span className="text-gray-500 flex items-center font-medium">
              <Minus className="h-3 w-3 mr-1" />
              0.0%
            </span>
          )}

          {subtitle && <span className="min-w-0 truncate text-muted-foreground">{subtitle}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
