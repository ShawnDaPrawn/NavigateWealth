/**
 * The signed PDF must show each value INSIDE the box the sender placed.
 *
 * Reads the burned PDF back with pdf.js — the same renderer the studio and
 * the signing screen position fields against — and checks where the text
 * actually landed, in the page's viewed coordinates (CropBox + rotation).
 */
import { describe, expect, it, vi } from 'vitest';
import { PDFDocument, concatTransformationMatrix, degrees, pushGraphicsState } from 'pdf-lib';

vi.mock('../stderr-logger.ts', () => ({
  createModuleLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { PDFService } from '../esign-pdf.service.ts';
import { fitFieldText, formatFieldDate, sastIsoDate } from '../../../../shared/esign/fieldText.ts';
import { pageFrame } from '../esign-page-frame.ts';
import type { EsignField, EsignSigner } from '../esign-types.ts';

type Rect = { left: number; top: number; right: number; bottom: number };

async function textBoxes(pdfBytes: Uint8Array) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: pdfBytes.slice(), isEvalSupported: false }).promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  return {
    viewport: { width: viewport.width, height: viewport.height },
    items: (content.items as Array<{ str: string; transform: number[]; width: number }>)
      .filter((it) => it.str.trim())
      .map((it) => {
        // Baseline start, in viewed coordinates (top-left origin).
        const [vx, vy] = viewport.convertToViewportPoint(it.transform[4], it.transform[5]);
        return { str: it.str, x: vx, y: vy, width: it.width };
      }),
  };
}

const field = (over: Partial<EsignField>): EsignField =>
  ({
    id: 'f1',
    envelope_id: 'e',
    signer_id: 's1',
    type: 'text',
    page: 1,
    x: 20,
    y: 30,
    width: 100,
    height: 14,
    required: true,
    created_at: '',
    ...over,
  }) as EsignField;

const boxOf = (
  f: Pick<EsignField, 'x' | 'y' | 'width' | 'height'>,
  page: { width: number; height: number },
): Rect => {
  const left = (f.x / 100) * page.width;
  const top = (f.y / 100) * page.height;
  return { left, top, right: left + f.width, bottom: top + f.height };
};

