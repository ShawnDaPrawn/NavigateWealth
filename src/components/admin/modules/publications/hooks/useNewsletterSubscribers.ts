/**
 * Newsletter Subscribers — Data Hook (React Query)
 *
 * Guidelines §6  — All server state managed by React Query.
 * Guidelines §11.2 — Deterministic query keys from centralised registry.
 */

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { NewsletterAPI } from '../api';
import { newsletterKeys } from './queryKeys';
import type { Subscriber, SubscriberStatusFilter, UnsubTimeRange } from '../types';
import { deriveSubscriberStatus, filterByTimeRange } from '../utils';

// ── Stats shape ────────────────────────────────────────────────────────

export interface SubscriberStats {
  total: number;
  active: number;
  pending: number;
  unsubscribed: number;
}

// ── Hook ────────────────────────────────────────────────────────────────

interface UseNewsletterSubscribersOptions {
  statusFilter?: SubscriberStatusFilter;
  search?: string;
  unsubTimeRange?: UnsubTimeRange;
}

interface UseNewsletterSubscribersReturn {
  /** All subscribers (unfiltered) */
  subscribers: Subscriber[];
  /** Filtered subscriber list */
  filtered: Subscriber[];
  /** Aggregate counts */
  stats: SubscriberStats;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useNewsletterSubscribers(
  options: UseNewsletterSubscribersOptions = {},
): UseNewsletterSubscribersReturn {
  const { statusFilter = 'all', search = '', unsubTimeRange = 'all' } = options;

  const {
    data,
    isLoading,
    error,
    refetch: rawRefetch,
  } = useQuery({
    queryKey: newsletterKeys.subscribers(),
    queryFn: async () => {
      const res = await NewsletterAPI.getSubscribers();
      return res.subscribers ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const subscribers = data ?? [];

  // ── Stats (derived from full list) ──────────────────────────────────
  const stats = useMemo<SubscriberStats>(() => ({
    total: subscribers.length,
    active: subscribers.filter((s) => deriveSubscriberStatus(s) === 'active').length,
    pending: subscribers.filter((s) => deriveSubscriberStatus(s) === 'pending').length,
    unsubscribed: subscribers.filter((s) => deriveSubscriberStatus(s) === 'unsubscribed').length,
  }), [subscribers]);

  // ── Filtering ───────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = subscribers;

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((s) => deriveSubscriberStatus(s) === statusFilter);
    }

    // Search
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (s) =>
          s.email.toLowerCase().includes(q) ||
          s.firstName.toLowerCase().includes(q) ||
          s.surname.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q),
      );
    }

    // Unsubscribed-specific: time-range + date sort
    if (statusFilter === 'unsubscribed') {
      result = filterByTimeRange(result, unsubTimeRange);
      result = [...result].sort((a, b) => {
        const dateA = a.unsubscribedAt ? new Date(a.unsubscribedAt).getTime() : 0;
        const dateB = b.unsubscribedAt ? new Date(b.unsubscribedAt).getTime() : 0;
        return dateB - dateA;
      });
    }

    return result;
  }, [subscribers, statusFilter, search, unsubTimeRange]);

  // ── Refetch wrapper ─────────────────────────────────────────────────
  const refetch = async () => {
    await rawRefetch();
  };

  return {
    subscribers,
    filtered,
    stats,
    isLoading,
    error: error
      ? error instanceof Error
        ? error.message
        : 'Failed to load newsletter subscribers'
      : null,
    refetch,
  };
}
