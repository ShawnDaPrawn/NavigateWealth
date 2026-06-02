/**
 * SingleClientForm — unit + render tests (Phase 4 coverage push).
 *
 * Focus is the compliance-critical pure helpers the form exports:
 *   - validateSaIdNumber: SA ID structure + Luhn checksum, with DOB + gender
 *     extraction and century inference. Getting this wrong means accepting an
 *     invalid client identity (a KYC failure) or rejecting a valid one.
 *   - computeAge: age from an ISO DOB, including the "birthday not yet reached
 *     this year" decrement.
 * A render smoke test (api mocked) then covers the form's render path.
 *
 * SA ID fixtures below are real, Luhn-valid numbers computed for these tests:
 *   9001010000080 — DOB 1990-01-01, female
 *   9001015000085 — DOB 1990-01-01, male (gender digit >= 5)
 *   1005150000089 — DOB 2010-05-15, female (2000s century branch)
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen } from '@/test/utils';

vi.mock('../../../../../../utils/api/client', () => ({
  api: { post: vi.fn(async () => ({ data: { clientId: 'c1' } })) },
}));

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }) as unknown as typeof window.matchMedia;
  }
  Element.prototype.scrollIntoView = vi.fn();
});

import { validateSaIdNumber, computeAge, SingleClientForm } from '../SingleClientForm';

describe('validateSaIdNumber (structure + Luhn checksum)', () => {
  it('accepts a valid female SA ID and extracts DOB + gender', () => {
    const r = validateSaIdNumber('9001010000080');
    expect(r.valid).toBe(true);
    expect(r.dob).toBe('1990-01-01');
    expect(r.gender).toBe('Female');
  });

  it('reads Male from a gender digit >= 5', () => {
    const r = validateSaIdNumber('9001015000085');
    expect(r.valid).toBe(true);
    expect(r.gender).toBe('Male');
  });

  it('infers the 2000s century when YY <= the current 2-digit year', () => {
    const r = validateSaIdNumber('1005150000089');
    expect(r.valid).toBe(true);
    expect(r.dob).toBe('2010-05-15');
  });

  it('tolerates internal whitespace', () => {
    expect(validateSaIdNumber('900101 0000 080').valid).toBe(true);
  });

  it('rejects a wrong length', () => {
    const r = validateSaIdNumber('12345');
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/13 digits/i);
  });

  it('rejects non-numeric characters', () => {
    const r = validateSaIdNumber('90010100000X0');
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/only digits/i);
  });

  it('rejects an impossible month', () => {
    const r = validateSaIdNumber('9013010000080');
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/month/i);
  });

  it('rejects an impossible day', () => {
    const r = validateSaIdNumber('9001320000080');
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/day/i);
  });

  it('rejects a date that does not exist (e.g. 30 February)', () => {
    const r = validateSaIdNumber('9002300000080');
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/date of birth/i);
  });

  it('rejects a bad Luhn checksum (otherwise-valid number)', () => {
    const r = validateSaIdNumber('9001010000081');
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/checksum/i);
  });
});

describe('computeAge', () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-02T12:00:00Z'));
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it('computes age when the birthday has already passed this year', () => {
    expect(computeAge('1990-03-15')).toBe(36);
  });

  it('decrements when the birthday is still ahead this year', () => {
    expect(computeAge('1990-09-15')).toBe(35);
  });

  it('returns null for an unparseable date', () => {
    expect(computeAge('not-a-date')).toBeNull();
  });
});

describe('SingleClientForm (render)', () => {
  it('renders the client intake form fields', () => {
    render(<SingleClientForm onSuccess={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getAllByText(/first name/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/last name/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/id \/ passport number/i).length).toBeGreaterThan(0);
  });
});
