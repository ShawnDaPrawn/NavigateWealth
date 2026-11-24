/**
 * What an AI connection may do with a credential, and whether it waits for a
 * person. Pure functions: everything here is a setting on the connection or
 * the credential, nothing is hard-coded, and Full access + Full autonomy means
 * no limit and no human in the loop.
 */
import type {
  ActionKey,
  ActionMode,
  CheckMode,
  CheckResult,
  ConnectionLevel,
  VaultConnection,
  VaultSummary,
  WorkflowRisk,
} from '../../../shared/password-manager.ts';

const LEVEL_RANK: Record<'find' | 'use' | 'reveal', number> = { find: 1, use: 2, reveal: 3 };
const MODE_RANK: Record<ActionMode, number> = { auto: 0, ask_on_fail: 1, ask: 2, deny: 3 };

export type Scope = Pick<VaultConnection, 'collectionIds' | 'tagFilter' | 'level' | 'autonomy'>;

/** Whether the connection can see the credential at all. */
export function canSee(conn: Scope, item: VaultSummary) {
  if (!conn.collectionIds.includes(item.collectionId)) return false;
  if (conn.tagFilter && !item.tags.includes(conn.tagFilter)) return false;
  return conn.level === 'full' || item.aiAccess !== 'never';
}

/** The most the connection may do with this credential: its own level, capped by the login's. */
export function effectiveLevel(
  conn: Pick<VaultConnection, 'level'>,
  item: Pick<VaultSummary, 'aiAccess'>,
): 'find' | 'use' | 'reveal' | null {
  if (conn.level === 'full') return 'reveal';
  if (item.aiAccess === 'never') return null;
  return LEVEL_RANK[conn.level as Exclude<ConnectionLevel, 'full'>] <= LEVEL_RANK[item.aiAccess]
    ? (conn.level as 'find' | 'use' | 'reveal')
    : item.aiAccess;
}

export function allows(
  level: ReturnType<typeof effectiveLevel>,
  needed: 'find' | 'use' | 'reveal',
) {
  return level !== null && LEVEL_RANK[level] >= LEVEL_RANK[needed];
}

export const stricter = (a: ActionMode, b: ActionMode) => (MODE_RANK[a] >= MODE_RANK[b] ? a : b);

export function riskAction(risk: WorkflowRisk): ActionKey {
  return risk === 'money'
    ? 'money_workflow'
    : risk === 'change'
      ? 'change_workflow'
      : 'read_workflow';
}

/**
 * How the connection treats an action on a credential: a workflow's own
 * override wins over its action line, and a login marked "Ask first" follows
 * the connection's "ask_first_logins" line unless that line runs on its own.
 */
export function modeFor(
  conn: Pick<VaultConnection, 'autonomy'>,
  action: ActionKey,
  item: Pick<VaultSummary, 'askFirst'>,
  workflowId?: string,
): ActionMode {
  const a = conn.autonomy;
  let mode = (workflowId && a.workflowOverrides[workflowId]) || a.actions[action];
  if (item.askFirst) {
    const line = a.actions.ask_first_logins;
    if (line !== 'auto') mode = stricter(mode, line === 'ask_on_fail' ? 'ask' : line);
  }
  return mode;
}

/**
 * Whether a step waits for a person, given the action mode and the checks.
 * - ask: always waits.
 * - ask_on_fail: waits when a check set to "Ask a person" failed.
 * - auto: never waits; a failed "Ask a person" check is only logged.
 * A failed check set to "Block" stops the step under every mode.
 */
export function gate(mode: ActionMode, checks: CheckResult[]): 'deny' | 'block' | 'ask' | 'go' {
  if (mode === 'deny') return 'deny';
  if (checks.some((c) => c.passed === false && c.mode === 'block')) return 'block';
  if (mode === 'ask') return 'ask';
  if (mode === 'ask_on_fail' && checks.some((c) => c.passed === false && c.mode === 'ask'))
    return 'ask';
  return 'go';
}

export function check(
  key: CheckResult['key'],
  mode: CheckMode,
  passed: boolean | null,
  note: string,
): CheckResult {
  return { key, mode, passed: mode === 'off' ? null : passed, note: mode === 'off' ? 'Off' : note };
}

/** Trust ladder: the next mode up once a workflow has a clean record at its current one. */
export function suggestNext(current: ActionMode, cleanRuns: number): ActionMode | null {
  if (current === 'ask' && cleanRuns >= 10) return 'ask_on_fail';
  if (current === 'ask_on_fail' && cleanRuns >= 25) return 'auto';
  return null;
}
