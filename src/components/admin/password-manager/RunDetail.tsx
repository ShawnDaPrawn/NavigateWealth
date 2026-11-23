import { useEffect, useState } from 'react';
import { Button } from '../../ui/button';
import {
  actionModes,
  checkLabels,
  checkModes,
  workflowRisks,
  type VaultRun,
} from '../../../shared/password-manager';
import { DsPill } from '../layout/page/ds';
import { cancelRun, getRun } from './vaultApi';
import { ErrorLine, formatWhen, runStateLabels, useAction } from './ui';

const stepTone = { done: 'ok', waiting: 'warn', todo: 'neutral' } as const;
const stepLabel = { done: 'Done', waiting: 'Waiting', todo: 'To do' } as const;

export default function RunDetail({
  run: initial,
  onBack,
  onOpenApprovals,
  onChanged,
}: {
  run: VaultRun;
  onBack: () => void;
  onOpenApprovals: () => void;
  onChanged: () => void;
}) {
  const [run, setRun] = useState(initial);
  const action = useAction();
  useEffect(() => {
    let alive = true;
    getRun(initial.id)
      .then((fresh) => {
        if (alive) setRun(fresh);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [initial.id]);
  const open = ['running', 'waiting_for_approval', 'held'].includes(run.state);

  return (
    <div className="grid gap-4">
      <Button variant="ghost" className="justify-self-start" onClick={onBack}>
        Back to runs
      </Button>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">
            {run.workflowName} · v{run.workflowVersion}
          </h3>
          <p className="text-sm text-muted-foreground">
            {run.credentialName} · {run.connectionName || 'Started by a person'} ·{' '}
            {workflowRisks[run.risk]} · {actionModes[run.mode]}
          </p>
          <p className="text-sm text-muted-foreground">Started {formatWhen(run.createdAt)}</p>
        </div>
        <DsPill tone={run.state === 'completed' ? 'ok' : open ? 'warn' : 'bad'}>
          {runStateLabels[run.state]}
        </DsPill>
      </header>
      {run.message && <p className="text-sm">{run.message}</p>}
      {run.amount !== null && <p className="text-sm">Amount: R {run.amount.toLocaleString()}</p>}
      <ErrorLine>{action.error}</ErrorLine>
      <section>
        <h4 className="mb-1 font-medium">Steps</h4>
        <ol className="grid gap-1 text-sm">
          {run.steps.map((step) => (
            <li key={step.index} className="flex flex-wrap items-start gap-2 border-t py-1.5">
              <DsPill tone={stepTone[step.state]}>{stepLabel[step.state]}</DsPill>
              <span className="min-w-0 flex-1">
                {step.index + 1}. {step.text}
                {step.note && (
                  <span className="block text-xs text-muted-foreground">{step.note}</span>
                )}
              </span>
              {step.at && (
                <span className="text-xs text-muted-foreground">{formatWhen(step.at)}</span>
              )}
            </li>
          ))}
        </ol>
      </section>
      {run.checks.length > 0 && (
        <section>
          <h4 className="mb-1 font-medium">Checks</h4>
          <ul className="grid gap-1 text-sm">
            {run.checks.map((check) => (
              <li key={check.key} className="flex flex-wrap items-start gap-2 border-t py-1.5">
                <DsPill tone={check.passed === null ? 'neutral' : check.passed ? 'ok' : 'bad'}>
                  {check.passed === null ? 'Not run' : check.passed ? 'Pass' : 'Fail'}
                </DsPill>
                <span className="min-w-0 flex-1">
                  {checkLabels[check.key]}
                  <span className="block text-xs text-muted-foreground">
                    {checkModes[check.mode]}
                    {check.note ? ' · ' + check.note : ''}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="flex flex-wrap gap-2">
        {run.approvalId && (
          <Button variant="outline" onClick={onOpenApprovals}>
            Open approval
          </Button>
        )}
        {open && (
          <Button
            variant="destructive"
            disabled={action.busy}
            onClick={() =>
              void action.run(async () => {
                await cancelRun(run.id);
                setRun({ ...run, state: 'cancelled' });
                onChanged();
              })
            }
          >
            Cancel run
          </Button>
        )}
      </div>
    </div>
  );
}
