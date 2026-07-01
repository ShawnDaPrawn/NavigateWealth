/**
 * Tests that application lifecycle emails use the current client name (resolved
 * from the profile at send time) via the extract*EmailData override params,
 * while preserving the application-snapshot fallback.
 *
 * Run with: npx vitest run src/supabase/functions/server/__tests__/applications-email-names.test.ts
 *
 * @module server/__tests__/applications-email-names
 */

import { describe, it, expect } from 'vitest';

import {
  extractApprovalEmailData,
  extractDeclineEmailData,
  extractAdminNotificationData,
} from '../application-utils.ts';

const appData = { firstName: 'John', lastName: 'Smith', cellphoneNumber: '555' } as never;

describe('extractApprovalEmailData', () => {
  it('uses the override name (live profile) when provided', () => {
    const data = extractApprovalEmailData('c@example.com', appData, 'APP-1', 'Jonathan Smyth');
    expect(data.clientName).toBe('Jonathan Smyth');
  });

  it('falls back to the application snapshot when no override is given', () => {
    const data = extractApprovalEmailData('c@example.com', appData, 'APP-1');
    expect(data.clientName).toBe('John Smith');
  });

  it('ignores a blank override and uses the snapshot', () => {
    const data = extractApprovalEmailData('c@example.com', appData, 'APP-1', '   ');
    expect(data.clientName).toBe('John Smith');
  });
});

describe('extractDeclineEmailData', () => {
  it('uses the override name when provided', () => {
    const data = extractDeclineEmailData('c@example.com', appData, 'reason', 'APP-1', 'Jane Doe');
    expect(data.clientName).toBe('Jane Doe');
  });

  it('falls back to the snapshot otherwise', () => {
    const data = extractDeclineEmailData('c@example.com', appData, 'reason', 'APP-1');
    expect(data.clientName).toBe('John Smith');
  });
});

describe('extractAdminNotificationData', () => {
  it('uses override names when provided', () => {
    const data = extractAdminNotificationData('c@example.com', appData, 'APP-1', 'admin', {
      firstName: 'Jonathan',
      lastName: 'Smyth',
      fullName: 'Jonathan Smyth',
    });
    expect(data.clientName).toBe('Jonathan Smyth');
    expect(data.firstName).toBe('Jonathan');
    expect(data.lastName).toBe('Smyth');
  });

  it('falls back to the application snapshot without an override', () => {
    const data = extractAdminNotificationData('c@example.com', appData, 'APP-1', 'admin');
    expect(data.clientName).toBe('John Smith');
    expect(data.firstName).toBe('John');
    expect(data.lastName).toBe('Smith');
  });
});
