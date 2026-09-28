import { useSyncExternalStore } from 'react';
import {
  getConnectivityStatus,
  subscribeConnectivity,
  type ConnectivityStatus,
} from '../utils/network/connectivity';

/**
 * Whether this tab can reach the backend: 'online', 'offline' (no network at
 * all) or 'unreachable' (on a network, but the internet behind it is down).
 * See utils/network/connectivity.ts for how each is detected.
 */
export function useConnectivity(): ConnectivityStatus {
  return useSyncExternalStore(subscribeConnectivity, getConnectivityStatus, () => 'online');
}
