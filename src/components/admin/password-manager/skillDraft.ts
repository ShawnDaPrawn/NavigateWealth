import {
  workflowRisks,
  type VaultWorkflow,
  type WorkflowInput,
} from '../../../shared/password-manager';

export const DEFAULT_CHECKPOINT_LABELS = ['Save', 'Submit', 'Confirm', 'Authorise'];

export function blankWorkflow(siteUrl: string): WorkflowInput {
  let origin = '';
  try {
    origin = new URL(siteUrl).origin;
  } catch {
    /* No origin to suggest. */
  }
  return {
    name: '',
    description: '',
    kind: 'skill',
    risk: 'read',
    automatedWorkflowId: null,
    inputs: [],
    steps: [{ text: '', checkpoint: false }],
    guardrails: {
      allowedOrigins: origin ? [origin] : [],
      checkpointLabels: [...DEFAULT_CHECKPOINT_LABELS],
      never: [],
      stopIf: [],
    },
    returns: '',
  };
}

export function workflowInputOf(workflow: VaultWorkflow): WorkflowInput {
  return {
    name: workflow.name,
    description: workflow.description,
    kind: workflow.kind,
    risk: workflow.risk,
    automatedWorkflowId: workflow.automatedWorkflowId,
    inputs: workflow.inputs.map((field) => ({ ...field })),
    steps: workflow.steps.map((step) => ({ ...step })),
    guardrails: {
      allowedOrigins: [...workflow.guardrails.allowedOrigins],
      checkpointLabels: [...workflow.guardrails.checkpointLabels],
      never: [...workflow.guardrails.never],
      stopIf: [...workflow.guardrails.stopIf],
    },
    returns: workflow.returns,
  };
}

/** The skill as an AI connection reads it, built from the form. */
export function skillPreview(draft: WorkflowInput, credentialName: string): string {
  const lines: string[] = [];
  lines.push(`# ${draft.name || 'Untitled workflow'}`);
  lines.push(`Login: ${credentialName} · Risk: ${workflowRisks[draft.risk]}`);
  lines.push('');
  lines.push('## When to use it');
  lines.push(draft.description || '(not written yet)');
  if (draft.kind === 'automated') {
    lines.push('');
    lines.push(
      `Runs the broker-reporting workflow ${draft.automatedWorkflowId ?? '(none chosen)'}; no browser steps.`,
    );
  }
  if (draft.inputs.length) {
    lines.push('');
    lines.push('## Inputs');
    for (const field of draft.inputs) {
      const choices = field.type === 'choice' && field.choices?.length;
      lines.push(
        `- ${field.name || '(unnamed)'} (${field.type}${field.required ? ', required' : ''})` +
          (field.description ? `: ${field.description}` : '') +
          (choices ? ` One of: ${field.choices!.join(', ')}.` : ''),
      );
    }
  }
  if (draft.kind === 'skill' && draft.steps.length) {
    lines.push('');
    lines.push('## Steps');
    draft.steps.forEach((step, i) =>
      lines.push(
        `${i + 1}. ${step.text || '(empty step)'}${step.checkpoint ? ' [checkpoint]' : ''}`,
      ),
    );
  }
  const g = draft.guardrails;
  lines.push('');
  lines.push('## Guardrails');
  lines.push(`- Stay on: ${g.allowedOrigins.join(', ') || 'the login’s own site'}`);
  if (g.checkpointLabels.length)
    lines.push(`- Treat buttons labelled ${g.checkpointLabels.join(', ')} as checkpoints`);
  g.never.forEach((rule) => lines.push(`- Never: ${rule}`));
  g.stopIf.forEach((rule) => lines.push(`- Stop if: ${rule}`));
  if (draft.returns) {
    lines.push('');
    lines.push('## Returns');
    lines.push(draft.returns);
  }
  return lines.join('\n');
}

export const splitLines = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
