/**
 * The email layout's contract — what every platform email relies on.
 *
 *   1. Every slot is filled and nothing of the template syntax leaks.
 *   2. Body HTML is inserted as given and never re-read as template syntax,
 *      so an author's `{{ .Name }}` survives to the merge step.
 *   3. Both themes are declared, and the preview switch can force either.
 *   4. The button works in Outlook (VML) and everywhere else, and its link is
 *      printed as text only when it is a real http(s) URL and wanted.
 *   5. The footer prints the admin's settings over the defaults, escaped, and
 *      the regulatory line regardless.
 */
import { describe, expect, it } from 'vitest';
import {
  EMAIL_LAYOUT_FOOTER_DEFAULTS,
  forceEmailColorScheme,
  formatEmailDate,
  renderEmailLayout,
} from '../emailLayout';

/** 22:30 UTC on the 22nd is already the 23rd in Pretoria. */
const now = new Date('2026-11-22T22:30:00Z');

const base = {
  now,
  title: 'Welcome to Navigate Wealth',
  bodyHtml: '<p>Your portal is ready.</p>',
};

describe('renderEmailLayout', () => {
  it('fills every slot and leaves no template syntax behind', () => {
    const html = renderEmailLayout({
      ...base,
      subtitle: 'Your client portal is ready for you.',
      greeting: 'Dear Thandi,',
      buttonUrl: 'https://www.navigatewealth.co/accept?token=abc',
      buttonLabel: 'Accept invitation',
      footerNote: 'This invitation expires in 7 days.',
      unsubscribeUrl: 'https://www.navigatewealth.co/newsletter/unsubscribe?email=a%40b.co',
    });

    expect(html).not.toMatch(/\{\{/);
    expect(html).toContain('>Welcome to Navigate Wealth</h1>');
    expect(html).toContain('Your client portal is ready for you.');
    expect(html).toContain('>Dear Thandi,</p>');
    expect(html).toContain('<p>Your portal is ready.</p>');
    expect(html).toContain('This invitation expires in 7 days.');
    expect(html).toContain('<title>Welcome to Navigate Wealth | Navigate Wealth</title>');
    expect(html).toContain('>Unsubscribe</a>');
  });

  it('drops optional blocks when their value is empty', () => {
    const html = renderEmailLayout(base);
    expect(html).not.toContain('class="nw-muted nw-lead"');
    expect(html).not.toContain('v:roundrect');
    expect(html).not.toContain('class="nw-note');
    expect(html).not.toContain('Unsubscribe');
    expect(html).not.toContain('Button not working?');
  });

  it('inserts body HTML verbatim, never as template syntax', () => {
    const html = renderEmailLayout({ ...base, bodyHtml: '<p>Hi {{ .Name }}, $& $1</p>' });
    expect(html).toContain('<p>Hi {{ .Name }}, $& $1</p>');
  });

  it('defaults the headline, and the eyebrow to the date in South African time', () => {
    const html = renderEmailLayout({ now, bodyHtml: '<p>x</p>' });
    expect(formatEmailDate(now)).toBe('23 November 2026');
    expect(html).toContain('>Navigate Wealth</h1>');
    expect(html).toContain('</span>23 November 2026</p>');
    expect(renderEmailLayout({ ...base, eyebrow: 'Security notice' })).toContain(
      '</span>Security notice</p>',
    );
  });

  it('escapes the title where it becomes an attribute or the document title', () => {
    const html = renderEmailLayout({ ...base, title: 'Q&amp;A: <em>"Retirement"</em>' });
    expect(html).toContain('aria-label="Q&amp;A: &quot;Retirement&quot;"');
    expect(html).toContain('<title>Q&amp;A: "Retirement" | Navigate Wealth</title>');
  });

  describe('preheader', () => {
    const preheaderOf = (html: string) =>
      /mso-hide:all;font-size:1px;line-height:1px;[^"]*">([^&]*)&#8199;/.exec(html)?.[1];

    it('prefers an explicit preheader, then the subtitle', () => {
      expect(
        preheaderOf(renderEmailLayout({ ...base, preheader: 'Explicit', subtitle: 'Sub' })),
      ).toBe('Explicit');
      expect(preheaderOf(renderEmailLayout({ ...base, subtitle: 'Sub <b>line</b>' }))).toBe(
        'Sub line',
      );
    });

    it('otherwise opens with the greeting and body text, clipped', () => {
      const long = 'word '.repeat(80);
      const preheader = preheaderOf(
        renderEmailLayout({
          ...base,
          greeting: 'Dear Thandi,',
          bodyHtml: `<style>p{color:red}</style><p>${long}</p>`,
        }),
      );
      expect(preheader?.startsWith('Dear Thandi, word word')).toBe(true);
      expect(preheader).not.toContain('color:red');
      expect(preheader!.length).toBeLessThanOrEqual(141);
      expect(preheader!.endsWith('…')).toBe(true);
    });
  });

  describe('button', () => {
    const url = 'https://www.navigatewealth.co/reset?token=a"b';

    it('renders the Outlook (VML) and HTML buttons with the same, attribute-safe link', () => {
      const html = renderEmailLayout({ ...base, buttonUrl: url, buttonLabel: 'Reset password' });
      const safe = 'https://www.navigatewealth.co/reset?token=a&quot;b';
      expect(html).toContain(
        `<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safe}"`,
      );
      expect(html).toContain(`<a href="${safe}" class="nw-btn"`);
      expect(html).toContain('Reset password&nbsp;&nbsp;&rarr;');
      expect(html).not.toContain('token=a"b');
    });

    it('prints the link as text for http(s) links unless turned off', () => {
      expect(renderEmailLayout({ ...base, buttonUrl: url })).toContain('Button not working?');
      expect(renderEmailLayout({ ...base, buttonUrl: '#' })).not.toContain('Button not working?');
      expect(renderEmailLayout({ ...base, buttonUrl: url, buttonFallback: false })).not.toContain(
        'Button not working?',
      );
    });
  });

  describe('footer', () => {
    it('prints the defaults and the regulatory line', () => {
      const html = renderEmailLayout(base);
      expect(html).toContain(
        'First Floor, Milestone Place Block A<br />25 Sovereign Drive, Route 21 Business Park<br />Pretoria, 0157',
      );
      expect(html).toContain('href="tel:+27126672505"');
      expect(html).toContain('href="mailto:info@navigatewealth.co"');
      expect(html).toContain('>LinkedIn</a>');
      expect(html).toContain(
        'Wealthfront (Pty) Ltd (Reg. No. 2024/071953/07), trading as Navigate Wealth, is an authorised Financial Services Provider (FSP No. 54606).',
      );
      expect(html).toContain('© 2026 Navigate Wealth. All rights reserved.');
    });

    it('prints saved settings over the defaults, escaped, keeping defaults for missing fields', () => {
      const html = renderEmailLayout({
        ...base,
        footer: {
          address: 'Suite 1 & 2<br />Pretoria\n<script>x</script>0157',
          contactPhone: '',
          contactEmail: null as unknown as string,
          socialLinks: { linkedin: 'javascript:alert(1)', facebook: 'https://facebook.com/nw' },
          copyrightText: '© {{Year}} NW <b>Ltd</b>',
        },
      });
      expect(html).toContain('Suite 1 &amp; 2<br />Pretoria<br />x0157');
      expect(html).not.toContain('<script>');
      expect(html).not.toContain('tel:');
      expect(html).toContain('Questions? Write to us at');
      expect(html).toContain('mailto:info@navigatewealth.co');
      expect(html).not.toContain('javascript:');
      expect(html).not.toContain('>LinkedIn</a>');
      expect(html).toContain('>Facebook</a>');
      expect(html).toContain('© 2026 NW &lt;b&gt;Ltd&lt;/b&gt;');
      expect(html).toContain('FSP No. 54606');
    });

    it('leaves the shared defaults untouched', () => {
      renderEmailLayout({ ...base, footer: { contactPhone: '' } });
      expect(EMAIL_LAYOUT_FOOTER_DEFAULTS.contactPhone).toBe('+27 12 667 2505');
    });
  });

  it('escapes quotes in the unsubscribe link', () => {
    const html = renderEmailLayout({ ...base, unsubscribeUrl: 'https://x.co/u?e="a"' });
    expect(html).toContain('href="https://x.co/u?e=&quot;a&quot;"');
  });

  it('declares both themes and remaps common inline content colours in dark mode', () => {
    const html = renderEmailLayout(base);
    expect(html).toContain('<meta name="color-scheme" content="light dark">');
    expect(html).toContain('@media (prefers-color-scheme: dark)');
    expect(html).toContain('.nw-content [style*="#f3f4f6" i]');
    // A violet button keeps its white label: accent text rules skip anything with a background.
    expect(html).toContain('.nw-content [style*="#6d28d9" i]:not([style*="background" i])');
  });
});

describe('forceEmailColorScheme', () => {
  const html = renderEmailLayout(base);

  it('turns the dark block on unconditionally for a dark preview', () => {
    const dark = forceEmailColorScheme(html, 'dark');
    expect(dark).not.toContain('prefers-color-scheme');
    expect(dark).toContain('@media all{');
    expect(dark).toContain('<meta name="color-scheme" content="dark">');
  });

  it('turns it off for a light preview', () => {
    const light = forceEmailColorScheme(html, 'light');
    expect(light).not.toContain('prefers-color-scheme');
    expect(light).toContain('@media not all{');
    expect(light).toContain('<meta name="color-scheme" content="light">');
  });
});
