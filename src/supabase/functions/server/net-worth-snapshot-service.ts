/**
 * Net Worth Snapshot Service — Phase 4
 *
 * Manages point-in-time snapshots of a client's net worth stored in KV.
 * Enables historical trend analysis via LineChart on the Overview dashboard.
 *
 * KV Key Pattern: net_worth_snapshot:{clientId}:{YYYY-MM-DD}
 *
 * Guidelines §5.4 — KV key naming convention.
 * Guidelines §4.2 — Service owns business logic and KV access patterns.
 */

import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';

const log = createModuleLogger('net-worth-snapshot');

// ── Types ───────────────────────────────────────────────────────────────

export interface NetWorthSnapshot {
  /** ISO date string (YYYY-MM-DD) */
  date: string;
  /** Total asset value at snapshot time */
  totalAssets: number;
  /** Total liability value at snapshot time */
  totalLiabilities: number;
  /** Net worth = totalAssets - totalLiabilities */
  netWorth: number;
  /** Optional breakdown of assets by type */
  assetBreakdown?: Array<{ type: string; value: number }>;
  /** Optional breakdown of liabilities by type */
  liabilityBreakdown?: Array<{ type: string; balance: number }>;
  /** Number of active policies at snapshot time */
  policyCount: number;
  /** Total monthly premiums at snapshot time */
  monthlyPremiums: number;
  /** Retirement portfolio value at snapshot time */
  retirementValue?: number;
  /** Investment portfolio value at snapshot time */
  investmentValue?: number;
  /** ISO timestamp of when the snapshot was created */
  createdAt: string;
  /** Who created the snapshot (userId or 'system') */
  createdBy: string;
}

export interface CreateSnapshotInput {
  clientId: string;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  assetBreakdown?: Array<{ type: string; value: number }>;
  liabilityBreakdown?: Array<{ type: string; balance: number }>;
  policyCount: number;
  monthlyPremiums: number;
  retirementValue?: number;
  investmentValue?: number;
  createdBy: string;
}

// ── Key helpers ─────────────────────────────────────────────────────────

function snapshotKey(clientId: string, date: string): string {
  return `net_worth_snapshot:${clientId}:${date}`;
}

function snapshotPrefix(clientId: string): string {
  return `net_worth_snapshot:${clientId}:`;
}

/** Format date as YYYY-MM-DD */
function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ── Service ─────────────────────────────────────────────────────────────

export class NetWorthSnapshotService {
  /**
   * Create or update a snapshot for a given date.
   * Defaults to today's date. Only one snapshot per client per day.
   */
  async createSnapshot(input: CreateSnapshotInput): Promise<NetWorthSnapshot> {
    const date = toDateKey(new Date());
    const key = snapshotKey(input.clientId, date);

    const snapshot: NetWorthSnapshot = {
      date,
      totalAssets: input.totalAssets,
      totalLiabilities: input.totalLiabilities,
      netWorth: input.netWorth,
      assetBreakdown: input.assetBreakdown,
      liabilityBreakdown: input.liabilityBreakdown,
      policyCount: input.policyCount,
      monthlyPremiums: input.monthlyPremiums,
      retirementValue: input.retirementValue,
      investmentValue: input.investmentValue,
      createdAt: new Date().toISOString(),
      createdBy: input.createdBy,
    };

    await kv.set(key, snapshot);
    log.info('Net worth snapshot created', { clientId: input.clientId, date, netWorth: input.netWorth });

    return snapshot;
  }

  /**
   * Retrieve all snapshots for a client, sorted by date ascending.
   */
  async getSnapshots(clientId: string): Promise<NetWorthSnapshot[]> {
    const prefix = snapshotPrefix(clientId);
    const results = await kv.getByPrefix(prefix);

    // Results are raw values — cast to typed snapshots
    const snapshots: NetWorthSnapshot[] = (results || [])
      .filter((v): v is NetWorthSnapshot => v !== null && typeof v === 'object' && 'date' in v)
      .sort((a, b) => a.date.localeCompare(b.date));

    log.info('Retrieved net worth snapshots', { clientId, count: snapshots.length });
    return snapshots;
  }

  /**
   * Delete a specific snapshot by date.
   */
  async deleteSnapshot(clientId: string, date: string): Promise<void> {
    const key = snapshotKey(clientId, date);
    await kv.del(key);
    log.info('Net worth snapshot deleted', { clientId, date });
  }

  /**
   * Get the latest snapshot for a client (most recent date).
   */
  async getLatestSnapshot(clientId: string): Promise<NetWorthSnapshot | null> {
    const snapshots = await this.getSnapshots(clientId);
    return snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  }

  // ── Auto-snapshot from KV data ──────────────────────────────────────

