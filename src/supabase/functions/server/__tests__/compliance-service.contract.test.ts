/**
 * compliance-service.ts — Regulatory Record Contract
 * ==================================================
 *
 * 244 statements, 0% coverage before this file, holding the firm's FAIS, AML,
 * POPIA and FSCA-debarment records. These are not application data: they are
 * what the firm shows a regulator, so the properties worth pinning are the ones
 * a regulator would ask about.
 *
 *   - **POPIA withdrawal marks, it does not delete.** `withdrawPOPIAConsent`
 *     sets `consented: false` and stamps `withdrawn_date` on the existing
 *     record rather than removing it. That is the POPIA-correct shape — the
 *     firm must be able to show both that consent was given and that it was
 *     withdrawn, and a delete destroys the first half. It also has to sweep
 *     EVERY consent the user holds, not just the newest.
 *   - **The dashboard counts are the compliance position.** `getComplianceSummary`
 *     derives "active", "expired", "recent" and "withdrawn" from the records,
 *     and a miscount is a misstatement. The recency windows are regulatory
 *     review cycles — six months for AML, three for debarment — so they are
 *     asserted at the boundary rather than sampled.
 *   - **Newest-first ordering** on every list. The compliance screens show the
 *     latest check; a sort that silently reversed would show a stale "clear"
 *     next to a current record.
 *
 * ⚠️ TWO CHECKS THAT DO NOT CHECK ANYTHING
 * ----------------------------------------
 * `performAMLCheck` and `performDebarmentCheck` screen nobody — there is no
 * AML provider wired up and the FSCA debarment register is never consulted.
 * Both are reachable from `compliance-core-routes.ts`.
 *
 * What changed: they used to write `status: 'clear'` (plus `risk_level: 'low'`
 * for AML) with notes reading "Automated AML check completed" and "No match
 * found on FSCA debarment list" — assertions about screenings that never ran,
 * in records that said nothing about being placeholders. They now record
 * `pending` / `unknown` and say plainly that the check is outstanding.
 *
 * The tests below pin the honest shape, and pin that the identity fields are
 * STILL captured — those are what a real integration will screen on, so the
 * record stays useful as a queued check. Choosing and wiring a provider remains
 * a business decision; not lying in the meantime is not.
 *
 * WHAT IS REAL: everything except KV and the logger.
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

const { ComplianceService } = await import('../compliance-service.ts');

const service = new ComplianceService();

const CLIENT = 'client-1';
const ADVISER = 'adviser-1';
const ADMIN = 'admin-1';

/** An ISO timestamp `days` before now. */
const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

function seedFais(id: string, over: Record<string, unknown> = {}) {
  kvStore.set(`compliance_fais:${id}`, {
    id,
    adviser_id: ADVISER,
    fsp_number: 'FSP12345',
    fsp_name: 'Navigate Wealth',
    category: 'Category I',
    license_valid_until: '2027-06-30',
    status: 'active',
    created_at: daysAgo(30),
    updated_at: daysAgo(30),
    ...over,
  });
}

function seedAml(id: string, over: Record<string, unknown> = {}) {
  kvStore.set(`compliance_aml:${id}`, {
    id,
    client_id: CLIENT,
    check_type: 'kyc',
    status: 'clear',
    risk_level: 'low',
    checked_at: daysAgo(10),
    checked_by: ADMIN,
    ...over,
  });
}

function seedPopia(id: string, over: Record<string, unknown> = {}) {
  kvStore.set(`compliance_popia:${id}`, {
    id,
    user_id: CLIENT,
    consent_type: 'general',
    consented: true,
    consent_date: daysAgo(60),
    ...over,
  });
}

function seedDebarment(id: string, over: Record<string, unknown> = {}) {
  kvStore.set(`compliance_debarment:${id}`, {
    id,
    adviser_id: ADVISER,
    name: 'Thabo Mokoena',
    id_number: '9001015800088',
    status: 'clear',
    checked_at: daysAgo(10),
    checked_by: ADMIN,
    ...over,
  });
}

beforeEach(() => {
  kvStore.clear();
  vi.clearAllMocks();
});

// ============================================================================
// POPIA — consent history is the record, so withdrawal must not erase it
// ============================================================================

