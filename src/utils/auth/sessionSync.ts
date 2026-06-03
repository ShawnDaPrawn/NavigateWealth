/**
 * Cross-Tab Session Synchronization
 *
 * Ensures that logout actions in one tab are propagated to all other tabs.
 * Uses BroadcastChannel API with localStorage fallback for compatibility.
 */

import { logger } from '../logger';

// Session sync events
export enum SessionSyncEvent {
  LOGOUT = 'session:logout',
  LOGIN = 'session:login',
  NAVIGATE = 'session:navigate',
}

interface SessionMessage {
  type: SessionSyncEvent;
  timestamp: number;
  data?: unknown;
}

// Storage key for localStorage fallback
const STORAGE_KEY = 'navigate_wealth_session_event';

// Singleton instance
let instance: SessionSync | null = null;

export class SessionSync {
  private channel: BroadcastChannel | null = null;
  private listeners: Map<string, Set<() => void>> = new Map();
  private useLocalStorage: boolean = false;

  constructor() {
    // Check if BroadcastChannel is supported
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel('navigate_wealth_session');
        this.setupBroadcastChannel();
        logger.info('SessionSync: Using BroadcastChannel API');
      } catch (error) {
        console.warn('⚠️ BroadcastChannel failed, falling back to localStorage:', error);
        this.useLocalStorage = true;
        this.setupLocalStorage();
      }
    } else {
      logger.info('SessionSync: BroadcastChannel not supported, using localStorage');
      this.useLocalStorage = true;
      this.setupLocalStorage();
    }
  }

  /**
   * Setup BroadcastChannel listener
   */
  private setupBroadcastChannel(): void {
    if (!this.channel) return;

    this.channel.onmessage = (event: MessageEvent<SessionMessage>) => {
      logger.debug('SessionSync received', { data: event.data });
      this.notifyListeners(event.data.type);
    };
  }

  /**
   * Setup localStorage listener (fallback)
   */
  private setupLocalStorage(): void {
    window.addEventListener('storage', (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue) {
        try {
          const message: SessionMessage = JSON.parse(event.newValue);
          logger.debug('SessionSync received (localStorage)', { message });
          this.notifyListeners(message.type);
        } catch (error) {
          console.error('Failed to parse session sync message:', error);
        }
      }
    });
  }

  /**
   * Broadcast a session event to all tabs
   */
  broadcast(event: SessionSyncEvent, data?: unknown): void {
    const message: SessionMessage = {
      type: event,
      timestamp: Date.now(),
      data: data,
    };

    if (this.channel && !this.useLocalStorage) {
      // Use BroadcastChannel
      this.channel.postMessage(message);
      logger.debug('SessionSync broadcast', { message });
    } else {
      // Use localStorage
      // Note: localStorage events don't fire in the same tab that sets them,
      // which is perfect for cross-tab communication
      localStorage.setItem(STORAGE_KEY, JSON.stringify(message));
      logger.debug('SessionSync broadcast (localStorage)', { message });

      // Clean up immediately (we only need the event, not persistent storage)
      setTimeout(() => {
        localStorage.removeItem(STORAGE_KEY);
      }, 100);
    }
  }

  /**
   * Listen for a specific session event
   */
  on(event: SessionSyncEvent, callback: () => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    this.listeners.get(event)!.add(callback);
    logger.debug('SessionSync listener added', { event });

    // Return unsubscribe function
    return () => {
      const eventListeners = this.listeners.get(event);
      if (eventListeners) {
        eventListeners.delete(callback);
        logger.debug('SessionSync listener removed', { event });
      }
    };
  }

  /**
   * Notify all listeners for a specific event
   */
  private notifyListeners(event: SessionSyncEvent): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      logger.debug('SessionSync notifying listeners', { event, count: eventListeners.size });
      eventListeners.forEach((callback) => {
        try {
          callback();
        } catch (error) {
          console.error('Error in session sync listener:', error);
        }
      });
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    this.listeners.clear();
    logger.info('SessionSync destroyed');
  }
}

/**
 * Get singleton instance of SessionSync
 */
export function getSessionSync(): SessionSync {
  if (!instance) {
    instance = new SessionSync();
  }
  return instance;
}

/**
 * Broadcast logout event to all tabs
 */
export function broadcastLogout(): void {
  getSessionSync().broadcast(SessionSyncEvent.LOGOUT);
}

/**
 * Broadcast login event to all tabs
 */
export function broadcastLogin(): void {
  getSessionSync().broadcast(SessionSyncEvent.LOGIN);
}

/**
 * Broadcast navigate event to all tabs
 */
export function broadcastNavigate(data?: unknown): void {
  getSessionSync().broadcast(SessionSyncEvent.NAVIGATE, data);
}

/**
 * Listen for logout events from other tabs
 */
export function onLogoutBroadcast(callback: () => void): () => void {
  return getSessionSync().on(SessionSyncEvent.LOGOUT, callback);
}

/**
 * Listen for login events from other tabs
 */
export function onLoginBroadcast(callback: () => void): () => void {
  return getSessionSync().on(SessionSyncEvent.LOGIN, callback);
}

/**
 * Listen for navigate events from other tabs
 */
export function onNavigateBroadcast(callback: () => void): () => void {
  return getSessionSync().on(SessionSyncEvent.NAVIGATE, callback);
}
