/**
 * Connection presentation — every state names one next action
 * ===========================================================
 *
 * The rule under test is the one the old provider list broke: a state an
 * adviser can do something about must SAY what that something is, and a state
 * that is genuinely nobody's move must not invent one.
 *
 * Also pinned: "not tested" and "sign-in failed" stay distinct all the way to
 * the screen. Collapsing them was the specific defect — a provider whose
 * password had expired looked exactly like one nobody had configured, so
 * neither got looked at.
 */
import { describe, it, expect } from 'vitest';
import {
  canTestConnection,
  compareConnections,
  connectionDetailLine,
  describeConnection,
} from '../connectionPresentation';
import type { PortalConnectionState, PortalProviderConnection } from '../../../types';

const ALL_STATES: PortalConnectionState[] = [
  'no_login_url',
  'no_credentials',
  'untested',
  'testing',
  'connected',
  'failed',
];

const connection = (over: Partial<PortalProviderConnection> = {}): PortalProviderConnection => ({
  providerId: 'p1',
  providerName: 'Allan Gray',
  state: 'untested',
  categoryId: 'risk_planning',
  credentialProfileId: 'allan-gray-env',
  loginUrl: 'https://portal.example/login',
  hasCredentials: true,
  ...over,
});

describe('describeConnection', () => {
  it('has a distinct label for every state', () => {
    const labels = ALL_STATES.map((state) => describeConnection(state).label);
    expect(new Set(labels).size).toBe(ALL_STATES.length);
  });

  it('offers an action for every state an adviser can move', () => {
    ALL_STATES.filter((state) => state !== 'testing').forEach((state) => {
      expect(describeConnection(state).action, state).toBeTruthy();
    });
  });

  it('offers no action while a test is already running', () => {
    expect(describeConnection('testing').action).toBeNull();
  });

  it('keeps "never tried" and "tried and failed" visibly different', () => {
    expect(describeConnection('untested').label).not.toBe(describeConnection('failed').label);
    expect(describeConnection('untested').tone).not.toBe(describeConnection('failed').tone);
  });

  it('only calls a connection good once sign-in has actually been proven', () => {
    const good = ALL_STATES.filter((state) => describeConnection(state).tone === 'good');
    expect(good).toEqual(['connected']);
  });
});

describe('connectionDetailLine', () => {
  it("shows the provider's own words on a failure, since that is what says what to do", () => {
    expect(
      connectionDetailLine(connection({ state: 'failed', message: 'Your password has expired.' })),
    ).toBe('Your password has expired.');
  });

  it('falls back to a plain explanation when a failure carried no message', () => {
    expect(connectionDetailLine(connection({ state: 'failed' }))).toBe(
      describeConnection('failed').detail,
    );
  });

  it('says when a working connection was last proven', () => {
    expect(
      connectionDetailLine(
        connection({ state: 'connected', lastCheckedAt: '2026-09-05T10:52:58.410Z' }),
      ),
    ).toMatch(/Signed in successfully on /);
  });

  it('does not render an unparseable timestamp as "Invalid Date"', () => {
    expect(
      connectionDetailLine(connection({ state: 'connected', lastCheckedAt: 'not-a-date' })),
    ).toBe(describeConnection('connected').detail);
  });

  it('reports live progress while a test is running', () => {
    expect(
      connectionDetailLine(
        connection({ state: 'testing', message: 'Waiting for the one-time PIN.' }),
      ),
    ).toBe('Waiting for the one-time PIN.');
  });
});

describe('canTestConnection', () => {
  it('can test once there is an address and stored credentials', () => {
    expect(canTestConnection(connection())).toBe(true);
  });

  it('cannot test without a sign-in address', () => {
    expect(canTestConnection(connection({ loginUrl: '' }))).toBe(false);
    expect(canTestConnection(connection({ loginUrl: '   ' }))).toBe(false);
  });

  it('cannot test without stored credentials', () => {
    expect(canTestConnection(connection({ hasCredentials: false }))).toBe(false);
  });

  it('will not start a second test on top of one already running', () => {
    expect(canTestConnection(connection({ state: 'testing' }))).toBe(false);
  });
});

describe('compareConnections', () => {
  it('puts what is broken above what is working', () => {
    const ordered = [
      connection({ providerId: 'a', providerName: 'A', state: 'connected' }),
      connection({ providerId: 'b', providerName: 'B', state: 'failed' }),
      connection({ providerId: 'c', providerName: 'C', state: 'untested' }),
    ].sort(compareConnections);

    expect(ordered.map((entry) => entry.state)).toEqual(['failed', 'untested', 'connected']);
  });

  it('falls back to name order within a state, so the list does not shuffle', () => {
    const ordered = [
      connection({ providerId: 'z', providerName: 'Zurich', state: 'connected' }),
      connection({ providerId: 'a', providerName: 'Allan Gray', state: 'connected' }),
    ].sort(compareConnections);

    expect(ordered.map((entry) => entry.providerName)).toEqual(['Allan Gray', 'Zurich']);
  });
});
