/**
 * policy-document-intake-service.ts — the base64 an upload hands to submit.
 *
 * `encodeIntakePdf` must give exactly the standard, padded base64 that submit
 * expects, for every byte value and every length's padding. It must also work
 * without `ArrayBuffer.prototype.transfer`: std's `encodeBase64` needs it, and
 * the Node 20 that CI runs the tests on does not have it.
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

import { decodeIntakePdf, encodeIntakePdf } from '../policy-document-intake-service.ts';

/** Every byte value in turn, so every character of the alphabet appears. */
const bytesOf = (length: number) => Uint8Array.from({ length }, (_, i) => (i * 7 + 3) % 256);
const base64Of = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64');

/**
 * Equal, or a failure that shows only where the two first differ. A full diff
 * of this much base64 takes vitest minutes, so a bug would hang the suite.
 */
function expectSameText(actual: string, expected: string): void {
  if (actual === expected) return;
  let at = 0;
  while (at < actual.length && actual[at] === expected[at]) at++;
  const window = (text: string) => ({ at, length: text.length, text: text.slice(at, at + 24) });
  expect(window(actual)).toEqual(window(expected));
}

describe('encodeIntakePdf', () => {
  // Lengths of every remainder mod 3, so no padding, "==" and "=".
  it.each([0, 1, 2, 3, 4, 5, 255, 256, 257, 32_767, 32_768, 32_769, 98_306])(
    'gives standard, padded base64 for %i bytes',
    (length) => {
      const bytes = bytesOf(length);
      expectSameText(encodeIntakePdf(bytes), base64Of(bytes));
    },
  );

  it('round-trips through decodeIntakePdf byte for byte', () => {
    const bytes = bytesOf(163_841);
    const back = decodeIntakePdf(encodeIntakePdf(bytes));
    expect(back.length).toBe(bytes.length);
    expect(Buffer.from(back).equals(Buffer.from(bytes))).toBe(true);
  });

  it('encodes only the view it is given, not the rest of its buffer', () => {
    const whole = bytesOf(64);
    expect(encodeIntakePdf(whole.subarray(10, 20))).toBe(base64Of(whole.slice(10, 20)));
  });

  it('needs no ArrayBuffer.prototype.transfer, which the Node 20 in CI lacks', () => {
    const proto = ArrayBuffer.prototype as { transfer?: unknown };
    const saved = Object.getOwnPropertyDescriptor(proto, 'transfer');
    delete proto.transfer;
    try {
      expect(encodeIntakePdf(bytesOf(100))).toBe(base64Of(bytesOf(100)));
    } finally {
      if (saved) Object.defineProperty(proto, 'transfer', saved);
    }
  });
});
