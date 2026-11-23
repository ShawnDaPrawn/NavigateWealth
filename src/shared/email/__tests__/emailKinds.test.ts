import { describe, it, expect } from 'vitest';
import {
  EMAIL_KINDS,
  emailKindLabel,
  isEmailKind,
  isSensitiveEmailKind,
  KINDS_IN_CAMPAIGN_HISTORY,
} from '../emailKinds';

describe('email kind catalogue', () => {
  it('gives every kind a distinct label, so the History filter is unambiguous', () => {
    const labels = Object.values(EMAIL_KINDS).map((k) => k.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('keeps keys in snake_case (they are stored in email_delivery_log.kind)', () => {
    for (const key of Object.keys(EMAIL_KINDS)) expect(key).toMatch(/^[a-z][a-z0-9_]*$/);
  });

  it('lists only campaigns and individual messages through their own History rows', () => {
    expect([...KINDS_IN_CAMPAIGN_HISTORY].sort()).toEqual(['campaign', 'direct_message']);
  });

  it('marks every email that carries a code or reset link as sensitive', () => {
    for (const kind of ['two_factor_code', 'email_change_code', 'esign_code', 'password_reset']) {
      expect(isSensitiveEmailKind(kind)).toBe(true);
    }
    expect(isSensitiveEmailKind('client_birthday')).toBe(false);
    expect(isSensitiveEmailKind('not_a_kind')).toBe(false);
  });

  it('labels known kinds and passes an unknown stored kind through', () => {
    expect(emailKindLabel('client_birthday')).toBe('Birthday greeting');
    expect(emailKindLabel('retired_kind')).toBe('retired_kind');
    expect(isEmailKind('newsletter')).toBe(true);
    expect(isEmailKind('toString')).toBe(false);
    expect(isEmailKind(42)).toBe(false);
  });
});
