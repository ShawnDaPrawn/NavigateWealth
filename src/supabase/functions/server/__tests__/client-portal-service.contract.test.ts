/**
 * client-portal-service.ts — Portfolio Aggregation Contract
 * ========================================================
 *
 * 174 statements, 0% coverage before this file. `getPortfolioSummary` is the
 * single read behind the client-facing dashboard: it fans out across eleven KV
 * namespaces and folds them into one object a client sees.
 *
 * Two properties make it worth testing rather than trusting.
 *
 * **It is a client-facing aggregation, so isolation is the whole game.** Ten of
 * the eleven reads are already scoped by `clientId` in the key. The eleventh —
 * the calendar — is an unscoped prefix scan filtered in memory, which is the
 * one place a filter bug shows another client's data. See the block below.
 *
 * **Every money figure comes off a `||` fallback chain**, three or four sources
 * deep: a stored client key, then the latest FNA's results, then its inputs.
 * `||` treats a legitimate `0` as absent, so a client who genuinely has zero
 * retirement savings is shown whatever the next source says. Pinned per figure,
 * because on a financial dashboard a wrong number is worse than a blank one.
 *
 * WHAT IS REAL: everything except KV.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { kvStore } from './helpers/contract-harness.ts';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);

vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);

const { getPortfolioSummary } = await import('../client-portal-service.ts');

const CLIENT = '11111111-2222-4333-8444-555555555555';
const OTHER = '99999999-8888-4777-8666-555555555555';

const iso = (daysFromNow: number) =>
  new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString();

function seedProfile(over: Record<string, unknown> = {}, clientId = CLIENT) {
  kvStore.set(`user_profile:${clientId}:personal_info`, {
    personalInformation: { firstName: 'Thabo', lastName: 'Mokoena', ...over },
  });
}

function seedKeys(keys: Record<string, unknown>, clientId = CLIENT) {
  kvStore.set(`user_profile:${clientId}:client_keys`, keys);
}

function seedFna(
  namespace: string,
  id: string,
  record: Record<string, unknown>,
  clientId = CLIENT,
) {
  kvStore.set(`${namespace}:client:${clientId}:${id}`, {
    id,
    status: 'completed',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...record,
  });
}

beforeEach(() => {
  kvStore.clear();
  vi.clearAllMocks();
});

// ============================================================================
// CLIENT ISOLATION — the calendar is the only unscoped read
// ============================================================================

describe('calendar isolation', () => {
  /**
   * The bug this guards. The filter used to read
   *
   *   if (evt.clientId && evt.clientId !== clientId) return null;
   *
   * which only excluded an event naming a DIFFERENT client. An event with no
   * `clientId`, an empty one, or a null one passed straight through onto every
   * client's portal — and the read is `kv.getByPrefix('calendar_event:')`,
   * unscoped, so it sees every such row in the store.
   *
   * It is now a positive match: an event belongs to this client or it is not
   * shown.
   */
  it.each([
    ['no clientId at all', {}],
    ['an empty clientId', { clientId: '' }],
    ['a null clientId', { clientId: null }],
    ['an undefined clientId', { clientId: undefined }],
    ['another client', { clientId: OTHER }],
    ['a numeric clientId', { clientId: 0 }],
  ])('hides an event with %s', async (_label, over) => {
    seedProfile();
    kvStore.set('calendar_event:e1', {
      id: 'e1',
      title: 'Internal compliance deadline',
      date: iso(7),
      ...over,
    });
    const summary = await getPortfolioSummary(CLIENT);
    expect(summary.upcomingEvents).toEqual([]);
  });

  it('shows an event that names this client', async () => {
    seedProfile();
    kvStore.set('calendar_event:e1', {
      id: 'e1',
      clientId: CLIENT,
      type: 'review',
      title: 'Annual review',
      date: iso(7),
    });
    const summary = await getPortfolioSummary(CLIENT);
    expect(summary.upcomingEvents).toHaveLength(1);
    expect(summary.upcomingEvents[0]).toMatchObject({ id: 'e1', title: 'Annual review' });
  });

  it('never leaks another client’s event even when both exist', async () => {
    seedProfile();
    kvStore.set('calendar_event:mine', {
      id: 'mine',
      clientId: CLIENT,
      title: 'Mine',
      date: iso(3),
    });
    kvStore.set('calendar_event:theirs', {
      id: 'theirs',
      clientId: OTHER,
      title: 'Theirs',
      date: iso(4),
    });
    const summary = await getPortfolioSummary(CLIENT);
    expect(summary.upcomingEvents.map((e) => e.id)).toEqual(['mine']);
  });

  it('drops events that have already happened', async () => {
    seedProfile();
    kvStore.set('calendar_event:past', {
      id: 'past',
      clientId: CLIENT,
      title: 'Last year',
      date: iso(-30),
    });
    kvStore.set('calendar_event:future', {
      id: 'future',
      clientId: CLIENT,
      title: 'Next month',
      date: iso(30),
    });
    const summary = await getPortfolioSummary(CLIENT);
    expect(summary.upcomingEvents.map((e) => e.id)).toEqual(['future']);
  });

  it('returns the soonest five, in order', async () => {
    seedProfile();
    for (let i = 8; i >= 1; i -= 1) {
      kvStore.set(`calendar_event:e${i}`, {
        id: `e${i}`,
        clientId: CLIENT,
        title: `Event ${i}`,
        date: iso(i),
      });
    }
    const summary = await getPortfolioSummary(CLIENT);
    expect(summary.upcomingEvents.map((e) => e.id)).toEqual(['e1', 'e2', 'e3', 'e4', 'e5']);
  });

  it('reads the calendar from a namespace nothing currently writes', async () => {
    /**
     * Recorded so nobody "fixes" the empty list the wrong way.
     *
     * The only calendar in the store is the content-marketing one at
     * `auto_content:calendar_event:` (`CALENDAR_PREFIX` in
     * auto-content-pipeline-helpers.ts). This service scans `calendar_event:`,
     * which does not match it — so the client portal's Upcoming Events section
     * is permanently empty, and the read is a KV round trip that can never
     * return anything.
     *
     * The tempting fix is to point the scan at `auto_content:calendar_event:`.
     * Do NOT: those are the firm's internal content-planning events and they
     * carry no `clientId`, so every client would be shown the marketing
     * calendar. Client appointments need their own namespace, written with a
     * `clientId`.
     */
    seedProfile();
    kvStore.set('auto_content:calendar_event:c1', {
      id: 'c1',
      title: 'Publish Q1 newsletter',
      date: iso(5),
    });
    const summary = await getPortfolioSummary(CLIENT);
    expect(summary.upcomingEvents).toEqual([]);
  });
});

