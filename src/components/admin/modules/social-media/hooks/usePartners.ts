/**
 * usePartners — partner advertisers list and mutations (toasts on every save).
 *
 * @module social-media/hooks/usePartners
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { partnersApi } from '../api';
import type { PartnerInput } from '../types';

export const partnerKeys = {
  all: ['social-media', 'partners'] as const,
};

const messageOf = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;

export function usePartners() {
  return useQuery({ queryKey: partnerKeys.all, queryFn: () => partnersApi.list() });
}

export function useSavePartner() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: PartnerInput }) =>
      id ? partnersApi.update(id, input) : partnersApi.create(input),
    onSuccess: (partner, { id }) => {
      void client.invalidateQueries({ queryKey: partnerKeys.all });
      toast.success(id ? `${partner.name} updated` : `${partner.name} added`);
    },
    onError: (err) => toast.error(messageOf(err, 'Failed to save the partner')),
  });
}

export function useDeletePartner() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; name: string }) => partnersApi.remove(id),
    onSuccess: (_, { name }) => {
      void client.invalidateQueries({ queryKey: partnerKeys.all });
      toast.success(`${name} removed`);
    },
    onError: (err) => toast.error(messageOf(err, 'Failed to remove the partner')),
  });
}
