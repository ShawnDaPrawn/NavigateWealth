import { beforeEach, describe, expect, it, vi } from 'vitest';
import { brightRockAdapter } from '../../../../scripts/provider-adapters/brightrock.mjs';

function elementRect(left: number, top: number, width: number, height: number) {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

function setRect(testId: string, rect: DOMRect) {
  const el = document.querySelector(`[data-testid="${testId}"]`);
  if (!el) throw new Error(`Missing test element ${testId}`);
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(rect);
}

describe('brightRockAdapter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'location', {
      value: new URL('https://flint.brightrock.co.za/policy-details'),
      configurable: true,
    });
  });

  it('extracts BrightRock policy structure values from the visual cover grid', async () => {
    document.body.innerHTML = `
      <main>
        <h1>Policy details</h1>
        <button>Policy structure</button>
        <div>Policy number</div>
        <div>700056377</div>
        <section>
          <h2>Cover and premium as at:</h2>
          <div>Current monthly premium</div>
          <div>R 3,888.29</div>
        </section>
        <section>
          <h2>Cover summary</h2>
          <div data-testid="recover-header">That you can recover from</div>
          <div data-testid="permanent-header">That's permanent</div>
          <div data-testid="death-header">That's caused by death</div>
          <div data-testid="household-row">Cover for household, childcare, healthcare, debt and death-related needs</div>
          <div data-testid="recover-household">R 28,515 monthly</div>
          <div data-testid="permanent-household">R 2,851,522 lump-sum or R 0 monthly</div>
          <div data-testid="death-household">R 4,988,617 lump-sum or R 8,579 monthly</div>
          <div data-testid="additional-row">Additional expense needs</div>
          <div data-testid="recover-additional">R 2,851,522 lump-sum</div>
        </section>
      </main>
    `;

    setRect('recover-header', elementRect(350, 120, 210, 30));
    setRect('permanent-header', elementRect(565, 120, 210, 30));
    setRect('death-header', elementRect(780, 120, 210, 30));
    setRect('household-row', elementRect(60, 180, 280, 45));
    setRect('recover-household', elementRect(400, 185, 120, 24));
    setRect('permanent-household', elementRect(610, 185, 135, 24));
    setRect('death-household', elementRect(835, 185, 145, 24));
    setRect('additional-row', elementRect(60, 245, 280, 36));
    setRect('recover-additional', elementRect(410, 248, 120, 24));

    const snapshot = await brightRockAdapter.extractSnapshot(
      { url: () => 'https://flint.brightrock.co.za/policy-details' },
      { policyNumber: '700056377' },
      {
        evaluateWithNavigationRetry: async (_page: unknown, callback: (policyNumber: string) => unknown, policyNumber: string) =>
          callback(policyNumber),
      },
    );

    expect(snapshot).toMatchObject({
      policyNumber: '700056377',
      premium: 'R 3,888.29',
      temporaryIcb: 'R 28,515',
      disability: 'R 2,851,522',
      lifeCover: 'R 4,988,617',
      severeIllness: 'R 2,851,522',
      source: 'brightrock_policy_structure',
    });
  });

  it('fails closed when the page does not confirm the requested BrightRock policy details', async () => {
    document.body.innerHTML = `
      <main>
        <h1>Policy details</h1>
        <div>Policy number</div>
        <div>999999999</div>
        <section>
          <h2>Cover summary</h2>
          <div>Current monthly premium</div>
          <div>R 3,888.29</div>
        </section>
      </main>
    `;

    const snapshot = await brightRockAdapter.extractSnapshot(
      { url: () => 'https://flint.brightrock.co.za/policy-details' },
      { policyNumber: '700056377' },
      {
        evaluateWithNavigationRetry: async (_page: unknown, callback: (policyNumber: string) => unknown, policyNumber: string) =>
          callback(policyNumber),
      },
    );

    expect(snapshot).toMatchObject({
      policyNumber: '700056377',
      premium: '',
      lifeCover: '',
      disability: '',
      severeIllness: '',
      temporaryIcb: '',
      source: 'brightrock_policy_structure',
      diagnostics: {
        hasPolicyNumber: false,
        confirmedPolicyPage: false,
      },
    });
  });
});
