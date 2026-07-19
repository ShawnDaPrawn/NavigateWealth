/**
 * Tests for the shared client-name resolver used by transactional emails.
 *
 * Run with: npx vitest run src/supabase/functions/server/__tests__/profile-name-resolver.test.ts
 *
 * @module server/__tests__/profile-name-resolver
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const kvStore = new Map<string, unknown>();
let getShouldThrow = false;

vi.mock('../kv_store.tsx', () => ({
  get: vi.fn((key: string) => {
    if (getShouldThrow) throw new Error('KV boom');
    const val = kvStore.get(key);
    return val ? JSON.parse(JSON.stringify(val)) : null;
  }),
}));

vi.mock('../stderr-logger.ts', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  }),
}));

import {
  extractFirstName,
  getProfileEmail,
  getProfileFirstName,
  getProfileFullName,
  resolveClientNamesByUserId,
} from '../profile-name-resolver.ts';

const profileKey = (userId: string) => `user_profile:${userId}:personal_info`;

beforeEach(() => {
  kvStore.clear();
  getShouldThrow = false;
  vi.clearAllMocks();
});

describe('extractFirstName', () => {
  it('derives a capitalised first token from the email local-part', () => {
    expect(extractFirstName('john.smith@example.com')).toBe('John');
    expect(extractFirstName('jane_doe@example.com')).toBe('Jane');
  });

  it('falls back to Subscriber when nothing usable remains', () => {
    expect(extractFirstName('12345@example.com')).toBe('Subscriber');
    expect(extractFirstName('')).toBe('Subscriber');
  });
});

describe('getProfileEmail / getProfileFirstName / getProfileFullName', () => {
  it('reads nested personalInformation and legacy fields', () => {
    const profile = {
      personalInformation: { email: 'Nested@Example.com', firstName: 'Nested', surname: 'Person' },
    };
    expect(getProfileEmail(profile)).toBe('nested@example.com');
    expect(getProfileFirstName(profile, 'fallback@example.com')).toBe('Nested');
    expect(getProfileFullName(profile, 'Nested')).toBe('Nested Person');
  });

  it('prefers preferredName when firstName missing', () => {
    const profile = { preferredName: 'Preferred' };
    expect(getProfileFirstName(profile, 'x@example.com')).toBe('Preferred');
  });
});

describe('resolveClientNamesByUserId', () => {
  it('uses live root profile names over the fallback snapshot', async () => {
    kvStore.set(profileKey('u1'), { firstName: 'Jonathan', lastName: 'Smyth' });
    const names = await resolveClientNamesByUserId('u1', {
      firstName: 'John',
      lastName: 'Smith',
      email: 'john@example.com',
    });
    expect(names).toEqual({ firstName: 'Jonathan', lastName: 'Smyth', fullName: 'Jonathan Smyth' });
  });

  it('reads nested personalInformation and legacy surname', async () => {
    kvStore.set(profileKey('u2'), {
      personalInformation: { firstName: 'Nested', surname: 'Legacy' },
    });
    const names = await resolveClientNamesByUserId('u2', { email: 'x@example.com' });
    expect(names).toEqual({ firstName: 'Nested', lastName: 'Legacy', fullName: 'Nested Legacy' });
  });

  it('uses preferredName as the first name when firstName is absent', async () => {
    kvStore.set(profileKey('u3'), { preferredName: 'Prefy', lastName: 'Last' });
    const names = await resolveClientNamesByUserId('u3', { email: 'x@example.com' });
    expect(names.firstName).toBe('Prefy');
    expect(names.fullName).toBe('Prefy Last');
  });

  it('falls back to the snapshot when no profile exists', async () => {
    const names = await resolveClientNamesByUserId('missing', {
      firstName: 'Snap',
      lastName: 'Shot',
      email: 'snap@example.com',
    });
    expect(names).toEqual({ firstName: 'Snap', lastName: 'Shot', fullName: 'Snap Shot' });
  });

  it('falls back to the email-derived name when profile and snapshot names are empty', async () => {
    const names = await resolveClientNamesByUserId(null, { email: 'grace.hopper@example.com' });
    expect(names.firstName).toBe('Grace');
    expect(names.lastName).toBe('');
    expect(names.fullName).toBe('Grace');
  });

  it("falls back to 'Client' when nothing is available", async () => {
    const names = await resolveClientNamesByUserId(undefined, {});
    expect(names).toEqual({ firstName: 'Client', lastName: '', fullName: 'Client' });
  });

  it('degrades to the fallback snapshot when the KV read throws', async () => {
    getShouldThrow = true;
    const names = await resolveClientNamesByUserId('u1', {
      firstName: 'Snap',
      lastName: 'Shot',
      email: 'snap@example.com',
    });
    expect(names).toEqual({ firstName: 'Snap', lastName: 'Shot', fullName: 'Snap Shot' });
  });
});
