/**
 * Workflows on a credential: fixed "automated" steps run by the broker
 * reporting runner, or a written skill an AI follows in a hosted session.
 * Edits are drafts; publishing freezes a numbered version that runs use.
 */
import { z } from 'npm:zod@4.6.5';
import type { VaultWorkflow, WorkflowInput } from '../../../shared/password-manager.ts';
import {
  compareAndSet,
  versionKey,
  workflowVersions,
  workflows,
  type StoredWorkflow,
  type WorkflowSnapshot,
} from './repositories/vault-store.ts';

const name = z.string().trim().min(1).max(120);
export const workflowInput = z
  .object({
    name,
    description: z.string().trim().max(4000),
    kind: z.enum(['automated', 'skill']),
    risk: z.enum(['read', 'change', 'money']),
    automatedWorkflowId: z.string().max(100).nullable(),
    inputs: z
      .array(
        z.object({
          name: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/, 'Use lower_case input names'),
          type: z.enum(['text', 'number', 'amount', 'choice', 'document', 'fields']),
          required: z.boolean(),
          description: z.string().max(500),
          choices: z.array(z.string().max(100)).max(30).optional(),
        }),
      )
      .max(30),
    steps: z
      .array(z.object({ text: z.string().trim().min(1).max(1000), checkpoint: z.boolean() }))
      .max(60),
    guardrails: z.object({
      allowedOrigins: z
        .array(
          z
            .string()
            .max(200)
            .refine((v) => {
              try {
                return new URL(v).origin === v && v.startsWith('https://');
              } catch {
                return false;
              }
            }, 'Enter origins like https://www.example.co.za'),
        )
        .max(10),
      checkpointLabels: z.array(z.string().trim().min(1).max(40)).max(20),
      never: z.array(z.string().trim().min(1).max(300)).max(30),
      stopIf: z.array(z.string().trim().min(1).max(300)).max(30),
    }),
    returns: z.string().max(2000),
  })
  .refine((v) => v.kind === 'skill' || Boolean(v.automatedWorkflowId), {
    message: 'Choose the broker-reporting workflow this runs',
  });

export const DEFAULT_CHECKPOINT_LABELS = ['Save', 'Submit', 'Confirm', 'Authorise', 'Authorize'];

export async function listForCredential(credentialId: string) {
  return (await workflows.listAll('password vault: workflows for one credential'))
    .filter((w) => w.credentialId === credentialId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function createWorkflow(credentialId: string, input: WorkflowInput, by: string) {
  const row: StoredWorkflow = {
    ...input,
    id: crypto.randomUUID(),
    credentialId,
    revision: crypto.randomUUID(),
    version: 1,
    status: 'draft',
    liveVersion: null,
    updatedAt: new Date().toISOString(),
    updatedBy: by,
  };
  await workflows.put(row.id, row);
  return row;
}

export async function updateWorkflow(
  row: StoredWorkflow,
  input: WorkflowInput,
  revision: string,
  by: string,
) {
  const next: StoredWorkflow = {
    ...row,
    ...input,
    // Editing a live workflow starts the next draft; the live version keeps running.
    version: row.status === 'live' ? row.version + 1 : row.version,
    status: 'draft',
    revision: crypto.randomUUID(),
    updatedAt: new Date().toISOString(),
    updatedBy: by,
  };
  return (await compareAndSet(workflows.key(row.id), next, 'revision', revision)) ? next : null;
}

export async function publish(row: StoredWorkflow, by: string) {
  const {
    id: _i,
    credentialId: _c,
    revision: _r,
    version,
    status: _s,
    liveVersion: _l,
    updatedAt: _u,
    updatedBy: _b,
    ...input
  } = row;
  const snapshot: WorkflowSnapshot = {
    ...input,
    version,
    publishedAt: new Date().toISOString(),
    publishedBy: by,
  };
  await workflowVersions.put(versionKey(row.id, version), snapshot);
  const next: StoredWorkflow = {
    ...row,
    status: 'live',
    liveVersion: version,
    revision: crypto.randomUUID(),
    updatedAt: snapshot.publishedAt,
    updatedBy: by,
  };
  return (await compareAndSet(workflows.key(row.id), next, 'revision', row.revision)) ? next : null;
}

export async function versions(workflowId: string) {
  const rows = await workflowVersions.listWithKeys(
    'password vault: workflow versions',
    workflowId + ':',
  );
  return rows
    .map(({ value }) => ({
      version: value.version,
      publishedAt: value.publishedAt,
      publishedBy: value.publishedBy,
    }))
    .sort((a, b) => b.version - a.version);
}

export async function liveSnapshot(row: VaultWorkflow) {
  return row.liveVersion === null
    ? null
    : workflowVersions.get(versionKey(row.id, row.liveVersion));
}

/** The skill as an AI reads it through get_skill. */
export function renderSkill(w: WorkflowSnapshot, credentialName: string) {
  const lines = [
    '# ' + w.name + ' (' + credentialName + ', version ' + w.version + ')',
    'risk: ' + w.risk,
    'use when: ' + (w.description || '—'),
    '',
    'inputs:',
    ...w.inputs.map(
      (i) =>
        '  ' +
        i.name +
        ' (' +
        i.type +
        (i.required ? ', required' : '') +
        (i.choices?.length ? ': ' + i.choices.join(' | ') : '') +
        ')' +
        (i.description ? ' — ' + i.description : ''),
    ),
    '',
    'steps:',
    ...w.steps.map(
      (s, i) => '  ' + (i + 1) + '. ' + s.text + (s.checkpoint ? '  [checkpoint]' : ''),
    ),
  ];
  if (w.guardrails.never.length)
    lines.push('', 'never:', ...w.guardrails.never.map((n) => '  - ' + n));
  if (w.guardrails.stopIf.length)
    lines.push('', 'stop and report if:', ...w.guardrails.stopIf.map((n) => '  - ' + n));
  lines.push(
    '',
    'checkpoints: controls labelled ' +
      (w.guardrails.checkpointLabels.length
        ? w.guardrails.checkpointLabels
        : DEFAULT_CHECKPOINT_LABELS
      ).join(', ') +
      ', and marked steps. Pass step_index to session_act.',
    'return: ' + (w.returns || 'a short summary of what was done'),
  );
  return lines.join('\n');
}
