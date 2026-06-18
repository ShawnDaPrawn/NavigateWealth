/**
 * Treasury — Query & Mutation Hooks
 *
 * Hooks are the only consumers of the API layer. React Query owns all server
 * state. Money-movement mutations invalidate the balance and transaction lists
 * on success so the panel reflects the new state immediately.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { treasuryKeys } from '../queryKeys';
import { TreasuryAPI } from '../api';
import type { DepositInput, SendInput } from '../types';

const STALE_TIME = 30 * 1000;

// ============================================================================
// Queries
// ============================================================================

export function useTreasuryFinancialAccount() {
  return useQuery({
    queryKey: treasuryKeys.account(),
    queryFn: () => TreasuryAPI.getFinancialAccount(),
    staleTime: STALE_TIME,
  });
}

export function useTreasuryBalance() {
  return useQuery({
    queryKey: treasuryKeys.balance(),
    queryFn: () => TreasuryAPI.getBalance(),
    staleTime: STALE_TIME,
  });
}

export function usePlatformBalance() {
  return useQuery({
    queryKey: treasuryKeys.platformBalance(),
    queryFn: () => TreasuryAPI.getPlatformBalance(),
    staleTime: STALE_TIME,
  });
}

export function useTreasuryTransactions() {
  return useQuery({
    queryKey: treasuryKeys.transactions(),
    queryFn: () => TreasuryAPI.listTransactions(),
    staleTime: STALE_TIME,
  });
}

// ============================================================================
// Money movement
// ============================================================================

/** Invalidate every balance + transaction view after money moves. */
function invalidateMoneyViews(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: treasuryKeys.account() });
  qc.invalidateQueries({ queryKey: treasuryKeys.balance() });
  qc.invalidateQueries({ queryKey: treasuryKeys.platformBalance() });
  qc.invalidateQueries({ queryKey: treasuryKeys.transactions() });
}

export function useDeposit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DepositInput) => TreasuryAPI.deposit(input),
    onSuccess: () => {
      invalidateMoneyViews(qc);
      toast.success('Deposit initiated');
    },
    onError: (error: Error) => {
      toast.error('Deposit failed', { description: error.message });
    },
  });
}

export function useSend() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SendInput) => TreasuryAPI.send(input),
    onSuccess: () => {
      invalidateMoneyViews(qc);
      toast.success('Payment sent');
    },
    onError: (error: Error) => {
      toast.error('Payment failed', { description: error.message });
    },
  });
}
