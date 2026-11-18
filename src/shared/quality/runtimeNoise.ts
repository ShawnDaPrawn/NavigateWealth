/**
 * Runtime reports that are not product bugs.
 *
 * The Issues panel was filling up with stale-deploy chunk crashes, preview
 * runs on localhost, wrong-password sign-ins, the deliberate staff Ask Vasco
 * refusal, and the fetch wrapper's first "Failed to fetch" — which the API
 * client then retries. Both ingest and the dashboard snapshot use this so an
 * old cached bundle cannot reopen one of these after it is resolved.
 *
 * A gateway 546 and an e-sign "Validation failed" are real and are not
 * matched here.
 */

import { isDefinitiveStaleChunkLoadFailure } from './staleChunk.ts';

export interface SuppressibleIssue {
  message?: string;
  title?: string;
  details?: string;
  filePath?: string;
  ruleId?: string;
}

const LOOPBACK_URL = /https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:[/?#]|$)/i;

/** The fetch wrapper's pre-retry TypeError. A status code means something else. */
const BARE_NETWORK_FAILURE = /^(?:failed to fetch|network request failed|load failed)$/i;

function mentionsLoopback(value: string | undefined): boolean {
  return !!value && LOOPBACK_URL.test(value);
}

export function isSuppressedRuntimeIssue(issue: SuppressibleIssue): boolean {
  const message = issue.message ?? '';
  const title = issue.title ?? '';
  const text = `${message}\n${title}`;

  if (isDefinitiveStaleChunkLoadFailure(text)) return true;
  if (
    mentionsLoopback(issue.details) ||
    mentionsLoopback(issue.filePath) ||
    mentionsLoopback(title) ||
    mentionsLoopback(message)
  ) {
    return true;
  }
  if (/invalid credentials|incorrect username or password/i.test(text)) return true;
  if (text.includes('Cannot open Ask Vasco for staff accounts')) return true;
  if (
    issue.ruleId === 'api-failure' &&
    BARE_NETWORK_FAILURE.test(message.trim()) &&
    !/\b[45]\d\d\b/.test(title)
  ) {
    return true;
  }
  return false;
}

/** Production preview (`vite preview`, localhost) must not file issues. Dev and tests stay open. */
export function shouldDropLoopbackReport(prod: boolean, hostname: string | undefined): boolean {
  if (!prod || !hostname) return false;
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}