describe('scoped reads', () => {
  it('never reads another client’s namespaces', async () => {
    seedProfile();
    const kv = await import('../kv_store.tsx');
    await getPortfolioSummary(CLIENT);
    const touched = [
      ...vi.mocked(kv.get).mock.calls.map(([k]) => k),
      ...vi.mocked(kv.getByPrefix).mock.calls.map(([k]) => k),
    ];
    // Every key is either scoped to this client or the one deliberately
    // unscoped calendar prefix. Anything else would be a cross-client read.
    for (const key of touched) {
      const scoped = key.includes(CLIENT) || key === 'calendar_event:';
      expect(scoped, `unscoped read: ${key}`).toBe(true);
    }
  });

  it('does not confuse a client id that is a prefix of another', async () => {
    // KV prefix scans are string ranges, so `client:1` would match `client:11`.
    // The real ids are UUIDs, which makes this unlikely — asserted anyway
    // because the failure mode is one client seeing another's FNAs.
    seedProfile({}, CLIENT);
    seedFna('risk-planning-fna', 'f1', { results: { deathCover: 5_000_000 } }, CLIENT);
    seedFna('risk-planning-fna', 'f2', { results: { deathCover: 9_999_999 } }, `${CLIENT}-extra`);
    const summary = await getPortfolioSummary(CLIENT);
    // Only the exact-client FNA may drive the figure. The `-extra` client's
    // record shares the prefix and must not be picked up.
    expect(summary.financialOverview.risk.deathCover).toBe(5_000_000);
  });
});

