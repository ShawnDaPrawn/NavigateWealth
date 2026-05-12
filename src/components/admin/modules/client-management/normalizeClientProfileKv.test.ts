import { describe, it, expect } from 'vitest';
import { normalizeClientProfileKv } from './normalizeClientProfileKv';

describe('normalizeClientProfileKv', () => {
  it('prefers flat root first/last names over stale nested personalInformation', () => {
    const normalized = normalizeClientProfileKv({
      firstName: 'Aaron',
      lastName: 'Teng',
      email: 'a@example.com',
      personalInformation: {
        firstName: 'Individual',
        lastName: 'Teng',
      },
    });
    expect(normalized?.personalInformation?.firstName).toBe('Aaron');
    expect(normalized?.personalInformation?.lastName).toBe('Teng');
    expect(normalized?.personalInformation?.email).toBe('a@example.com');
  });

  it('wraps wholly flat blobs', () => {
    const normalized = normalizeClientProfileKv({ firstName: 'Sam', lastName: 'Jones' });
    expect(normalized?.personalInformation?.firstName).toBe('Sam');
  });
});
