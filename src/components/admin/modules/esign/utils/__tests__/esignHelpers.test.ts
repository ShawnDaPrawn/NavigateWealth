import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  areAllRequiredFieldsFilled,
  calculateEnvelopeStats,
  calculateSigningProgress,
  canSendEnvelope,
  copyToClipboard,
  filterEnvelopesByStatus,
  formatFileSize,
  formatSignerName,
  generateSigningLink,
  getExpiryBadgeColor,
  getExpiryWarningLevel,
  getFieldIcon,
  getFieldLabel,
  getNextSigner,
  getProgressColor,
  getProgressMessage,
  getRelativeTime,
  getSignerFields,
  getUserFriendlyErrorMessage,
  groupFieldsByPage,
  isValidEmail,
  isValidPDF,
  parseApiError,
  sortEnvelopesByDate,
  sortSignersByOrder,
  validateSigner,
} from '../esignHelpers';
import type { EsignEnvelope, EsignField, EsignSigner } from '../../types';

const signer = (o: Partial<EsignSigner>): EsignSigner => o as unknown as EsignSigner;
const field = (o: Partial<EsignField>): EsignField => o as unknown as EsignField;
const envelope = (o: Partial<EsignEnvelope>): EsignEnvelope => o as unknown as EsignEnvelope;

describe('progress + stats', () => {
  it('calculates signing progress', () => {
    const env = envelope({
      signers: [
        signer({ id: '1', status: 'signed' }),
        signer({ id: '2', status: 'pending' }),
        signer({ id: '3', status: 'viewed' }),
        signer({ id: '4', status: 'signed' }),
      ],
    });
    const p = calculateSigningProgress(env);
    expect(p.totalSigners).toBe(4);
    expect(p.signedCount).toBe(2);
    expect(p.pendingCount).toBe(2);
    expect(p.percentComplete).toBe(50);
    expect(p.isComplete).toBe(false);
  });

  it('reports 0% and not-complete for an envelope with no signers', () => {
    const p = calculateSigningProgress(envelope({ signers: [] }));
    expect(p.percentComplete).toBe(0);
    expect(p.isComplete).toBe(false);
  });

  it('is complete when all signers have signed', () => {
    const p = calculateSigningProgress(
      envelope({ signers: [signer({ id: '1', status: 'signed' })] }),
    );
    expect(p.isComplete).toBe(true);
    expect(p.percentComplete).toBe(100);
  });

  it('tallies envelope stats by status', () => {
    const stats = calculateEnvelopeStats([
      envelope({ status: 'draft' }),
      envelope({ status: 'sent' }),
      envelope({ status: 'partially_signed' }),
      envelope({ status: 'completed' }),
      envelope({ status: 'expired' }),
      envelope({ status: 'rejected' }),
    ]);
    expect(stats).toEqual({ total: 6, draft: 1, sent: 2, completed: 1, expired: 1, rejected: 1 });
  });
});

