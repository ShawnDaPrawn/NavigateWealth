import { describe, expect, it } from 'vitest';
import {
  employerRoleLabel,
  emptyOccupationalDuties,
  employersOccupationalDutiesError,
  hasOccupationalDuties,
  normalizeOccupationalDuties,
  occupationalDutiesError,
  occupationalDutiesLine,
  occupationalDutiesTotal,
  primaryEmployerId,
  withPrimaryEmployer,
} from '..';

describe('occupational duties', () => {
  it('normalises junk to whole percentages between 0 and 100', () => {
    expect(normalizeOccupationalDuties(undefined)).toEqual(emptyOccupationalDuties());
    expect(normalizeOccupationalDuties([1, 2])).toEqual(emptyOccupationalDuties());
    expect(
      normalizeOccupationalDuties({ admin: 59.6, travel: '20', supervision: -5, manual: 250 }),
    ).toEqual({ admin: 60, travel: 20, supervision: 0, manual: 100 });
  });

  it('allows an empty split or one that adds up to 100, and nothing in between', () => {
    expect(occupationalDutiesError(undefined)).toBeNull();
    expect(occupationalDutiesError(emptyOccupationalDuties())).toBeNull();
    expect(
      occupationalDutiesError({ admin: 70, travel: 20, supervision: 10, manual: 0 }),
    ).toBeNull();
    expect(occupationalDutiesError({ admin: 70, travel: 20, supervision: 0, manual: 0 })).toBe(
      'Occupational duties must add up to 100% (currently 90%)',
    );
    expect(occupationalDutiesError({ admin: 80, travel: 30, supervision: 0, manual: 0 })).toMatch(
      /110%/,
    );
  });

  it('totals and describes the recorded shares', () => {
    const d = { admin: 70, travel: 20, supervision: 10, manual: 0 };
    expect(occupationalDutiesTotal(d)).toBe(100);
    expect(hasOccupationalDuties(d)).toBe(true);
    expect(hasOccupationalDuties(undefined)).toBe(false);
    expect(occupationalDutiesLine(d)).toBe('Admin 70% · Travel 20% · Supervision 10%');
    expect(occupationalDutiesLine(undefined)).toBe('');
  });
});

describe('primary employer', () => {
  const a = { id: 'a' };
  const b = { id: 'b' };
  const c = { id: 'c' };

  it('is the flagged employer, else the first', () => {
    expect(primaryEmployerId(undefined)).toBeNull();
    expect(primaryEmployerId([])).toBeNull();
    expect(primaryEmployerId([a, b])).toBe('a');
    expect(primaryEmployerId([a, { ...b, isPrimary: true }])).toBe('b');
  });

  it('moves the chosen primary first and flags every other secondary', () => {
    const out = withPrimaryEmployer([a, b, c], 'c');
    expect(out.map((e) => e.id)).toEqual(['c', 'a', 'b']);
    expect(out.map((e) => e.isPrimary)).toEqual([true, false, false]);
  });

  it('keeps the current primary when none is chosen, e.g. after a delete', () => {
    const afterDelete = withPrimaryEmployer([
      { ...b, isPrimary: false },
      { ...c, isPrimary: false },
    ]);
    expect(afterDelete.map((e) => [e.id, e.isPrimary])).toEqual([
      ['b', true],
      ['c', false],
    ]);
    expect(withPrimaryEmployer([a, { ...b, isPrimary: true }]).map((e) => e.id)).toEqual([
      'b',
      'a',
    ]);
  });

  it('ignores an unknown id and leaves an empty list empty', () => {
    expect(withPrimaryEmployer([a, b], 'zzz').map((e) => e.id)).toEqual(['a', 'b']);
    expect(withPrimaryEmployer([])).toEqual([]);
  });

  it('labels the role', () => {
    expect(employerRoleLabel(true)).toBe('Primary');
    expect(employerRoleLabel(false)).toBe('Secondary');
  });
});

describe('employersOccupationalDutiesError', () => {
  it('names the first employer whose split does not add up to 100%', () => {
    expect(employersOccupationalDutiesError(undefined)).toBeNull();
    expect(
      employersOccupationalDutiesError([
        {
          employerName: 'Acme',
          occupationalDuties: { admin: 100, travel: 0, supervision: 0, manual: 0 },
        },
        { employerName: 'Old record' },
      ]),
    ).toBeNull();
    expect(
      employersOccupationalDutiesError([
        { employerName: 'Acme' },
        {
          employerName: ' Side Gig ',
          occupationalDuties: { admin: 70, travel: 0, supervision: 0, manual: 0 },
        },
      ]),
    ).toBe('Side Gig: Occupational duties must add up to 100% (currently 70%)');
    expect(
      employersOccupationalDutiesError([
        {
          employerName: '',
          occupationalDuties: { admin: 10, travel: 0, supervision: 0, manual: 0 },
        },
      ]),
    ).toMatch(/^An employer: /);
  });
});