describe('burn-in keeps values inside their box', () => {
  it('shrinks a long value to one line inside a small box', async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([595, 842]);
    const f = field({ value: 'Johannes Petrus van der Merwe-Steenkamp' });
    const out = await PDFService.burnIn(await pdf.save(), [f], []);

    const { items, viewport } = await textBoxes(out.pdfBuffer);
    expect(items).toHaveLength(1); // one line — it used to wrap below the box
    const box = boxOf(f, viewport);
    const t = items[0];
    expect(t.x).toBeGreaterThanOrEqual(box.left);
    expect(t.x + t.width).toBeLessThanOrEqual(box.right + 0.5);
    expect(t.y).toBeGreaterThan(box.top);
    expect(t.y).toBeLessThanOrEqual(box.bottom);
  });

  it('formats dates and does not exceed the form size cap', async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([595, 842]);
    const f = field({ type: 'date', value: '2026-11-17', width: 200, height: 60 });
    const out = await PDFService.burnIn(await pdf.save(), [f], []);
    const { items } = await textBoxes(out.pdfBuffer);
    expect(items.map((i) => i.str).join('')).toBe('17 Nov 2026');
    // A tall box no longer gets 14pt+ text.
    expect(fitFieldText('17 Nov 2026', 200, 60).size).toBe(12);
  });

  it('prints a name the standard font cannot encode instead of failing', async () => {
    // A non-WinAnsi character aborted the whole completion before.
    const pdf = await PDFDocument.create();
    pdf.addPage([595, 842]);
    const out = await PDFService.burnIn(await pdf.save(), [field({ value: 'Zoë Nkosi 李' })], []);
    const { items } = await textBoxes(out.pdfBuffer);
    expect(items.map((i) => i.str).join('')).toContain('Zoë Nkosi');
  });

  it('is not thrown off by source content that leaves its graphics state changed', async () => {
    // A source page that scales by half and never restores (q without Q).
    // pdf-lib wraps existing content in q/Q before anything is drawn, so the
    // value must still land in its box, not at half its position.
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    page.pushOperators(pushGraphicsState(), concatTransformationMatrix(0.5, 0, 0, 0.5, 0, 0));
    const f = field({ x: 50, y: 50, value: 'MARK' });
    const out = await PDFService.burnIn(await pdf.save(), [f], []);
    const { items, viewport } = await textBoxes(out.pdfBuffer);
    const box = boxOf(f, viewport);
    const t = items.find((i) => i.str === 'MARK')!;
    expect(t.x).toBeGreaterThanOrEqual(box.left);
    expect(t.y).toBeGreaterThan(box.top);
    expect(t.y).toBeLessThanOrEqual(box.bottom);
  });

  it('places values by the page as viewed on a rotated page', async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    page.setRotation(degrees(90)); // shown landscape: 842 wide, 595 tall
    const f = field({ x: 10, y: 10, width: 200, height: 20, value: 'Landscape value' });
    const out = await PDFService.burnIn(await pdf.save(), [f], []);

    const { items, viewport } = await textBoxes(out.pdfBuffer);
    expect(viewport).toEqual({ width: 842, height: 595 });
    const box = boxOf(f, viewport);
    const t = items[0];
    expect(t.x).toBeGreaterThanOrEqual(box.left - 0.5);
    expect(t.x).toBeLessThan(box.right);
    expect(t.y).toBeGreaterThan(box.top);
    expect(t.y).toBeLessThanOrEqual(box.bottom + 0.5);
  });

  it('keeps a signature image inside its box with its own shape, stamp included', async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([595, 842]);
    // 4x1 PNG — wide, like a signature.
    const png =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAABCAYAAAD5PA/NAAAAEElEQVR4nGNgYGD4z4AEAAkAAf9V1WN6AAAAAElFTkSuQmCC';
    const signer = {
      id: 's1',
      name: 'Jane Smith',
      email: 'j@x.co',
      signed_at: '2026-11-17T22:30:00Z',
      ip_address: '102.134.56.78',
    } as unknown as EsignSigner;
    const out = await PDFService.burnIn(
      await pdf.save(),
      [field({ type: 'signature', value: png, width: 160, height: 40 })],
      [signer],
    );
    const { items, viewport } = await textBoxes(out.pdfBuffer);
    const box = boxOf(field({ width: 160, height: 40 }), viewport);
    // The image embedded (no "[Signature]" fallback text).
    expect(items.some((i) => i.str.includes('[Signature]'))).toBe(false);
    // The stamp is inside the box now (it was drawn under it), in SA time.
    const stamp = items.find((i) => i.str.includes('Jane Smith'))!;
    expect(stamp).toBeTruthy();
    expect(stamp.str).toContain('18 Nov 2026, 00:30');
    expect(stamp.str).toContain('102.134.x.x');
    expect(stamp.y).toBeLessThanOrEqual(box.bottom);
    expect(stamp.y).toBeGreaterThan(box.top);
  });
});

describe('shared field text rule', () => {
  it('fits by height and by width, and clips only below the minimum', () => {
    expect(fitFieldText('A', 100, 10).size).toBeCloseTo(10 / 1.15, 5);
    const long = fitFieldText('x'.repeat(400), 50, 14);
    expect(long.size).toBe(4);
    expect(long.clipped).toBe(true);
    expect(fitFieldText('Short', 100, 14).clipped).toBe(false);
  });

  it('formats ISO dates and leaves other values alone', () => {
    expect(formatFieldDate('2026-01-05')).toBe('5 Jan 2026');
    expect(formatFieldDate('5 January 2026')).toBe('5 January 2026');
    expect(formatFieldDate('2026-13-01')).toBe('2026-13-01');
  });

  it('gives the South African date, not the UTC one, just after midnight', () => {
    // 23:30 UTC on the 16th is 01:30 SAST on the 17th.
    expect(sastIsoDate(new Date('2026-11-16T23:30:00Z'))).toBe('2026-11-17');
  });
});

describe('page frame', () => {
  it('round-trips display and user space for every rotation', () => {
    for (const angle of [0, 90, 180, 270]) {
      const f = pageFrame({ x: 10, y: 20, width: 500, height: 800 }, angle);
      const [a, b, c, d, e, g] = f.matrix;
      for (const [u, v] of [
        [0, 0],
        [f.width, 0],
        [17, 33],
        [f.width, f.height],
      ]) {
        const px = a * u + c * v + e;
        const py = b * u + d * v + g;
        const back = f.toDisplay(px, py);
        expect(back.u).toBeCloseTo(u, 6);
        expect(back.v).toBeCloseTo(v, 6);
      }
    }
  });
});
