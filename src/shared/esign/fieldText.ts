/**
 * How a value is laid out inside an e-sign field — shared by the signed-PDF
 * burn-in (`esign-pdf.service.ts`, Deno) and the signing screen
 * (`FieldHighlight.tsx`, browser), so what the signer sees is what prints.
 *
 * Before this, the PDF used a fixed `clamp(h * 0.6, 8, 14)` font size and
 * wrapped long values onto lines below the box, while the signing screen used
 * a fixed 12px with an ellipsis. Neither fitted the box, and they disagreed.
 *
 * The rule: one line, Helvetica, the largest size up to MAX_SIZE that fits
 * both the box's height and its width, never below MIN_SIZE; anything that
 * still does not fit is clipped at the box edge — never drawn outside it.
 *
 * No imports: this file is loaded by both Vite and Deno.
 */

export const FIELD_TEXT = {
  /** Largest font size used for a value, in points. Form text sits ~10–12pt. */
  maxSize: 12,
  /** Smallest font size before the value is clipped instead of shrunk further. */
  minSize: 4,
  /** Horizontal inset from each side of the box, in points. */
  padX: 2,
  /** Helvetica cap height as a fraction of the font size (AFM: 718/1000). */
  capRatio: 0.718,
  /** Line height as a fraction of the font size. */
  lineRatio: 1.15,
} as const;

/**
 * Helvetica advance widths (1/1000 em) for printable ASCII, from the
 * standard Adobe AFM — the same metrics pdf-lib uses for StandardFonts.
 * Characters outside the table count as 556 (the digit width).
 */
// prettier-ignore
const HELVETICA_WIDTHS: Record<string, number> = {
  ' ': 278, '!': 278, '"': 355, '#': 556, $: 556, '%': 889, '&': 667, "'": 191,
  '(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278,
  '0': 556, '1': 556, '2': 556, '3': 556, '4': 556, '5': 556, '6': 556, '7': 556,
  '8': 556, '9': 556, ':': 278, ';': 278, '<': 584, '=': 584, '>': 584, '?': 556,
  '@': 1015, A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722,
  I: 278, J: 500, K: 667, L: 556, M: 833, N: 722, O: 778, P: 667, Q: 778,
  R: 722, S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
  '[': 278, '\\': 278, ']': 278, '^': 469, _: 556, '`': 333, a: 556, b: 556,
  c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222, k: 500,
  l: 222, m: 833, n: 556, o: 556, p: 556, q: 556, r: 333, s: 500, t: 278,
  u: 556, v: 500, w: 722, x: 500, y: 500, z: 500, '{': 334, '|': 260, '}': 334,
  '~': 584,
};

/** Width of `text` set in Helvetica at `size` points. */
export function helveticaWidth(text: string, size: number): number {
  let units = 0;
  for (const ch of text) units += HELVETICA_WIDTHS[ch] ?? 556;
  return (units / 1000) * size;
}

export interface FittedText {
  /** Font size in points. */
  size: number;
  /** Left edge of the text, in points from the box's left edge. */
  offsetX: number;
  /** Baseline, in points from the box's BOTTOM edge (PDF convention). */
  baselineFromBottom: number;
  /** True when the value is wider than the box even at MIN_SIZE (it is clipped). */
  clipped: boolean;
}

/**
 * Size and place a single-line value inside a `boxW` × `boxH` point box.
 * `maxSize` lets a caller allow larger text (a typed signature).
 */
export function fitFieldText(
  text: string,
  boxW: number,
  boxH: number,
  opts: { maxSize?: number; measure?: (text: string, size: number) => number } = {},
): FittedText {
  const { minSize, padX, capRatio, lineRatio } = FIELD_TEXT;
  const maxSize = opts.maxSize ?? FIELD_TEXT.maxSize;
  const measure = opts.measure ?? helveticaWidth;
  const usableW = Math.max(1, boxW - 2 * padX);

  const byHeight = boxH / lineRatio;
  const widthAt1 = measure(text, 1);
  const byWidth = widthAt1 > 0 ? usableW / widthAt1 : maxSize;

  // A box shorter than MIN_SIZE's line still gets text that fits its height.
  const floor = Math.min(minSize, byHeight);
  const size = Math.max(floor, Math.min(maxSize, byHeight, byWidth));
  const clipped = measure(text, size) > usableW + 0.01;

  return {
    size,
    offsetX: padX,
    baselineFromBottom: Math.max(0, (boxH - size * capRatio) / 2),
    clipped,
  };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * A stored date value as it should read on the document: "17 Nov 2026".
 * ISO dates (what a date picker stores) are reformatted; anything else is
 * returned unchanged, so a value the sender or signer typed by hand survives.
 */
export function formatFieldDate(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return value;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return value;
  return `${Number(m[3])} ${MONTHS[month - 1]} ${m[1]}`;
}

/**
 * Today's date in South Africa (UTC+2, no daylight saving) as YYYY-MM-DD.
 * `toISOString().slice(0, 10)` gives the UTC date, which before 02:00 SAST
 * is yesterday.
 */
export function sastIsoDate(now: Date = new Date()): string {
  return new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