describe('validation', () => {
  it('validates email addresses', () => {
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('bad@')).toBe(false);
    expect(isValidEmail('no-at.com')).toBe(false);
  });

  it('validates PDF files by type and size', () => {
    const small = new File([new Uint8Array(2048)], 'doc.pdf', { type: 'application/pdf' });
    expect(isValidPDF(small)).toEqual({ valid: true });

    const notPdf = new File([new Uint8Array(2048)], 'doc.txt', { type: 'text/plain' });
    expect(isValidPDF(notPdf).valid).toBe(false);

    const tooBig = { type: 'application/pdf', name: 'big.pdf', size: 60 * 1024 * 1024 } as File;
    expect(isValidPDF(tooBig)).toEqual({ valid: false, error: 'File size must be less than 50MB' });

    const tooSmall = { type: 'application/pdf', name: 'tiny.pdf', size: 10 } as File;
    expect(isValidPDF(tooSmall).valid).toBe(false);
  });

  it('validates signer data', () => {
    expect(validateSigner({ name: 'Jane', email: 'jane@x.co' }).valid).toBe(true);
    const bad = validateSigner({ name: '', email: 'nope', order: 0 });
    expect(bad.valid).toBe(false);
    expect(bad.errors).toContain('Signer name is required');
    expect(bad.errors).toContain('Invalid email address');
    expect(bad.errors).toContain('Signer order must be at least 1');
  });

  it('gates whether an envelope can be sent', () => {
    expect(canSendEnvelope(envelope({ status: 'sent' })).canSend).toBe(false);
    expect(canSendEnvelope(envelope({ status: 'draft', signers: [] })).reason).toContain(
      'one signer',
    );
    expect(
      canSendEnvelope(
        envelope({ status: 'draft', signers: [signer({ id: 's1', name: 'A' })], fields: [] }),
      ).reason,
    ).toContain('one field');
    expect(
      canSendEnvelope(
        envelope({
          status: 'draft',
          signers: [signer({ id: 's1', name: 'A' })],
          fields: [field({ signer_id: 'other' })],
        }),
      ).reason,
    ).toContain('no assigned fields');
    expect(
      canSendEnvelope(
        envelope({
          status: 'draft',
          signers: [signer({ id: 's1', name: 'A' })],
          fields: [field({ signer_id: 's1' })],
        }),
      ),
    ).toEqual({ canSend: true });
  });
});

describe('sorting, filtering, grouping', () => {
  it('sorts signers by order without mutating the input', () => {
    const input = [signer({ id: 'b', order: 2 }), signer({ id: 'a', order: 1 })];
    const sorted = sortSignersByOrder(input);
    expect(sorted.map((s) => s.id)).toEqual(['a', 'b']);
    expect(input[0].id).toBe('b'); // original untouched
  });

  it('groups fields by page', () => {
    const grouped = groupFieldsByPage([
      field({ id: '1', page: 1 }),
      field({ id: '2', page: 2 }),
      field({ id: '3', page: 1 }),
    ]);
    expect(grouped.get(1)).toHaveLength(2);
    expect(grouped.get(2)).toHaveLength(1);
  });

  it('gets a signer’s fields', () => {
    const fields = [field({ id: '1', signer_id: 'x' }), field({ id: '2', signer_id: 'y' })];
    expect(getSignerFields(fields, 'x')).toHaveLength(1);
  });

  it('filters envelopes by status (empty filter = passthrough)', () => {
    const envs = [envelope({ status: 'draft' }), envelope({ status: 'sent' })];
    expect(filterEnvelopesByStatus(envs, [])).toHaveLength(2);
    expect(filterEnvelopesByStatus(envs, ['sent'])).toHaveLength(1);
  });

  it('sorts envelopes by date in both directions', () => {
    const envs = [
      envelope({ id: 'old', created_at: '2024-01-01T00:00:00Z' }),
      envelope({ id: 'new', created_at: '2025-01-01T00:00:00Z' }),
    ];
    expect(sortEnvelopesByDate(envs, 'desc')[0].id).toBe('new');
    expect(sortEnvelopesByDate(envs, 'asc')[0].id).toBe('old');
  });
});

describe('formatting + messages', () => {
  it('formats file sizes', () => {
    expect(formatFileSize(0)).toBe('0 Bytes');
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(1048576)).toBe('1 MB');
  });

  it('formats signer name with optional role', () => {
    expect(formatSignerName(signer({ name: 'Jo', role: 'Witness' }))).toBe('Jo (Witness)');
    expect(formatSignerName(signer({ name: 'Jo' }))).toBe('Jo');
  });

  it('gets the next actionable signer in order', () => {
    const next = getNextSigner([
      signer({ id: '1', order: 1, status: 'signed' }),
      signer({ id: '2', order: 2, status: 'pending' }),
    ]);
    expect(next?.id).toBe('2');
    expect(getNextSigner([signer({ id: '1', order: 1, status: 'signed' })])).toBeNull();
  });

  it('builds a progress message', () => {
    expect(getProgressMessage(envelope({ signers: [signer({ status: 'signed' })] }))).toBe(
      'All signers have completed signing',
    );
    expect(
      getProgressMessage(
        envelope({ signers: [signer({ status: 'pending' }), signer({ status: 'pending' })] }),
      ),
    ).toBe('Waiting for 2 signers');
    expect(
      getProgressMessage(
        envelope({ signers: [signer({ status: 'signed' }), signer({ status: 'pending' })] }),
      ),
    ).toBe('1 of 2 signed');
  });
});

