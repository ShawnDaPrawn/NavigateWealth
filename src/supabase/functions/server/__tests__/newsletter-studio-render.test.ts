/**
 * newsletter-studio-render.ts — rendering contracts
 * =================================================
 *
 * The two properties campaigns cannot ship without:
 *
 *   1. **The click-through can never become an open redirect.** Only URLs the
 *      author wrote (captured at queue time into `links`) are ever rewritten,
 *      and the redirect endpoint resolves link ids back to those stored URLs —
 *      so the URL space reachable through /track/click is exactly the authored
 *      set. Unsubscribe links are never routed through the tracker, or
 *      one-click unsubscribe would break.
 *
 *   2. **Merge fields are data, not markup.** Recipient names come from public
 *      signup forms; `{{name}}` must land HTML-escaped.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const email = vi.hoisted(() => ({
  createEmailTemplate: vi.fn(
    (content: string, options?: { unsubscribeLink?: string }) =>
      `<wrapped unsub="${options?.unsubscribeLink ?? ''}">${content}</wrapped>`,
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
  applyMergeFields,
  buildCampaignEmailHeaders,
  buildClickThroughUrl,
  buildOneClickUnsubscribeUrl,
  buildUnsubscribeUrl,
  extractCampaignLinks,
  renderCampaignEmail,
  rewriteLinksForRecipient,
  personalizeText,
} from '../newsletter-studio-render.ts';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('extractCampaignLinks', () => {
  it('captures unique http(s) hrefs in order with stable ids', () => {
    const links = extractCampaignLinks(
      `<a href="https://a.example/one">1</a>
       <a href='https://b.example/two'>2</a>
       <a href="https://a.example/one">again</a>`,
    );
    expect(links).toEqual([
      { id: 'l1', url: 'https://a.example/one' },
      { id: 'l2', url: 'https://b.example/two' },
    ]);
  });

  it('ignores mailto/tel/anchor hrefs', () => {
    const links = extractCampaignLinks(
      `<a href="mailto:x@y.z">m</a><a href="#top">t</a><a href="tel:+2712">p</a>`,
    );
    expect(links).toEqual([]);
  });

  it('never captures unsubscribe links — one-click unsubscribe must not run through the tracker', () => {
    const links = extractCampaignLinks(
      `<a href="https://www.navigatewealth.co/newsletter/unsubscribe?email=a%40b.c">u</a>
       <a href="https://real.example/page">r</a>`,
    );
    expect(links).toEqual([{ id: 'l1', url: 'https://real.example/page' }]);
  });
});

describe('rewriteLinksForRecipient', () => {
  const links = [{ id: 'l1', url: 'https://a.example/one' }];

  it('rewrites only stored links, leaving everything else untouched', () => {
    const out = rewriteLinksForRecipient(
      `<a href="https://a.example/one">go</a><a href="https://other.example/x">stay</a>`,
      links,
      'camp-1',
      'tok-1',
    );
    expect(out).toContain('https://other.example/x');
    expect(out).not.toContain('href="https://a.example/one"');
    expect(out).toContain(buildClickThroughUrl('camp-1', 'tok-1', 'l1'));
  });

  it('is a no-op with no stored links', () => {
    const html = `<a href="https://a.example/one">go</a>`;
    expect(rewriteLinksForRecipient(html, [], 'c', 't')).toBe(html);
  });
});

describe('applyMergeFields', () => {
  it('substitutes fields and HTML-escapes recipient data', () => {
    const out = applyMergeFields('Hi {{firstName}} — {{name}} <{{email}}>', {
      firstName: 'Thandi',
      name: '<script>alert(1)</script>',
      email: 'thandi@example.co.za',
      unsubscribeUrl: 'https://u.example',
    });
    expect(out).toContain('Hi Thandi');
    expect(out).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(out).not.toContain('<script>');
  });

  it('passes the server-built unsubscribe URL through unescaped', () => {
    const out = applyMergeFields('<a href="{{unsubscribeUrl}}">bye</a>', {
      firstName: '',
      name: '',
      email: 'a@b.co',
      unsubscribeUrl: 'https://www.navigatewealth.co/newsletter/unsubscribe?email=a%40b.co',
    });
    expect(out).toContain('unsubscribe?email=a%40b.co');
  });
});

describe('personalizeText', () => {
  it('fills subject-line merge fields without HTML escaping and drops the unsubscribe token', () => {
    const recipient = { email: 'ann@x.co', name: 'Ann & Co', firstName: 'Ann' };
    expect(personalizeText('Hi {{firstName}} — {{ name }} <{{email}}>', recipient)).toBe(
      'Hi Ann — Ann & Co <ann@x.co>',
    );
    expect(personalizeText('x {{unsubscribeUrl}} y', recipient)).toBe('x  y');
    expect(personalizeText('', recipient)).toBe('');
  });
});

describe('renderCampaignEmail', () => {
  const campaign = {
    id: 'camp-9',
    subject: 'August update',
    preheader: 'The one-minute version',
    bodyHtml: '<p>Hello {{firstName}}</p><a href="https://a.example/one">read</a>',
    links: [{ id: 'l1', url: 'https://a.example/one' }],
    trackClicks: true,
  };
  const recipient = {
    email: 'sam@example.co.za',
    name: 'Sam Naidoo',
    firstName: 'Sam',
    token: 'tok9',
  };

  it('personalizes, rewrites links, injects the preheader and wraps with the branded template', async () => {
    const { html, text } = await renderCampaignEmail({ campaign, recipient });
    expect(html).toContain('Hello Sam');
    expect(html).toContain(buildClickThroughUrl('camp-9', 'tok9', 'l1'));
    expect(html).toContain('The one-minute version');
    expect(html).toContain(`unsub="${buildUnsubscribeUrl('sam@example.co.za')}"`);
    expect(text).toContain('Hello Sam');
    // Text-mode readers keep the real destination, never the tracker URL.
    expect(text).not.toContain('/newsletter/click');
    expect(email.getFooterSettings).toHaveBeenCalled();
  });

  it('keeps original destinations when click tracking is disabled (test sends)', async () => {
    const { html } = await renderCampaignEmail({ campaign, recipient, disableClickTracking: true });
    expect(html).toContain('https://a.example/one');
    expect(html).not.toContain('/newsletter/click');
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

describe('buildClickThroughUrl', () => {
  it('targets the apex-origin click page with campaign, token and link ids', () => {
    const url = new URL(buildClickThroughUrl('c1', 't1', 'l1'));
    expect(url.origin).toBe('https://navigatewealth.co');
    expect(url.pathname).toBe('/newsletter/click');
    expect(url.searchParams.get('c')).toBe('c1');
    expect(url.searchParams.get('t')).toBe('t1');
    expect(url.searchParams.get('l')).toBe('l1');
  });
});
