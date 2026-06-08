import { describe, it, expect } from 'vitest';
import { normalizePersonNamePart, resolvePersonName } from '../personName';

describe('normalizePersonNamePart', () => {
  it('returns empty string for falsy input', () => {
    expect(normalizePersonNamePart(undefined)).toBe('');
    expect(normalizePersonNamePart(null)).toBe('');
    expect(normalizePersonNamePart('')).toBe('');
    expect(normalizePersonNamePart('   ')).toBe('');
  });

  it('returns normal-cased names unchanged', () => {
    expect(normalizePersonNamePart('John')).toBe('John');
    expect(normalizePersonNamePart('van der Berg')).toBe('van der Berg');
    expect(normalizePersonNamePart("O'Brien")).toBe("O'Brien");
  });

  it('title-cases ALL-CAPS names', () => {
    expect(normalizePersonNamePart('JOHN')).toBe('John');
    expect(normalizePersonNamePart('VAN DER BERG')).toBe('Van Der Berg');
    expect(normalizePersonNamePart('SMITH')).toBe('Smith');
  });

  it('compacts internal whitespace', () => {
    expect(normalizePersonNamePart('  John  ')).toBe('John');
    expect(normalizePersonNamePart('John  Doe')).toBe('John Doe');
  });

  it('handles single-letter names without uppercasing', () => {
    expect(normalizePersonNamePart('J')).toBe('J');
    expect(normalizePersonNamePart('A')).toBe('A');
  });

  it('title-cases names with hyphens', () => {
    expect(normalizePersonNamePart('MARY-ANNE')).toBe('Mary-Anne');
  });
});

describe('resolvePersonName', () => {
  it('prefers profile name over metadata and full name', () => {
    const result = resolvePersonName({
      profileFirstName: 'John',
      profileLastName: 'Smith',
      metadataFirstName: 'JANE',
      metadataLastName: 'DOE',
      fullName: 'Jane Doe',
    });
    expect(result.firstName).toBe('John');
    expect(result.lastName).toBe('Smith');
  });

  it('falls back to metadata when profile is empty', () => {
    const result = resolvePersonName({
      profileFirstName: null,
      profileLastName: null,
      metadataFirstName: 'ALICE',
      metadataLastName: 'WONDER',
    });
    expect(result.firstName).toBe('Alice');
    expect(result.lastName).toBe('Wonder');
  });

  it('splits fullName when other sources are absent', () => {
    const result = resolvePersonName({
      fullName: 'Bob Builder',
    });
    expect(result.firstName).toBe('Bob');
    expect(result.lastName).toBe('Builder');
  });

  it('uses fallback defaults when nothing is provided', () => {
    const result = resolvePersonName({});
    expect(result.firstName).toBe('Unknown');
    expect(result.lastName).toBe('User');
  });

  it('uses custom fallback values', () => {
    const result = resolvePersonName({
      fallbackFirstName: 'Guest',
      fallbackLastName: 'Account',
    });
    expect(result.firstName).toBe('Guest');
    expect(result.lastName).toBe('Account');
  });

  it('normalizes ALL-CAPS profile name', () => {
    const result = resolvePersonName({
      profileFirstName: 'PETER',
      profileLastName: 'PAN',
    });
    expect(result.firstName).toBe('Peter');
    expect(result.lastName).toBe('Pan');
  });

  it('handles fullName with only first name (no last name)', () => {
    const result = resolvePersonName({
      fullName: 'Madonna',
    });
    expect(result.firstName).toBe('Madonna');
    expect(result.lastName).toBe('User');
  });

  it('handles fullName with multiple parts', () => {
    const result = resolvePersonName({
      fullName: 'Jean Claude Van Damme',
    });
    expect(result.firstName).toBe('Jean');
    expect(result.lastName).toBe('Claude Van Damme');
  });
});
