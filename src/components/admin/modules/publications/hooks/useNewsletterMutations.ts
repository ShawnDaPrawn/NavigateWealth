/**
 * Newsletter Subscribers — Mutation Hooks (React Query)
 *
 * Guidelines §6  — Mutations invalidate relevant queries and provide user feedback.
 * Guidelines §11.2 — Query keys from centralised registry.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner@2.0.3';
import { NewsletterAPI } from '../api';
import { newsletterKeys } from './queryKeys';

// ── Add single subscriber ──────────────────────────────────────────────

export function useAddSubscriber() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { email: string; firstName: string; surname: string }) =>
      NewsletterAPI.addSubscriber(input),
    onSuccess: (data) => {
      if (data.alreadySubscribed) {
        toast.info(data.message);
      } else {
        toast.success(data.message);
      }
      queryClient.invalidateQueries({ queryKey: newsletterKeys.subscribers() });
    },
    onError: (error: Error) => {
      console.error('Failed to add subscriber:', error);
      toast.error(error.message || 'Failed to add subscriber');
    },
  });
}

// ── Bulk upload ─────────────────────────────────────────────────────────

export function useBulkUpload() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (subscribers: { email: string; firstName?: string; surname?: string }[]) =>
      NewsletterAPI.bulkAdd(subscribers),
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: newsletterKeys.subscribers() });
    },
    onError: (error: Error) => {
      console.error('Bulk upload failed:', error);
      toast.error(error.message || 'Bulk upload failed');
    },
  });
}

// ── Remove subscriber ──────────────────────────────────────────────────

export function useRemoveSubscriber() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (email: string) => NewsletterAPI.removeSubscriber(email),
    onSuccess: (_data, email) => {
      toast.success(`${email} removed`);
      queryClient.invalidateQueries({ queryKey: newsletterKeys.subscribers() });
    },
    onError: (error: Error) => {
      console.error('Failed to remove subscriber:', error);
      toast.error(error.message || 'Failed to remove subscriber');
    },
  });
}

// ── Re-subscribe ────────────────────────────────────────────────────────

export function useResubscribe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (email: string) => NewsletterAPI.resubscribe(email),
    onSuccess: (_data, email) => {
      toast.success(`${email} re-subscribed`);
      queryClient.invalidateQueries({ queryKey: newsletterKeys.subscribers() });
    },
    onError: (error: Error) => {
      console.error('Failed to re-subscribe:', error);
      toast.error(error.message || 'Failed to re-subscribe');
    },
  });
}
