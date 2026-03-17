/**
 * Task Domain Types (Server-Side)
 *
 * KV-persisted entity shape for tasks stored as `task:{uuid}`.
 *
 * @module tasks-types
 */

// ---------------------------------------------------------------------------
// Core Task Entity
// ---------------------------------------------------------------------------

export type TaskStatus = 'new' | 'in_progress' | 'completed' | 'archived';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export interface KvTask {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string | null;
  is_template?: boolean;
  assignee_initials?: string | null;
  assignee_id?: string | null;
  created_by?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  sort_order: number;
  reminder_frequency?: string | null;
  last_reminder_sent?: string | null;
  tags?: string[];
  category?: string | null;
  // Legacy camelCase fields that may exist in KV
  dueDate?: string | null;
  isTemplate?: boolean;
  assigneeInitials?: string | null;
  assigneeId?: string | null;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string | null;
  sortOrder?: number;
  reminderFrequency?: string | null;
  lastReminderSent?: string | null;
}

/**
 * A raw KV entry before normalisation — may have camelCase or snake_case
 * fields depending on when it was created. Always run through normaliseTask()
 * before returning to the frontend.
 */
export type RawKvTask = Record<string, unknown> & {
  id?: string;
  title?: string;
  status?: string;
  sort_order?: number;
  sortOrder?: number;
  due_date?: string;
  dueDate?: string;
  priority?: string;
};
