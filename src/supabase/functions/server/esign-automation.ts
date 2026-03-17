/**
 * E-Signature Reminder Config Service
 * Handles per-envelope reminder settings.
 * Refactored to remove global automation cycle logic.
 */

import * as kv from "./kv_store.tsx";

// ==================== TYPES ====================

export interface ReminderConfig {
  auto_remind: boolean;
  remind_interval_days: number; // days between reminders
  max_reminders: number;        // max total reminders per signer
  remind_before_expiry_days: number; // send urgent reminder X days before expiry
}

/** Default reminder config when none specified on envelope */
const DEFAULT_REMINDER_CONFIG: ReminderConfig = {
  auto_remind: true,
  remind_interval_days: 3,
  max_reminders: 5,
  remind_before_expiry_days: 2,
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
  await kv.set(KEYS.envelopeReminderConfig(envelopeId), { ...existing, ...config });
}
