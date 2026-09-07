/**
 * Smart-anchor pattern + geometry tests for esign-pdf-analysis.
 *
 * Pins:
 *   - identity labels ("First name:", "Email:") match and carry the right
 *     CRM prefill token, so accepting the candidate yields a field the
 *     prefill resolver fills from the client record;
 *   - specific patterns outrank the generic name pattern (ordering);
 *   - caption-only anchors ("Sign here") get the type's minimum width
 *     instead of the historical zero-width field.
 *
 * The full detectors need pdf.js/pdf-lib over real PDF bytes — these tests
 * cover the pure pattern/geometry layer they are built on.
 */

import { describe, it, expect } from 'vitest';
import { PDFDocument, PDFName, StandardFonts } from 'pdf-lib';
import {
  ANCHOR_PATTERNS,
  detectAcroformFields,
  detectSmartAnchors,
  findLineAnchors,
  rectForAnchor,
} from '../esign-pdf-analysis';

/** First pattern that matches the line — mirrors the scan loop's ordering. */
function firstMatch(lineText: string) {
  for (const entry of ANCHOR_PATTERNS) {
    const match = lineText.match(entry.pattern);
    if (match) return { entry, match };
  }
  return null;
}

describe('ANCHOR_PATTERNS — identity labels bind prefill tokens', () => {
  const cases: Array<[string, string, string | undefined]> = [
    // [line text, expected label, expected prefill token]
    ['First name: ______', 'First name', 'key:profile_first_name'],
    ['First names:', 'First name', 'key:profile_first_name'],
    ['Surname: ______', 'Last name', 'key:profile_last_name'],
    ['Last name:', 'Last name', 'key:profile_last_name'],
    ['Full name: ________', 'Name', 'client.name'],
    ['Email address: ______', 'Email', 'client.email'],
    ['E-mail:', 'Email', 'client.email'],
    ['Cell number: ______', 'Phone', 'client.phone'],
    ['Contact number:', 'Phone', 'client.phone'],
    ['ID number: _____________', 'ID number', 'client.id_number'],
    ['Identity no: ______', 'ID number', 'client.id_number'],
    ['Income tax number: ______', 'Tax number', 'client.tax_number'],
    ['Date of birth: ______', 'Date of birth', 'client.date_of_birth'],
    ['D.O.B:', 'Date of birth', 'client.date_of_birth'],
    ['Residential address: ______', 'Address', 'client.address'],
    ['Marital status:', 'Marital status', 'client.marital_status'],
  ];

  it.each(cases)('%s → %s (%s)', (line, label, token) => {
    const hit = firstMatch(line);
    expect(hit, `no pattern matched: ${line}`).not.toBeNull();
    expect(hit!.entry.label).toBe(label);
    expect(hit!.entry.prefillToken).toBe(token);
    expect(hit!.entry.type).toBe('text');
  });

  it('signature and date anchors still match and stay unbound', () => {
    const sig = firstMatch('Signature: ___________');
    expect(sig!.entry.type).toBe('signature');
    expect(sig!.entry.prefillToken).toBeUndefined();

    const date = firstMatch('Date: _______');
    expect(date!.entry.type).toBe('date');
    expect(date!.entry.prefillToken).toBeUndefined();
  });

  it('specific identity patterns sit above the generic name pattern', () => {
    // "First name:" must win over the generic "Name" pattern — the scan
    // loop takes matches in array order and suppresses overlapping spans.
    const idxFirst = ANCHOR_PATTERNS.findIndex((p) => p.label === 'First name');
    const idxLast = ANCHOR_PATTERNS.findIndex((p) => p.label === 'Last name');
    const idxGeneric = ANCHOR_PATTERNS.findIndex((p) => p.label === 'Name');
    expect(idxFirst).toBeGreaterThanOrEqual(0);
    expect(idxFirst).toBeLessThan(idxGeneric);
    expect(idxLast).toBeLessThan(idxGeneric);
  });

  it('a bare word in prose does not match', () => {
    expect(firstMatch('the name of this agreement is unimportant')).toBeNull();
    expect(firstMatch('please address the committee')).toBeNull();
  });
});

