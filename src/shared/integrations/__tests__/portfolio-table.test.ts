/**
 * portfolio-table.ts — the pure helpers both sides of the wire rely on.
 *
 * Client-name matching decides whether a row writes into a record, so the
 * tolerance (case, accents, punctuation, word order) and the one thing that
 * must never match (an empty name) are pinned here.
 */
import { describe, it, expect } from 'vitest';
import {
  clientNameKey,
  clientNamesMatch,
  displayNameFromProfile,
  normaliseClientName,
} from '../portfolio-table';

describe('normaliseClientName', () => {
  it('folds case, accents, punctuation and spacing', () => {
    expect(normaliseClientName('  Thandi   NKOSI ')).toBe('thandi nkosi');
    expect(normaliseClientName('José Müller-Smith')).toBe('jose muller smith');
    expect(normaliseClientName("O'Neil, Sean")).toBe('o neil sean');
  });

  it('reads a non-string as empty', () => {
    expect(normaliseClientName(null)).toBe('');
    expect(normaliseClientName(undefined)).toBe('');
  });
});

describe('clientNamesMatch', () => {
  it('matches the same name written differently', () => {
    expect(clientNamesMatch('Thandi Nkosi', 'thandi nkosi')).toBe(true);
    expect(clientNamesMatch('Nkosi, Thandi', 'Thandi Nkosi')).toBe(true);
    expect(clientNameKey('Nkosi, Thandi')).toBe(clientNameKey('Thandi Nkosi'));
  });

  it('does not match a different person', () => {
    expect(clientNamesMatch('Thandi Nkosi', 'Thabo Nkosi')).toBe(false);
    expect(clientNamesMatch('Thandi Nkosi', 'Thandi')).toBe(false);
  });

  it('never matches an empty name, even to another empty name', () => {
    expect(clientNamesMatch('', '')).toBe(false);
    expect(clientNamesMatch('   ', 'Thandi Nkosi')).toBe(false);
  });
});

describe('displayNameFromProfile', () => {
  it('prefers a full name, then first + last, from either profile shape', () => {
    expect(displayNameFromProfile({ fullName: 'Thandi Nkosi' }, 'c1')).toBe('Thandi Nkosi');
    expect(displayNameFromProfile({ firstName: 'Thandi', lastName: 'Nkosi' }, 'c1')).toBe(
      'Thandi Nkosi',
    );
    expect(
      displayNameFromProfile(
        { personalInformation: { firstName: 'John', surname: 'Smith' } },
        'c1',
      ),
    ).toBe('John Smith');
  });

  it('falls back to a short client id when the profile carries no name', () => {
    expect(displayNameFromProfile(null, 'abcdef1234567890')).toBe('Client abcdef12');
    expect(displayNameFromProfile({}, 'abcdef1234567890')).toBe('Client abcdef12');
  });
});