describe('POPIA consent', () => {
  it('records a consent as given, with the moment it was given', async () => {
    const consent = await service.recordPOPIAConsent(CLIENT, {
      consent_type: 'marketing',
      ip_address: '196.25.1.7',
      user_agent: 'Mozilla/5.0',
    });
    expect(consent).toMatchObject({
      user_id: CLIENT,
      consent_type: 'marketing',
      consented: true,
      ip_address: '196.25.1.7',
    });
    expect(Date.parse(consent.consent_date)).not.toBeNaN();
    expect(kvStore.get(`compliance_popia:${consent.id}`)).toMatchObject({ consented: true });
  });

  it('defaults an unnamed consent to general rather than dropping the type', async () => {
    const consent = await service.recordPOPIAConsent(CLIENT, {});
    expect(consent.consent_type).toBe('general');
  });

  it('marks a withdrawal instead of deleting the record', async () => {
    // POPIA requires the firm to show BOTH that consent was given and that it
    // was withdrawn. Deleting the row destroys the first half, and the deletion
    // itself leaves no trace — so this is the assertion that matters most in
    // the file.
    const givenAt = daysAgo(60);
    seedPopia('c1', { consent_date: givenAt });
    await service.withdrawPOPIAConsent(CLIENT);
    const stored = kvStore.get('compliance_popia:c1') as Record<string, unknown>;
    expect(stored).toBeTruthy();
    expect(stored.consented).toBe(false);
    // The original consent moment survives untouched — that is the half a
    // delete would destroy.
    expect(stored.consent_date).toBe(givenAt);
    expect(Date.parse(stored.withdrawn_date as string)).not.toBeNaN();
    expect(Date.parse(stored.withdrawn_date as string)).toBeGreaterThan(Date.parse(givenAt));
  });

  it('withdraws every consent the user holds, not just the newest', async () => {
    // A client who consented to marketing, data processing and third-party
    // sharing has three records. Withdrawing one and leaving two is a POPIA
    // breach that looks like a success from the caller's side.
    seedPopia('c1', { consent_type: 'marketing' });
    seedPopia('c2', { consent_type: 'processing' });
    seedPopia('c3', { consent_type: 'third_party' });
    await service.withdrawPOPIAConsent(CLIENT);
    for (const id of ['c1', 'c2', 'c3']) {
      expect(kvStore.get(`compliance_popia:${id}`)).toMatchObject({ consented: false });
    }
  });

  it('leaves other users consents untouched', async () => {
    seedPopia('mine', { user_id: CLIENT });
    seedPopia('theirs', { user_id: 'client-2' });
    await service.withdrawPOPIAConsent(CLIENT);
    expect(kvStore.get('compliance_popia:mine')).toMatchObject({ consented: false });
    expect(kvStore.get('compliance_popia:theirs')).toMatchObject({ consented: true });
  });

  it('reports success for a user who never consented', async () => {
    // Idempotent: a withdrawal request from someone with no record is not an
    // error, and must not create one.
    expect(await service.withdrawPOPIAConsent('nobody')).toEqual({ success: true });
    expect([...kvStore.keys()]).toHaveLength(0);
  });

  it('is idempotent when run twice', async () => {
    seedPopia('c1');
    await service.withdrawPOPIAConsent(CLIENT);
    const first = (kvStore.get('compliance_popia:c1') as Record<string, unknown>).withdrawn_date;
    await service.withdrawPOPIAConsent(CLIENT);
    const stored = kvStore.get('compliance_popia:c1') as Record<string, unknown>;
    expect(stored.consented).toBe(false);
    expect(typeof first).toBe('string');
    expect(typeof stored.withdrawn_date).toBe('string');
  });
});

// ============================================================================
// THE PLACEHOLDER CHECKS — pinned as placeholders, on purpose
// ============================================================================

