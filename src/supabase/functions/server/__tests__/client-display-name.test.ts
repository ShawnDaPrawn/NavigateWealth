/**
 * client-display-name — which store a client's name is read from
 * ==============================================================
 *
 * The bug these pin, in the shape it actually reached a client: a client was
 * enrolled as "Liezl Daya", an admin corrected the profile to "Kirtan Daya",
 * and the birthday digest and the greeting sent to him both still said Liezl.
 * The profile had been corrected; auth `user_metadata` still held the signup
 * snapshot, and every read either preferred that snapshot or looked in the one
 * profile shape his row did not use.
 *
 * So the assertions worth having are about PRECEDENCE, not formatting: profile
 * over auth metadata, and the flat root over the legacy nested block.
 *
 * Run: npx vitest run src/supabase/functions/server/__tests__/client-display-name.test.ts
 */
import { describe, expect, it } from 'vitest';

import {
  applyClientName,
  resolveClientFirstName,
  resolveClientFullName,
  resolveClientLastName,
} from '../client-display-name.ts';

/** The production row, reduced to the fields that decide the answer. */
const KIRTAN_PROFILE = { userId: '396276b2', firstName: 'Kirtan', lastName: 'Daya' };
const KIRTAN_STALE_METADATA = { firstName: 'Liezl', surname: 'Daya' };

describe('the rename that reached a client', () => {
  it('uses the corrected profile name, not the signup snapshot', () => {
    expect(resolveClientFirstName(KIRTAN_PROFILE, KIRTAN_STALE_METADATA)).toBe('Kirtan');
    expect(resolveClientFullName(KIRTAN_PROFILE, KIRTAN_STALE_METADATA)).toBe('Kirtan Daya');
  });

  it('reads a flat profile, which carries no personalInformation at all', () => {
    expect('personalInformation' in KIRTAN_PROFILE).toBe(false);
    expect(resolveClientFirstName(KIRTAN_PROFILE, KIRTAN_STALE_METADATA)).toBe('Kirtan');
  });
});

describe('resolveClientFirstName', () => {
  it('prefers the flat root over the legacy nested block', () => {
    const profile = { firstName: 'Aaron', personalInformation: { firstName: 'Individual' } };
    expect(resolveClientFirstName(profile, {})).toBe('Aaron');
  });

  it('falls back to the nested block when there is no root name', () => {
    expect(resolveClientFirstName({ personalInformation: { firstName: 'Ann' } }, {})).toBe('Ann');
  });

  it('reads snake_case in either shape', () => {
    expect(resolveClientFirstName({ first_name: 'Ben' }, {})).toBe('Ben');
    expect(resolveClientFirstName({ personalInformation: { first_name: 'Cara' } }, {})).toBe(
      'Cara',
    );
  });

  it('falls back to auth metadata only when the profile holds no name', () => {
    expect(resolveClientFirstName({}, { firstName: 'Dee' })).toBe('Dee');
    expect(resolveClientFirstName(null, { firstName: 'Dee' })).toBe('Dee');
  });

  it('splits a single metadata display name as a last resort', () => {
    expect(resolveClientFirstName({}, { name: 'Erin van der Merwe' })).toBe('Erin');
  });

  it('ignores whitespace-only values rather than rendering a blank name', () => {
    expect(resolveClientFirstName({ firstName: '   ' }, { firstName: 'Fay' })).toBe('Fay');
  });

  it('returns the caller’s fallback when nothing is known', () => {
    expect(resolveClientFirstName({}, {}, 'Client')).toBe('Client');
    expect(resolveClientFirstName(undefined, undefined)).toBe('');
  });
});

describe('resolveClientLastName', () => {
  it('prefers the flat root over the nested block', () => {
    const profile = { lastName: 'Daya', personalInformation: { lastName: 'Smith' } };
    expect(resolveClientLastName(profile, {})).toBe('Daya');
  });

  it('accepts `surname`, the other spelling this codebase uses', () => {
    expect(resolveClientLastName({ surname: 'Bothma' }, {})).toBe('Bothma');
    expect(resolveClientLastName({ personalInformation: { surname: 'Bothma' } }, {})).toBe(
      'Bothma',
    );
  });

  it('reads the auth metadata spelling, which is `surname`', () => {
    expect(resolveClientLastName({}, { surname: 'Wood' })).toBe('Wood');
  });

  it('takes everything after the first space of a metadata display name', () => {
    expect(resolveClientLastName({}, { name: 'Erin van der Merwe' })).toBe('van der Merwe');
  });
});

describe('resolveClientFullName', () => {
  it('does not pad a half-known name with the fallback', () => {
    expect(resolveClientFullName({ firstName: 'Kirtan' }, {}, 'Valued Client')).toBe('Kirtan');
  });

  it('uses the fallback only when neither half is known', () => {
    expect(resolveClientFullName({}, {}, 'Valued Client')).toBe('Valued Client');
  });
});

describe('applyClientName', () => {
  it('writes the canonical flat root', () => {
    expect(applyClientName({}, { firstName: 'Kirtan', lastName: 'Daya' })).toEqual({
      firstName: 'Kirtan',
      lastName: 'Daya',
    });
  });

  it('updates an existing nested block so no reader sees a stale name', () => {
    const next = applyClientName(
      { personalInformation: { firstName: 'Liezl', lastName: 'Daya', idNumber: '123' } },
      { firstName: 'Kirtan' },
    );

    expect(next.firstName).toBe('Kirtan');
    expect(next.personalInformation).toEqual({
      firstName: 'Kirtan',
      lastName: 'Daya',
      idNumber: '123',
    });
  });

  it('keeps `surname` in step with `lastName` when the block carries both', () => {
    const next = applyClientName(
      { personalInformation: { lastName: 'Old', surname: 'Old' } },
      { lastName: 'Daya' },
    );

    expect(next.personalInformation).toEqual({ lastName: 'Daya', surname: 'Daya' });
  });

  it('never creates a nested block — that shape is being retired', () => {
    const next = applyClientName({ firstName: 'A' }, { firstName: 'B' });
    expect('personalInformation' in next).toBe(false);
  });

  it('does not blank a stored name when the update omits one', () => {
    const next = applyClientName({ firstName: 'Kirtan', lastName: 'Daya' }, { firstName: 'Kirt' });
    expect(next).toEqual({ firstName: 'Kirt', lastName: 'Daya' });
  });

  it('leaves the profile untouched when there is nothing to apply', () => {
    const profile = { firstName: 'Kirtan', personalInformation: { firstName: 'Liezl' } };
    expect(applyClientName(profile, {})).toEqual(profile);
  });

  it('does not mutate its input', () => {
    const profile = { personalInformation: { firstName: 'Liezl' } };
    applyClientName(profile, { firstName: 'Kirtan' });
    expect(profile).toEqual({ personalInformation: { firstName: 'Liezl' } });
  });
});
