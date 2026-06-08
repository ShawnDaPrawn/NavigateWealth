/**
 * Tests for gatewaySession — sessionStorage persistence helpers.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import {
  loadGatewaySession,
  saveGatewaySession,
  clearGatewaySession,
  QUOTE_GATEWAY_SESSION_KEY,
} from '../gatewaySession';

beforeEach(() => {
  sessionStorage.clear();
});

describe('loadGatewaySession', () => {
  it('returns empty object when nothing is stored', () => {
    expect(loadGatewaySession()).toEqual({});
  });

  it('returns parsed data from sessionStorage', () => {
    sessionStorage.setItem(QUOTE_GATEWAY_SESSION_KEY, JSON.stringify({ email: 'a@b.com' }));
    expect(loadGatewaySession()).toEqual({ email: 'a@b.com' });
  });

  it('returns empty object when stored value is invalid JSON', () => {
    sessionStorage.setItem(QUOTE_GATEWAY_SESSION_KEY, 'not-json');
    expect(loadGatewaySession()).toEqual({});
  });
});

describe('saveGatewaySession', () => {
  it('saves data to sessionStorage', () => {
    saveGatewaySession({ firstName: 'Alice' });
    const raw = sessionStorage.getItem(QUOTE_GATEWAY_SESSION_KEY);
    expect(JSON.parse(raw!)).toEqual({ firstName: 'Alice' });
  });

  it('overwrites existing session data', () => {
    saveGatewaySession({ firstName: 'Alice' });
    saveGatewaySession({ firstName: 'Bob' });
    expect(loadGatewaySession()).toEqual({ firstName: 'Bob' });
  });
});

describe('clearGatewaySession', () => {
  it('removes the session key from storage', () => {
    saveGatewaySession({ firstName: 'Alice' });
    clearGatewaySession();
    expect(sessionStorage.getItem(QUOTE_GATEWAY_SESSION_KEY)).toBeNull();
  });

  it('does not throw when nothing is stored', () => {
    expect(() => clearGatewaySession()).not.toThrow();
  });
});
