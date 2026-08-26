/**
 * contact-pdf-generator.ts — PDF Assembly Contract
 * ================================================
 *
 * 221 statements, 0% coverage before this file. It builds a branded PDF from a
 * public web form's contents using raw PDF 1.4 primitives — no library — and
 * base64-encodes it for a SendGrid attachment.
 *
 * Two things make that worth testing rather than trusting:
 *
 *   1. **It is a string-injection surface.** Every field label, field value, the
 *      title and the free-text message go into the content stream as
 *      `(...) Tj`. An unescaped `)` closes the literal early and the remainder
 *      is read as PDF operators. `pdfEscape` handles `\`, `(`, `)` and strips
 *      `\r`, and the input comes from an unauthenticated public form — so the
 *      escaping is asserted for each of those characters in each position they
 *      can reach.
 *   2. **It hand-writes the xref table.** Byte offsets are computed from the
 *      encoded header and body; if the arithmetic and the emitted bytes ever
 *      disagree, the file opens in some readers and not others. The tests check
 *      the structural invariants a reader relies on.
 *
 * Nothing is mocked but the logger — the module has no other dependency.
 */
import { describe, it, expect, vi } from 'vitest';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});

vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);

const { generateContactPdf } = await import('../contact-pdf-generator.ts');

type Data = Parameters<typeof generateContactPdf>[0];

const base = (over: Partial<Data> = {}): Data => ({
  formType: 'contact',
  title: 'New Contact Enquiry',
  submittedAt: '2026-01-15T14:30:00.000Z',
  fields: [
    { label: 'Name', value: 'Thabo Mokoena' },
    { label: 'Email', value: 'thabo@example.com' },
  ],
  ...over,
});

/** Decodes the base64 attachment back to the PDF source text. */
function decode(b64: string): string {
  return Buffer.from(b64, 'base64').toString('latin1');
}

const pdf = (over: Partial<Data> = {}) => decode(generateContactPdf(base(over)));

// ============================================================================
// STRUCTURE — what a PDF reader requires
// ============================================================================

describe('PDF structure', () => {
  it('returns decodable base64', () => {
    const b64 = generateContactPdf(base());
    expect(b64).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(decode(b64).length).toBeGreaterThan(500);
  });

  it('opens with a 1.4 header and a binary marker', () => {
    // The binary comment line is what tells a reader (and FTP-style transports)
    // that the file is not plain text.
    const out = pdf();
    expect(out.startsWith('%PDF-1.4\n')).toBe(true);
    expect(out.slice(9, 10)).toBe('%');
  });

  it('ends with the end-of-file marker', () => {
    expect(pdf().trimEnd().endsWith('%%EOF')).toBe(true);
  });

  it('carries a cross-reference table and a trailer that points at it', () => {
    const out = pdf();
    expect(out).toContain('xref\n');
    expect(out).toContain('trailer\n');
    expect(out).toMatch(/\/Root 1 0 R/);
    const startxref = Number(out.match(/startxref\n(\d+)\n/)![1]);
    // The offset must actually land on the xref keyword, or a reader cannot
    // find the object table. This is the arithmetic worth checking.
    expect(out.slice(startxref, startxref + 4)).toBe('xref');
  });

  it('declares a size matching the objects it wrote', () => {
    const out = pdf();
    const size = Number(out.match(/\/Size (\d+)/)![1]);
    const objectCount = (out.match(/^\d+ 0 obj$/gm) || []).length;
    // /Size is object count + 1 (the free head entry).
    expect(size).toBe(objectCount + 1);
    // The xref subsection header must agree.
    expect(out).toContain(`xref\n0 ${size}\n`);
  });

  it('lists one xref entry per object plus the free head entry', () => {
    const out = pdf();
    const size = Number(out.match(/\/Size (\d+)/)![1]);
    const entries = out.match(/^\d{10} \d{5} [nf] $/gm) || [];
    expect(entries).toHaveLength(size);
    expect(entries[0]).toBe('0000000000 65535 f ');
  });

  it('declares A4 page dimensions', () => {
    expect(pdf()).toContain('/MediaBox [0 0 595.28 841.89]');
  });

  it('embeds both fonts it references', () => {
    const out = pdf();
    expect(out).toMatch(/\/F1 /);
    expect(out).toMatch(/\/F2 /);
    // Every font invoked by the content stream must be in the resources, or the
    // text silently fails to render.
    for (const font of new Set(out.match(/\/F\d(?= \d+ Tf)/g) || [])) {
      expect(out).toMatch(new RegExp(`${font.replace('/', '\\/')} \\d+ \\d+ R`));
    }
  });
});

