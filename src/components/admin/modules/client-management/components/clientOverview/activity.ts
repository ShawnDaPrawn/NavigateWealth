/**
 * The activity feed: filtering and enriching raw activity events.
 *
 * Split out of `clientOverviewUtils.ts` (1,650 lines), itself an earlier
 * extraction from `ClientOverviewTab.tsx`. Pure functions — no React, no
 * hooks, no I/O.
 */
import type { ElementType } from 'react';

// ── Activity-feed derivation ─────────────────────────

export interface ActivityEvent {
  id: string;
  type: string;
  label: string;
  timestamp: string;
  icon: ElementType;
  iconColor: string;
  success?: boolean;
  detail?: string;
}

/** Activity types excluded from the overview feed (noise — belongs in Security). */
const ACTIVITY_NOISE_TYPES = new Set(['session_refresh', 'session_expired']);

/** Security/auth activity types hidden in client mode. */
const CLIENT_HIDDEN_ACTIVITY_TYPES = new Set([
  'login_failure',
  'login_attempt',
  'password_reset_request',
  'password_change',
  'forced_logout',
  'account_locked',
  'suspicious_activity',
]);

export interface ActivityEventIcons {
  FileCheck: ElementType;
  ClipboardCheck: ElementType;
  FileText: ElementType;
}

export interface EnrichedActivityInputs {
  activityEvents: ActivityEvent[];
  fnaStatuses: ReadonlyArray<{
    publishedAt?: string | null;
    submittedAt?: string | null;
    updatedAt?: string | null;
    key: string;
    name: string;
    status?: string;
  }>;
  isClient: boolean;
  icons: ActivityEventIcons;
}

/**
 * Merge stored activity events with FNA lifecycle events (published / submitted /
 * draft), drop noise + client-hidden types, and sort newest-first. Pure: same
 * inputs -> same ActivityEvent[]. Lucide icons threaded in as data.
 */
export function deriveEnrichedActivityEvents(inputs: EnrichedActivityInputs): ActivityEvent[] {
  const { activityEvents, fnaStatuses, isClient, icons } = inputs;
  const { FileCheck, ClipboardCheck, FileText } = icons;
  const fnaEvents: ActivityEvent[] = [];

  fnaStatuses.forEach((fna) => {
    if (fna.publishedAt) {
      fnaEvents.push({
        id: `fna-published-${fna.key}`,
        type: 'fna_published',
        label: `${fna.name} published`,
        timestamp: fna.publishedAt,
        icon: FileCheck,
        iconColor: 'text-gray-500',
        success: true,
      });
    } else if (fna.status === 'submitted' && (fna.submittedAt || fna.updatedAt)) {
      fnaEvents.push({
        id: `fna-intake-submitted-${fna.key}`,
        type: 'fna_intake_submitted',
        label: isClient
          ? `${fna.name} submitted for review`
          : `${fna.name} — client intake submitted`,
        timestamp: (fna.submittedAt || fna.updatedAt) as string,
        icon: ClipboardCheck,
        iconColor: 'text-blue-600',
        success: true,
      });
    } else if (fna.updatedAt && fna.status === 'draft') {
      fnaEvents.push({
        id: `fna-draft-${fna.key}`,
        type: 'fna_draft',
        label: `${fna.name} draft saved`,
        timestamp: fna.updatedAt,
        icon: FileText,
        iconColor: 'text-gray-500',
        success: true,
      });
    }
  });

  // Combine and filter noise (client mode also hides security events)
  const combined = [...activityEvents, ...fnaEvents]
    .filter((evt) => !ACTIVITY_NOISE_TYPES.has(evt.type))
    .filter((evt) => !isClient || !CLIENT_HIDDEN_ACTIVITY_TYPES.has(evt.type));
  combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return combined;
}

export const INITIAL_ACTIVITY_COUNT = 8;