describe('rectForAnchor — geometry', () => {
  const pageWidthPt = 595;

  it('places the field over the underscore tail, not the caption', () => {
    const text = 'Signature: ____________';
    const line = { text, rect: [50, 700, 350, 712] as [number, number, number, number] };
    const match = text.match(/\bsign(ature)?\s*(of\s+\w+)?[:\-_]?\s*_{3,}/i)!;
    const [x1, , x2] = rectForAnchor(line, match, 'signature', pageWidthPt);
    // Field starts after the caption ends and reaches the end of the line.
    expect(x1).toBeGreaterThan(50);
    expect(x2).toBeGreaterThan(x1);
    expect(x2).toBeLessThanOrEqual(pageWidthPt);
  });

  it('gives caption-only anchors the minimum width instead of zero', () => {
    const text = 'Sign here';
    const line = { text, rect: [50, 700, 110, 712] as [number, number, number, number] };
    const match = text.match(/\bsign\s+here\b/i)!;
    const [x1, , x2] = rectForAnchor(line, match, 'signature', pageWidthPt);
    // Historically this produced a zero-width field (caption == match).
    expect(x2 - x1).toBeGreaterThanOrEqual(150);
  });

  it('clamps the minimum-width extension to the page edge', () => {
    const text = 'Sign here';
    const line = { text, rect: [520, 700, 580, 712] as [number, number, number, number] };
    const match = text.match(/\bsign\s+here\b/i)!;
    const [x1, , x2] = rectForAnchor(line, match, 'signature', pageWidthPt);
    expect(x2).toBeLessThanOrEqual(pageWidthPt);
    // The clamped width is final — consumers take it verbatim, so the
    // candidate can never extend past the right page edge.
    expect(x1 + (x2 - x1)).toBeLessThanOrEqual(pageWidthPt);
  });

  it('treats a hyphenated caption ("E-mail") as one caption, not "E"', () => {
    const emailPattern = ANCHOR_PATTERNS.find((p) => p.label === 'Email')!.pattern;
    const text = 'E-mail: __________';
    const line = { text, rect: [50, 700, 350, 712] as [number, number, number, number] };
    const match = text.match(emailPattern)!;
    const [x1] = rectForAnchor(line, match, 'text', pageWidthPt);
    // The field must start after the full "E-mail" caption. Splitting the
    // match on the first '-' used to cut the caption to "E" and start the
    // field over "-mail:". 6/18 chars of the match are caption, so the
    // field starts at least that fraction into the matched span.
    const lineWidth = 300;
    const captionEndX = 50 + lineWidth * ('E-mail'.length / text.length);
    expect(x1).toBeGreaterThanOrEqual(captionEndX - 1);
  });

  it('grows short lines downward to the minimum height, clamped at the page bottom', () => {
    const text = 'Signature: ____________';
    const match = text.match(/\bsign(ature)?\s*(of\s+\w+)?[:\-_]?\s*_{3,}/i)!;

    const midPage = { text, rect: [50, 700, 350, 710] as [number, number, number, number] };
    const [, b1, , t1] = rectForAnchor(midPage, match, 'signature', pageWidthPt);
    expect(t1 - b1).toBeGreaterThanOrEqual(40); // signature min height

    const nearBottom = { text, rect: [50, 5, 350, 15] as [number, number, number, number] };
    const [, b2] = rectForAnchor(nearBottom, match, 'signature', pageWidthPt);
    expect(b2).toBeGreaterThanOrEqual(0); // never extends past the page bottom
  });
});