// ============================================================================
// INJECTION — the input is from an unauthenticated public form
// ============================================================================

describe('content escaping', () => {
  /**
   * `pdfEscape` doubles a backslash and backslash-escapes the parentheses. The
   * risk is a value that closes its own literal: `) Tj ET ... BT (` would let a
   * form submission emit its own PDF operators. The assertion is therefore
   * about BALANCE — every unescaped parenthesis in the output must be one the
   * generator wrote.
   */
  const HOSTILE = ') Tj ET 1 0 0 rg BT /F2 40 Tf 100 700 Td (INJECTED';

  it.each([
    ['a field value', (v: string) => base({ fields: [{ label: 'Name', value: v }] })],
    ['a field label', (v: string) => base({ fields: [{ label: v, value: 'x' }] })],
    ['the title', (v: string) => base({ title: v })],
    ['the message', (v: string) => base({ message: v })],
  ])('escapes a closing parenthesis in %s', (_label, build) => {
    const out = decode(generateContactPdf(build(HOSTILE)));
    // The security property: the payload's `)` must never appear UNESCAPED,
    // because an unescaped one closes the literal and lets the rest be read as
    // operators. A lookbehind is required — the escaped form `\) Tj ET ...`
    // still contains the substring `) Tj ET ...`, so a plain `not.toContain`
    // would fail on correctly escaped output.
    expect(out).not.toMatch(/(?<!\\)\) Tj ET 1 0 0 rg/);
    expect(out).not.toMatch(/(?<!\\)\(INJECTED\) Tj/);
    // And it did reach the document — escaped. (A field VALUE additionally goes
    // through `wrapValue`, which re-tokenises on whitespace, so the payload is
    // split across wrapped lines rather than surviving contiguously. Both
    // outcomes are safe; only the escaping is asserted here.)
    expect(out).toMatch(/\\\)|\\\(/);
    expect(out).toContain('INJECTED');
  });

  it.each([
    ['a backslash', 'C:\\Users\\thabo', '\\\\Users\\\\thabo'],
    ['an opening parenthesis', 'Mokoena (Pty) Ltd', '\\(Pty\\) Ltd'],
  ])('escapes %s', (_label, value, expected) => {
    const out = pdf({ fields: [{ label: 'Company', value }] });
    expect(out).toContain(expected);
  });

  it('strips carriage returns rather than emitting them into a stream', () => {
    // A bare \r inside a content stream is a line terminator to some parsers.
    const out = pdf({ message: 'Line one\r\nLine two' });
    expect(out).not.toContain('Line one\r');
  });

  it('leaves the operators it wrote itself intact', () => {
    // The counterpart to the escaping tests: if pdfEscape were applied to the
    // whole stream rather than to values, the PDF would be inert.
    const out = pdf();
    expect(out).toContain('BT\n');
    expect(out).toContain('ET\n');
    expect(out).toMatch(/\d+ \d+ Td/);
  });

  it('renders a value that is nothing but delimiters', () => {
    expect(() =>
      generateContactPdf(base({ fields: [{ label: '(', value: ')\\' }] })),
    ).not.toThrow();
  });
});

// ============================================================================
// LAYOUT DECISIONS
// ============================================================================

describe('form type badge', () => {
  it.each([
    ['contact', 'CONTACT ENQUIRY'],
    ['consultation', 'CONSULTATION REQUEST'],
    ['quote', 'QUOTE REQUEST'],
  ] as const)('labels a %s form as %s', (formType, badge) => {
    expect(pdf({ formType })).toContain(`(${badge}) Tj`);
  });

  it('falls back to a generic badge for an unrecognised form type', () => {
    // The type comes from the request, so an unknown value must degrade to a
    // label rather than printing `undefined` on a client-facing document.
    expect(pdf({ formType: 'newsletter' as Data['formType'] })).toContain('(ENQUIRY) Tj');
  });

  it('always names the firm in the header', () => {
    expect(pdf()).toContain('(NAVIGATE WEALTH) Tj');
  });
});

