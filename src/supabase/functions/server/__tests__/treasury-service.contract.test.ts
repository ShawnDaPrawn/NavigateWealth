/**
 * treasury-service.ts — contract tests
 * ====================================
 *
 * The Stripe v2 money-management integration behind Locked → Accounts →
 * Manager. The Stripe HTTP boundary is stubbed with the response shapes the
 * LIVE account actually returns (captured 2026-08-30), because the panel's
 * only two regressions to date were both shape mismatches our types happily
 * absorbed.
 *
 * The load-bearing pins:
 *
 * 1. The reveal read must request ONLY include values this API version
 *    accepts. `credentials.sepa_bank_account.iban` is not in the enum, and one
 *    bad value fails the ENTIRE financial-addresses request with
 *    `invalid_fields` — which the old code swallowed into "no bank details",
 *    blanking every account number in the panel.
 *
 * 2. If Stripe ever rejects the reveal include list again, the service must
 *    degrade to the masked listing (last4 + routing), not to an empty card.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = {
    env: {
      get: (key: string) =>
        key === 'STRIPE_SECRET_KEY'
          ? 'sk_test_treasury'
          : key === 'STRIPE_FINANCIAL_ACCOUNT_ID'
            ? 'fa_test_123'
            : undefined,
    },
  };
});

vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);

import { TreasuryService } from '../locked/treasury-service.ts';

/** Include values the live API version accepts for financial addresses. */
const VALID_INCLUDES = new Set([
  'credentials.us_bank_account.account_number',
  'credentials.gb_bank_account.account_number',
]);

/** The v2 financial account as the live API returns it (amounts changed). */
const FA_RESPONSE = {
  id: 'fa_test_123',
  object: 'v2.money_management.financial_account',
  status: 'open',
  type: 'storage',
  storage: { holds_currencies: ['eur', 'gbp', 'usd'] },
  balance: {
    available: {
      eur: { value: 0, currency: 'eur' },
      gbp: { value: 250, currency: 'gbp' },
      usd: { value: 1000, currency: 'usd' },
    },
    inbound_pending: {
      eur: { value: 0, currency: 'eur' },
      gbp: { value: 0, currency: 'gbp' },
      usd: { value: 50, currency: 'usd' },
    },
    outbound_pending: {
      eur: { value: 0, currency: 'eur' },
      gbp: { value: 0, currency: 'gbp' },
      usd: { value: 0, currency: 'usd' },
    },
  },
};

/**
 * The three live financial addresses. `revealed` controls whether the US/GB
 * full account numbers are present — Stripe returns `account_number: null`
 * unless the field is in `include`. The SEPA IBAN is an empty string either
 * way on this API version.
 */
function addressesResponse(revealed: boolean) {
  return {
    data: [
      {
        id: 'finaddr_gb',
        currency: 'gbp',
        status: 'active',
        credentials: {
          type: 'gb_bank_account',
          gb_bank_account: {
            account_holder_name: 'Navigate Wealth Ltd',
            account_number: revealed ? '12345678' : null,
            last4: '5678',
            sort_code: '123456',
          },
        },
      },
      {
        id: 'finaddr_sepa',
        currency: 'eur',
        status: 'active',
        credentials: {
          type: 'sepa_bank_account',
          sepa_bank_account: {
            account_holder_name: 'Navigate Wealth',
            bank_name: 'BANKING CIRCLE',
            bic: 'BCIRDEFFXXX',
            iban: '',
            last4: '9012',
          },
        },
      },
      {
        id: 'finaddr_us',
        currency: 'usd',
        status: 'active',
        credentials: {
          type: 'us_bank_account',
          us_bank_account: {
            account_holder_name: 'Navigate Wealth',
            account_number: revealed ? '12345678901234567' : null,
            bank_name: 'FIFTH THIRD BANK US',
            bic: '',
            last4: '4567',
            routing_number: '123456789',
          },
        },
      },
    ],
    next_page_url: null,
  };
}

