import { LucideIcon } from 'lucide-react';
import type { TaskPriority } from '../tasks/types';

// Re-export TaskPriority so dashboard/utils.ts and other consumers can import it from here
export type { TaskPriority };

export interface DashboardKPI {
  title: string;
  value: string | number;
  change: number;
  icon: LucideIcon;
  format?: 'number' | 'currency' | 'percentage';
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  /** When true, the card renders its own skeleton state regardless of grid-level loading */
  loading?: boolean;
}

export interface DashboardStats {
  total_clients: number;
  pending_applications: number;
  pending_tasks: number;
  new_this_month: number;
  new_last_month: number;
  total_completed?: number;
  avg_completion_time?: number;
}

export interface DashboardMetrics {
  activePolicies: number;
  newPoliciesCount: number;
  completedFNAs: number;
  pendingFNAs: number;
  totalPoliciesValue?: number;
  avgPolicyValue?: number;
}

export interface TaskDueToday {
  id: string;
  title: string;
  description?: string;
  due_date: string;
  priority: TaskPriority;
  status?: DashboardTaskStatus;
  assigned_to?: string;
  client_id?: string;
  category?: string;
}

/**
 * Dashboard-specific task status.
 * Differs from the tasks module's TaskStatus because the dashboard widget
 * uses a simplified status vocabulary from the server's due-today endpoint.
 */
export type DashboardTaskStatus = 'todo' | 'in_progress' | 'completed' | 'cancelled';

export interface RecentRequest {
  id: string;
  templateName: string;
  title?: string;
  recipientEmail: string;
  status: RequestStatus;
  createdAt: string;
  updatedAt?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  clientId?: string;
  assignedTo?: string;
}

export type RequestStatus = 
  | 'new'
  | 'awaiting information'
  | 'info_gathering'
  | 'pending'
  | 'sent_for_quote'
  | 'generated'
  | 'closed'
  | 'finalised'
  | 'cancelled';

export interface SystemActivity {
  type: SystemActivityType;
  count: number;
  growth: number;
  label: string;
  description?: string;
  color?: 'blue' | 'green' | 'orange' | 'red' | 'purple';
}

export type SystemActivityType = 
  | 'awaiting_info'
  | 'pending_review'
  | 'open_requests'
  | 'new_applications'
  | 'new_policies'
  | 'completed_fnas'
  | 'pending_tasks'
  | 'completed_tasks'
  | 'pending_signatures';

export interface QuickAction {
  id: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  module?: string;
  onClick?: () => void;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  badgeCount?: number;
}

export interface KPICardProps {
  title: string;
  value: string | number;
  change: number;
  icon: LucideIcon;
  format?: 'number' | 'currency' | 'percentage';
  subtitle?: string;
  onClick?: () => void;
  loading?: boolean;
}

export interface KPIGridProps {
  kpis: DashboardKPI[];
  loading?: boolean;
  columns?: 2 | 3 | 4;
}

export interface TasksWidgetProps {
  onNewTask?: () => void;
  onModuleChange?: (module: string) => void;
  onViewTask?: (taskId: string) => void;
  maxTasks?: number;
}

export interface RequestsWidgetProps {
  onViewAll?: () => void;
  onModuleChange?: (module: string) => void;
  onViewRequest?: (requestId: string) => void;
  maxRequests?: number;
}

export interface SystemActivityCardProps {
  onViewDetails?: (activityType: SystemActivityType) => void;
  onModuleChange?: (module: string) => void;
  loading?: boolean;
}

export interface QuickActionsCardProps {
  onModuleChange?: (module: string) => void;
  customActions?: QuickAction[];
}

export interface DashboardModuleProps {
  onModuleChange?: (module: string) => void;
  /** Called when a task is clicked in the Due Today widget — provides the task ID */
  onViewTask?: (taskId: string) => void;
}

export interface DashboardStatsResponse {
  success: boolean;
  data: DashboardStats;
  error?: string;
}

export interface DashboardMetricsResponse {
  success: boolean;
  data: DashboardMetrics;
  error?: string;
}

export interface TasksDueTodayResponse {
  success: boolean;
  data: TaskDueToday[];
  error?: string;
}

export interface RecentRequestsResponse {
  success: boolean;
  data: RecentRequest[];
  error?: string;
}

export interface SystemActivityResponse {
  success: boolean;
  data: SystemActivity[];
  error?: string;
}

export type ValueFormat = 'number' | 'currency' | 'percentage';
export type TrendDirection = 'up' | 'down' | 'neutral';
export type TimePeriod = 'today' | 'week' | 'month' | 'quarter' | 'year';
export type DashboardViewMode = 'standard' | 'compact' | 'detailed';
export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

// ── System Health ─────────────────────────────────────────────────────────────

export interface LastCleanupRun {
  timestamp: string;
  totalKeysFound: number;
  totalKeysDeleted: number;
  durationMs: number;
  retentionDays: number;
}

export interface CleanupRunResult extends LastCleanupRun {
  dryRun: boolean;
  categories: Record<string, {
    keysFound: number;
    keysDeleted: number;
    sampleKeys: string[];
  }>;
}

export interface SystemHealthCardProps {
  onModuleChange?: (module: string) => void;
}

// ── Admin Audit Trail ─────────────────────────────────────────────────────────

export type AuditActionCategory =
  | 'client_lifecycle'
  | 'kv_cleanup'
  | 'configuration'
  | 'bulk_operation'
  | 'security'
  | 'permissions'
  | 'communication'
  | 'system';

export type AuditSeverity = 'info' | 'warning' | 'critical';

export interface AdminAuditEntry {
  id: string;
  timestamp: string;
  actorId: string;
  actorRole: string;
  category: AuditActionCategory;
  action: string;
  summary: string;
  severity: AuditSeverity;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditSummary {
  days: number;
  summary: Record<AuditActionCategory, number>;
}

export interface AuditLogWidgetProps {
  onModuleChange?: (module: string) => void;
  maxEntries?: number;
}