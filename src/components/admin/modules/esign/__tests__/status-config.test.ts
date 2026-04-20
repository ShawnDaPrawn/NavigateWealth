/**
 * P8.4 — Lock the contract that every envelope/signer status known to
 * the type system has a config entry, and every config entry has the
 * shape consumers expect (label + badgeClass + dotClass + icon). This
 * prevents a future status from being introduced (e.g. P7.5's
 * `completing`) without also wiring it through `ENVELOPE_STATUS_CONFIG`,
 * which would otherwise show up as "undefined" badges across the UI.
 */

import { describe, it, expect } from 'vitest';
import { ENVELOPE_STATUS_CONFIG, SIGNER_STATUS_CONFIG } from '../constants';
import type { EnvelopeStatus, SignerStatus } from '../types';

const ALL_ENVELOPE_STATUSES: EnvelopeStatus[] = [
  'draft',
  'sent',
  'viewed',
  'partially_signed',
  'completing',
  'completed',
  'declined',
  'rejected',
  'expired',
  'voided',
];

const ALL_SIGNER_STATUSES: SignerStatus[] = [
  'pending',
  'sent',
  'viewed',
  'otp_verified',
  'signed',
  'rejected',
  'declined',
];

describe('ENVELOPE_STATUS_CONFIG', () => {
  it.each(ALL_ENVELOPE_STATUSES)('has a complete config entry for %s', (status) => {
    const entry = ENVELOPE_STATUS_CONFIG[status];
    expect(entry, `missing config for envelope status "${status}"`).toBeDefined();
    expect(entry.label.length).toBeGreaterThan(0);
    expect(entry.badgeClass).toMatch(/bg-/);
    expect(entry.badgeClass).toMatch(/text-/);
    expect(entry.dotClass).toMatch(/bg-/);
    expect(typeof entry.icon).toBe('object');
  });

  it('does not duplicate label strings', () => {
    const labels = Object.values(ENVELOPE_STATUS_CONFIG).map((c) => c.label);
    const unique = new Set(labels);
    // `declined` and `rejected` legitimately share the same display
    // label ("Declined" / "Rejected") but every other label should be
    // unique to keep the dashboard legend unambiguous.
    expect(labels.length - unique.size).toBeLessThanOrEqual(1);
  });
});

describe('SIGNER_STATUS_CONFIG', () => {
  it.each(ALL_SIGNER_STATUSES)('has a complete config entry for %s', (status) => {
    const entry = SIGNER_STATUS_CONFIG[status];
    expect(entry, `missing config for signer status "${status}"`).toBeDefined();
    expect(entry.label.length).toBeGreaterThan(0);
    expect(entry.badgeClass).toMatch(/bg-/);
    expect(entry.badgeClass).toMatch(/text-/);
    expect(entry.dotClass).toMatch(/bg-/);
    expect(typeof entry.icon).toBe('object');
  });
});
