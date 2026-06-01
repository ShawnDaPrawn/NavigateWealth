import type { TaskPriority, BadgeVariant, TrendDirection, TaskDueToday } from './types';
import {
  formatNumber,
  formatCurrency,
  formatCurrencyCompact,
  formatPercentage,
  formatDate,
  formatTime,
  formatDateTime,
} from '@/shared/formatting/format';

// Canonical formatters now live in the shared formatting layer (Phase 6c);
// re-exported here so the dashboard's long-standing import paths keep working.
export {
  formatNumber,
  formatCurrency,
  formatCurrencyCompact,
  formatPercentage,
  formatDate,
  formatTime,
  formatDateTime,
};

export function formatKPIValue(
  value: string | number,
  format?: 'number' | 'currency' | 'percentage',
): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(numValue)) {
    return String(value);
  }

  switch (format) {
    case 'currency':
      return formatCurrencyCompact(numValue);
    case 'percentage':
      return formatPercentage(numValue);
    case 'number':
    default:
      return formatNumber(numValue);
  }
}

export function calculateGrowth(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return ((current - previous) / previous) * 100;
}

export function calculatePercentageOfTotal(value: number, total: number): number {
  if (total === 0) {
    return 0;
  }
  return (value / total) * 100;
}

export function getTrendDirection(growth: number, threshold: number = 0): TrendDirection {
  if (growth > threshold) return 'up';
  if (growth < -threshold) return 'down';
  return 'neutral';
}

export function getPriorityVariant(priority: TaskPriority): BadgeVariant {
  switch (priority) {
    case 'critical':
      return 'destructive';
    case 'high':
      return 'default';
    case 'medium':
    case 'low':
      return 'secondary';
    default:
      return 'secondary';
  }
}

export function getPriorityLabel(priority: TaskPriority): string {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

export function getRelativeTime(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = dateObj.getTime() - now.getTime();
  const diffSec = Math.floor(Math.abs(diffMs) / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  const isFuture = diffMs > 0;
  const prefix = isFuture ? 'in ' : '';
  const suffix = isFuture ? '' : ' ago';

  if (diffSec < 60) {
    return `${prefix}just now`;
  } else if (diffMin < 60) {
    return `${prefix}${diffMin} minute${diffMin !== 1 ? 's' : ''}${suffix}`;
  } else if (diffHour < 24) {
    return `${prefix}${diffHour} hour${diffHour !== 1 ? 's' : ''}${suffix}`;
  } else if (diffDay < 7) {
    return `${prefix}${diffDay} day${diffDay !== 1 ? 's' : ''}${suffix}`;
  } else {
    return formatDate(dateObj);
  }
}

export function isToday(date: string | Date): boolean {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  return (
    dateObj.getDate() === today.getDate() &&
    dateObj.getMonth() === today.getMonth() &&
    dateObj.getFullYear() === today.getFullYear()
  );
}

export function isOverdue(dueDate: string | Date, status?: string): boolean {
  if (status && ['completed', 'cancelled'].includes(status.toLowerCase())) {
    return false;
  }

  const dateObj = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  const now = new Date();
  return dateObj < now;
}

export function isTaskOverdue(task: TaskDueToday): boolean {
  return isOverdue(task.due_date, task.status);
}

export function groupBy<T, K extends string | number>(
  items: T[],
  keyFn: (item: T) => K,
): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const group = map.get(key) || [];
    group.push(item);
    map.set(key, group);
  }
  return map;
}

export function sortByPriority<T extends { priority: TaskPriority }>(items: T[]): T[] {
  const priorityOrder: Record<TaskPriority, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  return [...items].sort((a, b) => {
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

export function isHighPriority(priority: TaskPriority): boolean {
  return priority === 'high' || priority === 'critical';
}
