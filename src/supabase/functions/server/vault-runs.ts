/**
 * Running a credential's workflows for an AI connection. Each run records the
 * mode it ran under (from the connection's autonomy), every check and its
 * outcome, and any approval it waited for. Under Full autonomy nothing waits.
 */
import type {
  CheckResult,
  TrustSuggestion,
  VaultRun,
  VaultRunStep,
} from '../../../shared/password-manager.ts';
import { entries, revealSecret, summary } from './repositories/password-vault.ts';
import {
  compareAndSet,
  runs,
  versionKey,
  workflowVersions,
  workflows,
  type StoredConnection,
  type StoredRun,
  type WorkflowSnapshot,
} from './repositories/vault-store.ts';
import { insertIfAbsent } from './repositories/password-vault.ts';
import { sha256Hex } from './sha256.ts';
import {
  allows,
  canSee,
  check,
  effectiveLevel,
  gate,
  modeFor,
  riskAction,
  suggestNext,
} from './vault-policy.ts';
import { DEFAULT_CHECKPOINT_LABELS, liveSnapshot, renderSkill } from './vault-workflows.ts';
import { requestApproval } from './vault-approvals.ts';
import { recordEvent } from './vault-events.ts';
import {
  browserHost,
  HostUnavailable,
  originAllowed,
  scrubPage,
  type HostAction,
  type PageControl,
} from './vault-browser-host.ts';
import { jobInput } from './broker-ops-model.ts';
import { control, startJob } from './broker-ops-jobs.ts';
import {
  batches,
  runs as portalRuns,
  publicRun as publicPortalRun,
  active,
} from './repositories/broker-ops.ts';

export class RunError extends Error {}
type Run = StoredRun & { controls?: PageControl[]; allowedOrigins?: string[] };

export function publicRun(r: Run): VaultRun {
  const {
    revision: _r,
    signature: _s,
    requestId: _q,
    approvedSteps: _a,
    holdUntil: _h,
    controls: _c,
    allowedOrigins: _o,
    ...rest
  } = r;
  return rest;
}

async function credential(id: string) {
  const entry = await entries.get(id);
  if (!entry) throw new RunError('This login no longer exists.');
  return { entry, summary: await summary(entry) };
}

async function save(run: Run, patch: Partial<Run>): Promise<Run> {
  const next = {
    ...run,
    ...patch,
    revision: crypto.randomUUID(),
    updatedAt: new Date().toISOString(),
  };
  if (!(await compareAndSet(runs.key(run.id), next, 'revision', run.revision)))
    throw new RunError('This run changed meanwhile. Read it again with get_run.');
  return next;
}

const actorName = (conn: StoredConnection) => ({
  actorKind: 'connection' as const,
  actorId: conn.id,
  actorName: conn.name,
});

async function computeChecks(
  conn: StoredConnection,
  w: WorkflowSnapshot,
  inputs: Record<string, unknown>,
  amount: number | null,
  signature: string,
  runId: string,
): Promise<CheckResult[]> {
  const modes = conn.autonomy.checks;
  const limits = conn.autonomy.limits;
  const docs = w.inputs.filter((i) => i.type === 'document');
  const changes = w.risk !== 'read';
  const recent =
    changes || (w.risk === 'money' && limits.perDay !== null)
      ? (await runs.listAll('password vault: duplicate and daily-limit checks')).filter(
          (r) => r.id !== runId && !['failed', 'cancelled', 'blocked'].includes(r.state),
        )
      : [];
  const today = new Date().toISOString().slice(0, 10);
  const spentToday = recent
    .filter(
      (r) => r.connectionId === conn.id && r.risk === 'money' && r.createdAt.startsWith(today),
    )
    .reduce((sum, r) => sum + (r.amount ?? 0), 0);
  const dayAgo = Date.now() - 86400000;
  return [
    docs.length
      ? check(
          'roa_document',
          modes.roa_document,
          docs.some((d) => Boolean(inputs[d.name])),
          'Signed instruction attached',
        )
      : check('roa_document', modes.roa_document, null, 'This workflow takes no document'),
    check(
      'identity_match',
      modes.identity_match,
      null,
      'Checked in the session against the skill’s stop rules',
    ),
    // A limit that is set but cannot be evaluated fails closed.
    w.risk !== 'money' || limits.perInstruction === null
      ? check('per_instruction_limit', modes.per_instruction_limit, null, 'No limit set')
      : amount === null
        ? check(
            'per_instruction_limit',
            modes.per_instruction_limit,
            false,
            'No amount given, so the limit cannot be checked',
          )
        : check(
            'per_instruction_limit',
            modes.per_instruction_limit,
            amount <= limits.perInstruction,
            'R ' + amount + ' against a limit of R ' + limits.perInstruction,
          ),
    w.risk !== 'money' || limits.perDay === null
      ? check('daily_limit', modes.daily_limit, null, 'No limit set')
      : amount === null
        ? check(
            'daily_limit',
            modes.daily_limit,
            false,
            'No amount given, so the daily limit cannot be checked',
          )
        : check(
            'daily_limit',
            modes.daily_limit,
            spentToday + amount <= limits.perDay,
            'R ' + (spentToday + amount) + ' today against R ' + limits.perDay,
          ),
    changes
      ? check(
          'duplicate_24h',
          modes.duplicate_24h,
          !recent.some((r) => r.signature === signature && Date.parse(r.createdAt) > dayAgo),
          'Same workflow and inputs in the last 24 hours',
        )
      : check('duplicate_24h', modes.duplicate_24h, null, 'Read-only'),
    check('page_matches', modes.page_matches, null, 'Checked in the session'),
  ];
}