describe('AML and debarment checks record that they have not run', () => {
  it('AML: records pending/unknown, not a clearance', async () => {
    // The whole point. Nothing was screened, so nothing is claimed — a reader
    // can tell this record apart from a real screening.
    const check = await service.performAMLCheck(CLIENT, ADMIN);
    expect(check).toMatchObject({
      client_id: CLIENT,
      check_type: 'kyc',
      status: 'pending',
      risk_level: 'unknown',
      checked_by: ADMIN,
    });
    expect(check.status).not.toBe('clear');
    expect(check.risk_level).not.toBe('low');
  });

  it('AML: the note says the screening still has to happen', async () => {
    const check = await service.performAMLCheck(CLIENT, ADMIN);
    expect(check.notes).toMatch(/No AML screening has been performed/);
    // The old note is the thing that made the record misleading.
    expect(check.notes).not.toMatch(/completed/i);
  });

  it('debarment: records pending, and never claims the register was consulted', async () => {
    const check = await service.performDebarmentCheck(
      ADVISER,
      'Thabo Mokoena',
      '9001015800088',
      ADMIN,
    );
    expect(check).toMatchObject({ adviser_id: ADVISER, status: 'pending', checked_by: ADMIN });
    expect(check.notes).toMatch(/has not been checked/);
    expect(check.notes).not.toMatch(/no match/i);
  });

  it('debarment: still records the identity to be screened', async () => {
    // Deliberately kept. Name and ID number are what a real FSCA integration
    // will screen on, so the record stays useful as a queued check.
    const check = await service.performDebarmentCheck(
      ADVISER,
      'Nomsa Dlamini',
      '8505055800083',
      ADMIN,
    );
    expect(check).toMatchObject({ name: 'Nomsa Dlamini', id_number: '8505055800083' });
  });

  it('AML: still records the client and operator for the check that has to happen', async () => {
    const check = await service.performAMLCheck(CLIENT, ADMIN);
    expect(check.client_id).toBe(CLIENT);
    expect(check.checked_by).toBe(ADMIN);
    expect(typeof check.checked_at).toBe('string');
  });

  it('neither invents a per-client outcome, because neither consults anything', async () => {
    // Same output for any input is the definition of not checking. Asserted so
    // that a future real integration — which MUST vary by client — fails this
    // test and forces the suite to be updated deliberately rather than by
    // accident.
    const a = await service.performAMLCheck('client-a', ADMIN);
    const b = await service.performAMLCheck('client-b', ADMIN);
    expect(a.status).toBe(b.status);
    expect(a.risk_level).toBe(b.risk_level);
    expect(a.notes).toBe(b.notes);
  });

  it('both persist under their own namespace so a real check can replace them later', async () => {
    const aml = await service.performAMLCheck(CLIENT, ADMIN);
    const deb = await service.performDebarmentCheck(ADVISER, 'X', 'Y', ADMIN);
    expect(kvStore.has(`compliance_aml:${aml.id}`)).toBe(true);
    expect(kvStore.has(`compliance_debarment:${deb.id}`)).toBe(true);
  });
});

// ============================================================================
// LISTS — newest first, empty rather than null
// ============================================================================

describe('record listings', () => {
  it.each([
    ['FAIS', 'getFAISRecords'],
    ['AML', 'getAMLChecks'],
    ['POPIA', 'getPOPIAConsents'],
    ['debarment', 'getDebarmentChecks'],
  ] as const)('%s returns an empty array when there is nothing stored', async (_l, fn) => {
    // Not null and not undefined: every caller maps over the result, and a null
    // here is a 500 on a compliance screen.
    expect(await service[fn]()).toEqual([]);
  });

  it('returns FAIS records newest first', async () => {
    seedFais('old', { created_at: daysAgo(100) });
    seedFais('newest', { created_at: daysAgo(1) });
    seedFais('middle', { created_at: daysAgo(50) });
    expect((await service.getFAISRecords()).map((r) => r.id)).toEqual(['newest', 'middle', 'old']);
  });

  it('returns AML checks newest first', async () => {
    seedAml('old', { checked_at: daysAgo(100) });
    seedAml('newest', { checked_at: daysAgo(1) });
    expect((await service.getAMLChecks()).map((c) => c.id)).toEqual(['newest', 'old']);
  });

  it('returns debarment checks newest first', async () => {
    seedDebarment('old', { checked_at: daysAgo(100) });
    seedDebarment('newest', { checked_at: daysAgo(1) });
    expect((await service.getDebarmentChecks()).map((c) => c.id)).toEqual(['newest', 'old']);
  });

  it('keeps records of different kinds apart', async () => {
    // All four share the `compliance_` prefix; a prefix scan that widened by
    // one character would mix debarment checks into the AML list.
    seedFais('f1');
    seedAml('a1');
    seedPopia('p1');
    seedDebarment('d1');
    expect(await service.getFAISRecords()).toHaveLength(1);
    expect(await service.getAMLChecks()).toHaveLength(1);
    expect(await service.getPOPIAConsents()).toHaveLength(1);
    expect(await service.getDebarmentChecks()).toHaveLength(1);
  });
});

describe('FAIS records', () => {
  it('creates a record as active, stamped with both timestamps', async () => {
    const record = await service.createFAISRecord({
      adviser_id: ADVISER,
      fsp_number: 'FSP12345',
      fsp_name: 'Navigate Wealth',
      license_valid_until: '2027-06-30',
    });
    expect(record).toMatchObject({ status: 'active', category: 'Category I' });
    expect(record.created_at).toBe(record.updated_at);
    expect(kvStore.get(`compliance_fais:${record.id}`)).toMatchObject({ fsp_number: 'FSP12345' });
  });

  it('defaults an unspecified licence category to Category I', async () => {
    // Category I is the advice category the firm holds; guessing anything else
    // would misstate the licence on a regulatory record.
    const record = await service.createFAISRecord({ adviser_id: ADVISER });
    expect(record.category).toBe('Category I');
  });

  it('keeps a category that is given', async () => {
    const record = await service.createFAISRecord({ adviser_id: ADVISER, category: 'Category II' });
    expect(record.category).toBe('Category II');
  });

  it('gives every record its own id', async () => {
    const a = await service.createFAISRecord({ adviser_id: ADVISER });
    const b = await service.createFAISRecord({ adviser_id: ADVISER });
    expect(a.id).not.toBe(b.id);
    expect(kvStore.size).toBe(2);
  });
});