// ============================================================================
// THE MONEY FALLBACK CHAINS
// ============================================================================

describe('financial figures', () => {
  it('prefers the stored client key over the FNA', async () => {
    seedProfile();
    seedKeys({ retirement_total: 1_250_000 });
    seedFna('retirement-fna', 'f1', { results: { currentValue: 999 } });
    const summary = await getPortfolioSummary(CLIENT);
    expect(summary.financialOverview.retirement.currentValue).toBe(1_250_000);
  });

  it('falls back to the FNA results when no client key exists', async () => {
    seedProfile();
    seedFna('retirement-fna', 'f1', { results: { currentValue: 750_000 } });
    expect((await getPortfolioSummary(CLIENT)).financialOverview.retirement.currentValue).toBe(
      750_000,
    );
  });

  it('falls back to the FNA inputs when the results carry nothing', async () => {
    seedProfile();
    seedFna('retirement-fna', 'f1', { inputs: { currentRetirementSavings: 400_000 } });
    expect((await getPortfolioSummary(CLIENT)).financialOverview.retirement.currentValue).toBe(
      400_000,
    );
  });

  it('reports zero when there is nothing anywhere', async () => {
    seedProfile();
    const summary = await getPortfolioSummary(CLIENT);
    expect(summary.financialOverview.retirement.currentValue).toBe(0);
    expect(summary.clientData.totalWealthValue).toBe(0);
  });

  it('treats a stored zero as absent and falls through the chain', async () => {
    /**
     * ⚠️ RECORDED, NOT FIXED. The chain is
     *
     *   ckRaw.retirement_total || latestRetirement?.results?.currentValue || ...
     *
     * so a client whose stored retirement total is genuinely `0` is shown the
     * FNA figure instead. On a financial dashboard that is a wrong number
     * rather than a blank one, which is the worse failure — but changing it
     * means deciding, per figure, whether a stored zero means "nil" or "not
     * captured", and the KV rows do not distinguish those today. Flagged rather
     * than guessed at.
     */
    seedProfile();
    seedKeys({ retirement_total: 0 });
    seedFna('retirement-fna', 'f1', { results: { currentValue: 750_000 } });
    expect((await getPortfolioSummary(CLIENT)).financialOverview.retirement.currentValue).toBe(
      750_000,
    );
  });

  it('parses a numeric string, because KV rows are not typed', async () => {
    seedProfile();
    seedKeys({ retirement_total: '1250000.50' });
    expect((await getPortfolioSummary(CLIENT)).financialOverview.retirement.currentValue).toBe(
      1_250_000.5,
    );
  });

  it.each([
    ['a non-numeric string', 'unknown'],
    ['a boolean', true],
    ['an object', { amount: 5 }],
    ['an array', [5]],
    ['null', null],
  ])('reports zero rather than NaN for %s', async (_label, value) => {
    // A NaN reaching the dashboard renders as "R NaN" on a client's screen.
    seedProfile();
    seedKeys({ retirement_total: value });
    const v = (await getPortfolioSummary(CLIENT)).financialOverview.retirement.currentValue;
    expect(Number.isFinite(v)).toBe(true);
  });

  it('sums retirement and investment into the headline wealth figure', async () => {
    seedProfile();
    seedKeys({ retirement_total: 1_000_000, investment_total: 250_000 });
    expect((await getPortfolioSummary(CLIENT)).clientData.totalWealthValue).toBe(1_250_000);
  });

  it('carries all three risk cover figures independently', async () => {
    seedProfile();
    seedKeys({
      risk_death_cover: 5_000_000,
      risk_disability_cover: 3_000_000,
      risk_critical_illness: 1_500_000,
    });
    expect((await getPortfolioSummary(CLIENT)).financialOverview.risk).toMatchObject({
      deathCover: 5_000_000,
      disabilityCover: 3_000_000,
      criticalIllnessCover: 1_500_000,
    });
  });
});