function failedNote(checks: CheckResult[]) {
  return checks
    .filter((c) => c.passed === false)
    .map((c) => c.note)
    .join('; ');
}

export async function startRun(
  conn: StoredConnection,
  args: {
    workflow_id: string;
    inputs: Record<string, unknown>;
    request_id: string;
    reason?: string;
  },
) {
  const id = (await sha256Hex(conn.id + '|' + args.request_id)).slice(0, 32);
  const existing = (await runs.get(id)) as Run | null;
  if (existing) return { run: publicRun(existing), skill: null };
  const wf = await workflows.get(args.workflow_id);
  if (!wf) throw new RunError('Unknown workflow.');
  const { entry, summary: item } = await credential(wf.credentialId);
  if (!canSee(conn, item)) throw new RunError('Unknown workflow.');
  if (!allows(effectiveLevel(conn, item), 'use'))
    throw new RunError('This connection may not use this login.');
  const snap = await liveSnapshot(wf);
  if (!snap) throw new RunError('This workflow has no live version yet.');
  for (const field of snap.inputs)
    if (field.required && (args.inputs[field.name] === undefined || args.inputs[field.name] === ''))
      throw new RunError('Missing input: ' + field.name);
  const amountField = snap.inputs.find((i) => i.type === 'amount');
  const rawAmount = amountField ? args.inputs[amountField.name] : undefined;
  const hasAmount = rawAmount !== undefined && rawAmount !== null && rawAmount !== '';
  const amount = hasAmount ? Number(rawAmount) : null;
  if (hasAmount && (!Number.isFinite(amount) || amount! < 0))
    throw new RunError('Input ' + amountField!.name + ' must be a number of zero or more.');
  const signature = await sha256Hex(wf.id + '|' + JSON.stringify(args.inputs));
  const mode = modeFor(conn, riskAction(snap.risk), item, wf.id);
  const checks = await computeChecks(conn, snap, args.inputs, amount, signature, id);
  const decision = gate(mode, checks);
  const now = new Date().toISOString();
  const steps: VaultRunStep[] = snap.steps.map((s, index) => ({
    index,
    text: s.text,
    state: 'todo',
    note: '',
    at: null,
  }));
  let run: Run = {
    id,
    revision: crypto.randomUUID(),
    signature,
    requestId: args.request_id,
    approvedSteps: [],
    holdUntil: null,
    workflowId: wf.id,
    workflowName: snap.name,
    workflowVersion: snap.version,
    credentialId: wf.credentialId,
    credentialName: item.name,
    connectionId: conn.id,
    connectionName: conn.name,
    risk: snap.risk,
    mode,
    state: 'running',
    message: 'Started',
    inputs: args.inputs,
    amount,
    steps,
    checks,
    approvalId: null,
    sessionId: null,
    portalJobId: null,
    result: null,
    createdAt: now,
    updatedAt: now,
    allowedOrigins: snap.guardrails.allowedOrigins.length
      ? snap.guardrails.allowedOrigins
      : [new URL(item.url).origin],
  };
  if (decision === 'deny' || decision === 'block') {
    run = {
      ...run,
      state: 'blocked',
      message:
        decision === 'deny'
          ? 'This connection is not allowed to run ' + snap.risk + ' workflows.'
          : 'Blocked by a check: ' + failedNote(checks),
    };
  } else if (
    decision === 'ask' &&
    (snap.kind === 'automated' || !snap.steps.some((s) => s.checkpoint))
  ) {
    const approval = await requestApproval(
      conn,
      {
        action: 'workflow',
        credentialId: wf.credentialId,
        credentialName: item.name,
        workflowId: wf.id,
        runId: id,
        reason: args.reason ?? '',
        detail:
          snap.name +
          (amount !== null ? ' · R ' + amount : '') +
          (failedNote(checks) ? ' · ' + failedNote(checks) : ''),
      },
      30,
    );
    run = {
      ...run,
      state: 'waiting_for_approval',
      approvalId: approval.id,
      message: 'Waiting for a person to approve this run.',
    };
  }
  if (!(await insertIfAbsent(runs.key(id), run)))
    return { run: publicRun((await runs.get(id))!), skill: null };
  await recordEvent({
    ...actorName(conn),
    action: 'Ran workflow',
    credentialId: wf.credentialId,
    credentialName: item.name,
    detail: snap.name + ' · ' + run.message + (args.reason ? ' · “' + args.reason + '”' : ''),
    outcome:
      run.state === 'blocked' ? 'denied' : run.state === 'waiting_for_approval' ? 'pending' : 'ok',
  });
  if (run.state === 'running') run = await launch(run, snap, entry);
  return {
    run: publicRun(run),
    skill: snap.kind === 'skill' ? renderSkill(snap, item.name) : null,
  };
}

