/**
 * Password Manager data. Everything is small (the vault holds tens of logins),
 * so each list loads whole and every change refreshes what it touched.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { vaultApi } from './api';

export const passwordManagerKeys = {
  all: ['password-manager'] as const,
  logins: () => [...passwordManagerKeys.all, 'logins'] as const,
  services: () => [...passwordManagerKeys.all, 'services'] as const,
  skills: () => [...passwordManagerKeys.all, 'skills'] as const,
  agents: () => [...passwordManagerKeys.all, 'agents'] as const,
  approvals: () => [...passwordManagerKeys.all, 'approvals'] as const,
  events: (actor: string) => [...passwordManagerKeys.all, 'events', actor] as const,
};

const fresh = { staleTime: 15_000, retry: 1 } as const;

export const useLogins = () =>
  useQuery({ queryKey: passwordManagerKeys.logins(), queryFn: vaultApi.logins, ...fresh });
export const useServices = () =>
  useQuery({ queryKey: passwordManagerKeys.services(), queryFn: vaultApi.services, ...fresh });
export const useSkills = () =>
  useQuery({ queryKey: passwordManagerKeys.skills(), queryFn: vaultApi.skills, ...fresh });
export const useAgents = () =>
  useQuery({ queryKey: passwordManagerKeys.agents(), queryFn: vaultApi.agents, ...fresh });
export const useApprovals = () =>
  useQuery({
    queryKey: passwordManagerKeys.approvals(),
    queryFn: vaultApi.approvals,
    refetchInterval: 30_000,
    retry: 1,
  });

/** Refreshes the whole module after a change; the lists are tiny. */
export function useRefresh() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: passwordManagerKeys.all });
}

/** A change that refreshes everything when it succeeds. */
export function useVaultMutation<A, R>(fn: (args: A) => Promise<R>) {
  const refresh = useRefresh();
  return useMutation({ mutationFn: fn, onSuccess: () => refresh() });
}
