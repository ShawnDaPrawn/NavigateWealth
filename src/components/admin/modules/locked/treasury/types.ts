/**
 * Treasury — Types
 *
 * Client-side shapes mirroring the sanitized payloads returned by the
 * /treasury edge routes. All amounts are integer minor units (cents).
 */

export interface BankDetails {
  type: string;
  bankName: string | null;
  routingNumber: string | null;
  /** Full account number — only present on the audited financial-account read. */
  accountNumber: string | null;
  accountNumberLast4: string | null;
  supportedNetworks: string[];
}

export interface TreasuryFinancialAccount {
  id: string;
  status: string;
  currency: string;
  balance: TreasuryBalance;
  bankDetails: BankDetails[];
  accountHolderName: string | null;
  activeFeatures: string[];
}

export interface TreasuryBalance {
  /** Present on the standalone balance endpoint; omitted inside the account DTO. */
  currency?: string;
  cash: number;
  inboundPending: number;
  outboundPending: number;
}

export interface PlatformBalanceRow {
  amount: number;
  currency: string;
}

export interface PlatformBalance {
  available: PlatformBalanceRow[];
  pending: PlatformBalanceRow[];
}

export interface TreasuryTransaction {
  id: string;
  amount: number;
  currency: string;
  status: string;
  flowType: string | null;
  description: string | null;
  created: number;
}

export interface DepositInput {
  /** Integer minor units (cents). */
  amount: number;
  currency?: string;
  originPaymentMethod: string;
  description?: string;
}

export interface SendInput {
  /** Integer minor units (cents). */
  amount: number;
  currency?: string;
  destinationPaymentMethod: string;
  description?: string;
}

export interface MovementResult {
  id: string;
  status: string;
  amount: number;
}
