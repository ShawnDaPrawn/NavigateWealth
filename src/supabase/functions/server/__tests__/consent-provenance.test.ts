/**
 * Consent provenance survives approval
 * ====================================
 *
 * On 2026-09-02, 179 client profiles had `communicationConsent` backfilled
 * administratively (docs/compliance/marketing-consent-backfill-2026-09-02.md).
 * Those rows carry `communicationConsentSource: 'admin_backfill'` so a
 * backfilled `true` is never mistaken for a client-supplied tick, and so the
 * documented rollback can find exactly the rows the backfill wrote.
 *
 * That marker is fragile in one specific place. Approving a client runs
 * `buildClientProfileFromApplication`, which REBUILDS `_applicationMeta` from a
 * fixed field list, and `mergeProfileOnApproval` then assigns that object over
 * the profile's metadata wholesale rather than merging into it. Any field not
 * named in the builder is dropped at that moment — silently, and precisely when
 * the record becomes a formal approved client record.
 *
 * These tests pin the two halves: provenance is carried for a backfilled
 * application, and absent for one a client filled in themselves.
 */
import { describe, it, expect } from 'vitest';
import { buildClientProfileFromApplication } from '../application-utils.ts';
import type { ApplicationData } from '../types.ts';

function appData(over: Partial<ApplicationData> = {}): ApplicationData {
  return {
    firstName: 'Thabo',
    lastName: 'Mokoena',
    email: 'thabo@example.com',
    ...over,
  } as ApplicationData;
}

describe('backfilled consent', () => {
  it('carries the source marker into the rebuilt _applicationMeta', () => {
    const profile = buildClientProfileFromApplication(
      appData({
        communicationConsent: true,
        communicationConsentSource: 'admin_backfill',
        communicationConsentBackfilledAt: '2026-09-02',
      }),
    );

    const meta = profile._applicationMeta as Record<string, unknown>;
    expect(meta.communicationConsent).toBe(true);
    expect(meta.communicationConsentSource).toBe('admin_backfill');
    expect(meta.communicationConsentBackfilledAt).toBe('2026-09-02');
  });

  it('keeps a backfilled true distinguishable from a client tick after approval', () => {
    const backfilled = buildClientProfileFromApplication(
      appData({ communicationConsent: true, communicationConsentSource: 'admin_backfill' }),
    );
    const clientTicked = buildClientProfileFromApplication(appData({ communicationConsent: true }));

    const a = backfilled._applicationMeta as Record<string, unknown>;
    const b = clientTicked._applicationMeta as Record<string, unknown>;

    // Both consented; only one of them was asked.
    expect(a.communicationConsent).toBe(true);
    expect(b.communicationConsent).toBe(true);
    expect(a.communicationConsentSource).toBe('admin_backfill');
    expect(b.communicationConsentSource).toBeUndefined();
  });
});

describe('genuine self-service consent', () => {
  it('records no provenance for a client who ticked the box', () => {
    const profile = buildClientProfileFromApplication(appData({ communicationConsent: true }));
    const meta = profile._applicationMeta as Record<string, unknown>;

    expect(meta.communicationConsent).toBe(true);
    expect('communicationConsentSource' in meta).toBe(false);
    expect('communicationConsentBackfilledAt' in meta).toBe(false);
  });

  it('records no provenance for a client who declined', () => {
    const profile = buildClientProfileFromApplication(appData({ communicationConsent: false }));
    const meta = profile._applicationMeta as Record<string, unknown>;

    expect(meta.communicationConsent).toBe(false);
    expect('communicationConsentSource' in meta).toBe(false);
  });
});