const INVALID_FIELDS_ERROR = {
  error: {
    code: 'invalid_fields',
    message:
      "Some fields in the request were invalid: 'include[2]: Unrecognized enum value" +
      " 'credentials.sepa_bank_account.iban', valid values are:" +
      " credentials.gb_bank_account.account_number, credentials.us_bank_account.account_number.'",
  },
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Stripe stub faithful to the one behaviour that caused the outage: any
 * `include[N]` value outside the enum fails the whole request with a 400.
 */
function stubStripe() {
  return vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input instanceof Request ? input.url : input));
    if (url.pathname === '/v2/money_management/financial_accounts/fa_test_123') {
      return json(FA_RESPONSE);
    }
    if (url.pathname === '/v2/money_management/financial_addresses') {
      const includes = [...url.searchParams.entries()]
        .filter(([k]) => k.startsWith('include'))
        .map(([, v]) => v);
      if (includes.some((v) => !VALID_INCLUDES.has(v))) {
        return json(INVALID_FIELDS_ERROR, 400);
      }
      return json(addressesResponse(includes.length > 0));
    }
    if (url.pathname === '/v1/account') {
      return json({ business_profile: { name: 'Navigate Wealth' } });
    }
    throw new Error(`Unexpected Stripe call: ${url.pathname}`);
  });
}

let fetchMock: ReturnType<typeof stubStripe>;

beforeEach(() => {
  fetchMock = stubStripe();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getFinancialAccount (reveal read)', () => {
  it('returns every address with full US/GB numbers and a masked SEPA', async () => {
    const account = await TreasuryService.getFinancialAccount(true);

    expect(account.status).toBe('open');
    expect(account.bankDetails).toHaveLength(3);

    const us = account.bankDetails.find((b) => b.type === 'us_bank_account');
    expect(us?.accountNumber).toBe('12345678901234567');
    expect(us?.routingNumber).toBe('123456789');

    const gb = account.bankDetails.find((b) => b.type === 'gb_bank_account');
    expect(gb?.accountNumber).toBe('12345678');
    expect(gb?.routingNumber).toBe('123456');

    // SEPA is not revealable on this API version: empty IBAN maps to null,
    // never to an empty CopyableField, and last4 still shows.
    const sepa = account.bankDetails.find((b) => b.type === 'sepa_bank_account');
    expect(sepa?.accountNumber).toBeNull();
    expect(sepa?.accountNumberLast4).toBe('9012');
    expect(sepa?.routingNumber).toBe('BCIRDEFFXXX');
  });

  it('never sends an include value outside the API version enum', async () => {
    await TreasuryService.getFinancialAccount(true);

    const addressCalls = fetchMock.mock.calls
      .map(([input]) => new URL(String(input)))
      .filter((u) => u.pathname === '/v2/money_management/financial_addresses');
    expect(addressCalls.length).toBeGreaterThan(0);
    for (const u of addressCalls) {
      for (const [k, v] of u.searchParams.entries()) {
        if (k.startsWith('include')) expect(VALID_INCLUDES.has(v)).toBe(true);
      }
    }
  });

  it('degrades a rejected reveal read to the masked listing, not an empty card', async () => {
    // First financial_addresses call 400s regardless of include validity,
    // simulating Stripe rotating the enum out from under us again.
    let first = true;
    const inner = fetchMock;
    vi.stubGlobal('fetch', async (input: string | URL | Request) => {
      const url = new URL(String(input instanceof Request ? input.url : input));
      if (url.pathname === '/v2/money_management/financial_addresses' && first) {
        first = false;
        return json(INVALID_FIELDS_ERROR, 400);
      }
      return inner(input);
    });

    const account = await TreasuryService.getFinancialAccount(true);

    expect(account.bankDetails).toHaveLength(3);
    const us = account.bankDetails.find((b) => b.type === 'us_bank_account');
    expect(us?.accountNumber).toBeNull(); // masked fallback…
    expect(us?.accountNumberLast4).toBe('4567'); // …but still visible
  });
});

describe('getBalance', () => {
  it('maps every held currency and mirrors USD as the primary', async () => {
    const balance = await TreasuryService.getBalance();

    expect(balance.currency).toBe('usd');
    expect(balance.cash).toBe(1000);
    expect(balance.inboundPending).toBe(50);
    expect(balance.perCurrency.map((c) => c.currency)).toEqual(['usd', 'eur', 'gbp']);
    expect(balance.perCurrency.find((c) => c.currency === 'gbp')?.cash).toBe(250);
  });
});
