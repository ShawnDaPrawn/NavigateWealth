/**
 * Admin Audit Service
 *
 * General-purpose audit trail for admin actions across all modules.
 * Extends beyond the existing permission-audit-service.ts to cover:
 *
 *   - Client lifecycle changes (suspend, unsuspend, soft-delete)
 *   - KV cleanup runs (dry-run + live)
 *   - Configuration changes (brand, resources, products)
 *   - Bulk operations (imports, batch updates)
 *   - Security-sensitive actions (password resets, role changes)
 *
 * Design decisions (Guidelines §12.2, §5.4):
 *   - Append-only log — entries are never modified or deleted during normal ops
 *   - Keys: `audit:admin:{timestamp}:{actorId}` for chronological ordering
 *   - No PII logged — only entity IDs, action types, and summaries
 *   - Entries are JSON-serialisable objects stored in KV
 *   - getByPrefix used for retrieval; stale entries cleaned by kv-cleanup-service
 *
 * @module server/admin-audit-service
 */

import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';

const log = createModuleLogger('admin-audit');

// ============================================================================
// Types
// ============================================================================

/** Action categories for filtering and display. */
export type AuditActionCategory =
  | 'client_lifecycle'
  | 'kv_cleanup'
  | 'configuration'
  | 'bulk_operation'
  | 'security'
  | 'permissions'
  | 'communication'
  | 'system';

/** Severity levels for visual treatment in the UI. */
export type AuditSeverity = 'info' | 'warning' | 'critical';

export interface AdminAuditEntry {
  /** Unique entry ID (deterministic: timestamp + actorId) */
  id: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** The admin user who performed the action */
  actorId: string;
  /** Human-readable actor label (role, not name — no PII) */
  actorRole: string;
  /** Action category for grouping/filtering */
  category: AuditActionCategory;
  /** Machine-readable action type (e.g., 'client_suspended', 'kv_cleanup_live') */
  action: string;
  /** Human-readable summary (must not contain PII) */
  summary: string;
  /** Severity level for UI treatment */
  severity: AuditSeverity;
  /** The entity type affected (e.g., 'client', 'configuration', 'system') */
  entityType?: string;
  /** The entity ID affected (no PII — just the technical ID) */
  entityId?: string;
  /** Additional structured metadata (no PII) */
  metadata?: Record<string, unknown>;
}

export interface AuditLogInput {
  actorId: string;
  actorRole: string;
  category: AuditActionCategory;
  action: string;
  summary: string;
  severity?: AuditSeverity;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditQueryFilters {
  category?: AuditActionCategory;
  actorId?: string;
  entityType?: string;
  entityId?: string;
  severity?: AuditSeverity;
  /** ISO timestamp — only return entries after this point */
  since?: string;
  /** Maximum entries to return (default: 50) */
  limit?: number;
}

// ============================================================================
// KV Key Helpers
// ============================================================================

const AUDIT_PREFIX = 'audit:admin:';

function makeKey(timestamp: string, actorId: string): string {
  return `${AUDIT_PREFIX}${timestamp}:${actorId}`;
}

// ============================================================================
// Service
// ============================================================================

export const AdminAuditService = {
  /**
   * Record an admin action in the audit log.
   *
   * This is the primary entry point — all modules that perform
   * admin-level mutations should call this after a successful write.
   */
  async record(input: AuditLogInput): Promise<AdminAuditEntry> {
    const timestamp = new Date().toISOString();
    const id = `${timestamp}:${input.actorId}`;

    const entry: AdminAuditEntry = {
      id,
      timestamp,
      actorId: input.actorId,
      actorRole: input.actorRole,
      category: input.category,
      action: input.action,
      summary: input.summary,
      severity: input.severity ?? 'info',
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata,
    };

    const key = makeKey(timestamp, input.actorId);

    try {
      await kv.set(key, entry);
      log.info('Audit entry recorded', { id, action: input.action, category: input.category });
    } catch (err) {
      // Audit write failure is non-blocking — log but do not throw.
      // The calling operation has already succeeded; we must not roll it back
      // just because the audit log failed to persist.
      log.error('Failed to persist audit entry (non-blocking)', err);
    }

    return entry;
  },

  /**
   * Fetch audit log entries with optional filters.
   *
   * Returns entries sorted most-recent-first.
   */
  async query(filters: AuditQueryFilters = {}): Promise<AdminAuditEntry[]> {
    const limit = filters.limit ?? 50;

    try {
      const raw = await kv.getByPrefix(AUDIT_PREFIX);
      const entries: AdminAuditEntry[] = [];

      for (const row of raw) {
        try {
          const val = typeof row === 'string'
            ? JSON.parse(row)
            : (row as Record<string, unknown>)?.value ?? row;

          const entry = (typeof val === 'string' ? JSON.parse(val) : val) as AdminAuditEntry;
          if (!entry || !entry.timestamp) continue;

          // Apply filters
          if (filters.category && entry.category !== filters.category) continue;
          if (filters.actorId && entry.actorId !== filters.actorId) continue;
          if (filters.entityType && entry.entityType !== filters.entityType) continue;
          if (filters.entityId && entry.entityId !== filters.entityId) continue;
          if (filters.severity && entry.severity !== filters.severity) continue;
          if (filters.since && entry.timestamp < filters.since) continue;

          entries.push(entry);
        } catch {
          // Skip unparseable entries
        }
      }

      // Sort descending by timestamp
      entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      return entries.slice(0, limit);
    } catch (err) {
      log.error('Failed to query audit entries', err);
      return [];
    }
  },

  /**
   * Get a count summary of recent audit entries by category.
   * Used by the dashboard for quick status overview.
   */
  async getSummary(sinceDays: number = 7): Promise<Record<AuditActionCategory, number>> {
    const since = new Date(Date.now() - sinceDays * 86_400_000).toISOString();
    const entries = await this.query({ since, limit: 1000 });

    const summary: Record<string, number> = {
      client_lifecycle: 0,
      kv_cleanup: 0,
      configuration: 0,
      bulk_operation: 0,
      security: 0,
      permissions: 0,
      communication: 0,
      system: 0,
    };

    for (const entry of entries) {
      if (entry.category in summary) {
        summary[entry.category]++;
      }
    }

    return summary as Record<AuditActionCategory, number>;
  },
};