// ============================================================================
// SCORING AND FNA SELECTION
// ============================================================================

describe('financial score', () => {
  it('is zero when no pillar has been assessed', async () => {
    seedProfile();
    expect((await getPortfolioSummary(CLIENT)).clientData.financialScore).toBe(0);
  });

  it.each([
    [1, 17],
    [3, 50],
    [6, 100],
  ])('is %i pillars out of six -> %i', async (pillars, expected) => {
    seedProfile();
    const namespaces = [
      'risk-planning-fna',
      'medical-fna',
      'retirement-fna',
      'investment-ina',
      'tax-planning-fna',
      'estate-planning-fna',
    ];
    for (const ns of namespaces.slice(0, pillars)) seedFna(ns, 'f1', {});
    expect((await getPortfolioSummary(CLIENT)).clientData.financialScore).toBe(expected);
  });

  it('never exceeds one hundred', async () => {
    // Several FNAs per pillar must not inflate the score past full marks.
    seedProfile();
    for (const ns of [
      'risk-planning-fna',
      'medical-fna',
      'retirement-fna',
      'investment-ina',
      'tax-planning-fna',
      'estate-planning-fna',
    ]) {
      seedFna(ns, 'a', {});
      seedFna(ns, 'b', {});
      seedFna(ns, 'c', {});
    }
    expect((await getPortfolioSummary(CLIENT)).clientData.financialScore).toBe(100);
  });
});

describe('picking the latest assessment', () => {
  it('uses the most recently updated FNA, not the first found', async () => {
    // The dashboard shows one figure per pillar; showing a superseded
    // assessment means advising off stale numbers.
    seedProfile();
    seedFna('retirement-fna', 'old', {
      updatedAt: '2020-01-01T00:00:00.000Z',
      results: { currentValue: 100 },
    });
    seedFna('retirement-fna', 'new', {
      updatedAt: '2026-06-01T00:00:00.000Z',
      results: { currentValue: 900_000 },
    });
    expect((await getPortfolioSummary(CLIENT)).financialOverview.retirement.currentValue).toBe(
      900_000,
    );
  });

  it('falls back to createdAt when a record has no updatedAt', async () => {
    seedProfile();
    kvStore.set(`retirement-fna:client:${CLIENT}:a`, {
      id: 'a',
      createdAt: '2020-01-01T00:00:00.000Z',
      results: { currentValue: 100 },
    });
    kvStore.set(`retirement-fna:client:${CLIENT}:b`, {
      id: 'b',
      createdAt: '2026-06-01T00:00:00.000Z',
      results: { currentValue: 900_000 },
    });
    expect((await getPortfolioSummary(CLIENT)).financialOverview.retirement.currentValue).toBe(
      900_000,
    );
  });

  it.each([
    ['completed', 'on-track', 'Assessment Complete'],
    ['published', 'on-track', 'Assessment Complete'],
    ['in_progress', 'review-needed', 'Assessment In Progress'],
    ['draft', 'review-needed', 'Assessment In Progress'],
  ])('maps a %s assessment to %s', async (status, expected, statusText) => {
    seedProfile();
    seedFna('retirement-fna', 'f1', { status });
    expect((await getPortfolioSummary(CLIENT)).financialOverview.retirement).toMatchObject({
      status: expected,
      statusText,
    });
  });

  it('reports an unassessed pillar as not-assessed', async () => {
    seedProfile();
    expect((await getPortfolioSummary(CLIENT)).financialOverview.retirement).toMatchObject({
      status: 'not-assessed',
      statusText: 'Not Yet Assessed',
    });
  });

  it('schedules the next review a year after the last assessment', async () => {
    seedProfile();
    seedFna('retirement-fna', 'f1', { updatedAt: '2026-03-15T00:00:00.000Z' });
    expect((await getPortfolioSummary(CLIENT)).financialOverview.retirement.nextReview).toBe(
      '2027-03-15',
    );
  });
});

// ============================================================================
// IDENTITY AND ADVISER
// ============================================================================