// ============================================================================
// THE SUMMARY — the numbers on the compliance dashboard
// ============================================================================

describe('compliance summary', () => {
  it('reports zeroes rather than failing on an empty store', async () => {
    const summary = await service.getComplianceSummary();
    expect(summary).toMatchObject({
      fais: { total: 0, active: 0, expired: 0 },
      aml: { total: 0, recent: 0, clear: 0 },
      popia: { total: 0, active: 0, withdrawn: 0 },
      debarment: { total: 0, recent: 0, clear: 0 },
    });
  });

  it('splits FAIS records into active and expired', async () => {
    seedFais('a', { status: 'active' });
    seedFais('b', { status: 'active' });
    seedFais('c', { status: 'expired' });
    expect((await service.getComplianceSummary()).fais).toEqual({
      total: 3,
      active: 2,
      expired: 1,
    });
  });

  it('counts anything that is not active as expired', async () => {
    // `expired = total - active`. A record in some future status ("suspended",
    // "pending") therefore counts as expired — conservative, and worth pinning
    // so a new status does not silently inflate the "active" figure instead.
    seedFais('a', { status: 'active' });
    seedFais('b', { status: 'suspended' });
    expect((await service.getComplianceSummary()).fais).toEqual({
      total: 2,
      active: 1,
      expired: 1,
    });
  });

  it('counts an AML check inside the six-month review window as recent', async () => {
    seedAml('fresh', { checked_at: daysAgo(30) });
    seedAml('stale', { checked_at: daysAgo(300) });
    expect((await service.getComplianceSummary()).aml).toMatchObject({ total: 2, recent: 1 });
  });

  it('counts a debarment check inside the three-month window as recent', async () => {
    seedDebarment('fresh', { checked_at: daysAgo(30) });
    seedDebarment('stale', { checked_at: daysAgo(120) });
    expect((await service.getComplianceSummary()).debarment).toMatchObject({ total: 2, recent: 1 });
  });

  it.each([
    ['just inside six months', 175, 1],
    ['just outside six months', 200, 0],
  ])('AML %s counts as %i recent', async (_label, days, expected) => {
    seedAml('x', { checked_at: daysAgo(days) });
    expect((await service.getComplianceSummary()).aml.recent).toBe(expected);
  });

  it.each([
    ['just inside three months', 80, 1],
    ['just outside three months', 100, 0],
  ])('debarment %s counts as %i recent', async (_label, days, expected) => {
    seedDebarment('x', { checked_at: daysAgo(days) });
    expect((await service.getComplianceSummary()).debarment.recent).toBe(expected);
  });

  it('counts clear checks separately from recent ones', async () => {
    // A stale clear check and a recent flagged one are different problems, and
    // the dashboard has to be able to tell them apart.
    seedAml('stale-clear', { checked_at: daysAgo(300), status: 'clear' });
    seedAml('recent-flagged', { checked_at: daysAgo(5), status: 'flagged' });
    expect((await service.getComplianceSummary()).aml).toEqual({ total: 2, recent: 1, clear: 1 });
  });

  it('splits POPIA consents into active and withdrawn', async () => {
    seedPopia('a', { consented: true });
    seedPopia('b', { consented: true });
    seedPopia('c', { consented: false, withdrawn_date: daysAgo(1) });
    expect((await service.getComplianceSummary()).popia).toEqual({
      total: 3,
      active: 2,
      withdrawn: 1,
    });
  });

  it('moves a consent from active to withdrawn after a withdrawal', async () => {
    seedPopia('a');
    expect((await service.getComplianceSummary()).popia).toMatchObject({ active: 1, withdrawn: 0 });
    await service.withdrawPOPIAConsent(CLIENT);
    expect((await service.getComplianceSummary()).popia).toMatchObject({ active: 0, withdrawn: 1 });
  });

  it('stamps when the summary was computed', async () => {
    const before = Date.now();
    const summary = await service.getComplianceSummary();
    expect(Date.parse(summary.lastUpdated)).toBeGreaterThanOrEqual(before - 1000);
  });
});
