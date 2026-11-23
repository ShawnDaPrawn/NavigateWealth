import { useEffect, useState } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import {
  workflowRisks,
  type VaultSummary,
  type VaultWorkflow,
  type WorkflowInput,
  type WorkflowRisk,
  type WorkflowVersion,
} from '../../../shared/password-manager';
import type { Workflow as BrokerWorkflow } from '../../../shared/broker-operations';
import { getSetup } from './portalApi';
import {
  createWorkflow,
  deleteWorkflow,
  listWorkflowVersions,
  publishWorkflow,
  updateWorkflow,
} from './vaultApi';
import { blankWorkflow, skillPreview, workflowInputOf } from './skillDraft';
import { InputsEditor, StepsEditor } from './SkillEditorParts';
import { ErrorLine, Field, ListInput, NativeSelect, formatWhen, useAction } from './ui';

export default function SkillEditor({
  credential,
  workflow,
  onClose,
  onSaved,
}: {
  credential: VaultSummary;
  workflow: VaultWorkflow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saved, setSaved] = useState<VaultWorkflow | null>(workflow);
  const [draft, setDraft] = useState<WorkflowInput>(() =>
    workflow ? workflowInputOf(workflow) : blankWorkflow(credential.url),
  );
  const [dirty, setDirty] = useState(!workflow);
  const [brokerFlows, setBrokerFlows] = useState<BrokerWorkflow[]>([]);
  const [versions, setVersions] = useState<WorkflowVersion[]>([]);
  const [notice, setNotice] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { busy, error, run } = useAction();
  const set = (patch: Partial<WorkflowInput>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setDirty(true);
  };
  const guard = (patch: Partial<WorkflowInput['guardrails']>) =>
    set({ guardrails: { ...draft.guardrails, ...patch } });

  useEffect(() => {
    if (draft.kind !== 'automated' || brokerFlows.length) return;
    getSetup()
      .then((setup) => setBrokerFlows(setup.workflows))
      .catch(() => {});
  }, [draft.kind, brokerFlows.length]);
  useEffect(() => {
    if (!saved?.id) return;
    listWorkflowVersions(saved.id)
      .then(setVersions)
      .catch(() => {});
  }, [saved?.id, saved?.liveVersion]);

  async function save(): Promise<VaultWorkflow> {
    const next = saved
      ? await updateWorkflow(saved.id, saved.revision, draft)
      : await createWorkflow(credential.id, draft);
    setSaved(next);
    setDirty(false);
    onSaved();
    return next;
  }
  const provider = credential.portal?.provider;
  const flows = provider ? brokerFlows.filter((f) => f.provider === provider) : brokerFlows;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{saved ? 'Edit workflow' : 'New workflow'}</DialogTitle>
          <DialogDescription>
            {credential.name || credential.url}
            {saved &&
              ' · Draft v' +
                saved.version +
                (saved.liveVersion ? ' · Live v' + saved.liveVersion : ' · Not live yet')}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <form
            className="grid content-start gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await save();
                setNotice('Draft saved.');
              });
            }}
          >
            <fieldset className="grid gap-3 sm:grid-cols-2" disabled={busy}>
              <Field label="Name">
                <Input
                  required
                  maxLength={120}
                  value={draft.name}
                  onChange={(e) => set({ name: e.target.value })}
                />
              </Field>
              <Field label="Risk">
                <NativeSelect
                  value={draft.risk}
                  onChange={(e) => set({ risk: e.target.value as WorkflowRisk })}
                >
                  {(Object.keys(workflowRisks) as WorkflowRisk[]).map((r) => (
                    <option key={r} value={r}>
                      {workflowRisks[r]}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Kind">
                <NativeSelect
                  value={draft.kind}
                  onChange={(e) =>
                    set({
                      kind: e.target.value as WorkflowInput['kind'],
                      automatedWorkflowId: null,
                    })
                  }
                >
                  <option value="skill">Skill — an AI follows written steps</option>
                  <option value="automated">Automated — runs fixed broker-reporting steps</option>
                </NativeSelect>
              </Field>
              {draft.kind === 'automated' && (
                <Field label="Broker-reporting workflow">
                  <NativeSelect
                    required
                    value={draft.automatedWorkflowId ?? ''}
                    onChange={(e) => set({ automatedWorkflowId: e.target.value || null })}
                  >
                    <option value="">Choose a workflow</option>
                    {flows.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              )}
              <Field
                label="When to use it"
                hint="An AI reads this to decide whether this workflow fits the job."
                className="sm:col-span-2"
              >
                <Textarea
                  required
                  maxLength={2000}
                  value={draft.description}
                  onChange={(e) => set({ description: e.target.value })}
                />
              </Field>
            </fieldset>
            <InputsEditor value={draft.inputs} onChange={(inputs) => set({ inputs })} />
            {draft.kind === 'skill' && (
              <StepsEditor value={draft.steps} onChange={(steps) => set({ steps })} />
            )}
            <fieldset className="grid gap-3 sm:grid-cols-2">
              <legend className="text-sm font-semibold">Guardrails</legend>
              <Field label="Allowed sites" hint="Origins, separated by commas.">
                <ListInput
                  value={draft.guardrails.allowedOrigins}
                  onChange={(allowedOrigins) => guard({ allowedOrigins })}
                />
              </Field>
              <Field label="Checkpoint button labels" hint="Separated by commas.">
                <ListInput
                  value={draft.guardrails.checkpointLabels}
                  onChange={(checkpointLabels) => guard({ checkpointLabels })}
                />
              </Field>
              <Field label="Never" hint="One rule per line.">
                <ListInput
                  multiline
                  value={draft.guardrails.never}
                  onChange={(never) => guard({ never })}
                />
              </Field>
              <Field label="Stop if" hint="One condition per line.">
                <ListInput
                  multiline
                  value={draft.guardrails.stopIf}
                  onChange={(stopIf) => guard({ stopIf })}
                />
              </Field>
            </fieldset>
            <Field label="Returns" hint="What the AI should report back when it finishes.">
              <Textarea
                maxLength={2000}
                value={draft.returns}
                onChange={(e) => set({ returns: e.target.value })}
              />
            </Field>
            <ErrorLine>{error}</ErrorLine>
            {notice && <p role="status">{notice}</p>}
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy || !dirty}>Save draft</Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const current = dirty || !saved ? await save() : saved;
                    setSaved(await publishWorkflow(current.id, current.revision));
                    setNotice('Published. AI connections now use this version.');
                    onSaved();
                  })
                }
              >
                Publish
              </Button>
              {saved &&
                (confirmDelete ? (
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await deleteWorkflow(saved.id);
                        onSaved();
                        onClose();
                      })
                    }
                  >
                    Delete workflow
                  </Button>
                ) : (
                  <Button type="button" variant="ghost" onClick={() => setConfirmDelete(true)}>
                    Delete
                  </Button>
                ))}
            </div>
          </form>
          <aside className="grid content-start gap-4">
            <section>
              <h3 className="mb-1 text-sm font-semibold">What the AI reads</h3>
              <pre
                aria-label="What the AI reads"
                className="max-h-[28rem] overflow-auto rounded-md border bg-muted/40 p-3 text-xs whitespace-pre-wrap"
              >
                {skillPreview(draft, credential.name || credential.url)}
              </pre>
            </section>
            {versions.length > 0 && (
              <section>
                <h3 className="mb-1 text-sm font-semibold">Published versions</h3>
                <ul className="grid gap-1 text-sm">
                  {versions.map((v) => (
                    <li key={v.version}>
                      v{v.version} · {formatWhen(v.publishedAt)} · {v.publishedBy}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}