async function launch(
  run: Run,
  snap: WorkflowSnapshot,
  entry?: Awaited<ReturnType<typeof entries.get>>,
): Promise<Run> {
  const row = entry ?? (await entries.get(run.credentialId));
  if (!row) return save(run, { state: 'failed', message: 'This login no longer exists.' });
  const item = await summary(row);
  if (snap.kind === 'automated') {
    if (!item.portal)
      return save(run, {
        state: 'failed',
        message: 'This login is not set up for broker reporting.',
      });
    const ids =
      Array.isArray(run.inputs.broker_ids) && run.inputs.broker_ids.length
        ? (run.inputs.broker_ids as string[])
        : item.portal.brokers.map((b) => b.brokerId);
    const parsed = jobInput.safeParse({
      requestId: run.requestId,
      accountId: run.credentialId,
      brokerIds: ids,
      workflowId: snap.automatedWorkflowId,
      month: typeof run.inputs.month === 'string' ? run.inputs.month : undefined,
    });
    if (!parsed.success)
      return save(run, {
        state: 'failed',
        message:
          'Inputs do not fit the reporting workflow (request_id must be a UUID; month YYYY-MM).',
      });
    const job = await startJob(parsed.data, 'vault:' + run.connectionId);
    return save(run, {
      portalJobId: job.batchId,
      message: 'Queued on the reporting runner',
      result: job,
    });
  }
  try {
    const secret = await revealSecret(row);
    const started = await browserHost.start({
      runId: run.id,
      loginUrl: item.url,
      username: item.username,
      password: secret.password,
      otpSecret: secret.otpSecret,
      allowedOrigins: run.allowedOrigins ?? [],
    });
    return save(run, {
      sessionId: started.sessionId,
      controls: started.page.controls,
      message: 'Signed in. Read the page with session_read.',
    });
  } catch (e) {
    return save(run, {
      state: 'failed',
      message: e instanceof HostUnavailable ? e.message : 'Could not open a session.',
    });
  }
}

export async function runFor(conn: StoredConnection, runId: string) {
  const run = (await runs.get(runId)) as Run | null;
  if (!run || run.connectionId !== conn.id) throw new RunError('Unknown run.');
  return run;
}

/** Refreshes automated runs from the reporting runner, then returns the run. */
export async function getRun(run: Run) {
  if (run.portalJobId && run.state === 'running') {
    const batch = await batches.get(run.portalJobId);
    const rows = batch
      ? (await Promise.all(batch.ids.map((id) => portalRuns.get(id))))
          .filter((r) => r !== null)
          .map((r) => publicPortalRun(r!))
      : [];
    if (rows.length && rows.every((r) => !active(r.state))) {
      const ok = rows.every((r) => r.state === 'completed');
      return publicRun(
        await save(run, {
          state: ok ? 'completed' : 'failed',
          message: ok ? 'All statements filed' : 'Some brokers need attention',
          result: { batchId: run.portalJobId, runs: rows },
        }),
      );
    }
    return publicRun({ ...run, result: { batchId: run.portalJobId, runs: rows } });
  }
  return publicRun(run);
}

