/**
 * Whole-rand amounts inside Investment INA advice strings.
 *
 * `formatCurrency` used to call `toLocaleString('en-ZA')`, which puts spaces
 * between thousands in Deno. The strings are shown to the client ("Shortfall
 * of R2 000 000"), so the hand-written commas are the behavior.
 */
import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);

const { formatCurrency } = await import('../investment-ina-calculations.ts');

describe('Investment INA formatCurrency', () => {
  it('groups thousands with commas and rounds to the nearest rand', () => {
    expect(formatCurrency(2000000)).toBe('2,000,000');
    expect(formatCurrency(2000000.4)).toBe('2,000,000');
    expect(formatCurrency(2000000.5)).toBe('2,000,001');
    expect(formatCurrency(0)).toBe('0');
  });

  it('keeps the minus in front of the rands', () => {
    expect(formatCurrency(-1234567.6)).toBe('-1,234,568');
    expect(formatCurrency(-999)).toBe('-999');
  });
});
