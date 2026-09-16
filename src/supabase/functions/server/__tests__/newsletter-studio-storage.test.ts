/**
 * newsletter-studio-storage.ts / -attachment.ts — the pure parts.
 *
 * What counts as a PDF is decided by bytes, the cap is 5 MB, file names are
 * made safe, base64 round-trips, and the delivery batch shrinks with the
 * attachment so a tick cannot exhaust the isolate's memory.
 */
import { describe, it, expect, vi } from 'vitest';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);

import {
  assertValidPdf,
  decodePdfBase64,
  encodePdfBase64,
  isPdfBytes,
  MAX_NEWSLETTER_PDF_BYTES,
  safePdfFileName,
} from '../newsletter-studio-storage.ts';
import {
  ATTACHMENT_BATCH_BUDGET_BYTES,
  DELIVERY_BATCH_SIZE,
  deliveryBatchSize,
  MIN_DELIVERY_BATCH_SIZE,
} from '../newsletter-studio-attachment.ts';

const PDF = new TextEncoder().encode('%PDF-1.7\n%âãÏÓ\n1 0 obj');

describe('isPdfBytes / assertValidPdf', () => {
  it('accepts the PDF signature and rejects a renamed file', () => {
    expect(isPdfBytes(PDF)).toBe(true);
    expect(isPdfBytes(new TextEncoder().encode('MZ not a pdf'))).toBe(false);
    expect(isPdfBytes(new Uint8Array([0x25, 0x50]))).toBe(false);
    expect(() => assertValidPdf(PDF)).not.toThrow();
    expect(() => assertValidPdf(new TextEncoder().encode('<html>'))).toThrow(/not a PDF/);
  });

  it('rejects empty and oversized files with a size in the message', () => {
    expect(() => assertValidPdf(new Uint8Array(0))).toThrow(/empty/);
    const big = new Uint8Array(MAX_NEWSLETTER_PDF_BYTES + 1);
    big.set(PDF.subarray(0, 5));
    expect(() => assertValidPdf(big)).toThrow(/5 MB/);
  });
});

describe('safePdfFileName', () => {
  it('keeps a readable stem, drops odd characters and always ends in .pdf', () => {
    expect(safePdfFileName('September Newsletter (final).PDF')).toBe(
      'September-Newsletter-final.pdf',
    );
    expect(safePdfFileName('../../etc/passwd')).toBe('etcpasswd.pdf');
    expect(safePdfFileName('')).toBe('newsletter.pdf');
    expect(safePdfFileName('###.pdf')).toBe('newsletter.pdf');
  });
});

describe('base64', () => {
  it('round-trips bytes and tolerates whitespace and a data-URL prefix', () => {
    const encoded = encodePdfBase64(PDF);
    const bytes = Array.from(PDF);
    expect(Array.from(decodePdfBase64(encoded))).toEqual(bytes);
    expect(Array.from(decodePdfBase64(`data:application/pdf;base64,${encoded}`))).toEqual(bytes);
    expect(Array.from(decodePdfBase64(encoded.replace(/(.{10})/g, '$1\n')))).toEqual(bytes);
  });

  it('handles a payload larger than one encoding chunk', () => {
    const big = new Uint8Array(200_000);
    for (let i = 0; i < big.length; i++) big[i] = i % 251;
    expect(Array.from(decodePdfBase64(encodePdfBase64(big)))).toEqual(Array.from(big));
  });
});

describe('deliveryBatchSize', () => {
  it('sends 20 wide without an attachment and shrinks as the PDF grows', () => {
    expect(deliveryBatchSize(0)).toBe(DELIVERY_BATCH_SIZE);
    expect(deliveryBatchSize(100_000)).toBe(DELIVERY_BATCH_SIZE);
    // A 5 MB PDF is ~6.7 MB of base64 → 3 concurrent sends inside the budget.
    const fiveMb = Math.ceil((5 * 1024 * 1024 * 4) / 3);
    expect(deliveryBatchSize(fiveMb)).toBe(Math.floor(ATTACHMENT_BATCH_BUDGET_BYTES / fiveMb));
    expect(deliveryBatchSize(fiveMb)).toBeGreaterThanOrEqual(3);
    expect(deliveryBatchSize(fiveMb)).toBeLessThanOrEqual(5);
  });

  it('never drops below the floor, however large the attachment', () => {
    expect(deliveryBatchSize(ATTACHMENT_BATCH_BUDGET_BYTES * 10)).toBe(MIN_DELIVERY_BATCH_SIZE);
  });
});