  /**
   * Compute and persist a snapshot by reading current KV state for a client.
   * Called as a fire-and-forget side-effect from profile save and FNA publish.
   *
   * Reads:
   *   - user_profile:{clientId}:personal_info  (assets, liabilities)
   *   - policies:client:{clientId}             (policies array)
   *
   * This is best-effort — failures are logged but never block the caller.
   */
  async autoSnapshotFromKV(clientId: string, triggeredBy: string): Promise<NetWorthSnapshot | null> {
    try {
      // Batch-read profile and policies (§13 — Promise.all for KV reads)
      const [profile, policiesRaw] = await Promise.all([
        kv.get(`user_profile:${clientId}:personal_info`),
        kv.get(`policies:client:${clientId}`),
      ]);

      if (!profile) {
        log.info('Auto-snapshot skipped: no profile found', { clientId });
        return null;
      }

      // Assets
      const assets: Array<{ type?: string; value?: number }> = Array.isArray(profile.assets) ? profile.assets : [];
      const totalAssets = assets.reduce((s: number, a: { value?: number }) => s + (Number(a.value) || 0), 0);
      const assetBreakdown = assets
        .filter((a: { value?: number }) => (Number(a.value) || 0) > 0)
        .map((a: { type?: string; value?: number }) => ({ type: a.type || 'Other', value: Number(a.value) || 0 }));

      // Liabilities
      const liabilities: Array<{ type?: string; outstandingBalance?: number }> = Array.isArray(profile.liabilities) ? profile.liabilities : [];
      const totalLiabilities = liabilities.reduce((s: number, l: { outstandingBalance?: number }) => s + (Number(l.outstandingBalance) || 0), 0);
      const liabilityBreakdown = liabilities
        .filter((l: { outstandingBalance?: number }) => (Number(l.outstandingBalance) || 0) > 0)
        .map((l: { type?: string; outstandingBalance?: number }) => ({ type: l.type || 'Other', balance: Number(l.outstandingBalance) || 0 }));

      // Policies
      const policies: Array<{ category?: string; data?: Record<string, unknown> }> = Array.isArray(policiesRaw) ? policiesRaw : [];
      const policyCount = policies.length;
      const monthlyPremiums = policies.reduce((s: number, p: { data?: Record<string, unknown> }) => {
        return s + (Number(p.data?.premium || p.data?.monthlyPremium) || 0);
      }, 0);

      // Retirement & investment values from policies
      let retirementValue = 0;
      let investmentValue = 0;
      for (const pol of policies) {
        const cat = String(pol.category || '').toLowerCase();
        const cv = Number(pol.data?.currentValue || pol.data?.fundValue) || 0;
        if (cat.includes('retirement')) retirementValue += cv;
        if (cat.includes('investment')) investmentValue += cv;
      }

      const netWorth = totalAssets - totalLiabilities;

      const snapshot = await this.createSnapshot({
        clientId,
        totalAssets,
        totalLiabilities,
        netWorth,
        assetBreakdown,
        liabilityBreakdown,
        policyCount,
        monthlyPremiums,
        retirementValue,
        investmentValue,
        createdBy: `auto:${triggeredBy}`,
      });

      log.info('Auto-snapshot created', { clientId, trigger: triggeredBy, netWorth });
      return snapshot;
    } catch (err) {
      log.error('Auto-snapshot failed (non-blocking)', { clientId, trigger: triggeredBy, error: String(err) });
      return null;
    }
  }

  // ── Batch snapshot (maintenance) ────────────────────────────────────

  /**
   * Snapshot all active clients. Follows the dry-run-first pattern (§14.1).
   *
   * @param dryRun If true, compute what would be snapshotted but don't write.
   * @returns Audit summary of the operation.
   */
  async batchSnapshotAllClients(dryRun: boolean = true): Promise<BatchSnapshotResult> {
    const startTime = Date.now();
    const results: BatchSnapshotClientResult[] = [];

    // Get all security entries to find active clients
    const securityEntries = await kv.getByPrefix('security:');
    const activeClientIds: string[] = [];

    for (const entry of (securityEntries || [])) {
      if (entry && typeof entry === 'object' && 'id' in entry) {
        const sec = entry as { id: string; deleted?: boolean; suspended?: boolean };
        if (!sec.deleted && !sec.suspended) {
          activeClientIds.push(sec.id);
        }
      }
    }

    log.info(`Batch snapshot: found ${activeClientIds.length} active clients`, { dryRun });

    let snapshotted = 0;
    let skipped = 0;
    let errored = 0;

    for (const clientId of activeClientIds) {
      try {
        if (dryRun) {
          // In dry-run, just check if profile exists
          const profile = await kv.get(`user_profile:${clientId}:personal_info`);
          if (profile) {
            const assets = Array.isArray(profile.assets) ? profile.assets : [];
            const totalAssets = assets.reduce((s: number, a: { value?: number }) => s + (Number(a.value) || 0), 0);
            const liabilities = Array.isArray(profile.liabilities) ? profile.liabilities : [];
            const totalLiabilities = liabilities.reduce((s: number, l: { outstandingBalance?: number }) => s + (Number(l.outstandingBalance) || 0), 0);
            results.push({
              clientId,
              status: 'would-snapshot',
              netWorth: totalAssets - totalLiabilities,
            });
            snapshotted++;
          } else {
            results.push({ clientId, status: 'skipped-no-profile' });
            skipped++;
          }
        } else {
          const snapshot = await this.autoSnapshotFromKV(clientId, 'batch-maintenance');
          if (snapshot) {
            results.push({ clientId, status: 'snapshotted', netWorth: snapshot.netWorth });
            snapshotted++;
          } else {
            results.push({ clientId, status: 'skipped-no-profile' });
            skipped++;
          }
        }
      } catch (err) {
        results.push({ clientId, status: 'error', error: String(err) });
        errored++;
      }
    }

    const duration = Date.now() - startTime;
    log.info('Batch snapshot complete', { dryRun, snapshotted, skipped, errored, duration });

    return {
      dryRun,
      totalActiveClients: activeClientIds.length,
      snapshotted,
      skipped,
      errored,
      durationMs: duration,
      results,
    };
  }
}

// ── Batch types ─────────────────────────────────────────────────────────

export interface BatchSnapshotClientResult {
  clientId: string;
  status: 'snapshotted' | 'would-snapshot' | 'skipped-no-profile' | 'error';
  netWorth?: number;
  error?: string;
}

export interface BatchSnapshotResult {
  dryRun: boolean;
  totalActiveClients: number;
  snapshotted: number;
  skipped: number;
  errored: number;
  durationMs: number;
  results: BatchSnapshotClientResult[];
}