describe('detectAcroformFields — widgets keep their own page', () => {
  /**
   * Three-page form with a text field + checkbox on every page. Pins the
   * regression where the widget→page lookup never resolved and every
   * suggestion was stacked on page 1.
   */
  async function buildThreePageForm(opts: { stripPageRef?: boolean } = {}) {
    const pdf = await PDFDocument.create();
    const form = pdf.getForm();
    for (let i = 0; i < 3; i++) {
      const page = pdf.addPage([595, 842]);
      form
        .createTextField(`name_p${i + 1}`)
        .addToPage(page, { x: 50, y: 700 - i * 100, width: 200, height: 24 });
      form
        .createCheckBox(`agree_p${i + 1}`)
        .addToPage(page, { x: 50, y: 600, width: 18, height: 18 });
    }
    if (opts.stripPageRef) {
      // Some authoring tools omit the widget's /P entry; the page must then
      // be recovered from the page's /Annots array instead.
      for (const field of form.getFields()) {
        for (const widget of field.acroField.getWidgets()) {
          widget.dict.delete(PDFName.of('P'));
        }
      }
    }
    return pdf.save();
  }

  function pagesByName(candidates: Awaited<ReturnType<typeof detectAcroformFields>>['candidates']) {
    return Object.fromEntries(candidates.map((c) => [c.label, c.page]));
  }

  const expected = {
    name_p1: 1,
    agree_p1: 1,
    name_p2: 2,
    agree_p2: 2,
    name_p3: 3,
    agree_p3: 3,
  };

  it('places each widget on the page it was drawn on', async () => {
    const res = await detectAcroformFields(await buildThreePageForm());
    expect(res.ok).toBe(true);
    expect(res.candidates).toHaveLength(6);
    expect(pagesByName(res.candidates)).toEqual(expected);
  });

  it('falls back to the page /Annots scan when widgets carry no /P entry', async () => {
    const res = await detectAcroformFields(await buildThreePageForm({ stripPageRef: true }));
    expect(res.ok).toBe(true);
    expect(res.candidates).toHaveLength(6);
    expect(pagesByName(res.candidates)).toEqual(expected);
  });

  it("converts widget rects using the dimensions of the widget's own page", async () => {
    const pdf = await PDFDocument.create();
    const form = pdf.getForm();
    pdf.addPage([595, 842]);
    const wide = pdf.addPage([1000, 500]);
    form.createTextField('wide').addToPage(wide, { x: 500, y: 250, width: 100, height: 20 });
    const res = await detectAcroformFields(await pdf.save());
    const cand = res.candidates.find((c) => c.label === 'wide');
    expect(cand?.page).toBe(2);
    // x = 500 / 1000 → 50%; y from top ≈ (500 - 270) / 500 → 46%. Against the
    // 595×842 first page these would read ~84% and ~68% instead.
    expect(cand?.x).toBeCloseTo(50, 0);
    expect(cand?.y).toBeCloseTo(46, 0);
  });
});

