/**
 * E-Signature Reminder Config Service
 * Handles per-envelope reminder settings.
 * Refactored to remove global automation cycle logic.
 */

import * as kv from "./kv_store.tsx";

// ==================== TYPES ====================

/**
 * Reminder policy for an envelope.
 *
 * Two modes are supported:
 *
 *   `fixed`       — send a reminder every `remind_interval_days` days, up to
 *                   `max_reminders` total, until the signer completes. Easy
 *                   to reason about but tends to under-nudge early and
 *                   over-nudge late.
 *
 *   `escalating`  — P5.3. Send reminders on a non-linear schedule measured
 *                   in days since invitation. Default schedule is
 *                   [3, 7, 10, 13] which maps to: gentle nudge, firm nudge,
 *                   urgent nudge, final nudge. This mirrors what DocuSign /
 *                   Adobe Sign do out of the box and keeps the sender from
 *                   burning goodwill.
 *
 * In either mode `remind_before_expiry_days` triggers an additional urgent
 * reminder in the final stretch of the envelope's life.
 */
export interface ReminderConfig {
  auto_remind: boolean;
  /** P5.3 — cadence strategy. Defaults to `escalating`. */
  schedule?: 'fixed' | 'escalating';
  /** Used when `schedule === 'fixed'`. Days between reminders. */
  remind_interval_days: number;
  /** Upper bound on reminders per signer (both modes). */
  max_reminders: number;
  /** Days before expiry that the urgent reminder fires. */
  remind_before_expiry_days: number;
  /**
   * P5.3 — offsets in days since invitation for the escalating schedule.
   * Each entry fires at most once per signer. Stored in ascending order.
   */
  escalation_offsets_days?: number[];
}

/** Default reminder config when none specified on envelope */
const DEFAULT_REMINDER_CONFIG: ReminderConfig = {
  auto_remind: true,
  schedule: 'escalating',
  remind_interval_days: 3,
  max_reminders: 5,
  remind_before_expiry_days: 2,
  escalation_offsets_days: [3, 7, 10, 13],
};

// ==================== KV KEYS ====================

const KEYS = {
  envelopeReminderConfig: (envelopeId: string) => `esign:envelope:${envelopeId}:reminder_config`,
};

// ==================== REMINDER CONFIG ====================

/**
 * Get reminder config for an envelope (falls back to defaults)
 */
export async function getReminderConfig(envelopeId: string): Promise<ReminderConfig> {
  try {
    const stored = await kv.get(KEYS.envelopeReminderConfig(envelopeId));
    if (stored) return { ...DEFAULT_REMINDER_CONFIG, ...stored };
  } catch (e) {
    // Fall back to defaults
  }
  return DEFAULT_REMINDER_CONFIG;
}

/**
 * Set reminder config for an envelope
 */
export async function setReminderConfig(envelopeId: string, config: Partial<ReminderConfig>): Promise<void> {
  const existing = await getReminderConfig(envelopeId);
  const merged: ReminderConfig = { ...existing, ...config };
  // Keep escalation offsets sorted ascending so consumers can reason
  // deterministically about "which reminder index fires next".
  if (Array.isArray(merged.escalation_offsets_days)) {
    merged.escalation_offsets_days = [...merged.escalation_offsets_days]
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n) && n > 0)
      .sort((a, b) => a - b);
  }
  await kv.set(KEYS.envelopeReminderConfig(envelopeId), merged);
}

/**
 * P5.3 — given the config and signer invite time, compute the list of
 * reminder moments (UTC) at which the escalating schedule would fire. Pure
 * helper so the reminder service and the UI preview can share the same
 * truth.
 */
export function computeEscalationTimestamps(
  config: ReminderConfig,
  invitedAtIso: string | undefined,
): string[] {
  if (!invitedAtIso) return [];
  if (config.schedule !== 'escalating') return [];
  const offsets = config.escalation_offsets_days ?? DEFAULT_REMINDER_CONFIG.escalation_offsets_days!;
  const base = new Date(invitedAtIso).getTime();
  if (!Number.isFinite(base)) return [];
  return offsets.map((d) => new Date(base + d * 24 * 60 * 60 * 1000).toISOString());
}
