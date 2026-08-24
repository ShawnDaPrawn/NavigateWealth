import { getApiBaseUrl } from './apiBase';
/**
 * Synthetic probe, metrics, recovery bin and maintenance operations.
 *
 * One slice of what used to be the single 1,300-line `esignApi` object. The
 * aggregate in `../api.ts` spreads every slice back together, so consumers
 * keep calling `esignApi.method(...)` unchanged.
 */
import { api } from '../../../../../utils/api/client';

export const opsApi = {
  // ==================== SYNTHETIC PROBE (P7.4) ====================

  async getSyntheticProbe(): Promise<{
    latest: {
      ok: boolean;
      latencyMs: number;
      ranAt: string;
      error?: string;
      checks: Record<string, { ok: boolean; latencyMs: number; detail?: string }>;
    } | null;
    history: Array<{
      ok: boolean;
      latencyMs: number;
      ranAt: string;
      error?: string;
    }>;
  }> {
    return api.get<{
      latest: {
        ok: boolean;
        latencyMs: number;
        ranAt: string;
        error?: string;
        checks: Record<string, { ok: boolean; latencyMs: number; detail?: string }>;
      } | null;
      history: Array<{
        ok: boolean;
        latencyMs: number;
        ranAt: string;
        error?: string;
      }>;
    }>(`/esign/diagnostics/synthetic`);
  },

  async runSyntheticProbe(): Promise<{
    ok: boolean;
    latencyMs: number;
    ranAt: string;
    error?: string;
  }> {
    return api.post<{
      ok: boolean;
      latencyMs: number;
      ranAt: string;
      error?: string;
    }>(`/esign/diagnostics/synthetic/run`, {});
  },

  // ==================== METRICS (P7.1) ====================

  /** Org metrics bundle for the dashboard. */
  async getMetrics(): Promise<{
    firm_id: string;
    generated_at: string;
    statusCounts: Record<string, number>;
    funnel: {
      sent: number;
      opened: number;
      started: number;
      completed: number;
      sentToOpenedPct: number;
      openedToStartedPct: number;
      startedToCompletedPct: number;
    };
    timeToSign: {
      completedCount: number;
      averageMs: number | null;
      medianMs: number | null;
      byTemplate: Array<{ templateId: string | null; count: number; averageMs: number }>;
    };
    stuckEnvelopes: Array<{
      id: string;
      title: string;
      sent_at?: string;
      days_since_sent: number;
      signer_count: number;
      client_id?: string;
    }>;
    throughput30d: Array<{ date: string; completed: number }>;
  }> {
    return api.get<{
      firm_id: string;
      generated_at: string;
      statusCounts: Record<string, number>;
      funnel: {
        sent: number;
        opened: number;
        started: number;
        completed: number;
        sentToOpenedPct: number;
        openedToStartedPct: number;
        startedToCompletedPct: number;
      };
      timeToSign: {
        completedCount: number;
        averageMs: number | null;
        medianMs: number | null;
        byTemplate: Array<{ templateId: string | null; count: number; averageMs: number }>;
      };
      stuckEnvelopes: Array<{
        id: string;
        title: string;
        sent_at?: string;
        days_since_sent: number;
        signer_count: number;
        client_id?: string;
      }>;
      throughput30d: Array<{ date: string; completed: number }>;
    }>(`/esign/metrics`);
  },

  // ==================== RECOVERY BIN (P6.8) ====================

  /** List soft-deleted envelopes for the caller's firm. */
  async listRecoveryBin(): Promise<{
    envelopes: Array<Record<string, unknown>>;
    retention_days: number;
  }> {
    return api.get(`/esign/recovery-bin`);
  },

  /** Restore a soft-deleted envelope. */
  async restoreEnvelope(
    envelopeId: string,
  ): Promise<{ success: boolean; envelope: Record<string, unknown> }> {
    return api.post(`/esign/recovery-bin/${envelopeId}/restore`, {});
  },

  /** Permanently purge a single envelope from the recovery bin. */
  async purgeEnvelope(envelopeId: string): Promise<{ success: boolean; purged: boolean }> {
    return api.delete(`/esign/recovery-bin/${envelopeId}`);
  },

  /**
   * Get API base URL
   */
  getApiBaseUrl,

  // ==================== MAINTENANCE / BULK OPERATIONS ====================

  /**
   * Run envelope expiry sweep (admin only, dry-run-first pattern)
   */
  async runExpirySweep(dryRun = true): Promise<{
    success: boolean;
    scannedCount: number;
    expiredCount: number;
    skippedCount: number;
    expired: Array<{
      envelopeId: string;
      title: string;
      status: string;
      expiresAt: string;
      signerCount: number;
      signedCount: number;
    }>;
    errors: Array<{ envelopeId: string; error: string }>;
    dryRun: boolean;
    durationMs: number;
  }> {
    return api.post('/esign/maintenance/expiry-sweep', { dryRun });
  },

  /**
   * Send reminders to pending signers across multiple envelopes (admin only)
   */
  async bulkRemind(
    envelopeIds: string[],
    dryRun = true,
  ): Promise<{
    success: boolean;
    dryRun: boolean;
    envelopeCount: number;
    totalPendingSigners: number;
    totalRemindersSent: number;
    results: Array<{
      envelopeId: string;
      title: string;
      pendingSigners: Array<{ name: string; email: string }>;
      remindersSent: number;
      error?: string;
    }>;
  }> {
    return api.post('/esign/maintenance/bulk-remind', { envelopeIds, dryRun });
  },

  /**
   * Void multiple envelopes at once (admin only, dry-run-first pattern)
   */
  async bulkVoid(
    envelopeIds: string[],
    reason: string,
    dryRun = true,
  ): Promise<{
    success: boolean;
    dryRun: boolean;
    envelopeCount: number;
    voidedCount: number;
    results: Array<{
      envelopeId: string;
      title: string;
      previousStatus: string;
      voided: boolean;
      error?: string;
    }>;
  }> {
    return api.post('/esign/maintenance/bulk-void', { envelopeIds, reason, dryRun });
  },

  /**
   * Verify a document hash against stored envelope data (public)
   */
  async verifyDocumentHash(hash: string): Promise<{
    verified: boolean;
    matchType?: 'original' | 'signed';
    envelope?: {
      id: string;
      title: string;
      status: string;
      completedAt: string | null;
      createdAt: string;
    };
    signers?: Array<{
      name: string;
      role: string;
      status: string;
      signedAt: string | null;
    }>;
    message: string;
  }> {
    return api.post('/esign/verify-hash', { hash });
  },
};
