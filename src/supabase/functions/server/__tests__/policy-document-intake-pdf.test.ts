/**
 * policy-document-intake-service.ts — where `%%EOF` has to sit.
 *
 * A cut-off upload starts with `%PDF-` and can still contain `%%EOF` from an
 * earlier object. Acrobat only treats a file as whole when that marker is in
 * the last 1 KB, which is the check that keeps a short file off a policy.
 * Searching the whole file, or sliding the window by one byte, would store
 * one or reject a real trailer.
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

import { endsLikeWholePdf } from '../policy-document-intake-service.ts';

const EOF = [0x25, 0x25, 0x45, 0x4f, 0x46]; // %%EOF
const TAIL = 1024;

/** `total` bytes, with `%%EOF` starting at `start`. Nothing else looks like the marker. */
function pdfWithEofAt(start: number, total: number): Uint8Array {
  const bytes = new Uint8Array(total);
  bytes.set(EOF, start);
  return bytes;
}

describe('endsLikeWholePdf', () => {
  it('accepts %%EOF anywhere in the last 1 KB, including the first byte of that window', () => {
    const total = TAIL + 400;
    expect(endsLikeWholePdf(pdfWithEofAt(total - EOF.length, total))).toBe(true);
    expect(endsLikeWholePdf(pdfWithEofAt(total - TAIL, total))).toBe(true);
    // Trailing whitespace after the marker is how a real PDF ends.
    const trailed = pdfWithEofAt(total - TAIL, total);
    trailed[total - 1] = 0x0a;
    expect(endsLikeWholePdf(trailed)).toBe(true);
  });

  it('rejects %%EOF that starts one byte before the last 1 KB, even though the marker overlaps it', () => {
    const total = TAIL + 400;
    expect(endsLikeWholePdf(pdfWithEofAt(total - TAIL - 1, total))).toBe(false);
  });

  it('rejects a file whose only %%EOF is earlier, and one too short to hold the marker', () => {
    expect(endsLikeWholePdf(pdfWithEofAt(0, TAIL + EOF.length))).toBe(false);
    expect(endsLikeWholePdf(new Uint8Array(0))).toBe(false);
    expect(endsLikeWholePdf(new Uint8Array([0x25, 0x25, 0x45, 0x4f]))).toBe(false);
  });

  it('reads only the view it is given, not %%EOF earlier in the same buffer', () => {
    const backing = pdfWithEofAt(0, 64);
    expect(endsLikeWholePdf(backing.subarray(16))).toBe(false);
  });

  it('accepts a short whole PDF, where the last 1 KB is the whole file', () => {
    const bytes = new TextEncoder().encode('%PDF-1.7\n%%EOF\n');
    expect(endsLikeWholePdf(bytes)).toBe(true);
  });
});
