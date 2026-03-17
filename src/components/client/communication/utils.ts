/**
 * Client Communication Module — Utilities
 *
 * Pure functions for date formatting and filtering logic.
 * Guidelines refs: §7.1 (derived display state), §8.3 (en-ZA date locale)
 */

import type { Communication, CommunicationFilters } from './types';
import { DATE_RANGE_DAYS } from './constants';
import DOMPurify from 'dompurify';

// ── HTML Content Helpers ────────────────────────────────────────────────────

/**
 * Detect whether a string contains HTML markup.
 */
export function isHtmlContent(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test(text);
}

/**
 * Strip HTML tags from a string to produce a plain-text excerpt.
 * Used in list cards where we need a short text preview.
 */
export function stripHtml(html: string): string {
  // Replace block-level elements with spaces for readability
  const text = html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/?(p|div|li|h[1-6]|tr|blockquote)[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '')           // Remove remaining tags
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')             // Collapse whitespace
    .trim();
  return text;
}

/**
 * Sanitise HTML content via DOMPurify before rendering.
 *
 * This is a security hardening measure — admin-composed messages may contain
 * arbitrary HTML from the rich-text editor. DOMPurify strips XSS vectors
 * (script tags, event handlers, data URIs, etc.) while preserving safe
 * formatting elements.
 *
 * Allowed tags are scoped to the set used by the admin compose editor.
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr',
      'ul', 'ol', 'li',
      'strong', 'b', 'em', 'i', 'u', 's', 'del', 'ins', 'mark',
      'a', 'img',
      'blockquote', 'pre', 'code',
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
      'div', 'span',
      'sub', 'sup',
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'rel', 'title',
      'src', 'alt', 'width', 'height',
      'class', 'style',
      'colspan', 'rowspan',
    ],
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Format a date as a human-readable relative string.
 * Falls back to en-ZA locale format for dates older than 7 days (§8.3).
 */
export function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days === 0) {
    if (hours === 0) return 'Just now';
    if (hours === 1) return '1 hour ago';
    return `${hours} hours ago`;
  }
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;

  return date.toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format a date as a full date-time string (for detail view).
 */
export function formatFullDate(date: Date): string {
  return date.toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Apply search, category, and date-range filters to a list of communications.
 * Returns a new sorted array (newest first).
 */
export function filterCommunications(
  communications: Communication[],
  filters: CommunicationFilters,
): Communication[] {
  let filtered = [...communications];

  // Search
  if (filters.search) {
    const query = filters.search.toLowerCase();
    filtered = filtered.filter(
      (c) => {
        // Strip HTML from message content for clean text search
        const plainMessage = isHtmlContent(c.message) ? stripHtml(c.message) : c.message;
        return (
          c.subject.toLowerCase().includes(query) ||
          plainMessage.toLowerCase().includes(query) ||
          c.from.toLowerCase().includes(query)
        );
      },
    );
  }

  // Category
  if (filters.category !== 'all') {
    filtered = filtered.filter((c) => c.category === filters.category);
  }

  // Date range
  if (filters.dateRange !== 'all') {
    const days = DATE_RANGE_DAYS[filters.dateRange];
    if (days) {
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      filtered = filtered.filter((c) => c.timestamp >= cutoff);
    }
  }

  return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

/**
 * Derive inbox stats from communications list.
 */
export function deriveInboxStats(communications: Communication[]) {
  return {
    total: communications.length,
    unread: communications.filter((c) => !c.read).length,
    important: communications.filter(
      (c) => c.category === 'Important' || c.priority === 'urgent' || c.priority === 'high',
    ).length,
  };
}

/**
 * Count active channels from preferences.
 */
export function countActiveChannels(prefs: {
  transactional: { email: boolean; sms: boolean };
  marketing: { email: boolean; sms: boolean };
}): number {
  let count = 0;
  if (prefs.transactional.email) count++;
  if (prefs.transactional.sms) count++;
  if (prefs.marketing.email) count++;
  if (prefs.marketing.sms) count++;
  return count;
}