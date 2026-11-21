import { api } from '../../../utils/api/client';
import type {
  Broker,
  Workflow,
  ConnectionInfo,
  Provider,
  Selectors,
} from '../../../shared/broker-operations';
export const ops = '/broker-operations';
export const options = { retryTransientFailures: false, cache: 'no-store' } as const;
export interface Setup {
  loginDefaults: Record<Provider, Pick<Selectors, 'username' | 'password' | 'submit'>>;
  brokers: Broker[];
  workflows: Workflow[];
  connections: ConnectionInfo[];
}
export const getSetup = () => api.get<Setup>(ops + '/setup', options);

export function consentRequest(): Record<string, string> | null {
  try {
    const raw = sessionStorage.getItem('nw-broker-consent');
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (value.expires > Date.now() && typeof value.params?.client_id === 'string')
      return value.params;
    sessionStorage.removeItem('nw-broker-consent');
  } catch {
    /* Storage is optional for normal vault use. */
  }
  return null;
}
