/**
 * Lead-gen email HTML escaping — SECURITY-AUDIT S10 regression guard
 * ==================================================================
 *
 * The three public lead-gen forms (quote request, contact form, consultation)
 * accept submissions from anonymous internet visitors and render the result
 * into notification emails read by staff. Validation caps field LENGTH but
 * permits any character, and `productDetails` is a `z.record(z.string(),
 * z.unknown())` — arbitrary keys and values. Before this guard, every one of
 * those values was interpolated into the email HTML unescaped.
 *
 * Two layers are asserted:
 *
 *   1. `escapeHtmlDeep` itself — the mechanism the quote-request builder relies
 *      on to escape a whole payload at once, because escaping 140+ sites by
 *      hand is what let this happen in the first place.
 *   2. The real `sendContactFormAdminNotification` builder, driven end to end
 *      with an injected payload, asserting the HTML that would actually be
 *      handed to SendGrid carries no live markup.
 *
 * Run: npx vitest run src/supabase/functions/server/__tests__/lead-gen-email-escaping.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { escapeHtml, escapeHtmlDeep } from '../shared-validation-utils.ts';

/** Captures what the email transport was asked to send. */
const sent: Array<{ html: string; text: string; subject: string }> = [];

vi.mock('../email-core.ts', () => ({
  sendEmail: vi.fn(async (payload: { html: string; text: string; subject: string }) => {
    sent.push(payload);
    return true;
  }),
  // Pass the body through unchanged so the assertions see exactly what the
  // builder produced rather than the surrounding chrome.
  createEmailTemplate: (body: string, opts: Record<string, unknown>) =>
    `${body}<!--subtitle:${opts.subtitle ?? ''}--><!--title:${opts.title ?? ''}-->`,
  createPlainTextEmail: (body: string) => body,
  getFooterSettings: async () => ({}),
  getEmailTemplate: async () => ({
    enabled: true,
    subject: 'New enquiry from {{ .Name }}',
    title: 'Contact Enquiry',
    subtitle: 'From {{ .Name }}',
    greeting: 'Hello {{ .Name }}',
    bodyHtml: '<p>{{ .Name }} sent an enquiry.</p>',
    buttonUrl: 'https://www.navigatewealth.co/admin',
    buttonLabel: 'Open',
    footerNote: '',
  }),
}));

import {
  sendContactFormAdminNotification,
  sendContactFormAcknowledgment,
} from '../email-senders-misc.ts';

/** A payload that executes if any interpolation site is left unescaped. */
const XSS = '<script>alert(1)</script>';
const IMG = '<img src=x onerror=alert(1)>';

describe('escapeHtmlDeep', () => {
  it('escapes strings at every depth, in objects and arrays alike', () => {
    const result = escapeHtmlDeep({
      top: XSS,
      nested: { deeper: { evil: IMG } },
      list: [XSS, { evil: IMG }],
    });

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('<script>');
    expect(serialized).not.toContain('<img');
    expect(serialized).toContain('&lt;script&gt;');
  });

  it('escapes object KEYS, which the builders render as field labels', () => {
    // The flat-entries branch renders `key.replace(...)` as the label, so a
    // hostile key is just as dangerous as a hostile value.
    const result = escapeHtmlDeep({ [XSS]: 'harmless' }) as Record<string, unknown>;

    expect(Object.keys(result)).toEqual([escapeHtml(XSS)]);
    expect(Object.keys(result)[0]).not.toContain('<script>');
  });

  it('leaves non-strings untouched so Number()/formatRand() still work', () => {
    // Regression guard: coercing numbers to escaped strings here would silently
    // turn every currency figure in the emails into NaN.
    expect(escapeHtmlDeep({ amount: 25000, flag: true, missing: null })).toEqual({
      amount: 25000,
      flag: true,
      missing: null,
    });
  });

  it('terminates on a cyclic payload rather than overflowing the stack', () => {
    const cyclic: Record<string, unknown> = { name: XSS };
    cyclic.self = cyclic;

    const result = escapeHtmlDeep(cyclic) as Record<string, unknown>;
    expect(result.name).toBe(escapeHtml(XSS));
  });
});

describe('contact form admin notification (real builder)', () => {
  beforeEach(() => {
    sent.length = 0;
  });

  it('does not emit live markup from any visitor-controlled field', async () => {
    await sendContactFormAdminNotification({
      firstName: XSS,
      lastName: IMG,
      email: 'attacker@example.com',
      phone: '"><script>alert(1)</script>',
      service: XSS,
      message: IMG,
      clientType: 'individual',
    });

    expect(sent).toHaveLength(1);
    const { html } = sent[0];

    // The exact strings that would execute in a staff mail client. Note the
    // assertion is on the RAW payloads, not on fragments like `onerror=`:
    // that substring survives inside `&lt;img src=x onerror=alert(1)&gt;`,
    // which is inert text precisely because the brackets are escaped.
    expect(html).not.toContain(XSS);
    expect(html).not.toContain(IMG);
    expect(html).not.toContain('<script');
    // And the content is still present, escaped — not silently dropped.
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('escapes the name substituted into the admin template body and subtitle', async () => {
    // `{{ .Name }}` is replaced inside template-provided HTML, which is a
    // separate injection path from the hand-built details block.
    await sendContactFormAdminNotification({
      firstName: XSS,
      lastName: '',
      email: 'a@example.com',
      phone: '0123456789',
    });

    const { html } = sent[0];
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('keeps the PLAIN-TEXT body unescaped so staff do not read &amp;', async () => {
    // Escaping is an HTML concern. Applying it to the text/plain part would
    // corrupt what staff read without protecting anything.
    await sendContactFormAdminNotification({
      firstName: 'Ben',
      lastName: "O'Brien & Co",
      email: 'ben@example.com',
      phone: '0123456789',
    });

    expect(sent[0].text).toContain("O'Brien & Co");
    expect(sent[0].text).not.toContain('&amp;');
  });
});

describe('contact form acknowledgment (real builder)', () => {
  beforeEach(() => {
    sent.length = 0;
  });

  it('escapes the submitted name before echoing it back', async () => {
    await sendContactFormAcknowledgment({
      firstName: XSS,
      lastName: '',
      email: 'victim@example.com',
      phone: '0123456789',
    });

    expect(sent).toHaveLength(1);
    expect(sent[0].html).not.toContain('<script>');
    expect(sent[0].html).toContain('&lt;script&gt;');
  });
});
