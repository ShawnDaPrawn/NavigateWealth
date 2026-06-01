/**
 * sessionSync — unit tests (Phase 4 coverage push).
 *
 * Cross-tab session sync. Exercises listener registration / notification /
 * unsubscribe, listener-error isolation, broadcast, the singleton accessor, and
 * the convenience broadcasters/listeners. A received message is simulated via
 * the active transport (BroadcastChannel.onmessage or a storage event).
 */
import { describe, it, expect, vi } from 'vitest';
import {
  SessionSync,
  SessionSyncEvent,
  getSessionSync,
  broadcastLogout,
  broadcastLogin,
  broadcastNavigate,
  onLogoutBroadcast,
  onLoginBroadcast,
  onNavigateBroadcast,
} from '../sessionSync';

function simulateReceive(s: SessionSync, type: SessionSyncEvent) {
  const ch = (s as unknown as { channel: { onmessage?: (e: { data: unknown }) => void } | null })
    .channel;
  if (ch && ch.onmessage) {
    ch.onmessage({ data: { type, timestamp: Date.now() } });
  } else {
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'navigate_wealth_session_event',
        newValue: JSON.stringify({ type, timestamp: Date.now() }),
      }),
    );
  }
}

describe('SessionSync', () => {
  it('notifies registered listeners for the matching event only', () => {
    const s = new SessionSync();
    const cb = vi.fn();
    s.on(SessionSyncEvent.LOGOUT, cb);

    simulateReceive(s, SessionSyncEvent.LOGOUT);
    expect(cb).toHaveBeenCalledTimes(1);

    simulateReceive(s, SessionSyncEvent.LOGIN); // different event
    expect(cb).toHaveBeenCalledTimes(1);
    s.destroy();
  });

  it('unsubscribe stops further notifications', () => {
    const s = new SessionSync();
    const cb = vi.fn();
    const off = s.on(SessionSyncEvent.LOGOUT, cb);
    off();
    simulateReceive(s, SessionSyncEvent.LOGOUT);
    expect(cb).not.toHaveBeenCalled();
    s.destroy();
  });

  it('isolates a throwing listener so siblings still run', () => {
    const s = new SessionSync();
    const bad = vi.fn(() => {
      throw new Error('boom');
    });
    const good = vi.fn();
    s.on(SessionSyncEvent.LOGOUT, bad);
    s.on(SessionSyncEvent.LOGOUT, good);
    expect(() => simulateReceive(s, SessionSyncEvent.LOGOUT)).not.toThrow();
    expect(good).toHaveBeenCalled();
    s.destroy();
  });

  it('broadcast emits without throwing', () => {
    const s = new SessionSync();
    expect(() => s.broadcast(SessionSyncEvent.LOGOUT, { x: 1 })).not.toThrow();
    s.destroy();
  });

  it('getSessionSync returns a singleton', () => {
    expect(getSessionSync()).toBe(getSessionSync());
  });

  it('convenience broadcasters + listeners work through the singleton', () => {
    const cb = vi.fn();
    const off = onLogoutBroadcast(cb);
    simulateReceive(getSessionSync(), SessionSyncEvent.LOGOUT);
    expect(cb).toHaveBeenCalled();
    off();

    expect(() => {
      broadcastLogout();
      broadcastLogin();
      broadcastNavigate({ to: '/x' });
    }).not.toThrow();

    expect(typeof onLoginBroadcast(vi.fn())).toBe('function');
    expect(typeof onNavigateBroadcast(vi.fn())).toBe('function');
  });
});
