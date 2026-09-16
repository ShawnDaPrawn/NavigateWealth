/**
 * Turning a connection state into something an adviser can act on.
 * ================================================================
 *
 * The rule this file exists to enforce: every state names ONE next action, and
 * the action is the thing that would change the state. The old provider list
 * managed the opposite — a green "Active" badge derived from the last sync
 * attempt, which said nothing about whether the provider could still be signed
 * in to, and offered nothing to do about it either way.
 *
 * Kept as plain functions with no React in them so the mapping can be asserted
 * directly, rather than through six rendered components.
 */
import type { PortalConnectionState, PortalProviderConnection } from '../../types';

export type ConnectionTone = 'good' | 'bad' | 'warn' | 'neutral' | 'busy';

export interface ConnectionPresentation {
  /** Two or three words. Goes on the badge. */
  label: string;
  tone: ConnectionTone;
  /** One sentence saying what is true right now. */
  detail: string;
  /** The button text for the single next action, or null when there is none. */
  action: string | null;
}

const PRESENTATION: Record<PortalConnectionState, ConnectionPresentation> = {
  no_login_url: {
    label: 'Not set up',
    tone: 'neutral',
    detail: 'No portal sign-in address has been captured for this provider yet.',
    action: 'Set up',
  },
  no_credentials: {
    label: 'Needs sign-in',
    tone: 'warn',
    detail: 'The portal address is captured, but no username and password are stored.',
    action: 'Add sign-in details',
  },
  untested: {
    label: 'Not tested',
    tone: 'neutral',
    detail: 'Sign-in details are stored, but nobody has checked whether they work.',
    action: 'Test sign-in',
  },
  testing: {
    label: 'Testing',
    tone: 'busy',
    detail: 'Signing in to the provider portal now.',
    action: null,
  },
  connected: {
    label: 'Connected',
    tone: 'good',
    detail: 'The stored sign-in details opened the provider portal.',
    action: 'Test again',
  },
  failed: {
    label: 'Sign-in failed',
    tone: 'bad',
    detail: 'The last sign-in attempt did not get into the provider portal.',
    action: 'Fix and retry',
  },
};

export function describeConnection(state: PortalConnectionState): ConnectionPresentation {
  return PRESENTATION[state] ?? PRESENTATION.untested;
}

/**
 * The sentence under the provider name.
 *
 * A failure's own message beats the generic detail, because the provider's
 * wording ("password expired", "account locked") is the part that tells an
 * adviser what to do. A success message is the worker's own chatter and adds
 * nothing to "Connected", so it is dropped in favour of when it was proven.
 */
export function connectionDetailLine(connection: PortalProviderConnection): string {
  const presentation = describeConnection(connection.state);

  if (connection.state === 'failed' && connection.message) {
    return connection.message;
  }
  if (connection.state === 'testing' && connection.message) {
    return connection.message;
  }
  if (connection.state === 'connected' && connection.lastCheckedAt) {
    const checked = new Date(connection.lastCheckedAt);
    if (!Number.isNaN(checked.getTime())) {
      return `Signed in successfully on ${checked.toLocaleDateString()}.`;
    }
  }
  return presentation.detail;
}

/**
 * Whether the guided sign-in flow can start a test straight away, or has to
 * collect something first. Mirrors what the server will accept: no address or
 * no credentials means the test would be refused.
 */
export function canTestConnection(connection: PortalProviderConnection): boolean {
  return (
    connection.state !== 'testing' && !!connection.loginUrl?.trim() && connection.hasCredentials
  );
}

/** Ordering for the list: the things needing attention come first. */
const SORT_RANK: Record<PortalConnectionState, number> = {
  failed: 0,
  no_credentials: 1,
  no_login_url: 2,
  untested: 3,
  testing: 4,
  connected: 5,
};

export function compareConnections(
  a: PortalProviderConnection,
  b: PortalProviderConnection,
): number {
  const rank = SORT_RANK[a.state] - SORT_RANK[b.state];
  return rank !== 0 ? rank : a.providerName.localeCompare(b.providerName);
}
