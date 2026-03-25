import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { Skeleton } from '../../../../ui/skeleton';
import { LucideIcon, ArrowUp, ArrowDown, Minus } from 'lucide-react';
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
  loading = false
}: KPICardProps) {
  const isPositive = change > 0;
  const isNegative = change < 0;
  const isNeutral = change === 0;

  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-9 rounded-full" />
        </CardHeader>
        <CardContent>
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
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {title}
        </CardTitle>
        <div className="p-2.5 bg-primary/10 rounded-full">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-gray-900 tracking-tight">
          {formatKPIValue(value, format)}
        </div>
        <div className="flex items-center text-sm mt-2">
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
          
          {subtitle && (
            <span className="text-muted-foreground ml-2 truncate">
              {subtitle}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}