describe('findLineAnchors — every blank on the line becomes a field', () => {
  const labels = (line: string) => findLineAnchors(line).map((a) => `${a.type}:${a.label}`);

  it('proposes a text field for a caption the pattern list does not know', () => {
    // The regression: only ten identity captions had patterns, so an ordinary
    // form line produced nothing at all.
    expect(labels('Occupation: _______________')).toEqual(['text:Occupation']);
    expect(labels('Policy number: ____________')).toEqual(['text:Policy number']);
    expect(labels('Annual income before tax: ______')).toEqual(['text:Annual income before tax']);
  });

  it('finds every blank on a line, not just the first', () => {
    expect(labels('Employer: ______  Position: ______  Years: ______')).toEqual([
      'text:Employer',
      'text:Position',
      'text:Years',
    ]);
  });

  it('labels each blank from its own caption, not the one before it', () => {
    const anchors = findLineAnchors('Town: ________ Postal code: ________');
    expect(anchors.map((a) => a.label)).toEqual(['Town', 'Postal code']);
  });

  it('keeps the specific patterns winning, with their prefill tokens', () => {
    const [email] = findLineAnchors('Email address: ____________');
    expect(email.type).toBe('text');
    expect(email.prefillToken).toBe('client.email');

    expect(labels('Signature: ________   Date: ________')).toEqual([
      'signature:Signature',
      'date:Date',
    ]);
  });

  it('does not double-propose over a blank a caption-only pattern left behind', () => {
    // "Sign here" matches without consuming the underscores; the generic pass
    // must not add a second field on top of the same blank.
    expect(labels('Sign here ______________')).toEqual(['signature:Sign here']);
  });

  it('takes an unlabelled blank as a plain text field', () => {
    expect(labels('__________')).toEqual(['text:Text field']);
  });

  it('ignores a long unlabelled run — that is a divider, not a blank', () => {
    expect(findLineAnchors('_'.repeat(80))).toEqual([]);
    // A caption in front of it means it really is a field, however long.
    expect(labels(`Notes: ${'_'.repeat(80)}`)).toEqual(['text:Notes']);
  });

  it('treats a punctuation-separated mask as one field', () => {
    // The date pattern claims only the first run; the remaining runs are the
    // rest of the same entry, not two more fields labelled "/".
    expect(labels('Date: ____ / ____ / ____')).toEqual(['date:Date']);
    expect(labels('ID number: ______ ______ ______')).toEqual(['text:ID number']);
    // A word between two blanks still starts a new field.
    expect(labels('From: ______ To: ______')).toEqual(['text:From', 'text:To']);
  });

  it("marks where a generic blank's caption starts, not just the blank", () => {
    // `start` is the underscore run; the caption in front of it is what the
    // previous field on the line has to stop short of.
    const [, position] = findLineAnchors('Employer: ______ Position: ______');
    expect(position.start).toBe(27);
    expect(position.captionStart).toBe(17);
  });

  it('reads a caption whose words the PDF split apart', () => {
    // groupItemsIntoLines restores the space; without it this read
    // "Firstname:" and matched no pattern.
    const [first] = findLineAnchors('First name: ______');
    expect(first.label).toBe('First name');
    expect(first.prefillToken).toBe('key:profile_first_name');
  });
});

describe('detectSmartAnchors — a realistic form', () => {
  const LINES = [
    'Full name: ______________________',
    'Occupation: _____________________',
    'Policy number: __________________',
    'Beneficiary: ____________________',
    'Signature: ______________   Date: __________',
  ];

  async function buildForm() {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const page = pdf.addPage([595, 842]);
    LINES.forEach((text, i) => page.drawText(text, { x: 50, y: 760 - i * 30, size: 11, font }));
    return pdf.save();
  }

  it('proposes a field for every blank, on the right page', async () => {
    const res = await detectSmartAnchors(await buildForm());
    expect(res.ok).toBe(true);
    expect(res.candidates.map((c) => c.label)).toEqual([
      'Name',
      'Occupation',
      'Policy number',
      'Beneficiary',
      'Signature',
      'Date',
    ]);
    expect(res.candidates.map((c) => c.type)).toEqual([
      'text',
      'text',
      'text',
      'text',
      'signature',
      'date',
    ]);
    expect(res.candidates.every((c) => c.page === 1)).toBe(true);
  });

  it('stops a field before the next caption, not just the next blank', async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const page = pdf.addPage([595, 842]);
    page.drawText('Employer: ______ Position: ______', { x: 50, y: 700, size: 11, font });
    const res = await detectSmartAnchors(await pdf.save());

    const captionX = 50 + font.widthOfTextAtSize('Employer: ______ ', 11);
    const first = res.candidates[0];
    const rightPt = (first.x / 100) * 595 + first.width;
    expect(first.label).toBe('Employer');
    expect(rightPt).toBeLessThanOrEqual(captionX);
  });

  it('does not let two fields on one line overlap', async () => {
    const res = await detectSmartAnchors(await buildForm());
    const sig = res.candidates.find((c) => c.type === 'signature')!;
    const date = res.candidates.find((c) => c.type === 'date')!;
    const sigRightPct = sig.x + (sig.width / 595) * 100;
    expect(sigRightPct).toBeLessThanOrEqual(date.x);
  });
});
