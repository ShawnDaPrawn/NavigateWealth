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
import { ANCHOR_PATTERNS, rectForAnchor } from '../esign-pdf-analysis';

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