describe('field helpers', () => {
  it('returns an icon and label per field type', () => {
    expect(getFieldIcon('signature')).toBe('✍️');
    expect(getFieldIcon('unknown' as never)).toBe('📋');
    expect(getFieldLabel('date')).toBe('Date');
    expect(getFieldLabel('custom' as never)).toBe('custom');
  });

  it('checks all required fields are filled', () => {
    const fields = [
      field({ signer_id: 's', required: true, value: 'x' }),
      field({ signer_id: 's', required: false, value: '' }),
    ];
    expect(areAllRequiredFieldsFilled(fields, 's')).toBe(true);
    expect(
      areAllRequiredFieldsFilled([field({ signer_id: 's', required: true, value: '' })], 's'),
    ).toBe(false);
  });
});

describe('expiry + colour helpers', () => {
  it('classifies expiry warning levels', () => {
    const inHours = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();
    expect(getExpiryWarningLevel(null)).toBe('none');
    expect(getExpiryWarningLevel(inHours(-1))).toBe('danger'); // already expired
    expect(getExpiryWarningLevel(inHours(12))).toBe('danger');
    expect(getExpiryWarningLevel(inHours(48))).toBe('warning');
    expect(getExpiryWarningLevel(inHours(120))).toBe('info');
    expect(getExpiryWarningLevel(inHours(1000))).toBe('none');
  });

  it('maps progress percentage to a colour', () => {
    expect(getProgressColor(0)).toBe('bg-gray-200');
    expect(getProgressColor(25)).toBe('bg-yellow-500');
    expect(getProgressColor(75)).toBe('bg-blue-500');
    expect(getProgressColor(100)).toBe('bg-green-500');
  });

  it('maps expiry to a badge colour', () => {
    const soon = new Date(Date.now() + 1 * 3600_000).toISOString();
    expect(getExpiryBadgeColor(soon)).toContain('red');
    expect(getExpiryBadgeColor(null)).toContain('gray');
  });
});

describe('relative time', () => {
  it('describes recent timestamps', () => {
    const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
    expect(getRelativeTime(ago(0))).toBe('Just now');
    expect(getRelativeTime(ago(2 * 60_000))).toBe('2 minutes ago');
    expect(getRelativeTime(ago(3 * 3600_000))).toBe('3 hours ago');
    expect(getRelativeTime(ago(2 * 86_400_000))).toBe('2 days ago');
  });

  it('falls back to a formatted date beyond a week', () => {
    expect(typeof getRelativeTime('2020-01-15T00:00:00Z')).toBe('string');
  });
});

describe('error helpers + url + clipboard', () => {
  it('parses API errors from various shapes', () => {
    expect(parseApiError('boom')).toBe('boom');
    expect(parseApiError(new Error('thrown'))).toBe('thrown');
    expect(parseApiError({ error: 'backend' })).toBe('backend');
    expect(parseApiError(42)).toBe('An unexpected error occurred');
  });

  it('maps known errors to friendly copy and passes through others', () => {
    expect(getUserFriendlyErrorMessage('Invalid OTP')).toBe(
      'The verification code you entered is incorrect',
    );
    expect(getUserFriendlyErrorMessage('Some other error')).toBe('Some other error');
  });

  it('builds a signing link from the current origin', () => {
    const link = generateSigningLink('E1', 'TOK');
    expect(link.endsWith('/sign/E1/TOK')).toBe(true);
    expect(link.startsWith('http')).toBe(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('copies to clipboard, returning true/false on success/failure', async () => {
    const writeText = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('denied'));
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(await copyToClipboard('hello')).toBe(true);
    expect(await copyToClipboard('again')).toBe(false);

    errSpy.mockRestore();
  });
});
