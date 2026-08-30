/**
 * email-transport-ses.ts — SES transport contracts
 * ================================================
 *
 * What must hold before any real send:
 *
 *   1. **The MIME message is honest.** The html/text bodies round-trip
 *      through base64 intact, the deliverability headers (List-Unsubscribe
 *      et al.) survive verbatim at the top level, and attachments produce a
 *      correct multipart/mixed envelope — SES transmits raw MIME exactly as
 *      built, so a malformed message here is a garbled email in an inbox.
 *   2. **SigV4 is deterministic and complete.** Same inputs → same
 *      signature; the Authorization header carries the full credential
 *      scope; the signed payload hash matches the body actually sent.
 *   3. **Failures throw with the SES response text**, so email-core's
 *      bounce-vs-transient classification works unchanged.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildMimeMessage,
  getSesConfig,
  sendViaSes,
  signSesRequest,
  type SesConfig,
} from '../email-transport-ses.ts';

const CONFIG: SesConfig = {
  region: 'eu-west-1',
  accessKeyId: 'AKIDEXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
};

const MESSAGE = {
  from: { email: 'newsletters@navigatewealth.co', name: 'Navigate Wealth' },
  to: 'client@example.co.za',
  replyTo: { email: 'info@navigatewealth.co', name: 'Navigate Wealth Support' },
  subject: 'September update — Ñews',
  html: '<p>Hello Thandi</p>',
  text: 'Hello Thandi',
  headers: {
    'List-Unsubscribe': '<mailto:unsubscribe@navigatewealth.co>, <https://x.example/u>',
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  },
};

const b64ToUtf8 = (b64: string) =>
  new TextDecoder().decode(Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0)));

describe('buildMimeMessage', () => {
  it('carries addresses, encoded subject and custom headers verbatim', () => {
    const mime = buildMimeMessage(MESSAGE);
    expect(mime).toContain('From: Navigate Wealth <newsletters@navigatewealth.co>');
    expect(mime).toContain('To: client@example.co.za');
    expect(mime).toContain('Reply-To: Navigate Wealth Support <info@navigatewealth.co>');
    // Non-ASCII subject becomes an RFC 2047 encoded word that decodes back.
    const subjectLine = mime.split('\r\n').find((l) => l.startsWith('Subject: '))!;
    expect(subjectLine).toMatch(/^Subject: =\?UTF-8\?B\?.+\?=$/);
    expect(b64ToUtf8(subjectLine.slice('Subject: =?UTF-8?B?'.length, -2))).toBe(
      'September update — Ñews',
    );
    expect(mime).toContain('List-Unsubscribe-Post: List-Unsubscribe=One-Click');
    expect(mime).toContain('MIME-Version: 1.0');
    expect(mime).toContain('Content-Type: multipart/alternative');
  });

  it('round-trips both bodies through base64 intact', () => {
    const mime = buildMimeMessage({ ...MESSAGE, html: '<p>Ñandí & друзья</p>' });
    const parts = mime.split(/--alt-[0-9a-f-]+/);
    const textPart = parts.find((p) => p.includes('text/plain'))!;
    const htmlPart = parts.find((p) => p.includes('text/html'))!;
    const decode = (part: string) => b64ToUtf8(part.split('\r\n\r\n')[1].replace(/\s+/g, ''));
    expect(decode(textPart)).toBe('Hello Thandi');
    expect(decode(htmlPart)).toBe('<p>Ñandí & друзья</p>');
  });

  it('wraps attachments in multipart/mixed with the alternative nested inside', () => {
    const mime = buildMimeMessage({
      ...MESSAGE,
      attachments: [
        { content: btoa('PDFDATA'), filename: 'statement.pdf', type: 'application/pdf' },
      ],
    });
    expect(mime).toContain('Content-Type: multipart/mixed');
    expect(mime).toContain('Content-Type: multipart/alternative');
    expect(mime).toContain('Content-Disposition: attachment; filename="statement.pdf"');
    expect(mime).toContain(btoa('PDFDATA'));
  });
});

describe('signSesRequest', () => {
  const NOW = new Date('2026-08-30T09:15:00.000Z');

  it('produces a deterministic, fully-scoped Authorization header', async () => {
    const a = await signSesRequest(CONFIG, '/v2/email/outbound-emails', '{"x":1}', NOW);
    const b = await signSesRequest(CONFIG, '/v2/email/outbound-emails', '{"x":1}', NOW);
    expect(a.headers.Authorization).toBe(b.headers.Authorization);
    expect(a.headers.Authorization).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/20260830\/eu-west-1\/ses\/aws4_request, SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/,
    );
    expect(a.headers['x-amz-date']).toBe('20260830T091500Z');
    expect(a.url).toBe('https://email.eu-west-1.amazonaws.com/v2/email/outbound-emails');
  });

  it('changes the signature when the body changes', async () => {
    const a = await signSesRequest(CONFIG, '/v2/email/outbound-emails', '{"x":1}', NOW);
    const b = await signSesRequest(CONFIG, '/v2/email/outbound-emails', '{"x":2}', NOW);
    expect(a.headers.Authorization).not.toBe(b.headers.Authorization);
    expect(a.headers['x-amz-content-sha256']).not.toBe(b.headers['x-amz-content-sha256']);
  });
});

describe('sendViaSes', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs signed raw content with the destination', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    await sendViaSes(CONFIG, { ...MESSAGE, cc: ['second@example.co.za'] });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://email.eu-west-1.amazonaws.com/v2/email/outbound-emails');
    const payload = JSON.parse(init.body as string);
    expect(payload.FromEmailAddress).toBe('newsletters@navigatewealth.co');
    expect(payload.Destination).toEqual({
      ToAddresses: ['client@example.co.za'],
      CcAddresses: ['second@example.co.za'],
    });
    // The raw MIME decodes back to a message carrying our headers.
    expect(b64ToUtf8(payload.Content.Raw.Data)).toContain('List-Unsubscribe-Post');
    expect((init.headers as Record<string, string>).Authorization).toContain('AWS4-HMAC-SHA256');
  });

  it('throws with the SES response text so failure classification keeps working', async () => {
    fetchMock.mockResolvedValue(
      new Response('{"message":"Email address is not verified"}', { status: 400 }),
    );
    await expect(sendViaSes(CONFIG, MESSAGE)).rejects.toThrow(/SES error \(400\).*not verified/);
  });
});

describe('getSesConfig', () => {
  it('returns null outside Deno (and with missing secrets) rather than throwing', () => {
    expect(getSesConfig()).toBeNull();
  });
});