function liveSession(run: Run) {
  if (
    run.state === 'blocked' ||
    run.state === 'failed' ||
    run.state === 'cancelled' ||
    run.state === 'completed'
  )
    throw new RunError('This run has ended: ' + run.message);
  if (!run.sessionId)
    throw new RunError(
      run.state === 'waiting_for_approval'
        ? 'Waiting for approval. Check get_approval_status.'
        : 'This run has no session.',
    );
  return run.sessionId;
}

export async function readSession(run: Run) {
  const page = await browserHost.read(liveSession(run));
  if (!originAllowed(page.url, run.allowedOrigins ?? [])) {
    await endSession(run, 'blocked', 'The page left the allowed website.');
    throw new RunError('The session left the allowed website and was closed.');
  }
  await save(run, { controls: page.controls });
  return scrubPage(page);
}

async function endSession(run: Run, state: VaultRun['state'], message: string, result?: unknown) {
  if (run.sessionId) await browserHost.close(run.sessionId).catch(() => undefined);
  return save(run, { state, message, ...(result === undefined ? {} : { result }) });
}

export async function actSession(
  conn: StoredConnection,
  run: Run,
  act: HostAction & { step_index?: number; reason?: string },
) {
  const sessionId = liveSession(run);
  const snapshot = await workflowVersions.get(versionKey(run.workflowId, run.workflowVersion));
  const labels = snapshot?.guardrails.checkpointLabels.length
    ? snapshot.guardrails.checkpointLabels
    : DEFAULT_CHECKPOINT_LABELS;
  const control = run.controls?.find((c) => c.id === act.target);
  const stepKey = act.step_index ?? -1;
  const checkpoint =
    (act.step_index !== undefined && Boolean(snapshot?.steps[act.step_index]?.checkpoint)) ||
    (act.action === 'click' &&
      Boolean(
        control && labels.some((l) => control.label.toLowerCase().includes(l.toLowerCase())),
      ));
  let current = run;
  if (checkpoint) {
    const decision = gate(run.mode, run.checks);
    if (decision === 'block' || decision === 'deny') {
      await endSession(
        run,
        'blocked',
        'Blocked at a checkpoint: ' + (failedNote(run.checks) || 'not allowed'),
      );
      throw new RunError('Blocked at a checkpoint by this connection’s settings.');
    }
    const approved = current.approvedSteps.includes(stepKey);
    if (decision === 'ask' && !approved) {
      const approval = await requestApproval(
        conn,
        {
          action: 'checkpoint',
          credentialId: run.credentialId,
          credentialName: run.credentialName,
          workflowId: run.workflowId,
          runId: run.id,
          reason: act.reason ?? '',
          detail:
            (control?.label ?? snapshot?.steps[stepKey]?.text ?? 'Checkpoint') +
            (run.amount !== null ? ' · R ' + run.amount : ''),
        },
        30,
      );
      await save(run, {
        state: 'waiting_for_approval',
        approvalId: approval.id,
        message: 'Waiting for approval at: ' + (control?.label ?? 'checkpoint'),
        steps: run.steps.map((s) => (s.index === stepKey ? { ...s, state: 'waiting' } : s)),
      });
      return {
        status: 'waiting_for_approval',
        approval_id: approval.id,
        expires_at: approval.expiresAt,
      };
    }
    if (run.risk === 'money' && conn.autonomy.holdMinutes > 0) {
      if (!current.holdUntil) {
        const until = new Date(Date.now() + conn.autonomy.holdMinutes * 60000).toISOString();
        await save(run, {
          state: 'held',
          holdUntil: until,
          message: 'Held until ' + until + ' so a person can cancel.',
        });
        return { status: 'held', until };
      }
      if (Date.parse(current.holdUntil) > Date.now())
        return { status: 'held', until: current.holdUntil };
    }
    if (approved)
      current = { ...current, approvedSteps: current.approvedSteps.filter((s) => s !== stepKey) };
  }
  const outcome = await browserHost.act(sessionId, {
    action: act.action,
    target: act.target,
    value: act.value,
  });
  if (!originAllowed(outcome.page.url, run.allowedOrigins ?? [])) {
    await endSession(current, 'blocked', 'The page left the allowed website.');
    throw new RunError('The session left the allowed website and was closed.');
  }
  const steps =
    act.step_index === undefined
      ? current.steps
      : current.steps.map((s) =>
          s.index <= act.step_index! && s.state !== 'done'
            ? { ...s, state: 'done' as const, at: new Date().toISOString() }
            : s,
        );
  await save(current, {
    state: 'running',
    steps,
    controls: outcome.page.controls,
    message: outcome.message || 'Step done',
  });
  if (checkpoint)
    await recordEvent({
      ...actorName(conn),
      action: 'Passed checkpoint',
      credentialId: run.credentialId,
      credentialName: run.credentialName,
      detail:
        run.workflowName +
        ' · ' +
        (control?.label ?? 'step ' + (stepKey + 1)) +
        ' · ' +
        (run.mode === 'auto' ? 'no approval needed' : 'approved'),
      outcome: 'ok',
    });
  return { status: 'done', page: scrubPage(outcome.page) };
}

