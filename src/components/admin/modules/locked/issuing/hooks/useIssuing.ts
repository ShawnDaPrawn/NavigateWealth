/**
 * Issuing — Query & Mutation Hooks
 *
 * Hooks are the only consumers of the API layer. React Query owns server state.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { issuingKeys } from '../queryKeys';
import { IssuingAPI } from '../api';
import type { CardholderInput, CardInput } from '../types';

const STALE_TIME = 30 * 1000;

export function useCardholders() {
  return useQuery({
    queryKey: issuingKeys.cardholders(),
    queryFn: () => IssuingAPI.listCardholders(),
    staleTime: STALE_TIME,
  });
}

export function useCards() {
  return useQuery({
    queryKey: issuingKeys.cards(),
    queryFn: () => IssuingAPI.listCards(),
    staleTime: STALE_TIME,
  });
}

export function useCreateCardholder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CardholderInput) => IssuingAPI.createCardholder(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: issuingKeys.cardholders() });
      toast.success('Cardholder created');
    },
    onError: (error: Error) => {
      toast.error('Failed to create cardholder', { description: error.message });
    },
  });
}

export function useCreateVirtualCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CardInput) => IssuingAPI.createVirtualCard(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: issuingKeys.cards() });
      toast.success('Virtual card created');
    },
    onError: (error: Error) => {
      toast.error('Failed to create card', { description: error.message });
    },
  });
}

/** Reveal a card's PAN + CVC on demand. Result is intentionally not cached. */
export function useCardSecrets() {
  return useMutation({
    mutationFn: (cardId: string) => IssuingAPI.getCardSecrets(cardId),
    onError: (error: Error) => {
      toast.error('Failed to reveal card', { description: error.message });
    },
  });
}
