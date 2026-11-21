import type { z } from 'npm:zod@4.6.5';
import { entries, summary } from './repositories/password-vault.ts';
import { jobInput, allowedUrl } from './broker-ops-model.ts';
import {
  runs,
  brokers,
  workflows,
  batches,
  publicRun,
  createRuns,
  changeRun,
  active,
  type StoredRun,
} from './repositories/broker-ops.ts';
import { sha256Hex } from './sha256.ts';
import { getPortalGitHubActionsConfig } from './integrations-portal-runtime.ts';

export class OperationError extends Error {}
export const resourceUrl = 'https://www.navigatewealth.co/mcp/broker-operations';
export const siteOrigin = new URL(resourceUrl).origin;
export async function discover(after?: string) {
  const page = await entries.list({
    limit: 40,
    startAfter: after ? entries.key(after) : undefined,
  });
  const rows = await Promise.all(page.items.map(summary));
  const results = await Promise.all(
    rows
      .filter((r) => r.portal)
      .map(async (row) => {
        const p = row.portal!;
        return {
          accountId: row.id,
          accountName: row.name,
          provider: p.provider,
          purpose: p.purpose,
          brokerage: p.brokerage,
          brokers: await Promise.all(
            p.brokers.map(async (link) => ({
              ...link,
              name: (await brokers.get(link.brokerId))?.name ?? 'Unknown broker',
            })),
          ),
        };
      }),
  );
  return { accounts: results, nextCursor: page.nextCursor ? page.items.at(-1)?.id : null };
}
async function dispatch(id: string) {
  const { token, apiBase, repo, ref } = getPortalGitHubActionsConfig();
  if (!token) throw new Error('Worker dispatch is unavailable');
  const response = await fetch(
    apiBase + '/repos/' + repo + '/actions/workflows/broker-report-worker.yml/dispatches',
    {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref, inputs: { job_id: id } }),
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!response.ok) throw new Error('Worker dispatch failed');
}
export async function startJob(input: z.infer<typeof jobInput>, actor: string) {
  const batchId = await sha256Hex(actor + '|' + input.requestId);
  const ids = [...new Set(input.brokerIds)].sort();
  const signature = JSON.stringify([input.accountId, input.workflowId, input.month ?? '', ids]);
  async function replay() {
    const batch = await batches.get(batchId);
    if (!batch || batch.signature !== signature)
      throw new OperationError('This request ID is already used for different inputs.');
    const records = await Promise.all(batch.ids.map((id) => runs.get(id)));
    return { batchId, runs: records.filter((r): r is StoredRun => !!r).map(publicRun) };
  }
  if (await batches.get(batchId)) return replay();
  const entry = await entries.get(input.accountId);
  const workflow = await workflows.get(input.workflowId);
  if (!entry || !workflow) throw new OperationError('Unknown account or workflow.');
  const account = await summary(entry);
  const p = account.portal;
  if (!p || p.provider !== workflow.provider || !allowedUrl(account.url, p.provider, true))
    throw new OperationError('The workflow must match the linked provider.');
  if (workflow.kind === 'monthly_statement' && !input.month)
    throw new OperationError('Select a statement month.');
  const now = new Date().toISOString();
  const jobs: StoredRun[] = await Promise.all(
    ids.map(async (id) => {
      const broker = await brokers.get(id);
      const link = p.brokers.find((b) => b.brokerId === id);
      if (!broker || !link)
        throw new OperationError('One or more brokers are not linked to this account.');
      return {
        id: crypto.randomUUID(),
        batchId,
        actor,
        accountId: account.id,
        accountName: account.name,
        brokerId: id,
        brokerName: broker.name,
        code: link.code,
        provider: p.provider,
        workflowId: workflow.id,
        workflowName: workflow.name,
        kind: workflow.kind,
        month: input.month ?? '',
        state: 'queued',
        message: 'Queued for the reporting worker.',
        createdAt: now,
        updatedAt: now,
        deadline: Date.now() + 30 * 60000,
        workflow,
        identity: p.expectedIdentity,
        loginUrl: account.url,
        homeUrl: p.homeUrl,
        lease: '',
        revision: crypto.randomUUID(),
        mfaPrompt: p.mfaPrompt,
      };
    }),
  );
  if (!(await createRuns({ id: batchId, actor, signature, ids: jobs.map((j) => j.id) }, jobs)))
    return replay();
  await Promise.all(
    jobs.map(async (job) => {
      try {
        await dispatch(job.id);
      } catch {
        await changeRun(job, {
          state: 'failed',
          message: 'Could not dispatch the worker. Check GitHub Actions and retry this broker.',
        });
      }
    }),
  );
  return replay();
}
export async function control(id: string, action: 'cancel' | 'resume', actor?: string) {
  const r = await runs.get(id);
  if (!r || (actor && r.actor !== actor)) throw new OperationError('Unknown job.');
  if (!active(publicRun(r).state)) throw new OperationError('Job has already finished.');
  if (action === 'resume' && r.state !== 'awaiting_mfa')
    throw new OperationError('This job is not waiting for MFA.');
  const changed = await changeRun(
    r,
    action === 'cancel'
      ? { state: 'cancelled', message: 'Cancelled by operator.' }
      : { state: 'running', message: 'Checking provider approval in the same session.' },
  );
  if (!changed) throw new OperationError('The job changed. Refresh its status.');
  return publicRun(changed);
}
