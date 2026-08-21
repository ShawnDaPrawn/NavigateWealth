import { describe, expect, it, vi } from 'vitest';
import {
  assertActiveSigningState,
  assertSignerFieldOwnership,
  getMissingSignerFactors,
  isSignerTurn,
} from '../esign-signer-guards.ts';

describe('e-sign signer authorization guards', () => {
  it('rejects expired and terminal envelopes', () => {
    const signer = { status: 'sent' };
    expect(() =>
      assertActiveSigningState(
        { status: 'sent', expires_at: new Date(Date.now() - 1).toISOString() },
        signer,
      ),
    ).toThrow('expired');
    expect(() =>
      assertActiveSigningState(
        { status: 'completed', expires_at: new Date(Date.now() + 60_000).toISOString() },
        signer,
      ),
    ).toThrow('not available');
  });

  it('requires every configured factor within the short-lived window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-21T10:00:00.000Z'));
    const envelope = { kba_required: true };
    const signer = {
      requires_otp: true,
      otp_verified: true,
      otp_verified_at: '2026-08-21T09:00:00.000Z',
      access_code: 'configured',
      access_code_verified_at: '2026-08-21T09:59:00.000Z',
      kba: { status: 'passed', verified_at: '2026-08-21T09:59:00.000Z' },
    };
    expect(getMissingSignerFactors(envelope, signer)).toEqual(['otp']);
    vi.useRealTimers();
  });

  it('enforces sequential order and field ownership', () => {
    const signer = { id: 's2', order: 2 };
    const envelope = {
      signing_mode: 'sequential',
      signers: [{ id: 's1', order: 1, status: 'sent' }, signer],
      fields: [
        { id: 'f1', signer_id: 's1' },
        { id: 'f2', signer_id: 's2' },
      ],
    };
    expect(isSignerTurn(envelope, signer)).toBe(false);
    expect(() =>
      assertSignerFieldOwnership(envelope, 's2', [{ field_id: 'f1', value: 'x' }]),
    ).toThrow('does not belong');
    expect(() =>
      assertSignerFieldOwnership(envelope, 's2', [{ field_id: 'f2', value: 'x' }]),
    ).not.toThrow();
  });
});
