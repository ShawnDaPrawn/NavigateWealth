/**
 * Issuing — Types
 *
 * Client-side shapes mirroring the sanitized payloads from the /issuing edge
 * routes. Card secrets (PAN + CVC) are only ever returned by the explicit,
 * audited reveal endpoint.
 */

export type CardholderType = 'company' | 'individual';

export type SpendingLimitInterval =
  | 'per_authorization'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'all_time';

export interface Cardholder {
  id: string;
  name: string;
  email: string | null;
  phoneNumber: string | null;
  type: string;
  status: string;
  created: number;
}

export interface IssuingCard {
  id: string;
  last4: string;
  brand: string;
  expMonth: number;
  expYear: number;
  status: string;
  currency: string;
  cardholderId: string;
  cardholderName: string | null;
  created: number;
}

export interface CardSecrets {
  number: string;
  cvc: string;
  expMonth: number;
  expYear: number;
  last4: string;
}

export interface BillingAddressInput {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
}

export interface CardholderInput {
  name: string;
  email?: string;
  phoneNumber?: string;
  type?: CardholderType;
  taxId?: string;
  billingAddress: BillingAddressInput;
}

export interface CardInput {
  cardholderId: string;
  currency?: string;
  /** Integer minor units (cents). */
  spendingLimitAmount?: number;
  spendingLimitInterval?: SpendingLimitInterval;
}
