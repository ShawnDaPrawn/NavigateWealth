/**
 * Permission Audit Service
 *
 * Tracks permission changes as structured audit entries in KV.
 * Each entry is stored under `audit:permissions:{timestamp}:{personnelId}`.
 *
 * Design decisions:
 *  - Append-only log (no deletes)
 *  - Entries are keyed by timestamp for chronological ordering
 *  - getByPrefix used for fetching audit trail
 *  - No PII is logged — only IDs, module names, and capability names
 *
 * @module server/permission-audit-service
 */

import * as kv from "./kv_store.tsx";
import { createModuleLogger } from "./stderr-logger.ts";

const log = createModuleLogger('permission-audit');

// ============================================================================
// TYPES
// ============================================================================

export interface PermissionAuditEntry {
  /** Unique entry ID */
  id: string;
  /** ISO timestamp */
  timestamp: string;
  /** The personnel member whose permissions were changed */
  targetPersonnelId: string;
  /** The admin who made the change */
  changedByPersonnelId: string;
  /** What type of change occurred */
  action: 'grant' | 'revoke' | 'update' | 'bulk_update';
  /** Summary of what changed */
  changes: PermissionChange[];
}

export interface PermissionChange {
  /** Module that was affected */
  module: string;
  /** What changed: access toggle, capability added/removed */
  type: 'access_granted' | 'access_revoked' | 'capability_added' | 'capability_removed';
  /** For capability changes, which capability */
  capability?: string;
}

// ============================================================================
// KV KEY HELPERS
// ============================================================================

const AUDIT_PREFIX = 'audit:permissions:';

function makeKey(timestamp: string, targetId: string): string {
  return `${AUDIT_PREFIX}${timestamp}:${targetId}`;
}

// ============================================================================
// SERVICE
// ============================================================================

export const PermissionAuditService = {
  /**
   * Record a permission change in the audit log.
   */
  async recordChange(entry: Omit<PermissionAuditEntry, 'id' | 'timestamp'>): Promise<PermissionAuditEntry> {
    const timestamp = new Date().toISOString();
    const id = `${timestamp}:${entry.targetPersonnelId}`;
    const fullEntry: PermissionAuditEntry = {
      id,
      timestamp,
      ...entry,
    };

    const key = makeKey(timestamp, entry.targetPersonnelId);
    await kv.set(key, JSON.stringify(fullEntry));
    log.info('Recorded permission audit entry', { id, target: entry.targetPersonnelId });
    return fullEntry;
  },

  /**
   * Compute the diff between old and new permission sets and record it.
   */
  async recordDiff(
    targetPersonnelId: string,
    changedByPersonnelId: string,
    oldModules: Record<string, unknown>,
    newModules: Record<string, unknown>
  ): Promise<PermissionAuditEntry | null> {
    const changes: PermissionChange[] = [];

    // Gather all module keys
    const allModuleKeys = new Set([
      ...Object.keys(oldModules || {}),
      ...Object.keys(newModules || {}),
    ]);

    for (const mod of allModuleKeys) {
      const oldAccess = oldModules?.[mod]?.access === true;
      const newAccess = newModules?.[mod]?.access === true;

      // Access toggle
      if (!oldAccess && newAccess) {
        changes.push({ module: mod, type: 'access_granted' });
      } else if (oldAccess && !newAccess) {
        changes.push({ module: mod, type: 'access_revoked' });
      }

      // Capability diff (only if module remains accessible)
      if (newAccess) {
        const oldCaps: string[] = oldModules?.[mod]?.capabilities || [];
        const newCaps: string[] = newModules?.[mod]?.capabilities || [];

        const added = newCaps.filter((c) => !oldCaps.includes(c));
        const removed = oldCaps.filter((c) => !newCaps.includes(c));

        for (const cap of added) {
          changes.push({ module: mod, type: 'capability_added', capability: cap });
        }
        for (const cap of removed) {
          changes.push({ module: mod, type: 'capability_removed', capability: cap });
        }
      }
    }

    if (changes.length === 0) {
      log.info('No permission changes detected, skipping audit', { target: targetPersonnelId });
      return null;
    }

    return this.recordChange({
      targetPersonnelId,
      changedByPersonnelId,
      action: 'bulk_update',
      changes,
    });
  },

  /**
   * Fetch audit entries for a specific personnel member (most recent first).
   */
  async getForPersonnel(personnelId: string, limit: number = 50): Promise<PermissionAuditEntry[]> {
    try {
      // Fetch all audit entries, then filter by personnelId
      const allEntries = await kv.getByPrefix(AUDIT_PREFIX);
      const entries: PermissionAuditEntry[] = [];

      for (const raw of allEntries) {
        try {
          const val = typeof raw === 'string' ? raw : (raw as Record<string, unknown>)?.value;
          if (!val) continue;
          const entry = JSON.parse(typeof val === 'string' ? val : JSON.stringify(val));
          if (entry.targetPersonnelId === personnelId) {
            entries.push(entry);
          }
        } catch {
          // Skip unparseable entries
        }
      }

      // Sort descending by timestamp
      entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      return entries.slice(0, limit);
    } catch (error) {
      log.error('Failed to fetch audit entries', error);
      return [];
    }
  },

  /**
   * Fetch all audit entries (most recent first, capped).
   */
  async getAll(limit: number = 100): Promise<PermissionAuditEntry[]> {
    try {
      const allEntries = await kv.getByPrefix(AUDIT_PREFIX);
      const entries: PermissionAuditEntry[] = [];

      for (const raw of allEntries) {
        try {
          const val = typeof raw === 'string' ? raw : (raw as Record<string, unknown>)?.value;
          if (!val) continue;
          const entry = JSON.parse(typeof val === 'string' ? val : JSON.stringify(val));
          entries.push(entry);
        } catch {
          // Skip unparseable entries
        }
      }

      entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      return entries.slice(0, limit);
    } catch (error) {
      log.error('Failed to fetch all audit entries', error);
      return [];
    }
  },
};