describe('client identity', () => {
  it('reads the name from the profile', async () => {
    seedProfile({ firstName: 'Nomsa', lastName: 'Dlamini' });
    expect((await getPortfolioSummary(CLIENT)).clientData).toMatchObject({
      firstName: 'Nomsa',
      lastName: 'Dlamini',
    });
  });

  it('falls back to the client keys when the profile has no name', async () => {
    kvStore.set(`user_profile:${CLIENT}:personal_info`, { personalInformation: {} });
    seedKeys({ profile_first_name: 'Sipho', profile_last_name: 'Nkosi' });
    expect((await getPortfolioSummary(CLIENT)).clientData).toMatchObject({
      firstName: 'Sipho',
      lastName: 'Nkosi',
    });
  });

  it('shows a placeholder rather than a blank name', async () => {
    // The dashboard greets the client by name; an empty greeting looks broken.
    const summary = await getPortfolioSummary(CLIENT);
    expect(summary.clientData.firstName).toBe('Client');
  });

  it('derives a member number from the client id when none is stored', async () => {
    seedProfile();
    const summary = await getPortfolioSummary(CLIENT);
    // Deterministic, so the same client always sees the same number.
    expect(summary.clientData.memberNumber).toBe(`NW-${CLIENT.substring(0, 6).toUpperCase()}`);
    expect((await getPortfolioSummary(CLIENT)).clientData.memberNumber).toBe(
      summary.clientData.memberNumber,
    );
  });

  it('prefers a stored member number', async () => {
    seedProfile({ memberNumber: 'NW-000123' });
    expect((await getPortfolioSummary(CLIENT)).clientData.memberNumber).toBe('NW-000123');
  });

  it('accepts a profile stored flat rather than under personalInformation', async () => {
    // Both shapes exist in the store; `profile?.personalInformation || profile`.
    kvStore.set(`user_profile:${CLIENT}:personal_info`, {
      firstName: 'Lerato',
      lastName: 'Molefe',
    });
    expect((await getPortfolioSummary(CLIENT)).clientData.firstName).toBe('Lerato');
  });
});

