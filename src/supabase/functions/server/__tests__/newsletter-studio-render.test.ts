/**
 * newsletter-studio-render.ts — rendering contracts
 * =================================================
 *
 * The properties a PDF newsletter email cannot ship without:
 *
 *   1. **Title and description are data, not markup.** Both come from an
 *      admin form or a routine hand-over; they must land HTML-escaped.
 *   2. **The only tracked link is the Read button**, on the apex-origin
 *      click page, carrying campaign, token and the fixed `pdf` link id.
 *   3. **The deliverability envelope** points one-click unsubscribe at the
 *      server POST endpoint, never the SPA page.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const email = vi.hoisted(() => ({
  createEmailTemplate: vi.fn(
    (
      content: string,
      options?: { unsubscribeLink?: string; buttonUrl?: string; greeting?: string },
    ) =>
      `<wrapped unsub="${options?.unsubscribeLink ?? ''}" button="${options?.buttonUrl ?? ''}">` +
      `${options?.greeting ?? ''}${content}</wrapped>`,
  ),
  createPlainTextEmail: vi.fn(
    (content: string, unsubscribeLink?: string) => `${content}\n[unsub:${unsubscribeLink ?? ''}]`,
  ),
  getFooterSettings: vi.fn(async () => ({})),
  sendEmail: vi.fn(),
}));

vi.mock('../email-service.ts', () => email);
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);

import {
  buildCampaignEmailHeaders,
  buildClickThroughUrl,
  buildOneClickUnsubscribeUrl,
  buildReadUrl,
  buildUnsubscribeUrl,
  escapeHtml,
  renderNewsletterEmail,
} from '../newsletter-studio-render.ts';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('renderNewsletterEmail', () => {
  const campaign = {
    title: 'August update <2026>',
    description: 'What mattered & why.\n\nSecond paragraph\nwith a line break.',
  };
  const recipient = { email: 'sam@example.co.za', firstName: 'Sam' };
  const readUrl = buildReadUrl('camp-9', 'tok9');
  const footerSettings = {} as never;

  it('greets by first name, escapes the title and description, and wires the Read button', () => {
    const { html, text } = renderNewsletterEmail({ campaign, recipient, readUrl, footerSettings });
    expect(html).toContain('Hi Sam,');
    expect(html).toContain('August update &lt;2026&gt;');
    expect(html).toContain('What mattered &amp; why.');
    expect(html).toContain('with a line break');
    expect(html).toContain('<br>');
    expect(html).not.toContain('<2026>');
    expect(html).toContain(`button="${readUrl}"`);
    expect(html).toContain(`unsub="${buildUnsubscribeUrl('sam@example.co.za')}"`);
    expect(html).toContain('also attached');

    expect(text).toContain('Hi Sam,');
    expect(text).toContain('August update <2026>');
    expect(text).toContain(`Read the newsletter: ${readUrl}`);
    expect(text).toContain('[unsub:');
  });

  it('falls back to a neutral greeting when there is no first name', () => {
    const { html, text } = renderNewsletterEmail({
      campaign,
      recipient: { email: 'x@y.co', firstName: '' },
      readUrl,
      footerSettings,
    });
    expect(html).toContain('Hello,');
    expect(text).toContain('Hello,');
  });

  it('escapes a first name that carries markup', () => {
    const { html } = renderNewsletterEmail({
      campaign,
      recipient: { email: 'x@y.co', firstName: '<b>Bold</b>' },
      readUrl,
      footerSettings,
    });
    expect(html).toContain('&lt;b&gt;Bold&lt;/b&gt;');
    expect(html).not.toContain('<b>Bold</b>');
  });

  it('never loads footer settings itself — the caller loads them once per tick', () => {
    renderNewsletterEmail({ campaign, recipient, readUrl, footerSettings });
    expect(email.getFooterSettings).not.toHaveBeenCalled();
  });
});

describe('escapeHtml', () => {
  it('escapes the four characters that matter', () => {
    expect(escapeHtml(`<a href="x">&</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
  });
});

describe('buildReadUrl / buildClickThroughUrl', () => {
  it('targets the apex-origin click page with campaign, token and the pdf link id', () => {
    const url = new URL(buildReadUrl('c1', 't1'));
    expect(url.origin).toBe('https://navigatewealth.co');
    expect(url.pathname).toBe('/newsletter/click');
    expect(url.searchParams.get('c')).toBe('c1');
    expect(url.searchParams.get('t')).toBe('t1');
    expect(url.searchParams.get('l')).toBe('pdf');
    expect(buildReadUrl('c1', 't1')).toBe(buildClickThroughUrl('c1', 't1', 'pdf'));
  });
});

describe('buildCampaignEmailHeaders', () => {
  it('points one-click unsubscribe at the server POST endpoint, never the SPA page', () => {
    const headers = buildCampaignEmailHeaders('camp-1', 'tok-1');
    expect(headers['List-Unsubscribe']).toContain('mailto:unsubscribe@navigatewealth.co');
    // RFC 8058: the https URL receives a provider POST with no JS running —
    // it must be the edge route that actually flips the consent record.
    expect(headers['List-Unsubscribe']).toContain(
      '/newsletter-studio/unsubscribe-oneclick?c=camp-1&t=tok-1',
    );
    expect(headers['List-Unsubscribe']).not.toContain('/newsletter/unsubscribe?email=');
    expect(headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    expect(headers['List-Id']).toContain('newsletter.navigatewealth.co');
    expect(headers['Message-ID']).toMatch(/^<[0-9a-f-]+@navigatewealth\.co>$/);
    expect(headers['X-Entity-Ref-ID']).toBe('nlstudio-camp-1-tok-1');
  });
});

describe('buildOneClickUnsubscribeUrl', () => {
  it('targets the edge function with campaign and token params', () => {
    const url = new URL(buildOneClickUnsubscribeUrl('c1', 't1'));
    expect(url.pathname).toBe(
      '/functions/v1/make-server-91ed8379/newsletter-studio/unsubscribe-oneclick',
    );
    expect(url.searchParams.get('c')).toBe('c1');
    expect(url.searchParams.get('t')).toBe('t1');
  });
});