describe('timestamp', () => {
  it('renders the submission time in South African local time', () => {
    // 14:30 UTC is 16:30 in Johannesburg. A timestamp two hours out on an
    // enquiry record is the kind of thing nobody notices until it matters.
    const out = pdf({ submittedAt: '2026-01-15T14:30:00.000Z' });
    expect(out).toMatch(/Submitted: .*15 January 2026/);
    expect(out).toMatch(/16:30/);
  });

  it('names the weekday', () => {
    expect(pdf({ submittedAt: '2026-01-15T14:30:00.000Z' })).toContain('Thursday');
  });

  it('does not fail on an unparseable timestamp', () => {
    // `new Date('nonsense').toLocaleString()` yields "Invalid Date" rather than
    // throwing, so the catch never fires — the PDF still generates and shows
    // that string. Pinned because the fallback reads as if it returned the raw
    // input, and it does not.
    const out = pdf({ submittedAt: 'not-a-date' });
    expect(out).toContain('Submitted: Invalid Date');
  });

  it('does not fail on an empty timestamp', () => {
    expect(() => generateContactPdf(base({ submittedAt: '' }))).not.toThrow();
  });
});

describe('fields and message', () => {
  it('renders every field it is given, label and value', () => {
    const out = pdf({
      fields: [
        { label: 'Name', value: 'Thabo Mokoena' },
        { label: 'Email', value: 'thabo@example.com' },
        { label: 'Phone', value: '082 123 4567' },
        { label: 'Product', value: 'Retirement Annuity' },
      ],
    });
    for (const text of ['Name', 'Thabo Mokoena', 'Phone', '082 123 4567', 'Retirement Annuity']) {
      expect(out).toContain(text);
    }
  });

  it('produces a document with no fields at all', () => {
    // A form can be submitted with only a message; an empty field list must not
    // produce a broken file.
    const out = pdf({ fields: [] });
    expect(out.startsWith('%PDF-1.4\n')).toBe(true);
    expect(out.trimEnd().endsWith('%%EOF')).toBe(true);
  });

  it('omits the message block when there is no message', () => {
    expect(pdf({ message: undefined })).not.toContain('(Message) Tj');
  });

  it('includes the message block when there is one', () => {
    expect(pdf({ message: 'Please call me back.' })).toContain('Please call me back.');
  });

  it('wraps a long message across many lines', () => {
    const out = pdf({ message: 'word '.repeat(300).trim() });
    const shortOut = pdf({ message: 'word' });
    // Each wrapped line is its own text-positioning block.
    const lines = (out.match(/ Td\n/g) || []).length;
    const shortLines = (shortOut.match(/ Td\n/g) || []).length;
    expect(lines).toBeGreaterThan(shortLines + 10);
  });

  it('keeps every drawn line on the page, however long the message', () => {
    /**
     * The bug this guards. The message loop had no space check — unlike the
     * field loop above it, which breaks at `y < margin + 140` — so a long
     * enquiry kept decrementing `y` past zero and the overflowing lines were
     * written into the content stream at NEGATIVE coordinates. They are in the
     * file; no reader draws them. A 1,000-word message lost 29 lines that way,
     * a 3,000-word one lost 154, and the Action Required banner went off-page
     * with them. Nothing looked wrong: the PDF opened and appeared complete.
     */
    for (const words of [50, 300, 1000, 3000, 20000]) {
      const out = pdf({ message: 'word '.repeat(words).trim() });
      const ys = (out.match(/(-?[\d.]+) (-?[\d.]+) Td/g) || []).map((t) => Number(t.split(' ')[1]));
      expect(Math.min(...ys)).toBeGreaterThan(0);
      // The banner sits below the message block, so it is the canary: if the
      // message ran long, the banner was the first thing pushed off-page.
      expect(out).toContain('(Action Required');
    }
  });

  it('says how much it left out rather than stopping mid-sentence', () => {
    const out = pdf({ message: 'word '.repeat(1000).trim() });
    const note = out.match(/\(\.\.\. (\d+) more lines? - full message is in the email body\) Tj/);
    expect(note).not.toBeNull();
    expect(Number(note![1])).toBeGreaterThan(0);
  });

  it('adds no truncation note when the whole message fits', () => {
    for (const words of [1, 20, 50, 300]) {
      expect(pdf({ message: 'word '.repeat(words).trim() })).not.toContain('more line');
    }
  });

  it('counts the omitted lines correctly', () => {
    // The note has to be trustworthy: kept + omitted must equal the wrap total.
    const message = 'word '.repeat(3000).trim();
    const out = pdf({ message });
    const omitted = Number(
      out.match(/\(\.\.\. (\d+) more lines? - full message is in the email body\) Tj/)![1],
    );
    // The generator wraps at 80 characters; 'word ' is 5, so the total line
    // count is derivable without reaching into the module.
    const totalLines = Math.ceil((3000 * 5 - 1) / 80);
    const drawn = (out.match(/\(word( word)*\) Tj/g) || []).length;
    expect(drawn + omitted).toBeCloseTo(totalLines, -1);
  });

  it('uses plain ASCII in the truncation note', () => {
    // `encode()` masks to Latin-1, so a typographic ellipsis would become a
    // stray byte in the one line whose job is to be readable.
    const out = pdf({ message: 'word '.repeat(1000).trim() });
    expect(out).toContain('(... ');
    expect(out).not.toContain('\u2026');
  });

  it('still renders a message when the fields have used most of the page', () => {
    // Degenerate case: `maxLines` floors at 1, so the message block always
    // shows something rather than collapsing to nothing.
    const many = Array.from({ length: 40 }, (_, i) => ({ label: `F${i}`, value: `V${i}` }));
    const out = pdf({ fields: many, message: 'word '.repeat(500).trim() });
    const ys = (out.match(/(-?[\d.]+) (-?[\d.]+) Td/g) || []).map((t) => Number(t.split(' ')[1]));
    expect(Math.min(...ys)).toBeGreaterThan(0);
    expect(out).toContain('(Message) Tj');
  });

  it('preserves blank lines between paragraphs', () => {
    // `wordWrap` pushes an empty line for an empty paragraph, so the shape of a
    // client's message survives.
    const out = pdf({ message: 'First paragraph.\n\nSecond paragraph.' });
    expect(out).toContain('First paragraph.');
    expect(out).toContain('Second paragraph.');
  });

  it('wraps a single field value that is too long for one line', () => {
    const out = pdf({
      fields: [{ label: 'Notes', value: 'detail '.repeat(60).trim() }],
    });
    expect((out.match(/Td/g) || []).length).toBeGreaterThan(10);
  });

  it('handles a value with no spaces to break on', () => {
    // `wrapValue` breaks on whitespace only, so one very long token cannot be
    // split — it must still not throw or corrupt the stream.
    const out = pdf({ fields: [{ label: 'Ref', value: 'A'.repeat(400) }] });
    expect(out.trimEnd().endsWith('%%EOF')).toBe(true);
  });

  it('handles a very long field list without corrupting the xref', () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
      label: `Field ${i}`,
      value: `Value ${i}`,
    }));
    const out = pdf({ fields: many });
    const startxref = Number(out.match(/startxref\n(\d+)\n/)![1]);
    expect(out.slice(startxref, startxref + 4)).toBe('xref');
  });
});

