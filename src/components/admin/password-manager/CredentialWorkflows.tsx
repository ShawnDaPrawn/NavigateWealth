import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../../ui/button';
import {
  workflowRisks,
  type VaultSummary,
  type VaultWorkflow,
} from '../../../shared/password-manager';
import { DsPill } from '../layout/page/ds';
import { listWorkflows } from './vaultApi';
import SkillEditor from './SkillEditor';
import { ErrorLine, useAction } from './ui';

export default function CredentialWorkflows({ credential }: { credential: VaultSummary }) {
  const [rows, setRows] = useState<VaultWorkflow[] | null>(null);
  const [editing, setEditing] = useState<VaultWorkflow | 'new' | null>(null);
  const [generation, setGeneration] = useState(0);
  const { error, run } = useAction();
  useEffect(() => {
    void run(async () => setRows(await listWorkflows(credential.id)), 'Could not load workflows.');
  }, [credential.id, generation, run]);
  const reload = () => setGeneration((n) => n + 1);

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground">
          Steps an AI or the broker-reporting runner follows with this login.
        </p>
        <Button size="sm" onClick={() => setEditing('new')}>
          <Plus aria-hidden="true" />
          New workflow
        </Button>
      </div>
      <ErrorLine>{error}</ErrorLine>
      {rows === null && !error && <p role="status">Loading…</p>}
      {rows?.length === 0 && (
        <p className="rounded-lg border border-dashed p-4 text-muted-foreground">
          No workflows yet. Add one to let an AI do a task with this login.
        </p>
      )}
      <ul className="grid gap-2">
        {rows?.map((w) => (
          <li key={w.id}>
            <button
              type="button"
              onClick={() => setEditing(w)}
              className="grid w-full gap-1 rounded-lg border p-3 text-left hover:bg-black/5"
            >
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{w.name}</span>
                <DsPill tone={w.status === 'live' ? 'ok' : 'neutral'}>
                  {w.status === 'live' ? 'Live v' + w.liveVersion : 'Draft v' + w.version}
                </DsPill>
              </span>
              <span className="text-xs text-muted-foreground">
                {w.kind === 'automated' ? 'Automated' : 'Skill'} · {workflowRisks[w.risk]}
                {w.status === 'live' && w.version !== w.liveVersion
                  ? ' · Draft v' + w.version + ' not published'
                  : ''}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {editing && (
        <SkillEditor
          credential={credential}
          workflow={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={reload}
        />
      )}
    </div>
  );
}
