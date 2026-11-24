import { beforeEach, describe, expect, it } from 'vitest';
import { CONSENT_KEY, clearConsent, pendingConsent } from '../pendingConsent';

const store = (expires: number, params: Record<string, string>) =>
  sessionStorage.setItem(CONSENT_KEY, JSON.stringify({ expires, params }));

describe('waiting AI sign-in request', () => {
  beforeEach(() => sessionStorage.clear());

  it('returns a live request so the admin page can open the AI agents tab', () => {
    store(Date.now() + 60_000, { client_id: 'abc', state: 's' });
    expect(pendingConsent()).toEqual({ client_id: 'abc', state: 's' });
    clearConsent();
    expect(pendingConsent()).toBeNull();
  });

  it('drops an expired or malformed request', () => {
    store(Date.now() - 1, { client_id: 'abc' });
    expect(pendingConsent()).toBeNull();
    expect(sessionStorage.getItem(CONSENT_KEY)).toBeNull();
    sessionStorage.setItem(CONSENT_KEY, 'not json');
    expect(pendingConsent()).toBeNull();
  });
});
