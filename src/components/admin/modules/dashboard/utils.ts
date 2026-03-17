import type { RequestStatus, TaskPriority, BadgeVariant, TrendDirection, TaskDueToday } from './types';

export function formatNumber(value: number, locale: string = 'en-ZA'): string {
  // Use manual formatting to ensure consistent comma-separated thousands
  if (isNaN(value)) return '0';
  const isNeg = value < 0;
  const parts = Math.abs(value).toString().split('.');
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${isNeg ? '-' : ''}${intPart}${parts.length > 1 ? '.' + parts[1] : ''}`;
}

export function formatCurrency(
  value: number, 
  currency: string = 'ZAR',
  _locale: string = 'en-ZA'
): string {
  if (isNaN(value)) return 'R0.00';
  const isNeg = value < 0;
  const fixed = Math.abs(value).toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const symbol = currency === 'ZAR' ? 'R' : currency;
  return `${isNeg ? '-' : ''}${symbol}${withCommas}.${decPart}`;
}

export function formatCurrencyCompact(
  value: number,
  currency: string = 'ZAR',
  _locale: string = 'en-ZA'
): string {
  const symbol = currency === 'ZAR' ? 'R' : currency;
  const abs = Math.abs(value);
  const isNeg = value < 0;
  const sign = isNeg ? '-' : '';
  
  if (abs >= 1_000_000_000) return `${sign}${symbol}${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${sign}${symbol}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${symbol}${(abs / 1_000).toFixed(1)}K`;
  return `${sign}${symbol}${abs.toFixed(0)}`;
}

export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatKPIValue(
  value: string | number,
  format?: 'number' | 'currency' | 'percentage'
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

export function getTrendDirection(
  growth: number,
  threshold: number = 0
): TrendDirection {
  if (growth > threshold) return 'up';
  if (growth < -threshold) return 'down';
  return 'neutral';
}

export function getStatusLabel(status: RequestStatus | string): string {
  const statusMap: Record<string, string> = {
    'new': 'New',
    'awaiting information': 'Awaiting Information',
    'info_gathering': 'Awaiting Information',
    'pending': 'Pending Review',
    'sent_for_quote': 'Sent for Quote',
    'generated': 'Generated',
    'closed': 'Closed',
    'finalised': 'Finalised',
    'cancelled': 'Cancelled',
  };

  return statusMap[status?.toLowerCase()] || status;
}

export function getStatusVariant(status: RequestStatus | string): BadgeVariant {
  const lowerStatus = status?.toLowerCase();

  if (['awaiting information', 'info_gathering'].includes(lowerStatus)) {
    return 'default';
  }
  if (['pending', 'sent_for_quote'].includes(lowerStatus)) {
    return 'secondary';
  }
  if (['closed', 'finalised', 'cancelled'].includes(lowerStatus)) {
    return 'outline';
  }

  return 'default';
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

export function formatDate(
  date: string | Date,
  options?: Intl.DateTimeFormatOptions
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('en-ZA', options);
}

export function formatTime(
  date: string | Date,
  options?: Intl.DateTimeFormatOptions
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleTimeString('en-ZA', {
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  });
}

export function formatDateTime(date: string | Date): string {
  return `${formatDate(date)} ${formatTime(date)}`;
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

export function isOverdue(
  dueDate: string | Date,
  status?: string
): boolean {
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
  keyFn: (item: T) => K
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

export function sortByPriority<T extends { priority: TaskPriority }>(
  items: T[]
): T[] {
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

export function isOpenStatus(status: RequestStatus): boolean {
  const openStatuses: RequestStatus[] = [
    'awaiting information',
    'info_gathering',
    'pending',
    'sent_for_quote',
    'generated'
  ];
  return openStatuses.includes(status);
}

export function isClosedStatus(status: RequestStatus): boolean {
  const closedStatuses: RequestStatus[] = ['closed', 'finalised', 'cancelled'];
  return closedStatuses.includes(status);
}

export function isHighPriority(priority: TaskPriority): boolean {
  return priority === 'high' || priority === 'critical';
}