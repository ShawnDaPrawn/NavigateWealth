export const ENDPOINTS = {
  ADMIN_STATS: '/admin/stats',
  TASKS_DUE_TODAY: '/tasks/due-today',
  TASKS_BY_DATE: '/tasks/by-date',
  RECENT_REQUESTS: '/requests/recent',
  DASHBOARD_STATS: '/integrations/dashboard-stats',
  SYSTEM_ACTIVITY: '/dashboard/activity',
  KV_CLEANUP_STATUS: '/kv-cleanup/status',
  KV_CLEANUP_RUN: '/kv-cleanup/run',
  ADMIN_AUDIT_LOG: '/admin-audit/log',
  ADMIN_AUDIT_SUMMARY: '/admin-audit/summary',
} as const;