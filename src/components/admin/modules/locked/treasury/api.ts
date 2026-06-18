/**
 * Treasury — API Layer
 *
 * The only layer that touches the server. All routes are super-admin only and
 * audited server-side. Money-movement calls attach a fresh idempotency key in
 * the request BODY (not a header) so the API client's automatic retry reuses
 * the same key and Stripe de-duplicates the request.
 */

import { api } from '../../../../../utils/api/client';
import { logger } from '../../../../../utils/logger';
import { ENDPOINTS } from './constants';
import type {
  DepositInput,
  MovementResult,
  PlatformBalance,
  SendInput,
  TreasuryBalance,
  TreasuryFinancialAccount,
  TreasuryTransaction,
} from './types';

function rethrow(error: unknown, context: string): never {
  logger.error(`[TreasuryAPI] ${context} failed`, error);
  throw error instanceof Error ? error : new Error('An unknown error occurred');
}

function newIdempotencyKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `idem_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export const TreasuryAPI = {
  async getFinancialAccount(): Promise<TreasuryFinancialAccount> {
    try {
      const data = await api.get<{ account: TreasuryFinancialAccount }>(
        ENDPOINTS.FINANCIAL_ACCOUNT,
      );
      return data.account;
    } catch (error) {
      rethrow(error, 'getFinancialAccount');
    }
  },

  async getBalance(): Promise<TreasuryBalance> {
    try {
      const data = await api.get<{ balance: TreasuryBalance }>(ENDPOINTS.BALANCE);
      return data.balance;
    } catch (error) {
      rethrow(error, 'getBalance');
    }
  },

  async getPlatformBalance(): Promise<PlatformBalance> {
    try {
      const data = await api.get<{ balance: PlatformBalance }>(ENDPOINTS.PLATFORM_BALANCE);
      return data.balance;
    } catch (error) {
      rethrow(error, 'getPlatformBalance');
    }
  },

  async listTransactions(limit = 25): Promise<TreasuryTransaction[]> {
    try {
      const data = await api.get<{ transactions: TreasuryTransaction[] }>(
        `${ENDPOINTS.TRANSACTIONS}?limit=${limit}`,
      );
      return data?.transactions ?? [];
    } catch (error) {
      rethrow(error, 'listTransactions');
    }
  },

  async deposit(input: DepositInput): Promise<MovementResult> {
    try {
      const data = await api.post<{ transfer: MovementResult }>(ENDPOINTS.DEPOSIT, {
        ...input,
        idempotencyKey: newIdempotencyKey(),
      });
      return data.transfer;
    } catch (error) {
      rethrow(error, 'deposit');
    }
  },

  async send(input: SendInput): Promise<MovementResult> {
    try {
      const data = await api.post<{ payment: MovementResult }>(ENDPOINTS.SEND, {
        ...input,
        idempotencyKey: newIdempotencyKey(),
      });
      return data.payment;
    } catch (error) {
      rethrow(error, 'send');
    }
  },
};
