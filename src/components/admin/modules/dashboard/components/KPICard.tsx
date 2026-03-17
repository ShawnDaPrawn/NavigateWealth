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
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-7 w-20 mb-2" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-28" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      className={`shadow-sm transition-all hover:shadow-md ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="p-2 bg-primary/10 rounded-full">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-gray-900">
          {formatKPIValue(value, format)}
        </div>
        <div className="flex items-center text-xs mt-1">
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