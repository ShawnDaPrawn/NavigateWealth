/**
 * policy-document-intake-service.ts — the base64 an upload hands to submit.
 *
 * `encodeIntakePdf` must give exactly the standard, padded base64 that submit
 * expects, for every byte value and across its chunk boundaries. It must also
 * work without `ArrayBuffer.prototype.transfer`: std's `encodeBase64` needs it,
 * and the Node 20 that CI runs the tests on does not have it.
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

/** Every byte value in turn: the bytes a binary-string encoder gets wrong. */
const bytesOf = (length: number) => Uint8Array.from({ length }, (_, i) => (i * 7 + 3) % 256);
const base64Of = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64');

const CHUNK = 0x8000;

describe('encodeIntakePdf', () => {
  it.each([0, 1, 2, 3, 4, 255, 256, CHUNK - 1, CHUNK, CHUNK + 1, 3 * CHUNK + 2])(
    'gives standard, padded base64 for %i bytes',
    (length) => {
      const bytes = bytesOf(length);
      expect(encodeIntakePdf(bytes)).toBe(base64Of(bytes));
    },
  );

  it('round-trips through decodeIntakePdf byte for byte', () => {
    const bytes = bytesOf(5 * CHUNK + 1);
    expect(decodeIntakePdf(encodeIntakePdf(bytes))).toEqual(bytes);
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