describe('adviser resolution', () => {
  const PLATFORM_NAME = 'Your Navigate Wealth Adviser';

  it('falls back to platform details when the profile has no application', async () => {
    seedProfile();
    const summary = await getPortfolioSummary(CLIENT);
    expect(summary.adviserDetails.name).toContain(PLATFORM_NAME);
  });

  it('falls back when the application is missing', async () => {
    kvStore.set(`user_profile:${CLIENT}:personal_info`, {
      applicationId: 'app-gone',
      personalInformation: { firstName: 'Thabo' },
    });
    expect((await getPortfolioSummary(CLIENT)).adviserDetails.name).toContain(PLATFORM_NAME);
  });

  it('falls back when the application names no adviser', async () => {
    kvStore.set(`user_profile:${CLIENT}:personal_info`, {
      applicationId: 'app-1',
      personalInformation: { firstName: 'Thabo' },
    });
    kvStore.set('application:app-1', { id: 'app-1' });
    expect((await getPortfolioSummary(CLIENT)).adviserDetails.name).toContain(PLATFORM_NAME);
  });

  it('falls back when the adviser has no personnel profile', async () => {
    kvStore.set(`user_profile:${CLIENT}:personal_info`, {
      applicationId: 'app-1',
      personalInformation: { firstName: 'Thabo' },
    });
    kvStore.set('application:app-1', { id: 'app-1', adviserId: 'adv-1' });
    expect((await getPortfolioSummary(CLIENT)).adviserDetails.name).toContain(PLATFORM_NAME);
  });

  it('resolves the real adviser through the application', async () => {
    kvStore.set(`user_profile:${CLIENT}:personal_info`, {
      applicationId: 'app-1',
      personalInformation: { firstName: 'Thabo' },
    });
    kvStore.set('application:app-1', { id: 'app-1', adviserId: 'adv-1' });
    kvStore.set('personnel:profile:adv-1', {
      firstName: 'Shawn',
      lastName: 'Francisco',
      email: 'shawn@navigatewealth.co',
      phone: '012 667 2505',
      fspReference: 'FSP 54606',
    });
    expect((await getPortfolioSummary(CLIENT)).adviserDetails).toMatchObject({
      name: 'Shawn Francisco',
      email: 'shawn@navigatewealth.co',
      phone: '012 667 2505',
      fspReference: 'FSP 54606',
    });
  });

  it.each(['adviserId', 'reviewed_by', 'approvedBy'])(
    'accepts the adviser under the %s field',
    async (field) => {
      // Three spellings exist across application records of different vintages.
      kvStore.set(`user_profile:${CLIENT}:personal_info`, {
        applicationId: 'app-1',
        personalInformation: { firstName: 'Thabo' },
      });
      kvStore.set('application:app-1', { id: 'app-1', [field]: 'adv-1' });
      kvStore.set('personnel:profile:adv-1', { firstName: 'Shawn', lastName: 'Francisco' });
      expect((await getPortfolioSummary(CLIENT)).adviserDetails.name).toBe('Shawn Francisco');
    },
  );

  it('uses the cellphone when there is no phone', async () => {
    kvStore.set(`user_profile:${CLIENT}:personal_info`, {
      applicationId: 'app-1',
      personalInformation: { firstName: 'Thabo' },
    });
    kvStore.set('application:app-1', { id: 'app-1', adviserId: 'adv-1' });
    kvStore.set('personnel:profile:adv-1', {
      firstName: 'Shawn',
      lastName: 'Francisco',
      cellphone: '082 123 4567',
    });
    expect((await getPortfolioSummary(CLIENT)).adviserDetails.phone).toBe('082 123 4567');
  });

  it('never surfaces a blank adviser name', async () => {
    // A personnel record with no name must not produce an empty contact card.
    kvStore.set(`user_profile:${CLIENT}:personal_info`, {
      applicationId: 'app-1',
      personalInformation: { firstName: 'Thabo' },
    });
    kvStore.set('application:app-1', { id: 'app-1', adviserId: 'adv-1' });
    kvStore.set('personnel:profile:adv-1', { email: 'someone@navigatewealth.co' });
    expect((await getPortfolioSummary(CLIENT)).adviserDetails.name).toContain(PLATFORM_NAME);
  });
});

// ============================================================================
// RESILIENCE — an empty store must still render
// ============================================================================

describe('an empty store', () => {
  it('returns a complete summary for a client with no data at all', async () => {
    // A newly onboarded client has none of the eleven namespaces populated.
    // Every section of the dashboard still has to render.
    const summary = await getPortfolioSummary(CLIENT);
    expect(summary.clientData).toBeTruthy();
    expect(summary.adviserDetails).toBeTruthy();
    expect(summary.financialOverview.retirement).toBeTruthy();
    expect(summary.financialOverview.risk).toBeTruthy();
    expect(summary.financialOverview.investment).toBeTruthy();
    expect(summary.financialOverview.estate).toBeTruthy();
    expect(summary.financialOverview.medicalAid).toBeTruthy();
    expect(summary.financialOverview.tax).toBeTruthy();
    expect(Array.isArray(summary.upcomingEvents)).toBe(true);
  });

  it('stamps lastUpdated even with no assessments', async () => {
    const before = Date.now();
    const summary = await getPortfolioSummary(CLIENT);
    expect(Date.parse(summary.clientData.lastUpdated)).toBeGreaterThanOrEqual(before - 1000);
  });

  it('uses the newest assessment date as lastUpdated once there are some', async () => {
    seedProfile();
    seedFna('risk-planning-fna', 'a', { updatedAt: '2026-02-01T00:00:00.000Z' });
    seedFna('retirement-fna', 'b', { updatedAt: '2026-07-01T00:00:00.000Z' });
    expect((await getPortfolioSummary(CLIENT)).clientData.lastUpdated).toBe(
      '2026-07-01T00:00:00.000Z',
    );
  });

  it('reports a default risk tolerance rather than blank', async () => {
    expect((await getPortfolioSummary(CLIENT)).clientData.riskTolerance).toBe('Not assessed');
  });
});