export async function completeRun(
  conn: StoredConnection,
  run: Run,
  result: { summary: string; data?: unknown },
) {
  liveSession(run);
  const done = await endSession(
    run,
    'completed',
    result.summary.slice(0, 500),
    result.data ?? null,
  );
  await recordEvent({
    ...actorName(conn),
    action: 'Completed workflow',
    credentialId: run.credentialId,
    credentialName: run.credentialName,
    detail: run.workflowName + ' · ' + result.summary.slice(0, 300),
    outcome: 'ok',
  });
  return publicRun(done);
}

/** Called when a person decides an approval that belongs to a run. */
export async function afterDecision(runId: string, approved: boolean) {
  const run = (await runs.get(runId)) as Run | null;
  if (!run || run.state !== 'waiting_for_approval') return;
  if (!approved) {
    await endSession(run, 'cancelled', 'A person declined this run.');
    return;
  }
  const waitingStep = run.steps.find((s) => s.state === 'waiting');
  if (run.sessionId || waitingStep) {
    await save(run, {
      state: 'running',
      approvedSteps: [...run.approvedSteps, waitingStep?.index ?? -1],
      message: 'Approved. Repeat the step with session_act.',
      steps: run.steps.map((s) => (s.state === 'waiting' ? { ...s, state: 'todo' } : s)),
    });
    return;
  }
  // Resume exactly the version that was checked and approved, not a newer one.
  const snap = await workflowVersions.get(versionKey(run.workflowId, run.workflowVersion));
  if (!snap) {
    await save(run, { state: 'failed', message: 'The approved workflow version is missing.' });
    return;
  }
  await launch(await save(run, { state: 'running', message: 'Approved' }), snap);
}

export async function cancelRun(runId: string) {
  const run = (await runs.get(runId)) as Run | null;
  if (!run) return null;
  if (['completed', 'failed', 'cancelled', 'blocked'].includes(run.state)) return publicRun(run);
  if (run.portalJobId) {
    // Stop the reporting jobs too; finished ones refuse, which is fine.
    const batch = await batches.get(run.portalJobId);
    await Promise.all(
      (batch?.ids ?? []).map((jobId) => control(jobId, 'cancel').catch(() => undefined)),
    );
  }
  return publicRun(await endSession(run, 'cancelled', 'Cancelled by a super admin.'));
}

export async function listRuns(filter: { connection?: string; workflow?: string }) {
  return (await runs.listAll('password vault: run history'))
    .filter(
      (r) =>
        (!filter.connection || r.connectionId === filter.connection) &&
        (!filter.workflow || r.workflowId === filter.workflow),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 200)
    .map((r) => publicRun(r as Run));
}

/** Trust ladder: which workflows have earned the next autonomy step on this connection. */
export async function trustSuggestions(conn: StoredConnection): Promise<TrustSuggestion[]> {
  const mine = (await runs.listAll('password vault: trust ladder'))
    .filter((r) => r.connectionId === conn.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const out: TrustSuggestion[] = [];
  for (const workflowId of [...new Set(mine.map((r) => r.workflowId))]) {
    const history = mine.filter((r) => r.workflowId === workflowId);
    const currentMode =
      conn.autonomy.workflowOverrides[workflowId] ??
      conn.autonomy.actions[riskAction(history[0].risk)];
    let clean = 0;
    for (const r of history) {
      if (r.state !== 'completed' || r.checks.some((c) => c.passed === false)) break;
      clean++;
    }
    const next = suggestNext(currentMode, clean);
    if (next)
      out.push({
        workflowId,
        workflowName: history[0].workflowName,
        credentialName: history[0].credentialName,
        current: currentMode,
        suggested: next,
        cleanRuns: clean,
        reason: clean + ' completed runs in a row with every check passing.',
      });
  }
  return out;
}
