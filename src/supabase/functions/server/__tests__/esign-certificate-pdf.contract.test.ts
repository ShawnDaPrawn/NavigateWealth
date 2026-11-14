/**
 * esign-certificate-pdf.ts — Certificate of Completion Renderer Contract
 * =====================================================================
 *
 * The certificate is the firm's evidence if a signature is ever disputed, so
 * what it SAYS matters as much as how it looks. Pinned here:
 *
 *   - **Times are SAST to the second.** South Africa has no daylight saving,
 *     so SAST is always UTC+02:00, and an evidence page needs seconds.
 *   - **Audit actions read as plain English**, never as raw codes like
 *     "Otp Sent"; an unknown action still reads as a sentence.
 *   - **Mobile numbers are masked** to the last four digits — the certificate
 *     goes to every party.
 *   - **It never throws on real-world input**: names outside WinAnsi, a
 *     corrupt signature image, no consent, no audit trail, no document record.
 *   - **It paginates** rather than clipping: a long audit trail or many
 *     signers produce more pages, never lost rows.
 *
 * The real pdf-lib runs: the layout is the module.
 */
import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { renderCertificatePdf } from '../esign-certificate-pdf.ts';
import {
  describeAction,
  describeDevice,
  fmtDateTime,
  fmtDuration,
  fmtTime,
  maskPhone,
} from '../esign-certificate-format.ts';
import type { CertificateData, CertificateSigner } from '../esign-certificate-pdf.ts';

const signer = (over: Partial<CertificateSigner> = {}): CertificateSigner => ({
  order: 1,
  name: 'Thandiwe Mokoena',
  email: 't.mokoena@example.com',
  role: 'Client',
  signed_at: '2026-11-12T08:11:42.000Z',
  invite_sent_at: '2026-11-12T07:18:11.000Z',
  otp_methods: [],
  requires_otp: false,
  ...over,
});

const data = (over: Partial<CertificateData> = {}): CertificateData => ({
  certificate_id: 'cert-1',
  envelope_id: 'env-1',
  title: 'Record of Advice',
  created_at: '2026-11-12T07:14:06.000Z',
  completed_at: '2026-11-12T09:36:58.000Z',
  issued_at: '2026-11-12T09:36:59.000Z',
  sender_name: 'Navigate Wealth',
  signers: [signer()],
  audit_events: [
    { action: 'signed', at: '2026-11-12T08:11:42.000Z', email: 't.mokoena@example.com' },
  ],
  ...over,
});

async function pageCount(bytes: Uint8Array) {
  return (await PDFDocument.load(bytes)).getPageCount();
}

describe('formatting', () => {
  it('shows times in SAST (UTC+02:00) to the second', () => {
    expect(fmtTime('2026-11-12T08:11:42.000Z')).toBe('10:11:42');
    expect(fmtDateTime('2026-11-12T22:30:05.000Z')).toBe('13 Nov 2026, 00:30:05 SAST');
  });

  it('says "Not recorded" rather than printing an invalid date', () => {
    expect(fmtDateTime(undefined)).toBe('Not recorded');
    expect(fmtDateTime('not-a-date')).toBe('Not recorded');
  });

  it('formats durations in hours, minutes and seconds', () => {
    expect(fmtDuration(5_114_000)).toBe('1 h 25 min 14 s');
    expect(fmtDuration(3_211_000)).toBe('53 min 31 s');
    expect(fmtDuration(4_000)).toBe('4 s');
  });

  it('masks a mobile number to its last four digits', () => {
    expect(maskPhone('+27 82 555 4417')).toBe('+27 82 ••• 4417');
    expect(maskPhone('0825554417')).toBe('082 ••• 4417');
    expect(maskPhone('12345')).toBe('12345');
  });

  it('describes common devices from the user agent', () => {
    expect(
      describeDevice(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 19_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.1 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('Safari 19 on iPhone (iOS 19.1)');
    expect(
      describeDevice(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
      ),
    ).toBe('Chrome 142 on Windows');
    expect(
      describeDevice(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0',
      ),
    ).toBe('Edge 142 on Windows');
    expect(describeDevice(undefined)).toBe('Not recorded');
  });
});

describe('audit actions in plain English', () => {
  it.each([
    ['otp_sent', 'One-time PIN sent'],
    ['otp_verified', 'One-time PIN verified'],
    ['viewed', 'Document opened'],
    ['signed', 'Document signed'],
    ['esign_invites_sent', 'Envelope sent'],
    ['digital_signature_applied', 'Digital seal applied'],
  ])('%s reads as "%s"', (action, label) => {
    expect(describeAction(action)).toBe(label);
  });

  it('turns an unknown action into a sentence, keeping acronyms', () => {
    expect(describeAction('esign_sms_bounce_detected')).toBe('SMS bounce detected');
    expect(describeAction('webhook_delivery_replayed')).toBe('Webhook delivery replayed');
    expect(describeAction('')).toBe('Event');
  });
});

describe('rendering', () => {
  it('produces an A4 PDF', async () => {
    const bytes = await renderCertificatePdf(data());
    const doc = await PDFDocument.load(bytes);
    const { width, height } = doc.getPage(0).getSize();
    expect(Math.round(width)).toBe(595);
    expect(Math.round(height)).toBe(842);
    expect(doc.getTitle()).toBe('Certificate of completion — Record of Advice');
  });

  it('renders summary, signer evidence and audit trail on separate pages', async () => {
    expect(await pageCount(await renderCertificatePdf(data()))).toBe(3);
  });

  it('survives names and text outside the standard PDF character set', async () => {
    const bytes = await renderCertificatePdf(
      data({
        title: 'Ŝpecial — 测试 🚀',
        signers: [signer({ name: 'Ğüñther Łukasz 测试', signing_reason: 'As trustee ✓' })],
      }),
    );
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });

  it('survives a corrupt signature image and a typed signature', async () => {
    const bytes = await renderCertificatePdf(
      data({
        signers: [
          signer({ signature_data: 'data:image/png;base64,bm90LWFuLWltYWdl' }),
          signer({ order: 2, email: 'b@example.com', signature_data: 'Thandiwe Mokoena' }),
        ],
      }),
    );
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });

  it('renders without consent, document record, audit trail or sender email', async () => {
    const bytes = await renderCertificatePdf(
      data({ consent: undefined, document: undefined, audit_events: [] }),
    );
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });

  it('paginates a long audit trail and many signers instead of clipping them', async () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      signer({ order: i + 1, name: `Signer ${i + 1}`, email: `s${i}@example.com` }),
    );
    const events = Array.from({ length: 80 }, (_, i) => ({
      action: i % 2 ? 'viewed' : 'otp_sent',
      at: new Date(Date.UTC(2026, 10, 12, 7, i)).toISOString(),
      email: `s${i % 12}@example.com`,
      actor_type: i % 2 ? 'signer' : 'system',
      metadata: { channel: 'sms' },
    }));
    const pages = await pageCount(
      await renderCertificatePdf(data({ signers: many, audit_events: events })),
    );
    expect(pages).toBeGreaterThan(8);
  });
});