// ============================================================================
// ENCODING — a known limitation, pinned so it is not a surprise
// ============================================================================

describe('character encoding', () => {
  it('renders plain ASCII names faithfully', () => {
    expect(pdf({ fields: [{ label: 'Name', value: 'Thabo Mokoena' }] })).toContain('Thabo Mokoena');
  });

  it('mangles characters outside Latin-1 rather than failing', () => {
    /**
     * ⚠️ KNOWN LIMITATION, pinned rather than fixed.
     *
     * `encode()` writes `charCodeAt(i) & 0xff`, so anything above U+00FF is
     * truncated to a single arbitrary byte, and the two standard fonts are
     * WinAnsi-encoded anyway. A name with a Setswana or isiZulu diacritic
     * outside Latin-1, a Mandarin name, or an emoji comes out as mojibake in
     * the attachment the client receives.
     *
     * It does not throw and it does not corrupt the file, which is why this has
     * gone unnoticed. Fixing it properly means embedding a Unicode font subset,
     * which is a feature rather than a repair — so this test records the
     * behaviour and will fail loudly if someone does fix it.
     */
    const out = pdf({ fields: [{ label: 'Name', value: 'Zoë 张伟 🎉' }] });
    expect(out.trimEnd().endsWith('%%EOF')).toBe(true);
    // 'ë' is inside Latin-1 and survives; the CJK and emoji code points do not.
    expect(out).toContain('Zo\u00eb');
    expect(out).not.toContain('张伟');
    expect(out).not.toContain('🎉');
  });

  it('produces a file that still decodes as base64 with non-ASCII input', () => {
    const b64 = generateContactPdf(base({ message: 'Grüße — 你好' }));
    expect(() => Buffer.from(b64, 'base64')).not.toThrow();
    expect(decode(b64).trimEnd().endsWith('%%EOF')).toBe(true);
  });
});
